"""Sunlit-peak placement sensitivity (docs/science.md §7.1), without file writes."""

from dataclasses import dataclass
from collections.abc import Callable, Mapping

import numpy as np

from .contracts import CatalogSite, NearbySun
from .dem import DemStore, PreparedMap, site_tier
from .frames import polar_stereo_inverse
from .series import build_series
from .skyline import compute_skyline

RADIUS_M = 160.0
REPOSITORY_URL = 'https://github.com/anahmed404/TrueSouth'
PLACEMENT_SOURCE_URL = (REPOSITORY_URL + '/blob/main/docs/science.md'
                        '#71-how-much-a-sunlit-peak-depends-on-where-you-stand')


@dataclass(frozen=True)
class CandidatePoint:
    """One 80 m pixel centre; row increases down, column increases toward +x."""

    row: int
    col: int
    lat_deg: float
    lon_deg: float
    offset_m: float


@dataclass(frozen=True)
class ScoredPoint:
    point: CandidatePoint
    mean_sun_frac: float


@dataclass(frozen=True)
class PlacementResult:
    nearby_sun: NearbySun
    best: ScoredPoint
    points: tuple[ScoredPoint, ...]
    skipped_points: int


def candidate_points(core: PreparedMap, lat_deg: float, lon_deg: float) -> tuple[CandidatePoint, ...]:
    """All map pixel centres within 160 map metres, boundary included, in row order.

    Geometry is vectorised on a bounded window, never over the full map. The
    1e-8-pixel snapping matches PreparedMap.coordinates/sample round-trip handling;
    a one-micrometre boundary allowance covers projection floating-point error.
    Missing heights remain in this geometric set and are counted by the evaluator.
    """
    m = core.meta
    if m['pixel_x'] != 80 or m['pixel_y'] != -80:
        raise ValueError('placement requires the 80 m map with rows toward -y')
    row, col = np.asarray(core.coordinates(lat_deg, lon_deg), dtype=float)
    if not np.isfinite([row, col]).all():
        raise ValueError('placement requires finite listed coordinates')
    row, col = np.where(np.abs(np.array([row, col]) - np.rint([row, col])) < 1e-8,
                        np.rint([row, col]), [row, col])
    rows, cols = np.meshgrid(
        np.arange(max(0, int(np.floor(row-2))), min(core.data.shape[0], int(np.ceil(row+2))+1)),
        np.arange(max(0, int(np.floor(col-2))), min(core.data.shape[1], int(np.ceil(col+2))+1)),
        indexing='ij')
    offsets = np.hypot((cols-col)*80, (rows-row)*80)
    keep = offsets <= RADIUS_M + 1e-6
    rows, cols, offsets = rows[keep], cols[keep], offsets[keep]
    lat, lon = polar_stereo_inverse(m['origin_x'] + (cols+.5)*m['pixel_x'],
                                   m['origin_y'] + (rows+.5)*m['pixel_y'])
    return tuple(CandidatePoint(int(r), int(c), float(a), float(b), float(d))
                 for r, c, a, b, d in zip(rows, cols, lat, lon, offsets))


def mean_sun_for_point(store: DemStore, point: CandidatePoint,
                       global_ephemeris: Mapping[str, np.ndarray]) -> float:
    """Own ground, own skyline, own unquantised series; mean over the supplied grid.

    Part B can wrap this calculation to retain each skyline and series for reuse
    when writing the winning variant. No ephemeris loading or caching happens here.
    """
    ground, missing = store.sample(point.lat_deg, point.lon_deg)
    if missing or not np.isfinite(ground):
        raise ValueError('candidate ground is missing; cannot place observer')
    skyline = compute_skyline(store, point.lat_deg, point.lon_deg)
    series = build_series(point.lat_deg, point.lon_deg, float(ground), skyline.el_deg,
                          global_ephemeris)
    return float(np.mean(series.columns['sun_frac']))


