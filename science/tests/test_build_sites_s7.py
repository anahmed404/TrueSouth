"""Pipeline integration against small prepared terrain and synthetic ephemeris."""

import json
import os
import shutil
from pathlib import Path

import numpy as np
import pytest

from truesouth import paths
from truesouth.cli import main
from truesouth.constants import TIME_GRID_COUNT
from truesouth.contracts import (Manifest, Sites, SiteMeta, Profiles, Features, ArtemisRegions)
from truesouth.derived_io import write_system, read_series, read_skyline, read_terrain
from truesouth.dem import DemStore
from truesouth.slope import polar_slope
from truesouth.frames import polar_stereo_forward

STAMP = '2026-11-13T00:00:00Z'


@pytest.fixture
def tree(tmp_path, monkeypatch):
    catalog = tmp_path / 'catalog'
    shutil.copytree(paths.catalog_dir(), catalog)
    output, prepared = tmp_path / 'derived', tmp_path / 'prepared'
    output.mkdir()
    prepared.mkdir()
    monkeypatch.setattr(paths, 'derived_dir', lambda: output)
    monkeypatch.setattr(paths, 'prepared_dir', lambda: prepared)
    monkeypatch.setattr(paths, 'catalog_dir', lambda: catalog)
    x, y = polar_stereo_forward(-89.4555, 222.6192)
    core = prepared / 'LDEM_80S_80MPP_ADJ.npy'
    np.save(core, np.full((11, 11), 1234., dtype=np.float32))
    core.with_suffix('.json').write_text(json.dumps(dict(
        origin_x=float(x-440), origin_y=float(y+440), pixel_x=80, pixel_y=-80)),
        encoding='utf-8')
    columns = {name: np.full(TIME_GRID_COUNT, value) for name, value in dict(
        subsolar_lat=0, subsolar_lon=90, subearth_lat=0, subearth_lon=0,
        earth_dist_km=380000, sun_dist_km=150000000).items()}
    write_system(output / 'system.bin', columns, TIME_GRID_COUNT)
    return output, prepared, catalog


def build(*sites, force=False):
    args = ['build-sites', '--only', *sites, '--generated-utc', STAMP]
    if force:
        args.append('--force')
    return main(args)


def snapshot(root):
    return {p.relative_to(root).as_posix(): p.read_bytes() for p in root.rglob('*') if p.is_file()}


def test_build_contracts_repeatability_and_second_site(tree, capsys):
    output, _, _ = tree
    build('connecting_ridge')
    manifest = Manifest.model_validate_json((output/'manifest.json').read_bytes())
    sites = Sites.model_validate_json((output/'sites.json').read_bytes()).root
    assert sites[0].elevation_m == pytest.approx(1234)
    assert sites[0].terrain_tier == 'core80'
    assert sites[0].slope.deg == 0 and sites[0].slope.baseline_m == 160
    assert not sites[0].has_closeup
    site_dir = output/'sites/connecting_ridge'
    meta = SiteMeta.model_validate_json((site_dir/'meta.json').read_bytes())
    assert meta.terrain.size == 257 and meta.terrain.window_km == 20 and meta.closeup is None
    assert read_terrain(site_dir/'terrain.bin', 257)['up_km'][128, 128] == 0
    assert len(read_series(site_dir/'series.bin', manifest.time_grid.count)['sun_el']) == TIME_GRID_COUNT
    assert read_skyline(site_dir/'skyline.bin', meta.skyline.bins)['el_deg'].shape == (1440,)
    for name, model in [('profiles', Profiles), ('features', Features), ('artemis_regions', ArtemisRegions)]:
        model.model_validate_json((output/f'{name}.json').read_bytes())
    first = snapshot(output)
    mtimes = {p: (output/p).stat().st_mtime_ns for p in first if p.startswith('sites/')}
    build('connecting_ridge')
    assert 'up to date' in capsys.readouterr().out
    assert snapshot(output) == first
    assert {p: (output/p).stat().st_mtime_ns for p in mtimes} == mtimes
    build('connecting_ridge', force=True)
    assert snapshot(output) == first
    build('apollo11')
    sites = Sites.model_validate_json((output/'sites.json').read_bytes()).root
    assert {s.id for s in sites} == {'connecting_ridge', 'apollo11'}
    sphere = next(s for s in sites if s.id == 'apollo11')
    assert sphere.terrain_tier == 'sphere' and sphere.elevation_m is None
    assert sphere.slope is None
    assert SiteMeta.model_validate_json((output/'sites/apollo11/meta.json').read_bytes()).terrain is None
    assert not (output/'sites/apollo11/terrain.bin').exists()
    arrays = read_skyline(output/'sites/apollo11/skyline.bin', 1440)
    np.testing.assert_allclose(arrays['el_deg'], -.086935, atol=.00001)
    assert np.isnan(arrays['dist_km']).all()
    assert (site_dir/'series.bin').read_bytes() == first['sites/connecting_ridge/series.bin']


