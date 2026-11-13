import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Gate, Site, Validation } from "../../contracts/generated.ts";
import type { HookResult } from "../../data/hooks.ts";
import { parseValidation } from "../../data/parse.ts";
import { formatCount, formatPercent, formatPoints, formatValue, withUnit } from "./format";
import { ValidationView } from "./index";
import { isPlayableLesson } from "./Method";
import {
  GATE_VERDICT_LABEL,
  NOT_RUN_MESSAGE,
  comparisonRows,
  defaultG2Site,
  g2Lines,
  g2Peak,
  g2YearPeaks,
  gateVerdict,
  groupGates,
  pageState,
  scatterPoints,
  siteNames,
  slopeSectionIds,
  summariseComparisons,
  summariseGates,
} from "./model";
import { GateList, MapComparison, OtherComparison } from "./sections";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const readRepo = (path: string) => readFileSync(`${repoRoot}${path}`, "utf8");

/** The fixture written by the Python pipeline. Never edited here. */
const fixture = parseValidation(JSON.parse(readRepo("data/fixtures/validation.json")));
const fixtureSites = JSON.parse(readRepo("data/fixtures/sites.json")) as Site[];
const names = siteNames(fixtureSites);

function html(element: ReturnType<typeof createElement>): string {
  return renderToStaticMarkup(createElement(MemoryRouter, null, element));
}

/** A gate this run did not measure, shaped as validate.json writes G10 and G11. */
function unmeasured(gate: Gate): Gate {
  return {
    ...gate,
    passed: null,
    measured: null,
    samples: 0,
    detail: "Not measured by this command. It is checked by the web tests against the shared scoring fixture.",
  };
}

describe("page state", () => {
  it("is loading while the file loads", () => {
    expect(pageState({ status: "loading", data: null, error: null })).toEqual({ kind: "loading" });
  });

  it("is not run when the file is missing (the loader gives null)", () => {
    expect(pageState({ status: "ready", data: null, error: null })).toEqual({ kind: "not-run" });
  });

  it("is not run when the file cannot be read", () => {
    expect(pageState({ status: "error", data: null, error: "validation.json is not valid JSON" })).toEqual({
      kind: "not-run",
    });
  });

  it("is ready with the report", () => {
    expect(pageState({ status: "ready", data: fixture, error: null })).toEqual({ kind: "ready", report: fixture });
  });
});

describe("gates", () => {
  it("reads a null passed as checked in the web tests, never passed or failed", () => {
    const g10 = fixture.gates.find((gate) => gate.id === "G10");
    expect(g10).toBeDefined();
    const gate = unmeasured(g10!);
    expect(gateVerdict(gate)).toBe("elsewhere");
    expect(GATE_VERDICT_LABEL[gateVerdict(gate)]).toBe("Checked in the web tests");

    const markup = html(createElement(GateList, { gates: [gate], label: "Other checks" }));
    expect(markup).toContain("Checked in the web tests");
    expect(markup).toContain("Not measured here");
    expect(markup).not.toMatch(/>Passed</);
    expect(markup).not.toMatch(/>Failed</);
  });

  it("shows the fixture's failing gate as failed, in its group", () => {
    const g6 = fixture.gates.find((gate) => gate.id === "G6")!;
    expect(gateVerdict(g6)).toBe("failed");
    const groups = groupGates(fixture.gates);
    expect(groups.terrain.map((gate) => gate.id)).toContain("G6");
    expect(groups.sky?.id).toBe("G2");
    // No gate is left off the page.
    const shown = [groups.sky, ...groups.terrain, ...groups.other].filter(Boolean);
    expect(shown).toHaveLength(fixture.gates.length);

    const markup = html(createElement(GateList, { gates: groups.terrain, label: "Terrain geometry checks" }));
    expect(markup).toContain("Failed");
  });

  it("counts the file's gates", () => {
    const withNull = fixture.gates.map((gate) => (gate.id === "G10" || gate.id === "G11" ? unmeasured(gate) : gate));
    expect(summariseGates(withNull)).toEqual({ total: 11, measured: 9, passed: 8, failed: 1, elsewhere: 2 });
  });
});

