"""Offline raster selection and the validate CLI on a small synthetic derived tree."""

from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
import rasterio
from rasterio.transform import from_origin

from truesouth import paths
from truesouth.cli import main
from truesouth.contracts import Manifest, SiteMeta, Sites, Validation, SeriesLayout
from truesouth.dem import EXPECTED_CRS, DemStore
from truesouth.derived_io import write_series, write_system
from truesouth.frames import polar_stereo_forward, polar_stereo_inverse
from truesouth.validation import geometry_gates, prepared_geometry, compare_convergence
from truesouth.commands.validate import (visibility_reference, slope_reference, direction_evidence, parser_gate,
                                        reference_pixel, visibility_skip_reason, directions_gate)


def raster(path, centre, pixel, raw=12500, *, scale=.00004, offset=0, crs=EXPECTED_CRS, unit=None):
    x, y = polar_stereo_forward(*centre)
    with rasterio.open(path, 'w', driver='GTiff', width=3, height=3, count=1,
                       dtype='int16', crs=crs,
                       transform=from_origin(x-1.5*pixel, y+1.5*pixel, pixel, pixel), nodata=-32768) as ds:
        ds.write(np.full((3, 3), raw, dtype='int16'), 1)
        ds.scales = (scale,)
        ds.offsets = (offset,)
        if unit:
            ds.set_band_unit(1, unit)


def test_reference_uses_file_scale_offset_and_prefers_60m(tmp_path):
    raster(tmp_path/'AVGVISIB_85S_060M_201608.TIF', (-89, 0), 60, raw=10000, offset=.1)
    raster(tmp_path/'AVGVISIB_75S_120M_201608.TIF', (-89, 0), 120, raw=20000)
    ref = visibility_reference(tmp_path, 'sun', -89, 0)
    assert ref.value == pytest.approx(.5)
    assert '060M' in ref.detail and 'scale=4e-05' in ref.detail


@pytest.mark.parametrize('reason', ['outside', 'nodata'])
def test_reference_falls_back_to_120m_where_60m_has_no_data(tmp_path, reason):
    centre = (-89, 0)
    x, y = polar_stereo_forward(*centre)
    other = tuple(float(v) for v in polar_stereo_inverse(x+1000, y))
    raster(tmp_path/'AVGVISIB_85S_060M_201608_EARTH.TIF', other if reason == 'outside' else centre,
           60, raw=10000 if reason == 'outside' else -32768)
    raster(tmp_path/'AVGVISIB_75S_120M_201608_EARTH.TIF', centre, 120, raw=15000)
    ref = visibility_reference(tmp_path, 'earth', *centre)
    assert ref.value == pytest.approx(.6)
    assert '120M' in ref.detail


def test_missing_and_nodata_reference_is_not_a_zero_measurement(tmp_path):
    assert visibility_reference(tmp_path, 'sun', -89, 0) is None
    raster(tmp_path/'AVGVISIB_85S_060M_201608.TIF', (-89, 0), 60, raw=-32768)
    assert visibility_reference(tmp_path, 'sun', -89, 0) is None
    (tmp_path/'LDSM_80S_80MPP_ADJ.TIF.part').write_bytes(b'partial')
    assert slope_reference(tmp_path, -89, 0) is None


def test_r3_reads_scaled_degrees_and_reports_unknown_baseline(tmp_path):
    raster(tmp_path/'LDSM_80S_80MPP_ADJ.TIF', (-89, 0), 80,
           raw=1200, scale=.01, offset=1, unit='degree')
    ref = slope_reference(tmp_path, -89, 0)
    assert ref.value == 13
    assert 'baseline' in ref.detail and 'not recorded' in ref.detail


