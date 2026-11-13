"""Strict little-endian readers and writers for the derived binary layouts."""
from pathlib import Path
import numpy as np
from truesouth.contracts import SkylineLayout, TerrainLayout, SystemLayout, MapLookupLayout
from truesouth.series import encode_series, decode_series


def write_series(path, columns, layout=None):
    Path(path).write_bytes(encode_series(columns, layout))

def read_series(path, count, layout=None):
    return decode_series(Path(path).read_bytes(), count, layout)

def _write(path, values, layout, shape):
    arrays = []
    for name in layout.arrays:
        a = np.asarray(values[name], dtype='<f4')
        if a.shape != shape:
            raise ValueError(f"{name}: expected shape {shape}, got {a.shape}")
        arrays.append(a.tobytes(order='C'))
    Path(path).write_bytes(b''.join(arrays))

def _read(path, layout, shape):
    data = Path(path).read_bytes()
    n = int(np.prod(shape))
    if len(data) != n * len(layout.arrays) * 4:
        raise ValueError("wrong binary byte length")
    raw = np.frombuffer(data, dtype='<f4').reshape((len(layout.arrays), *shape))
    return {name: raw[i].copy() for i, name in enumerate(layout.arrays)}

def write_skyline(path, values, bins, layout=None):
    _write(path, values, layout or SkylineLayout(), (bins,))

def read_skyline(path, bins, layout=None):
    return _read(path, layout or SkylineLayout(), (bins,))

def write_terrain(path, values, size, layout=None):
    _write(path, values, layout or TerrainLayout(), (size, size))

def read_terrain(path, size, layout=None):
    return _read(path, layout or TerrainLayout(), (size, size))

def write_closeup(path, values, size, layout=None):
    write_terrain(path, values, size, layout)

def read_closeup(path, size, layout=None):
    return read_terrain(path, size, layout)

def write_system(path, values, count, layout=None):
    _write(path, values, layout or SystemLayout(), (count,))

def read_system(path, count, layout=None):
    return _read(path, layout or SystemLayout(), (count,))

def write_map_lookup(path, values, size, layout=None):
    layout = layout or MapLookupLayout()
    a = np.asarray(values)
    if a.shape != (size, size) or not np.issubdtype(a.dtype, np.integer) or np.any(a < 0) or np.any(a > 255):
        raise ValueError("invalid lookup grid")
    Path(path).write_bytes(a.astype('u1').tobytes())

def read_map_lookup(path, size, layout=None):
    layout = layout or MapLookupLayout()
    data = Path(path).read_bytes()
    if len(data) != size * size:
        raise ValueError("wrong lookup byte length")
    return np.frombuffer(data, dtype='u1').reshape(size, size).copy()
