"""Gate G8 and the two slope methods. Synthetic terrain only; no NASA files."""

import json

import numpy as np
import pytest

from truesouth.constants import MOON_RADIUS_M as R
from truesouth.dem import PreparedMap
from truesouth.frames import (local_basis, map_scale_factor, polar_stereo_forward,
                              polar_stereo_inverse, unit_vector)
from truesouth.slope import closeup_slope, polar_slope

NEAR_POLE = (-89.9, 222.6192)
FIVE_DEG = (-85.0, 29.1957)
SHAPE = (11, 11)


def prepared(tmp_path, name, data, centre, pixel=80, source='synthetic polar DEM'):
    """Same array and sidecar PreparedMap reads. Pixel centres follow dem.py."""
    x, y = polar_stereo_forward(*centre)
    path = tmp_path / f'{name}.npy'
    array = np.asarray(data, dtype=np.float32)
    np.save(path, array)
    meta = dict(
        origin_x=float(x - array.shape[1] * pixel / 2),
        origin_y=float(y + array.shape[0] * pixel / 2),
        pixel_x=pixel, pixel_y=-pixel, source=source)
    path.with_suffix('.json').write_text(json.dumps(meta), encoding='utf-8', newline='\n')
    return path


def pixel_centres(shape, centre, pixel):
    rows, cols = shape
    x0, y0 = polar_stereo_forward(*centre)
    origin_x = float(np.asarray(x0) - cols * pixel / 2)
    origin_y = float(np.asarray(y0) + rows * pixel / 2)
    rr, cc = np.indices(shape)
    x = origin_x + (cc + 0.5) * pixel
    y = origin_y + (rr + 0.5) * (-pixel)
    return x, y, float(np.asarray(x0)), float(np.asarray(y0))


def tilted_plane(shape, centre, pixel, tilt_deg, azimuth_deg, z0=0.0):
    """A plane whose map gradient is tan(tilt) / k, so §8 returns ``tilt_deg``.

    The run is in map metres along the local azimuth. Multiplying the central
    differences by k(latitude) cancels that factor.
    """
    x, y, x0, y0 = pixel_centres(shape, centre, pixel)
    lon = np.deg2rad(centre[1])
    north = np.array([np.sin(lon), np.cos(lon)])
    east = np.array([np.cos(lon), -np.sin(lon)])
    azimuth = np.deg2rad(azimuth_deg)
    direction = np.sin(azimuth) * east + np.cos(azimuth) * north
    run = (x - x0) * direction[0] + (y - y0) * direction[1]
    scale = float(np.asarray(map_scale_factor(centre[0])))
    return z0 + np.tan(np.deg2rad(tilt_deg)) / scale * run


def _tag(kind, site, pixel, tilt, azimuth, z0):
    raw = f'{kind}_{site[0]}_{site[1]}_{pixel}_{tilt}_{azimuth}_{z0}'
    return raw.replace('-', 'm').replace('.', 'p')


def polar_on_plane(tmp_path, site, pixel, tilt_deg, azimuth_deg, z0=0.0):
    data = tilted_plane(SHAPE, site, pixel, tilt_deg, azimuth_deg, z0)
    path = prepared(tmp_path, _tag('plane', site, pixel, tilt_deg, azimuth_deg, z0), data, site, pixel)
    return polar_slope(PreparedMap(path), *site)


def closeup_plane(site, tilt_deg, azimuth_deg, z0=0.0, pixel=5.0):
    """5 m pixel centres around ``site``, with a plane written in local metres."""
    shape = (29, 29)
    x, y, _, _ = pixel_centres(shape, site, pixel)
    lat, lon = polar_stereo_inverse(x, y)
    east_hat, north_hat, _ = local_basis(*site)
    point = unit_vector(lat, lon)
    east = R * np.sum(point * east_hat, axis=-1)
    north = R * np.sum(point * north_hat, axis=-1)
    azimuth = np.deg2rad(azimuth_deg)
    run = east * np.sin(azimuth) + north * np.cos(azimuth)
    return east, north, z0 + np.tan(np.deg2rad(tilt_deg)) * run


def test_g8_polar_ten_degree_plane(tmp_path):
    worst = 0.0
    for pixel in (80, 240):
        for site in (NEAR_POLE, FIVE_DEG):
            for azimuth in (0.0, 90.0, 45.0):
                result = polar_on_plane(tmp_path, site, pixel, 10.0, azimuth)
                error = abs(result.deg - 10.0)
                worst = max(worst, error)
                assert error <= 0.001, (pixel, site, azimuth, result.deg)
                assert result.baseline_m == pytest.approx(2 * pixel)
                assert result.source == 'synthetic polar DEM, central difference'
    print(f'G8 polar max error: {worst:.12g} deg')


