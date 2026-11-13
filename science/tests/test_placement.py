"""Decision 0012: offline, independently worked map geometry."""

import json

import numpy as np
import pytest

from truesouth.dem import DemStore
from truesouth.frames import polar_stereo_forward, polar_stereo_inverse
from truesouth.contracts import CatalogSite, Site
from truesouth.placement import build_variant, candidate_points, evaluate_placement


def terrain(tmp_path, data=None):
    # Non-square grid: row 4, col 5 is (10000, 20000); +y is a row UP.
    data = np.zeros((9, 11)) if data is None else data
    tmp_path.mkdir(parents=True, exist_ok=True)
    path = tmp_path / 'core.npy'
    np.save(path, np.asarray(data, dtype=np.float32))
    path.with_suffix('.json').write_text(json.dumps(dict(
        origin_x=9560, origin_y=20360, pixel_x=80, pixel_y=-80)), encoding='utf-8')
    return DemStore(path)


@pytest.mark.parametrize('dx,dy,expected', [
    (0, 0, {(0, 0), (-2, 0), (-1, -1), (-1, 0), (-1, 1), (0, -2),
            (0, -1), (0, 1), (0, 2), (1, -1), (1, 0), (1, 1), (2, 0)}),
    # Listed point (20,20) off centre: x,y indices -1..2, corners excluded
    # except (-1,-1) whose distance is sqrt(100²+100²).
    (20, 20, {(-1, -1), (-1, 0), (-1, 1), (0, -1), (0, 0), (0, 1),
              (0, 2), (1, -1), (1, 0), (1, 1), (1, 2), (2, 0), (2, 1)}),
])
def test_candidate_centres_offsets_and_orientation(tmp_path, dx, dy, expected):
    store = terrain(tmp_path)
    points = candidate_points(store.core, *polar_stereo_inverse(10000+dx, 20000+dy))
    actual = set()
    for point in points:
        x, y = polar_stereo_forward(point.lat_deg, point.lon_deg)
        ix, iy = round((float(x)-10000)/80), round((float(y)-20000)/80)
        actual.add((ix, iy))
        assert point.row == 4-iy
        assert point.col == 5+ix
        assert point.offset_m == pytest.approx(np.hypot(ix*80-dx, iy*80-dy), abs=.001)
    assert actual == expected
    assert len(points) == 13


def catalog_site(**changes):
    lat, lon = polar_stereo_inverse(10000, 20000)
    return CatalogSite.model_validate(dict(id='ridge', name='Ridge', group='sunlit_peak',
        lat_deg=float(lat), lon_deg=float(lon), description='Published point',
        source_url='https://example.com/source', outcome=None) | changes)


def test_range_and_best_are_sunlight_not_highest_ground(tmp_path):
    heights = np.zeros((9, 11))
    heights[4, 4] = 1000  # Highest is west; best lit is east.
    store = terrain(tmp_path, heights)
    seen = []
    def mean(point):
        seen.append(point)
        return .9 if (point.row, point.col) == (4, 6) else .2
    result = evaluate_placement(catalog_site(), store, mean_for_point=mean)
    assert result.nearby_sun.model_dump() == dict(radius_m=160, points=13, min=.2, max=.9)
    assert (result.best.point.row, result.best.point.col) == (4, 6)
    assert result.best.mean_sun_frac == .9
    assert result.best.point.offset_m == 80
    assert len(seen) == 13
    assert result.skipped_points == 0


def test_mean_tie_prefers_nearest_then_row_then_column(tmp_path):
    store = terrain(tmp_path)
    nearest = evaluate_placement(catalog_site(), store, mean_for_point=lambda p: .5)
    assert (nearest.best.point.row, nearest.best.point.col) == (4, 5)
    # The four cardinal neighbours have exactly equal sunlight and distance.
    cardinal = evaluate_placement(catalog_site(), store,
        mean_for_point=lambda p: .9 if p.offset_m == 80 else .1)
    assert (cardinal.best.point.row, cardinal.best.point.col) == (3, 5)
    # Same row and distance: smaller column wins.
    horizontal = evaluate_placement(catalog_site(), store,
        mean_for_point=lambda p: .9 if p.row == 4 and p.offset_m == 80 else .1)
    assert (horizontal.best.point.row, horizontal.best.point.col) == (4, 4)


@pytest.mark.parametrize('changes', [dict(group='artemis'), dict(lat_deg=-79), dict(lat_deg=-59)])
def test_ineligible_site_gets_nothing(changes):
    def unexpected(point):
        pytest.fail('ineligible site must not evaluate candidates')
    assert evaluate_placement(catalog_site(**changes), DemStore(), mean_for_point=unexpected) is None


