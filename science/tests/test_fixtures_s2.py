import json

import numpy as np
import pytest

from truesouth.contracts import SeriesLayout
from truesouth.series import encode_series, decode_series


def test_g9_roundtrip_and_int16_edges():
    layout = SeriesLayout()
    values = {c.name: np.array([-32768, -123, 0, 123, 32767], dtype=float) * c.scale + c.offset for c in layout.arrays}
    encoded = encode_series(values, layout)
    decoded = decode_series(encoded, 5, layout)
    for c in layout.arrays:
        np.testing.assert_allclose(decoded[c.name], values[c.name], atol=c.scale / 2 + 1e-12, rtol=0)
    values["sun_el"][0] = -327.69
    with pytest.raises(ValueError, match="range"):
        encode_series(values, layout)


def test_g9_quantization_error():
    rng = np.random.default_rng(208)
    layout = SeriesLayout()
    values = {c.name: rng.uniform(-32767, 32766, 10000) * c.scale + c.offset for c in layout.arrays}
    decoded = decode_series(encode_series(values), 10000)
    for c in layout.arrays:
        assert np.max(np.abs(decoded[c.name] - values[c.name])) <= c.scale / 2 + 1e-12


def test_fixture_reproducibility(tmp_path):
    from truesouth.fixtures import build_fixtures
    from truesouth.paths import fixtures_dir, repo_root
    out = tmp_path / "fixtures"
    cases = tmp_path / "cases.json"
    build_fixtures(out, cases)
    for file in fixtures_dir().rglob("*"):
        if file.is_file():
            assert file.read_bytes() == (out / file.relative_to(fixtures_dir())).read_bytes()
    assert cases.read_bytes() == (repo_root() / "web/src/lib/scoring/__fixtures__/scoring_cases.json").read_bytes()
    before = {p.relative_to(out): p.read_bytes() for p in out.rglob("*") if p.is_file()}
    other = tmp_path / 'other'
    other_cases = tmp_path / 'other_cases.json'
    build_fixtures(other, other_cases)
    assert before == {p.relative_to(other): p.read_bytes() for p in other.rglob("*") if p.is_file()}
    assert cases.read_bytes() == other_cases.read_bytes()