def test_polar_flat_thirty_height_and_sign(tmp_path):
    for pixel in (80, 240):
        for site in (NEAR_POLE, FIVE_DEG):
            flat = polar_on_plane(tmp_path, site, pixel, 0.0, 0.0, z0=1200.0)
            assert flat.deg == pytest.approx(0.0, abs=0.001)
            steep = polar_on_plane(tmp_path, site, pixel, 30.0, 45.0)
            assert steep.deg == pytest.approx(30.0, abs=0.001)
            south = polar_on_plane(tmp_path, site, pixel, 10.0, 180.0)
            assert south.deg == pytest.approx(10.0, abs=0.001)
            errors = []
            for z0 in (0.0, 4000.0, -2800.0):
                result = polar_on_plane(tmp_path, site, pixel, 10.0, 90.0, z0)
                assert result.deg == pytest.approx(10.0, abs=0.001)
                errors.append(result.deg)
            assert max(errors) - min(errors) <= 0.001


def test_polar_missing_terrain_is_not_assessed(tmp_path):
    site = NEAR_POLE
    data = tilted_plane(SHAPE, site, 80, 10.0, 0.0)
    whole = polar_slope(PreparedMap(prepared(tmp_path, 'whole', data, site, 80)), *site)
    assert whole.deg == pytest.approx(10.0, abs=0.001)
    row, col = PreparedMap(prepared(tmp_path, 'probe', data, site, 80)).coordinates(*site)
    r, c = int(np.rint(float(row))), int(np.rint(float(col)))
    for label, index in (('neighbour', (r, c + 1)), ('site', (r, c))):
        punched = data.copy()
        punched[index] = np.nan
        result = polar_slope(PreparedMap(prepared(tmp_path, label, punched, site, 80)), *site)
        assert result is None


def test_polar_sphere_tier_and_off_map_are_not_assessed(tmp_path):
    data = tilted_plane(SHAPE, (-50.0, 10.0), 240, 10.0, 0.0)
    assert polar_slope(PreparedMap(prepared(tmp_path, 'sphere', data, (-50.0, 10.0), 240)), -50.0, 10.0) is None
    # A wide-tier site on a 240 m map is assessed. Sphere handling must not swallow it.
    wide = polar_on_plane(tmp_path, (-70.0, 10.0), 240, 10.0, 0.0)
    assert wide.deg == pytest.approx(10.0, abs=0.001)
    assert wide.baseline_m == pytest.approx(480.0)
    corner = (-89.0, 0.0)
    path = prepared(tmp_path, 'edge', np.zeros(SHAPE), corner, 80)
    terrain = PreparedMap(path)
    x, y, _, _ = pixel_centres(SHAPE, corner, 80)
    lat, lon = polar_stereo_inverse(x[0, 0], y[0, 0])
    assert polar_slope(terrain, float(lat), float(lon)) is None


def test_g8_closeup_ten_degree_plane():
    worst = 0.0
    for site in (NEAR_POLE, FIVE_DEG):
        for azimuth in (0.0, 90.0, 45.0):
            east, north, height = closeup_plane(site, 10.0, azimuth)
            result = closeup_slope(east, north, height)
            error = abs(result.deg - 10.0)
            worst = max(worst, error)
            assert error <= 0.001, (site, azimuth, result.deg)
            assert result.baseline_m == pytest.approx(100.0)
            assert result.source == 'close-up DEM, plane fit'
    print(f'G8 close-up max error: {worst:.12g} deg')


def test_closeup_flat_thirty_and_height():
    for azimuth in (0.0, 90.0, 45.0):
        east, north, flat = closeup_plane(FIVE_DEG, 0.0, azimuth, z0=-500.0)
        assert closeup_slope(east, north, flat).deg == pytest.approx(0.0, abs=0.001)
        east, north, steep = closeup_plane(NEAR_POLE, 30.0, azimuth)
        assert closeup_slope(east, north, steep).deg == pytest.approx(30.0, abs=0.001)
        shifts = []
        for z0 in (0.0, 4000.0, -2800.0):
            east, north, height = closeup_plane(FIVE_DEG, 10.0, azimuth, z0=z0)
            result = closeup_slope(east, north, height)
            assert result.deg == pytest.approx(10.0, abs=0.001)
            shifts.append(result.deg)
        assert max(shifts) - min(shifts) <= 0.001


def test_closeup_missing_pixels_and_radius():
    east, north, height = closeup_plane(NEAR_POLE, 10.0, 45.0)
    punched = height.copy()
    punched[::2, ::3] = np.nan
    assert closeup_slope(east, north, punched).deg == pytest.approx(10.0, abs=0.001)
    # A cliff outside 50 m must not move the fit. One exactly at 50 m still counts.
    east = np.array([0.0, 10.0, 0.0, 0.0])
    north = np.array([0.0, 0.0, 50.0, 80.0])
    height = np.array([0.0, 0.0, 5.0, 5000.0])
    with_boundary = closeup_slope(east, north, height)
    assert with_boundary is not None
    height_inside = height.copy()
    height_inside[3] = 0.0
    assert closeup_slope(east, north, height_inside).deg == pytest.approx(with_boundary.deg, abs=1e-9)
    north_out = north.copy()
    north_out[2] = 50.001
    assert closeup_slope(east, north_out, height) is None


