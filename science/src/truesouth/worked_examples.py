"""Worked-example numbers for the Academy, from stored derived data.

Selection rules are pure functions of decoded arrays. The command in
``commands/build_worked_examples.py`` reads the files and writes the JSON.
Lessons 1 to 4 follow the decisions of 2026-11-13. Lessons 5 to 8 follow the
table in ``docs/academy/lessons.md``; a key that table cannot compute is null.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from itertools import combinations

import numpy as np

from truesouth.contracts import Manifest, Profiles, Sites, WorkedExamples
from truesouth.derived_io import read_series, read_skyline, read_system
from truesouth.scoring import hour_flags, slip_sweep, window_length

STORY_SITE_ID = 'connecting_ridge'
STORY_PROFILE_ID = 'im2_athena'
STORY_YEAR = 2028
STORY_MONTH_HOURS = 720
LESSON2_CLEAR_MIN_DEG = -0.5
LESSON2_CLEAR_MAX_DEG = -0.1
LESSON2_MIN_DIST_KM = 5.0
MASK_COUNT = 21
MASK_STEP_DEG = 0.5
LINK_BELOW_PCT = 15.0
SLIP_DAYS = 21
RIDGE_FEATURE = 'Unnamed terrain'
MASKS_DEG = tuple(index * MASK_STEP_DEG for index in range(MASK_COUNT))

RULE_STORY_LANDING = 'story landing'
RULE_LESSON2 = 'lesson 2 hour'
RULE_LESSON4_MASK = 'lesson 4 mask under 15 percent'


class MissingSelection(Exception):
    """A rule that must find an example found nothing. The command writes no file."""

    def __init__(self, rule):
        self.rule = rule
        super().__init__(f'build-worked-examples stopped: {rule} found nothing')


@dataclass(frozen=True)
class ExampleKey:
    key: str
    lesson: str
    unit: str
    definition: str
    source: str


def _row(key, lesson, unit, definition, source):
    return ExampleKey(key, lesson, unit, definition, source)


# One sentence each. Where the 2026-11-13 decisions replace the table, these follow the decisions.
EXAMPLES = (
    _row('l1.sun_el_max_deg', '1', 'deg', 'Maximum Sun elevation in the story month.', 'Story series sun_el.'),
    _row('l1.sun_el_min_deg', '1', 'deg', 'Minimum Sun elevation in the story month.', 'Story series sun_el.'),
    _row('l1.site_lat_deg', '1', 'deg north', 'Latitude of the story site.', 'sites.json lat_deg.'),
    _row('l1.example_utc', '1', 'UTC', 'Timestamp of the story-month hour with the highest Sun elevation; a tie is the earliest hour.', 'Story series sun_el and the time grid.'),
    _row('l1.example_subsolar_lat', '1', 'deg north', 'Stored sub-solar latitude at the lesson 1 hour.', 'system.bin subsolar_lat.'),
    _row('l1.example_subsolar_lon', '1', 'deg east', 'Stored sub-solar east longitude at the lesson 1 hour.', 'system.bin subsolar_lon.'),
    _row('l1.example_sun_az', '1', 'deg', 'Stored Sun azimuth at the lesson 1 hour.', 'Story series sun_az.'),
    _row('l1.example_sun_el', '1', 'deg', 'Stored Sun elevation at the lesson 1 hour.', 'Story series sun_el.'),
    _row('l2.site_id', '2', 'site id', 'Catalog site of the lesson 2 hour: the story site, else the other sunlit_peak sites by id, never a best-lit variant.', 'sites.json id and group.'),
    _row('l2.site_name', '2', 'text', 'Display name of the lesson 2 site.', 'sites.json name.'),
    _row('l2.example_utc', '2', 'UTC', 'First hour in 2028 at that site with the Sun up, clearance from -0.5 to -0.1 degrees, and a blocker beyond 5 km that stands above the observer.', 'Series sun_el, sun_clear, sun_az; skyline dist_km and height_m.'),
    _row('l2.sun_el_deg', '2', 'deg', 'Sun elevation at the lesson 2 hour.', 'Lesson 2 series sun_el.'),
    _row('l2.sun_az_deg', '2', 'deg', 'Sun azimuth at the lesson 2 hour.', 'Lesson 2 series sun_az.'),
    _row('l2.ridge_dist_km', '2', 'km', 'Ground distance of the blocker in the Sun azimuth\'s nearest skyline bin.', 'Lesson 2 skyline dist_km.'),
    _row('l2.ridge_rise_m', '2', 'm', 'That blocker\'s height above the observer, from science section 4.', 'Skyline height_m, site elevation and observer height.'),
    _row('l2.ridge_el_deg', '2', 'deg', 'Stored elevation of that nearest bin.', 'Lesson 2 skyline el_deg.'),
    _row('l2.ridge_feature', '2', 'text', 'The label Unnamed terrain, because the selection has no sourced feature name.', 'Lesson 2 blocker selection.'),
    _row('l2.sun_frac', '2', 'fraction', 'Visible Sun disc at the lesson 2 hour.', 'Lesson 2 series sun_frac.'),
    _row('l3.drop_at_20km_m', '3', 'm', 'Section 4 curvature drop, distance squared over 2R, at 20 km.', 'manifest.json moon_radius_m.'),
    _row('l3.drop_at_60km_m', '3', 'm', 'The same curvature drop at 60 km.', 'manifest.json moon_radius_m.'),
    _row('l3.drop_at_130km_m', '3', 'm', 'The same curvature drop at 130 km.', 'manifest.json moon_radius_m.'),
    _row('l3.example_bin_az', '3', 'deg', 'Centre azimuth of the story skyline bin whose blocker is farthest; a tie takes the lowest azimuth.', 'Story skyline dist_km and bin count.'),
    _row('l3.example_dist_km', '3', 'km', 'Ground distance of that bin\'s blocker.', 'Story skyline dist_km.'),
    _row('l3.example_height_m', '3', 'm', 'That blocker\'s height above the observer. It may be negative.', 'Skyline height_m, story elevation and observer height.'),
    _row('l3.example_el_flat_deg', '3', 'deg', 'Flat-Moon elevation from that height and ground distance, without the curvature drop.', 'The lesson 3 blocker and observer.'),
    _row('l3.example_el_true_deg', '3', 'deg', 'Stored curved-Moon elevation of that bin.', 'Story skyline el_deg.'),
    _row('l4.earth_el_max_deg', '4', 'deg', 'Maximum Earth elevation in the story month.', 'Story series earth_el.'),
    _row('l4.earth_el_min_deg', '4', 'deg', 'Minimum Earth elevation in the story month.', 'Story series earth_el.'),
    _row('l4.earth_up_pct', '4', 'percent', 'Percentage of story-month hours with any visible Earth disc.', 'Story series earth_frac.'),
    _row('l4.link_pct_by_mask', '4', 'percent', 'Direct-link share of the story month at masks 0, 0.5, ... 10 degrees, with no relay.', 'Story series earth_clear and science section 9.'),
    _row('l4.link_pct_mask0', '4', 'percent', 'Direct-link share of the story month at a 0 degree mask.', 'Story series earth_clear.'),
    _row('l4.link_pct_mask1', '4', 'percent', 'Direct-link share of the story month at a 1 degree mask.', 'Story series earth_clear.'),
    _row('l4.link_pct_mask5', '4', 'percent', 'Direct-link share of the story month at a 5 degree mask.', 'Story series earth_clear.'),
    _row('l4.mask_for_15pct_deg', '4', 'deg', 'Smallest mask from that list whose direct-link share is below 15 percent. Exactly 15 is not below.', 'l4.link_pct_by_mask.'),
    _row('l4.example_utc', '4', 'UTC', 'Story-month hour whose Earth clearance is closest to the profile antenna mask; a tie is the earliest hour.', 'Story series earth_clear and the profile mask.'),
    _row('l4.example_earth_az', '4', 'deg', 'Earth azimuth at the lesson 4 hour.', 'Story series earth_az.'),
    _row('l4.example_earth_el', '4', 'deg', 'Earth elevation at the lesson 4 hour.', 'Story series earth_el.'),
    _row('l4.example_earth_clear', '4', 'deg', 'Earth clearance at the lesson 4 hour.', 'Story series earth_clear.'),
    _row('l5.slope_10m_deg', '5', 'deg', 'Not computed: science section 8 defines no 10 m slope.', 'None. The key is null.'),
    _row('l5.slope_100m_deg', '5', 'deg', 'Not computed: the close-up plane fit needs heights that are not stored.', 'None. The key is null.'),
    _row('l5.slope_160m_deg', '5', 'deg', 'Stored polar slope of the story site, and only when its baseline is 160 m.', 'sites.json slope.'),
    _row('l5.example_site', '5', 'site id', 'The story site.', 'sites.json id.'),
    _row('l5.plane_a', '5', 'rise/run', 'Not computed: the close-up plane fit is absent.', 'None. The key is null.'),
    _row('l5.plane_b', '5', 'rise/run', 'Not computed: the close-up plane fit is absent.', 'None. The key is null.'),
    _row('l6.site_a', '6', 'site id', 'Highest-scoring polar catalog site with no veto at the story landing hour; a tie takes the smallest id.', 'Polar series, stored slopes, profile and science sections 9-10.'),
    _row('l6.site_b', '6', 'site id', 'Second site in that order, or null when fewer than two pass.', 'The same evaluations.'),
    _row('l6.a_score', '6', 'score', 'Score of site A at the story landing hour.', 'Site A series, slope and profile.'),
    _row('l6.b_score', '6', 'score', 'Score of site B at that hour, or null when B was not selected.', 'Site B series, slope and profile.'),
    _row('l6.example_metrics.sun_fraction_mean', '6', 'fraction', 'Mean Sun disc fraction in the story mission window.', 'Story series sun_frac and the profile duration.'),
    _row('l6.example_metrics.lit_fraction', '6', 'fraction', 'Share of lit hours in the story mission window.', 'Story series and the profile.'),
    _row('l6.example_metrics.longest_dark_h', '6', 'h', 'Longest dark stretch in the story mission window.', 'Story lit flags and the profile.'),
    _row('l6.example_metrics.link_fraction', '6', 'fraction', 'Share of linked hours in the story mission window.', 'Story series earth_clear and the profile.'),
    _row('l6.example_metrics.longest_blackout_h', '6', 'h', 'Longest blackout in the story mission window.', 'Story link flags and the profile.'),
    _row('l6.example_metrics.landing_sun_el_deg', '6', 'deg', 'Stored Sun elevation at the story landing hour.', 'Story series sun_el.'),
    _row('l6.example_metrics.landing_lit', '6', 'boolean', 'Whether the story landing hour is lit.', 'Story series and the profile.'),
    _row('l6.example_utilities.slope', '6', 'fraction', 'Slope utility of the story site\'s stored slope.', 'sites.json slope and the profile.'),
    _row('l6.example_utilities.power', '6', 'fraction', 'Power utility of the story mission window.', 'Story metrics and the profile.'),
    _row('l6.example_utilities.comms', '6', 'fraction', 'Comms utility of the story mission window.', 'Story metrics and the profile.'),
    _row('l6.example_score', '6', 'score', 'Score of the story mission window.', 'Story metrics, utilities and profile weights.'),
    _row('l7.go_date', '7', 'UTC', 'First 2028 midnight that is GO at the story site and is NO-GO 21 days later with the blackout veto.', 'Story series, slope, profile and the midnight grid.'),
    _row('l7.slip_date', '7', 'UTC', 'That landing moved exactly 21 UTC days later.', 'The lesson 7 landing and the time grid.'),
    _row('l7.slip_vetoes', '7', 'ids', 'Veto ids triggered on the slipped window, in section 10 order.', 'The slipped evaluation.'),
    _row('l7.slip_blackout_h', '7', 'h', 'Longest blackout in the slipped mission window.', 'Story series earth_clear and the profile.'),
    _row('l7.next_go_date', '7', 'UTC', 'First GO midnight strictly after the slipped date and still in 2028.', 'Story midnight evaluations.'),
    _row('l7.alt_site', '7', 'site id', 'Smallest polar catalog id that is GO at the slipped date, or null when none is.', 'Polar series, slopes and the profile.'),
    _row('l8.candidates', '8', 'ids', 'Lexicographically first four distinct polar catalog ids with at least one GO midnight in 2028 and at least one with none.', 'Polar midnight evaluations.'),
    _row('l8.region_overlap.site_id', '8', 'site id', 'Smallest candidate id that has a GO midnight in 2028.', 'The candidate tuple.'),
    _row('l8.region_overlap.region_name', '8', 'text', 'Not computed: official Artemis polygon outlines are not stored. Missing outlines are unknown, not a name.', 'None. The key is null.'),
    _row('l8.region_overlap.overlaps', '8', 'boolean', 'Not computed: official Artemis polygon outlines are not stored. Missing outlines are unknown, not false.', 'None. The key is null.'),
    _row('story.site_id', 'story', 'site id', 'The story site, the catalog point and not its best-lit variant.', 'docs/academy/lessons.md.'),
    _row('story.profile_id', 'story', 'profile id', 'The story profile.', 'docs/academy/lessons.md.'),
    _row('story.landing_utc', 'story', 'UTC', 'First GO midnight in 2028 at the story site and profile; if none is GO, the first CAUTION midnight.', 'Story series, slope, profile and the midnight grid.'),
    _row('story.month_end_utc', 'story', 'UTC', 'Exclusive end of the 720 stored hours that start at the story landing.', 'The story landing and the time grid.'),
    _row('story.window_end_utc', 'story', 'UTC', 'Exclusive end of the mission window that starts at the story landing.', 'The profile duration and science section 9.'),
)


def parse_utc(text):
    """Parse a UTC timestamp that ends in Z."""
    return datetime.fromisoformat(text.replace('Z', '+00:00'))


def format_utc(moment):
    """Format a timezone-aware instant as UTC ISO-8601 ending in Z."""
    return moment.astimezone(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')


def hour_at(start, index):
    return start + timedelta(hours=index)


def indexes_in_year(start, count, year, *, midnight=False):
    """Hour indexes whose UTC time falls in ``year``. Midnight keeps 00:00 only."""
    found = []
    for index in range(count):
        moment = hour_at(start, index)
        if moment.year != year:
            continue
        if midnight and (moment.hour, moment.minute, moment.second) != (0, 0, 0):
            continue
        found.append(index)
    return found


def nearest_bin(azimuth_deg, bins):
    """Nearest skyline bin: round the bin position half up, then wrap at 360 degrees."""
    position = np.mod(np.asarray(azimuth_deg, dtype=float), 360.0) * (bins / 360.0)
    index = np.floor(position + 0.5).astype(np.int64) % bins
    if np.ndim(azimuth_deg) == 0:
        return int(index)
    return index


def height_above_observer(height_m, elevation_m, observer_height_m):
    """Section 4's height difference, z - z0 - h_obs, in metres. NaN when elevation is unknown."""
    height = np.asarray(height_m, dtype=float)
    if elevation_m is None:
        return np.full(height.shape, np.nan)
    return height - float(elevation_m) - float(observer_height_m)


