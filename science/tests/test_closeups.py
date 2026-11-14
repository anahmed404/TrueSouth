"""Close-up ingestion: real GeoTIFF geometry, synthetic heights, no network."""
import json
from pathlib import Path

import httpx
import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from truesouth.closeups import (RangeFile, crop_map, inspect_map, window_covered,
                               fetch_closeups, limits, projection_matches, agreement)
from truesouth.commands.fetch_raw import Download
from truesouth.dem import EXPECTED_CRS, PreparedMap
from truesouth.frames import polar_stereo_forward, polar_stereo_inverse
from truesouth.terrain_mesh import closeup_mesh


@pytest.fixture
def raster(tmp_path):
    x, y = polar_stereo_forward(-88, 35)
    transform = from_origin(float(x)-2502.5, float(y)+2502.5, 5, 5)
    rows, cols = np.indices((1001, 1001))
    values = (100 + (cols-500)*.5 - (rows-500)*.25).astype('float32')
    # A bump off both axes catches transposition and mirroring.
    values[460, 530] += 25
    values[100, 100] = -9999
    values[101, 100] = np.nan
    path = tmp_path/'plane.tif'
    with rasterio.open(path, 'w', driver='GTiff', width=1001, height=1001,
                       count=1, dtype='float32', crs=EXPECTED_CRS,
                       transform=transform, nodata=-9999, tiled=True) as dst:
        dst.write(values, 1)
    return path


def test_pixel_registration_plane_bump_and_nodata(raster, tmp_path):
    with rasterio.open(raster) as src:
        info = inspect_map(src)
        crop_map(src, tmp_path/'crop.npy', (-88, 35), source=info)
        x, y = src.xy(460, 530)
        lat, lon = polar_stereo_inverse(x, y)
        terrain = PreparedMap(tmp_path/'crop.npy')
        assert terrain.sample(lat, lon) == pytest.approx(150, abs=1e-5)
        row, col = terrain.coordinates(lat, lon)
        assert abs(row-round(float(row))) < 1e-6
        assert abs(col-round(float(col))) < 1e-6
        assert terrain.sample(-88, 35) == pytest.approx(100, abs=1e-5)
        # Interpolation of a known plane at fractional pixels.
        lat, lon = polar_stereo_inverse(x+1.25, y+101.25)
        assert terrain.sample(lat, lon) == pytest.approx(130.1875, abs=2e-5)
        crop_map(src, tmp_path/'all.npy', (-88, 35), source=info, width_m=5000)
    whole = PreparedMap(tmp_path/'all.npy')
    with rasterio.open(raster) as src:
        for r in (100, 101):
            assert np.isnan(whole.sample(*polar_stereo_inverse(*src.xy(r, 100))))


