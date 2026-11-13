/**
 * The words on the Sun and Earth countdown cards. Display only: the countdown hours come
 * from `useCountdowns` (docs/science.md §9), the lit and link flags from `useHourFlags`.
 */

import type { Countdowns } from "../../../lib/scoring";

/** A countdown under this many hours turns the card amber (docs/features/site-detail.md). */
export const SOON_HOURS = 6;

/** At this many hours and above, a wait is written in days and hours. */
const DAYS_FROM_HOURS = 48;

/** Floating-point slack, so 2.9666… hours (2 h 58 m) is not floored to 2 h 57 m. */
const EPSILON = 1e-6;

export type WaitPart = { value: string; unit: string };

/**
 * A wait, cut down (never rounded up) so a wait under a limit never prints as the limit:
 * "2 h 58 m", "31 h 20 m", "6 d 1 h". Minutes are two digits under 48 hours, as in
 * "6 h 05 m". Exactly 0 is "now"; a wait under a minute is "under 1 m".
 */
export function waitParts(hours: number): WaitPart[] | "now" | "under a minute" {
  if (hours <= 0) return "now";
  if (hours < DAYS_FROM_HOURS) {
    const minutes = Math.floor(hours * 60 + EPSILON);
    if (minutes === 0) return "under a minute";
    return [
      { value: String(Math.floor(minutes / 60)), unit: "h" },
      { value: String(minutes % 60).padStart(2, "0"), unit: "m" },
    ];
  }
  const whole = Math.floor(hours + EPSILON);
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
    soon: hours !== null && hours < SOON_HOURS,
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
    soon: hours !== null && hours < SOON_HOURS,
  };
}
