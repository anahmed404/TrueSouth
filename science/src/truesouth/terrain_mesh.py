"""Local terrain meshes (docs/science.md §13, docs/data-contracts.md terrain.bin).

The grid is ``size`` by ``size`` over a square ``window_km`` across, centred on
the site. The default terrain mesh is 257 by 257 over 20 km. The default
close-up mesh is 257 by 257 over 2 km. Row 0 is the northern edge and column 0
the western edge, the same arrangement as the synthetic fixtures.

A vertex at local offsets (E, N) is walked with section 2.2 and its height is
read there. Its stored position, in kilometres, is the section 13 formula, so
the Moon's curvature is in the mesh and the site itself sits at the origin
when its own height is known. Missing heights stay NaN in every array. They
are never filled with zero.

``closeup_mesh`` samples a ``PreparedMap`` or a sampling wrapper. Real 5 m
products are validated and cropped by closeups.py before reaching this helper.
The wrapper registers the drawing heights to the unchanged polar-map ground.

Per-vertex ``slope_deg`` is the section 13 overlay slope: the angle of the
gradient of sampled height ``z`` on the offset grid ``(E, N)``, in degrees.
Interior vertices use central differences over ``2Δ`` and rim vertices use
one-sided differences over ``Δ``. There is no projection scale factor. A
vertex is NaN when its own height is missing or a height its differences need
is missing. This baseline is not the site's section 8 slope.

Part 2 must decide from the site's tier (``site_tier``), not from map
coverage. At (−59°, 45° E) the tier is ``sphere``, but the wide map still
covers the point, so ``terrain_mesh`` returns a mesh. A sphere-tier site
must get no mesh; that gate is the caller's.

Part 2 calls them like this::

    if str(site_tier(lat_deg)) == 'sphere':
        mesh = None
    else:
        mesh = terrain_mesh(store, lat_deg, lon_deg)
        write_terrain(path, mesh.arrays, mesh.size)
    close = closeup_mesh(prepared_map, lat_deg, lon_deg)
    write_closeup(path, close.arrays, close.size)

``mesh.site_height_m`` is the sampled ground height at the site (NaN when the
site itself has no terrain). ``mesh.missing_count`` counts vertices with no
height. ``mesh.lat_deg`` and ``mesh.lon_deg`` are the walked vertex positions.
"""

from dataclasses import dataclass

import numpy as np

from .constants import CLOSEUP_WINDOW_KM, MOON_RADIUS_M, TERRAIN_SIZE, TERRAIN_WINDOW_KM
from .frames import destination


@dataclass(frozen=True)
class TerrainMesh:
    """Arrays for terrain.bin plus the heights and coordinates they came from."""

    east_km: np.ndarray
    north_km: np.ndarray
    up_km: np.ndarray
    slope_deg: np.ndarray
    height_m: np.ndarray
    lat_deg: np.ndarray
    lon_deg: np.ndarray
    missing_count: int
    site_height_m: float
    size: int
    window_km: float

    @property
    def arrays(self):
        """The four float arrays ``write_terrain`` / ``write_closeup`` store."""
        return {
            'east_km': self.east_km,
            'north_km': self.north_km,
            'up_km': self.up_km,
            'slope_deg': self.slope_deg,
        }


def terrain_mesh(store, lat_deg, lon_deg, size=TERRAIN_SIZE, window_km=TERRAIN_WINDOW_KM):
    """Mesh sampled the way ``DemStore`` samples: core where it covers, else wide.

    A vertex past the 80 m map uses the 240 m map. A vertex past both, or on a
    missing pixel, is NaN rather than zero. The core is never filled from the
    wide map; that rule lives in ``DemStore``.

    The caller must gate on ``site_tier`` before calling. Coverage is not that
    gate: a sphere-tier site at −59° can still lie on the wide map, and this
    function then returns a mesh.
    """
    return _mesh(store.sample, lat_deg, lon_deg, size, window_km)


