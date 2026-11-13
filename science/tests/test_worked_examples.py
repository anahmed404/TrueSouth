"""Selection rules and the worked-examples command, on arrays built by hand."""

import json
from pathlib import Path
from types import SimpleNamespace

import numpy as np
import pytest
from pydantic import ValidationError

from truesouth.commands.build_worked_examples import run
from truesouth.contracts import PROFILE_FIELDS, Manifest, MissionProfile, SiteMeta, Sites, WorkedExamples
from truesouth.derived_io import write_series, write_skyline, write_system
from truesouth.worked_examples import (
    EXAMPLES, LINK_BELOW_PCT, MASKS_DEG, RULE_LESSON2, RULE_LESSON4_MASK, RULE_STORY_LANDING,
    MissingSelection, bin_azimuth_deg, closest_hour, curvature_drop_m, direct_link_percentages,
    first_extreme_hour, first_lesson2_hour, first_mask_below, flat_elevation_deg, height_above_observer,
    lesson2_site_order, lesson7_landing_index, lesson8_candidates, most_distant_blocker, nearest_bin,
    next_go_index, passing_sites, story_landing_index,
)

N = 800
BINS = 8


def test_nearest_bin_rounds_half_up_and_wraps():
    assert nearest_bin(0, 4) == 0
    assert nearest_bin(45, 4) == 1  # position 0.5 rounds half up
    assert nearest_bin(315, 4) == 0  # position 3.5 rounds to 4 and wraps
    assert nearest_bin(314.9, 4) == 3
    assert nearest_bin(359, 1440) == 1436
    assert nearest_bin(359.875, 1440) == 0  # position 1439.5 rounds to 1440 and wraps
    assert nearest_bin(np.array([45.0, 315.0]), 4).tolist() == [1, 0]


def test_lesson2_hour_boundaries_ties_and_a_far_blocker_below_the_observer():
    hours = 6
    sun_el = np.array([0.0, 0.2, 0.2, 0.2, 0.2, -1.0])
    sun_clear = np.array([-0.3, -0.5001, -0.5, -0.1, -0.099, -0.3])
    sun_az = np.zeros(hours)
    dist = np.array([10.0, 5.0, 1.0])
    height = np.array([10.0, 0.0, 100.0])
    eligible = np.ones(hours, dtype=bool)
    # Hour 0 is not above the horizon. Hour 1's clearance is just outside.
    # Hour 2 is inside the clearance, but the only bins are not both far and above:
    # azimuth 0 selects bin 0, which is far. Make that one below the observer.
    height = np.array([1.0, 0.0, 100.0])  # rise = 1 - 0 - 2 = -1, below
    assert first_lesson2_hour(sun_el, sun_clear, sun_az, dist, height, eligible, elevation_m=0, observer_height_m=2) is None
    height = np.array([9.0, 0.0, 100.0])  # rise = 7, above; distance 10 > 5
    # Hours 2 and 3 both match. The earlier hour wins. Hour 4's clearance is just too high.
    assert first_lesson2_hour(sun_el, sun_clear, sun_az, dist, height, eligible, elevation_m=0, observer_height_m=2) == 2
    dist = np.array([5.0, 0.0, 0.0])  # exactly 5 km is not more than 5
    assert first_lesson2_hour(sun_el, sun_clear, sun_az, dist, height, eligible, elevation_m=0, observer_height_m=2) is None
    dist = np.array([np.nan, 10.0, 10.0])
    assert first_lesson2_hour(sun_el, sun_clear, sun_az, dist, height, eligible, elevation_m=0, observer_height_m=2) is None