def test_reference_pixel_reads_the_pixel_that_contains_the_point(tmp_path):
    """Every pixel is unique, the grid is not square, and a flip or a shift would miss."""
    pixel = 80.
    height, width = 4, 7
    values = np.arange(1, height*width+1, dtype=np.int16).reshape(height, width)
    assert height != width
    assert not np.array_equal(values, values[::-1])
    assert not np.array_equal(values, values[:, ::-1])
    assert len(set(values.ravel().tolist())) == values.size
    x0, y0 = polar_stereo_forward(-89., 12.)
    west, north = x0-width*pixel/2, y0+height*pixel/2
    path = tmp_path/'patch.tif'
    with rasterio.open(path, 'w', driver='GTiff', width=width, height=height, count=1, dtype='int16',
                       crs=EXPECTED_CRS, transform=from_origin(west, north, pixel, pixel), nodata=-32768) as ds:
        ds.write(values, 1)
        ds.scales = (4e-05,)
        ds.offsets = (0,)

    def read(x, y):
        lat, lon = polar_stereo_inverse(x, y)
        return reference_pixel(path, float(lat), float(lon), pixel)

    def centre(row, col):
        return west+(col+.5)*pixel, north-(row+.5)*pixel

    # One point in each quadrant of the raster. Corners would hide a one-pixel shift.
    for row, col in ((0, 1), (0, 5), (3, 1), (3, 5)):
        got = read(*centre(row, col)).value
        expected = float(values[row, col])*4e-05
        assert got == pytest.approx(expected)
        assert abs(got-float(values[height-1-row, col])*4e-05) > 1e-8
        assert abs(got-float(values[row, width-1-col])*4e-05) > 1e-8

    row, col = 1, 2
    x, y = centre(row, col)
    expected = float(values[row, col])*4e-05
    hair = .05
    edges = ((west+col*pixel+hair, y), (west+(col+1)*pixel-hair, y),
             (x, north-row*pixel-hair), (x, north-(row+1)*pixel+hair))
    for point in edges:
        assert read(*point).value == pytest.approx(expected)
    assert abs(expected-float(values[row, col+1])*4e-05) > 1e-8
    assert abs(expected-float(values[row+1, col])*4e-05) > 1e-8
    assert abs(expected-float(values[height-1-row, col])*4e-05) > 1e-8
    assert abs(expected-float(values[row, width-1-col])*4e-05) > 1e-8


def test_skip_reason_names_each_visibility_map_that_was_tried(tmp_path):
    raster(tmp_path/'AVGVISIB_85S_060M_201608.TIF', (-89, 0), 60)
    raster(tmp_path/'AVGVISIB_75S_120M_201608.TIF', (-89, 0), 120)
    reason = visibility_skip_reason(tmp_path, 'sun', -69.3741, 32.32)
    assert reason == ('reference pixel is no-data or outside '
                      'AVGVISIB_85S_060M_201608.TIF and AVGVISIB_75S_120M_201608.TIF')
    assert visibility_reference(tmp_path, 'sun', -69.3741, 32.32) is None


def test_untrusted_raster_wrong_projection_is_rejected(tmp_path):
    raster(tmp_path/'AVGVISIB_85S_060M_201608.TIF', (-89, 0), 60, crs='EPSG:4326')
    with pytest.raises(ValueError, match='projection'):
        visibility_reference(tmp_path, 'sun', -89, 0)


def test_g2_reports_raw_azimuth_without_gating_it_near_zenith():
    times = np.datetime64('2026-01-01T00:00:00')+np.arange(25)*np.timedelta64(1, 'h')
    # A 90-degree compass change at 0.001 degree from zenith is a tiny sky angle.
    predicted = SimpleNamespace(az_deg=np.zeros(25), el_deg=np.full(25, 89.999))
    reference = {'az_deg': np.r_[90., np.zeros(24)], 'el_deg': np.full(25, 89.999)}
    report, chart = direction_evidence('test_site', 'sun', predicted, reference, times)
    assert report['raw_max_deg'] == 90
    assert report['raw_above_mark'] == 1
    assert report['az_max_deg'] == pytest.approx(.001414213562, abs=1e-11)
    assert report['el_max_deg'] == 0
    assert chart.max_difference_deg == pytest.approx([.001414213562, 0], abs=1e-11)
    assert chart.start_utc == '2026-01-01T00:00:00Z'
    assert chart.body == 'sun'


def synthetic_global_response():
    # Minimal synthetic Horizons text, with fully specified columns and conventions.
    import json
    header = '''Target body name: Moon (301)
Center body name: Earth (399)
Center-site name: GEOCENTRIC
Target pole/equ : MOON_ME {East-longitude positive}
Target radii : 1737.4, 1737.4, 1737.4 km
1 au= 149597870.700 km
Date__(UT)__HR:MN, , , ObsSub-LON, ObsSub-LAT, SunSub-LON, SunSub-LAT, r, delta,
'''
    rows = '2026-Jan-01 00:00, , , 12.25, -1.5, 359.75, 2.25, 1.0, 0.0025,\n'
    rows += '2026-Jan-01 01:00, , , 12.5, -1.25, 0.25, 2.5, 1.0001, 0.0024,\n'
    footer = "'ObsSub-LON, ObsSub-LAT,' = longitude is to the EAST for this target.\n"
    footer += "longitude is to the EAST for this target. Units: AU and KM/S Units: AU and KM/S\n"
    return json.dumps({'result': header+'$$SOE\n'+rows+'$$EOE\n'+footer})


