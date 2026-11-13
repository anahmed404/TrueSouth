"""Encode and decode the contract's column-major series.

Out-of-range or non-finite values raise ValueError; they are never clipped or wrapped.
"""
import numpy as np
from collections.abc import Mapping
from numpy.typing import ArrayLike, NDArray
from truesouth.contracts import SeriesLayout


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
