"""Terrain and close-up meshes from synthetic maps. No NASA files."""

import json

import numpy as np
import pytest

from truesouth.constants import MOON_RADIUS_M as R
from truesouth.dem import DemStore, PreparedMap, site_tier
from truesouth.derived_io import read_terrain, write_terrain
from truesouth.frames import destination, polar_stereo_forward
from truesouth.terrain_mesh import closeup_mesh, terrain_mesh


def prepared(tmp_path, name, data, centre, pixel=80):
    x, y = polar_stereo_forward(*centre)
    path = tmp_path / f'{name}.npy'
    array = np.asarray(data, dtype=np.float32)
    np.save(path, array)
    meta = dict(
        origin_x=float(np.asarray(x) - array.shape[1] * pixel / 2),
        origin_y=float(np.asarray(y) + array.shape[0] * pixel / 2),
        pixel_x=pixel, pixel_y=-pixel)
    path.with_suffix('.json').write_text(json.dumps(meta), encoding='utf-8', newline='\n')
    return path


def offsets(size, window_km):
    half_m = window_km * 1000.0 / 2.0
    step = np.arange(size, dtype=float)
    span = size - 1
    east = half_m * (-1.0 + 2.0 * step / span)
    north = half_m * (1.0 - 2.0 * step / span)
    return east, north


def test_peak_lands_on_the_predicted_vertex(tmp_path):
    site = (-89.2, 40.0)
    size, window_km = 33, 20.0
    row, col = 10, 20
    east, north = offsets(size, window_km)
    azimuth = float(np.degrees(np.arctan2(east[col], north[row])))
    distance = float(np.hypot(east[col], north[row]))
    lat, lon = destination(*site, azimuth, distance)
    lat, lon = float(np.asarray(lat)), float(np.asarray(lon))
    peak = np.zeros((3, 3))
    peak[1, 1] = 800.0
    core = prepared(tmp_path, 'peak', peak, (lat, lon), pixel=10)
    wide = prepared(tmp_path, 'ground', np.zeros((9, 9)), site, pixel=80)
    mesh = terrain_mesh(DemStore(core, wide), *site, size=size, window_km=window_km)
    assert int(np.nanargmax(mesh.height_m)) == row * size + col
    assert mesh.height_m[row, col] == pytest.approx(800.0)
    # The three wrong orientations must not also contain the peak.
    assert not np.isclose(mesh.height_m[col, row], 800.0, equal_nan=False)
    assert not np.isclose(mesh.height_m[size - 1 - row, col], 800.0, equal_nan=False)
    assert not np.isclose(mesh.height_m[row, size - 1 - col], 800.0, equal_nan=False)


def test_row_zero_is_north_and_column_zero_is_west(tmp_path):
    site = (-89.4, 12.0)
    store = DemStore(prepared(tmp_path, 'flat', np.full((51, 51), 500.0), site, pixel=50))
    mesh = terrain_mesh(store, *site, size=17, window_km=2.0)
    centre = mesh.size // 2
    assert mesh.north_km[0, centre] > 0
    assert mesh.north_km[-1, centre] < 0
    assert mesh.north_km[0, centre] > mesh.north_km[-1, centre]
    assert mesh.east_km[centre, 0] < 0
    assert mesh.east_km[centre, -1] > 0
    assert mesh.east_km[centre, 0] < mesh.east_km[centre, -1]
    assert mesh.up_km[centre, centre] == pytest.approx(0.0, abs=1e-9)
    assert mesh.site_height_m == pytest.approx(500.0)


