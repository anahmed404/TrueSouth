"""S10b: deterministic queue tests, HTTP integration and optional real terrain check."""
from pathlib import Path
from threading import Event
import json
import os
from time import perf_counter

import numpy as np
import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from truesouth.contracts import CustomSiteRequest, Site
from truesouth.constants import TIME_GRID_COUNT
from truesouth.derived_io import write_system
from truesouth_api.jobs import Computer, Jobs, Rejected, site_id
from truesouth_api.main import create_app


def request(lat=-89.2, lon=130.5, **extra):
    return CustomSiteRequest(lat_deg=lat, lon_deg=lon, **extra)


def entry(body, tier='sphere'):
    return Site(id=site_id(body), name=body.name, group='contrast', lat_deg=body.lat_deg,
        lon_deg=body.lon_deg, description='User coordinates', source_url='', outcome=None,
        terrain_tier=tier, has_closeup=False, elevation_m=None, slope=None,
        quickmap_url='', moontrek_url='')


@pytest.mark.parametrize('lon,expected', [(-229.5, '130.5000'), (490.5, '130.5000'), (359.99999, '0.0000')])
def test_identity(lon, expected):
    assert site_id(request(lon=lon)) == 'c_-89.2000_' + expected
    assert site_id(request(-0.000001, 0)) == 'c_0.0000_0.0000'
    assert request(name='  ridge  ').name == 'ridge'


@pytest.mark.parametrize('values', [dict(lat_deg=91, lon_deg=0), dict(lat_deg=-91, lon_deg=0),
    dict(lat_deg=0, lon_deg=float('nan')), dict(lat_deg=0, lon_deg=float('inf')),
    dict(lat_deg=float('nan'), lon_deg=0), dict(lat_deg=0, lon_deg=0, name='a'*121)])
def test_validation(values):
    with pytest.raises(ValidationError):
        CustomSiteRequest(**values)


class Fake:
    def __init__(self):
        self.entered, self.release = Event(), Event()
        self.order = []
    def tier(self, body):
        return 'core80'
    def __call__(self, body, tier):
        self.entered.set()
        assert self.release.wait(10)
        self.order.append(site_id(body))
        if body.lon_deg == 0:
            raise ValueError('private internal error')
        return entry(body)


def wait_state(jobs, identity, status):
    with jobs.condition:
        assert jobs.condition.wait_for(lambda: jobs.states[identity]['status'] == status, timeout=60)


def test_fifo_limit_failure_survival_and_duplicates(tmp_path):
    fake = Fake()
    jobs = Jobs(tmp_path, fake)
    try:
        first = jobs.submit(request(lon=0), 'first')
        assert fake.entered.wait(5)
        assert jobs.status(first['site_id'])['status'] == 'running'
        assert jobs.submit(request(lon=0), 'first')['status'] == 'running'
        for i in range(1, 21):
            assert jobs.submit(request(lon=i), str(i))['position_in_queue'] == i
        with pytest.raises(Rejected) as full:
            jobs.submit(request(lon=21), '21')
        assert full.value.status == 429
        fake.release.set()
        wait_state(jobs, site_id(request(lon=20)), 'ready')
        assert fake.order == [site_id(request(lon=i)) for i in range(21)]
        failed = jobs.status(first['site_id'])
        assert failed['error']['code'] == 'computation_failed'
        assert 'private' not in failed['error']['message']
    finally:
        fake.release.set()
        jobs.close()


def test_rate_limit_injectable_clock(tmp_path):
    class Sphere:
        def tier(self, body): return 'sphere'
        def __call__(self, body, tier): return entry(body)
    now = [0.]
    jobs = Jobs(tmp_path, Sphere(), clock=lambda: now[0])
    for i in range(6):
        assert jobs.submit(request(lon=i), 'client')['status'] == 'ready'
    assert jobs.submit(request(lon=0), 'client')['status'] == 'ready'
    with pytest.raises(Rejected) as limited:
        jobs.submit(request(lon=6), 'client')
    assert limited.value.retry == 3600
    now[0] = 3600
    assert jobs.submit(request(lon=6), 'client')['status'] == 'ready'