def test_g1_exact_values_are_measured_from_synthetic_saved_response(monkeypatch):
    import truesouth.commands.validate as command
    response = synthetic_global_response()
    gate = parser_gate(response)
    assert gate.passed and gate.measured == 0 and gate.samples == 12
    original = command.parse_global
    def incorrect_parser(text):
        table = original(text)
        table.columns['subsolar_lat'][0] += .01
        return table
    monkeypatch.setattr(command, 'parse_global', incorrect_parser)
    gate = parser_gate(response)
    assert not gate.passed and gate.measured == pytest.approx(.01)


def test_g2_saved_synthetic_tables_cover_each_body_and_reject_wrong_grid(tmp_path):
    import hashlib
    import json
    from truesouth.commands.validate import directions_gate
    from truesouth.horizons import site_request
    from truesouth.contracts import Site
    site = Site(id='test_site', name='Test', group='contrast', lat_deg=-89, lon_deg=0,
                description='Synthetic', source_url='https://example.test', outcome=None,
                terrain_tier='core80', has_closeup=False, elevation_m=0, slope=None,
                quickmap_url='https://example.test', moontrek_url='https://example.test')
    times = np.datetime64('2026-01-01T00:00:00')+np.arange(4)*np.timedelta64(1, 'h')
    system = {prefix+suffix: np.full(4, value) for prefix in ('subsolar', 'subearth')
              for suffix, value in (('_lat', -89), ('_lon', 0))}
    system.update(sun_dist_km=np.full(4, 150000000), earth_dist_km=np.full(4, 380000))
    # Body directly over the site: azimuth convention 0, elevation 90.
    header = '''Center body name: Moon (301)
Center pole/equ : MEAN_ME (high precision) {East-longitude positive}
Center radii : 1737.4, 1737.4, 1737.4 km
Atmos refraction: NO (AIRLESS)
Date__(UT)__HR:MN, , , Azimuth_(a-app), Elevation_(a-app),
'''
    rows = ''.join(f'2026-Jan-01 0{i}:00, , , 0, 90,\n' for i in range(4))
    for body in ('sun', 'earth'):
        key = hashlib.sha256(json.dumps(site_request(body, -89, 0), sort_keys=True).encode()).hexdigest()[:20]
        (tmp_path/f'test_site-{body}-{key}.json').write_text(json.dumps({
            'result': header+'$$SOE\n'+rows+'$$EOE\nclockwise from north'}), encoding='utf-8')
    gate, charts = directions_gate([site], system, times, tmp_path)
    assert gate.passed and gate.samples == 8 and gate.measured < .00001
    assert {c.body for c in charts} == {'sun', 'earth'}
    assert all(len(c.max_difference_deg) == 1 for c in charts)
    variant = site.model_copy(update={'id': 'test_site_best_lit', 'variant_of': 'test_site', 'offset_m': 80.0})
    again, variant_charts = directions_gate([site, variant], system, times, tmp_path)
    assert again.passed and again.samples == gate.samples and again.measured == gate.measured
    assert len(variant_charts) == len(charts)
    with pytest.raises(ValueError, match='time grid'):
        directions_gate([site], system, times[:-1], tmp_path)


