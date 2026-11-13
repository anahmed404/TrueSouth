"""Python reference for gate G10: compare the TypeScript port against shared cases.

Browser order: hour_flags, evaluate, slip_sweep, countdowns. All inputs are decoded
section 7 series columns; no terrain or ephemeris calculations happen here.
"""

from dataclasses import dataclass
from typing import Mapping

import numpy as np
from numpy.typing import NDArray

from truesouth.constants import GO_SCORE_THRESHOLD
from truesouth.contracts import MissionProfile


@dataclass(frozen=True)
class Metrics:
    sun_fraction_mean: float
    lit_fraction: float
    longest_dark_h: int
    link_fraction: float
    longest_blackout_h: int
    landing_sun_el_deg: float
    landing_lit: bool


@dataclass(frozen=True)
class Veto:
    triggered: bool
    measured: float | bool | None
    limit: float | bool | None


@dataclass(frozen=True)
class Utilities:
    slope: float | None
    power: float
    comms: float


@dataclass(frozen=True)
class Evaluation:
    metrics: Metrics
    vetoes: dict[str, Veto]
    utilities: Utilities
    score: float
    status: str
    slope_not_assessed: bool


@dataclass(frozen=True)
class Countdowns:
    sunset: float | None
    sunrise: float | None
    earthset: float | None
    earthrise: float | None


def hour_flags(series: Mapping[str, NDArray], profile: MissionProfile) -> tuple[NDArray, NDArray]:
    """Calculate per-hour lit and link flags (docs/science.md §9)."""
    lit = np.asarray(series['sun_frac']) >= profile.min_sun_fraction
    if profile.ops_sun_el_min_deg is not None:
        lit = lit & (np.asarray(series['sun_el']) >= profile.ops_sun_el_min_deg)
    link = np.ones_like(lit, dtype=bool) if profile.relay_available else np.asarray(series['earth_clear']) >= profile.antenna_mask_deg
    return lit, link


