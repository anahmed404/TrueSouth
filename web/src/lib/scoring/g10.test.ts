import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { decodeSeriesFile, type SeriesColumnEncoding } from "./__fixtures__/decodeSeries";
import {
  countdowns,
  evaluate,
  hourFlags,
  windowLength,
  type Evaluation,
  type ScoringProfile,
  type Series,
} from "./index";

/**
 * Coverage the shared fixture is required to contain.
 * docs/validation.md G10, and the labels `build-fixtures` writes for each rule.
 */
const REQUIRED_LABELS = [
  "relay",
  "max_dark_h_zero",
  "slope_not_assessed",
  "operations_sun_elevation",
  "weights_nonunit_zero",
  "half_hour_window_tie",
  "first_hour",
  "last_landing_that_fits",
  "one_hour_too_late",
  "im2_go",
  "im2_caution",
  "veto_slope_alone",
  "veto_darkness_alone",
  "veto_blackout_alone",
  "veto_landing_dark_alone",
  "veto_landing_sun_low_alone",
  "veto_landing_sun_high_alone",
  "current_lit",
  "current_dark",
  "current_linked",
  "current_blackout",
] as const;

const TOLERANCE = 1e-9;

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "../../../..");
const casesPath = path.join(here, "__fixtures__", "scoring_cases.json");
const fixturesRoot = path.join(repoRoot, "data", "fixtures");

type ScoringCase = {
  labels: string[];
  site_id: string;
  series_file: string;
  hour_range: [number, number];
  profile: ScoringProfile;
  landing_hour: number;
  slope_deg: number | null;
  current_hour: number;
  countdowns?: Record<string, number | null>;
  expected: {
    window_length: number;
    lit: boolean[];
    link: boolean[];
    evaluation: Record<string, unknown>;
    countdowns: Record<string, number | null>;
  } | null;
};

const cases = loadCases(casesPath);
let largestDifference = 0;

describe("gate G10", () => {
  it("has at least 40 cases and the required coverage labels", () => {
    expect(cases.length).toBeGreaterThanOrEqual(40);
    const labels = new Set(cases.flatMap((entry) => entry.labels));
    const missing = REQUIRED_LABELS.filter((label) => !labels.has(label));
    expect(missing, `missing coverage labels: ${missing.join(", ")}`).toEqual([]);
    const presets = [...labels].filter((label) => label.startsWith("preset_"));
    expect(presets.length).toBeGreaterThanOrEqual(5);
  });

  it.each(cases.map((entry) => [entry.labels.join(", "), entry] as const))(
    "%s",
    (_title, entry) => {
      const [start, end] = entry.hour_range;
      const full = loadSeries(path.join(fixturesRoot, entry.series_file));
      const slice: Series = {
        sun_frac: full.sun_frac.subarray(start, end),
        sun_el: full.sun_el.subarray(start, end),
        earth_clear: full.earth_clear.subarray(start, end),
      };
      const landing = entry.landing_hour - start;
      const current = entry.current_hour - start;
      const result = evaluate(slice, entry.profile, landing, entry.slope_deg);
      const countdown = countdowns(slice, entry.profile, current);

      if (entry.expected === null) {
        if (result !== null) {
          failCase(entry.labels, "evaluation", null, result.status);
        }
      } else {
        if (result === null) {
          failCase(entry.labels, "evaluation", "a result", null);
        }
        compare(windowLength(entry.profile.duration_days), entry.expected.window_length, "window_length", entry.labels);
        compare(referenceEvaluation(result!), entry.expected.evaluation, "evaluation", entry.labels);
        const flags = hourFlags(slice, entry.profile);
        const n = entry.expected.window_length;
        compare(booleans(flags.lit, landing, n), entry.expected.lit, "lit", entry.labels);
        compare(booleans(flags.link, landing, n), entry.expected.link, "link", entry.labels);
        compare(countdown, entry.expected.countdowns, "countdowns", entry.labels);
      }

      if (entry.countdowns) {
        compare(countdown, entry.countdowns, "case.countdowns", entry.labels);
      }
    },
  );
});

