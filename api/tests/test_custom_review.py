import json
from time import perf_counter
from threading import Event, Thread

import pytest
from fastapi.testclient import TestClient

from test_custom import synthetic, request, entry, wait_state
from truesouth_api.jobs import Computer, Jobs, Rejected, site_id
from truesouth_api.main import create_app


@pytest.fixture
def empty_tree(tmp_path):
    return tuple(tmp_path/name for name in ('derived', 'prepared', 'cache'))


@pytest.mark.parametrize('body', [
    b'{"lat_deg":NaN,"lon_deg":0}', b'{"lat_deg":Infinity,"lon_deg":0}',
    b'{"lat_deg":-Infinity,"lon_deg":0}', b'{"lat_deg":1e309,"lon_deg":0}',
    b'{"lat_deg":0,"lon_deg":NaN}', b'{"lat_deg":0,"lon_deg":Infinity}',
    b'{"lat_deg":0,"lon_deg":-Infinity}', b'{"lat_deg":0,"lon_deg":1e309}',
    b'{"lat_deg":"-89.2","lon_deg":0}', b'{"lat_deg":true,"lon_deg":0}',
    b'{"lat_deg":0,"lon_deg":false}', b'{"lat_deg":0,"lon_deg":"2"}',
    b'{"lat_deg":{},"lon_deg":0}', b'{"lat_deg":[],"lon_deg":0}',
    b'{"lat_deg":0,"lon_deg":0,"name":42}', b'{"lat_deg":0,"lon_deg":0,"name":true}',
    b'{"lat_deg":0,"lon_deg":0,"name":{}}', b'{"lat_deg":0,"lon_deg":0,"name":[]}',
    b'{"lat_deg":0}', b'{}', b'[]', b'null', b'', b'{broken',
    b'{"lat_deg":0,"lon_deg":0,"SECRET_CLIENT_FIELD":"SECRET_PAYLOAD"}',
])
def test_invalid_bodies_are_plain_422(empty_tree, body):
    derived, prepared, cache = empty_tree
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache), raise_server_exceptions=False) as client:
        response = client.post('/api/sites/custom', content=body, headers={'Content-Type':'application/json'})
        assert response.status_code == 422
        data = response.json()
        assert set(data) == {'message', 'fields'}
        assert data['fields']
        assert all(set(field) == {'field', 'message'} for field in data['fields'])
        assert 'SECRET' not in response.text
        assert 'input' not in response.text
        if b'lat_deg' in body and b'lon_deg' in body and b'name' not in body and b'lat_deg":0' not in body:
            assert data['fields'][0]['message'] == 'Latitude must be a number from −90 to 90.'


def test_sphere_and_status_do_not_wait_for_terrain(synthetic, monkeypatch):
    from truesouth.commands import build_sites
    derived, prepared, cache = synthetic
    entered, release, done = Event(), Event(), Event()
    def build(body, store, global_data, target, **kwargs):
        if kwargs['tier'] != 'sphere':
            entered.set()
            assert release.wait(5)
        return entry(body)
    monkeypatch.setattr(build_sites, 'build_site', build)
    computer = Computer(derived, prepared, cache)
    jobs = Jobs(cache, computer)
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache, jobs=jobs)) as client:
        first = client.post('/api/sites/custom', json=dict(lat_deg=-89.99, lon_deg=0)).json()
        assert entered.wait(2)
        result = []
        def sphere():
            result.append(client.post('/api/sites/custom', json=dict(lat_deg=0, lon_deg=0)))
            done.set()
        thread = Thread(target=sphere)
        thread.start()
        try:
            started = perf_counter()
            assert client.get('/api/sites/custom/'+first['site_id']).json()['status'] == 'running'
            assert perf_counter()-started < .4
            assert done.wait(.4), 'sphere POST waited for the terrain calculation'
            assert result[0].json()['status'] == 'ready'
        finally:
            release.set()
            thread.join(3)


