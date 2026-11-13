/**
 * How the Mission Control panels describe one evaluated mission window.
 *
 * Display only. Every number comes from `useEvaluation` (docs/science.md §9–10); this file
 * decides names, order, wording and the scale of a bar. It never decides whether a rule
 * is broken: that is the evaluation's `triggered` flag.
 */

import type { MissionProfile } from "../../contracts/generated";
import type { Evaluation, VetoId } from "../../lib/scoring";
import { GO_SCORE_THRESHOLD } from "../../lib/scoring";
import { formatNumber } from "../../components/format";
import type { Assumed, Sourced } from "../../contracts/generated";
import type { Provenance } from "../../components/ProvenanceTag";
import type { ProfileField } from "../../state/scenario";
import { fieldDef } from "./profile-fields";

/** A no-break space narrower than a word space, as `NumberUnit` uses. */
const UNIT_SPACE = " ";
const TIGHT_UNITS = new Set(["°", "′", "″"]);

/** "31 h", "3.1°", "0.96". Same rules as `NumberUnit`, for text that is not JSX. */
export function formatValue(value: number, unit: string, decimals = 0): string {
  const text = formatNumber(value, decimals);
  if (unit === "") return text;
  return TIGHT_UNITS.has(unit) ? `${text}${unit}` : `${text}${UNIT_SPACE}${unit}`;
}

/** A limit as typed in the profile: no trailing zeros, at most two decimals. "10°", "0.5". */
export function formatLimit(value: number, unit: string): string {
  const rounded = Math.round(value * 100) / 100;
  const decimals = Number.isInteger(rounded) ? 0 : Number.isInteger(rounded * 10) ? 1 : 2;
  return formatValue(rounded, unit, decimals);
}

/** Never print more than this many decimals to tell a value from its limit. */
const MAX_DECIMALS = 4;

/**
 * The decimals at which a value and its limit print differently. A rule compares them
 * strictly, so 10.01° against a 10° limit must not print as "10.0°, limit 10°". Starting
 * at the rule's own precision, add decimals (up to 4) until the two differ. Equal numbers
 * keep the rule's precision.
 */
export function distinctDecimals(value: number, limit: number, base: number): number {
  if (value === limit) return base;
  for (let d = base; d < MAX_DECIMALS; d++) {
    if (formatNumber(value, d) !== formatNumber(limit, d)) return d;
  }
  return Math.max(base, MAX_DECIMALS);
}

/** Without trailing zeros: 10.000 → "10", 12.50 → "12.5". */
function trimmed(value: number, unit: string, decimals: number): string {
  const text = formatNumber(value, decimals);
  const short = text.includes(".") ? text.replace(/\.?0+$/, "") : text;
  if (unit === "") return short;
  return TIGHT_UNITS.has(unit) ? `${short}${unit}` : `${short}${UNIT_SPACE}${unit}`;
}

/**
 * A rule's value and limit, printed so the rounding never contradicts the verdict.
 * The limit is written as typed (no trailing zeros); an equal limit prints like the value.
 */
export function valueAndLimit(
  value: number,
  limit: number,
  unit: string,
  base: number,
): { value: string; limit: string; decimals: number } {
  const decimals = distinctDecimals(value, limit, base);
  return {
    value: formatValue(value, unit, decimals),
    limit: value === limit ? formatValue(limit, unit, decimals) : trimmed(limit, unit, Math.max(decimals, 2)),
    decimals,
  };
}

/**
 * A score as printed: rounded down to a whole number, so a score under the GO threshold
 * never prints as the threshold (69.6 prints as 69).
 */
export function scoreText(score: number): string {
  return formatNumber(Math.floor(score));
}

/** The exact score for a tooltip, cut (not rounded) at three decimals. */
export function scoreTitle(score: number): string {
  return `Score ${formatNumber(Math.floor(score * 1000) / 1000, 3)} of 100, shown rounded down`;
}

/** Which profile settings feed a row, and whether all of them are sourced. */
export type SettingsProvenance = {
  kind: "sourced" | "assumed";
  parts: { field: ProfileField; label: string; provenance: Provenance }[];
};

/**
 * The tag for a row that one or more profile settings feed. It is sourced only if every
 * setting is sourced; one assumed setting makes the whole row assumed, because an assumed
 * setting can have caused the result.
 */