def first_extreme_hour(values, eligible, *, pick):
    """Earliest hour of the maximum or minimum among eligible hours, or None."""
    values = np.asarray(values, dtype=float)
    eligible = np.asarray(eligible, dtype=bool)
    if values.shape != eligible.shape or not eligible.any():
        return None
    scored = np.where(eligible, values, -np.inf if pick == 'max' else np.inf)
    index = int(np.argmax(scored) if pick == 'max' else np.argmin(scored))
    if not eligible[index] or not np.isfinite(values[index]):
        return None
    return index


def closest_hour(values, target, eligible):
    """Earliest eligible hour whose value is closest to ``target``, or None."""
    values = np.asarray(values, dtype=float)
    eligible = np.asarray(eligible, dtype=bool)
    if values.shape != eligible.shape or not eligible.any():
        return None
    distance = np.abs(values - target)
    distance = np.where(eligible & np.isfinite(distance), distance, np.inf)
    index = int(np.argmin(distance))
    if not np.isfinite(distance[index]):
        return None
    return index


def first_lesson2_hour(sun_el, sun_clear, sun_az, dist_km, height_m, eligible, *, elevation_m, observer_height_m):
    """First eligible hour matching the lesson 2 ridge rule, or None.

    The Sun is above the horizon, clearance is from -0.5 to -0.1 degrees
    inclusive, and the nearest bin's blocker is beyond 5 km and above the
    observer. A blocker that is far but below the observer does not count.
    """
    sun_el = np.asarray(sun_el, dtype=float)
    sun_clear = np.asarray(sun_clear, dtype=float)
    eligible = np.asarray(eligible, dtype=bool)
    bins = len(dist_km)
    if bins < 1 or sun_el.shape != eligible.shape:
        return None
    chosen = nearest_bin(sun_az, bins)
    rise = height_above_observer(np.asarray(height_m, dtype=float)[chosen], elevation_m, observer_height_m)
    distance = np.asarray(dist_km, dtype=float)[chosen]
    matches = (
        eligible
        & (sun_el > 0)
        & (sun_clear >= LESSON2_CLEAR_MIN_DEG)
        & (sun_clear <= LESSON2_CLEAR_MAX_DEG)
        & (distance > LESSON2_MIN_DIST_KM)
        & (rise > 0)
        & np.isfinite(distance)
        & np.isfinite(rise)
    )
    found = np.flatnonzero(matches)
    return None if found.size == 0 else int(found[0])


