/**
 * The Compare table's display rules with hand-built evaluations (docs/features/compare.md):
 * "best" marks with a tie, the deciding row, the site notes, the summary sentence for zero,
 * one and several GO sites, and the CSV export read back against the table.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile, Site, Sites } from "../../../contracts/generated";
import { NO_RESULT_TEXT, type SiteStatus } from "../../../app/mission/site-status";
import { nearbyRangeText } from "../../../app/mission/site-labels";
import { parseCsv } from "../../../lib/export";
import type { Evaluation, VetoId } from "../../../lib/scoring";
import { COMPARE_CSV_HEADER, compareCsv, compareFileName, scenarioFileName, scenarioJson, type ExportScenario } from "./export";
import {
  MAP_CENTRE_NOTE,
  nameList,
  rowLimit,
  TOO_FEW_SITES,
  compareColumn,
  metricRows,
  statusCells,
  summarySentence,
  type ColumnView,
} from "./model";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const json = <T,>(file: string) => JSON.parse(readFileSync(path.join(fixtures, file), "utf8")) as T;
const profiles = json<MissionProfile[]>("profiles.json");
const manifest = json<Manifest>("manifest.json");
const fixtureSites = json<Sites>("sites.json");
const athena = profiles.find((p) => p.id === "im2_athena") as MissionProfile;

/** Four sites, named A–D, plus the kinds of site that carry a note. */
function site(id: string, patch: Partial<Site> = {}): Site {
  const base = fixtureSites[0] as Site;
  return { ...base, id, name: patch.name ?? id.toUpperCase(), variant_of: null, offset_m: null, nearby_sun: null, ...patch };
}

const SITES: Site[] = [
  site("a", { name: "Alpha", slope: { deg: 3.04, baseline_m: 160, source: "LDEM_80S_80MPP_ADJ.TIF, central difference" } }),
  site("b", { name: "Bravo", slope: { deg: 2.96, baseline_m: 160, source: "LDEM_80S_80MPP_ADJ.TIF, central difference" } }),
  site("c", { name: "Charlie", slope: { deg: 7.0, baseline_m: 160, source: "LDEM_80S_80MPP_ADJ.TIF, central difference" } }),
  site("d", { name: "Delta", terrain_tier: "sphere", slope: null, group: "contrast" }),
  site("peak", { name: "Peak", group: "sunlit_peak", nearby_sun: { radius_m: 160, points: 13, min: 0.4, max: 0.87 } }),
  site("peak_best_lit", { name: "Peak, best lit", group: "sunlit_peak", variant_of: "peak", offset_m: 149, nearby_sun: { radius_m: 160, points: 13, min: 0.4, max: 0.87 } }),
  site("artemis_x", { name: "Mons X", group: "artemis" }),
];

type Patch = {
  status?: Evaluation["status"];
  score?: number;
  metrics?: Partial<Evaluation["metrics"]>;
  vetoes?: Partial<Record<VetoId, Partial<Evaluation["vetoes"][VetoId]>>>;
};

function evaluation({ status = "GO", score = 81.4, metrics = {}, vetoes = {} }: Patch = {}): Evaluation {
  const m = {
    sunFractionMean: 0.9,
    litFraction: 0.95,
    longestDarkH: 4,
    linkFraction: 0.871,
    longestBlackoutH: 10,
    landingSunElDeg: 0.8,
    landingLit: true,
    ...metrics,
  };
  const base: Evaluation = {
    metrics: m,
    vetoes: {
      slope: { triggered: false, measured: 3, limit: athena.max_slope_deg },
      darkness: { triggered: false, measured: m.longestDarkH, limit: athena.max_dark_h },
      blackout: { triggered: false, measured: m.longestBlackoutH, limit: athena.max_blackout_h },
      landing_dark: { triggered: !m.landingLit, measured: m.landingLit, limit: true },
      landing_sun_low: { triggered: false, measured: m.landingSunElDeg, limit: null },
      landing_sun_high: { triggered: false, measured: m.landingSunElDeg, limit: null },
    },
    utilities: { slope: 0.9, power: 0.8, comms: 0.7 },
    score,
    status,
    slopeNotAssessed: false,
  };
  for (const [id, veto] of Object.entries(vetoes)) base.vetoes[id as VetoId] = { ...base.vetoes[id as VetoId], ...veto };
  return base;
}

const ready = (e: Evaluation): SiteStatus => ({ kind: "ready", evaluation: e });

function columns(entries: [string, SiteStatus][], profile = athena): ColumnView[] {
  return entries.map(([id, status]) => compareColumn(id, SITES, status, profile));
}