def evaluate_placement(site: CatalogSite, store: DemStore, *,
                       global_ephemeris: Mapping[str, np.ndarray] | None = None,
                       mean_for_point: Callable[[CandidatePoint], float] | None = None,
                       ) -> PlacementResult | None:
    """Evaluate only core80 sunlit_peak catalog sites; otherwise return None.

    Inject ``mean_for_point(point) -> float`` for offline tests or a cache. Without
    it, supply the global ephemeris and use the real skyline/series calculation.
    Missing candidate pixels are skipped and counted; the listed point's containing
    pixel must be usable. Evaluation errors propagate, rather than masquerading as
    missing terrain. Ties: highest mean, nearest offset, smallest row, smallest col.
    Only exact equality of computed means and offsets is a tie.
    """
    if site.group != 'sunlit_peak' or site_tier(site.lat_deg).item() != 'core80':
        return None
    core = store.core
    if core is None or not core.contains(site.lat_deg, site.lon_deg):
        raise ValueError(f'{site.id}: listed point pixel is unusable in the 80 m map')
    row, col = core.coordinates(site.lat_deg, site.lon_deg)
    own_row, own_col = int(np.floor(row+.5)), int(np.floor(col+.5))
    if not np.isfinite(core.data[own_row, own_col]):
        raise ValueError(f'{site.id}: listed point pixel is unusable (missing terrain)')
    if mean_for_point is None:
        if global_ephemeris is None:
            raise ValueError('global_ephemeris or mean_for_point is required')
        def mean_for_point(point):
            return mean_sun_for_point(store, point, global_ephemeris)
    candidates = candidate_points(core, site.lat_deg, site.lon_deg)
    points = []
    skipped = 0
    # Each candidate is an independent full skyline/series job, not a terrain loop.
    for point in candidates:
        if not np.isfinite(core.data[point.row, point.col]):
            skipped += 1
            continue
        mean = float(mean_for_point(point))
        if not np.isfinite(mean) or not 0 <= mean <= 1:
            raise ValueError('candidate mean must be a finite fraction from 0 to 1')
        points.append(ScoredPoint(point, mean))
    if not points:
        raise ValueError(f'{site.id}: no usable nearby pixel centres')
    best = min(points, key=lambda p: (-p.mean_sun_frac, p.point.offset_m,
                                     p.point.row, p.point.col))
    nearby = NearbySun(radius_m=RADIUS_M, points=len(points),
                       min=min(p.mean_sun_frac for p in points), max=best.mean_sun_frac)
    return PlacementResult(nearby, best, tuple(points), skipped)


def build_variant(site: CatalogSite, placement: PlacementResult | None) -> dict[str, object] | None:
    """Return the variant's site fields, or None when placement does not apply.

    This is a partial Site record, deliberately not CatalogSite (variants are never
    catalog inputs). Part B supplies terrain_tier, has_closeup, elevation_m, slope,
    quickmap_url and moontrek_url by its normal site processing, then validates Site.
    Attach placement.nearby_sun to the listed Site as well. The input is unchanged.
    """
    if placement is None or site.group != 'sunlit_peak' or site_tier(site.lat_deg).item() != 'core80':
        return None
    point = placement.best.point
    return dict(id=f'{site.id}_best_lit', name=f'{site.name}, best-lit point', group=site.group,
        lat_deg=point.lat_deg, lon_deg=point.lon_deg, variant_of=site.id, offset_m=point.offset_m,
        nearby_sun=placement.nearby_sun.model_dump(), outcome=None, source_url=PLACEMENT_SOURCE_URL,
        description=(f'TrueSouth chose this best-lit 80 m map pixel within 160 m of '
                     f"{site.name}'s listed point by its own sunlight calculation. "
                     f'It is {point.offset_m:.1f} m from the listed point. '
                     'It is not a published site; its sunlight is an upper reading.'))
