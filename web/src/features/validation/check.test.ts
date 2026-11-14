import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Site, Validation } from "../../contracts/generated.ts";
import { INCOMPLETE_MESSAGE, checkReport, checkSeries } from "./check";
import { ValidationView } from "./index";
import { NOT_RUN_MESSAGE, comparisonRows, g2Lines, g2Peak, summariseComparisons, summariseGates, tableRows } from "./model";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const readJson = <T,>(path: string) => JSON.parse(readFileSync(`${repoRoot}${path}`, "utf8")) as T;

/** The real file, as the pipeline wrote it. Each case below damages a copy of it. */
const real = readJson<Validation>("data/derived/validation.json");
const sites = readJson<Site[]>("data/derived/sites.json");

type Raw = Record<string, unknown> & { gates: Record<string, unknown>[]; comparisons: Record<string, unknown>[] };

function copy(): Raw {
  return structuredClone(real) as unknown as Raw;
}

function render(file: unknown): string {
  return renderToStaticMarkup(
    createElement(
      MemoryRouter,
      null,
      createElement(ValidationView, { validation: { status: "ready", data: file as Validation, error: null }, sites }),
    ),
  );
}

/** The damaged files, one per case the review named. */
const CASES: Record<string, () => unknown> = {
  "a gate missing limit": () => {
    const file = copy();
    delete file.gates.find((gate) => gate.id === "G2")!.limit;
    return file;
  },
  "a null measured on a gate whose passed is not null": () => {
    const file = copy();
    file.gates.find((gate) => gate.id === "G4")!.measured = null;
    return file;
  },
  "a comparison with no rows": () => {
    const file = copy();
    file.comparisons = file.comparisons.filter((row) => row.id !== "R1");
    return file;
  },
  "a row missing ours": () => {
    const file = copy();
    delete file.comparisons.find((row) => row.id === "R1")!.ours;
    return file;
  },
  "a row missing its NASA value": () => {
    const file = copy();
    delete file.comparisons.find((row) => row.id === "R2")!.reference;
    return file;
  },
  "g2_over_time with a null inside": () => {
    const file = copy();
    const series = file.g2_over_time as { max_difference_deg: (number | null)[] }[];
    series[0]!.max_difference_deg[3] = null;
    (file.g2_over_time as unknown[]).push(null);
    return file;
  },
  "an unknown gate id": () => {
    const file = copy();
    file.gates.push({ ...file.gates[0]!, id: "G99", name: "A gate this page has never heard of" });
    return file;
  },
  "a gate with no id or name": () => {
    const file = copy();
    file.gates.push({ passed: true });
    return file;
  },
  "a comparison row with no id": () => {
    const file = copy();
    file.comparisons.push({ site_id: "connecting_ridge", ours: "high" });
    return file;
  },
};