def closeup_mesh(terrain, lat_deg, lon_deg, size=TERRAIN_SIZE, window_km=CLOSEUP_WINDOW_KM):
    """The same mesh, with heights from one prepared map's ``sample``."""

    def sample(lat, lon):
        heights = np.asarray(terrain.sample(lat, lon), dtype=np.float64)
        return heights, int(np.count_nonzero(~np.isfinite(heights)))

    return _mesh(sample, lat_deg, lon_deg, size, window_km)


def _mesh(sample, lat_deg, lon_deg, size, window_km):
    size = int(size)
    window_km = float(window_km)
    if size < 3:
        raise ValueError('terrain mesh size must be at least 3')
    if not np.isfinite(window_km) or window_km <= 0:
        raise ValueError('terrain window must be a positive number of kilometres')
    lat = float(lat_deg)
    lon = float(lon_deg)
    east_axis, north_axis = _offset_axes(size, window_km)
    east_m = np.broadcast_to(east_axis, (size, size))
    north_m = np.broadcast_to(north_axis[:, None], (size, size))
    distance_m = np.hypot(east_m, north_m)
    azimuth_deg = np.degrees(np.arctan2(east_m, north_m))
    vertex_lat, vertex_lon = destination(lat, lon, azimuth_deg, distance_m)
    height_m, missing_count = sample(vertex_lat, vertex_lon)
    height_m = np.asarray(height_m, dtype=np.float64)
    site_height, _ = sample(lat, lon)
    site_height_m = float(np.asarray(site_height, dtype=np.float64).reshape(()))
    east_km, north_km, up_km = _local_position_km(east_m, north_m, distance_m, height_m, site_height_m)
    return TerrainMesh(
        east_km=east_km,
        north_km=north_km,
        up_km=up_km,
        slope_deg=_slope_deg(height_m, north_axis, east_axis),
        height_m=height_m,
        lat_deg=np.asarray(vertex_lat, dtype=np.float64),
        lon_deg=np.asarray(vertex_lon, dtype=np.float64),
        missing_count=int(missing_count),
        site_height_m=site_height_m,
        size=size,
        window_km=window_km,
    )


def _offset_axes(size, window_km):
    """East and north offsets in metres. Row 0 is +north, column 0 is −east."""
    half_m = window_km * 1000.0 / 2.0
    step = np.arange(size, dtype=np.float64)
    span = size - 1
    east = half_m * (-1.0 + 2.0 * step / span)
    north = half_m * (1.0 - 2.0 * step / span)
    return east, north


def _local_position_km(east_m, north_m, distance_m, height_m, site_height_m):
    """Section 13. ``sin(γ) / s`` is ``1 / R`` at the site, where ``s`` is 0."""
    gamma = distance_m / MOON_RADIUS_M
    sin_gamma = np.sin(gamma)
    ratio = np.empty(distance_m.shape, dtype=np.float64)
    np.divide(sin_gamma, distance_m, out=ratio, where=distance_m > 0)
    ratio = np.where(distance_m > 0, ratio, 1.0 / MOON_RADIUS_M)
    radius = MOON_RADIUS_M + height_m
    east_km = radius * ratio * east_m / 1000.0
    north_km = radius * ratio * north_m / 1000.0
    up_km = (radius * np.cos(gamma) - (MOON_RADIUS_M + site_height_m)) / 1000.0
    return east_km, north_km, up_km


def _slope_deg(height_m, north_axis, east_axis):
    """Slope angle of z on the (E, N) grid. Missing heights stay missing."""
    # edge_order 1: central differences over 2Δ inside, one-sided over Δ on the rim.
    g_north, g_east = np.gradient(
        np.asarray(height_m, dtype=np.float64),
        np.asarray(north_axis, dtype=np.float64),
        np.asarray(east_axis, dtype=np.float64),
        edge_order=1,
    )
    slope = np.degrees(np.arctan(np.hypot(g_east, g_north)))
    return np.where(np.isfinite(height_m), slope, np.nan)