export function settingsProvenance(profile: MissionProfile, fields: readonly ProfileField[]): SettingsProvenance {
  const parts = fields.flatMap((field) => {
    const provenance = provenanceOf(profile, field);
    return provenance ? [{ field, label: fieldDef(field).label, provenance }] : [];
  });
  const kind = parts.length > 0 && parts.every((part) => part.provenance.kind === "sourced") ? "sourced" : "assumed";
  return { kind, parts };
}

/** The settings that decide whether an hour is lit (docs/science.md §9). */
function litFields(profile: MissionProfile): ProfileField[] {
  return profile.ops_sun_el_min_deg === null ? ["min_sun_fraction"] : ["min_sun_fraction", "ops_sun_el_min_deg"];
}

/** The settings that decide whether an hour has a link (docs/science.md §9). */
function linkFields(profile: MissionProfile): ProfileField[] {
  return profile.relay_available ? ["relay_available"] : ["relay_available", "antenna_mask_deg"];
}

/** Every profile setting that feeds a rule's measurement or its limit. */
export function ruleFields(profile: MissionProfile, id: VetoId | "relay"): ProfileField[] {
  switch (id) {
    case "landing_dark":
      return litFields(profile);
    case "slope":
      return ["max_slope_deg"];
    case "darkness":
      return ["max_dark_h", ...litFields(profile)];
    case "blackout":
      return ["max_blackout_h", ...linkFields(profile)];
    case "landing_sun_low":
      return ["landing_sun_el_min_deg"];
    case "landing_sun_high":
      return ["landing_sun_el_max_deg"];
    case "relay":
      return ["relay_available"];
  }
}

/** Every profile setting that feeds a utility and its weight (docs/science.md §10). */
export function utilityFields(profile: MissionProfile, id: "slope" | "power" | "comms"): ProfileField[] {
  switch (id) {
    case "slope":
      return ["max_slope_deg", "slope_ideal_deg", "weights"];
    case "power":
      return [...litFields(profile), "max_dark_h", "weights"];
    case "comms":
      return profile.relay_available ? ["relay_available", "weights"] : [...linkFields(profile), "max_blackout_h", "weights"];
  }
}

type RuleMeta = {
  term: string;
  /** The rule's name in the panel. */
  name: string;
  /** The short name in a sites-rail row. */
  short: string;
  /** The name in the one-line list of rules that pass. */
  passName: string;
  unit: string;
  decimals: number;
  /** The profile field that sets the limit, for its provenance tag. */
  limitField: keyof MissionProfile & string;
  /** "limit" for an upper bound, "at least" for a lower bound. */
  limitWord: "limit" | "at least" | "at most";
};

/**
 * The six vetoes of docs/science.md §10, in the order they are listed when two are
 * equally bad: a dark landing first, because nothing else matters if the lander cannot
 * see the ground; then the site; then survival; then the landing light.
 */
export const VETO_ORDER: readonly VetoId[] = [
  "landing_dark",
  "slope",
  "darkness",
  "blackout",
  "landing_sun_low",
  "landing_sun_high",
];

export const VETO_META: Readonly<Record<VetoId, RuleMeta>> = {
  landing_dark: {
    term: "veto_landing_dark",
    passName: "Lit at landing",
    name: "Dark at landing",
    short: "Dark at landing",
    unit: "",
    decimals: 0,
    limitField: "min_sun_fraction",
    limitWord: "limit",
  },
  slope: {
    term: "veto_slope",
    passName: "Slope",
    name: "Slope",
    short: "Slope",
    unit: "°",
    decimals: 1,
    limitField: "max_slope_deg",
    limitWord: "limit",
  },
  darkness: {
    term: "veto_darkness",
    passName: "Dark stretch",
    name: "Longest dark stretch",
    short: "Dark",
    unit: "h",
    decimals: 0,
    limitField: "max_dark_h",
    limitWord: "limit",
  },
  blackout: {
    term: "veto_blackout",
    passName: "Blackout",
    name: "Longest blackout",
    short: "Blackout",
    unit: "h",
    decimals: 0,
    limitField: "max_blackout_h",
    limitWord: "limit",
  },
  landing_sun_low: {
    term: "veto_landing_sun_low",
    passName: "Sun at landing",
    name: "Sun at landing",
    short: "Sun at landing",
    unit: "°",
    decimals: 2,
    limitField: "landing_sun_el_min_deg",
    limitWord: "at least",
  },
  landing_sun_high: {
    term: "veto_landing_sun_high",
    passName: "Sun at landing",
    name: "Sun at landing",
    short: "Sun at landing",
    unit: "°",
    decimals: 2,
    limitField: "landing_sun_el_max_deg",
    limitWord: "at most",
  },
};