def lesson2_site_order(story_id, sites):
    """Story site first, then other catalog sunlit_peak sites by id. Never a best-lit variant."""
    others = sorted(
        site.id for site in sites
        if site.group == 'sunlit_peak' and site.variant_of is None and site.id != story_id
    )
    return [story_id, *others]


def is_polar_catalog(site):
    """A catalog site that is not an equatorial contrast site and not a best-lit variant."""
    return site.variant_of is None and site.group != 'contrast'


def most_distant_blocker(dist_km):
    """Index of the farthest finite blocker. A tie takes the lowest index. None when every distance is NaN."""
    distance = np.asarray(dist_km, dtype=float)
    finite = np.isfinite(distance)
    if not finite.any():
        return None
    scored = np.where(finite, distance, -np.inf)
    best = scored.max()
    return int(np.flatnonzero(scored == best)[0])


def bin_azimuth_deg(index, bins):
    return index * (360.0 / bins)


def curvature_drop_m(distance_km, moon_radius_m):
    """Section 4's s^2 / 2R, with s in metres and R the manifest Moon radius."""
    distance_m = float(distance_km) * 1000.0
    return distance_m * distance_m / (2.0 * float(moon_radius_m))


def flat_elevation_deg(rise_m, distance_km):
    """Flat version of section 4: arctan(height above the observer / ground distance), in degrees."""
    return float(np.degrees(np.arctan2(float(rise_m), float(distance_km) * 1000.0)))