const LANDING = "2028-03-14T00:00:00Z";

/** The screen puts a narrow no-break space before a unit; the expected strings use a space. */
const plain = <T,>(value: T): T => (typeof value === "string" ? (value.replace(/ /g, " ") as T) : Array.isArray(value) ? (value.map(plain) as T) : value);

describe("best marks", () => {
  // A and B tie on sunlight (0.90 printed), B is the shortest dark stretch, A and B tie on the
  // printed score (81), and A and B tie on slope at one decimal (3.0°).
  const four = columns([
    ["a", ready(evaluation({ score: 81.9, metrics: { sunFractionMean: 0.901, longestDarkH: 4, linkFraction: 0.5 } }))],
    ["b", ready(evaluation({ score: 81.2, metrics: { sunFractionMean: 0.899, longestDarkH: 3, linkFraction: 0.6 } }))],
    ["c", ready(evaluation({ status: "CAUTION", score: 55, metrics: { sunFractionMean: 0.7, longestDarkH: 5, linkFraction: 0.9 } }))],
    [
      "d",
      ready(
        evaluation({
          status: "NO-GO",
          score: 99,
          metrics: { sunFractionMean: 0.2, longestDarkH: 40, linkFraction: 0.9 },
          vetoes: { darkness: { triggered: true, measured: 40 } },
        }),
      ),
    ],
  ]);
  const rows = metricRows(four, athena);
  const best = (id: string) => rows.find((r) => r.id === id)!.cells.map((c) => c?.best ?? false);

  it("marks every site tied for best, on the printed value", () => {
    expect(best("sunlight")).toEqual([true, true, false, false]);
    expect(best("slope")).toEqual([true, true, false, false]);
    expect(best("link")).toEqual([false, false, true, true]);
  });

  it("marks the lowest for hours of darkness", () => {
    expect(best("dark")).toEqual([false, true, false, false]);
  });

  it("marks the best score only among sites whose score is used", () => {
    expect(statusCells(four).map((c) => c?.best)).toEqual([true, true, false, false]);
    expect(statusCells(four)[3]?.used).toBe(false);
  });

  it("marks nothing when every value is equal", () => {
    expect(best("blackout")).toEqual([false, false, false, false]);
  });

  it("raises the row whose values differ most where a site breaks a rule", () => {
    expect(rows.filter((r) => r.deciding).map((r) => r.id)).toEqual(["dark"]);
  });

  it("never marks a best-lit variant best in the Sunlight row", () => {
    const pair = columns([
      ["peak", ready(evaluation({ metrics: { sunFractionMean: 0.6 } }))],
      ["peak_best_lit", ready(evaluation({ metrics: { sunFractionMean: 0.9 } }))],
      ["a", ready(evaluation({ metrics: { sunFractionMean: 0.5 } }))],
    ]);
    const sunlight = metricRows(pair, athena).find((r) => r.id === "sunlight")!;
    expect(sunlight.cells.map((c) => c?.best)).toEqual([true, false, false]);
  });
});

describe("the Sun-at-landing row's limit", () => {
  it("shows the profile's landing-Sun window and scales the row by it", () => {
    const windowed = { ...athena, landing_sun_el_min_deg: 6, landing_sun_el_max_deg: 9 };
    const cols = columns([["a", ready(evaluation())], ["b", ready(evaluation())]], windowed);
    const row = metricRows(cols, windowed).find((r) => r.id === "landing_sun")!;
    expect(plain(row.limitText)).toBe("at least 6°, at most 9°, and lit");
    expect(rowLimit({ id: "landing_sun" }, windowed)).toBe(9);
    expect(rowLimit({ id: "landing_sun" }, { ...athena, landing_sun_el_min_deg: -2, landing_sun_el_max_deg: null })).toBe(2);
    expect(rowLimit({ id: "landing_sun" }, { ...athena, landing_sun_el_min_deg: null, landing_sun_el_max_deg: null })).toBeNull();
  });
});