@pytest.fixture
def synthetic(tmp_path):
    derived, prepared, cache = (tmp_path/n for n in ('derived', 'prepared', 'cache'))
    derived.mkdir(); prepared.mkdir()
    columns = {n: np.full(TIME_GRID_COUNT, v) for n, v in dict(subsolar_lat=0, subsolar_lon=90,
        subearth_lat=0, subearth_lon=0, earth_dist_km=380000, sun_dist_km=150000000).items()}
    write_system(derived/'system.bin', columns, TIME_GRID_COUNT)
    for name, pixel in [('LDEM_80S_80MPP_ADJ', 80), ('LDEM_60S_240MPP_ADJ', 240)]:
        np.save(prepared/(name+'.npy'), np.zeros((11,11), dtype='float32'))
        (prepared/(name+'.json')).write_text(json.dumps(dict(origin_x=-5.5*pixel, origin_y=303.2318+5.5*pixel, pixel_x=pixel, pixel_y=-pixel)))
    return derived, prepared, cache


def test_synthetic_full_http_path_and_restart(synthetic):
    derived, prepared, cache = synthetic
    computer = Computer(derived, prepared, cache)
    jobs = Jobs(cache, computer)
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache, jobs=jobs)) as client:
        submitted = client.post('/api/sites/custom', json=dict(lat_deg=-89.99, lon_deg=0, name='  pole  '))
        assert submitted.status_code == 200
        identity = submitted.json()['site_id']
        wait_state(jobs, identity, 'ready')
        state = client.get('/api/sites/custom/'+identity).json()
        assert state['site']['slope']['deg'] == 0
        assert state['site']['name'] == 'pole'
        assert isinstance(computer.store.core.data, np.memmap)
        for name in ('meta.json', 'series.bin', 'skyline.bin', 'terrain.bin'):
            url = '/api/custom/'+identity+'/'+name
            response = client.get(url)
            assert response.status_code == 200
            assert response.headers['cache-control'] == 'no-cache'
            assert client.get(url, headers={'If-None-Match': response.headers['etag']}).status_code == 304
        for name in ('.secret', '%2e%2e/manifest.json', 'site.json', 'closeup.bin'):
            assert client.get('/api/custom/'+identity+'/'+name).status_code == 404
    restarted = Jobs(cache, Computer(derived, prepared, cache))
    assert restarted.submit(request(-89.99, 0), 'new')['status'] == 'ready'
    assert restarted.starts == {}


def test_no_maps_sphere_and_validation(synthetic):
    derived, _, cache = synthetic
    missing = cache/'missing'
    with TestClient(create_app(derived=derived, prepared=missing, cache=cache)) as client:
        polar = client.post('/api/sites/custom', json=dict(lat_deg=-89, lon_deg=0))
        assert polar.status_code == 503
        assert polar.json() == {'code': 'maps_missing', 'message': 'Custom sites need the terrain maps, which are not installed on this server.'}
        assert client.get('/api/health').json()['custom_sites'] == 'not_available'
        sphere = client.post('/api/sites/custom', json=dict(lat_deg=0, lon_deg=-360))
        assert sphere.json()['status'] == 'ready'
        assert client.get('/api/sites/custom/c_0.0000_0.0000').json()['site']['slope'] is None
        assert client.post('/api/sites/custom', json=dict(lat_deg=99, lon_deg=0)).status_code == 422


def test_real_catalog_byte_identity(tmp_path):
    from truesouth import paths
    prepared = paths.prepared_dir()
    if not all((prepared/n).is_file() for n in ('LDEM_80S_80MPP_ADJ.npy', 'LDEM_60S_240MPP_ADJ.npy')):
        pytest.skip('Real prepared polar maps absent; set TRUESOUTH_DATA_ROOT to run byte-identity check.')
    derived = paths.derived_dir()
    catalog = next(s for s in json.loads((derived/'sites.json').read_text()) if s['id']=='connecting_ridge')
    body = request(catalog['lat_deg'], catalog['lon_deg'])
    jobs = Jobs(tmp_path, Computer(derived, prepared, tmp_path))
    started = perf_counter()
    try:
        identity = jobs.submit(body, 'real')['site_id']
        wait_state(jobs, identity, 'ready')
        for name in ('series.bin', 'skyline.bin', 'terrain.bin'):
            assert (tmp_path/identity/name).read_bytes() == (derived/'sites/connecting_ridge'/name).read_bytes(), name
        custom_meta = json.loads((tmp_path/identity/'meta.json').read_text())
        catalog_meta = json.loads((derived/'sites/connecting_ridge/meta.json').read_text())
        custom_meta['site_id'] = catalog_meta['site_id']
        assert custom_meta == catalog_meta
        print(f'Connecting Ridge byte-identical series, skyline, terrain; meta differs only site_id; {perf_counter()-started:.3f} seconds')
    finally:
        jobs.close()

