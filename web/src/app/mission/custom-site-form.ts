/**
 * The "Your own coordinates" form's rules: reading what the user typed, the messages shown
 * beside each field as they type, and what will happen before they click. Display and
 * checking only: no terrain or ephemeris science. Which terrain map the server uses is
 * decided by the server; the hint here reads the latitude bounds it documents.
 */

import { formatNumber } from "../../components/format";
import { NAME_MAX, siteNameTooLong } from "../../data/custom-site-id";

/**
 * The server's documented limits (docs/architecture.md, "The API", and
 * docs/data-contracts.md, "API messages", on branch science/s10b-custom-sites):
 * a point within 0.001° of a pole is refused; a name is at most 120 characters.
 */
export const POLE_MARGIN_DEG = 0.001;
export { NAME_MAX } from "../../data/custom-site-id";

/**
 * The latitude bounds of each terrain tier, as the server documents them: the 80 m map at
 * or south of 80°S, the 240 m map at or south of 60°S, a smooth Moon anywhere else
 * (docs/architecture.md, "The API"; decision 0008).
 */
export const TIER_BOUNDS = { core80: -80, wide240: -60 } as const;

export type FieldCheck = { value: number | null; message: string | null; note: string | null };

/** Reads "−88.5", "-88.5", "88.5°" or " 45 ". Returns null for anything else. */
export function readDegrees(text: string): number | null {
  const clean = text.trim().replace(/[−–]/g, "-").replace(/°$/, "").trim();
  if (clean === "" || !/^[-+]?(?:\d+\.?\d*|\.\d+)$/.test(clean)) return null;
  const value = Number(clean);
  return Number.isFinite(value) ? value : null;
}

function decimalsOf(text: string): number {
  const match = /\.(\d+)/.exec(text);
  return match ? (match[1] ?? "").length : 0;
}

export function checkLatitude(text: string): FieldCheck {
  if (text.trim() === "") return { value: null, message: null, note: null };
  const value = readDegrees(text);
  if (value === null) return { value: null, message: "Type a number of degrees, such as −88.5.", note: null };
  if (value < -90 || value > 90) return { value: null, message: "Latitude runs from −90° (south pole) to 90°.", note: null };
  if (Math.abs(value) > 90 - POLE_MARGIN_DEG) {
    return { value: null, message: `Latitude must be at least ${POLE_MARGIN_DEG}° away from a pole.`, note: null };
  }
  const note = decimalsOf(text) > 4 ? `The server rounds it to ${formatNumber(value, 4)}°.` : null;
  return { value, message: null, note };
}

/** East longitude in [0, 360). −180 to 0 is accepted and turned east-positive. */
export function toEastLongitude(value: number): number {
  const east = value < 0 ? value + 360 : value;
  return east >= 360 ? east - 360 : east;
}

export function checkLongitude(text: string): FieldCheck {
  if (text.trim() === "") return { value: null, message: null, note: null };
  const value = readDegrees(text);
  if (value === null) return { value: null, message: "Type a number of degrees, such as 45.", note: null };
  if (value < -180 || value > 360) {
    return { value: null, message: "East longitude runs from 0° to 360°, or −180° to 180°.", note: null };
  }
  const east = toEastLongitude(value);
  let note: string | null = null;
  if (value < 0 || value === 360) note = `That is ${formatNumber(east, 4)}° E.`;
  else if (decimalsOf(text) > 4) note = `The server rounds it to ${formatNumber(east, 4)}° E.`;
  return { value: east, message: null, note };
}

/** The name is cleaned the same way as a server's (`cleanSiteName`); only its length can be wrong. */
export function checkName(text: string): string | null {
  return siteNameTooLong(text) ? `A name can have at most ${NAME_MAX} characters.` : null;
}

export type TierHint = "core80" | "wide240" | "sphere";

/** Which map the server's documented bounds give this latitude. The server's answer decides. */
export function tierHint(latDeg: number): TierHint {
  if (latDeg <= TIER_BOUNDS.core80) return "core80";
  if (latDeg <= TIER_BOUNDS.wide240) return "wide240";
  return "sphere";
}

/** The sentence shown before computing: what will happen, and how long it takes. */
export function beforeComputing(latDeg: number): string {
  const tier = tierHint(latDeg);
  if (tier === "sphere") return "Outside our terrain maps: computed on a smooth Moon, with no mountains. It takes a few seconds.";
  return "TrueSouth will compute this point from NASA's terrain. It takes about a minute.";
}

export type FormCheck = {
  lat: FieldCheck;
  lon: FieldCheck;
  nameMessage: string | null;
  /** Both coordinates read and in range. */
  ready: boolean;
};

export function checkForm(latText: string, lonText: string, nameText: string): FormCheck {
  const lat = checkLatitude(latText);
  const lon = checkLongitude(lonText);
  const nameMessage = checkName(nameText);
  return { lat, lon, nameMessage, ready: lat.value !== null && lon.value !== null && nameMessage === null };
}

/** Coordinates as the rest of the app writes them: "−88.5000°, 45.0000° E". */
export function formatCoordinates(latDeg: number, lonDeg: number): string {
  return `${formatNumber(latDeg, 4)}°, ${formatNumber(lonDeg, 4)}° E`;
}