describe("site notes", () => {
  const cols = columns([
    ["peak", ready(evaluation())],
    ["peak_best_lit", ready(evaluation())],
    ["artemis_x", ready(evaluation())],
    ["d", ready(evaluation())],
  ]);
  const sunlight = metricRows(cols, athena).find((r) => r.id === "sunlight")!;
  const slope = metricRows(cols, athena).find((r) => r.id === "slope")!;

  it("a sunlit-peak site shows its nearby range, beside its own sunlight", () => {
    expect(plain(sunlight.cells[0]?.notes)).toEqual(["Within 160 m: 40 % to 87 %"]);
  });

  it("a best-lit variant is chosen by TrueSouth, with its distance and an upper-reading note", () => {
    expect(plain(cols[1]?.chosenBy)).toBe("Best-lit map pixel, 149 m from Peak");
    expect(plain(sunlight.cells[1]?.notes)).toEqual(["Within 160 m: 40 % to 87 %", "Its sunlight is an upper reading: the brightest of the map pixels within 160 m."]);
  });

  it("an Artemis candidate entry carries the map-centre note", () => {
    expect(cols[2]?.notes).toEqual([MAP_CENTRE_NOTE]);
  });

  it("a sphere-tier site: terrain not modelled, slope not assessed", () => {
    expect(cols[3]?.tier).toBe("Terrain not modelled");
    expect(slope.cells[3]?.text).toBe("Slope not assessed");
    expect(slope.cells[3]?.sub).toBe("terrain not modelled");
    expect(slope.cells[3]?.value).toBeNull();
  });
});

describe("the nearby range never looks narrower than the data", () => {
  it("rounds the low end down and the high end up", () => {
    // Connecting Ridge's real range (sites.json, #77): 39.75 % to 86.96 %.
    const ridge = { radius_m: 160, points: 13, min: 0.3974903475727703, max: 0.8696149458331431 };
    expect(plain(nearbyRangeText(ridge))).toBe("Within 160 m: 39 % to 87 %");
    expect(plain(nearbyRangeText({ radius_m: 160, points: 3, min: 0.4, max: 0.87 }))).toBe("Within 160 m: 40 % to 87 %");
    expect(plain(nearbyRangeText({ radius_m: 160, points: 3, min: 0.001, max: 0.999 }))).toBe("Within 160 m: 0 % to 100 %");
    expect(nearbyRangeText(null)).toBeNull();
  });
});

describe("the summary sentence", () => {
  const go = (score = 81.4) => ready(evaluation({ score }));
  const caution = (score = 55) => ready(evaluation({ status: "CAUTION", score }));
  const blackout = ready(
    evaluation({ status: "NO-GO", score: 40, metrics: { longestBlackoutH: 31 }, vetoes: { blackout: { triggered: true, measured: 31 } } }),
  );
  const dark = ready(evaluation({ status: "NO-GO", score: 10, metrics: { landingLit: false } }));
  const lead = "For IM-2 Athena landing 2028-03-14 00:00 UTC";
  const say = (entries: [string, SiteStatus][]) => plain(summarySentence(columns(entries), athena, LANDING));

  it("with no site", () => {
    expect(say([])).toBe("No sites are selected. Add sites from the sites rail to compare them.");
  });

  it("with one site, says Compare needs two", () => {
    expect(say([["a", go()]])).toBe(`${lead}, Alpha is GO. ${TOO_FEW_SITES}`);
    expect(say([["b", blackout]])).toBe(`${lead}, Bravo is NO-GO: it fails on a 31 h blackout (limit ${athena.max_blackout_h} h). ${TOO_FEW_SITES}`);
  });

  it("with no GO site", () => {
    expect(say([["a", blackout], ["b", dark]])).toBe(
      `${lead}, every site is NO-GO. Alpha fails on a 31 h blackout (limit ${athena.max_blackout_h} h). Bravo fails on a dark landing.`,
    );
    expect(say([["a", caution(55)], ["b", caution(60)], ["c", dark]])).toBe(
      `${lead}, no site is GO; Alpha and Bravo are CAUTION. Bravo scores highest, 60 of 100. Charlie fails on a dark landing.`,
    );
  });

  it("with one GO site", () => {
    expect(say([["a", go()], ["b", blackout]])).toBe(
      `${lead}, Alpha is the only GO site. Bravo fails on a 31 h blackout (limit ${athena.max_blackout_h} h).`,
    );
  });

  it("with several GO sites, and a tie", () => {
    expect(say([["a", go(81.9)], ["b", go(75)], ["c", caution()]])).toBe(
      `${lead}, Alpha and Bravo are GO. Alpha scores highest, 81 of 100. Charlie is CAUTION.`,
    );
    expect(say([["a", go(81.9)], ["b", go(81.1)]])).toBe(`${lead}, both sites are GO. They tie on score, 81 of 100.`);
    expect(say([["a", go(90)], ["b", go(90.5)], ["c", go(70)], ["d", blackout]])).toBe(
      `${lead}, Alpha, Bravo and Charlie are GO. Alpha and Bravo tie for the highest score, 90 of 100. Delta fails on a 31 h blackout (limit ${athena.max_blackout_h} h).`,
    );
  });

  it("says 'every', 'both' or 'all' only when every site has a result", () => {
    const failed: SiteStatus = { kind: "error", message: "404" };
    expect(say([["a", blackout], ["b", dark], ["c", dark], ["d", failed]])).toBe(
      `${lead}, the three sites with a result are NO-GO. Delta could not be loaded.`,
    );
    expect(say([["a", blackout], ["b", failed]])).toBe(
      `${lead}, the only site with a result is NO-GO. Alpha fails on a 31 h blackout (limit ${athena.max_blackout_h} h). Bravo could not be loaded.`,
    );
    expect(say([["a", go(90)], ["b", go(70)], ["c", { kind: "none" }]])).toContain(`${lead}, the two sites with a result are GO.`);
    expect(say([["a", caution(55)], ["b", caution(60)], ["c", failed]])).toContain(`${lead}, no site is GO; the two sites with a result are CAUTION.`);
    expect(say([["a", caution(55)], ["b", caution(60)]])).toContain(`${lead}, no site is GO; both are CAUTION.`);
  });

  it("splits names that hold a comma with semicolons", () => {
    expect(nameList(["Alpha", "Bravo", "Charlie"])).toBe("Alpha, Bravo and Charlie");
    expect(nameList(["Ridge", "Ridge, best-lit point", "Rim, best-lit point"])).toBe("Ridge; Ridge, best-lit point; and Rim, best-lit point");
    expect(nameList(["Ridge", "Ridge, best-lit point"])).toBe("Ridge and Ridge, best-lit point");
  });

  it("while loading, and with a site that has no result or failed", () => {
    expect(say([["a", go()], ["b", { kind: "loading" }]])).toBe(`${lead}: loading the sites' data…`);
    expect(say([["a", go()], ["b", go(75)], ["c", { kind: "none" }]])).toContain(`Charlie: ${NO_RESULT_TEXT.charAt(0).toLowerCase()}`);
    expect(say([["a", go()], ["b", { kind: "error", message: "404" }]])).toBe(`${lead}, Alpha is the only GO site. Bravo could not be loaded.`);
  });
});

