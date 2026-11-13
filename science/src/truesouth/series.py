"""Encode and decode the contract's column-major series.

Out-of-range or non-finite values raise ValueError; they are never clipped or wrapped.
"""
import numpy as np
from collections.abc import Mapping
from numpy.typing import ArrayLike, NDArray
from truesouth.contracts import SeriesLayout
from dataclasses import dataclass

from truesouth.constants import SUN_RADIUS_KM, EARTH_RADIUS_KM
from truesouth.discs import visible_fraction
from truesouth.ephemeris import topocentric
from truesouth.skyline import interpolate_skyline


@dataclass(frozen=True)
class Series:
    """Eight unquantised hourly columns and mean angular radii for SiteMeta."""

    columns: dict[str, NDArray[np.float64]]
    sun_radius_deg: float
    earth_radius_deg: float


def build_series(latitude, longitude, ground_height_m, skyline_el_deg, global_ephemeris):
    """Compute one site's series (science.md §§3.2, 5–7), without file I/O.

    ``skyline_el_deg`` contains equally spaced azimuth bins. The global
    ephemeris is the named-array mapping returned by load_global; synthetic
    grids of any length are supported. Ground is metres above the reference
    sphere; topocentric adds the fixed two-metre observer height exactly once.
    Each body's entire grid is vectorised, with at most hours × 33 strips
    live at once; bodies run sequentially to bound temporary memory.

    Elevation is in [-90, 90] and clearance, the difference of two elevations,
    in [-180, 180]. Both fit Int16 at 0.01°/count without clipping. The existing
    encoder rejects out-of-range values rather than silently clipping them.
    """
    skyline = np.asarray(skyline_el_deg, dtype=float)
    if (skyline.ndim != 1 or skyline.size < 2 or not np.isfinite(skyline).all()
            or np.any(np.abs(skyline) > 90) or not np.isfinite(ground_height_m)):
        raise ValueError('finite ground and skyline elevations within ±90° required')
    columns, radii = {}, {}
    for body, prefix, radius in [('sun', 'subsolar', SUN_RADIUS_KM),
                                  ('earth', 'subearth', EARTH_RADIUS_KM)]:
        position = topocentric(latitude, longitude, global_ephemeris[prefix+'_lat'],
                               global_ephemeris[prefix+'_lon'],
                               global_ephemeris[body+'_dist_km'], radius,
                               ground_height_m=ground_height_m)
        if position.az_deg.ndim != 1 or not position.az_deg.size:
            raise ValueError('ephemeris must contain nonempty hourly vectors')
        columns[body+'_az'] = position.az_deg
        columns[body+'_el'] = position.el_deg
        columns[body+'_frac'] = visible_fraction(position.az_deg, position.el_deg,
                                                position.radius_deg, skyline)
        columns[body+'_clear'] = position.el_deg - interpolate_skyline(skyline, position.az_deg)
        radii[body] = float(np.mean(position.radius_deg))
    if columns['sun_az'].shape != columns['earth_az'].shape:
        raise ValueError('Sun and Earth must share the same hourly grid')
    return Series(columns, radii['sun'], radii['earth'])


def encode_series(columns: Mapping[str, ArrayLike], layout: SeriesLayout | None = None) -> bytes:
    """Return column-major little-endian Int16 bytes for decoded series columns.

    ``columns`` maps sun_az, sun_el, sun_frac, sun_clear, earth_az,
    earth_el, earth_frac and earth_clear to equally sized one-dimensional
    arrays. Azimuth, elevation and clearance are degrees; fractions are
    dimensionless. ``layout`` supplies scales, offsets and order; None uses
    the contract default. Values are rounded to the nearest encoded integer.
    Raises KeyError for missing keys, ValueError for invalid shapes, non-finite
    or out-of-range values, and TypeError for non-numeric input.
    """
    layout = layout or SeriesLayout()
    arrays = []
    count = None
    for c in layout.arrays:
        v = np.asarray(columns[c.name], dtype=np.float64)
        if v.ndim != 1 or (count is not None and len(v) != count):
            raise ValueError("series columns must be equally sized vectors")
        count = len(v)
        raw = (v - c.offset) / c.scale
        if not np.isfinite(raw).all() or np.any(raw < -32768) or np.any(raw > 32767):
            raise ValueError(f"{c.name} outside Int16 range or non-finite")
        arrays.append(np.rint(raw).astype('<i2'))
    return b''.join(a.tobytes() for a in arrays)


def decode_series(data: bytes, count: int, layout: SeriesLayout | None = None) -> dict[str, NDArray[np.float64]]:
    """Decode ``data`` bytes into eight float64 vectors of length ``count``.

    The returned dictionary has sun_az, sun_el, sun_frac, sun_clear,
    earth_az, earth_el, earth_frac and earth_clear keys. Angles and
    clearances are degrees; fractions are dimensionless. ``layout`` supplies
    column order, scales and offsets, defaulting to the contract. Raises
    ValueError if count is negative or the byte length is incorrect.
    """
    layout = layout or SeriesLayout()
    if count < 0 or len(data) != count * len(layout.arrays) * 2:
        raise ValueError("wrong series byte length")
    raw = np.frombuffer(data, dtype='<i2').reshape(len(layout.arrays), count)
    return {c.name: raw[i].astype(np.float64) * c.scale + c.offset for i, c in enumerate(layout.arrays)}
