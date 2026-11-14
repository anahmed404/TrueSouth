/**
 * The words for a site's point when that needs saying: a best-lit variant chosen by
 * TrueSouth, a sunlit peak's nearby range, an Artemis map centre
 * (docs/decisions/0012-sunlit-peaks-keep-their-listed-point.md).
 *
 * TODO: import these from `app/mission/site-labels.ts` once the sites package (#92) is on
 * main; until then they are copied from it word for word, rounding included.
 */

import type { NearbySun, Site } from "../../../contracts/generated";

/** A narrow no-break space between a number and its unit (DESIGN.md, numbers and units). */
const NNBSP = " ";

export const CHOSEN_TAG = "chosen by TrueSouth";
export const CHOSEN_TIP =
  "TrueSouth picked this map pixel as the best lit near the listed point. It is not a published site.";
export const ARTEMIS_NOTE = "This is the centre of a candidate region on NASA's map, not a chosen landing point.";

export function isVariant(site: Site | null | undefined): site is Site & { variant_of: string; offset_m: number } {
  return typeof site?.variant_of === "string" && typeof site.offset_m === "number" && Number.isFinite(site.offset_m);
}

/** "Best-lit map pixel, 149 m from Connecting Ridge". */
export function variantLine(site: Site, parentName: string | null): string | null {
  if (!isVariant(site)) return null;
  const metres = Math.round(site.offset_m);
  return `Best-lit map pixel, ${metres}${NNBSP}m from ${parentName ?? "the listed point"}`;
}

/** "Its sunlight is an upper reading: the brightest of the map pixels within 160 m." */
export function upperReadingLine(site: Site, parent: Site | null): string | null {
  if (!isVariant(site)) return null;
  const radius = site.nearby_sun?.radius_m ?? parent?.nearby_sun?.radius_m ?? null;
  const within = radius !== null && Number.isFinite(radius) ? ` within ${Math.round(radius)}${NNBSP}m` : " nearby";
  return `Its sunlight is an upper reading: the brightest of the map pixels${within}.`;
}

/**
 * "Within 160 m: 39 % to 87 %". The low end rounds down and the high end up, so the range
 * never looks narrower than it is.
 */
export function nearbyRangeText(nearby: NearbySun | null | undefined): string | null {
  if (!nearby) return null;
  const { min, max, radius_m: radius } = nearby;
  if (![min, max, radius].every(Number.isFinite) || min > max) return null;
  const low = Math.max(0, Math.floor(min * 100 + 1e-9));
  const high = Math.min(100, Math.ceil(max * 100 - 1e-9));
  return `Within ${Math.round(radius)}${NNBSP}m: ${low}${NNBSP}% to ${high}${NNBSP}%`;
}

/** Why the best-lit point carries no "best" mark for sunlight (item 3 of the MC9 review). */
export const NOT_RANKED_NOTE = "A best-lit point is not ranked for sunlight, because its reading is an upper one.";
