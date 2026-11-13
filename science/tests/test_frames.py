"""Known geometry for the site-centred frame and south polar map."""
import numpy as np
import pytest
from pyproj import CRS, Transformer

from truesouth.constants import MOON_RADIUS_M as R
from truesouth.frames import (unit_vector, local_basis, az_el, destination,
                              polar_stereo_forward, polar_stereo_inverse, map_scale_factor)


def test_unit_vectors_axes_and_poles():
    np.testing.assert_allclose(unit_vector([0, 0, 0, 0, 90, -90], [0, 90, 180, 270, 0, 0]),
        [[1, 0, 0], [0, 1, 0], [-1, 0, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], atol=1e-15)


@pytest.mark.parametrize('lat,lon', [(0, 0), (45, 30), (-89.2, 222), (-89.9, 359)])
def test_local_basis_orthonormal_and_right_handed(lat, lon):
    e, n, up = local_basis(lat, lon)
    np.testing.assert_allclose(np.stack((e, n, up)) @ np.stack((e, n, up)).T, np.eye(3), atol=1e-15)
    np.testing.assert_allclose(np.cross(e, n), up, atol=1e-15)


def test_polar_sites_rejected():
    for lat in [-90, 90, -89.9991, 89.9991]:
        with pytest.raises(ValueError): local_basis(lat, 0)
        with pytest.raises(ValueError): destination(lat, 0, 0, 1)
        with pytest.raises(ValueError): az_el(lat, 0, [1, 0, 0])
    local_basis([-89.999, 89.999], 0)


def test_az_el_basis_and_halfway():
    e, n, up = local_basis(-80, 40)
    az, el = az_el(-80, 40, np.stack([e, n, up, (e + n) / np.sqrt(2)]))
    np.testing.assert_allclose(az[[0, 1, 3]], [90, 0, 45], atol=1e-12)
    np.testing.assert_allclose(el, [0, 0, 90, 0], atol=1e-6)


def test_azimuth_wrap_never_returns_360():
    e, n, _ = local_basis(0, 0)
    az, _ = az_el(0, 0, n - 1e-18 * e)
    assert 0 <= az < 360
    assert az == 0


def test_destination_quarter_circles():
    np.testing.assert_allclose(destination(0, 0, 90, np.pi * R / 2), [0, 90], atol=1e-12)
    np.testing.assert_allclose(destination(-45, 0, 0, np.pi * R / 2), [45, 0], atol=1e-12)


def test_destination_short_walk_and_wrap():
    # Equator eastward: 1 degree is pi*R/180 metres, exactly on a great circle.
    np.testing.assert_allclose(destination(0, 359.5, 90, np.pi * R / 180), [0, 0.5], atol=1e-12)


def test_destination_near_south_pole():
    # Heading north along the prime meridian moves 0.5 degree of latitude.
    np.testing.assert_allclose(destination(-89.5, 0, 0, np.pi * R / 360), [-89, 0], atol=1e-11)


def test_projection_axes_and_worked_check():
    np.testing.assert_allclose(polar_stereo_forward(-90, 0), [0, 0], atol=1e-9)
    x, y = polar_stereo_forward(-80, [0, 90])
    # 2 R tan(5 degrees) = 304.0 km to the stated 0.1 km precision.
    assert abs(y[0] / 1000 - 304.0) < 0.05
    np.testing.assert_allclose([x[0], y[1]], [0, 0], atol=1e-9)
    assert y[0] > 0 and x[1] > 0


def test_projection_roundtrip_grid():
    lat, lon = np.meshgrid(np.linspace(-90, -60, 13), np.arange(0, 360, 15))
    x, y = polar_stereo_forward(lat, lon)
    lat2, lon2 = polar_stereo_inverse(x, y)
    np.testing.assert_allclose(lat2, lat, atol=1e-12)
    # Longitude is undefined at the pole.
    np.testing.assert_allclose(lon2[lat != -90], lon[lat != -90], atol=1e-12)


def test_scale_factor_quoted_values():
    np.testing.assert_allclose(map_scale_factor([-90, -80, -60]), [1.000, 1.008, 1.072], atol=0.0005)


def _projection_grid():
    lat, lon = np.meshgrid(np.linspace(-90, -60, 31), np.arange(0, 360, 10))
    geographic = CRS.from_proj4(f'+proj=longlat +R={R} +no_defs')
    projected = CRS.from_proj4(f'+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +R={R} +units=m +no_defs')
    return lat, lon, Transformer.from_crs(geographic, projected, always_xy=True), Transformer.from_crs(projected, geographic, always_xy=True)


def test_g3_forward_matches_pyproj():
    lat, lon, forward, _ = _projection_grid()
    x, y = polar_stereo_forward(lat, lon)
    px, py = forward.transform(lon, lat)
    assert np.max(np.hypot(x - px, y - py)) <= 0.01


def test_g3_inverse_matches_pyproj():
    lat, lon, forward, inverse = _projection_grid()
    x, y = forward.transform(lon, lat)
    actual_lat, actual_lon = polar_stereo_inverse(x, y)
    ref_lon, ref_lat = inverse.transform(x, y)
    # Compare inverse results in metres, including longitude convergence at the pole.
    ax, ay = forward.transform(actual_lon, actual_lat)
    rx, ry = forward.transform(ref_lon, ref_lat)
    assert np.max(np.hypot(ax - rx, ay - ry)) <= 0.01


def test_array_inputs_match_scalar_inputs():
    lat = np.array([-85., -70.]); lon = np.array([20., 230.])
    for f, args in [(unit_vector, (lat, lon)), (local_basis, (lat, lon)),
                    (destination, (lat, lon, np.array([10., 300.]), np.array([100., 200.]))),
                    (polar_stereo_forward, (lat, lon)), (polar_stereo_inverse, (lat * 1000, lon * 1000)),
                    (map_scale_factor, (lat,))]:
        vector = f(*args)
        scalar = [f(*(a[i] for a in args)) for i in range(2)]
        if isinstance(vector, tuple):
            for j, component in enumerate(vector): np.testing.assert_allclose(component, [s[j] for s in scalar], atol=1e-12)
        else: np.testing.assert_allclose(vector, scalar, atol=1e-12)
    directions = unit_vector(lat, lon)
    az, el = az_el(lat, lon, directions)
    for i in range(2): np.testing.assert_allclose([az[i], el[i]], az_el(lat[i], lon[i], directions[i]), atol=1e-12)


def test_local_basis_known_vectors():
    # At latitude 0, longitude 0 the site is on the +x axis: east is +y and north is +z.
    # Written out here, not derived from local_basis, so flipping both signs would fail.
    e, n, up = local_basis(0, 0)
    np.testing.assert_allclose(e, [0, 1, 0], atol=1e-15)
    np.testing.assert_allclose(n, [0, 0, 1], atol=1e-15)
    np.testing.assert_allclose(up, [1, 0, 0], atol=1e-15)
    # One degree from the south pole on longitude 0: up is almost -z, and north, which
    # points away from the south pole along the meridian, is almost +x.
    e, n, up = local_basis(-89, 0)
    np.testing.assert_allclose(e, [0, 1, 0], atol=1e-15)
    assert n[0] > 0.99 and n[2] > 0 and up[2] < -0.99


def test_straight_up_has_azimuth_zero():
    for lat, lon in [(-89.5, 222.6), (-85, 20), (0, 0)]:
        _, _, up = local_basis(lat, lon)
        az, el = az_el(lat, lon, up)
        assert az == 0
        np.testing.assert_allclose(el, 90, atol=1e-6)
        az, el = az_el(lat, lon, -up)
        assert az == 0
        np.testing.assert_allclose(el, -90, atol=1e-6)