def any_earth_percent(earth_frac):
    """Percentage of hours with earth_frac strictly greater than zero."""
    values = np.asarray(earth_frac, dtype=float)
    if values.size == 0:
        return None
    return 100.0 * float(np.count_nonzero(values > 0)) / values.size


def direct_link_percentages(series, profile, masks=MASKS_DEG):
    """Percent of hours with a direct link at each mask. No relay, using scoring.hour_flags."""
    shares = []
    for mask in masks:
        tuned = profile.model_copy(update={'relay_available': False, 'antenna_mask_deg': float(mask)})
        link = hour_flags(series, tuned)[1]
        shares.append(100.0 * float(np.count_nonzero(link)) / len(link))
    return shares


def first_mask_below(percentages, threshold=LINK_BELOW_PCT, masks=MASKS_DEG):
    """Smallest mask whose share is strictly below ``threshold``, or None. Exactly the threshold is not below."""
    for mask, share in zip(masks, percentages):
        if share < threshold:
            return float(mask)
    return None


def story_landing_index(midnight_indexes, evaluations):
    """First GO midnight, else the first CAUTION midnight, else None."""
    caution = None
    for index in midnight_indexes:
        result = evaluations[index] if index < len(evaluations) else None
        if result is None:
            continue
        if result.status == 'GO':
            return index
        if result.status == 'CAUTION' and caution is None:
            caution = index
    return caution