def test_lesson2_searches_the_story_site_then_sunlit_peaks_by_id_and_skips_variants():
    sites = [
        SimpleNamespace(id='malapert_peak', group='sunlit_peak', variant_of=None),
        SimpleNamespace(id='connecting_ridge', group='sunlit_peak', variant_of=None),
        SimpleNamespace(id='connecting_ridge_best_lit', group='sunlit_peak', variant_of='connecting_ridge'),
        SimpleNamespace(id='de_gerlache_rim', group='sunlit_peak', variant_of=None),
        SimpleNamespace(id='apollo11', group='contrast', variant_of=None),
        SimpleNamespace(id='shackleton_rim', group='sunlit_peak', variant_of=None),
    ]
    order = lesson2_site_order('connecting_ridge', sites)
    assert order == ['connecting_ridge', 'de_gerlache_rim', 'malapert_peak', 'shackleton_rim']
    found = {}
    for site_id in order:
        hour = {'connecting_ridge': None, 'de_gerlache_rim': 50, 'malapert_peak': 10, 'shackleton_rim': 3}[site_id]
        if hour is not None:
            found = {'id': site_id, 'hour': hour}
            break
    assert found == {'id': 'de_gerlache_rim', 'hour': 50}
    # The story site wins even when another peak has an earlier hour.
    assert next(site_id for site_id in order if site_id == 'connecting_ridge') == order[0]


def test_most_distant_blocker_ignores_nan_and_ties_go_to_the_lowest_azimuth():
    assert most_distant_blocker([np.nan, 5.0, np.nan, 5.0]) == 1
    assert most_distant_blocker([1.0, np.nan, 9.0, 9.0]) == 2
    assert most_distant_blocker([np.nan, np.nan]) is None
    assert bin_azimuth_deg(2, 8) == 90


def test_height_and_flat_elevation_use_section_4():
    assert height_above_observer(1052, 1000, 2) == 50
    assert flat_elevation_deg(50, 9) == pytest.approx(np.degrees(np.arctan2(50, 9000)))
    assert curvature_drop_m(20, 1_737_400) == pytest.approx(20_000 ** 2 / (2 * 1_737_400))


def test_extremes_and_closest_hour_take_the_earliest_tie():
    values = np.array([1.0, 3.0, 3.0, 0.0])
    eligible = np.array([True, True, True, False])
    assert first_extreme_hour(values, eligible, pick='max') == 1
    assert first_extreme_hour(values, eligible, pick='min') == 0
    assert closest_hour(np.array([5.0, 1.2, 0.8, 1.2]), 1.0, np.ones(4, dtype=bool)) == 1


def _result(status, *, score=80, blackout=False, blackout_h=0):
    names = ('slope', 'darkness', 'blackout', 'landing_dark', 'landing_sun_low', 'landing_sun_high')
    vetoes = {name: SimpleNamespace(triggered=name == 'blackout' and blackout) for name in names}
    metrics = SimpleNamespace(longest_blackout_h=blackout_h)
    return SimpleNamespace(status=status, score=score, vetoes=vetoes, metrics=metrics)


def test_story_landing_prefers_the_first_go_then_the_first_caution():
    midnights = [0, 24, 48]
    go = [None] * 49
    go[24] = _result('NO-GO')
    go[48] = _result('GO')
    assert story_landing_index(midnights, go) == 48
    caution = [_result('NO-GO')] * 49
    caution[24] = _result('CAUTION')
    caution[48] = _result('CAUTION')
    assert story_landing_index(midnights, caution) == 24
    assert story_landing_index(midnights, [_result('NO-GO')] * 49) is None


def test_mask_list_treats_exactly_15_percent_as_not_below():
    shares = [15.0, 15.0, 14.999] + [10.0] * 18
    assert first_mask_below(shares) == 1.0
    assert first_mask_below([15.0] * 21) is None
    assert first_mask_below([14.999] + [20.0] * 20) == 0.0
    assert first_mask_below([20.0] * 13 + [15.0, 14.0] + [10.0] * 6) == 7.0
    assert LINK_BELOW_PCT == 15
    assert MASKS_DEG[13] == 6.5


def test_lesson7_and_lesson8_ordering():
    # Hour 0 is GO and 21 days later (hour 504) is NO-GO with blackout. Hour 24 is earlier and does not qualify.
    evaluations = [_result('NO-GO')] * 600
    evaluations[0] = _result('GO')
    evaluations[504] = _result('NO-GO', blackout=True, blackout_h=24)
    evaluations[528] = _result('GO', score=90)
    midnights = list(range(0, 600, 24))
    assert lesson7_landing_index(midnights, evaluations) == 0
    assert next_go_index(504, midnights, evaluations) == 528
    assert lesson8_candidates({'b': False, 'a': False, 'd': True, 'c': False}) == ['a', 'b', 'c', 'd']
    assert lesson8_candidates({'a': True, 'b': True}) is None
    ranked = passing_sites([('b', _result('GO', score=50)), ('a', _result('GO', score=50)), ('c', _result('NO-GO', score=99, blackout=True))])
    assert [item[0] for item in ranked] == ['a', 'b']