def test_heights_match_sample_and_curvature_uses_site_height(tmp_path):
    site = (-89.4, 12.0)
    z0 = 500.0
    store = DemStore(prepared(tmp_path, 'flat', np.full((51, 51), z0), site, pixel=50))
    size, window_km = 17, 2.0
    mesh = terrain_mesh(store, *site, size=size, window_km=window_km)
    sampled, missing = store.sample(mesh.lat_deg, mesh.lon_deg)
    np.testing.assert_allclose(mesh.height_m, sampled, equal_nan=True)
    assert mesh.missing_count == missing
    assert np.isfinite(mesh.height_m).all()
    east, north = offsets(size, window_km)
    ee, nn = np.meshgrid(east, north)
    distance = np.hypot(ee, nn)
    azimuth = np.arctan2(ee, nn)
    gamma = distance / R
    expected_up = ((R + z0) * np.cos(gamma) - (R + z0)) / 1000.0
    expected_east = (R + z0) * np.sin(gamma) * np.sin(azimuth) / 1000.0
    expected_north = (R + z0) * np.sin(gamma) * np.cos(azimuth) / 1000.0
    np.testing.assert_allclose(mesh.up_km, expected_up, atol=1e-9)
    np.testing.assert_allclose(mesh.east_km, expected_east, atol=1e-9)
    np.testing.assert_allclose(mesh.north_km, expected_north, atol=1e-9)
    # Dropping the site height out of section 13 moves the rim. It must not.
    without_site = (R * (np.cos(gamma) - 1.0)) / 1000.0
    assert np.max(np.abs(mesh.up_km - without_site)) > 1e-7
    assert np.allclose(mesh.slope_deg, 0.0, atol=1e-9)


def test_mesh_past_the_core_uses_the_wide_map_and_never_zero(tmp_path):
    site = (-88.5, 200.0)
    core = prepared(tmp_path, 'core', np.full((5, 5), 10.0), site, pixel=80)
    wide = prepared(tmp_path, 'wide', np.full((21, 21), 40.0), site, pixel=240)
    mesh = terrain_mesh(DemStore(core, wide), *site, size=17, window_km=4.0)
    centre = mesh.size // 2
    # One step is 250 m: outside the 160 m core, inside the wide map.
    assert mesh.height_m[centre, centre] == pytest.approx(10.0)
    assert mesh.height_m[centre, centre + 1] == pytest.approx(40.0)
    assert np.isnan(mesh.height_m[0, 0])
    assert np.isnan(mesh.east_km[0, 0])
    assert np.isnan(mesh.north_km[0, 0])
    assert np.isnan(mesh.up_km[0, 0])
    assert np.isnan(mesh.slope_deg[0, 0])
    assert mesh.missing_count > 0
    assert not np.any(np.nan_to_num(mesh.height_m, nan=-1.0) == 0.0)


def test_missing_map_is_nan_not_zero(tmp_path):
    site = (-89.0, 5.0)
    store = DemStore(prepared(tmp_path, 'hole', np.full((8, 8), np.nan), site, pixel=80))
    mesh = terrain_mesh(store, *site, size=9, window_km=1.0)
    assert mesh.missing_count == mesh.size * mesh.size
    assert np.isnan(mesh.height_m).all()
    assert np.isnan(mesh.slope_deg).all()
    assert np.isnan(mesh.up_km).all()
    assert np.isnan(mesh.site_height_m)
    assert not np.any(mesh.height_m == 0.0)


def test_round_trip_matches_float32(tmp_path):
    site = (-89.4, 12.0)
    store = DemStore(prepared(tmp_path, 'flat', np.full((51, 51), 500.0), site, pixel=50))
    mesh = terrain_mesh(store, *site, size=17, window_km=2.0)
    path = tmp_path / 'terrain.bin'
    write_terrain(path, mesh.arrays, mesh.size)
    restored = read_terrain(path, mesh.size)
    for name in ('east_km', 'north_km', 'up_km', 'slope_deg'):
        stored = np.asarray(mesh.arrays[name], dtype=np.float32)
        np.testing.assert_array_equal(restored[name], stored)
    assert path.stat().st_size == 4 * mesh.size * mesh.size * 4


