/**
 * A custom site's id, exactly as the server makes it (`api/src/truesouth_api/jobs.py`,
 * `site_id` and `canonical_id`; docs/data-contracts.md, "API messages"):
 *
 * - latitude rounded to four decimals, negative zero written as 0.0000;
 * - longitude normalised to [0, 360), rounded to four decimals, and 360.0000 written as
 *   0.0000 (so 359.99995 becomes 0.0000);
 * - at latitude ±90 the longitude is 0.0000;
 * - rounding is Python's `round(x, 4)`: the exact binary value, ties to even.
 *
 * The web uses this to check that an answer is about the place it asked for, and to tell a
 * valid id in a link from one the server would never make. It never builds an id to use in
 * place of the server's.
 */

/** The server's id pattern, ported: bounds and the normalised zero are in the pattern. */
const ID = new RegExp(
  "^c_(?:-?90\\.0000_0\\.0000|" +
    "(?:[0-9]\\.[0-9]{4}|[1-8][0-9]\\.[0-9]{4}|" +
    "-(?:[1-9]|[1-8][0-9])\\.[0-9]{4}|-0\\.(?!0000_)[0-9]{4})_" +
    "(?:0|[1-9][0-9]?|[12][0-9]{2}|3[0-5][0-9])\\.[0-9]{4})$",
);

/**
 * Python's `f"{round(x, 4):.4f}"` for a finite double: rounds the exact binary value, and an
 * exact tie goes to the even digit. May return "-0.0000"; callers normalise it.
 */
export function roundTo4(x: number): string {
  if (!Number.isFinite(x)) throw new RangeError("roundTo4 needs a finite number");
  const negative = x < 0 || Object.is(x, -0);
  // toFixed works on the exact value of the double; 60 digits hold every digit that can
  // decide the rounding of a double in the coordinates' range.
  const exact = Math.abs(x).toFixed(60);
  const [whole = "0", fraction = ""] = exact.split(".");
  const kept = fraction.slice(0, 4);
  const rest = fraction.slice(4);
  const first = rest.charCodeAt(0) - 48;
  let up: boolean;
  if (first > 5) up = true;
  else if (first < 5) up = false;
  else if (/[1-9]/.test(rest.slice(1))) up = true;
  else up = (kept.charCodeAt(3) - 48) % 2 === 1;
  const scaled = BigInt(whole + kept) + (up ? 1n : 0n);
  const digits = scaled.toString().padStart(5, "0");
  const text = `${digits.slice(0, -4)}.${digits.slice(-4)}`;
  return negative ? `-${text}` : text;
}

/** Python's float `%` with a positive divisor: the result is in [0, divisor]. */
function pythonMod(x: number, divisor: number): number {
  let r = x % divisor;
  if (r !== 0 && r < 0) r += divisor;
  return Object.is(r, -0) ? 0 : r;
}

/**
 * The id the server gives these coordinates, or null when they are not a place (not
 * finite, or latitude outside −90 to 90). It does not apply the 0.001° pole rule: the
 * server refuses those points, and this function only names places.
 */
export function canonicalCustomId(latDeg: number, lonDeg: number): string | null {
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg) || latDeg < -90 || latDeg > 90) return null;
  let lat = roundTo4(latDeg);
  if (lat === "-0.0000") lat = "0.0000";
  let lon: string;
  if (lat === "90.0000" || lat === "-90.0000") {
    lon = "0.0000";
  } else {
    lon = roundTo4(pythonMod(lonDeg, 360));
    if (lon === "360.0000" || lon === "-0.0000") lon = "0.0000";
  }
  return `c_${lat}_${lon}`;
}

/** The coordinates written in an id, or null. Does not check that the id is canonical. */
export function idCoordinates(siteId: string): { latDeg: number; lonDeg: number } | null {
  const match = /^c_(-?\d+\.\d{4})_(\d+\.\d{4})$/.exec(siteId);
  if (!match) return null;
  const latDeg = Number(match[1]);
  const lonDeg = Number(match[2]);
  return Number.isFinite(latDeg) && Number.isFinite(lonDeg) ? { latDeg, lonDeg } : null;
}

/** True only for an id the server itself would make: in range, and in canonical form. */
export function isCanonicalCustomId(siteId: string): boolean {
  if (!ID.test(siteId)) return false;
  const coords = idCoordinates(siteId);
  if (!coords || coords.lonDeg >= 360) return false;
  return canonicalCustomId(coords.latDeg, coords.lonDeg) === siteId;
}

/** Looks like a custom id (starts with "c_"), valid or not: for telling the user it was left out. */
export function looksLikeCustomId(siteId: string): boolean {
  return siteId.startsWith("c_");
}

// ── Names ─────────────────────────────────────────────────────────────────────

/** The longest name shown. The full text is never needed. */
export const NAME_MAX = 60;

/** Control characters, and the bidirectional marks, embeddings, overrides and isolates. */
const UNSAFE = /[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/g;

/**
 * A name from the user or the server, made safe to show: control and bidirectional
 * characters removed, whitespace collapsed, at most 60 characters. Null when nothing is left.
 */
export function cleanSiteName(text: string | null | undefined): string | null {
  const clean = tidy(text);
  if (clean === "") return null;
  const chars = Array.from(clean);
  return chars.length > NAME_MAX ? chars.slice(0, NAME_MAX).join("").trimEnd() : clean;
}

/** True when the cleaned name would be cut: for the form's message. */
export function siteNameTooLong(text: string | null | undefined): boolean {
  return Array.from(tidy(text)).length > NAME_MAX;
}

function tidy(text: string | null | undefined): string {
  return typeof text === "string" ? text.replace(UNSAFE, "").replace(/\s+/gu, " ").trim() : "";
}
