"""Polar map sampling and shaded relief (docs/science.md §§2.3–2.4)."""
import numpy as np
from scipy.ndimage import map_coordinates


def hillshade(heights, pixel_m):
    """Shade a height grid; rows run down while map y points up."""
    dy, dx = np.gradient(np.asarray(heights, dtype=np.float32), pixel_m)
    gy = -dy
    return np.clip((0.5 * dx - 0.5 * gy + 1 / np.sqrt(2)) /
                   np.sqrt(dx * dx + gy * gy + 1), 0, 1)


def encode_lookup(fractions):
    """Encode finite fractions; 255 is reserved for missing data."""
    a = np.asarray(fractions)
    valid = np.isfinite(a)
    if np.any((a[valid] < 0) | (a[valid] > 1)):
        raise ValueError('visibility fraction outside [0, 1]')
    out = np.full(a.shape, 255, dtype=np.uint8)
    out[valid] = np.minimum(np.floor(a[valid] * 255 + 0.5), 254).astype(np.uint8)
    return out


def sample_grid(data, transform, size, half_width, row_start=0, row_stop=None):
    """Bilinearly sample source centres at output pixel centres."""
    row_stop = size if row_stop is None else row_stop
    pixel = 2 * half_width / size
    y = half_width - (np.arange(row_start, row_stop) + .5) * pixel
    x = -half_width + (np.arange(size) + .5) * pixel
    rr = (y - transform[5]) / transform[4] - .5
    cc = (x - transform[2]) / transform[0] - .5
    coords = np.broadcast_arrays(rr[:, None], cc[None, :])
    return map_coordinates(data, coords, order=1, mode='constant', cval=np.nan, prefilter=False)


def accumulate_lookup(data, transform, size, half_width, sums, counts, exclude=None):
    """Accumulate valid source pixel centres into their output cells."""
    h, w = data.shape
    pixel = 2 * half_width / size
    cols = np.floor((transform[2] + (np.arange(w) + .5) * transform[0] + half_width) / pixel).astype(int)
    good_col = (cols >= 0) & (cols < size)
    for start in range(0, h, 256):
        stop = min(h, start + 256)
        rows = np.floor((half_width - (transform[5] + (np.arange(start, stop) + .5) * transform[4])) / pixel).astype(int)
        valid = np.isfinite(data[start:stop]) & good_col[None, :] & (rows[:, None] >= 0) & (rows[:, None] < size)
        if exclude is not None:
            valid &= ~exclude(start, stop, w)
        ri, ci = np.nonzero(valid)
        idx = rows[ri] * size + cols[ci]
        np.add.at(sums, idx, data[start:stop][ri, ci])
        np.add.at(counts, idx, 1)


def lookup_mean(sums, counts, size):
    values = np.full(sums.shape, np.nan, dtype=np.float64)
    np.divide(sums, counts, out=values, where=counts > 0)
    return values.reshape(size, size)