def _longest_windows(flags: NDArray, n: int) -> NDArray:
    """Find longest true runs inside each window (docs/science.md §§9, 11)."""
    windows = np.lib.stride_tricks.sliding_window_view(flags, n)
    result = np.empty(len(windows), dtype=int)
    # Bound temporary arrays while vectorising both the hours and the landing dates.
    batch = max(1, 1_000_000 // n)
    for start in range(0, len(windows), batch):
        block = windows[start:start + batch]
        indices = np.arange(1, n + 1)
        last_false = np.maximum.accumulate(np.where(block, 0, indices), axis=1)
        result[start:start + len(block)] = np.max(np.where(block, indices - last_false, 0), axis=1)
    return result


def _means(values: NDArray, n: int) -> NDArray:
    """Compute window means using prefix sums (docs/science.md §11)."""
    sums = np.concatenate(([0.0], np.cumsum(values, dtype=np.float64)))
    return (sums[n:] - sums[:-n]) / n


def _evaluation(metrics: Metrics, profile: MissionProfile, slope_deg: float | None) -> Evaluation:
    """Apply vetoes, utilities, score and status (docs/science.md §10)."""
    p = profile
    vetoes = {
        'slope': Veto(slope_deg is not None and slope_deg > p.max_slope_deg, slope_deg, p.max_slope_deg),
        'darkness': Veto(metrics.longest_dark_h > p.max_dark_h, metrics.longest_dark_h, p.max_dark_h),
        'blackout': Veto(not p.relay_available and metrics.longest_blackout_h > p.max_blackout_h, metrics.longest_blackout_h, p.max_blackout_h),
        'landing_dark': Veto(not metrics.landing_lit, metrics.landing_lit, True),
        'landing_sun_low': Veto(p.landing_sun_el_min_deg is not None and metrics.landing_sun_el_deg < p.landing_sun_el_min_deg, metrics.landing_sun_el_deg, p.landing_sun_el_min_deg),
        'landing_sun_high': Veto(p.landing_sun_el_max_deg is not None and metrics.landing_sun_el_deg > p.landing_sun_el_max_deg, metrics.landing_sun_el_deg, p.landing_sun_el_max_deg),
    }
    def g(x: float, m: float) -> float:
        """Compute g for power and comms (docs/science.md §10)."""
        return max(0.0, 1 - x / m) if m > 0 else 1.0
    if slope_deg is not None and p.max_slope_deg == p.slope_ideal_deg:
        raise ValueError('slope utility is undefined when max_slope_deg equals slope_ideal_deg')
    slope = None if slope_deg is None else float(np.clip((p.max_slope_deg - slope_deg) / (p.max_slope_deg - p.slope_ideal_deg), 0, 1))
    power = metrics.sun_fraction_mean * g(metrics.longest_dark_h, p.max_dark_h)
    comms = 1.0 if p.relay_available else metrics.link_fraction * g(metrics.longest_blackout_h, p.max_blackout_h)
    weights = p.weights
    numerator = weights.power * power + weights.comms * comms
    denominator = weights.power + weights.comms
    if slope is not None:
        numerator += weights.slope * slope
        denominator += weights.slope
    if denominator == 0:
        raise ValueError('score is undefined when assessed weights sum to zero')
    score = 100 * numerator / denominator
    status = 'NO-GO' if any(v.triggered for v in vetoes.values()) else 'GO' if score >= GO_SCORE_THRESHOLD else 'CAUTION'
    return Evaluation(metrics, vetoes, Utilities(slope, power, comms), score, status, slope is None)


def slip_sweep(series: Mapping[str, NDArray], profile: MissionProfile, slope_deg: float | None) -> list[Evaluation | None]:
    """Evaluate each landing hour using window operations (docs/science.md §§9-11)."""
    lit, link = hour_flags(series, profile)
    count = len(lit)
    n = round(24 * profile.duration_days)
    if n <= 0:
        raise ValueError('mission window must contain at least one hour')
    if n > count:
        return [None] * count
    sun_mean = _means(np.asarray(series['sun_frac']), n)
    lit_mean = _means(lit, n)
    link_mean = _means(link, n)
    dark = _longest_windows(~lit, n)
    blackout = _longest_windows(~link, n)
    results = [_evaluation(Metrics(float(sun_mean[i]), float(lit_mean[i]), int(dark[i]), float(link_mean[i]), int(blackout[i]), float(series['sun_el'][i]), bool(lit[i])), profile, slope_deg) for i in range(count - n + 1)]
    return results + [None] * (n - 1)


def evaluate(series: Mapping[str, NDArray], profile: MissionProfile, landing_hour: int, slope_deg: float | None) -> Evaluation | None:
    """Evaluate one mission window or return no result (docs/science.md §§9-10)."""
    count = len(series['sun_frac'])
    n = round(24 * profile.duration_days)
    if landing_hour < 0 or landing_hour >= count:
        raise IndexError('landing hour is outside the time grid')
    if n <= 0:
        raise ValueError('mission window must contain at least one hour')
    if landing_hour + n > count:
        return None
    lit, link = hour_flags(series, profile)
    stop = landing_hour + n
    sun_mean = _means(np.asarray(series['sun_frac']), n)[landing_hour]
    lit_mean = _means(lit, n)[landing_hour]
    link_mean = _means(link, n)[landing_hour]
    dark = _longest_windows(~lit[landing_hour:stop], n)[0]
    blackout = _longest_windows(~link[landing_hour:stop], n)[0]
    metrics = Metrics(float(sun_mean), float(lit_mean), int(dark), float(link_mean), int(blackout),
                      float(series['sun_el'][landing_hour]), bool(lit[landing_hour]))
    return _evaluation(metrics, profile, slope_deg)


def countdowns(series: Mapping[str, NDArray], profile: MissionProfile, current_hour: int) -> Countdowns:
    """Find interpolated Sun and Earth threshold crossings (docs/science.md §9)."""
    def crossing(values: NDArray, threshold: float, rising: bool) -> float | None:
        """Interpolate the next threshold crossing (docs/science.md §9)."""
        values = np.asarray(values, dtype=float)[current_hour:]
        left, right = values[:-1], values[1:]
        mask = (left < threshold) & (right >= threshold) if rising else (left >= threshold) & (right < threshold)
        indices = np.flatnonzero(mask)
        if not len(indices):
            return None
        i = int(indices[0])
        return float(i + (threshold - left[i]) / (right[i] - left[i]))
    if current_hour < 0 or current_hour >= len(series['sun_frac']):
        raise IndexError('current hour is outside the time grid')
    return Countdowns(crossing(series['sun_frac'], profile.min_sun_fraction, False),
                      crossing(series['sun_frac'], profile.min_sun_fraction, True),
                      crossing(series['earth_clear'], profile.antenna_mask_deg, False),
                      crossing(series['earth_clear'], profile.antenna_mask_deg, True))