def test_missing_candidates_skipped_counted_and_listed_pixel_required(tmp_path):
    heights = np.zeros((9, 11))
    heights[4, 6] = np.nan
    store = terrain(tmp_path, heights)
    seen = []
    result = evaluate_placement(catalog_site(), store,
        mean_for_point=lambda p: seen.append(p) or .5)
    assert result.skipped_points == 1
    assert result.nearby_sun.points == 12
    assert len(seen) == 12
    assert all((p.row, p.col) != (4, 6) for p in seen)
    heights[4, 5] = np.nan
    with pytest.raises(ValueError, match='listed.*pixel.*unusable'):
        evaluate_placement(catalog_site(), terrain(tmp_path / 'missing_listed', heights), mean_for_point=lambda p: .5)


@pytest.mark.parametrize('value', [np.nan, np.inf, -.1, 1.1])
def test_bad_injected_mean_is_an_error(tmp_path, value):
    with pytest.raises(ValueError, match='mean.*fraction'):
        evaluate_placement(catalog_site(), terrain(tmp_path), mean_for_point=lambda p: value)


def test_variant_record_is_explicitly_chosen_and_leaves_derived_fields_to_builder(tmp_path):
    site = catalog_site()
    result = evaluate_placement(site, terrain(tmp_path),
        mean_for_point=lambda p: .9 if (p.row, p.col) == (4, 6) else .2)
    variant = build_variant(site, result)
    assert variant['id'] == 'ridge_best_lit'
    assert variant['name'] == 'Ridge, best-lit point'
    assert variant['group'] == site.group
    assert variant['variant_of'] == 'ridge'
    assert variant['offset_m'] == 80
    assert variant['nearby_sun'] == result.nearby_sun.model_dump()
    assert variant['outcome'] is None
    assert (variant['lat_deg'], variant['lon_deg']) == (result.best.point.lat_deg, result.best.point.lon_deg)
    for text in ('TrueSouth', '80 m', '160 m', '80.0 m', 'listed point',
                 'own sunlight calculation', 'not a published site', 'upper reading'):
        assert text in variant['description']
    assert variant['source_url'] == (
        'https://github.com/anahmed404/TrueSouth/blob/main/docs/science.md'
        '#71-how-much-a-sunlit-peak-depends-on-where-you-stand')
    assert 'terrain_tier' not in variant
    # Part B supplies the normal derived fields, then validates the complete Site.
    complete = Site.model_validate(variant | dict(terrain_tier='core80', has_closeup=False,
        elevation_m=0, slope=None, quickmap_url='', moontrek_url=''))
    assert complete.variant_of == site.id
    assert build_variant(catalog_site(group='contrast'), None) is None
    assert site.description == 'Published point'


def test_real_skyline_and_series_choose_crest_80m_from_listed_point(tmp_path):
    heights = np.zeros((9, 11))
    # A narrow north-south ridge, 20 m tall, one column east of the listed point.
    # Sun near the horizon from all longitudes is blocked on the lower ground.
    heights[:, 6] = 20
    store = terrain(tmp_path, heights)
    n = 48
    ephemeris = dict(subsolar_lat=np.full(n, -1.), subsolar_lon=np.arange(n)*360/n,
        subearth_lat=np.zeros(n), subearth_lon=np.zeros(n),
        sun_dist_km=np.full(n, 149597870.7), earth_dist_km=np.full(n, 384400.))
    result = evaluate_placement(catalog_site(), store, global_ephemeris=ephemeris)
    listed_pixel = next(p for p in result.points if (p.point.row, p.point.col) == (4, 5))
    assert result.best.mean_sun_frac > listed_pixel.mean_sun_frac
    assert (result.best.point.row, result.best.point.col) == (4, 6)
    assert build_variant(catalog_site(), result)['offset_m'] == 80


def test_no_visibility_map_dependency():
    import ast
    import inspect
    import truesouth.placement as placement
    source = inspect.getsource(placement)
    imports = {node.module for node in ast.walk(ast.parse(source)) if isinstance(node, ast.ImportFrom)}
    assert imports <= {'dataclasses', 'collections.abc', 'contracts', 'dem', 'frames', 'series', 'skyline'}
    assert 'maps' not in imports
    assert not any(token in source for token in ('LPSR', 'average_visibility', 'sunlight_u8', 'open(', 'np.load('))


def test_measure_is_mean_disc_fraction_not_hours_with_any_sun(tmp_path, monkeypatch):
    # The Sun's disc is half visible for half the hours and hidden for the rest: the mean
    # disc fraction is 0.25, while the share of hours with any Sun is 0.5. Section 7.1 asks
    # for the mean. The skyline and series are replaced so the series is known exactly.
    from types import SimpleNamespace

    from truesouth import placement

    store = terrain(tmp_path)
    point = candidate_points(store.core, *polar_stereo_inverse(10000., 20000.))[0]
    series = SimpleNamespace(columns={'sun_frac': np.array([.5, .5, 0., 0.])})
    monkeypatch.setattr(placement, 'compute_skyline',
                        lambda *args, **kwargs: SimpleNamespace(el_deg=np.zeros(1440)))
    monkeypatch.setattr(placement, 'build_series', lambda *args, **kwargs: series)
    assert placement.mean_sun_for_point(store, point, {}) == pytest.approx(.25)