def test_direct_link_uses_the_scoring_flag_and_no_relay():
    from truesouth.scoring import hour_flags
    profile = _profile()
    series = {'earth_clear': np.array([0.0, 0.4, 1.0]), 'sun_frac': np.ones(3), 'sun_el': np.ones(3)}
    shares = direct_link_percentages(series, profile, masks=(0.0, 0.5, 1.0))
    tuned = profile.model_copy(update={'relay_available': False, 'antenna_mask_deg': 0.5})
    assert shares[1] == pytest.approx(100.0 * np.count_nonzero(hour_flags(series, tuned)[1]) / 3)


def _profile(**changes):
    values = dict(
        id='im2_athena', name='IM-2 Athena', based_on='IM-2', duration_days=1, min_sun_fraction=0.5,
        ops_sun_el_min_deg=None, max_dark_h=6, relay_available=False, antenna_mask_deg=1, max_blackout_h=12,
        max_slope_deg=10, slope_ideal_deg=5, landing_sun_el_min_deg=None, landing_sun_el_max_deg=None,
        weights=dict(slope=0.4, power=0.35, comms=0.25),
        provenance={key: dict(kind='assumed', reason='synthetic test') for key in PROFILE_FIELDS},
    )
    values.update(changes)
    return MissionProfile(**values)


def _site(site_id, name, group, slope, *, variant_of=None, offset_m=None, elevation=0.0):
    return dict(
        id=site_id, name=name, group=group, lat_deg=-89.0, lon_deg=10.0,
        description='Synthetic.', source_url='', outcome=None, terrain_tier='core80', has_closeup=False,
        elevation_m=elevation, slope=None if slope is None else dict(deg=slope, baseline_m=160, source='synthetic'),
        quickmap_url='https://example.test/', moontrek_url='https://example.test/',
        variant_of=variant_of, offset_m=offset_m, nearby_sun=None,
    )


def _blank_series():
    return dict(
        sun_az=np.zeros(N), sun_el=np.full(N, 0.5), sun_frac=np.ones(N), sun_clear=np.zeros(N),
        earth_az=np.zeros(N), earth_el=np.zeros(N), earth_frac=np.ones(N), earth_clear=np.full(N, 5.0),
    )


def _sky(dist, height, el=0.0):
    return dict(
        el_deg=np.full(BINS, el), dist_km=np.asarray(dist, dtype=float), lat_deg=np.zeros(BINS),
        lon_deg=np.zeros(BINS), height_m=np.asarray(height, dtype=float),
    )


