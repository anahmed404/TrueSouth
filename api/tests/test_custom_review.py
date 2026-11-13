import json
from time import perf_counter
from threading import Event, Thread

import pytest
from fastapi.testclient import TestClient

from test_custom import synthetic, request, entry, wait_state
from truesouth_api.jobs import Computer, Jobs, Rejected, site_id
from truesouth_api.main import create_app


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
def test_invalid_bodies_are_plain_422(synthetic, body):
    derived, prepared, cache = synthetic
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
def test_large_body_is_413(synthetic, field, streamed):
    derived, prepared, cache = synthetic
    body = json.dumps(dict(lat_deg=0, lon_deg=0, **{field:'SECRET'*1_750_000})).encode()
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache)) as client:
        response = client.post('/api/sites/custom', content=iter([body[:2000], body[2000:]]) if streamed else body,
                               headers={'Content-Type':'application/json'})
        assert response.status_code == 413
        assert response.json() == {'message':'Custom-site requests must be at most 4096 bytes.'}
        assert 'SECRET' not in response.text


def test_stream_limit_stops_receiving_before_parsing(synthetic):
    import asyncio
    derived, prepared, cache = synthetic
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
