"""Terrain skylines in each site's local frame (docs/science.md §§4–5).

No file writer lives here: ``Skyline.arrays`` follows SkylineLayout order for the
derived-data writer. Calculations retain float64; that writer can encode Float32.
"""
from truesouth.constants import MAX_SITE_LATITUDE_DEG


from dataclasses import dataclass

import numpy as np

from .constants import (MOON_RADIUS_M, OBSERVER_HEIGHT_M, SKYLINE_BINS,
                        SKYLINE_MAX_RANGE_KM)
from .contracts import SkylineMeta
from .frames import (az_el, destination, local_basis, polar_stereo_inverse,
                     unit_vector)


def elevation_angle(distance_m, height_m, site_height_m=0):
    """Exact terrain elevation in degrees, broadcasting inputs (science.md §4).

    ``distance_m`` is ground arc length on the reference sphere. The observer is
    OBSERVER_HEIGHT_M above ``site_height_m``; terrain heights are above that sphere.
    The half-angle identity avoids subtracting two nearly equal lunar radii.
    """
    gamma = np.asarray(distance_m) / MOON_RADIUS_M
    terrain_radius = MOON_RADIUS_M + np.asarray(height_m)
    vertical = (np.asarray(height_m) - np.asarray(site_height_m) - OBSERVER_HEIGHT_M
                - 2 * terrain_radius * np.sin(gamma / 2) ** 2)
    return np.rad2deg(np.arctan2(vertical, terrain_radius * np.sin(gamma)))


def interpolate_skyline(el_deg, azimuth_deg):
    """Linearly interpolate bin centres, wrapping at 360 degrees (science.md §5)."""
    values = np.asarray(el_deg)
    if values.ndim != 1 or values.size < 2:
        raise ValueError('skyline must be a one-dimensional array with at least two bins')
    position = np.mod(azimuth_deg, 360.) * (values.size / 360.)
    lower = np.floor(position).astype(np.int64)
    fraction = position - lower
    return values[lower % values.size] * (1 - fraction) + values[(lower + 1) % values.size] * fraction


@dataclass
class Skyline:
    """Five arrays in SkylineLayout order, metadata, and method diagnostics.

    ``method`` is 'near', 'far', or 'none' per bin; it is not a binary-file column.
    ``max_range_km`` is the configured search limit, not the farthest blocker or
    a claim of complete map coverage. Missing samples count attempted ray positions
    without height and missing far pixels in range (overlap is excluded).
    """

    el_deg: np.ndarray
    dist_km: np.ndarray
    lat_deg: np.ndarray
    lon_deg: np.ndarray
    height_m: np.ndarray
    missing_samples: int
    max_range_km: float
    method: np.ndarray

    @property
    def arrays(self):
        return np.stack((self.el_deg, self.dist_km, self.lat_deg, self.lon_deg, self.height_m))

    @property
    def meta(self):
        return SkylineMeta(bins=self.el_deg.size, missing_samples=self.missing_samples,
                           max_range_km=self.max_range_km)


def _keep(result, bins, elevations, distances, latitudes, longitudes, heights, method):
    """Reduce one chunk with deterministic first-winner ties, without a bin loop."""
    bins = np.asarray(bins).ravel()
    elevations, distances, latitudes, longitudes, heights = (
        np.asarray(v).ravel() for v in (elevations, distances, latitudes, longitudes, heights))
    valid = np.isfinite(elevations)
    bins, elevations, distances, latitudes, longitudes, heights = (
        v[valid] for v in (bins, elevations, distances, latitudes, longitudes, heights))
    maximum = np.full(result.el_deg.size, -np.inf)
    np.maximum.at(maximum, bins, elevations)
    indices = np.arange(bins.size)
    first = np.full(result.el_deg.size, bins.size, dtype=np.int64)
    np.minimum.at(first, bins, np.where(elevations == maximum[bins], indices, bins.size))
    update = maximum > result.el_deg
    winner = first[update]
    result.el_deg[update] = maximum[update]
    result.dist_km[update] = distances[winner] / 1000
    result.lat_deg[update] = latitudes[winner]
    result.lon_deg[update] = longitudes[winner]
    result.height_m[update] = heights[winner]
    result.method[update] = method