def test_defaults_and_closeup_mesh(tmp_path):
    site = (-89.5, 15.0)
    path = prepared(tmp_path, 'close', np.full((41, 41), 12.0), site, pixel=5)
    terrain = PreparedMap(path)
    mesh = closeup_mesh(terrain, *site, size=9, window_km=0.2)
    np.testing.assert_allclose(mesh.height_m, terrain.sample(mesh.lat_deg, mesh.lon_deg), equal_nan=True)
    assert mesh.window_km == 0.2
    assert mesh.north_km[0, 4] > mesh.north_km[-1, 4]
    assert mesh.east_km[4, 0] < mesh.east_km[4, -1]
    wide = prepared(tmp_path, 'wide', np.zeros((3, 3)), site, pixel=240)
    full = terrain_mesh(DemStore(path, wide), *site)
    assert full.size == 257
    assert full.window_km == 20.0
    assert full.east_km.shape == (257, 257)
    assert full.missing_count > 0


class _TiltedPlane:
    """Heights z = 20 + 0.2 E + 0.3 N on the section 13 grid, ignoring the walk."""

    def __init__(self, size, window_km, missing=()):
        east, north = offsets(size, window_km)
        ee, nn = np.meshgrid(east, north)
        self.height = 20.0 + 0.2 * ee + 0.3 * nn
        if missing:
            self.height = self.height.copy()
            for row, col in missing:
                self.height[row, col] = np.nan

    def sample(self, lat, lon):
        lat = np.asarray(lat, dtype=float)
        if lat.ndim == 0:
            return np.float64(20.0), 0
        missing = int(np.count_nonzero(~np.isfinite(self.height)))
        return self.height, missing


def test_tilted_plane_slope_on_interior_and_rim():
    size, window_km = 9, 20.0
    mesh = terrain_mesh(_TiltedPlane(size, window_km), -89.0, 10.0, size=size, window_km=window_km)
    expected = float(np.degrees(np.arctan(np.hypot(0.2, 0.3))))
    assert expected == pytest.approx(19.827028653, abs=1e-9)
    np.testing.assert_allclose(mesh.slope_deg[1:-1, 1:-1], expected, atol=1e-9)
    np.testing.assert_allclose(mesh.slope_deg[0, :], expected, atol=1e-9)
    np.testing.assert_allclose(mesh.slope_deg[-1, :], expected, atol=1e-9)
    np.testing.assert_allclose(mesh.slope_deg[:, 0], expected, atol=1e-9)
    np.testing.assert_allclose(mesh.slope_deg[:, -1], expected, atol=1e-9)


def test_slope_is_nan_when_a_needed_height_is_missing():
    size, window_km = 9, 20.0
    mesh = terrain_mesh(_TiltedPlane(size, window_km, missing=((4, 4),)), -89.0, 10.0, size=size, window_km=window_km)
    expected = float(np.degrees(np.arctan(np.hypot(0.2, 0.3))))
    for row, col in ((4, 4), (4, 3), (4, 5), (3, 4), (5, 4)):
        assert np.isnan(mesh.slope_deg[row, col])
    assert mesh.slope_deg[1, 1] == pytest.approx(expected, abs=1e-9)
    assert mesh.slope_deg[0, 0] == pytest.approx(expected, abs=1e-9)


def test_sphere_tier_point_on_a_wide_map_still_returns_a_mesh(tmp_path):
    # (-59°, 45° E) is sphere by site_tier. Part 2 must refuse the mesh; this function does not.
    site = (-59.0, 45.0)
    assert str(site_tier(np.asarray([site[0]]))[0]) == 'sphere'
    mesh = terrain_mesh(DemStore(wide=prepared(tmp_path, 'wide', np.zeros((5, 5)), site, 240)), *site, size=5, window_km=0.4)
    assert np.isfinite(mesh.height_m).all()


def test_meshes_reject_latitudes_past_the_local_frame(tmp_path):
    site = (-89.5, 10.0)
    store = DemStore(prepared(tmp_path, 'core', np.zeros((7, 7)), site))
    terrain = PreparedMap(prepared(tmp_path, 'close', np.zeros((7, 7)), site, pixel=5))
    for lat in (-90.0, -91.0, 91.0):
        with pytest.raises(ValueError, match='absolute value at most 89.999 degrees'):
            terrain_mesh(store, lat, 0.0, size=5, window_km=0.2)
        with pytest.raises(ValueError, match='absolute value at most 89.999 degrees'):
            closeup_mesh(terrain, lat, 0.0, size=5, window_km=0.2)