def test_newer_terrain_rebuilds_site(tree):
    output, prepared, _ = tree
    build('connecting_ridge')
    site_file = output/'sites/connecting_ridge/meta.json'
    before = site_file.stat().st_mtime_ns
    core = prepared/'LDEM_80S_80MPP_ADJ.npy'
    # Change a genuine input, then put all outputs before its mtime.
    np.save(core, np.full((11, 11), 2345., dtype=np.float32))
    for file in (output/'sites/connecting_ridge').iterdir():
        os.utime(file, ns=(before-1_000_000, before-1_000_000))
    build('connecting_ridge')
    sites = Sites.model_validate_json((output/'sites.json').read_bytes()).root
    assert sites[0].elevation_m == pytest.approx(2345.)


def test_write_failure_keeps_previous_site(tree, monkeypatch):
    from truesouth.commands import build_sites
    output, _, _ = tree
    build('connecting_ridge')
    first = snapshot(output)
    def fail(*args, **kwargs):
        raise OSError('synthetic disk failure')
    monkeypatch.setattr(build_sites, 'write_series', fail)
    with pytest.raises(OSError, match='synthetic disk failure'):
        build('connecting_ridge', force=True)
    assert snapshot(output) == first


def test_unknown_site_is_rejected_before_writing(tree):
    output, _, _ = tree
    first = snapshot(output)
    with pytest.raises(ValueError, match='Unknown catalog site'):
        build('typo')
    assert snapshot(output) == first


def test_publication_failure_restores_old_site(tree, monkeypatch):
    output, _, _ = tree
    build('connecting_ridge')
    first = snapshot(output)
    rename = Path.rename
    target = output/'sites/connecting_ridge'
    def fail_publish(self, destination):
        if Path(destination) == target and self.name != '.connecting_ridge.previous':
            raise OSError('synthetic rename failure')
        return rename(self, destination)
    monkeypatch.setattr(Path, 'rename', fail_publish)
    with pytest.raises(OSError, match='synthetic rename failure'):
        build('connecting_ridge', force=True)
    assert snapshot(output) == first


def test_recovers_interrupted_publication(tree):
    output, _, _ = tree
    build('connecting_ridge')
    first = snapshot(output)
    target = output/'sites/connecting_ridge'
    target.rename(target.with_name('.connecting_ridge.previous'))
    build('connecting_ridge')
    assert snapshot(output) == first


def test_missing_polar_terrain_is_not_silently_sphere(tree):
    output, prepared, _ = tree
    (prepared/'LDEM_80S_80MPP_ADJ.npy').unlink()
    with pytest.raises(ValueError, match='prepared core80 terrain unavailable'):
        build('connecting_ridge')
    assert not (output/'sites/connecting_ridge').exists()