def _pixels(terrain, chunk_size):
    """Walk prepared pixel centres in bounded row blocks, including missing pixels."""
    rows, cols = terrain.data.shape
    block_rows = max(1, chunk_size // cols)
    meta = terrain.meta
    x = meta['origin_x'] + (np.arange(cols) + .5) * meta['pixel_x']
    for start in range(0, rows, block_rows):
        stop = min(start + block_rows, rows)
        y = meta['origin_y'] + (np.arange(start, stop) + .5) * meta['pixel_y']
        lat, lon = polar_stereo_inverse(x[None, :], y[:, None])
        yield lat.ravel(), lon.ravel(), np.asarray(terrain.data[start:stop]).ravel()


def compute_skyline(store, latitude, longitude, *, bins=SKYLINE_BINS,
                    step_scale=1., chunk_size=262144):
    """Compute the terrain skyline and blockers (science.md §§4–5).

    ``store`` is a DemStore. The site's own bilinear height is the observer's
    ground height. Missing ground inside a map raises ValueError: inventing zero
    would move every sight-line. Outside both maps returns the sphere skyline.

    Each map uses its own pixel/tan(bin width) switch and half-pixel ray spacing.
    Core coverage masks wide terrain in BOTH methods, even at missing core pixels.
    Consequently wide terrain between the core and wide switches is still sampled
    along rays. The exact switch is included among ray distances; pixels beyond it
    use the far method. ``bins=2880, step_scale=.5`` supplies comparison R5.

    ``chunk_size`` bounds working samples, except that one complete ray-distance
    ring or raster row is the smallest block. No loop visits individual rays,
    bins, or pixels. Search radius is always SKYLINE_MAX_RANGE_KM.
    """
    if not isinstance(bins, (int, np.integer)) or bins < 4:
        raise ValueError('bins must be an integer of at least four')
    if not np.isfinite(step_scale) or not 0 < step_scale <= 1:
        raise ValueError('step_scale must be positive and at most one')
    if not isinstance(chunk_size, (int, np.integer)) or chunk_size < 1:
        raise ValueError('chunk_size must be a positive integer')
    if not np.isfinite(latitude) or not np.isfinite(longitude) or abs(latitude) > MAX_SITE_LATITUDE_DEG:
        raise ValueError('finite site coordinates and absolute latitude <= 89.999 required')
    local_basis(latitude, longitude)
    flat = -np.rad2deg(np.arccos(MOON_RADIUS_M / (MOON_RADIUS_M + OBSERVER_HEIGHT_M)))
    result = Skyline(np.full(bins, -np.inf), *(np.full(bins, np.nan) for _ in range(4)),
                     0, float(SKYLINE_MAX_RANGE_KM), np.full(bins, 'none', dtype='<U4'))
    if store.tiers(latitude, longitude).item() == 'sphere':
        result.el_deg[:] = flat
        return result
    ground, missing = store.sample(latitude, longitude)
    if missing:
        raise ValueError('site ground height is missing; cannot place observer')
    ground = float(ground)
    bin_width = 360. / bins
    azimuths = np.arange(bins) * bin_width
    limit = SKYLINE_MAX_RANGE_KM * 1000.
    maps = [(store.core, 'core80'), (store.wide, 'wide240')]
    maps = [(terrain, tier) for terrain, tier in maps if terrain is not None]

    for map_index, (terrain, tier) in enumerate(maps):
        pixel = float(terrain.meta['pixel_x'])
        switch = min(pixel / np.tan(np.deg2rad(bin_width)), limit)
        distances = np.unique(np.append(np.arange(40., switch, pixel / 2 * step_scale), switch))
        distances = distances[distances >= 40.]
        rings = max(1, chunk_size // bins)
        for start in range(0, distances.size, rings):
            distance = np.broadcast_to(distances[start:start + rings, None],
                                       (min(rings, distances.size - start), bins))
            lat, lon = destination(latitude, longitude, azimuths[None, :], distance)
            tiers = store.tiers(lat, lon)
            active = tiers == tier
            heights = terrain.sample(lat[active], lon[active])
            result.missing_samples += int(np.count_nonzero(~np.isfinite(heights)))
            # Uncovered positions are counted once, on the last available map's
            # ray lattice. Absent far-field map pixels cannot be enumerated.
            if map_index == len(maps) - 1:
                result.missing_samples += int(np.count_nonzero(tiers == 'sphere'))
            ray_bins = np.broadcast_to(np.arange(bins), distance.shape)[active]
            _keep(result, ray_bins, elevation_angle(distance[active], heights, ground),
                  distance[active], lat[active], lon[active], heights, 'near')

    east, north, up = local_basis(latitude, longitude)
    observer = (MOON_RADIUS_M + ground + OBSERVER_HEIGHT_M) * up
    for terrain, tier in maps:
        switch = float(terrain.meta['pixel_x']) / np.tan(np.deg2rad(bin_width))
        for lat, lon, heights in _pixels(terrain, chunk_size):
            unit = unit_vector(lat, lon)
            # atan2 is stable for both close and distant ground arc lengths.
            distance = MOON_RADIUS_M * np.arctan2(
                np.hypot(np.einsum('ij,j->i', unit, east), np.einsum('ij,j->i', unit, north)),
                np.einsum('ij,j->i', unit, up))
            active = (distance > switch) & (distance <= limit)
            if tier == 'wide240' and store.core is not None:
                active &= ~store.core.contains(lat, lon)
            result.missing_samples += int(np.count_nonzero(active & ~np.isfinite(heights)))
            active &= np.isfinite(heights)
            if not np.any(active):
                continue
            point = (MOON_RADIUS_M + heights[active, None]) * unit[active]
            direction = point - observer
            direction /= np.linalg.norm(direction, axis=1)[:, None]
            azimuth, elevation = az_el(latitude, longitude, direction)
            # Bin k is centred at k*width, so its edges are at (k +/- 0.5)*width.
            indices = np.floor(azimuth / bin_width + .5).astype(np.int64) % bins
            _keep(result, indices, elevation, distance[active], lat[active], lon[active],
                  heights[active], 'far')
    result.el_deg[~np.isfinite(result.el_deg)] = flat
    return result
