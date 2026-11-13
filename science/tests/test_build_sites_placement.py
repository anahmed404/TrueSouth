"""build-sites writes the nearby range and the best-lit variant (decision 0012)."""

import json
import os
from pathlib import Path

import numpy as np
import pytest

from truesouth import paths
from truesouth.cli import main
from truesouth.contracts import Sites
from truesouth.dem import DemStore
from truesouth.frames import polar_stereo_forward
from truesouth.placement import PLACEMENT_SOURCE_URL, candidate_points
from truesouth.commands import build_sites

STAMP = '2026-11-13T00:00:00Z'


@pytest.fixture
def tree(tmp_path, monkeypatch):
    catalog = tmp_path / 'catalog'
    # The shared catalog is copied by the S7 fixture's layout: same files, private cache.
    from shutil import copytree
    copytree(paths.catalog_dir(), catalog)
    output, prepared, cache = tmp_path / 'derived', tmp_path / 'prepared', tmp_path / 'cache'
    output.mkdir()
    prepared.mkdir()
    monkeypatch.setattr(paths, 'derived_dir', lambda: output)
    monkeypatch.setattr(paths, 'prepared_dir', lambda: prepared)
    monkeypatch.setattr(paths, 'catalog_dir', lambda: catalog)
    monkeypatch.setattr(paths, 'cache_dir', lambda: cache)
    x, y = polar_stereo_forward(-89.4555, 222.6192)
    core = prepared / 'LDEM_80S_80MPP_ADJ.npy'
    np.save(core, np.full((11, 11), 1234., dtype=np.float32))
    core.with_suffix('.json').write_text(json.dumps(dict(
        origin_x=float(x - 440), origin_y=float(y + 440), pixel_x=80, pixel_y=-80)), encoding='utf-8')
    from truesouth.constants import TIME_GRID_COUNT
    from truesouth.derived_io import write_system
    columns = {name: np.full(TIME_GRID_COUNT, value) for name, value in dict(
        subsolar_lat=0, subsolar_lon=90, subearth_lat=0, subearth_lon=0,
        earth_dist_km=380000, sun_dist_km=150000000).items()}
    write_system(output / 'system.bin', columns, TIME_GRID_COUNT)
    return output, prepared, catalog, cache


def build(*sites, force=False):
    args = ['build-sites', '--generated-utc', STAMP]
    if sites:
        args[1:1] = ['--only', *sites]
    if force:
        args.append('--force')
    return main(args)


def edit(catalog, site_id, **changes):
    entries = json.loads((catalog / 'sites.json').read_text(encoding='utf-8'))
    for entry in entries:
        if entry['id'] == site_id:
            entry.update(changes)
    (catalog / 'sites.json').write_text(json.dumps(entries), encoding='utf-8')


def records(output):
    return {site.id: site for site in Sites.model_validate_json((output / 'sites.json').read_bytes()).root}


def snapshot(root):
    return {path.relative_to(root).as_posix(): path.read_bytes() for path in root.rglob('*') if path.is_file()}


def count_skylines(monkeypatch):
    calls = []
    real = build_sites.compute_skyline

    def wrapped(store, lat, lon, *args, **kwargs):
        calls.append((float(lat), float(lon)))
        return real(store, lat, lon, *args, **kwargs)

    monkeypatch.setattr(build_sites, 'compute_skyline', wrapped)
    return calls


def candidate_count(prepared):
    store = DemStore(prepared / 'LDEM_80S_80MPP_ADJ.npy', None)
    from truesouth import catalog
    site = next(item for item in catalog.load_sites() if item.id == 'connecting_ridge')
    return len(candidate_points(store.core, site.lat_deg, site.lon_deg)), store


