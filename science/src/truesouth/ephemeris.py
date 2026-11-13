"""Global ephemeris and vectorised site directions (docs/science.md §3)."""

from dataclasses import dataclass
from pathlib import Path

import numpy as np

from truesouth.constants import MOON_RADIUS_M, OBSERVER_HEIGHT_M, TIME_GRID_COUNT
from truesouth.contracts import SystemLayout
from truesouth.frames import az_el, unit_vector
from truesouth.paths import derived_dir


@dataclass(frozen=True)
class Topocentric:
    direction: np.ndarray
    az_deg: np.ndarray
    el_deg: np.ndarray
    radius_deg: np.ndarray
    distance_km: np.ndarray


def topocentric(site_lat_deg, site_lon_deg, body_lat_deg, body_lon_deg,
                distance_km, body_radius_km, *, ground_height_m=0):
    """Directions in the Moon-fixed mean-Earth frame; angles in degrees (§3.2).

    Arrays broadcast over time (components occupy the last dimension). Distances
    are kilometres, ground height is metres above the reference sphere.
    """
    distance_km = np.asarray(distance_km, dtype=float)
    radius_km = (MOON_RADIUS_M + np.asarray(ground_height_m) + OBSERVER_HEIGHT_M) / 1000
    relative = (distance_km[..., None] * unit_vector(np.asarray(body_lat_deg, dtype=float),
                                                   np.asarray(body_lon_deg, dtype=float))
                - radius_km[..., None] * unit_vector(site_lat_deg, site_lon_deg))
    distance = np.linalg.norm(relative, axis=-1)
    if np.any(distance <= body_radius_km) or not np.isfinite(relative).all():
        raise ValueError('Body must be finite and observer must be outside its disc')
    direction = relative / distance[..., None]
    azimuth, elevation = az_el(site_lat_deg, site_lon_deg, direction)
    radius = np.rad2deg(np.arcsin(body_radius_km / distance))
    return Topocentric(direction, azimuth, elevation, radius, distance)


def write_global(columns, path=None):
    """Write the six contract arrays atomically, little-endian Float32."""
    path = Path(path) if path is not None else derived_dir() / 'system.bin'
    arrays = np.array([columns[name] for name in SystemLayout().arrays], dtype='<f4')
    if arrays.shape != (6, TIME_GRID_COUNT):
        raise ValueError(f'Global ephemeris size must be six arrays of {TIME_GRID_COUNT}')
    if not np.isfinite(arrays).all():
        raise ValueError('Global ephemeris values must be finite')
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix('.part')
    arrays.tofile(temporary)
    temporary.replace(path)


def load_global(path=None):
    """Read system.bin in the contract order; return a mapping of named arrays."""
    path = Path(path) if path is not None else derived_dir() / 'system.bin'
    expected = len(SystemLayout().arrays) * TIME_GRID_COUNT * 4
    if path.stat().st_size != expected:
        raise ValueError(f'Global ephemeris size must be {expected} bytes')
    arrays = np.fromfile(path, dtype='<f4').reshape(6, TIME_GRID_COUNT)
    if not np.isfinite(arrays).all():
        raise ValueError('Global ephemeris values must be finite')
    return dict(zip(SystemLayout().arrays, arrays))


def compare_site(predicted, reference, times):
    """G2 sky-angle components and full separation, as defined in science.md §3.3."""
    az_ref, el_ref = reference['az_deg'], reference['el_deg']
    delta_az = np.deg2rad((predicted.az_deg - az_ref + 180) % 360 - 180)
    az_error = np.rad2deg(2 * np.arcsin(np.clip(
        np.abs(np.cos(np.deg2rad(el_ref)) * np.sin(delta_az / 2)), 0, 1)))
    el_error = np.abs(predicted.el_deg - el_ref)
    # unit_vector(el, az) has a different axis order from ENU, but the same
    # orthogonal permutation for both vectors, preserving their separation.
    chord = np.linalg.norm(unit_vector(predicted.el_deg, predicted.az_deg)
                           - unit_vector(el_ref, az_ref), axis=-1)
    sky_error = np.rad2deg(2 * np.arcsin(np.clip(chord / 2, 0, 1)))
    result = {}
    for name, errors in [('az', az_error), ('el', el_error), ('sky', sky_error)]:
        index = int(np.argmax(errors))
        result[f'{name}_max_deg'] = float(errors[index])
        result[f'{name}_rms_deg'] = float(np.sqrt(np.mean(errors ** 2)))
        result[f'{name}_max_utc'] = str(times[index]) + 'Z'
    return result
