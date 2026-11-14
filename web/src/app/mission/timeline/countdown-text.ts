/**
 * The words on the Sun and Earth countdown cards. Display only: the countdown hours come
 * from `useCountdowns` (docs/science.md §9), the lit and link flags from `useHourFlags`.
 */

import type { Countdowns } from "../../../lib/scoring";

/** A countdown under this many hours turns the card amber (docs/features/site-detail.md). */
export const SOON_HOURS = 6;

/** At this many hours and above, a wait is written in days and hours. */
const DAYS_FROM_HOURS = 48;

/**
 * How close, in minutes, a wait must be to a whole minute to be read as that minute. Float
 * arithmetic in an interpolated crossing can leave 5.999999999999999 h for what is really
 * 6 h; that error is around 1e-13 h. This tolerance is a few millionths of a second, so a
 * real wait just under a minute (6 h less a tenth of a second, or less 1e-8 h) still counts
 * as under it.
 */
const SNAP_MINUTES = 1e-9;

/**
 * A wait as whole minutes, never rounded up: the floor of the minutes, except that a value
 * within `SNAP_MINUTES` of a whole minute is that minute. The text and every flag drawn
 * from a wait (under 6 h, over a limit) use this one number, so they cannot disagree.
 */
export function waitMinutes(hours: number): number {
  const minutes = hours * 60;
  const nearest = Math.round(minutes);
  return Math.abs(minutes - nearest) < SNAP_MINUTES ? nearest : Math.floor(minutes);
}

/** Whether a wait is under a limit in hours, judged on the minutes the card prints. */
export function waitUnder(hours: number, limitHours: number): boolean {
  return waitMinutes(hours) < waitMinutes(limitHours);
}

export type WaitPart = { value: string; unit: string };

/**
 * A wait, cut down (never rounded up) so a wait under a limit never prints as the limit:
 * "2 h 58 m", "31 h 20 m", "6 d 1 h". Minutes are two digits under 48 hours, as in
 * "6 h 05 m". Exactly 0 is "now"; a wait under a minute is "under a minute".
 */
export function waitParts(hours: number): WaitPart[] | "now" | "under a minute" {
  if (hours <= 0) return "now";
  const minutes = waitMinutes(hours);
  if (minutes === 0) return "under a minute";
  if (minutes < DAYS_FROM_HOURS * 60) {
    return [
      { value: String(Math.floor(minutes / 60)), unit: "h" },
      { value: String(minutes % 60).padStart(2, "0"), unit: "m" },
    ];
  }
  const whole = Math.floor(minutes / 60);
  return [
    { value: String(Math.floor(whole / 24)), unit: "d" },
    { value: String(whole % 24), unit: "h" },
  ];
}

/** A wait as one string: "2 h 58 m", "6 d 1 h", "now", "under a minute". */
export function formatWait(hours: number): string {
  const parts = waitParts(hours);
  if (typeof parts === "string") return parts;
  return parts.map((part) => `${part.value} ${part.unit}`).join(" ");
}

/** "None before 2032", from the grid's last timestamp. */
export function noneBefore(gridEndUtc: string): string {
  const year = Number(gridEndUtc.slice(0, 4));
  return Number.isFinite(year) ? `None before ${year + 1}` : "None before the end of the data";
}

export type CountdownEvent = "sunset" | "sunrise" | "earthset" | "earthrise";

const EVENT_NAME: Record<CountdownEvent, string> = {
  sunset: "Sunset",
  sunrise: "Sunrise",
  earthset: "Earthset",
  earthrise: "Earthrise",
};

export type CountdownView = {
  body: "sun" | "earth";
  /** "Lit", "Dark", "Link", "Blackout". */
  state: string;
  /** The `explain.ts` key of the state word. */
  stateTerm: "lit" | "dark" | "link" | "blackout" | "relay";
  /** The next change, or null with a relay. */
  event: CountdownEvent | null;
  /** "Sunset", "Earthrise". */
  eventName: string;
  /** Hours to the next change, or null when none falls before the end of the time grid. */
  hours: number | null;
  /** "Sunset in 2 h 58 m", "Sunrise none before 2032", "Earthset now". */
  sentence: string;
  /** Under 6 hours: the card turns amber. */
  soon: boolean;
};

function sentence(name: string, hours: number | null, gridEndUtc: string): string {
  if (hours === null) return `${name}: ${noneBefore(gridEndUtc).toLowerCase()}`;
  const wait = formatWait(hours);
  if (wait === "now") return `${name} now`;
  return `${name} in ${wait}`;
}