def test_closeup_too_few_or_collinear_is_not_assessed():
    assert closeup_slope([], [], []) is None
    assert closeup_slope([0.0, 5.0], [0.0, 0.0], [1.0, 2.0]) is None
    assert closeup_slope([0.0, 5.0, -5.0], [0.0, 0.0, 0.0], [0.0, 1.0, -1.0]) is None
    assert closeup_slope([0.0, 1.0, 2.0], [0.0, 1.0, 2.0], [np.nan, np.nan, np.nan]) is None
    # Three non-collinear pixels determine a plane.
    result = closeup_slope([0.0, 10.0, 0.0], [0.0, 0.0, 10.0], [0.0, 1.0, 0.0])
    assert result is not None
    assert result.deg > 0.0
    assert result.baseline_m == pytest.approx(100.0)


def test_methods_agree_on_smooth_surface(tmp_path):
    """One cubic surface, sampled at 5 m and at 80 m.

    z = alpha N + delta N^3. At the site the tangent gradient is alpha.
    A central difference of half-width h sees alpha + delta h^2. A continuous
    plane fit inside radius R sees alpha + delta R^2 / 2. With h = 80 m and
    R = 50 m those two baselines disagree by a fixed angle, called the
    curvature gap below.

    The 80 m pixels do not sit at exactly ±80 m of ground north, and the 5 m
    samples are a grid rather than a disk integral. Those two shifts are
    computed from the same surface and added to the gap, plus float32 rounding
    of the stored 80 m heights. The methods may differ by at most that sum.
    """
    site = (-89.0, 0.0)
    alpha = np.tan(np.deg2rad(6.0))
    delta = 1.5e-8
    pixel = 80.0
    radius = 50.0

    def surface(north):
        return alpha * north + delta * np.asarray(north, dtype=float) ** 3

    axis = np.arange(-70.0, 70.0 + 1e-9, 5.0)
    east, north = np.meshgrid(axis, axis, indexing='xy')
    close = closeup_slope(east, north, surface(north))
    mask = np.hypot(east, north) <= radius
    coeff, _, rank, _ = np.linalg.lstsq(
        np.column_stack((east[mask], north[mask], np.ones(int(np.count_nonzero(mask))))),
        surface(north[mask]), rcond=None)
    assert rank == 3
    predicted_close = float(np.degrees(np.arctan(np.hypot(coeff[0], coeff[1]))))

    def local_north(lat, lon):
        _, north_hat, _ = local_basis(*site)
        return float(R * np.sum(unit_vector(lat, lon) * north_hat))

    x0, y0 = (float(np.asarray(v)) for v in polar_stereo_forward(*site))

    def height_at(dx, dy):
        lat, lon = polar_stereo_inverse(x0 + dx, y0 + dy)
        return float(surface(local_north(lat, lon)))

    z_east, z_west = height_at(pixel, 0.0), height_at(-pixel, 0.0)
    z_north, z_south = height_at(0.0, pixel), height_at(0.0, -pixel)
    scale = float(np.asarray(map_scale_factor(site[0])))
    g_x = (z_east - z_west) / (2.0 * pixel)
    g_y = (z_north - z_south) / (2.0 * pixel)
    predicted_polar = float(np.degrees(np.arctan(scale * np.hypot(g_x, g_y))))

    lat, lon = polar_stereo_inverse(*pixel_centres(SHAPE, site, pixel)[:2])
    _, north_hat, _ = local_basis(*site)
    point = unit_vector(lat, lon)
    painted = surface(R * np.sum(point * north_hat, axis=-1))
    measured_polar = polar_slope(PreparedMap(prepared(tmp_path, 'curve', painted, site, pixel)), *site)

    curvature_gap = abs(np.degrees(np.arctan(alpha + delta * pixel ** 2))
                        - np.degrees(np.arctan(alpha + delta * radius ** 2 / 2.0)))
    projection_shift = abs(predicted_polar - np.degrees(np.arctan(alpha + delta * pixel ** 2)))
    grid_shift = abs(predicted_close - np.degrees(np.arctan(alpha + delta * radius ** 2 / 2.0)))
    neighbour_height = abs(alpha) * pixel + abs(delta) * pixel ** 3
    rounding = float(np.degrees(np.spacing(np.float32(neighbour_height)) / pixel))
    bound = curvature_gap + projection_shift + grid_shift + rounding
    gap = abs(measured_polar.deg - close.deg)
    print(
        f'curved-surface gap: measured {gap:.12g} deg, bound {bound:.12g} deg '
        f'(curvature {curvature_gap:.12g}, projection {projection_shift:.12g}, '
        f'grid {grid_shift:.12g}, rounding {rounding:.12g})')
    assert curvature_gap > 0.002
    assert measured_polar.deg == pytest.approx(predicted_polar, abs=1e-4)
    assert close.deg == pytest.approx(predicted_close, abs=1e-8)
    assert gap <= bound
    assert measured_polar.baseline_m == pytest.approx(160.0)
    assert close.baseline_m == pytest.approx(100.0)
