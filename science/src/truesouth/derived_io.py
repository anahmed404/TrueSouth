"""Strict little-endian readers and writers for the derived binary layouts."""
from pathlib import Path
from os import PathLike
from collections.abc import Mapping
import numpy as np
from numpy.typing import ArrayLike, NDArray
from truesouth.contracts import SkylineLayout, TerrainLayout, SystemLayout, MapLookupLayout, SeriesLayout
from truesouth.series import encode_series, decode_series

PathArg = str | PathLike[str]
Arrays = Mapping[str, ArrayLike]

def write_series(path: PathArg, columns: Arrays, layout: SeriesLayout | None = None) -> None:
    """Write decoded ``columns`` to ``path``, returning None.

    ``columns`` contains equal-length vectors sun_az, sun_el, sun_frac,
    sun_clear, earth_az, earth_el, earth_frac, earth_clear; angles and
    clearance are degrees and fractions dimensionless. ``layout`` is the
    optional SeriesLayout. Raises KeyError for missing columns, ValueError
    for invalid shape or range, TypeError for non-numeric values, and OSError
    on file errors.
    """
    Path(path).write_bytes(encode_series(columns, layout))

def read_series(path: PathArg, count: int, layout: SeriesLayout | None = None) -> dict[str, NDArray[np.float64]]:
    """Read ``path`` into eight decoded float64 arrays of length ``count``.

    Keys are sun_az, sun_el, sun_frac, sun_clear, earth_az, earth_el,
    earth_frac and earth_clear; angles and clearance are degrees, fractions
    dimensionless. ``layout`` optionally supplies the SeriesLayout. Raises
    ValueError for an invalid count or length and OSError on file errors.
    """
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

def write_skyline(path: PathArg, values: Arrays, bins: int, layout: SkylineLayout | None = None) -> None:
    """Write five ``bins``-length arrays in ``values`` to ``path``; return None.

    Keys: el_deg, dist_km, lat_deg, lon_deg, height_m; units are degrees,
    kilometres, degrees, degrees, metres. ``layout`` optionally overrides
    SkylineLayout. Raises KeyError for missing keys, ValueError for wrong
    shapes or non-numeric values, TypeError for invalid values, OSError on I/O.
    """
    _write(path, values, layout or SkylineLayout(), (bins,))

def read_skyline(path: PathArg, bins: int, layout: SkylineLayout | None = None) -> dict[str, NDArray[np.float32]]:
    """Read ``path`` as five float32 vectors of length ``bins``.

    Return el_deg, dist_km, lat_deg, lon_deg, height_m in degrees,
    kilometres, degrees, degrees and metres. ``layout`` is an optional
    SkylineLayout. Raises ValueError on incorrect length and OSError on I/O.
    """
    return _read(path, layout or SkylineLayout(), (bins,))

def write_terrain(path: PathArg, values: Arrays, size: int, layout: TerrainLayout | None = None) -> None:
    """Write a terrain mesh to ``path`` and return None.

    ``values`` maps east_km, north_km, up_km, slope_deg to (size, size)
    arrays, in kilometres and degrees; rows run north to south, columns west
    to east. ``layout`` optionally supplies TerrainLayout. Raises KeyError
    for missing keys, ValueError for bad shapes or values, TypeError for
    invalid values and OSError on I/O.
    """
    _write(path, values, layout or TerrainLayout(), (size, size))

def read_terrain(path: PathArg, size: int, layout: TerrainLayout | None = None) -> dict[str, NDArray[np.float32]]:
    """Read ``path`` into four (size, size) float32 terrain arrays.

    Return east_km, north_km, up_km and slope_deg, in kilometres and degrees;
    rows run north to south, columns west to east. ``layout`` is an optional
    TerrainLayout. Raises ValueError on incorrect length and OSError on I/O.
    """
    return _read(path, layout or TerrainLayout(), (size, size))

