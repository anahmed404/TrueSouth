"""Synthetic geometry only; no downloads or prepared lunar maps required."""

import json

import numpy as np
import pytest

from truesouth.constants import MOON_RADIUS_M as R, OBSERVER_HEIGHT_M as H
from truesouth.dem import DemStore
from truesouth.frames import destination, polar_stereo_forward
from truesouth.skyline import compute_skyline, elevation_angle, interpolate_skyline


def prepared(tmp_path, name, data, centre, pixel=80):
    """Write the same array/sidecar interface used by PreparedMap, at pixel centres."""
    x, y = polar_stereo_forward(*centre)
    path = tmp_path / f"{name}.npy"
    np.save(path, np.asarray(data, dtype=np.float32))
    path.with_suffix('.json').write_text(json.dumps(dict(
        origin_x=float(x - data.shape[1] * pixel / 2),
        origin_y=float(y + data.shape[0] * pixel / 2),
        pixel_x=pixel, pixel_y=-pixel)), encoding='utf-8')
    return path


def exact(distance, height, ground=0):
    # Section 4: vertical and horizontal components of the straight sight-line.
    gamma = distance / R
    return np.degrees(np.arctan2((R + height) * np.cos(gamma) - (R + ground + H),
                                (R + height) * np.sin(gamma)))


def test_elevation_angle_vectorised():
    # 20 km: curvature costs 115.1 m; a 200 m wall is still above horizontal.
    distances = np.array([4000., 20000., 60000.])
    expected = exact(distances, np.array([100., 200., 3000.]), ground=50)
    np.testing.assert_allclose(elevation_angle(distances, [100, 200, 3000], 50), expected,
                               atol=1e-10)


def test_g4_flat_sphere(tmp_path):
    site = (-89., 0.)
    store = DemStore(prepared(tmp_path, 'flat', np.zeros((151, 151)), site))
    result = compute_skyline(store, *site)
    # Tangency from radius R+2 to radius R gives dip acos(R/(R+2)).
    expected = -np.degrees(np.arccos(R / (R + H)))
    error = float(np.max(np.abs(result.el_deg - expected)))
    print(f'G4 max error: {error:.12g} deg')
    assert error <= .001
    assert np.isfinite(result.dist_km).all()


def wall_store(tmp_path, site, azimuth, distance, height, pixel=240, plateau=False):
    point = destination(*site, azimuth, distance)
    peak = np.zeros((3, 3))
    peak[1, 1] = height
    if plateau:
        peak[:] = height
    core = prepared(tmp_path, f'site_{distance}', np.zeros((11, 11)), site)
    wide = prepared(tmp_path, f'wall_{distance}', peak, point, pixel)
    return DemStore(core, wide), point


@pytest.mark.parametrize('distance,height,method', [(4000., 100., 'near'), (60000., 3000., 'far')])
def test_g5_wall_and_blocker(tmp_path, distance, height, method):
    site = (-89., 0.)
    store, point = wall_store(tmp_path, site, 0, distance, height)
    result = compute_skyline(store, *site)
    error = abs(result.el_deg[0] - exact(distance, height))
    print(f'G5 {method} error: {error:.12g} deg')
    assert error <= .001
    assert result.method[0] == method
    assert result.dist_km[0] == pytest.approx(distance / 1000, abs=1e-7)
    assert result.lat_deg[0] == pytest.approx(point[0], abs=1e-8)
    assert result.lon_deg[0] == pytest.approx(point[1], abs=1e-8)
    assert result.height_m[0] == pytest.approx(height, abs=1e-5)


@pytest.mark.parametrize('pixel', [80, 240])
def test_g6_switch_both_methods(tmp_path, pixel):
    site = (-89., 0.)
    # The same pixel lies exactly at the 1,440-bin switch. With 720 bins,
    # its angular width is smaller than a bin and every-pixel evaluation applies.
    distance = pixel / np.tan(np.radians(.25))
    point = destination(*site, 0, distance)
    peak = np.zeros((3, 3))
    peak[1, 1] = 1000
    peak_path = prepared(tmp_path, 'peak', peak, point, pixel)
    ground_path = prepared(tmp_path, 'ground', np.zeros((11, 11)), site,
                           240 if pixel == 80 else 80)
    store = DemStore(peak_path, ground_path) if pixel == 80 else DemStore(ground_path, peak_path)
    near = compute_skyline(store, *site)
    far = compute_skyline(store, *site, bins=720)
    error = abs(near.el_deg[0] - far.el_deg[0])
    print(f'G6 {pixel} m switch error: {error:.12g} deg')
    assert near.method[0] == 'near'
    assert far.method[0] == 'far'
    assert error <= .02
    assert abs(near.el_deg[0] - exact(distance, 1000)) <= .001


@pytest.mark.parametrize('site', [(-89.4, 222.), (-65., 73.)])
@pytest.mark.parametrize('azimuth,bin_index', [(0., 0), (90., 360), (359.8, 1439), (23.12, 92)])
def test_single_far_pixel_local_frame(tmp_path, site, azimuth, bin_index):
    # One 240 m peak at 100 km subtends 0.138 degrees; rays 0.25 degrees apart
    # can miss it. At 23.12 degrees it lies between the bin centres.
    store, point = wall_store(tmp_path, site, azimuth, 100000, 10000)
    result = compute_skyline(store, *site)
    assert np.argmax(result.el_deg) == bin_index
    assert result.method[bin_index] == 'far'
    assert result.height_m[bin_index] == 10000
    assert result.dist_km[bin_index] == pytest.approx(100)
    assert result.lat_deg[bin_index] == pytest.approx(point[0])
    assert result.lon_deg[bin_index] == pytest.approx(point[1])


