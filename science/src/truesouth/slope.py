"""Site slope from a polar map or a close-up neighbourhood (docs/science.md §8).

Angles in and out are degrees. A result is the contract value
``{deg, baseline_m, source}``. ``None`` means the slope was not assessed:
a sphere-tier site, a polar sample with missing terrain, or too few valid
close-up pixels to determine a plane. Not assessed is never reported as 0°.

``polar_slope`` is the central-difference method for an 80 m or 240 m polar
map. It reads that map's own pixel grid. It does not bilinear-sample, and it
does not look at a close-up.

``closeup_slope`` is the plane fit for a 5 m close-up, after those pixels
have already been turned into local east and north metres. It does not open
a file and does not assume a projection. Reading real close-up DEMs is a
later package.

Part 2 calls them like this::

    polar = polar_slope(store.core, lat_deg, lon_deg)   # 80 m map
    polar = polar_slope(store.wide, lat_deg, lon_deg)   # 240 m map
    close = closeup_slope(east_m, north_m, height_m)    # 5 m pixels, local metres

Pass the map that should be reported. A core80 site can still be measured on
the 240 m map by passing that map; this function does not choose. A
sphere-tier latitude returns None from ``polar_slope`` even if a map covers it.
"""

import numpy as np

from .contracts import Slope
from .dem import site_tier
from .frames import map_scale_factor

CLOSEUP_RADIUS_M = 50.0
CLOSEUP_BASELINE_M = 100.0
CLOSEUP_SOURCE = 'close-up DEM, plane fit'


def polar_slope(terrain, lat_deg, lon_deg):
    """Slope in degrees from one polar map, or None when it is not assessed.

    The site pixel is the nearest pixel centre, chosen separately in row and
    column. An exact half-way tie goes to the even index (``np.rint``). The
    differences use that pixel's grid neighbours and are not interpolated.
    ``k`` is evaluated at the site latitude (docs/science.md §8). The baseline
    is ``2p`` (160 m on the 80 m map, 480 m on the 240 m map).

    Not assessed (None) when the site is sphere-tier, when the site pixel or
    any of those four samples is off the map, or when any of them is missing.
    A missing sample is never treated as height zero. The site pixel itself is
    not in the difference; it is required because a site with no height has
    no assessed slope.
    """
    lat = _finite_degree('latitude', lat_deg)
    lon = _finite_degree('longitude', lon_deg)
    # Section 2.1: the local frame is undefined closer to a pole than this.
    if abs(lat) > 89.999:
        raise ValueError('site latitude must have absolute value at most 89.999 degrees')
    if str(site_tier(np.asarray([lat]))[0]) == 'sphere':
        return None
    pixel_x, pixel_y = _square_pixels(terrain.meta)
    row, col = terrain.coordinates(lat, lon)
    if not np.isfinite(row) or not np.isfinite(col):
        return None
    r = int(np.rint(float(row)))
    c = int(np.rint(float(col)))
    height, width = terrain.data.shape
    if not (1 <= r <= height - 2 and 1 <= c <= width - 2):
        return None
    centre = float(terrain.data[r, c])
    east = float(terrain.data[r, c + 1])
    west = float(terrain.data[r, c - 1])
    # Row 0 is the top edge, +y, so the row above is local-map north of this one.
    north = float(terrain.data[r - 1, c])
    south = float(terrain.data[r + 1, c])
    if not all(np.isfinite(value) for value in (centre, east, west, north, south)):
        return None
    g_x = (east - west) / (2.0 * pixel_x)
    g_y = (north - south) / (2.0 * pixel_x)
    scale = float(np.asarray(map_scale_factor(lat), dtype=float))
    deg = float(np.degrees(np.arctan(scale * np.hypot(g_x, g_y))))
    baseline_m = 2.0 * pixel_x
    name = terrain.meta.get('source') or 'polar DEM'
    return Slope(deg=deg, baseline_m=baseline_m, source=f'{name}, central difference')


def closeup_slope(east_m, north_m, height_m, *, source=CLOSEUP_SOURCE):
    """Slope in degrees from a plane fit in local metres, or None if not assessed.

    Fits ``z = a E + b N + c`` to every finite pixel whose local offset is
    within 50 m of the origin, so the baseline is 100 m. The slope is
    ``arctan(sqrt(a² + b²))`` in degrees (docs/science.md §8). The radius is
    fixed there; it is not a parameter.

    Pixels outside 50 m are ignored. Missing heights and non-finite offsets
    are ignored, not filled with zero. The result is None when fewer than
    three valid pixels remain, or when those pixels do not determine a unique
    plane (they are collinear, including a line that misses the origin, or
    stacked on one spot). A determined fit reports the method baseline of 100 m.
    """
    east = np.asarray(east_m, dtype=float)
    north = np.asarray(north_m, dtype=float)
    height = np.asarray(height_m, dtype=float)
    if east.shape != north.shape or east.shape != height.shape:
        raise ValueError('east_m, north_m and height_m must have the same shape')
    east, north, height = east.ravel(), north.ravel(), height.ravel()
    valid = (np.hypot(east, north) <= CLOSEUP_RADIUS_M) & np.isfinite(east) & np.isfinite(north) & np.isfinite(height)
    if int(np.count_nonzero(valid)) < 3:
        return None
    east, north, height = east[valid], north[valid], height[valid]
    # Shifting the origin does not change the slopes a and b.
    design = np.column_stack((east - east.mean(), north - north.mean(), np.ones(east.shape)))
    coeff, _, rank, _ = np.linalg.lstsq(design, height, rcond=None)
    if rank < 3:
        return None
    deg = float(np.degrees(np.arctan(np.hypot(coeff[0], coeff[1]))))
    return Slope(deg=deg, baseline_m=float(CLOSEUP_BASELINE_M), source=str(source))


def _finite_degree(name, value):
    number = float(value)
    if not np.isfinite(number):
        raise ValueError(f'{name} must be finite')
    return number


def _square_pixels(meta):
    """The §8 formula has one pixel size, and row 0 is the +y edge."""
    pixel_x = float(meta['pixel_x'])
    pixel_y = float(meta['pixel_y'])
    if pixel_x <= 0 or pixel_y >= 0 or abs(pixel_y + pixel_x) > 1e-6 * pixel_x:
        raise ValueError(
            f'polar slope needs square pixels with row 0 at +y; got pixel_x={pixel_x}, pixel_y={pixel_y}')
    return pixel_x, pixel_y