/** The Sun card: lit now counts down to sunset, dark now to sunrise. */
export function sunCountdown(countdowns: Countdowns, litNow: boolean, gridEndUtc: string): CountdownView {
  const event: CountdownEvent = litNow ? "sunset" : "sunrise";
  const hours = countdowns[event];
  return {
    body: "sun",
    state: litNow ? "Lit" : "Dark",
    stateTerm: litNow ? "lit" : "dark",
    event,
    eventName: EVENT_NAME[event],
    hours,
    sentence: sentence(EVENT_NAME[event], hours, gridEndUtc),
    soon: hours !== null && waitUnder(hours, SOON_HOURS),
  };
}

/**
 * The Earth card: with a link now, Earthset; in a blackout, Earthrise. With a relay the
 * link never ends, so there is no Earth countdown (docs/science.md §9).
 */
export function earthCountdown(
  countdowns: Countdowns,
  linkNow: boolean,
  relay: boolean,
  gridEndUtc: string,
): CountdownView {
  if (relay) {
    return {
      body: "earth",
      state: "Link",
      stateTerm: "relay",
      event: null,
      eventName: "",
      hours: null,
      sentence: "Relay: always in contact",
      soon: false,
    };
  }
  const event: CountdownEvent = linkNow ? "earthset" : "earthrise";
  const hours = countdowns[event];
  return {
    body: "earth",
    state: linkNow ? "Link" : "Blackout",
    stateTerm: linkNow ? "link" : "blackout",
    event,
    eventName: EVENT_NAME[event],
    hours,
    sentence: sentence(EVENT_NAME[event], hours, gridEndUtc),
    soon: hours !== null && waitUnder(hours, SOON_HOURS),
  };
}

/* ── The stretch chip in a countdown card's notes row ────────────────────────── */

/**
 * The room for the chip's words on one line: the card is 158 px wide inside at every
 * desktop width (the countdown column is fixed at 384 px), less the 13 px lamp and its 5 px
 * gap. Measured in the browser, Jost at 12 px.
 */
export const CHIP_TEXT_BUDGET_PX = 140;

/**
 * Advance widths of the glyphs the chip can use, in px, Jost 12 px, weight 500 (the over-limit
 * chip; the within-limit chip is weight 400 and narrower), with tabular figures. Measured in
 * the browser; an unknown glyph counts as the widest letter.
 */
const GLYPH_PX: Record<string, number> = {
  ...Object.fromEntries("0123456789".split("").map((d) => [d, 7.2])),
  ",": 3.77,
  ".": 3.71,
  " ": 3.2,
  " ": 2.5,
  "·": 3.71,
  "−": 7.2,
  h: 6.5,
  o: 6.76,
  v: 6.04,
  e: 6.46,
  r: 4.44,
  t: 3.25,
  w: 8.89,
  i: 3.19,
  n: 6.54,
  l: 2.95,
  m: 9.55,
};
const WIDEST_GLYPH_PX = 9.6;
/** Kerning and rounding: the estimate is raised by this much before it is compared. */
const SAFETY = 1.03;

/** The width the chip's words take on screen, in px, with the safety margin. */
export function chipTextWidth(text: string): number {
  let width = 0;
  for (const glyph of text) width += GLYPH_PX[glyph] ?? WIDEST_GLYPH_PX;
  return width * SAFETY;
}

/**
 * This dark stretch or blackout, against the profile's limit, as the chip says it (`short`,
 * always one line in the card) and as a sentence (`sentence`, the chip's accessible text).
 * The chip always says "over" or "within" in words. It takes the fullest wording that fits:
 * "130 h · over the 6 h limit", then "52,584 h · over 999 h", then "52,584 h · over the
 * limit", then "over the limit". The card's head already says "Dark" or "Blackout".
 */
export function stretchChipText(
  kind: "dark" | "blackout",
  now: { value: string; limit: string; broken: boolean },
): { short: string; sentence: string } {
  const verdict = now.broken ? "over" : "within";
  const what = kind === "dark" ? "This dark stretch" : "This blackout";
  const candidates = [
    `${now.value} · ${verdict} the ${now.limit} limit`,
    `${now.value} · ${verdict} ${now.limit}`,
    `${now.value} · ${verdict} the limit`,
  ];
  const short = candidates.find((text) => chipTextWidth(text) <= CHIP_TEXT_BUDGET_PX) ?? `${verdict} the limit`;
  return { short, sentence: `${what} lasts ${now.value}, ${verdict} the ${now.limit} limit.` };
}