afterAll(() => {
  console.info(`G10 cases: ${cases.length}; largest absolute difference: ${largestDifference}`);
});

const seriesCache = new Map<string, ReturnType<typeof decodeSeriesFile>>();

function loadSeries(binPath: string) {
  const cached = seriesCache.get(binPath);
  if (cached) return cached;
  const meta = JSON.parse(readFileSync(path.join(path.dirname(binPath), "meta.json"), "utf8")) as {
    series: { columns: SeriesColumnEncoding[] };
  };
  const decoded = decodeSeriesFile(binPath, meta.series.columns);
  seriesCache.set(binPath, decoded);
  return decoded;
}

function loadCases(filePath: string): ScoringCase[] {
  const document: unknown = JSON.parse(readFileSync(filePath, "utf8"));
  const rows = Array.isArray(document)
    ? document
    : document && typeof document === "object" && "cases" in document
      ? (document as { cases: unknown }).cases
      : null;
  if (!Array.isArray(rows)) {
    throw new Error("scoring_cases.json has no cases array");
  }
  return rows as ScoringCase[];
}

function referenceEvaluation(result: Evaluation): Record<string, unknown> {
  return {
    metrics: {
      sun_fraction_mean: result.metrics.sunFractionMean,
      lit_fraction: result.metrics.litFraction,
      longest_dark_h: result.metrics.longestDarkH,
      link_fraction: result.metrics.linkFraction,
      longest_blackout_h: result.metrics.longestBlackoutH,
      landing_sun_el_deg: result.metrics.landingSunElDeg,
      landing_lit: result.metrics.landingLit,
    },
    vetoes: result.vetoes,
    utilities: {
      slope: result.utilities.slope,
      power: result.utilities.power,
      comms: result.utilities.comms,
    },
    score: result.score,
    status: result.status,
    slope_not_assessed: result.slopeNotAssessed,
  };
}

function booleans(flags: Uint8Array, start: number, length: number): boolean[] {
  const values: boolean[] = [];
  for (let i = 0; i < length; i++) values.push(flags[start + i] === 1);
  return values;
}

function compare(actual: unknown, expected: unknown, label: string, labels: string[]): void {
  if (typeof expected === "number") {
    if (typeof actual !== "number" || !Number.isFinite(actual)) {
      failCase(labels, label, expected, actual);
    }
    const difference = Math.abs(actual - expected);
    if (difference > largestDifference) largestDifference = difference;
    if (difference > TOLERANCE) failCase(labels, label, expected, actual);
    return;
  }
  if (expected === null || typeof expected === "boolean" || typeof expected === "string") {
    if (actual !== expected) failCase(labels, label, expected, actual);
    return;
  }
  if (Array.isArray(expected)) {
    if (!Array.isArray(actual) || actual.length !== expected.length) {
      failCase(labels, `${label}.length`, expected.length, Array.isArray(actual) ? actual.length : actual);
    }
    for (let i = 0; i < expected.length; i++) {
      compare(actual[i], expected[i], `${label}[${i}]`, labels);
    }
    return;
  }
  if (typeof expected === "object") {
    if (actual === null || typeof actual !== "object") failCase(labels, label, expected, actual);
    for (const key of Object.keys(expected)) {
      compare(
        (actual as Record<string, unknown>)[key],
        (expected as Record<string, unknown>)[key],
        `${label}.${key}`,
        labels,
      );
    }
    return;
  }
  failCase(labels, label, expected, actual);
}

function failCase(labels: string[], field: string, expected: unknown, actual: unknown): never {
  const difference =
    typeof expected === "number" && typeof actual === "number" ? ` difference ${actual - expected}` : "";
  throw new Error(
    `case [${labels.join(", ")}] ${field}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}${difference}`,
  );
}
