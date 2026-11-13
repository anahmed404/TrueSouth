/**
 * The words of the Polar map's readouts: hover, "New site here?" and the nudge. Pure.
 *
 * Every value here is read from NASA's average maps (the stored lookup grids) or from
 * `sites.json`. Nothing is computed from terrain or ephemeris (AGENTS.md).
 */

import type { NearbySun } from "../../contracts/generated";
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

/** A lookup value as text: "54 %", or "no data". */
export function lookupText(value: LookupValue): string {
  return value.kind === "value" ? percent(value.fraction) : "no data";
}

export const OVERLAY_NAME: Record<OverlayId, string> = {
  sunlight: "Average sunlight",
  earthvis: "Average Earth visibility",
};

/** The overlays' one caveat, shown with the choice and in every readout that uses them. */
export const AVERAGE_CAVEAT = "18.6-year averages from NASA's maps, not for your date.";

/** The nudge readout's caveat: it is NASA's long-term map, not our result. */
export const NUDGE_CAVEAT =
  "This reads NASA's long-term average maps, not TrueSouth's result for your dates. The site itself does not move.";

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
  const a = Math.round(from.fraction * 100);
  const b = Math.round(to.fraction * 100);
  if (a === b) return `${head}, the same`;
  return `${head}, ${b > a ? "higher" : "lower"}`;
}

/**
 * A sunlit peak's nearby range, from `sites.json` (decision 0012): TrueSouth's own six-year
 * mean, not NASA's map. "Within 160 m of the listed point, average sunlight ranges from 40 %
 * to 87 % (TrueSouth's six-year estimate)."
 */
export function nearbyRangeLine(nearby: NearbySun): string {
  return `Within ${formatNumber(nearby.radius_m, 0)}${NNBSP}m of the listed point, average sunlight ranges from ${percent(
    nearby.min,
  )} to ${percent(nearby.max)} (TrueSouth's six-year estimate).`;
}

/** A distance on the ground for a readout: "640 m" or "1.2 km". */
export function distanceText(metres: number): string {
  if (metres < 1000) return `${formatNumber(Math.round(metres / 10) * 10, 0)}${NNBSP}m`;
  return `${formatNumber(metres / 1000, metres < 10_000 ? 1 : 0)}${NNBSP}km`;
}