def test_tilted_plane_slope_matches_direct_calculation(tree):
    output, prepared, _ = tree
    core = prepared/'LDEM_80S_80MPP_ADJ.npy'
    rows, cols = np.indices((11, 11))
    np.save(core, (1234 + 8*cols - 4*rows).astype(np.float32))
    build('connecting_ridge')
    site = Sites.model_validate_json((output/'sites.json').read_bytes()).root[0]
    direct = polar_slope(DemStore(core, None).core, site.lat_deg, site.lon_deg)
    assert site.slope == direct
    assert site.slope.deg == pytest.approx(np.degrees(np.arctan(np.hypot(.1, .05))), abs=.001)
    assert site.slope.baseline_m == 160
    assert np.isnan(read_terrain(output/'sites/connecting_ridge/terrain.bin', 257)['up_km']).any()


def test_wide_and_sphere_coverage_gate(tree):
    output, prepared, catalog = tree
    entries = json.loads((catalog/'sites.json').read_text(encoding='utf-8'))
    for entry in entries:
        if entry['id'] == 'apollo11':
            entry.update(lat_deg=-59, lon_deg=45)
    (catalog/'sites.json').write_text(json.dumps(entries), encoding='utf-8')
    x, y = polar_stereo_forward(-69.3741, 32.32)
    wide = prepared/'LDEM_60S_240MPP_ADJ.npy'
    np.save(wide, np.full((11, 11), 4321., dtype=np.float32))
    wide.with_suffix('.json').write_text(json.dumps(dict(origin_x=float(x-1320), origin_y=float(y+1320), pixel_x=240, pixel_y=-240)), encoding='utf-8')
    build('chandrayaan3', 'apollo11')
    sites = {s.id: s for s in Sites.model_validate_json((output/'sites.json').read_bytes()).root}
    assert sites['chandrayaan3'].slope.baseline_m == 480
    assert SiteMeta.model_validate_json((output/'sites/chandrayaan3/meta.json').read_bytes()).terrain.size == 257
    assert (output/'sites/chandrayaan3/terrain.bin').exists()
    assert sites['apollo11'].slope is None
    assert not (output/'sites/apollo11/terrain.bin').exists()
    x, y = polar_stereo_forward(-59, 45)
    wide.with_suffix('.json').write_text(json.dumps(dict(origin_x=float(x-1320), origin_y=float(y+1320), pixel_x=240, pixel_y=-240)), encoding='utf-8')
    assert DemStore(None, wide).tiers(-59, 45).item() == 'wide240'
    build('apollo11', force=True)
    assert Sites.model_validate_json((output/'sites.json').read_bytes()).root[0].slope is None
    assert SiteMeta.model_validate_json((output/'sites/apollo11/meta.json').read_bytes()).terrain is None
    assert not (output/'sites/apollo11/terrain.bin').exists()


def test_missing_ground_rejected(tree):
    output, prepared, _ = tree
    np.save(prepared/'LDEM_80S_80MPP_ADJ.npy', np.full((11, 11), np.nan, dtype=np.float32))
    with pytest.raises(ValueError, match='site ground height is missing'):
        build('connecting_ridge')
    assert not (output/'sites/connecting_ridge').exists()


@pytest.mark.parametrize('name', ['slope.py', 'terrain_mesh.py'])
def test_newer_science_source_rebuilds(tree, tmp_path, monkeypatch, capsys, name):
    from truesouth.commands import build_sites
    output, _, _ = tree
    package = tmp_path/'package'
    (package/'commands').mkdir(parents=True)
    fake_command = package/'commands/build_sites.py'
    fake_command.touch()
    source = package/name
    source.touch()
    monkeypatch.setattr(build_sites, '__file__', str(fake_command))
    build('connecting_ridge')
    build('connecting_ridge')
    assert 'up to date' in capsys.readouterr().out
    site_file = output/'sites/connecting_ridge/meta.json'
    newer = site_file.stat().st_mtime_ns + 1_000_000_000
    os.utime(source, ns=(newer, newer))
    build('connecting_ridge')
    assert 'connecting_ridge: built in' in capsys.readouterr().out
