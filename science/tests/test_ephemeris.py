"""Known geometry for science.md §3.2, then the binary contract."""

import numpy as np
import pytest

from truesouth.constants import (
    EARTH_RADIUS_KM, MOON_RADIUS_M, OBSERVER_HEIGHT_M, SUN_RADIUS_KM, TIME_GRID_COUNT,
)
from truesouth.contracts import SystemLayout
from truesouth.ephemeris import Topocentric, compare_site, load_global, topocentric, write_global


def test_body_overhead_has_no_parallax():
    # Body and observer are collinear: subtracting the observer radius changes
    # distance, not elevation. There is exactly zero angular parallax here.
    result = topocentric(0, 0, 0, 0, 384400, EARTH_RADIUS_KM)
    assert result.el_deg == pytest.approx(90)
    np.testing.assert_allclose(result.direction, [1, 0, 0], atol=1e-15)
    assert result.distance_km == pytest.approx(384400 - 1737.402)


def test_body_ninety_degrees_away_includes_parallax():
    result = topocentric(0, 0, 0, 90, 384400, EARTH_RADIUS_KM)
    # Site (R0,0,0), body (0,D,0): local up=-R0 and east=D,
    # so elevation is atan2(-R0,D), not zero.
    expected = np.rad2deg(np.arctan2(-(MOON_RADIUS_M + OBSERVER_HEIGHT_M) / 1000, 384400))
    assert result.el_deg == pytest.approx(expected)
    assert result.az_deg == pytest.approx(90)


@pytest.mark.parametrize('radius,distance,expected', [
    # asin(6378.137 / (384400 - 1737.402)) = 0.955037822 degrees.
    (SUN_RADIUS_KM, 149597870.7, 0.26645), (EARTH_RADIUS_KM, 384400, 0.955038),
])
def test_angular_radii(radius, distance, expected):
    result = topocentric(0, 0, 0, 0, distance, radius)
    assert result.radius_deg == pytest.approx(expected, abs=0.00002)


def test_near_south_pole_azimuth_uses_site_longitude():
    result = topocentric(-89.4555, 222.6192, 0, 0, 384400, EARTH_RADIUS_KM)
    assert result.az_deg == pytest.approx(360 - 222.6192, abs=0.002)


def test_vectorised_geometry_and_ground_height():
    result = topocentric(-80, 30, np.array([0, 10]), np.array([0, 30]),
                         np.array([384400, 400000]), EARTH_RADIUS_KM, ground_height_m=1000)
    assert result.direction.shape == (2, 3)
    np.testing.assert_allclose(np.linalg.norm(result.direction, axis=-1), 1)
    for i in range(2):
        scalar = topocentric(-80, 30, [0, 10][i], [0, 30][i],
                             [384400, 400000][i], EARTH_RADIUS_KM, ground_height_m=1000)
        assert result.el_deg[i] == pytest.approx(scalar.el_deg)


def test_system_round_trip_contract_order(tmp_path):
    columns = {name: np.arange(TIME_GRID_COUNT, dtype=float) / 1000 + i
               for i, name in enumerate(SystemLayout().arrays)}
    path = tmp_path / 'system.bin'
    write_global(columns, path)
    assert path.stat().st_size == 6 * TIME_GRID_COUNT * 4
    loaded = load_global(path)
    raw = np.fromfile(path, dtype='<f4').reshape(6, TIME_GRID_COUNT)
    for i, name in enumerate(SystemLayout().arrays):
        np.testing.assert_array_equal(loaded[name], columns[name].astype('<f4'))
        np.testing.assert_array_equal(raw[i], loaded[name])


def test_system_rejects_wrong_length_and_nonfinite(tmp_path):
    path = tmp_path / 'system.bin'
    path.write_bytes(b'1234')
    with pytest.raises(ValueError, match='size'):
        load_global(path)
    columns = {name: np.zeros(TIME_GRID_COUNT) for name in SystemLayout().arrays}
    columns['subsolar_lat'][0] = np.nan
    with pytest.raises(ValueError, match='finite'):
        write_global(columns, path)


def test_sky_azimuth_comparison_handles_wrap_and_zenith():
    predicted = Topocentric(None, np.array([359.999, 180, 90]),
                            np.array([0, 90, 89.999]), None, None)
    reference = {'az_deg': np.array([0.001, 0, 0]), 'el_deg': np.array([0, 90, 89.999])}
    times = np.arange(3).astype('datetime64[h]').astype('datetime64[s]')
    report = compare_site(predicted, reference, times)
    assert report['az_max_deg'] == pytest.approx(0.002)
    assert report['el_max_deg'] == 0
    assert report['sky_max_deg'] == pytest.approx(0.002)
    assert report['az_max_utc'] == '1970-01-01T00:00:00Z'