def test_interpolation_wraps():
    skyline = np.zeros(1440)
    skyline[-1], skyline[0], skyline[1] = 2, 4, 8
    np.testing.assert_allclose(interpolate_skyline(skyline, [-.125, 359.875, 360, .125]),
                               [3, 3, 4, 6])
    assert interpolate_skyline(skyline, 720) == 4


def test_range_limit_and_curvature(tmp_path):
    site = (-89., 0.)
    store, _ = wall_store(tmp_path, site, 0, 301000, 30000)
    beyond = compute_skyline(store, *site)
    assert np.nanmax(beyond.height_m) == 0
    # A zero-height pixel 100 km away drops 2,877 m below the tangent, so
    # its elevation is about -1.65 degrees, below the nearby flat terrain.
    store, _ = wall_store(tmp_path, site, 0, 100000, 0)
    below = compute_skyline(store, *site)
    assert below.method[0] == 'near'
    assert below.dist_km[0] < 1
    assert below.max_range_km == 300


@pytest.mark.parametrize('distance', [4000., 30000., 60000.])
def test_ray_continues_on_wide_map(tmp_path, distance):
    site = (-89., 0.)
    # Core ends at 400 m. The 30 km wall is beyond the core switch but before
    # the wide switch: it MUST still use rays. At 60 km every pixel is used.
    # Wide lattice starts at 40 m; choose a plateau so the 30 km peak is sampled.
    store, point = wall_store(tmp_path, site, 0, distance, 3000, plateau=distance == 30000)
    result = compute_skyline(store, *site)
    assert result.height_m[0] == pytest.approx(3000, abs=1e-5)
    assert result.method[0] == ('near' if distance < 55000 else 'far')
    assert abs(result.dist_km[0] * 1000 - distance) < 300


def test_missing_skipped_and_missing_site_rejected(tmp_path):
    site = (-89., 0.)
    data = np.zeros((151, 151))
    data[20:30, 70:80] = np.nan
    store = DemStore(prepared(tmp_path, 'missing', data, site))
    result = compute_skyline(store, *site)
    assert result.missing_samples > 0
    heights, missing = store.sample(result.lat_deg, result.lon_deg)
    assert missing == 0
    np.testing.assert_allclose(heights, result.height_m)
    data[75, 75] = np.nan
    store = DemStore(prepared(tmp_path, 'missing_site', data, site))
    with pytest.raises(ValueError, match='site.*missing'):
        compute_skyline(store, *site)


def test_sphere_tier_and_empty_bins(tmp_path):
    site = (-89., 0.)
    store = DemStore(prepared(tmp_path, 'elsewhere', np.zeros((3, 3)), (-85., 0.)))
    result = compute_skyline(store, *site)
    expected = -np.degrees(np.arccos(R / (R + H)))
    np.testing.assert_allclose(result.el_deg, expected)
    assert np.isnan(result.arrays[1:]).all()
    assert result.meta.bins == 1440
    # A map covering only the observer offers no terrain at s >= 40 m.
    tiny = DemStore(prepared(tmp_path, 'tiny', np.zeros((3, 3)), site, 10))
    result = compute_skyline(tiny, *site)
    np.testing.assert_allclose(result.el_deg, expected)
    assert np.isnan(result.arrays[1:]).all()


def test_r5_smooth_terrain_and_chunk_invariance(tmp_path):
    site = (-89., 0.)
    rows, cols = np.indices((151, 151))
    # Smooth 0.5% tilted plane, independently specified in map metres.
    data = .005 * (cols - 75) * 80
    store = DemStore(prepared(tmp_path, 'plane', data, site))
    coarse = compute_skyline(store, *site, chunk_size=50000)
    fine = compute_skyline(store, *site, bins=2880, step_scale=.5, chunk_size=70000)
    assert np.sqrt(np.mean((fine.el_deg[::2] - coarse.el_deg) ** 2)) < .05
    again = compute_skyline(store, *site, chunk_size=90000)
    np.testing.assert_allclose(again.arrays, coarse.arrays, equal_nan=True)


def test_contiguous_maps_at_core_edge(tmp_path):
    site = (-89., 0.)
    core = prepared(tmp_path, 'core', np.zeros((11, 11)), site)
    wide_heights = np.zeros((501, 51))
    # North is +y here. Rows 124..126 are about 30 km north of the observer.
    # A three-row plateau crosses a ray sample exactly, avoiding a grid-phase
    # assumption. It is past the 80 m switch and before the 240 m switch.
    wide_heights[124:127, :] = 3000
    wide = prepared(tmp_path, 'wide', wide_heights, site, 240)
    result = compute_skyline(DemStore(core, wide), *site)
    assert result.method[0] == 'near'
    assert result.height_m[0] == pytest.approx(3000)
    assert 29 < result.dist_km[0] < 31


def test_far_missing_pixel_and_chunk_invariance(tmp_path):
    site = (-89., 0.)
    point = destination(*site, 90, 100000)
    core = prepared(tmp_path, 'ground', np.zeros((11, 11)), site)
    pixels = np.zeros((5, 5))
    pixels[2, 2] = np.nan
    pixels[2, 3] = 10000
    wide = prepared(tmp_path, 'far_missing', pixels, point, 240)
    store = DemStore(core, wide)
    small = compute_skyline(store, *site, chunk_size=50000)
    large = compute_skyline(store, *site, chunk_size=100000)
    np.testing.assert_allclose(small.arrays, large.arrays, equal_nan=True)
    assert small.missing_samples == large.missing_samples
    assert small.missing_samples > 0
    assert small.method[np.argmax(small.el_deg)] == 'far'
    assert small.height_m[np.argmax(small.el_deg)] == 10000