def test_directions_gate_passes_a_large_raw_azimuth_near_the_zenith(tmp_path):
    """Raw compass azimuth can swing near the zenith while the sky and elevation stay inside the gate."""
    import hashlib
    import json
    import re
    from truesouth.horizons import site_request
    from truesouth.contracts import Site
    site = Site(id='test_site', name='Test', group='contrast', lat_deg=-89, lon_deg=0,
                description='Synthetic', source_url='https://example.test', outcome=None,
                terrain_tier='core80', has_closeup=False, elevation_m=0, slope=None,
                quickmap_url='https://example.test', moontrek_url='https://example.test')
    times = np.datetime64('2026-01-01T00:00:00')+np.arange(4)*np.timedelta64(1, 'h')
    system = {prefix+suffix: np.full(4, value) for prefix in ('subsolar', 'subearth')
              for suffix, value in (('_lat', -89), ('_lon', 0))}
    system.update(sun_dist_km=np.full(4, 150000000), earth_dist_km=np.full(4, 380000))
    header = '''Center body name: Moon (301)
Center pole/equ : MEAN_ME (high precision) {East-longitude positive}
Center radii : 1737.4, 1737.4, 1737.4 km
Atmos refraction: NO (AIRLESS)
Date__(UT)__HR:MN, , , Azimuth_(a-app), Elevation_(a-app),
'''
    rows = {('sun'): ''.join(f'2026-Jan-01 0{i}:00, , , 90, 89.999,\n' for i in range(4)),
            ('earth'): ''.join(f'2026-Jan-01 0{i}:00, , , 0, 90,\n' for i in range(4))}
    for body, body_rows in rows.items():
        key = hashlib.sha256(json.dumps(site_request(body, -89, 0), sort_keys=True).encode()).hexdigest()[:20]
        (tmp_path/f'test_site-{body}-{key}.json').write_text(json.dumps({
            'result': header+'$$SOE\n'+body_rows+'$$EOE\nclockwise from north'}), encoding='utf-8')
    diagnostics = {}
    gate, charts = directions_gate([site], system, times, tmp_path, diagnostics)
    for field, label in (('raw_azimuth', 'raw'), ('sky', 'sky'), ('elevation', 'el')):
        location = diagnostics[field+'_location']
        assert f'{label}: max {diagnostics[field+"_max_deg"]:.12g} deg at {location["site_id"]}/{location["body"]} {location["utc"]}' in gate.detail
    assert f'{diagnostics["raw_azimuth_hours_over_limit"]} site/body hours above 0.02 deg' in gate.detail
    assert diagnostics['raw_azimuth_hours_over_limit'] == 4
    found = {name: float(re.search(rf'{name}: max ([0-9.eE+-]+) deg', gate.detail).group(1))
             for name in ('az', 'el', 'sky', 'raw')}
    assert found['raw'] > .02
    assert found['sky'] <= .02 and found['el'] <= .02 and found['az'] <= .02
    assert gate.passed is True and gate.measured <= .02 and gate.measured < found['raw']
    assert {c.body for c in charts} == {'sun', 'earth'}


def test_r5_smooth_tilted_terrain_converges(tmp_path):
    from truesouth.skyline import compute_skyline
    rr, cc = np.indices((151, 151))
    store = DemStore(prepared_geometry(tmp_path, 'tilted', .005*(cc-75)*80, (-89, 0), 80))
    coarse = compute_skyline(store, -89, 0)
    fine = compute_skyline(store, -89, 0, bins=2880, step_scale=.5)
    assert compare_convergence('test_site', coarse.el_deg, fine.el_deg).ours < .05


def test_geometry_gates_measure_the_shared_synthetic_constructions(tmp_path):
    gates = {g.id: g for g in geometry_gates(tmp_path)}
    assert set(gates) == {'G3', 'G4', 'G5', 'G6', 'G7', 'G8', 'G9'}
    for gate in gates.values():
        assert gate.passed, gate
        assert gate.samples > 0 and 0 <= gate.measured <= gate.limit
        assert gate.detail
    assert gates['G7'].measured == pytest.approx(.0013027560869, abs=1e-12)
    assert 'fraction' in gates['G9'].detail


def test_r5_flat_terrain_converges(tmp_path):
    from truesouth.skyline import compute_skyline
    path = prepared_geometry(tmp_path, 'flat', np.zeros((151, 151)), (-89, 0), 80)
    store = DemStore(path)
    coarse = compute_skyline(store, -89, 0)
    fine = compute_skyline(store, -89, 0, bins=2880, step_scale=.5)
    result = compare_convergence('test_site', coarse.el_deg, fine.el_deg)
    assert result.ours < .001
    assert not result.outside_mark