/** One rule, checked or broken, ready to draw. */
export type RuleView = {
  id: VetoId | "relay";
  term: string;
  name: string;
  /** The measured number, or null for a yes/no rule. */
  value: number | null;
  /** The measured value as words, for a yes/no rule ("dark", "lit"). */
  valueText: string | null;
  unit: string;
  decimals: number;
  /** The limit as a number, or null for a yes/no rule. */
  limit: number | null;
  /** The measured value as printed, with its unit. Never contradicts the limit. */
  valueLabel: string;
  /** The limit as words: "limit 12 h", "at least 6°", "needs sunlight". */
  limitText: string;
  /** The tag: sourced only if every setting that feeds the rule is sourced. */
  provenance: SettingsProvenance;
  broken: boolean;
  /** One plain sentence on what happened. Only for a broken rule. */
  sentence: string;
  /** The bar's full scale, in the rule's unit. */
  scaleMax: number;
};

/** A profile field's sourced or assumed tag. Every value field has one. */
export function provenanceOf(profile: MissionProfile, field: string): Sourced | Assumed | null {
  const record = profile.provenance as unknown as Record<string, Provenance | undefined>;
  return record[field] ?? null;
}

/** Whether a veto was checked at all: a missing slope or an unset limit is not. */
function isChecked(evaluation: Evaluation, profile: MissionProfile, id: VetoId): boolean {
  const veto = evaluation.vetoes[id];
  switch (id) {
    case "slope":
      return veto.measured !== null;
    case "blackout":
      return !profile.relay_available;
    case "landing_sun_low":
    case "landing_sun_high":
      return veto.limit !== null;
    default:
      return true;
  }
}

function brokenSentence(id: VetoId, v: string, limit: number | null): string {
  switch (id) {
    case "landing_dark":
      return "The site is dark at the landing hour, so the lander would touch down in shadow.";
    case "slope":
      return `The ground slopes ${v} here, steeper than the lander allows.`;
    case "darkness":
      return limit === 0
        ? `The mission needs sunlight throughout, but the site goes dark for ${v} in a row.`
        : `The site is dark for ${v} in a row, longer than the mission can survive.`;
    case "blackout":
      return limit === 0
        ? `The mission needs Earth in view throughout, but it is out of contact for ${v} in a row.`
        : `Earth is out of contact for ${v} in a row, longer than the mission can wait.`;
    case "landing_sun_low":
      return `The Sun is ${v} high at touchdown, lower than the landing rule allows.`;
    case "landing_sun_high":
      return `The Sun is ${v} high at touchdown, higher than the landing rule allows.`;
  }
}

function ruleView(evaluation: Evaluation, profile: MissionProfile, id: VetoId): RuleView {
  const meta = VETO_META[id];
  const veto = evaluation.vetoes[id];
  const provenance = settingsProvenance(profile, ruleFields(profile, id));
  if (id === "landing_dark") {
    const lit = veto.measured === true;
    return {
      id,
      term: meta.term,
      name: veto.triggered ? meta.name : meta.passName,
      value: null,
      valueText: lit ? "yes" : "dark",
      valueLabel: lit ? "yes" : "dark",
      unit: "",
      decimals: 0,
      limit: null,
      limitText: lit ? "" : "needs sunlight",
      provenance,
      broken: veto.triggered,
      sentence: veto.triggered ? brokenSentence(id, "", null) : "",
      scaleMax: 1,
    };
  }
  const value = typeof veto.measured === "number" ? veto.measured : null;
  const limit = typeof veto.limit === "number" ? veto.limit : null;
  const printed =
    value !== null && limit !== null
      ? valueAndLimit(value, limit, meta.unit, meta.decimals)
      : {
          value: value === null ? "" : formatValue(value, meta.unit, meta.decimals),
          limit: limit === null ? "" : formatLimit(limit, meta.unit),
          decimals: meta.decimals,
        };
  return {
    id,
    term: meta.term,
    name: veto.triggered ? meta.name : meta.passName,
    value,
    valueText: null,
    valueLabel: printed.value,
    unit: meta.unit,
    decimals: printed.decimals,
    limit,
    limitText: limit === null ? "" : `${meta.limitWord} ${printed.limit}`,
    provenance,
    broken: veto.triggered,
    sentence: veto.triggered ? brokenSentence(id, printed.value, limit) : "",
    scaleMax: Math.max(value ?? 0, limit ?? 0, 1),
  };
}