def test_mesh_bilinear_plane_and_whole_window_coverage(raster, tmp_path):
    with rasterio.open(raster) as src:
        crop_map(src, tmp_path/'crop.npy', (-88, 35), source=inspect_map(src))
    terrain = PreparedMap(tmp_path/'crop.npy')
    assert window_covered(terrain, -88, 35)
    mesh = closeup_mesh(terrain, -88, 35)
    assert mesh.size == 257 and mesh.window_km == 2
    np.testing.assert_allclose(mesh.height_m, terrain.sample(mesh.lat_deg, mesh.lon_deg))
    x, y = polar_stereo_forward(mesh.lat_deg, mesh.lon_deg)
    sx, sy = polar_stereo_forward(-88, 35)
    expected = 100+(x-sx)*.1+(y-sy)*.05
    away_from_bump = np.hypot(x-(sx+150), y-(sy+200)) > 10
    np.testing.assert_allclose(mesh.height_m[away_from_bump], expected[away_from_bump], atol=3e-5)
    assert (mesh.east_km[128, 129]-mesh.east_km[128, 128])*1000 == pytest.approx(7.8125*(1+100/1737400), abs=.001)
    # A hole between mesh vertices still rejects the window.
    data = np.load(terrain.path).copy()
    data[data.shape[0]//2+1, data.shape[1]//2+1] = np.nan
    assert not window_covered(terrain, -88.1, 35)
    path = terrain.path
    del terrain
    np.save(path, data)
    assert not window_covered(PreparedMap(path), -88, 35)


def fake_client(files, *, ranges=True):
    requests = []
    def handler(request):
        requests.append((request.method, str(request.url), request.headers.get('range')))
        data = files[str(request.url)]
        if request.method == 'HEAD':
            return httpx.Response(200, headers={'content-length':str(len(data))})
        if ranges and 'range' in request.headers:
            a, b = map(int, request.headers['range'][6:].split('-'))
            return httpx.Response(206, content=data[a:b+1],
                                  headers={'content-range':f'bytes {a}-{min(b,len(data)-1)}/{len(data)}'})
        return httpx.Response(200, content=data)
    return httpx.Client(transport=httpx.MockTransport(handler)), requests


def test_range_reader_bounds_cache_and_refusal():
    client, requests = fake_client({'https://test/map': bytes(range(256))*1000})
    with client, RangeFile(client, 'https://test/map', 256000) as file:
        assert file.read(10) == bytes(range(10))
        file.seek(5)
        assert file.read(2) == b'\x05\x06'
        assert len(requests) == 1
        file.seek(-3, 2)
        assert file.read(50) == b'\xfd\xfe\xff'
    client, _ = fake_client({'https://test/map': b'abc'}, ranges=False)
    with client, RangeFile(client, 'https://test/map', 3) as file:
        with pytest.raises(RuntimeError, match='range'):
            file.read(1)


def test_size_limits_before_get():
    limits([150_000_000]*8)
    with pytest.raises(RuntimeError, match='150 MB'):
        limits([150_000_001])
    with pytest.raises(RuntimeError, match='1.2 GB'):
        limits([150_000_000]*9)


def test_projection_semantics_and_pixel_is_point(raster, tmp_path):
    legacy = '+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R=1737400 +units=m'
    assert projection_matches(legacy)
    assert not projection_matches(legacy.replace('1737400', '1738000'))
    assert not projection_matches(legacy.replace('lon_0=0', 'lon_0=20'))
    assert not projection_matches(legacy.replace('lat_ts=-90', 'lat_ts=-71'))
    with rasterio.open(raster, 'r+') as dst:
        dst.update_tags(AREA_OR_POINT='Point')
    with rasterio.open(raster) as src:
        assert src.tags()['AREA_OR_POINT'] == 'Point'
        crop_map(src, tmp_path/'point.npy', (-88, 35), source=inspect_map(src))
    assert PreparedMap(tmp_path/'point.npy').sample(-88, 35) == pytest.approx(100, abs=1e-5)


def test_cross_correlation_recovers_known_shift(tmp_path):
    sx, sy = map(float, polar_stereo_forward(-88, 35))
    rows, cols = np.indices((800, 800))
    x, y = (cols-399.5)*5, (399.5-rows)*5
    heights = (100+80*np.exp(-((x-170)**2+(y-230)**2)/200000)
               +40*np.exp(-((x+430)**2+(y+120)**2)/60000)
               -60*np.exp(-((x-300)**2+(y+510)**2)/100000)).astype('float32')
    fine_path = tmp_path/'fine.npy'
    np.save(fine_path, heights)
    meta = dict(origin_x=sx-2000, origin_y=sy+2000, pixel_x=5, pixel_y=-5)
    fine_path.with_suffix('.json').write_text(json.dumps(meta))
    core_path = tmp_path/'core.npy'
    # Average exact 16 × 16 blocks, with the known 40 m X displacement.
    coarse = heights[:, 8:792].reshape(50, 16, 49, 16).mean(axis=(1, 3))
    np.save(core_path, coarse)
    core_path.with_suffix('.json').write_text(json.dumps({**meta, 'pixel_x':80, 'pixel_y':-80}))
    fine, core = PreparedMap(fine_path), PreparedMap(core_path)
    measured = agreement(fine, core, -88, 35, float(core.sample(-88, 35)))
    assert measured['offset_x_m'] == 40
    assert measured['offset_y_m'] == 0
    assert measured['correlation'] > .99999
    assert measured['zero_correlation'] < measured['correlation']


@pytest.mark.parametrize('ranges', [True, False])
def test_fetch_crop_idempotent_and_full_download_deleted(raster, tmp_path, ranges):
    from types import SimpleNamespace
    url = 'https://test/one.tif'
    client, requests = fake_client({url: raster.read_bytes()}, ranges=ranges)
    sites = [SimpleNamespace(id='point', lat_deg=-88, lon_deg=35)]
    raw, prepared = tmp_path/'raw', tmp_path/'prepared'
    with client:
        fetch_closeups(client, [Download('closeup', url, 'one.tif')], sites, raw, prepared)
        first = {p.name:p.read_bytes() for p in prepared.iterdir() if p.is_file()}
        count = len(requests)
        fetch_closeups(client, [Download('closeup', url, 'one.tif')], sites, raw, prepared)
        assert len(requests) == count + 1  # HEAD revalidates the source.
    assert not list(raw.glob('*'))
    assert {p.name:p.read_bytes() for p in prepared.iterdir() if p.is_file()} == first
    assert window_covered(PreparedMap(prepared/'point.npy'), -88, 35)
