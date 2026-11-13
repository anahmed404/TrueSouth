import type { HourFlags } from "../../../lib/scoring";

/**
 * The two sight-lines' states at one hour, read from the profile's hour flags (the evaluation
 * hooks), never from the 3D scene's shading. docs/features/system-view.md, "Pins and
 * sight-lines".
 */
export type SightState = { sun: "lit" | "dark"; earth: "link" | "no-link" };

export function sightState(flags: HourFlags, hourIndex: number): SightState | null {
  if (!Number.isInteger(hourIndex) || hourIndex < 0 || hourIndex >= flags.lit.length) return null;
  return {
    sun: flags.lit[hourIndex] === 1 ? "lit" : "dark",
    earth: flags.link[hourIndex] === 1 ? "link" : "no-link",
  };
}

/** The short plate text the prototype shows: the state only, no countdown numbers. */
export function sightLabel(body: "sun" | "earth", state: SightState): string {
  if (body === "sun") return `To the Sun: ${state.sun === "lit" ? "lit" : "dark"}`;
  return `To Earth: ${state.earth === "link" ? "link" : "no link"}`;
}

/** Solid GO green when lit or linked; dashed NO-GO red when not. */
export function sightGood(body: "sun" | "earth", state: SightState): boolean {
  return body === "sun" ? state.sun === "lit" : state.earth === "link";
}
