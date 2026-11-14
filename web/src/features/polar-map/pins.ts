/**
 * Where the Polar map's pins and labels go on screen, in CSS pixels. Pure.
 *
 * Pins and labels keep one screen size at every zoom (docs/features/polar-map.md, "Done
 * when"): every size here is a constant in CSS pixels, and only positions follow the view.
 */

import type { Feature, Site } from "../../contracts/generated";
import type { Status } from "../../lib/scoring";
import { DEFAULT_HALF_WIDTH_M, latLonToScreen, metresPerPixel, type MapView, type ScreenPoint } from "./view";
import { polarStereoForward } from "../../lib/geo";

/** Pin radii in CSS pixels, the same at every zoom. A selected pin is a 16 px status lamp. */
export const PIN = {
  /** A catalog site that is not selected: a small quiet dot. */
  catalog: 4.5,
  /** A selected site: the status lamp. */
  lamp: 8,
  /** The 2 px Night ring around every pin. */
  ring: 2,
  /** The selected site's outer ring. */
  selectedRing: 11.5,
  /** The focused site's Moonlight ring. */
  focusRing: 13,
  /** How near a pointer must be to a pin to hit it. */
  hit: 14,
} as const;

/** Pins closer than this fold into one (DESIGN.md, "Pin"). */
export const FOLD_PX = 18;

/** A best-lit variant drawn nearer its parent than this moves out to a callout. */
export const VARIANT_CALLOUT_PX = 24;

/** How far out the variant's callout sits from its parent, in CSS pixels. */
export const VARIANT_CALLOUT_OFFSET: ScreenPoint = { x: 26, y: -22 };

export type PinState =
  | { kind: "catalog" }
  | { kind: "loading" }
  | { kind: "none" }
  | { kind: "error" }
  | { kind: "status"; status: Status };

export type PlacedPin = {
  site: Site;
  /** Where the site really is on screen. */
  at: ScreenPoint;
  /** Where its pin is drawn: the same point, or a callout for a variant crowded by its parent. */
  drawAt: ScreenPoint;
  selected: boolean;
  focused: boolean;
  state: PinState;
  /** Ids of other pins folded into this one. */
  folded: string[];
  /** For a best-lit variant, its parent's id. */
  parentId: string | null;
  /** False for a site outside the detailed square: the 80 m terrain map does not reach it. */
  detailed: boolean;
};

/** Whether a site lies on the map's square (within ±half-width metres of the pole). */
export function onMap(site: Pick<Site, "lat_deg" | "lon_deg">, halfWidthM = DEFAULT_HALF_WIDTH_M): boolean {
  if (site.lat_deg > -60) return false;
  const { x_m, y_m } = polarStereoForward(site.lat_deg, site.lon_deg);
  return Math.abs(x_m) <= halfWidthM && Math.abs(y_m) <= halfWidthM;
}

/**
 * Whether a site lies on the context around the square: the southern hemisphere, which the
 * context images cover out to the equator (context.ts). Its pin is drawn there, in the right
 * place, and marked as outside the detailed map.
 */
export function onContext(site: Pick<Site, "lat_deg" | "lon_deg">): boolean {
  return site.lat_deg <= 0;
}

type PlaceInput = {
  sites: readonly Site[];
  selectedIds: readonly string[];
  focusedId: string | null;
  states: ReadonlyMap<string, PinState>;
  view: MapView;
  halfWidthM?: number;
};

/**
 * Places every catalog site on the map, folds crowded pins, and keeps each best-lit variant
 * tied to its parent so it is never hidden under it (decision 0012):
 *
 * - When the parent's own pin is drawn and the variant would sit under it, the variant moves
 *   out to a callout beside the parent, with its true point marked.
 * - When the parent is folded into another pin, a quiet variant folds there too, so the
 *   "+N" counts both and no callout stands beside an unrelated pin. A selected or focused
 *   variant is never folded away: it keeps a callout beside the pin that holds its parent.
 *
 * The focused pin leads its fold.
 */