def test_http_rate_limit_retry_after(synthetic):
    derived, prepared, cache = synthetic
    class Sphere:
        def tier(self, body): return 'sphere'
        def __call__(self, body, tier): return entry(body)
    jobs = Jobs(cache, Sphere(), clock=lambda: 10.)
    with TestClient(create_app(derived=derived, prepared=prepared, cache=cache, jobs=jobs)) as client:
        for i in range(6):
            assert client.post('/api/sites/custom', json=dict(lat_deg=0, lon_deg=i)).status_code == 200
        response = client.post('/api/sites/custom', json=dict(lat_deg=0, lon_deg=6))
        assert response.status_code == 429
        assert response.headers['retry-after'] == '3600'
        assert response.json()['code'] == 'rate_limited'
        assert isinstance(response.json()['message'], str)


def test_wide_map_and_outside_coverage(synthetic):
    derived, prepared, cache = synthetic
    computer = Computer(derived, prepared, cache)
    from truesouth.frames import polar_stereo_forward
    x, y = polar_stereo_forward(-70, 0)
    sidecar = prepared/'LDEM_60S_240MPP_ADJ.json'
    metadata = json.loads(sidecar.read_text())
    metadata.update(origin_x=float(x-5.5*240), origin_y=float(y+5.5*240))
    sidecar.write_text(json.dumps(metadata))
    body = request(-70, 0)
    assert computer.tier(body) == 'wide240'
    store = computer.store
    site = computer(body, 'wide240')
    assert site.terrain_tier == 'wide240'
    assert site.slope.baseline_m == 480
    assert computer.tier(request(0, 0)) == 'sphere'
    assert computer.store is store


def test_restart_forgets_waiting_jobs(tmp_path):
    fake = Fake()
    jobs = Jobs(tmp_path, fake)
    try:
        jobs.submit(request(lon=1), 'one')
        assert fake.entered.wait(5)
        jobs.submit(request(lon=2), 'two')
        restarted = Jobs(tmp_path, fake)
        assert restarted.status(site_id(request(lon=2))) is None
        assert restarted.submit(request(lon=2), 'two')['status'] == 'queued'
    finally:
        fake.release.set()
        jobs.close()
        restarted.close()


def test_running_calculation_does_not_block_terrain_admission(synthetic):
    from threading import Thread
    derived, prepared, cache = synthetic
    computer = Computer(derived, prepared, cache)
    assert computer.tier(request(-89.99, 0)) == 'core80'
    finished = Event()
    result = []
    def lookup():
        result.append(computer.tier(request(-89.99, 0)))
        finished.set()
    with computer.lock:
        thread = Thread(target=lookup)
        thread.start()
        admitted = finished.wait(2)
    thread.join()
    assert admitted
    assert result == ['core80']


def test_status_queue_positions_advance(tmp_path):
    class Controlled(Fake):
        def __init__(self):
            self.entered = [Event() for _ in range(4)]
            self.release = [Event() for _ in range(4)]
        def __call__(self, body, tier):
            i = int(body.lon_deg)
            self.entered[i].set()
            assert self.release[i].wait(10)
            if i == 2:
                raise ValueError('failed')
            return entry(body)
    fake = Controlled()
    jobs = Jobs(tmp_path, fake)
    try:
        ids = [jobs.submit(request(lon=0), '0')['site_id']]
        assert fake.entered[0].wait(5)
        ids.extend(jobs.submit(request(lon=i), str(i))['site_id'] for i in range(1, 4))
        assert jobs.status(ids[0])['position_in_queue'] is None
        assert [jobs.status(i)['position_in_queue'] for i in ids[1:]] == [1, 2, 3]
        fake.release[0].set()
        assert fake.entered[1].wait(5)
        assert jobs.status(ids[0])['position_in_queue'] is None
        assert jobs.status(ids[1])['position_in_queue'] is None
        assert [jobs.status(i)['position_in_queue'] for i in ids[2:]] == [1, 2]
        fake.release[1].set()
        assert fake.entered[2].wait(5)
        fake.release[2].set()
        assert fake.entered[3].wait(5)
        assert jobs.status(ids[2])['status'] == 'failed'
        assert jobs.status(ids[2])['position_in_queue'] is None
        assert jobs.status('unknown') is None
    finally:
        for event in fake.release: event.set()
        jobs.close()