/**
 * How badly a broken rule is broken, so the worst one leads. A dark landing is always
 * worst. Otherwise: how far past the limit the value is, as a share of the limit when the
 * limit is above 0 (0.75 against 0.5 is 50 % over). A limit of 0 or below has no share,
 * so the absolute excess is used.
 */
export function severity(evaluation: Evaluation, id: VetoId): number {
  const veto = evaluation.vetoes[id];
  if (!veto.triggered) return -Infinity;
  if (id === "landing_dark") return Infinity;
  if (typeof veto.measured !== "number" || typeof veto.limit !== "number") return 0;
  const over = id === "landing_sun_low" ? veto.limit - veto.measured : veto.measured - veto.limit;
  return veto.limit > 0 ? over / veto.limit : over;
}

/** The broken vetoes, worst first. Ties keep `VETO_ORDER`. */
export function brokenVetoes(evaluation: Evaluation): VetoId[] {
  return VETO_ORDER.filter((id) => evaluation.vetoes[id].triggered)
    .map((id, index) => ({ id, index, score: severity(evaluation, id) }))
    .sort((a, b) => (b.score === a.score ? a.index - b.index : b.score > a.score ? 1 : -1))
    .map((item) => item.id);
}

/** The single worst broken veto, or null when every rule passes. */
export function worstBrokenVeto(evaluation: Evaluation): VetoId | null {
  return brokenVetoes(evaluation)[0] ?? null;
}

export type EvaluationView = {
  broken: RuleView[];
  passing: RuleView[];
  statusSentence: string;
};

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six"];

export function statusSentence(evaluation: Evaluation, brokenCount: number): string {
  if (evaluation.status === "NO-GO") {
    const word = COUNT_WORDS[brokenCount] ?? String(brokenCount);
    return brokenCount === 1
      ? "One rule is broken, so this landing date fails."
      : `${word} rules are broken, so this landing date fails.`;
  }
  if (evaluation.status === "GO") {
    return `Every rule passes and the score is ${GO_SCORE_THRESHOLD} or more, so this landing date works.`;
  }
  return `Every rule passes, but the score is under ${GO_SCORE_THRESHOLD}: it can work, with little margin.`;
}

/** The focused-site panel's rules: broken worst first, then those that pass. */
export function describeEvaluation(evaluation: Evaluation, profile: MissionProfile): EvaluationView {
  const broken = brokenVetoes(evaluation).map((id) => ruleView(evaluation, profile, id));
  const passing = VETO_ORDER.filter((id) => !evaluation.vetoes[id].triggered && isChecked(evaluation, profile, id)).map(
    (id) => ruleView(evaluation, profile, id),
  );
  if (profile.relay_available) {
    passing.push({
      id: "relay",
      term: "relay",
      name: "Relay",
      value: null,
      valueText: "available",
      valueLabel: "available",
      unit: "",
      decimals: 0,
      limit: null,
      limitText: "so there are no blackouts",
      provenance: settingsProvenance(profile, ruleFields(profile, "relay")),
      broken: false,
      sentence: "",
      scaleMax: 1,
    });
  }
  return { broken, passing, statusSentence: statusSentence(evaluation, broken.length) };
}

/**
 * The sites rail's one fact for a row: the worst broken rule with its number and limit
 * ("Blackout: 31 h, limit 12 h"), or the score when every rule passes ("Score 81").
 * Other broken rules are counted by `moreBroken`.
 */