def test_variant_reuses_the_winning_series_and_leaves_the_listed_point(tree):
    output, prepared, catalog, _ = tree
    edit(catalog, 'connecting_ridge', group='polar_lander')
    build('connecting_ridge')
    listed = (output / 'sites/connecting_ridge/series.bin').read_bytes()
    plain = records(output)['connecting_ridge']
    assert plain.nearby_sun is None and plain.variant_of is None and plain.offset_m is None
    assert not (output / 'sites/connecting_ridge_best_lit').exists()
    edit(catalog, 'connecting_ridge', group='sunlit_peak')
    build('connecting_ridge', force=True)
    assert (output / 'sites/connecting_ridge/series.bin').read_bytes() == listed
    sites = records(output)
    parent, variant = sites['connecting_ridge'], sites['connecting_ridge_best_lit']
    assert parent.variant_of is None and parent.offset_m is None
    assert parent.nearby_sun == variant.nearby_sun
    assert parent.nearby_sun.radius_m == 160
    assert parent.nearby_sun.points >= 12
    assert parent.nearby_sun.min <= parent.nearby_sun.max
    assert variant.variant_of == 'connecting_ridge'
    assert variant.group == 'sunlit_peak'
    assert 'TrueSouth' in variant.description and 'upper reading' in variant.description
    assert variant.source_url == PLACEMENT_SOURCE_URL
    assert variant.outcome is None
    points = candidate_points(DemStore(prepared / 'LDEM_80S_80MPP_ADJ.npy').core,
                              parent.lat_deg, parent.lon_deg)
    match = min(points, key=lambda point: abs(point.lat_deg - variant.lat_deg) + abs(point.lon_deg - variant.lon_deg))
    assert variant.lat_deg == pytest.approx(match.lat_deg, abs=1e-9)
    assert variant.lon_deg == pytest.approx(match.lon_deg, abs=1e-9)
    assert variant.offset_m == pytest.approx(match.offset_m, abs=1e-6)
    entries = json.loads((catalog / 'sites.json').read_text(encoding='utf-8'))
    entries.append(dict(id='plain_point', name='Plain point', group='polar_lander',
                        lat_deg=variant.lat_deg, lon_deg=variant.lon_deg,
                        description='Ordinary site at the variant coordinates.',
                        source_url='https://example.com/plain', outcome=None))
    (catalog / 'sites.json').write_text(json.dumps(entries), encoding='utf-8')
    build('plain_point')
    for name in ('series.bin', 'skyline.bin'):
        assert (output / 'sites/connecting_ridge_best_lit' / name).read_bytes() == (
            output / 'sites/plain_point' / name).read_bytes()


def test_winning_candidate_is_not_recomputed(tree, monkeypatch):
    output, prepared, _, _ = tree
    calls = count_skylines(monkeypatch)
    count, _ = candidate_count(prepared)
    build('connecting_ridge')
    variant = records(output)['connecting_ridge_best_lit']
    winner = [call for call in calls if abs(call[0] - variant.lat_deg) < 1e-9 and abs(call[1] - variant.lon_deg) < 1e-9]
    assert len(calls) == count + 1
    assert len(winner) == 1


def test_cache_hits_corruption_and_input_changes(tree, monkeypatch):
    output, prepared, _, cache = tree
    calls = count_skylines(monkeypatch)
    count, _ = candidate_count(prepared)
    build('connecting_ridge')
    first = snapshot(output)
    assert len(calls) == count + 1
    assert cache.is_dir() and any(cache.rglob('*.npz'))
    assert not any(output.rglob('*.npz'))
    calls.clear()
    build('connecting_ridge')
    assert calls == []
    assert snapshot(output) == first
    calls.clear()
    build('connecting_ridge', force=True)
    assert len(calls) == 1
    assert snapshot(output) == first
    note = cache / 'note.txt'
    note.write_text('leave me', encoding='utf-8')
    cached = sorted(cache.rglob('*.npz'))
    untouched = {path: path.read_bytes() for path in cached[1:]}
    cached[0].write_bytes(b'not a numpy archive')
    calls.clear()
    build('connecting_ridge', force=True)
    assert len(calls) == 2
    assert snapshot(output) == first
    assert all(path.read_bytes() == untouched[path] for path in untouched)
    assert note.read_text(encoding='utf-8') == 'leave me'
    # The content hash includes placement_cache.py. A clock change is not a
    # content change, so the candidate key stays and only the parent skyline
    # is rebuilt because the site looks stale.
    from truesouth import placement_cache, skyline
    extra = Path(placement_cache.__file__)
    extra_mtime = extra.stat().st_mtime_ns
    try:
        os.utime(extra, ns=(extra_mtime + 10**15, extra_mtime + 10**15))
        calls.clear()
        build('connecting_ridge')
        assert len(calls) == 1
        assert snapshot(output) == first
    finally:
        os.utime(extra, ns=(extra_mtime, extra_mtime))
    before = {path: path.read_bytes() for path in cache.rglob('*.npz')}
    system = output / 'system.bin'
    values = np.fromfile(system, dtype='<f4')
    values[0] = values[0] + 1
    values.tofile(system)
    calls.clear()
    build('connecting_ridge', force=True)
    assert len(calls) == count + 1
    assert note.read_text(encoding='utf-8') == 'leave me'
    assert {path: path.read_bytes() for path in before} == before
    skyline_path = Path(skyline.__file__)
    original = skyline_path.read_bytes()
    try:
        skyline_path.write_bytes(original + b'\n# cache bust\n')
        calls.clear()
        build('connecting_ridge', force=True)
        assert len(calls) == count + 1
    finally:
        skyline_path.write_bytes(original)