describe("comparisons", () => {
  it("turns R1 into rows with the site's name, the file's flag and its explanation", () => {
    const rows = comparisonRows(fixture.comparisons, "R1", names);
    expect(rows).toHaveLength(1);
    const row = rows[0]!;
    expect(row.siteName).toBe("Fixture Ridge");
    expect(row.verdict).toBe("outside");
    expect(row.difference).toBeCloseTo(0.3, 12);
    expect(row.explanation).toBe("Synthetic values deliberately exceed the investigation mark.");
  });

  it("keeps the fixture's deliberately failing comparison visible and labelled", () => {
    expect(summariseComparisons(fixture.comparisons)).toEqual({ total: 6, outside: 1 });
    const points = scatterPoints(comparisonRows(fixture.comparisons, "R1", names));
    expect(points).toEqual([expect.objectContaining({ label: "Fixture Ridge", outside: true, x: 0, y: 0.3 })]);

    const markup = html(createElement(MapComparison, { id: "R1", comparisons: fixture.comparisons, names }));
    expect(markup).toContain("Outside the mark");
    expect(markup).toContain("Synthetic values deliberately exceed the investigation mark.");
    // The diamond and the site's label are drawn in the chart.
    expect(markup).toContain('class="vl-diamond"');
    expect(markup).toMatch(/class="vl-outlier-label"[^>]*>Fixture Ridge</);
    // The table carries the same values as the chart.
    expect(markup).toContain("30.0%");
    expect(markup).toContain("+30.0 points");
  });

  it("falls back to the site id when the site is not in sites.json", () => {
    const rows = comparisonRows(fixture.comparisons, "R2");
    expect(rows[0]?.siteName).toBe("fixture_ridge");
  });

  it("puts every comparison other than R1 and R2 in the slope section, in file order", () => {
    expect(slopeSectionIds(fixture.comparisons)).toEqual(["R3", "R4", "R5", "R6"]);
  });

  it("shows a comparison with ourselves without a NASA column", () => {
    const markup = html(createElement(OtherComparison, { id: "R5", comparisons: fixture.comparisons, names }));
    expect(markup).toContain("The skyline at a finer step");
    expect(markup).not.toContain("NASA&#x27;s</th>");
  });

  it("shows an outside self-comparison with its explanation", () => {
    // Built from the fixture's R5 row: the fixture's own failing case is R1.
    const r5 = fixture.comparisons.find((item) => item.id === "R5")!;
    const failing = { ...r5, ours: 0.12, outside_mark: true, explanation: "Made up for this test." };
    const markup = html(createElement(OtherComparison, { id: "R5", comparisons: [failing], names }));
    expect(markup).toContain("Outside the mark");
    expect(markup).toContain("Made up for this test.");
  });
});