def passing_sites(rows):
    """Sites with an evaluation and no triggered veto, highest score first, then smallest id."""
    kept = []
    for site_id, result in rows:
        if result is None or any(veto.triggered for veto in result.vetoes.values()):
            continue
        kept.append((site_id, result))
    kept.sort(key=lambda item: (-item[1].score, item[0]))
    return kept


def lesson7_landing_index(midnight_indexes, evaluations):
    """First GO midnight that is NO-GO 21 days later with the blackout veto, or None."""
    slip = SLIP_DAYS * 24
    for index in midnight_indexes:
        result = evaluations[index] if index < len(evaluations) else None
        slipped_index = index + slip
        slipped = evaluations[slipped_index] if slipped_index < len(evaluations) else None
        if result is None or slipped is None:
            continue
        if result.status == 'GO' and slipped.status == 'NO-GO' and slipped.vetoes['blackout'].triggered:
            return index
    return None


def next_go_index(after, midnight_indexes, evaluations):
    """First GO midnight strictly after ``after``, or None."""
    for index in midnight_indexes:
        if index <= after:
            continue
        result = evaluations[index] if index < len(evaluations) else None
        if result is not None and result.status == 'GO':
            return index
    return None


def lesson8_candidates(go_by_id):
    """Lexicographically first sorted 4-tuple with both a GO site and a site that has none."""
    ordered = sorted(go_by_id)
    for combo in combinations(ordered, 4):
        flags = [go_by_id[site_id] for site_id in combo]
        if any(flags) and not all(flags):
            return list(combo)
    return None


