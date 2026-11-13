/**
 * Links that open a site in NASA's own map tools (docs/features/share-export.md, "Links to
 * NASA tools"). Each format is only used once it has been confirmed; see
 * `QUICKMAP_CONFIRMED` and `MOONTREK_CONFIRMED`. Until then the link opens the tool's front
 * page and the coordinates are shown beside it for the user to enter.
 */

import { formatNumber } from "../../../components/format";

export const QUICKMAP_HOME = "https://quickmap.lroc.asu.edu/";
export const MOONTREK_HOME = "https://trek.nasa.gov/moon/";

export type NasaLink = {
  tool: "Quickmap" | "Moon Trek";
  href: string;
  /** True when the link opens the map centred on the site. */
  centred: boolean;
};

export const QUICKMAP_CONFIRMED = false;
export const MOONTREK_CONFIRMED = false;

/** East longitude 0–360 to −180–180. */
export function signedLongitude(lonEastDeg: number): number {
  const wrapped = ((((lonEastDeg + 180) % 360) + 360) % 360) - 180;
  return wrapped === -180 ? 180 : wrapped;
}

export function quickmapLink(_latDeg: number, _lonEastDeg: number): NasaLink {
  return { tool: "Quickmap", href: QUICKMAP_HOME, centred: false };
}

export function moonTrekLink(_latDeg: number, _lonEastDeg: number): NasaLink {
  return { tool: "Moon Trek", href: MOONTREK_HOME, centred: false };
}

/** "−89.4555°, 222.6190° E", to type into a tool that cannot be opened at a point. */
export function coordinatesText(latDeg: number, lonEastDeg: number): string {
  return `${formatNumber(latDeg, 4)}°, ${formatNumber(lonEastDeg, 4)}° E`;
}