def test_cache_directory_is_outside_committed_derived(monkeypatch):
    monkeypatch.delenv('TRUESOUTH_DATA_ROOT', raising=False)
    root = paths.repo_root()
    assert paths.cache_dir() == root / 'data' / 'cache'
    assert paths.derived_dir() == root / 'data' / 'derived'
    assert 'data/cache/' in (root / '.gitignore').read_text(encoding='utf-8')


def test_other_groups_and_tiers_get_null_fields(tree):
    output, prepared, catalog, _ = tree
    edit(catalog, 'connecting_ridge', group='artemis')
    build('connecting_ridge')
    site = records(output)['connecting_ridge']
    assert site.nearby_sun is None and site.variant_of is None and site.offset_m is None
    assert not (output / 'sites/connecting_ridge_best_lit').exists()
    edit(catalog, 'connecting_ridge', group='sunlit_peak', lat_deg=-69.3741, lon_deg=32.32)
    x, y = polar_stereo_forward(-69.3741, 32.32)
    wide = prepared / 'LDEM_60S_240MPP_ADJ.npy'
    np.save(wide, np.full((11, 11), 4321., dtype=np.float32))
    wide.with_suffix('.json').write_text(json.dumps(dict(
        origin_x=float(x - 1320), origin_y=float(y + 1320), pixel_x=240, pixel_y=-240)), encoding='utf-8')
    build('connecting_ridge', force=True)
    site = records(output)['connecting_ridge']
    assert site.terrain_tier == 'wide240'
    assert site.nearby_sun is None and site.variant_of is None and site.offset_m is None
    assert not (output / 'sites/connecting_ridge_best_lit').exists()


def test_only_force_skip_interruption_and_removal(tree, capsys):
    output, _, catalog, _ = tree
    build('connecting_ridge_best_lit')
    assert (output / 'sites/connecting_ridge').is_dir()
    assert (output / 'sites/connecting_ridge_best_lit').is_dir()
    first = snapshot(output)
    mtimes = {path: (output / path).stat().st_mtime_ns for path in first if path.startswith('sites/')}
    build('connecting_ridge')
    assert 'up to date' in capsys.readouterr().out
    assert snapshot(output) == first
    assert {path: (output / path).stat().st_mtime_ns for path in mtimes} == mtimes
    build('connecting_ridge', force=True)
    assert snapshot(output) == first
    target = output / 'sites/connecting_ridge_best_lit'
    target.rename(target.with_name('.connecting_ridge_best_lit.previous'))
    build('connecting_ridge')
    assert snapshot(output) == first
    before = snapshot(output)
    with pytest.raises(ValueError, match='apollo11 is not one'):
        build('apollo11_best_lit')
    assert snapshot(output) == before
    with pytest.raises(ValueError, match='Unknown catalog site'):
        build('typo_best_lit')
    assert snapshot(output) == before
    build('apollo11')
    apollo = records(output)['apollo11']
    assert apollo.nearby_sun is None and apollo.variant_of is None and apollo.offset_m is None
    assert not (output / 'sites/apollo11_best_lit').exists()
    edit(catalog, 'connecting_ridge', group='artemis')
    build('connecting_ridge')
    assert not (output / 'sites/connecting_ridge_best_lit').exists()
    parent = records(output)['connecting_ridge']
    assert parent.group == 'artemis'
    assert parent.nearby_sun is None and parent.variant_of is None and parent.offset_m is None
    assert 'connecting_ridge_best_lit' not in records(output)
    # The parent left the catalog entirely. A full run drops the stale variant.
    edit(catalog, 'connecting_ridge', group='sunlit_peak')
    build('connecting_ridge', force=True)
    assert (output / 'sites/connecting_ridge_best_lit').is_dir()
    entries = json.loads((catalog / 'sites.json').read_text(encoding='utf-8'))
    (catalog / 'sites.json').write_text(
        json.dumps([entry for entry in entries if entry['id'] == 'apollo11']), encoding='utf-8')
    listed = (output / 'sites/connecting_ridge/series.bin').read_bytes()
    main(['build-sites', '--generated-utc', STAMP])
    assert (output / 'sites/connecting_ridge/series.bin').read_bytes() == listed
    assert not (output / 'sites/connecting_ridge_best_lit').exists()
    assert 'connecting_ridge_best_lit' not in records(output)


