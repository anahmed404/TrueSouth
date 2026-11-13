/**
 * The profile editor's fields: their labels, units and input rules.
 *
 * The scenario store decides what a valid profile is and keeps an invalid one from
 * reaching scoring. This file only turns typed text into a value to offer the store, and
 * says in a few words what range the store accepts, for when it says no.
 * Field meanings are in docs/mission-profiles.md; explanations are in explain.ts.
 */

import type { MissionProfile, Weights } from "../../contracts/generated";
import type { ProfileField } from "../../state/scenario";

export type FieldKind = "number" | "optional" | "boolean" | "weights";

export type FieldDef = {
  field: ProfileField;
  label: string;
  unit: string;
  kind: FieldKind;
  /** The step of the number input's arrows. */
  step: number;
  /** The range the store accepts, said plainly. Shown when it refuses a value. */
  accepts: string;
};

export type FieldGroup = { title: string; fields: readonly FieldDef[] };

export const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    title: "Mission",
    fields: [
      { field: "duration_days", label: "Duration", unit: "d", kind: "number", step: 0.5, accepts: "more than 0 days, and the window must fit in the time grid" },
    ],
  },
  {
    title: "Sunlight",
    fields: [
      { field: "min_sun_fraction", label: "Sun disc needed to be lit", unit: "", kind: "number", step: 0.05, accepts: "a fraction from 0 to 1" },
      { field: "ops_sun_el_min_deg", label: "Lowest Sun to operate", unit: "°", kind: "optional", step: 0.5, accepts: "any angle, or empty for no limit" },
      { field: "max_dark_h", label: "Longest dark stretch", unit: "h", kind: "number", step: 1, accepts: "0 h or more" },
    ],
  },
  {
    title: "Earth link",
    fields: [
      { field: "relay_available", label: "Relay orbiter", unit: "", kind: "boolean", step: 1, accepts: "yes or no" },
      { field: "antenna_mask_deg", label: "Antenna mask", unit: "°", kind: "number", step: 0.5, accepts: "0° or more" },
      { field: "max_blackout_h", label: "Longest blackout", unit: "h", kind: "number", step: 1, accepts: "0 h or more" },
    ],
  },
  {
    title: "Ground",
    fields: [
      { field: "max_slope_deg", label: "Slope limit", unit: "°", kind: "number", step: 0.5, accepts: "more than the ideal slope" },
      { field: "slope_ideal_deg", label: "Ideal slope", unit: "°", kind: "number", step: 0.5, accepts: "0° or more, and less than the slope limit" },
    ],
  },
  {
    title: "Landing light",
    fields: [
      { field: "landing_sun_el_min_deg", label: "Lowest Sun at landing", unit: "°", kind: "optional", step: 0.5, accepts: "any angle not above the highest, or empty for no limit" },
      { field: "landing_sun_el_max_deg", label: "Highest Sun at landing", unit: "°", kind: "optional", step: 0.5, accepts: "any angle not below the lowest, or empty for no limit" },
    ],
  },
  {
    title: "Score",
    fields: [
      { field: "weights", label: "Weights", unit: "", kind: "weights", step: 0.05, accepts: "numbers of 0 or more; power and comms must not both be 0" },
    ],
  },
];

export const WEIGHT_KEYS = ["slope", "power", "comms"] as const;
export type WeightKey = (typeof WEIGHT_KEYS)[number];

export const WEIGHT_LABELS: Readonly<Record<WeightKey, string>> = {
  slope: "Slope",
  power: "Power",
  comms: "Comms",
};

export function fieldDef(field: ProfileField): FieldDef {
  for (const group of FIELD_GROUPS) {
    const found = group.fields.find((item) => item.field === field);
    if (found) return found;
  }
  throw new Error(`no editor field for ${field}`);
}

export type Parsed<T> = { ok: true; value: T } | { ok: false };

/**
 * Typed text to a number. Accepts "12", "12.5", ".5", "-3" and the typographic minus.
 * An optional field reads an empty box as "no limit" (null).
 */
export function parseNumberInput(text: string, optional: boolean): Parsed<number | null> {
  const trimmed = text.trim().replace(/−/g, "-").replace(",", ".");
  if (trimmed === "") return optional ? { ok: true, value: null } : { ok: false };
  if (!/^-?(?:\d+(?:\.\d*)?|\.\d+)$/.test(trimmed)) return { ok: false };
  const value = Number(trimmed);
  return Number.isFinite(value) ? { ok: true, value } : { ok: false };
}

/** A profile value as the text in its box. */
export function inputText(value: number | null): string {
  if (value === null) return "";
  return String(Math.round(value * 1e6) / 1e6);
}

/** The new weights after one of the three boxes changes. */
export function withWeight(weights: Weights, key: WeightKey, value: number): Weights {
  return { slope: weights.slope, power: weights.power, comms: weights.comms, [key]: value };
}

/** Did the store take the value? It refuses silently, so the editor checks. */
export function storeAccepted(profile: MissionProfile, field: ProfileField, offered: unknown): boolean {
  const now = profile[field];
  if (field === "weights") {
    const a = now as Weights;
    const b = offered as Weights;
    return a.slope === b.slope && a.power === b.power && a.comms === b.comms;
  }
  return now === offered;
}

/** "Custom, based on IM-2 Athena" when any field is changed, else the preset's name. */
export function profileTitle(profile: MissionProfile, changedCount: number, baseName: string): string {
  return changedCount > 0 ? `Custom, based on ${baseName}` : profile.name;
}
