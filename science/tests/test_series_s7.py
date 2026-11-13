"""Series geometry from constructed Moon-fixed body positions, not real data."""

import numpy as np
import pytest

from truesouth.constants import MOON_RADIUS_M, OBSERVER_HEIGHT_M
from truesouth.series import build_series, encode_series, decode_series


def synthetic_ephemeris(ground=4321.):
    # Site (0, 0): up=+x, east=+y, north=+z. Place each body at a
    # chosen topocentric distance in these local directions, then express
    # its Moon-centred position as the global ephemeris's lat/lon/range.
    az = np.array([0., 45, 90, 120, 150, 180, 220, 270, 315, 359.9, .1])
    el = np.array([2., -2, 2, 2, 2, 2, -.1, 45, -45, .1, 0])
    result = {}
    for body, distance in [('sun', 150_000_000.), ('earth', 380_000.)]:
        a, e = np.deg2rad(az), np.deg2rad(el)
        xyz = distance * np.stack([np.sin(e), np.cos(e)*np.sin(a), np.cos(e)*np.cos(a)], axis=-1)
        xyz[:, 0] += (MOON_RADIUS_M + ground + OBSERVER_HEIGHT_M) / 1000
        norm = np.linalg.norm(xyz, axis=-1)
        prefix = 'subsolar' if body == 'sun' else 'subearth'
        result[prefix+'_lat'] = np.rad2deg(np.arcsin(xyz[:, 2] / norm))
        result[prefix+'_lon'] = np.rad2deg(np.arctan2(xyz[:, 1], xyz[:, 0])) % 360
        result[body+'_dist_km'] = norm
    return result, az, el


def test_flat_skyline_all_columns_and_mean_radii():
    global_data, az, el = synthetic_ephemeris()
    result = build_series(0., 0., 4321., np.zeros(1440), global_data)
    for body, radius, distance in [('sun', 695700., 150_000_000.), ('earth', 6378.137, 380_000.)]:
        rho = np.rad2deg(np.arcsin(radius / distance))
        d = np.clip(-el/rho, -1, 1)
        expected = (np.arccos(d) - d*np.sqrt(1-d*d))/np.pi
        np.testing.assert_allclose(result.columns[body+'_az'], az, atol=1e-10)
        np.testing.assert_allclose(result.columns[body+'_el'], el, atol=1e-10)
        np.testing.assert_allclose(result.columns[body+'_clear'], el, atol=1e-10)
        np.testing.assert_allclose(result.columns[body+'_frac'], expected, atol=.005)
        assert getattr(result, body+'_radius_deg') == pytest.approx(rho, abs=1e-12)
    decoded = decode_series(encode_series(result.columns), len(az))
    for name, values in result.columns.items():
        limit = .00005 if name.endswith('_frac') else .005
        assert np.max(np.abs(decoded[name]-values)) <= limit + 1e-12


def test_wall_hides_predicted_hours_and_clearance_interpolates():
    global_data, az, el = synthetic_ephemeris()
    skyline = np.zeros(1440)
    skyline[360:721] = 5.  # Wall from 90° to 180°, with linear edge ramps.
    result = build_series(0., 0., 4321., skyline, global_data)
    # Three centres are well inside the wall and their whole Sun discs
    # lie below 5°. At 45° the Sun is below the flat horizon as well.
    np.testing.assert_array_equal(result.columns['sun_frac'][[1, 3, 4]], 0)
    np.testing.assert_array_equal(result.columns['sun_frac'][[0, 7]], 1)
    for body in ('sun', 'earth'):
        # Independent periodic interpolation using numpy's xp period.
        horizon = np.interp(result.columns[body+'_az'], np.arange(1440)/4,
                            skyline, period=360)
        np.testing.assert_allclose(result.columns[body+'_clear'], el - horizon, atol=1e-10)


def test_encoder_rejects_impossible_elevation_instead_of_clipping():
    data, _, _ = synthetic_ephemeris()
    columns = build_series(0, 0, 4321, np.zeros(1440), data).columns
    columns['sun_el'][0] = 400
    with pytest.raises(ValueError, match='sun_el outside Int16'):
        encode_series(columns)


def test_series_preserves_hourly_radius_changes():
    data, _, _ = synthetic_ephemeris(ground=0)
    # Move both bodies to the horizontal, then vary their distance. With a
    # flat skyline offset, the larger apparent disc exposes more area.
    for body, prefix in [('sun', 'subsolar'), ('earth', 'subearth')]:
        data[prefix+'_lat'][:] = 0
        data[prefix+'_lon'][:] = 90
        data[body+'_dist_km'] = np.linspace(1, 2, 11) * data[body+'_dist_km'][0]
    columns = build_series(0, 0, 0, np.full(1440, .1), data).columns
    assert np.all(np.diff(columns['sun_frac']) < 0)
    assert np.all(np.diff(columns['earth_frac']) < 0)


def test_clearance_interpolates_between_bins():
    # A skyline that alternates 0 and 2 degrees from bin to bin, so every point between two
    # bin centres has a different value from its nearest bin. Two of the synthetic hours sit
    # off the bin centres: azimuth 359.9 is 0.6 of the way from bin 1439 (2 degrees) to
    # bin 0 (0 degrees), so the skyline there is 0.8; azimuth 0.1 is 0.4 of the way from
    # bin 0 (0 degrees) to bin 1 (2 degrees), so it is 0.8 as well. The nearest bin to both
    # is bin 0, which would give 0. The expected values are worked out by hand here, not by
    # calling an interpolation routine.
    global_data, az, el = synthetic_ephemeris()
    skyline = (np.arange(1440) % 2) * 2.
    result = build_series(0., 0., 4321., skyline, global_data)
    assert az[9] == 359.9 and az[10] == .1
    for body in ('sun', 'earth'):
        clear = result.columns[body+'_clear']
        np.testing.assert_allclose(clear[9], el[9] - .8, atol=1e-9)
        np.testing.assert_allclose(clear[10], el[10] - .8, atol=1e-9)
        # On a bin centre the skyline is the bin's own value: 0 at azimuth 0 (bin 0) and at
        # azimuth 90 (bin 360).
        np.testing.assert_allclose(clear[[0, 2]], el[[0, 2]], atol=1e-9)
