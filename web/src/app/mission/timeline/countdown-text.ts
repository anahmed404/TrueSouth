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