describe("gate G2 over time", () => {
  it("builds one line per body for a site, with times from start_utc and step_h", () => {
    const lines = g2Lines(fixture.g2_over_time, "fixture_ridge");
    expect(lines.map((line) => line.body).sort()).toEqual(["earth", "sun"]);
    const first = lines[0]!;
    expect(first.points[0]?.time.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(first.points[1]?.time.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(first.points).toHaveLength(fixture.g2_over_time[0]!.max_difference_deg.length);
  });

  it("finds the largest value in the file and its site", () => {
    const series = [
      { site_id: "a", body: "sun" as const, start_utc: "2026-01-01T00:00:00Z", step_h: 24, max_difference_deg: [0.001, 0.004] },
      { site_id: "b", body: "earth" as const, start_utc: "2026-01-01T00:00:00Z", step_h: 24, max_difference_deg: [0.002, 0.006, 0.003] },
    ];
    const peak = g2Peak(series);
    expect(peak?.siteId).toBe("b");
    expect(peak?.value).toBe(0.006);
    expect(peak?.time.toISOString()).toBe("2026-01-02T00:00:00.000Z");
    expect(defaultG2Site(series)).toBe("b");
  });

  it("gives no site and no chart when g2_over_time is empty or missing", () => {
    expect(defaultG2Site([])).toBeNull();
    expect(defaultG2Site(undefined)).toBeNull();
    const report: Validation = { ...fixture, g2_over_time: [] };
    const markup = page({ status: "ready", data: report, error: null });
    expect(markup).toContain("Sun and Earth positions");
    expect(markup).not.toContain("The largest difference each day");
  });

  it("takes the largest value in each UTC year, per body", () => {
    const lines = g2Lines(fixture.g2_over_time, "fixture_ridge");
    const years = g2YearPeaks(lines);
    expect(years.map((row) => row.year)).toEqual([2026, 2027, 2028, 2029, 2030, 2031]);
  });
});

describe("number display", () => {
  it("writes small values with a power of ten", () => {
    expect(formatValue(3.0886440072208643e-9)).toBe("3.1 × 10⁻⁹");
    expect(formatValue(1e-9)).toBe("1 × 10⁻⁹");
    expect(formatValue(0)).toBe("0");
  });

  it("prints limits and readings as given", () => {
    expect(formatValue(0.02)).toBe("0.02");
    expect(formatValue(10.824032501633923, { sig: 3 })).toBe("10.8");
  });

  it("adds units, percentages and points", () => {
    expect(withUnit("0.006", "deg")).toBe("0.006°");
    expect(withUnit("0.01", "m")).toBe("0.01 m");
    expect(withUnit("0.0013", "fraction")).toBe("0.0013");
    expect(formatPercent(0.5985822873877985)).toBe("59.9%");
    expect(formatPoints(-0.0625)).toBe("−6.3");
    expect(formatPoints(0.038)).toBe("+3.8");
    expect(formatCount(2103360)).toBe("2,103,360");
  });
});

describe("the page", () => {
  it("says validation has not been run, and shows no numbers, when the file is missing", () => {
    const markup = page({ status: "ready", data: null, error: null });
    expect(markup).toContain(NOT_RUN_MESSAGE);
    const main = markup.slice(markup.indexOf("<main"), markup.indexOf("</main>"));
    // The visible text, without tags: no number at all.
    expect(main.replace(/<[^>]*>/g, " ").replace(/&[^;]+;/g, " ")).not.toMatch(/\d/);
  });

  it("shows the frame, not a spinner alone, while loading", () => {
    const markup = page({ status: "loading", data: null, error: null });
    expect(markup).toContain("How we know it&#x27;s right");
    expect(markup).toContain("On this page");
    expect(markup).toContain("Data sources");
  });

  it("renders every section from the fixture, with when it was run and every source link", () => {
    const markup = page({ status: "ready", data: fixture, error: null });
    for (const title of [
      "The method in one picture",
      "Sun and Earth positions",
      "Terrain geometry",
      "Against NASA&#x27;s maps",
      "Slope",
      "What we do not model",
      "Data sources",
    ]) {
      expect(markup).toContain(title);
    }
    expect(markup).toContain("2026-01-01 00:00 UTC");
    for (const source of fixture.sources) expect(markup).toContain(`href="${source.url}"`);
    expect(markup).toContain("Outside the mark");
    expect(markup).toContain("Failed");
  });

  it("links no method box to a lesson that is not written yet", () => {
    const markup = page({ status: "ready", data: fixture, error: null });
    for (const lesson of ["l1_sun", "l2_skyline", "l3_horizon", "l4_link", "l6_tradeoffs"]) {
      expect(isPlayableLesson(lesson)).toBe(false);
      expect(markup).not.toContain(`/academy/${lesson}`);
    }
  });
});

function page(validation: HookResult<Validation | null>): string {
  return html(createElement(ValidationView, { validation, sites: fixtureSites }));
}