@pytest.mark.parametrize('failure', [KeyboardInterrupt, SystemExit])
def test_base_exception_fails_job_and_worker_survives(tmp_path, failure):
    entered, release = Event(), Event()
    class Broken:
        def tier(self, body): return 'core80'
        def __call__(self, body, tier):
            if body.lon_deg == 1:
                entered.set()
                assert release.wait(3)
                raise failure('private detail')
            return entry(body)
    jobs = Jobs(tmp_path, Broken())
    try:
        first = jobs.submit(request(lon=1), 'one')['site_id']
        assert entered.wait(2)
        second = jobs.submit(request(lon=2), 'two')['site_id']
        release.set()
        with jobs.condition:
            assert jobs.condition.wait_for(lambda: jobs.states[first]['status']=='failed', timeout=1)
            assert jobs.condition.wait_for(lambda: jobs.states[second]['status']=='ready', timeout=1)
        assert jobs.worker.is_alive()
    finally:
        release.set()
        jobs.close()


def test_dead_worker_is_reconciled_and_restarted(tmp_path):
    class Normal:
        def tier(self, body): return 'core80'
        def __call__(self, body, tier): return entry(body)
    jobs = Jobs(tmp_path, Normal())
    dead = Thread(target=lambda: None)
    dead.start(); dead.join()
    jobs.worker = dead
    identity = site_id(request(lon=1))
    jobs.states[identity] = dict(site_id=identity, status='running', site=None, error=None)
    assert jobs.status(identity)['status'] == 'failed'
    try:
        second = jobs.submit(request(lon=2), 'two')['site_id']
        with jobs.condition:
            assert jobs.condition.wait_for(lambda: jobs.states[second]['status']=='ready', timeout=1)
        assert jobs.worker.is_alive()
    finally:
        jobs.close()


@pytest.mark.parametrize('field', ['name', 'extra'])
@pytest.mark.parametrize('streamed', [False, True])
def test_large_body_is_413(empty_tree, field, streamed):
    derived, prepared, cache = empty_tree
    body = json.dumps(dict(lat_deg=0, lon_deg=0, **{field:'SECRET'*1_750_000})).encode()
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache)) as client:
        response = client.post('/api/sites/custom', content=iter([body[:2000], body[2000:]]) if streamed else body,
                               headers={'Content-Type':'application/json'})
        assert response.status_code == 413
        assert response.json() == {'message':'Custom-site requests must be at most 4096 bytes.'}
        assert 'SECRET' not in response.text


def test_stream_limit_stops_receiving_before_parsing(empty_tree):
    import asyncio
    derived, prepared, cache = empty_tree
    app = create_app(derived=derived, prepared=prepared, cache=cache)
    seen, sent = [], []
    async def receive():
        seen.append(1)
        assert len(seen) == 1, 'read past the size limit'
        return {'type':'http.request', 'body':b'x'*4097, 'more_body':True}
    async def send(message): sent.append(message)
    scope = dict(type='http', asgi={'version':'3.0'}, http_version='1.1', method='POST',
        scheme='http', path='/api/sites/custom', raw_path=b'/api/sites/custom', query_string=b'',
        headers=[(b'content-type', b'application/json')], server=('localhost',80), client=('test',1))
    asyncio.run(app(scope, receive, send))
    assert sent[0]['status'] == 413
    assert len(seen) == 1


class Instant:
    def tier(self, body): return 'sphere'
    def __call__(self, body, tier): return entry(body)


def test_finished_states_are_bounded(tmp_path):
    jobs = Jobs(tmp_path, Instant(), finished_limit=2)
    for i in range(8): jobs.submit(request(0, i), str(i))
    assert len(jobs.states) == 2
    assert set(jobs.states) == {site_id(request(0, 6)), site_id(request(0, 7))}


