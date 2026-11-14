/**
 * The lines that say what a site's point is, when that needs saying
 * (docs/decisions/0012-sunlit-peaks-keep-their-listed-point.md, docs/site-catalog.md):
 * a best-lit variant chosen by TrueSouth, a sunlit peak's nearby range, an Artemis map
 * centre, and a custom site the user typed. Words only; the numbers come from sites.json.
 */

import type { NearbySun, Site } from "../../contracts/generated";
import { isCustomSiteId } from "../../data/paths";

/** A narrow no-break space between a number and its unit (DESIGN.md, numbers and units). */
const NNBSP = " ";

export const CHOSEN_TAG = "chosen by TrueSouth";
export const CHOSEN_TIP =
  "TrueSouth picked this map pixel as the best lit near the listed point. It is not a published site.";
export const ARTEMIS_NOTE = "This is the centre of a candidate region on NASA's map, not a chosen landing point.";
/** The catalog group of NASA's Artemis candidate regions (docs/site-catalog.md, group A). */
export const ARTEMIS_GROUP: Site["group"] = "artemis";

export function isVariant(site: Site | null | undefined): site is Site & { variant_of: string; offset_m: number } {
  return typeof site?.variant_of === "string" && typeof site.offset_m === "number" && Number.isFinite(site.offset_m);
}

export function isCustomSite(site: Site | null | undefined, siteId: string): boolean {
  return isCustomSiteId(site?.id ?? siteId);
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

export function parentOf(site: Site | null | undefined, sites: readonly Site[]): Site | null {
  if (!isVariant(site)) return null;
  return sites.find((item) => item.id === site.variant_of) ?? null;
}

export function bestLitVariantOf(site: Site | null | undefined, sites: readonly Site[]): Site | null {
  if (!site) return null;
  return sites.find((item) => isVariant(item) && item.variant_of === site.id) ?? null;
}

export function isArtemisCentre(site: Site | null | undefined): boolean {
  return site?.group === ARTEMIS_GROUP && !isCustomSiteId(site.id);
}

/** Catalog order, with each best-lit variant moved to just after the site it belongs to. */
export function pickerOrder(sites: readonly Site[]): Site[] {
  const variants = sites.filter(isVariant);
  const placed = new Set<string>();
  const out: Site[] = [];
  for (const site of sites) {
    if (isVariant(site)) {
      const parentHere = sites.some((item) => item.id === site.variant_of);
      if (parentHere) continue;
    }
    if (placed.has(site.id)) continue;
    out.push(site);
    placed.add(site.id);
    for (const variant of variants) {
      if (variant.variant_of === site.id && !placed.has(variant.id)) {
        out.push(variant);
        placed.add(variant.id);
      }
    }
  }
  return out;
}