export function railFact(evaluation: Evaluation): string {
  const broken = brokenVetoes(evaluation);
  const worst = broken[0];
  if (!worst) return `Score ${scoreText(evaluation.score)}`;
  const meta = VETO_META[worst];
  const veto = evaluation.vetoes[worst];
  let text: string;
  if (worst === "landing_dark") text = meta.short;
  else if (typeof veto.measured === "number" && typeof veto.limit === "number") {
    const printed = valueAndLimit(veto.measured, veto.limit, meta.unit, meta.decimals);
    text = `${meta.short}: ${printed.value}, ${meta.limitWord} ${printed.limit}`;
  } else text = meta.short;
  return text;
}

/** "1 more rule broken", for the line under a rail row, or null. */
export function moreBroken(evaluation: Evaluation): string | null {
  const extra = brokenVetoes(evaluation).length - 1;
  if (extra <= 0) return null;
  return extra === 1 ? "1 more rule broken" : `${extra} more rules broken`;
}

export type UtilityView = {
  id: "slope" | "power" | "comms";
  term: string;
  name: string;
  /** 0–1, or null when slope was not assessed. */
  value: number | null;
  weight: number;
  /** The weight's share of the assessed weights, 0–1. Weights are normalised. */
  share: number | null;
  /** Sourced only if every setting that feeds the utility and its weight is sourced. */
  provenance: SettingsProvenance;
};

/** The three utilities with their weights and each weight's share of the score. */
export function describeUtilities(evaluation: Evaluation, profile: MissionProfile): UtilityView[] {
  const weights = profile.weights;
  const assessed = (evaluation.utilities.slope === null ? 0 : weights.slope) + weights.power + weights.comms;
  const share = (weight: number, value: number | null) =>
    value === null || assessed <= 0 ? null : weight / assessed;
  return [
    {
      id: "slope",
      term: "utility_slope",
      name: "Slope",
      value: evaluation.utilities.slope,
      weight: weights.slope,
      share: share(weights.slope, evaluation.utilities.slope),
      provenance: settingsProvenance(profile, utilityFields(profile, "slope")),
    },
    {
      id: "power",
      term: "utility_power",
      name: "Power",
      value: evaluation.utilities.power,
      weight: weights.power,
      share: share(weights.power, evaluation.utilities.power),
      provenance: settingsProvenance(profile, utilityFields(profile, "power")),
    },
    {
      id: "comms",
      term: "utility_comms",
      name: "Comms",
      value: evaluation.utilities.comms,
      weight: weights.comms,
      share: share(weights.comms, evaluation.utilities.comms),
      provenance: settingsProvenance(profile, utilityFields(profile, "comms")),
    },
  ];
}

export type MetricView = {
  term: string;
  name: string;
  value: number | string;
  unit: string;
  decimals: number;
  broken: boolean;
};

/** Every metric of the mission window, in docs/science.md §9's order. */
export function describeMetrics(evaluation: Evaluation): MetricView[] {
  const m = evaluation.metrics;
  const v = evaluation.vetoes;
  return [
    { term: "sun_fraction_mean", name: "Mean Sun disc fraction", value: m.sunFractionMean, unit: "", decimals: 2, broken: false },
    { term: "lit_fraction", name: "Lit", value: m.litFraction * 100, unit: "%", decimals: 1, broken: false },
    { term: "longest_dark_h", name: "Longest dark stretch", value: m.longestDarkH, unit: "h", decimals: 0, broken: v.darkness.triggered },
    { term: "link_fraction", name: "Earth link", value: m.linkFraction * 100, unit: "%", decimals: 1, broken: false },
    {
      term: "longest_blackout_h",
      name: "Longest blackout",
      value: m.longestBlackoutH,
      unit: "h",
      decimals: 0,
      broken: v.blackout.triggered,
    },
    {
      term: "landing_sun_el_deg",
      name: "Sun at landing",
      value: m.landingSunElDeg,
      unit: "°",
      decimals: 2,
      broken: v.landing_sun_low.triggered || v.landing_sun_high.triggered,
    },
    { term: "landing_lit", name: "Lit at landing", value: m.landingLit ? "yes" : "no", unit: "", decimals: 0, broken: v.landing_dark.triggered },
  ];
}