export function placePins({ sites, selectedIds, focusedId, states, view, halfWidthM }: PlaceInput): PlacedPin[] {
  const selected = new Set(selectedIds);
  const base = sites
    .filter((site) => onContext(site))
    .map((site): PlacedPin => {
      const at = latLonToScreen(site.lat_deg, site.lon_deg, view);
      return {
        site,
        at,
        drawAt: at,
        selected: selected.has(site.id),
        focused: site.id === focusedId,
        state: selected.has(site.id) ? (states.get(site.id) ?? { kind: "loading" }) : { kind: "catalog" },
        folded: [],
        parentId: site.variant_of ?? null,
        detailed: onMap(site, halfWidthM),
      };
    });
  const ids = new Set(base.map((pin) => pin.site.id));
  const isVariant = (pin: PlacedPin) => pin.parentId !== null && ids.has(pin.parentId);

  // Leaders first: the focused pin, then selected pins, then the rest, each in catalog order.
  const rank = (pin: PlacedPin) => (pin.focused ? 0 : pin.selected ? 1 : 2);
  const ordered = [...base].sort((a, b) => rank(a) - rank(b));
  const leaders: PlacedPin[] = [];
  for (const pin of ordered) {
    if (isVariant(pin)) continue;
    const near = leaders.find((leader) => Math.hypot(leader.at.x - pin.at.x, leader.at.y - pin.at.y) < FOLD_PX);
    if (near) near.folded.push(pin.site.id);
    else leaders.push(pin);
  }

  // Then each variant, beside or with its parent.
  const leaderOf = (id: string) => leaders.find((pin) => pin.site.id === id || pin.folded.includes(id)) ?? null;
  for (const pin of ordered) {
    if (!isVariant(pin)) continue;
    const holder = leaderOf(pin.parentId as string);
    if (!holder) {
      leaders.push(pin);
      continue;
    }
    const parentDrawn = holder.site.id === pin.parentId;
    if (!parentDrawn && !pin.selected && !pin.focused) {
      holder.folded.push(pin.site.id);
      continue;
    }
    if (Math.hypot(holder.at.x - pin.at.x, holder.at.y - pin.at.y) < VARIANT_CALLOUT_PX) {
      pin.drawAt = { x: holder.at.x + VARIANT_CALLOUT_OFFSET.x, y: holder.at.y + VARIANT_CALLOUT_OFFSET.y };
    }
    leaders.push(pin);
  }
  // Draw order: quiet pins first, the focused pin last, so it is never under another.
  return leaders.sort((a, b) => rank(b) - rank(a));
}

/** The radius a pin is drawn at, from its kind alone: never from the zoom. */
export function pinRadius(pin: Pick<PlacedPin, "selected" | "focused">): number {
  if (pin.focused) return PIN.focusRing;
  if (pin.selected) return PIN.selectedRing;
  return PIN.catalog + PIN.ring;
}

/** The pin under a screen point, the nearest within the hit radius, or null. */
export function pinAt(pins: readonly PlacedPin[], point: ScreenPoint): PlacedPin | null {
  let best: PlacedPin | null = null;
  let bestDistance = Infinity;
  for (const pin of pins) {
    const distance = Math.hypot(pin.drawAt.x - point.x, pin.drawAt.y - point.y);
    if (distance <= Math.max(PIN.hit, pinRadius(pin)) && distance < bestDistance) {
      best = pin;
      bestDistance = distance;
    }
  }
  return best;
}

/** The focused pin's plate line for folded pins (DESIGN.md, "Pin"). */
export function moreSitesLine(count: number): string | null {
  if (count <= 0) return null;
  return count === 1 ? "and 1 more site here" : `and ${count} more sites here`;
}

/** A named feature's label shows once the feature is at least this wide on screen. */
export const FEATURE_MIN_PX = 56;

/** The features wide enough on screen to name, largest first. */
export function featuresToName(features: readonly Feature[], view: MapView): { feature: Feature; at: ScreenPoint }[] {
  const mpp = metresPerPixel(view);
  return features
    .filter((feature) => (feature.diameter_km * 1000) / mpp >= FEATURE_MIN_PX)
    .sort((a, b) => b.diameter_km - a.diameter_km)
    .map((feature) => ({ feature, at: latLonToScreen(feature.lat_deg, feature.lon_deg, view) }));
}

export type Box = { x: number; y: number; width: number; height: number };

/** Whether two boxes overlap, with a margin. */
export function overlaps(a: Box, b: Box, margin = 2): boolean {
  return a.x < b.x + b.width + margin && b.x < a.x + a.width + margin && a.y < b.y + b.height + margin && b.y < a.y + a.height + margin;
}