def test_a_byte_outside_the_old_three_modules_changes_the_key(tmp_path):
    """A key of only skyline, series and placement would ignore this edit."""
    from truesouth.placement_cache import fingerprint, input_files, package_sources
    package = tmp_path / 'pkg'
    package.mkdir()
    for name in ('skyline.py', 'series.py', 'placement.py', 'constants.py'):
        (package / name).write_text('value = 1\n', encoding='utf-8')
    prepared = tmp_path / 'prepared'
    prepared.mkdir()
    array = prepared / 'LDEM_80S_80MPP_ADJ.npy'
    np.save(array, np.zeros((2, 2), dtype=np.float32))
    array.with_suffix('.json').write_text('{}', encoding='utf-8')
    system = tmp_path / 'system.bin'
    system.write_bytes(b'ephemeris')
    sources = package_sources(package)
    first = fingerprint(input_files(prepared, system, sources))
    narrow = fingerprint([(path.name, path) for path in sources if path.name != 'constants.py'])
    (package / 'constants.py').write_text('value = 2\n', encoding='utf-8')
    second = fingerprint(input_files(prepared, system, package_sources(package)))
    narrow_after = fingerprint([(path.name, path) for path in sources if path.name != 'constants.py'])
    assert first != second
    assert narrow == narrow_after


def test_old_key_is_unread_and_a_truncated_entry_is_replaced(tree, monkeypatch):
    from truesouth import placement_cache
    output, prepared, _, cache = tree
    extra = cache.parent / 'outside.py'
    extra.write_bytes(b'value = 1\n')
    real = placement_cache.package_sources

    def sources(root=None):
        found = real(root)
        return [*found, extra] if root is None else found

    monkeypatch.setattr(placement_cache, 'package_sources', sources)
    calls = count_skylines(monkeypatch)
    count, _ = candidate_count(prepared)
    build('connecting_ridge')
    assert len(calls) == count + 1
    old_folder = next((cache / 'placement').iterdir())
    old_bytes = {path.name: path.read_bytes() for path in old_folder.glob('*.npz')}
    assert old_bytes
    extra.write_bytes(b'value = 2\n')
    calls.clear()
    build('connecting_ridge', force=True)
    assert len(calls) == count + 1
    assert {path.name: path.read_bytes() for path in old_folder.glob('*.npz')} == old_bytes
    current = next(path for path in (cache / 'placement').iterdir() if path != old_folder)
    stored = sorted(current.glob('*.npz'))
    target, others = stored[0], stored[1:]
    untouched = {path: path.read_bytes() for path in others}
    original = target.read_bytes()
    target.write_bytes(original[:32])
    calls.clear()
    build('connecting_ridge', force=True)
    assert len(calls) == 2
    replaced = target.read_bytes()
    assert replaced != original[:32] and len(replaced) > len(original[:32])
    with np.load(target, allow_pickle=False) as data:
        assert int(data['format']) == placement_cache.FORMAT
        assert 'checksum' in data.files
    assert all(path.read_bytes() == untouched[path] for path in others)
    assert (output / 'sites/connecting_ridge_best_lit').is_dir()
