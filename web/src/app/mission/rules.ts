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
import type { Provenance } from "../../components/ProvenanceTag";

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
  /** The limit as words: "limit 12 h", "at least 6°", "needs sunlight". */
  limitText: string;
  provenance: Provenance | null;
  broken: boolean;
  /** One plain sentence on what happened. Only for a broken rule. */
  sentence: string;
  /** The bar's full scale, in the rule's unit. */
  scaleMax: number;
};

/** A profile field's sourced or assumed tag. Every value field has one. */
export function provenanceOf(profile: MissionProfile, field: string): Provenance | null {
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

function brokenSentence(id: VetoId, value: number | null, limit: number | null, unit: string, decimals: number): string {
  const v = value === null ? "" : formatValue(value, unit, decimals);
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
  const provenance = provenanceOf(profile, meta.limitField);
  if (id === "landing_dark") {
    const lit = veto.measured === true;
    return {
      id,
      term: meta.term,
      name: veto.triggered ? meta.name : meta.passName,
      value: null,
      valueText: lit ? "yes" : "dark",
      unit: "",
      decimals: 0,
      limit: null,
      limitText: lit ? "" : "needs sunlight",
      provenance,
      broken: veto.triggered,
      sentence: veto.triggered ? brokenSentence(id, null, null, "", 0) : "",
      scaleMax: 1,
    };
  }
  const value = typeof veto.measured === "number" ? veto.measured : null;
  const limit = typeof veto.limit === "number" ? veto.limit : null;
  const limitText = limit === null ? "" : `${meta.limitWord} ${formatLimit(limit, meta.unit)}`;
  return {
    id,
    term: meta.term,
    name: veto.triggered ? meta.name : meta.passName,
    value,
    valueText: null,
    unit: meta.unit,
    decimals: meta.decimals,
    limit,
    limitText,
    provenance,
    broken: veto.triggered,
    sentence: veto.triggered ? brokenSentence(id, value, limit, meta.unit, meta.decimals) : "",
    scaleMax: Math.max(value ?? 0, limit ?? 0, 1),
  };
}

/**
 * How badly a broken rule is broken, so the worst one leads. A dark landing is always
 * worst. Otherwise: how far past the limit the value is, as a share of the limit (a limit
 * under 1 counts as 1, so a 0 h limit does not divide by zero).
 */
export function severity(evaluation: Evaluation, id: VetoId): number {
  const veto = evaluation.vetoes[id];
  if (!veto.triggered) return -Infinity;
  if (id === "landing_dark") return Infinity;
  if (typeof veto.measured !== "number" || typeof veto.limit !== "number") return 0;
  const over = id === "landing_sun_low" ? veto.limit - veto.measured : veto.measured - veto.limit;
  return over / Math.max(Math.abs(veto.limit), 1);
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
      unit: "",
      decimals: 0,
      limit: null,
      limitText: "so there are no blackouts",
      provenance: provenanceOf(profile, "relay_available"),
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
  if (!worst) return `Score ${formatNumber(evaluation.score)}`;
  const meta = VETO_META[worst];
  const veto = evaluation.vetoes[worst];
  let text: string;
  if (worst === "landing_dark") text = meta.short;
  else if (typeof veto.measured === "number" && typeof veto.limit === "number") {
    text = `${meta.short}: ${formatValue(veto.measured, meta.unit, meta.decimals)}, ${meta.limitWord} ${formatLimit(veto.limit, meta.unit)}`;
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
    },
    {
      id: "power",
      term: "utility_power",
      name: "Power",
      value: evaluation.utilities.power,
      weight: weights.power,
      share: share(weights.power, evaluation.utilities.power),
    },
    {
      id: "comms",
      term: "utility_comms",
      name: "Comms",
      value: evaluation.utilities.comms,
      weight: weights.comms,
      share: share(weights.comms, evaluation.utilities.comms),
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