def triggered_vetoes(result):
    """Triggered veto ids in the section 10 order stored on the evaluation."""
    return [name for name, veto in result.vetoes.items() if veto.triggered]


def _number(value):
    number = float(value)
    if not np.isfinite(number):
        raise ValueError('a worked example number is not finite')
    return number


def _require(value, rule):
    if value is None:
        raise MissingSelection(rule)
    return value


def _load(root, story_site_id=STORY_SITE_ID):
    manifest = Manifest.model_validate_json((root / 'manifest.json').read_bytes())
    if manifest.time_grid.step_s != 3600:
        raise ValueError('worked examples need an hourly time grid')
    sites = Sites.model_validate_json((root / 'sites.json').read_bytes()).root
    profiles = Profiles.model_validate_json((root / 'profiles.json').read_bytes()).root
    profile = next((item for item in profiles if item.id == STORY_PROFILE_ID), None)
    if profile is None:
        raise ValueError(f'{STORY_PROFILE_ID} is not in profiles.json')
    by_id = {site.id: site for site in sites}
    story = by_id.get(story_site_id)
    if story is None or story.variant_of is not None:
        raise ValueError(f'{story_site_id} is not a catalog site in sites.json')
    count = manifest.time_grid.count
    system = read_system(root / 'system.bin', count)
    return manifest, sites, by_id, story, profile, system


def _site_arrays(root, site_id, count, bins):
    folder = root / 'sites' / site_id
    series = read_series(folder / 'series.bin', count)
    skyline = read_skyline(folder / 'skyline.bin', bins)
    return series, skyline


def _sweeps(root, sites, profile, count, bins_for, story_site_id=STORY_SITE_ID):
    """One slip sweep per polar catalog site, plus the story site if it is not already included."""
    chosen = [site for site in sites if is_polar_catalog(site)]
    if all(site.id != story_site_id for site in chosen):
        chosen.append(next(site for site in sites if site.id == story_site_id))
    results = {}
    for site in chosen:
        _bins = bins_for(site.id)
        series, _skyline = _site_arrays(root, site.id, count, _bins)
        slope = None if site.slope is None else site.slope.deg
        results[site.id] = (series, slip_sweep(series, profile, slope), slope)
    return results