def _write_tree(root, *, story_slope=4.0, lesson2=True, high_earth=False):
    root.mkdir(parents=True)
    manifest = Manifest(
        schema_version=1, generated_utc='2028-01-01T00:00:00Z',
        time_grid=dict(start_utc='2028-01-01T00:00:00Z', step_s=3600, count=N),
        observer_height_m=2.0, skyline_bins=BINS, moon_radius_m=1_737_400,
    )
    (root / 'manifest.json').write_bytes(json.dumps(manifest.model_dump(mode='json')).encode() + b'\n')
    sites = [
        _site('connecting_ridge', 'Connecting Ridge', 'sunlit_peak', story_slope, elevation=1000),
        _site('de_gerlache_rim', 'de Gerlache Rim', 'sunlit_peak', 30, elevation=0 if lesson2 else 1000),
        _site('malapert_peak', 'Malapert', 'sunlit_peak', 30, elevation=0 if lesson2 else 1000),
        _site('shackleton_rim', 'Shackleton', 'sunlit_peak', 30, elevation=0 if lesson2 else 1000),
        _site('apollo11', 'Apollo 11', 'contrast', 1, elevation=0),
        _site('connecting_ridge_best_lit', 'Best lit', 'sunlit_peak', 4, variant_of='connecting_ridge', offset_m=80, elevation=0),
    ]
    (root / 'sites.json').write_bytes(json.dumps(Sites.model_validate(sites).model_dump(mode='json')).encode() + b'\n')
    (root / 'profiles.json').write_bytes(json.dumps([_profile().model_dump(mode='json')]).encode() + b'\n')
    system = {name: np.zeros(N) for name in ('subsolar_lat', 'subsolar_lon', 'subearth_lat', 'subearth_lon', 'earth_dist_km', 'sun_dist_km')}
    system['subsolar_lat'][100] = -1.5
    system['subsolar_lon'][100] = 20
    write_system(root / 'system.bin', system, N)

    def put(site_id, series, sky):
        folder = root / 'sites' / site_id
        folder.mkdir(parents=True)
        from truesouth.contracts import SeriesLayout
        meta = SiteMeta(
            site_id=site_id,
            series={'columns': [column.model_dump() for column in SeriesLayout().arrays]},
            sun_radius_deg=0.266, earth_radius_deg=0.95,
            skyline={'bins': BINS, 'missing_samples': 0, 'max_range_km': 300},
            terrain=None, closeup=None,
        )
        (folder / 'meta.json').write_bytes(json.dumps(meta.model_dump(mode='json')).encode() + b'\n')
        write_series(folder / 'series.bin', series)
        write_skyline(folder / 'skyline.bin', sky, BINS)

    story = _blank_series()
    story['sun_el'] = np.full(N, 0.5)
    story['sun_el'][100] = 1.25
    story['sun_el'][200] = -0.4
    story['earth_el'][10] = 6
    story['earth_el'][20] = -7
    story['earth_clear'] = np.full(N, 20.0 if high_earth else 5.0)
    if not high_earth:
        story['earth_clear'][80] = 1.01
        story['earth_clear'][504:528] = -1
        story['earth_frac'][504:528] = 0
    story_dist = np.array([np.nan, 1, 9, 9, 2, 3, 4, 5], dtype=float)
    story_el = np.zeros(BINS)
    story_el[2] = 0.4
    put('connecting_ridge', story, _sky(story_dist, np.zeros(BINS), 0))
    # The stored elevation of the distant bin is set after _sky copies a constant. Rewrite it.
    folder = root / 'sites' / 'connecting_ridge'
    write_skyline(folder / 'skyline.bin', dict(
        el_deg=story_el, dist_km=story_dist, lat_deg=np.zeros(BINS), lon_deg=np.zeros(BINS), height_m=np.zeros(BINS),
    ), BINS)

    def peak(hour):
        series = _blank_series()
        series['sun_el'] = np.full(N, -1.0)
        series['sun_el'][hour] = 0.2
        series['sun_clear'][hour] = -0.3
        return series

    above = np.full(BINS, 100.0)
    below = np.zeros(BINS)
    height = above if lesson2 else below
    put('de_gerlache_rim', peak(50), _sky(np.full(BINS, 10.0), height))
    put('malapert_peak', peak(10), _sky(np.full(BINS, 12.0), height))
    put('shackleton_rim', peak(80), _sky(np.full(BINS, 11.0), height))
    put('apollo11', peak(1), _sky(np.full(BINS, 20.0), above))
    put('connecting_ridge_best_lit', peak(1), _sky(np.full(BINS, 30.0), above))
    return root


def _run(root):
    return run(SimpleNamespace(derived=root))