describe("the exports", () => {
  const cols = columns([
    ["a", ready(evaluation({ score: 81.9, metrics: { sunFractionMean: 0.901, landingSunElDeg: -0.25 } }))],
    ["b", ready(evaluation({ status: "NO-GO", score: 40, metrics: { longestBlackoutH: 31 }, vetoes: { blackout: { triggered: true, measured: 31 } } }))],
    ["d", ready(evaluation({ status: "CAUTION", score: 55 }))],
    ["peak_best_lit", ready(evaluation())],
  ]);
  const rows = metricRows(cols, athena);
  const scenario: ExportScenario = {
    profile: athena,
    basePresetId: "im2_athena",
    changedFields: [],
    siteIds: cols.map((c) => c.siteId),
    focusedSiteId: "a",
    landingUtc: LANDING,
    currentUtc: "2028-03-15T12:00:00Z",
    view: "compare",
    grid: manifest.time_grid,
    link: "https://example.test/mission?profile=im2_athena",
  };
  const made = new Date("2026-11-13T09:41:05.123Z");
  const csv = compareCsv(cols, rows, scenario, made);
  const parsed = parseCsv(csv);

  it("starts with the profile, landing date, time made, source, caveat and grid range", () => {
    expect(parsed.comments[0]).toBe("TrueSouth comparison: one row per selected site. Values are as printed on screen (rounded); the JSON export holds full precision");
    expect(parsed.comments).toContain("Profile: IM-2 Athena (im2_athena)");
    expect(parsed.comments).toContain(`Landing date: ${LANDING}`);
    expect(parsed.comments).toContain("Made: 2026-11-13T09:41:05Z");
    expect(parsed.comments).toContain("Planning aid, not flight certification");
    expect(parsed.comments.some((c) => c.startsWith("Source: TrueSouth"))).toBe(true);
    expect(parsed.comments).toContain("Time grid: 2026-01-01T00:00:00Z to 2031-12-31T23:00:00Z, every 3600 s");
    expect(parsed.comments.find((c) => c.startsWith("Mission window:"))).toBe(
      "Mission window: 2028-03-14T00:00:00Z to 2028-03-23T23:00:00Z (240 h)",
    );
  });

  it("gives every profile limit with its sourced or assumed tag", () => {
    const limits = parsed.comments.filter((c) => c.startsWith("  "));
    expect(limits).toHaveLength(12);
    for (const line of limits) expect(line).toMatch(/; (sourced: https?:\/\/|assumed: )/);
    expect(limits.find((l) => l.includes("(max_slope_deg)"))).toContain(`= ${athena.max_slope_deg} deg; assumed:`);
  });

  it("puts units in the column names", () => {
    expect(parsed.header).toEqual([...COMPARE_CSV_HEADER]);
  });

  it("reads back to the table's values", () => {
    const statuses = statusCells(cols);
    const col = (name: string) => parsed.header.indexOf(name);
    expect(parsed.rows).toHaveLength(cols.length);
    parsed.rows.forEach((row, index) => {
      const column = cols[index] as ColumnView;
      const cell = (id: string) => rows.find((r) => r.id === id)!.cells[index]!;
      expect(row[col("site_id")]).toBe(column.siteId);
      expect(row[col("status")]).toBe(statuses[index]?.status);
      expect(row[col("score_of_100")]).toBe(statuses[index]?.scoreText);
      // Each number is the table's printed number, with a plain minus for spreadsheets.
      const asNumber = (text: string) => Number(text.replace("−", "-").replace(/[^0-9.\-]/g, ""));
      expect(Number(row[col("sun_fraction_mean")])).toBe(asNumber(cell("sunlight").text));
      expect(Number(row[col("lit_pct")])).toBe(asNumber(cell("sunlight").sub as string));
      expect(Number(row[col("longest_dark_h")])).toBe(asNumber(cell("dark").text));
      expect(Number(row[col("link_pct")])).toBe(asNumber(cell("link").text));
      expect(Number(row[col("longest_blackout_h")])).toBe(asNumber(cell("blackout").text));
      expect(Number(row[col("landing_sun_el_deg")])).toBe(asNumber(cell("landing_sun").text));
      const slopeText = cell("slope").text;
      expect(row[col("slope_deg")]).toBe(cell("slope").value === null ? "" : String(asNumber(slopeText)));
    });
    expect(parsed.rows[0]?.[col("landing_sun_el_deg")]).toBe("-0.25");
    expect(parsed.rows[1]?.[col("broken_rules")]).toBe(`Longest blackout 31 h, limit ${athena.max_blackout_h} h`);
    expect(parsed.rows[1]?.[col("score_used")]).toBe("no: a broken rule decides");
    expect(parsed.rows[3]?.[col("notes")]).toContain("Best-lit map pixel, 149 m from Peak");
    expect(parsed.rows[3]?.[col("notes")]).toContain("Within 160 m: 40 % to 87 %");
  });

  it("the JSON carries the scenario, every limit's tag and full-precision results", () => {
    const doc = JSON.parse(scenarioJson(cols, scenario, made));
    expect(doc.made_utc).toBe("2026-11-13T09:41:05Z");
    expect(doc.caveat).toBe("Planning aid, not flight certification");
    expect(doc.time_grid).toEqual({ start_utc: "2026-01-01T00:00:00Z", end_utc: "2031-12-31T23:00:00Z", step_s: 3600, hours: 52584 });
    expect(doc.scenario.view).toBe("compare");
    expect(doc.scenario.mission_window.end_utc).toBe("2028-03-23T23:00:00Z");
    expect(doc.limits).toHaveLength(12);
    for (const limit of doc.limits) expect(["sourced", "assumed"]).toContain(limit.provenance.kind);
    expect(doc.results[0].metrics.sun_fraction_mean).toBe(0.901);
    expect(doc.results[1].broken_rules).toEqual(["blackout"]);
    const times = JSON.stringify(doc).match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?[^"]*/g) ?? [];
    for (const t of times) expect(t.endsWith("Z")).toBe(true);
  });

  it("names the files after what they are", () => {
    expect(compareFileName(scenario)).toBe("truesouth_compare_im2_athena_2028-03-14.csv");
    expect(scenarioFileName(scenario)).toBe("truesouth_scenario_im2_athena_2028-03-14.json");
  });

  it("quotes a field with a comma or a quote, and reads it back", () => {
    const tricky = columns([["a", ready(evaluation())], ["b", ready(evaluation())]]).map((c, i) => (i === 0 ? { ...c, name: 'Rim, "north"' } : c));
    const back = parseCsv(compareCsv(tricky, metricRows(tricky, athena), scenario, made));
    expect(back.rows[0]?.[1]).toBe('Rim, "north"');
  });
});
