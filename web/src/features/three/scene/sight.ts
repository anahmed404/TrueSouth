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

/** A signed angle with one decimal and a true minus sign (DESIGN.md, "Numbers and units"). */
export function formatSignedDeg(deg: number): string {
  const rounded = Math.round(deg * 10) / 10;
  const text = Math.abs(rounded).toFixed(1);
  return rounded < 0 ? `−${text}°` : `${text}°`;
}

/**
 * A body's label in Lander's eye (docs/features/panorama.md): its height and whether it is
 * in view, for example "Earth, 0.9° up · in view" or "Sun, 0.8° up · behind the ridge".
 * Height is the series' elevation; below the level it says so instead of a negative "up".
 * In view or not is the series' disc fraction, with its clearance to tell terrain in the way
 * ("behind the ridge") from a body that is simply down ("below the horizon"). Never from the
 * scene.
 */
export function bodyLabel(body: "sun" | "earth", elevationDeg: number, discFraction: number, clearanceDeg: number): string {
  const name = body === "sun" ? "Sun" : "Earth";
  const rounded = Math.round(elevationDeg * 10) / 10;
  const height = rounded < 0 ? `${Math.abs(rounded).toFixed(1)}° below level` : `${rounded.toFixed(1)}° up`;
  let state: string;
  if (discFraction >= 0.999) state = "in view";
  else if (discFraction > 0) state = "partly in view";
  else state = elevationDeg > 0 && clearanceDeg < 0 ? "behind the ridge" : "below the horizon";
  return `${name}, ${height} · ${state}`;
}