def test_command_writes_a_valid_file_and_a_repeat_is_byte_identical(tmp_path):
    root = _write_tree(tmp_path / 'derived')
    assert _run(root) == 0
    path = root / 'academy' / 'worked_examples.json'
    first = path.read_bytes()
    model = WorkedExamples.model_validate_json(first)
    assert _run(root) == 0
    assert path.read_bytes() == first
    values = model.model_dump(by_alias=True)
    assert values['l2.site_id'] == 'de_gerlache_rim'
    assert values['l2.site_name'] == 'de Gerlache Rim'
    assert values['l2.example_utc'] == '2028-01-03T02:00:00Z'
    assert values['story.landing_utc'] == '2028-01-01T00:00:00Z'
    assert values['story.month_end_utc'] == '2028-01-31T00:00:00Z'
    assert values['story.window_end_utc'] == '2028-01-02T00:00:00Z'
    assert values['l4.mask_for_15pct_deg'] == 5.5
    assert values['l4.mask_for_15pct_deg'] == next(
        MASKS_DEG[index] for index, share in enumerate(values['l4.link_pct_by_mask']) if share < 15
    )
    assert values['l5.slope_10m_deg'] is None
    assert values['l6.site_b'] is None
    assert values['l7.alt_site'] is None
    assert values['l8.region_overlap.overlaps'] is None
    assert values['l3.example_bin_az'] == 90
    assert {row.key for row in EXAMPLES} == set(values)


def test_a_failed_rule_names_itself_and_writes_nothing(tmp_path, capsys):
    cases = (
        (dict(story_slope=30), RULE_STORY_LANDING),
        (dict(lesson2=False), RULE_LESSON2),
        (dict(high_earth=True), RULE_LESSON4_MASK),
    )
    for changes, rule in cases:
        root = _write_tree(tmp_path / rule.replace(' ', '_'), **changes)
        path = root / 'academy' / 'worked_examples.json'
        path.parent.mkdir(parents=True)
        path.write_bytes(b'keep\n')
        assert _run(root) == 1
        assert path.read_bytes() == b'keep\n'
        assert rule in capsys.readouterr().err


def _payload():
    from types import UnionType
    from typing import get_args, get_origin
    def sample(field):
        if 'utc' in field.alias or field.alias.endswith('_date'):
            return '2028-01-01T00:00:00Z'
        annotation = field.annotation
        origin = get_origin(annotation)
        if origin is UnionType:
            remaining = [item for item in get_args(annotation) if item is not type(None)]
            annotation = remaining[0]
            origin = get_origin(annotation)
        if annotation is str:
            return 'ridge'
        if annotation is bool:
            return True
        if origin is list and get_args(annotation) == (str,):
            return ['ridge']
        if origin is list:
            return [20.0] * 13 + [14.0] + [10.0] * 7
        return 1.0
    data = {field.alias: sample(field) for field in WorkedExamples.model_fields.values()}
    data['l4.mask_for_15pct_deg'] = 6.5
    return data


def test_contract_nulls_list_length_and_the_15_percent_boundary():
    WorkedExamples.model_validate(_payload())
    blocked = _payload()
    blocked['l1.sun_el_max_deg'] = None
    with pytest.raises(ValidationError):
        WorkedExamples.model_validate(blocked)
    allowed = _payload()
    for key in ('l5.slope_10m_deg', 'l5.slope_100m_deg', 'l5.plane_a', 'l5.plane_b', 'l6.site_b', 'l6.b_score', 'l7.alt_site', 'l8.region_overlap.region_name', 'l8.region_overlap.overlaps'):
        allowed[key] = None
    WorkedExamples.model_validate(allowed)
    short = _payload()
    short['l4.link_pct_by_mask'] = [1.0] * 20
    with pytest.raises(ValidationError):
        WorkedExamples.model_validate(short)
    exact = _payload()
    exact['l4.link_pct_by_mask'] = [15.0] * 13 + [14.0] + [10.0] * 7
    exact['l4.mask_for_15pct_deg'] = 6.0  # the 15s are not below, so 6.0 is too early
    with pytest.raises(ValidationError, match='below 15'):
        WorkedExamples.model_validate(exact)
    exact['l4.mask_for_15pct_deg'] = 6.5
    WorkedExamples.model_validate(exact)
    story = _payload()
    story['story.landing_utc'] = None
    with pytest.raises(ValidationError):
        WorkedExamples.model_validate(story)


def test_missing_selection_is_the_command_stop(tmp_path):
    with pytest.raises(MissingSelection, match=RULE_LESSON2):
        raise MissingSelection(RULE_LESSON2)
    assert not (tmp_path / 'absent.json').exists()
