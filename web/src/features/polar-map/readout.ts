/**
 * The words of the Polar map's readouts: hover, "New site here?" and the nudge. Pure.
 *
 * Every value here is read from NASA's average maps (the stored lookup grids) or from
 * `sites.json`. Nothing is computed from terrain or ephemeris (AGENTS.md).
 */

import type { NearbySun, Site } from "../../contracts/generated";
import { LOOKUP_NO_DATA } from "../../data/decode/layouts";
import type { MapImage } from "../../lib/geo";
import { formatNumber } from "../../components/format";
import { lookupCell } from "./view";

/** A narrow no-break space: a unit follows its number after one (DESIGN.md, "Numbers and units"). */
export const NNBSP = " ";

export type OverlayId = "sunlight" | "earthvis";

/** What a lookup grid says at a point: a fraction, "no data", or "outside" the grid. */
export type LookupValue = { kind: "value"; fraction: number } | { kind: "no-data" } | { kind: "outside" };

export type LookupGrid = { values: Uint8Array; size: number; halfWidthM: number };

/**
 * The lookup grid's value at a latitude and longitude: the nearest cell, v/255, or "no data"
 * for the byte 255 (docs/data-contracts.md `maps/meta.json`).
 */
export function readLookup(grid: LookupGrid, latDeg: number, lonDeg: number): LookupValue {
  const image: MapImage = { half_width_m: grid.halfWidthM, size_px: grid.size };
  const cell = lookupCell(latDeg, lonDeg, image);
  if (!cell) return { kind: "outside" };
  const raw = grid.values[cell.row * grid.size + cell.col];
  if (raw === undefined || raw === LOOKUP_NO_DATA) return { kind: "no-data" };
  return { kind: "value", fraction: raw / 255 };
}

/** A fraction as a whole percentage: "54 %". */
export function percent(fraction: number): string {
  return `${formatNumber(fraction * 100, 0)}${NNBSP}%`;
}

/**
 * The largest byte a lookup grid stores for a value: a fraction f is written as
 * min(round(255 f), 254), so 254 means "at least 99.4 %", up to and including 100 %
 * (docs/data-contracts.md `maps/meta.json`).
 */
export const LOOKUP_TOP_BYTE = 254;

/**
 * A lookup value as a whole percentage for display, and the number its direction word
 * compares. The top byte reads "over 99 %" (never "100 %": the encoding cannot say whether it
 * was 100) and compares as 100.
 */
export function lookupPercent(fraction: number): { text: string; whole: number } {
  if (Math.round(fraction * 255) >= LOOKUP_TOP_BYTE) return { text: `over 99${NNBSP}%`, whole: 100 };
  const whole = Math.round(fraction * 100);
  return { text: `${formatNumber(whole, 0)}${NNBSP}%`, whole };
}

/** A lookup value as text: "54 %", "over 99 %", or "no data". */
export function lookupText(value: LookupValue): string {
  return value.kind === "value" ? lookupPercent(value.fraction).text : "no data";
}

/** Every value read from NASA's average maps carries this label, so its source is never in doubt. */
export const OVERLAY_NAME: Record<OverlayId, string> = {
  sunlight: "NASA's average sunlight",
  earthvis: "NASA's average Earth visibility",
};

/** The overlays' one caveat, shown with the choice and in every readout that uses them. */
export const AVERAGE_CAVEAT = "18.6-year averages from NASA's maps, not for your date.";

/** The nudge readout's caveat: it is NASA's long-term map, not our result. */
export const NUDGE_CAVEAT =
  "This reads NASA's long-term average maps, not TrueSouth's result for your dates. The site itself does not move.";

/** The same caveat, short, for the readout while the pin is being dragged. */
export const NUDGE_CAVEAT_SHORT = "NASA's long-term averages, not for your dates.";

/** Latitude and east longitude for a readout: "−89.4555°, 222.62° E". */
export function coordinatesText(latDeg: number, lonDeg: number): string {
  return `${formatNumber(latDeg, 4)}°, ${formatNumber(lonDeg, 2)}° E`;
}

/**
 * One nudge line: "Average sunlight 83 % → 55 %, lower". The direction word compares the
 * whole percentages shown, so the words never contradict the numbers. With "no data" at
 * either end there is no direction word.
 */
export function nudgeLine(overlay: OverlayId, from: LookupValue, to: LookupValue): string {
  const name = OVERLAY_NAME[overlay];
  const head = `${name} ${lookupText(from)} → ${lookupText(to)}`;
  if (from.kind !== "value" || to.kind !== "value") return head;
  const a = lookupPercent(from.fraction).whole;
  const b = lookupPercent(to.fraction).whole;
  if (a === b) return `${head}, the same`;
  return `${head}, ${b > a ? "higher" : "lower"}`;
}

// The site wording below matches web/src/app/mission/site-labels.ts in PR #92 exactly; import it from there once it is on main.

/** PR #92's best-lit tag. */
export const CHOSEN_TAG = "chosen by TrueSouth";

/**
 * A sunlit peak's nearby range, from `sites.json` (decision 0012): TrueSouth's own six-year
 * mean sunlight, not NASA's map. "Within 160 m: 39 % to 87 %". The low end rounds down and the
 * high end up, so the range never looks narrower than it is (PR #92's `nearbyRangeText`).
 */
export function nearbyRangeText(nearby: NearbySun | null | undefined): string | null {
  if (!nearby) return null;
  const { min, max, radius_m: radius } = nearby;
  if (![min, max, radius].every(Number.isFinite) || min > max) return null;
  const low = Math.max(0, Math.floor(min * 100 + 1e-9));
  const high = Math.min(100, Math.ceil(max * 100 - 1e-9));
  return `Within ${Math.round(radius)}${NNBSP}m: ${low}${NNBSP}% to ${high}${NNBSP}%`;
}

/** "Best-lit map pixel, 149 m from Connecting Ridge" (PR #92's `variantLine`). */
export function variantLine(variant: Pick<Site, "offset_m">, parentName: string | null): string | null {
  if (typeof variant.offset_m !== "number" || !Number.isFinite(variant.offset_m)) return null;
  return `Best-lit map pixel, ${Math.round(variant.offset_m)}${NNBSP}m from ${parentName ?? "the listed point"}`;
}

/** A distance on the ground for a readout: "640 m" or "1.2 km". */
export function distanceText(metres: number): string {
  if (metres < 1000) return `${formatNumber(Math.round(metres / 10) * 10, 0)}${NNBSP}m`;
  return `${formatNumber(metres / 1000, metres < 10_000 ? 1 : 0)}${NNBSP}km`;
}
