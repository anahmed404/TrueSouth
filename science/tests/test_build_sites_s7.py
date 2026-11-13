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
from truesouth.derived_io import write_system, read_series, read_skyline
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
    assert sites[0].slope is None and not sites[0].has_closeup
    site_dir = output/'sites/connecting_ridge'
    meta = SiteMeta.model_validate_json((site_dir/'meta.json').read_bytes())
    assert meta.terrain is None and meta.closeup is None
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