def synthetic_tree(tmp_path, monkeypatch):
    """Four hourly rows, one polar site; no real maps, network or fixtures."""
    root, raw, prepared = (tmp_path/n for n in ('derived', 'raw', 'prepared'))
    for p in (root, raw, prepared):
        p.mkdir()
    monkeypatch.setattr(paths, 'derived_dir', lambda: root)
    monkeypatch.setattr(paths, 'raw_dir', lambda: raw)
    monkeypatch.setattr(paths, 'prepared_dir', lambda: prepared)
    manifest = Manifest(schema_version=1, generated_utc='2026-01-01T00:00:00Z',
                        time_grid={'start_utc': '2026-01-01T00:00:00Z', 'count': 4, 'step_s': 3600},
                        moon_radius_m=1737400, observer_height_m=2, skyline_bins=1440)
    (root/'manifest.json').write_text(manifest.model_dump_json(), encoding='utf-8')
    site = dict(id='synthetic_ridge', name='Synthetic ridge', group='sunlit_peak', lat_deg=-89., lon_deg=0.,
                description='Synthetic', source_url='https://example.test', outcome=None,
                terrain_tier='core80', elevation_m=0., slope={'deg': 0, 'baseline_m': 160, 'source': 'synthetic'},
                has_closeup=False, quickmap_url='https://example.test', moontrek_url='https://example.test')
    (root/'sites.json').write_text(Sites.model_validate([site]).model_dump_json(), encoding='utf-8')
    site_dir = root/'sites'/'synthetic_ridge'
    site_dir.mkdir(parents=True)
    meta = SiteMeta(site_id='synthetic_ridge', series={'columns': SeriesLayout().arrays}, sun_radius_deg=.266,
                    earth_radius_deg=.95, skyline={'bins': 1440, 'missing_samples': 0, 'max_range_km': 300},
                    terrain=None, closeup=None)
    (site_dir/'meta.json').write_text(meta.model_dump_json(), encoding='utf-8')
    columns = {c.name: np.zeros(4) for c in SeriesLayout().arrays}
    columns['sun_frac'] = np.array([0, .25, .75, 1])
    columns['earth_frac'] = np.array([0, .0001, .5, 1])
    write_series(site_dir/'series.bin', columns)
    system = {name: np.zeros(4) for name in ('subsolar_lat', 'subsolar_lon', 'subearth_lat', 'subearth_lon')}
    system.update(sun_dist_km=np.full(4, 150000000), earth_dist_km=np.full(4, 380000))
    write_system(root/'system.bin', system, 4)
    # A ridge a few pixels from the site, so the 1,440-bin and 2,880-bin skylines disagree.
    terrain = np.zeros((151, 151), dtype=np.float32)
    terrain[68:84, 80] = 4000
    prepared_geometry(prepared, 'LDEM_80S_80MPP_ADJ', terrain, (-89, 0), 80)
    raster(raw/'AVGVISIB_85S_060M_201608.TIF', (-89, 0), 60, raw=25000)
    raster(raw/'AVGVISIB_85S_060M_201608_EARTH.TIF', (-89, 0), 60, raw=18750)
    raster(raw/'LDSM_80S_80MPP_ADJ.TIF', (-89, 0), 80, raw=0, scale=1, offset=0, unit='degree')
    return root, raw


def test_validate_cli_writes_valid_atomic_repeatable_evidence(tmp_path, monkeypatch, capsys):
    root, raw = synthetic_tree(tmp_path, monkeypatch)
    assert main(['validate', '--generated-utc', '2026-11-13T00:00:00Z']) == 0
    content = (root/'validation.json').read_bytes()
    report = Validation.model_validate_json(content)
    comparisons = {(c.id, c.site_id): c for c in report.comparisons}
    r1 = comparisons['R1', 'synthetic_ridge']
    assert r1.ours == .5 and r1.outside_mark
    assert '60 m pixel is 1.000' in r1.explanation and 'from 1.000 to 1.000' in r1.explanation
    assert '18.6' in r1.explanation and '2 m' in r1.explanation and len(r1.explanation) <= 400
    assert comparisons['R2', 'synthetic_ridge'].ours == .75
    r3 = comparisons['R3', 'synthetic_ridge']
    assert r3.explanation.endswith('.') and not r3.explanation.endswith('..')
    from truesouth.skyline import compute_skyline
    store = DemStore(tmp_path/'prepared'/'LDEM_80S_80MPP_ADJ.npy')
    coarse = compute_skyline(store, -89, 0)
    fine = compute_skyline(store, -89, 0, bins=2880, step_scale=.5)
    direct = compare_convergence('synthetic_ridge', coarse.el_deg, fine.el_deg)
    r5 = comparisons['R5', 'synthetic_ridge']
    assert r5.ours > 0
    assert r5.ours == pytest.approx(direct.ours)
    assert compare_convergence('synthetic_ridge', coarse.el_deg, np.repeat(coarse.el_deg, 2)).ours == 0
    assert not any(c.id in ('R4', 'R6') for c in report.comparisons)
    assert {g.id for g in report.gates} == {f'G{i}' for i in range(1, 12)}
    assert all(g.passed is False and g.measured == 0 and g.samples == 0 and 'not measured' in g.detail.lower()
               for g in report.gates if g.id in ('G1', 'G2'))
    assert all(g.passed is None and g.measured is None and g.samples == 0 and '.' in (g.detail or '')
               for g in report.gates if g.id in ('G10', 'G11'))
    assert main(['validate', '--generated-utc', '2026-11-13T00:00:00Z']) == 0
    assert (root/'validation.json').read_bytes() == content
    text = capsys.readouterr().out
    assert 'Not run' in text and 'R4' in text and 'R6' in text
    assert 'synthetic_ridge' in text
    assert not list(root.glob('.validation.json*'))
    # A missing reference is omitted, never silently converted into a passing R1.
    (raw/'AVGVISIB_85S_060M_201608.TIF').unlink()
    main(['validate', '--generated-utc', '2026-11-13T00:00:00Z'])
    assert not any(c.id == 'R1' for c in Validation.model_validate_json((root/'validation.json').read_bytes()).comparisons)