describe("checkReport", () => {
  it("passes both data files through whole", () => {
    for (const path of ["data/derived/validation.json", "data/fixtures/validation.json"]) {
      const file = readJson<Validation>(path);
      const checked = checkReport(file)!;
      expect(checked.gates.every((item) => item.kind === "gate"), path).toBe(true);
      expect(checked.comparisons.every((item) => item.kind === "comparison"), path).toBe(true);
      expect(checked.brokenSeries).toBe(0);
      expect(checked.sources).toHaveLength(file.sources.length);
    }
  });

  it("rejects a file without its outline", () => {
    expect(checkReport(null)).toBeNull();
    expect(checkReport([])).toBeNull();
    const noTime = copy();
    delete noTime.generated_utc;
    expect(checkReport(noTime)).toBeNull();
    const noGates = copy();
    noGates.gates = "none" as unknown as Raw["gates"];
    expect(checkReport(noGates)).toBeNull();
    expect(render(noTime)).toContain(NOT_RUN_MESSAGE);
  });

  it("keeps a gate missing its limit as an incomplete record, never as passed", () => {
    const checked = checkReport(CASES["a gate missing limit"]!())!;
    const g2 = checked.gates.find((item) => item.kind === "broken");
    expect(g2).toEqual({ kind: "broken", id: "G2", name: "Sun and Earth directions match JPL Horizons" });
    const summary = summariseGates(checked.gates);
    expect(summary.incomplete).toBe(1);
    expect(summary.passed).toBe(8);
    const markup = render(CASES["a gate missing limit"]!());
    expect(markup).toContain(INCOMPLETE_MESSAGE.replace("'", "&#x27;"));
    expect(markup).toContain("Sun and Earth directions match JPL Horizons");
  });

  it("keeps a measured gate with a null measurement as an incomplete record", () => {
    const checked = checkReport(CASES["a null measured on a gate whose passed is not null"]!())!;
    expect(checked.gates.filter((item) => item.kind === "broken")).toEqual([
      { kind: "broken", id: "G4", name: "Flat terrain gives the spherical horizon dip" },
    ]);
    expect(summariseGates(checked.gates).passed).toBe(8);
  });

  it("says a comparison with no rows has no results", () => {
    const markup = render(CASES["a comparison with no rows"]!());
    expect(markup).toContain("This run has no results for R1.");
  });

  it("keeps a row missing a value in its table, out of the chart and out of the counts", () => {
    for (const name of ["a row missing ours", "a row missing its NASA value"]) {
      const checked = checkReport(CASES[name]!())!;
      const id = name === "a row missing ours" ? "R1" : "R2";
      // The published file includes the five best-lit variants. One damaged
      // row stays in the table and leaves the chart.
      const published = real.comparisons.filter((row) => row.id === id).length;
      expect(tableRows(checked.comparisons, id)).toHaveLength(published);
      expect(comparisonRows(checked.comparisons, id)).toHaveLength(published - 1);
      expect(summariseComparisons(checked.comparisons).incomplete).toBe(1);
      const markup = render(CASES[name]!());
      expect(markup).toContain(INCOMPLETE_MESSAGE.replace("'", "&#x27;"));
      expect(markup).toContain("One more record is incomplete in this build and is not drawn.");
    }
  });

  it("draws a missing chart value as a gap and leaves out a broken series", () => {
    const checked = checkReport(CASES["g2_over_time with a null inside"]!())!;
    expect(checked.brokenSeries).toBe(1);
    const lines = g2Lines(checked.g2_over_time, checked.g2_over_time[0]!.site_id);
    expect(lines[0]!.points[3]!.value).toBeNull();
    expect(g2Peak(checked.g2_over_time)?.value).toBeGreaterThan(0);
    expect(checkSeries({ site_id: "a", body: "moon", start_utc: "2026-01-01T00:00:00Z", step_h: 24, max_difference_deg: [] })).toBeNull();
    expect(render(CASES["g2_over_time with a null inside"]!())).toContain("One chart series is incomplete");
  });

  it("shows a gate with an unknown id among the other checks", () => {
    const markup = render(CASES["an unknown gate id"]!());
    expect(markup).toContain("A gate this page has never heard of");
    expect(markup).toContain(">G99<");
  });

  it("lists records with no id on their own", () => {
    expect(render(CASES["a gate with no id or name"]!())).toContain("A check with no name");
    const markup = render(CASES["a comparison row with no id"]!());
    expect(markup).toContain("Records we could not read");
    expect(markup).toContain("Connecting Ridge");
  });

  it("never prints NaN, undefined, null or Infinity, for any case", () => {
    for (const [name, make] of Object.entries(CASES)) {
      const markup = render(make());
      for (const word of ["NaN", "undefined", "null", "Infinity"]) {
        expect(markup.includes(word), `${name}: ${word}`).toBe(false);
      }
    }
    for (const word of ["NaN", "undefined", "null", "Infinity"]) {
      expect(render(real).includes(word), `real file: ${word}`).toBe(false);
    }
    // It renders every case and the real file: about 5 s on a loaded machine, so 20 s, not 5.
  }, 20_000);
});