def build_examples(root, *, story_site_id=STORY_SITE_ID):
    """Read a derived tree and return the validated worked examples. Raise MissingSelection to write nothing."""
    root = root if hasattr(root, 'joinpath') else __import__('pathlib').Path(root)
    manifest, sites, by_id, story, profile, system = _load(root, story_site_id)
    count = manifest.time_grid.count
    start = parse_utc(manifest.time_grid.start_utc)
    observer_m = manifest.observer_height_m
    radius_m = manifest.moon_radius_m

    def bins_for(site_id):
        from truesouth.contracts import SiteMeta
        meta = SiteMeta.model_validate_json((root / 'sites' / site_id / 'meta.json').read_bytes())
        if meta.site_id != site_id:
            raise ValueError(f'{site_id}: metadata belongs to {meta.site_id}')
        return meta.skyline.bins

    sweeps = _sweeps(root, sites, profile, count, bins_for, story_site_id)
    story_series, story_sweep, _story_slope = sweeps[story_site_id]
    year = indexes_in_year(start, count, STORY_YEAR)
    midnights = indexes_in_year(start, count, STORY_YEAR, midnight=True)
    landing = _require(story_landing_index(midnights, story_sweep), RULE_STORY_LANDING)
    if landing + STORY_MONTH_HOURS > count:
        raise MissingSelection('story month')
    month = np.zeros(count, dtype=bool)
    month[landing:landing + STORY_MONTH_HOURS] = True
    year_mask = np.zeros(count, dtype=bool)
    year_mask[year] = True

    story_bins = bins_for(story_site_id)
    _series, story_sky = _site_arrays(root, story_site_id, count, story_bins)

    lesson2 = None
    for site_id in lesson2_site_order(story_site_id, sites):
        site = by_id.get(site_id)
        if site is None:
            continue
        bins = bins_for(site_id)
        series, skyline = _site_arrays(root, site_id, count, bins)
        hour = first_lesson2_hour(
            series['sun_el'], series['sun_clear'], series['sun_az'], skyline['dist_km'], skyline['height_m'],
            year_mask, elevation_m=site.elevation_m, observer_height_m=observer_m,
        )
        if hour is not None:
            lesson2 = (site, hour, series, skyline, bins)
            break
    site2, hour2, series2, sky2, bins2 = _require(lesson2, RULE_LESSON2)
    bin2 = nearest_bin(series2['sun_az'][hour2], bins2)
    rise2 = height_above_observer(sky2['height_m'][bin2], site2.elevation_m, observer_m)

    month_clear = {name: values[month] for name, values in story_series.items()}
    shares = direct_link_percentages(month_clear, profile)
    mask = _require(first_mask_below(shares), RULE_LESSON4_MASK)

    blocker = _require(most_distant_blocker(story_sky['dist_km']), 'lesson 3 blocker')
    rise3 = height_above_observer(story_sky['height_m'][blocker], story.elevation_m, observer_m)
    if not np.isfinite(rise3):
        raise MissingSelection('lesson 3 blocker')

    hour1 = _require(first_extreme_hour(story_series['sun_el'], month, pick='max'), 'lesson 1 hour')
    hour4 = _require(
        closest_hour(story_series['earth_clear'], profile.antenna_mask_deg, month), 'lesson 4 hour',
    )
    if story.slope is None or story.slope.baseline_m != 160:
        raise MissingSelection('lesson 5 slope')

    ranked = passing_sites((site_id, sweeps[site_id][1][landing]) for site_id in sorted(sweeps) if is_polar_catalog(by_id[site_id]))
    if not ranked:
        raise MissingSelection('lesson 6 site A')
    site_a, eval_a = ranked[0]
    site_b, eval_b = ranked[1] if len(ranked) > 1 else (None, None)
    story_eval = _require(story_sweep[landing], 'story mission window')

    go7 = _require(lesson7_landing_index(midnights, story_sweep), 'lesson 7 landing')
    slip7 = go7 + SLIP_DAYS * 24
    slipped = _require(story_sweep[slip7] if slip7 < count else None, 'lesson 7 landing')
    later = [index for index in midnights if index > slip7]
    next_go = _require(next_go_index(slip7, later, story_sweep), 'lesson 7 next GO')
    alt = next((
        site_id for site_id in sorted(sweeps)
        if is_polar_catalog(by_id[site_id]) and sweeps[site_id][1][slip7] is not None and sweeps[site_id][1][slip7].status == 'GO'
    ), None)

    go_by_id = {}
    for site_id, (_series, evaluations, _slope) in sweeps.items():
        if not is_polar_catalog(by_id[site_id]):
            continue
        go_by_id[site_id] = any(
            evaluations[index] is not None and evaluations[index].status == 'GO' for index in midnights
        )
    candidates = _require(lesson8_candidates(go_by_id), 'lesson 8 candidates')
    overlap_site = next(site_id for site_id in candidates if go_by_id[site_id])

    def at(index):
        return format_utc(hour_at(start, index))

    metrics = story_eval.metrics
    utilities = story_eval.utilities
    values = {
        'l1.sun_el_max_deg': _number(np.max(story_series['sun_el'][month])),
        'l1.sun_el_min_deg': _number(np.min(story_series['sun_el'][month])),
        'l1.site_lat_deg': _number(story.lat_deg),
        'l1.example_utc': at(hour1),
        'l1.example_subsolar_lat': _number(system['subsolar_lat'][hour1]),
        'l1.example_subsolar_lon': _number(system['subsolar_lon'][hour1]),
        'l1.example_sun_az': _number(story_series['sun_az'][hour1]),
        'l1.example_sun_el': _number(story_series['sun_el'][hour1]),
        'l2.site_id': site2.id,
        'l2.site_name': site2.name,
        'l2.example_utc': at(hour2),
        'l2.sun_el_deg': _number(series2['sun_el'][hour2]),
        'l2.sun_az_deg': _number(series2['sun_az'][hour2]),
        'l2.ridge_dist_km': _number(sky2['dist_km'][bin2]),
        'l2.ridge_rise_m': _number(rise2),
        'l2.ridge_el_deg': _number(sky2['el_deg'][bin2]),
        'l2.ridge_feature': RIDGE_FEATURE,
        'l2.sun_frac': _number(series2['sun_frac'][hour2]),
        'l3.drop_at_20km_m': curvature_drop_m(20, radius_m),
        'l3.drop_at_60km_m': curvature_drop_m(60, radius_m),
        'l3.drop_at_130km_m': curvature_drop_m(130, radius_m),
        'l3.example_bin_az': bin_azimuth_deg(blocker, story_bins),
        'l3.example_dist_km': _number(story_sky['dist_km'][blocker]),
        'l3.example_height_m': _number(rise3),
        'l3.example_el_flat_deg': flat_elevation_deg(rise3, story_sky['dist_km'][blocker]),
        'l3.example_el_true_deg': _number(story_sky['el_deg'][blocker]),
        'l4.earth_el_max_deg': _number(np.max(story_series['earth_el'][month])),
        'l4.earth_el_min_deg': _number(np.min(story_series['earth_el'][month])),
        'l4.earth_up_pct': _number(any_earth_percent(story_series['earth_frac'][month])),
        'l4.link_pct_by_mask': [_number(share) for share in shares],
        'l4.link_pct_mask0': _number(shares[0]),
        'l4.link_pct_mask1': _number(shares[2]),
        'l4.link_pct_mask5': _number(shares[10]),
        'l4.mask_for_15pct_deg': _number(mask),
        'l4.example_utc': at(hour4),
        'l4.example_earth_az': _number(story_series['earth_az'][hour4]),
        'l4.example_earth_el': _number(story_series['earth_el'][hour4]),
        'l4.example_earth_clear': _number(story_series['earth_clear'][hour4]),
        'l5.slope_10m_deg': None,
        'l5.slope_100m_deg': None,
        'l5.slope_160m_deg': _number(story.slope.deg),
        'l5.example_site': story.id,
        'l5.plane_a': None,
        'l5.plane_b': None,
        'l6.site_a': site_a,
        'l6.site_b': site_b,
        'l6.a_score': _number(eval_a.score),
        'l6.b_score': None if eval_b is None else _number(eval_b.score),
        'l6.example_metrics.sun_fraction_mean': _number(metrics.sun_fraction_mean),
        'l6.example_metrics.lit_fraction': _number(metrics.lit_fraction),
        'l6.example_metrics.longest_dark_h': _number(metrics.longest_dark_h),
        'l6.example_metrics.link_fraction': _number(metrics.link_fraction),
        'l6.example_metrics.longest_blackout_h': _number(metrics.longest_blackout_h),
        'l6.example_metrics.landing_sun_el_deg': _number(metrics.landing_sun_el_deg),
        'l6.example_metrics.landing_lit': bool(metrics.landing_lit),
        'l6.example_utilities.slope': None if utilities.slope is None else _number(utilities.slope),
        'l6.example_utilities.power': _number(utilities.power),
        'l6.example_utilities.comms': _number(utilities.comms),
        'l6.example_score': _number(story_eval.score),
        'l7.go_date': at(go7),
        'l7.slip_date': at(slip7),
        'l7.slip_vetoes': triggered_vetoes(slipped),
        'l7.slip_blackout_h': _number(slipped.metrics.longest_blackout_h),
        'l7.next_go_date': at(next_go),
        'l7.alt_site': alt,
        'l8.candidates': candidates,
        'l8.region_overlap.site_id': overlap_site,
        'l8.region_overlap.region_name': None,
        'l8.region_overlap.overlaps': None,
        'story.site_id': story_site_id,
        'story.profile_id': STORY_PROFILE_ID,
        'story.landing_utc': at(landing),
        'story.month_end_utc': format_utc(hour_at(start, landing + STORY_MONTH_HOURS)),
        'story.window_end_utc': format_utc(hour_at(start, landing + window_length(profile.duration_days))),
    }
    if utilities.slope is None:
        raise MissingSelection('lesson 6 story slope')
    return WorkedExamples.model_validate(values)


def format_value(value):
    if value is None:
        return 'null'
    if isinstance(value, float):
        return f'{value:.12g}'
    if isinstance(value, list):
        return '[' + ', '.join(format_value(item) for item in value) + ']'
    return str(value)


def render_table(model):
    """The key table with the values just computed."""
    values = model.model_dump(by_alias=True, mode='json')
    lines = ['key\tlesson\tunit\tvalue\tdefinition\tsource']
    for row in EXAMPLES:
        lines.append('\t'.join((row.key, row.lesson, row.unit, format_value(values[row.key]), row.definition, row.source)))
    return '\n'.join(lines) + '\n'
