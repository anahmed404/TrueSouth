"""Disc visibility from docs/science.md §6; angles are degrees."""

import numpy as np

from .constants import DISC_STRIPS
from .skyline import interpolate_skyline


def visible_fraction(azimuth_deg, elevation_deg, radius_deg, skyline_el_deg):
    """Return visible disc fractions, broadcasting the body inputs over hours.

    Use 33 equal-width strip midpoints: x/rho = -1 + (i+1/2)*2/33.
    Midpoints stay strictly inside the disc, avoid zero-length edge chords,
    and preserve left/right symmetry. The equal widths cancel in §6's ratio.
    All hours and strips are evaluated together, with no loop over hours.

    Extrema of the skyline first identify wholly clear/hidden discs. This
    also handles zenith/nadir before division by cos(e): a disc at the zenith
    is clear of every realistic terrain skyline. For partial discs only,
    cos(e) is floored at machine epsilon to keep even an artificial skyline
    touching the zenith finite; the tangent-plane approximation of §6 has
    no physical meaning at that singularity.
    """
    skyline = np.asarray(skyline_el_deg, dtype=float)
    if skyline.ndim != 1 or skyline.size < 2 or not np.isfinite(skyline).all():
        raise ValueError('skyline must contain at least two finite elevations')
    az, el, radius = np.broadcast_arrays(
        np.asarray(azimuth_deg, dtype=float), np.asarray(elevation_deg, dtype=float),
        np.asarray(radius_deg, dtype=float))
    if (not all(np.isfinite(a).all() for a in (az, el, radius))
            or np.any(np.abs(el) > 90) or np.any(radius <= 0) or np.any(radius >= 90)):
        raise ValueError('finite directions, elevation within ±90°, and radius in (0, 90) required')
    clear = el - radius >= skyline.max()
    hidden = el + radius <= skyline.min()
    partial = ~(clear | hidden)
    result = np.array(clear, dtype=float)
    offsets = -1 + (np.arange(DISC_STRIPS) + .5) * (2 / DISC_STRIPS)
    x = radius[partial, None] * offsets
    chord = radius[partial, None] * np.sqrt(1 - offsets**2)
    cosine = np.maximum(np.cos(np.deg2rad(el[partial, None])), np.finfo(float).eps)
    horizon = interpolate_skyline(skyline, az[partial, None] + x / cosine)
    exposed = np.clip(el[partial, None] + chord - horizon, 0, 2 * chord)
    result[partial] = np.clip(exposed.sum(axis=-1) / (2 * chord).sum(axis=-1), 0, 1)
    return result