def test_failed_atomic_replace_preserves_previous_report(tmp_path, monkeypatch):
    from truesouth.commands.validate import write_validation
    path = tmp_path/'validation.json'
    path.write_bytes(b'previous')
    def fail(*args):
        raise OSError('synthetic rename failure')
    monkeypatch.setattr(Path, 'replace', fail)
    report = Validation(generated_utc='2026-11-13T00:00:00Z', gates=[], comparisons=[], g2_over_time=[], sources=[])
    with pytest.raises(OSError, match='rename'):
        write_validation(path, report)
    assert path.read_bytes() == b'previous'
    assert list(tmp_path.iterdir()) == [path]


def test_failing_measured_gate_still_writes_the_report(tmp_path, monkeypatch):
    from truesouth.commands import validate as command
    from truesouth.validation import measured_gate
    root, _raw = synthetic_tree(tmp_path, monkeypatch)
    original = command.geometry_gates

    def failing(directory):
        gates = original(directory)
        gates[0] = measured_gate('G3', gates[0].name, 1., .01, 'm', 4, 'Synthetic measured failure.')
        return gates

    monkeypatch.setattr(command, 'geometry_gates', failing)
    assert main(['validate', '--generated-utc', '2026-11-13T00:00:00Z']) == 1
    report = Validation.model_validate_json((root/'validation.json').read_bytes())
    gate = next(g for g in report.gates if g.id == 'G3')
    assert gate.passed is False and gate.measured == 1 and gate.samples == 4


def _clone_site(root, source_id, dest_id):
    import json
    import shutil
    dest = root/'sites'/dest_id
    shutil.copytree(root/'sites'/source_id, dest)
    meta = json.loads((dest/'meta.json').read_text(encoding='utf-8'))
    meta['site_id'] = dest_id
    (dest/'meta.json').write_text(json.dumps(meta), encoding='utf-8')


def test_a_variant_cannot_displace_a_catalog_comparison(tmp_path, monkeypatch):
    """R5 stays on catalog sites. R1, R2 and R3 still publish the variant."""
    import json
    root, _raw = synthetic_tree(tmp_path, monkeypatch)
    sites = json.loads((root/'sites.json').read_text(encoding='utf-8'))
    parent = sites[0]
    added = []
    for site_id in ('a_peak', 'b_peak', 'c_peak'):
        added.append({**parent, 'id': site_id, 'name': site_id})
        _clone_site(root, 'synthetic_ridge', site_id)
    added.append({**parent, 'id': 'a_peak_best_lit', 'name': 'A peak, best-lit point',
                  'variant_of': 'a_peak', 'offset_m': 80.5})
    _clone_site(root, 'synthetic_ridge', 'a_peak_best_lit')
    (root/'sites.json').write_text(json.dumps(sites + added), encoding='utf-8')
    assert main(['validate', '--generated-utc', '2026-11-13T00:00:00Z']) == 0
    report = Validation.model_validate_json((root/'validation.json').read_bytes())
    chosen = {}
    for comparison in report.comparisons:
        chosen.setdefault(comparison.id, []).append(comparison.site_id)
    # Sorted catalog sunlit peaks: a_peak, b_peak, c_peak. The variant sits
    # between a_peak and b_peak and must not take c_peak's place.
    assert chosen['R5'] == ['a_peak', 'b_peak', 'c_peak']
    for identifier in ('R1', 'R2', 'R3'):
        assert 'a_peak' in chosen[identifier]
        assert 'a_peak_best_lit' in chosen[identifier]
        assert 'c_peak' in chosen[identifier]
