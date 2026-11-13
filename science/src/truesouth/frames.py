"""Moon-fixed vectors, site-centred directions and the south polar map."""
from truesouth.constants import MAX_SITE_LATITUDE_DEG


import numpy as np

from truesouth.constants import MOON_RADIUS_M


def _wrap_degrees(angle):
    """Wrap angles to [0, 360), including floating-point rounding (science.md §1)."""
    wrapped = np.mod(angle, 360.0)
    return np.where(wrapped >= 360.0, 0.0, wrapped)


def _site_latitude(latitude):
    """Reject sites where the local frame is undefined (science.md §2.1)."""
    latitude = np.asarray(latitude, dtype=float)
    if np.any(np.abs(latitude) > 89.999):
        raise ValueError("site latitude must have absolute value at most 89.999 degrees")
    return latitude


def unit_vector(latitude, longitude):
    """Return Moon-fixed unit vectors with components on the last axis (science.md §2.1)."""
    lat, lon = np.broadcast_arrays(np.deg2rad(latitude), np.deg2rad(longitude))
    return np.stack((np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)), axis=-1)


def local_basis(latitude, longitude):
    """Return east, north and up unit vectors at each site (science.md §2.1)."""
    lat, lon = np.broadcast_arrays(np.deg2rad(_site_latitude(latitude)), np.deg2rad(longitude))
    east = np.stack((-np.sin(lon), np.cos(lon), np.zeros_like(lon)), axis=-1)
    north = np.stack((-np.sin(lat) * np.cos(lon), -np.sin(lat) * np.sin(lon), np.cos(lat)), axis=-1)
    up = np.stack((np.cos(lat) * np.cos(lon), np.cos(lat) * np.sin(lon), np.sin(lat)), axis=-1)
    return east, north, up


def az_el(latitude, longitude, direction):
    """Return azimuth and elevation of unit directions in degrees (science.md §2.1)."""
    east, north, up = local_basis(latitude, longitude)
    direction = np.asarray(direction, dtype=float)
    east_component = np.sum(direction * east, axis=-1)
    north_component = np.sum(direction * north, axis=-1)
    up_component = np.sum(direction * up, axis=-1)
    azimuth = _wrap_degrees(np.rad2deg(np.arctan2(east_component, north_component)))
    # Straight up or down has no azimuth. Report 0 rather than the angle of float noise,
    # as web/src/lib/geo/frames.ts does.
    azimuth = np.where(np.hypot(east_component, north_component) <= 1e-12, 0.0, azimuth)
    elevation = np.rad2deg(np.arcsin(np.clip(up_component, -1.0, 1.0)))
    return azimuth, elevation


def destination(latitude, longitude, azimuth, distance_m):
    """Walk a great-circle distance from a site (science.md §2.1–2.2)."""
    lat = np.deg2rad(_site_latitude(latitude))
    lon = np.deg2rad(longitude)
    az = np.deg2rad(azimuth)
    gamma = np.asarray(distance_m) / MOON_RADIUS_M
    sin_lat2 = np.sin(lat) * np.cos(gamma) + np.cos(lat) * np.sin(gamma) * np.cos(az)
    lat2 = np.arcsin(np.clip(sin_lat2, -1.0, 1.0))
    lon2 = lon + np.arctan2(np.sin(az) * np.sin(gamma) * np.cos(lat),
                            np.cos(gamma) - np.sin(lat) * np.sin(lat2))
    return np.rad2deg(lat2), _wrap_degrees(np.rad2deg(lon2))


def polar_stereo_forward(latitude, longitude):
    """Project latitude and east longitude to metres (science.md §2.3)."""
    lat, lon = np.broadcast_arrays(np.deg2rad(latitude), np.deg2rad(longitude))
    rho = 2 * MOON_RADIUS_M * np.tan(np.pi / 4 + lat / 2)
    return rho * np.sin(lon), rho * np.cos(lon)


def polar_stereo_inverse(x, y):
    """Return latitude and east longitude from map metres (science.md §2.3)."""
    x, y = np.broadcast_arrays(x, y)
    rho = np.hypot(x, y)
    latitude = np.rad2deg(2 * np.arctan(rho / (2 * MOON_RADIUS_M)) - np.pi / 2)
    longitude = _wrap_degrees(np.rad2deg(np.arctan2(x, y)))
    return latitude, longitude


def map_scale_factor(latitude):
    """Return the south-polar map distance scale factor (science.md §2.3)."""
    return 2 / (1 + np.sin(np.abs(np.deg2rad(latitude))))