def test_rejected_and_expired_addresses_are_not_retained(tmp_path):
    class Missing(Instant):
        def tier(self, body): raise Rejected(503, 'No maps')
    jobs = Jobs(tmp_path, Missing())
    for i in range(30):
        with pytest.raises(Rejected): jobs.submit(request(0, i), str(i))
    assert jobs.starts == {}
    now = [0.]
    jobs = Jobs(tmp_path, Instant(), clock=lambda: now[0], max_addresses=2)
    jobs.submit(request(0, 0), 'a'); jobs.submit(request(0, 1), 'b')
    with pytest.raises(Rejected) as full: jobs.submit(request(0, 2), 'c')
    assert full.value.status == 503 and len(jobs.starts) == 2
    now[0] = 3600
    jobs.submit(request(0, 3), 'c')
    assert set(jobs.starts) == {'c'}


def test_storage_full_rejected_without_job_or_slot(empty_tree):
    derived, prepared, cache = empty_tree
    jobs = Jobs(cache, Computer(derived, prepared, cache), cache_limit_bytes=1)
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache, jobs=jobs)) as client:
        response = client.post('/api/sites/custom', json=dict(lat_deg=0, lon_deg=0))
        assert response.status_code == 507
        assert response.json() == {'message':"This server's storage for custom sites is full."}
        assert jobs.states == {} and jobs.starts == {}
        health = client.get('/api/health').json()
        assert health['custom_cache'] == {'size_bytes':0, 'limit_bytes':1}


def test_storage_publication_does_not_evict(tmp_path):
    from truesouth_api.storage import CacheBudget
    root = tmp_path/'cache'; root.mkdir()
    budget = CacheBudget(root, 10)
    for name in ('one', 'two'):
        stage = tmp_path/name; stage.mkdir(); (stage/'series.bin').write_bytes(b'1234567')
    budget.publish(tmp_path/'one', root/'one')
    with pytest.raises(Rejected) as full: budget.publish(tmp_path/'two', root/'two')
    assert full.value.status == 507
    assert (root/'one/series.bin').read_bytes() == b'1234567'
    assert not (root/'two').exists()


@pytest.mark.parametrize('identity', ['c_-089.2000_130.5000', 'c_-0.0000_0.0000',
    'c_00.0000_0.0000', 'c_0.0000_360.0000', 'c_91.0000_0.0000', 'c_90.0000_1.0000',
    'c_+0.0000_0.0000', 'c_1e0_0.0000', 'c_\u0660.0000_0.0000'])
def test_noncanonical_cache_folders_are_never_served(empty_tree, identity):
    derived, prepared, cache = empty_tree
    folder = cache/identity; folder.mkdir(parents=True)
    site = entry(request(0, 0)).model_dump(); site['id'] = identity
    (folder/'site.json').write_text(json.dumps(site))
    for filename in ('meta.json', 'series.bin', 'skyline.bin'):
        (folder/filename).write_bytes(b'SECRET_NONCANONICAL')
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache)) as client:
        assert client.get('/api/sites/custom/'+identity).status_code == 404
        response = client.get('/api/custom/'+identity+'/series.bin')
        assert response.status_code == 404 and b'SECRET' not in response.content
        assert identity not in client.get('/api/health').text


def test_clean_name_and_pole_identity(synthetic):
    from truesouth_api.jobs import ID
    import re
    assert ID.flags & re.ASCII
    assert site_id(request(90, 123)) == 'c_90.0000_0.0000'
    assert site_id(request(-90, 321)) == 'c_-90.0000_0.0000'
    body = request(0, 0, name=' \x00\n../display\t\u200b only\x7f ')
    assert body.name == '../display only'
    derived, prepared, cache = synthetic
    jobs = Jobs(cache, Computer(derived, prepared, cache))
    assert jobs.submit(body, 'one')['status'] == 'ready'
    assert sorted(p.name for p in cache.iterdir()) == ['c_0.0000_0.0000']
    assert jobs.cached(site_id(body))['name'] == '../display only'
