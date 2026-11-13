"""Encode and decode the contract's column-major series.

Out-of-range or non-finite values raise ValueError; they are never clipped or wrapped.
"""
import numpy as np
from truesouth.contracts import SeriesLayout


def encode_series(columns, layout=None):
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


def decode_series(data, count, layout=None):
    layout = layout or SeriesLayout()
    if count < 0 or len(data) != count * len(layout.arrays) * 2:
        raise ValueError("wrong series byte length")
    raw = np.frombuffer(data, dtype='<i2').reshape(len(layout.arrays), count)
    return {c.name: raw[i].astype(np.float64) * c.scale + c.offset for i, c in enumerate(layout.arrays)}