def test_contracts_binary_lengths_and_clearance():
    from PIL import Image
    from truesouth import derived_io as io
    from truesouth.constants import TIME_GRID_COUNT as n
    from truesouth.contracts import Manifest, Sites, SiteMeta, MapMeta, Profiles, Features, ArtemisRegions, Validation, WorkedExamples
    from truesouth.paths import fixtures_dir
    root = fixtures_dir()
    def read(name, model):
        return model.model_validate_json((root / name).read_bytes())
    read('manifest.json', Manifest)
    sites = read('sites.json', Sites).root
    for name, model in [('profiles.json', Profiles), ('features.json', Features), ('artemis_regions.json', ArtemisRegions), ('validation.json', Validation), ('academy/worked_examples.json', WorkedExamples)]:
        read(name, model)
    validation = read('validation.json', Validation)
    assert {g.id: g.unit for g in validation.gates} == dict(zip((f'G{i}' for i in range(1,12)), ['difference','deg','m','deg','deg','deg','fraction','deg','deg','difference','difference']))
    assert {c.id: c.unit for c in validation.comparisons} == dict(zip((f'R{i}' for i in range(1,7)), ['fraction','fraction','deg','deg','deg','fraction']))
    assert {g.id for g in validation.gates} == {f'G{i}' for i in range(1,12)}
    assert {c.id for c in validation.comparisons} == {f'R{i}' for i in range(1,7)}
    assert any(not g.passed for g in validation.gates)
    assert any(c.outside_mark and c.explanation for c in validation.comparisons)
    assert all(c.outside_mark == (abs(c.ours-c.reference) > c.investigate_above) for c in validation.comparisons)
    assert {x.body for x in validation.g2_over_time} == {'sun', 'earth'}
    assert all(x.step_h == 24 and len(x.max_difference_deg) == n//24 and max(x.max_difference_deg) < .02 for x in validation.g2_over_time)
    assert (root / 'system.bin').stat().st_size == n * 6 * 4
    system = io.read_system(root / 'system.bin', n)
    assert len(system) == 6
    for key in ('subsolar_lon', 'subearth_lon'):
        assert np.all((system[key] >= 0) & (system[key] < 360))
    for site in sites:
        folder = root / 'sites' / site.id
        meta = SiteMeta.model_validate_json((folder / 'meta.json').read_bytes())
        assert (folder / 'series.bin').stat().st_size == n * 8 * 2
        assert (folder / 'skyline.bin').stat().st_size == meta.skyline.bins * 5 * 4
        s = io.read_series(folder / 'series.bin', n)
        for key in ('sun_az', 'earth_az'):
            assert np.all((s[key] >= 0) & (s[key] < 360))
        sky = io.read_skyline(folder / 'skyline.bin', meta.skyline.bins)
        for body in ('sun', 'earth'):
            pos = s[body + '_az'] * 4
            index = np.floor(pos).astype(int) % meta.skyline.bins
            fraction = pos - np.floor(pos)
            skyline = sky['el_deg'][index] * (1-fraction) + sky['el_deg'][(index+1) % meta.skyline.bins] * fraction
            np.testing.assert_allclose(s[body+'_clear'], s[body+'_el'] - skyline, atol=.005001, rtol=0)
            radius = meta.sun_radius_deg if body == 'sun' else meta.earth_radius_deg
            np.testing.assert_allclose(s[body+'_frac'], np.clip(.5 + s[body+'_clear']/(2*radius), 0, 1), atol=.000051, rtol=0)
        assert np.any(s['sun_frac'] == .5)
        for name in ('terrain', 'closeup'):
            mesh = getattr(meta, name)
            path = folder / (name + '.bin')
            assert path.exists() == (mesh is not None)
            if mesh:
                assert path.stat().st_size == mesh.size**2 * 4 * 4
                assert io.read_terrain(path, mesh.size)['east_km'].shape == (mesh.size, mesh.size)
        if site.terrain_tier == 'sphere':
            assert site.slope is None and meta.terrain is None
            assert all(np.isnan(sky[k]).all() for k in ('dist_km','lat_deg','lon_deg','height_m'))
            assert np.ptp(sky['el_deg']) == 0
            assert s['sun_el'].max() > 40 and s['sun_el'].min() < -40
            assert s['earth_el'].min() > 30
    maps = read('maps/meta.json', MapMeta)
    for layer in (maps.layers.hillshade, maps.layers.sunlight, maps.layers.earthvis):
        for name in layer.files:
            with Image.open(root / 'maps' / name) as image:
                assert image.size == (64, 64)
        if layer.lookup:
            assert io.read_map_lookup(root / 'maps' / layer.lookup, layer.lookup_size).shape == (64, 64)


def test_cases_match_reference_and_cover_edges():
    from dataclasses import asdict
    from truesouth import scoring, derived_io as io
    from truesouth.constants import TIME_GRID_COUNT
    from truesouth.contracts import MissionProfile
    from truesouth.paths import fixtures_dir, repo_root
    document = json.loads((repo_root() / 'web/src/lib/scoring/__fixtures__/scoring_cases.json').read_text(encoding='utf-8'))
    assert set(document) == {'format', 'generated_by', 'cases'}
    cases = document['cases']
    assert len(cases) >= 40
    translated = [c for c in cases if 'a1_exact_seventy_translated' in c['labels']]
    assert len(translated) == 16
    for c in translated + [c for c in cases if 'all_three_weights_exact_seventy' in c['labels']]:
        assert c['expected']['evaluation']['score'] == 70
        assert c['expected']['evaluation']['status'] == 'GO'
    boundary = next(c for c in cases if 'exact_veto_limit' in c['labels'])
    assert not any(v['triggered'] for v in boundary['expected']['evaluation']['vetoes'].values())
    labels = set(label for case in cases for label in case['labels'])
    assert {'relay','max_dark_h_zero','slope_not_assessed','operations_sun_elevation','weights_nonunit_zero','half_hour_window_tie','first_hour','last_landing_that_fits','one_hour_too_late','im2_go','im2_caution'} <= labels
    assert {f'veto_{v}_alone' for v in ('slope','darkness','blackout','landing_dark','landing_sun_low','landing_sun_high')} <= labels
    assert sum(x.startswith('preset_') for x in labels) >= 5
    cache = {}
    for case in cases:
        path = fixtures_dir() / case['series_file']
        if path not in cache: cache[path] = io.read_series(path, TIME_GRID_COUNT)
        start, end = case['hour_range']
        series = {k:v[start:end] for k,v in cache[path].items()}
        profile = MissionProfile.model_validate(case['profile'])
        expected = case['expected']
        result = scoring.evaluate(series, profile, case['landing_hour']-start, case['slope_deg'])
        assert case['countdowns'] == asdict(scoring.countdowns(series, profile, case['current_hour']-start))
        if result is None:
            assert expected is None
            continue
        assert expected['window_length'] == scoring.window_length(profile.duration_days)
        assert expected['evaluation'] == asdict(result)
        assert expected['countdowns'] == case['countdowns']
        lit, link = scoring.hour_flags(series, profile)
        i = case['landing_hour']-start
        assert expected['lit'] == lit[i:i+expected['window_length']].tolist()
        assert expected['link'] == link[i:i+expected['window_length']].tolist()
        for label in case['labels']:
            if label.startswith('veto_'):
                name = label[len('veto_'):-len('_alone')]
                assert [k for k,v in expected['evaluation']['vetoes'].items() if v['triggered']] == [name]
    assert {x['expected']['evaluation']['status'] for x in cases if x['expected'] and 'preset_im2_athena' in x['labels']} >= {'NO-GO'}
    assert next(x for x in cases if 'im2_go' in x['labels'])['expected']['evaluation']['status'] == 'GO'
    assert next(x for x in cases if 'im2_caution' in x['labels'])['expected']['evaluation']['status'] == 'CAUTION'
    assert next(x for x in cases if 'one_hour_too_late' in x['labels'])['expected'] is None
    high = next(x for x in cases if 'high_score_with_veto' in x['labels'])['expected']['evaluation']
    assert high['score'] >= 70 and high['status'] == 'NO-GO'
    case = next(x for x in cases if 'weights_nonunit_zero' in x['labels'])
    utility = case['expected']['evaluation']['utilities']
    assert all(0 < utility[k] < 1 for k in ('slope', 'power', 'comms'))
    assert len(set(utility.values())) == 3
    equal_score = 100 * sum(utility.values()) / 3
    assert abs(equal_score - case['expected']['evaluation']['score']) > 1e-6
    assert case['profile']['weights'] == {'slope': 0, 'power': 2, 'comms': 3}
    assert case['expected']['evaluation']['score'] == pytest.approx(100*(2*utility['power']+3*utility['comms'])/5)
    threshold = next(x for x in cases if 'score_go_threshold' in x['labels'])['expected']['evaluation']
    assert threshold['score'] == 70 and threshold['status'] == 'GO'
    missing = next(x for x in cases if 'slope_not_assessed' in x['labels'])
    u = missing['expected']['evaluation']['utilities']; w = missing['profile']['weights']
    assert u['slope'] is None and u['power'] != u['comms']
    assert missing['expected']['evaluation']['score'] == pytest.approx(100*(w['power']*u['power']+w['comms']*u['comms'])/(w['power']+w['comms']))
    assert w['slope'] > 0
    zero = next(x for x in cases if 'max_dark_h_zero' in x['labels'])
    metrics = zero['expected']['evaluation']['metrics']
    assert zero['profile']['max_dark_h'] == 0 and metrics['longest_dark_h'] == 0
    assert 0 < metrics['sun_fraction_mean'] < 1
    assert zero['expected']['evaluation']['utilities']['power'] == metrics['sun_fraction_mean']
    relay = next(x for x in cases if 'relay' in x['labels'])
    assert relay['profile']['relay_available'] and relay['expected']['evaluation']['utilities']['comms'] == 1
    assert relay['profile']['antenna_mask_deg'] > 90
    start, end = relay['hour_range']
    relay_series = {k:v[start:end] for k,v in cache[fixtures_dir() / relay['series_file']].items()}
    no_relay = MissionProfile.model_validate(relay['profile']).model_copy(update={'relay_available':False})
    without = scoring.evaluate(relay_series, no_relay, relay['landing_hour']-start, relay['slope_deg'])
    assert without.utilities.comms == 0 and without.score != relay['expected']['evaluation']['score']
    for label in ('current_lit', 'current_dark', 'current_linked', 'current_blackout'):
        c = next(x for x in cases if label in x['labels'])
        assert c['current_hour'] > c['landing_hour']
        i = c['current_hour'] - c['landing_hour']
        assert i < c['expected']['window_length']
        flags = c['expected']['lit'] if label in ('current_lit', 'current_dark') else c['expected']['link']
        assert flags[i] == (label in ('current_lit', 'current_linked'))
        key = {'current_lit':'sunset', 'current_dark':'sunrise', 'current_linked':'earthset', 'current_blackout':'earthrise'}[label]
        assert c['countdowns'][key] is not None


def test_daily_site_variety():
    from truesouth import scoring, catalog, derived_io as io
    from truesouth.constants import TIME_GRID_COUNT
    from truesouth.paths import fixtures_dir
    profile = next(p for p in catalog.load_profiles() if p.id == 'im2_athena')
    results = {}
    elevations = []
    skylines = []
    for site, slope in [('fixture_ridge',3), ('fixture_crater',8), ('fixture_edge',12), ('fixture_wide',9), ('fixture_sphere',None)]:
        folder = fixtures_dir() / 'sites' / site
        series = io.read_series(folder / 'series.bin', TIME_GRID_COUNT)
        sky = io.read_skyline(folder / 'skyline.bin', 1440)
        results[site] = [e for e in scoring.slip_sweep(series, profile, slope)[::24] if e is not None]
        elevations.append((series['sun_el'].min(), series['sun_el'].max()))
        skylines.append((sky['el_deg'].min(), sky['el_deg'].max()))
        if site in ('fixture_crater', 'fixture_edge', 'fixture_wide'):
            assert np.any(series['earth_clear'] < 0)
    assert len(set(elevations)) == len(elevations)
    assert len(set(skylines)) == len(skylines)
    for site in ('fixture_ridge', 'fixture_crater', 'fixture_wide'):
        assert len({e.status for e in results[site]}) >= 2
    ridge = results['fixture_ridge']
    assert sum(e.status == 'GO' for e in ridge) > len(ridge) / 2
    assert any(ridge[i].status == 'NO-GO' and ridge[i+14].status == 'GO' for i in range(len(ridge)-14))
    assert any(ridge[i].status == 'GO' and ridge[i+14].status == 'NO-GO' for i in range(len(ridge)-14))
    crater = results['fixture_crater']
    assert sum(e.status == 'NO-GO' for e in crater) > len(crater) / 2
    wide = results['fixture_wide']
    assert sum(e.status == 'CAUTION' for e in wide) > 100
    assert any({k for k,v in e.vetoes.items() if v.triggered} == {'slope'} for e in results['fixture_edge'])
    assert any(len({e.status for e in row}) == 3 for row in results.values())
    assert all(any(not e.vetoes[veto].triggered for site in ('fixture_ridge','fixture_crater','fixture_edge','fixture_wide') for e in results[site]) for veto in profile_veto_names())


def test_unmodified_preset_landing_sun_vetoes():
    from truesouth import catalog, derived_io as io, scoring
    from truesouth.constants import TIME_GRID_COUNT
    from truesouth.paths import fixtures_dir
    profile = next(p for p in catalog.load_profiles() if p.id == 'chandrayaan3')
    series = io.read_series(fixtures_dir() / 'sites/fixture_sphere/series.bin', TIME_GRID_COUNT)
    results = [e for e in scoring.slip_sweep(series, profile, None)[::24] if e is not None]
    assert any(e.vetoes['landing_sun_low'].triggered for e in results)
    assert any(e.vetoes['landing_sun_high'].triggered for e in results)


def profile_veto_names():
    return ('slope', 'darkness', 'blackout', 'landing_dark', 'landing_sun_low', 'landing_sun_high')