def write_closeup(path: PathArg, values: Arrays, size: int, layout: TerrainLayout | None = None) -> None:
    """Write a close-up mesh at ``path`` and return None.

    ``values`` maps east_km, north_km, up_km, slope_deg to (size, size)
    arrays in kilometres and degrees, rows north to south, columns west to
    east. ``layout`` is an optional TerrainLayout. Raises KeyError for missing
    keys, ValueError for bad shapes or values, TypeError for invalid values,
    and OSError on I/O.
    """
    write_terrain(path, values, size, layout)

def read_closeup(path: PathArg, size: int, layout: TerrainLayout | None = None) -> dict[str, NDArray[np.float32]]:
    """Read ``path`` into four (size, size) float32 close-up arrays.

    Return east_km, north_km, up_km and slope_deg, in kilometres and degrees;
    rows run north to south, columns west to east. ``layout`` is an optional
    TerrainLayout. Raises ValueError on incorrect length and OSError on I/O.
    """
    return read_terrain(path, size, layout)

def write_system(path: PathArg, values: Arrays, count: int, layout: SystemLayout | None = None) -> None:
    """Write six ``count``-length ephemeris arrays to ``path``; return None.

    ``values`` contains subsolar_lat, subsolar_lon, subearth_lat,
    subearth_lon, earth_dist_km, sun_dist_km: angles in degrees and distances
    in kilometres. ``layout`` optionally supplies SystemLayout. Raises
    KeyError for missing keys, ValueError for wrong shapes or values,
    TypeError for invalid values, and OSError on I/O.
    """
    _write(path, values, layout or SystemLayout(), (count,))

def read_system(path: PathArg, count: int, layout: SystemLayout | None = None) -> dict[str, NDArray[np.float32]]:
    """Read ``path`` into six float32 ephemeris arrays of length ``count``.

    Return subsolar_lat, subsolar_lon, subearth_lat, subearth_lon,
    earth_dist_km and sun_dist_km: degrees and kilometres. ``layout`` is an
    optional SystemLayout. Raises ValueError on wrong length and OSError on I/O.
    """
    return _read(path, layout or SystemLayout(), (count,))

def write_map_lookup(path: PathArg, values: ArrayLike, size: int, layout: MapLookupLayout | None = None) -> None:
    """Write a (size, size) integer grid ``values`` to ``path``; return None.

    Values use the optional MapLookupLayout's unsigned encoding and missing
    marker; valid values decode using its dimensionless scale. Rows run top
    to bottom, columns left to right. Raises ValueError for a wrong shape,
    non-integers or values outside the encoding, and OSError on I/O.
    """
    layout = layout or MapLookupLayout()
    a = np.asarray(values)
    dtype = np.dtype(layout.dtype).newbyteorder('<' if layout.byte_order == 'little' else '>')
    if a.shape != (size, size) or not np.issubdtype(a.dtype, np.integer) or np.any(a < 0) or np.any(a > layout.missing):
        raise ValueError("invalid lookup grid")
    Path(path).write_bytes(a.astype(dtype).tobytes())

def read_map_lookup(path: PathArg, size: int, layout: MapLookupLayout | None = None) -> NDArray[np.uint8]:
    """Read ``path`` into a raw unsigned (size, size) map lookup grid.

    ``layout`` optionally supplies dtype, missing marker, scale and byte order;
    valid cells decode to dimensionless fractions using its scale. Rows run
    top to bottom, columns left to right. Raises ValueError for wrong byte
    length and OSError on I/O.
    """
    layout = layout or MapLookupLayout()
    data = Path(path).read_bytes()
    dtype = np.dtype(layout.dtype).newbyteorder('<' if layout.byte_order == 'little' else '>')
    if len(data) != size * size * dtype.itemsize:
        raise ValueError("wrong lookup byte length")
    return np.frombuffer(data, dtype=dtype).reshape(size, size).copy()
