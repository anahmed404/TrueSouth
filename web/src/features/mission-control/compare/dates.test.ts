/**
 * "Sites and dates" rules (docs/features/compare.md): the default picks for one, two and
 * eight selected sites, the date limits at the data's edges, the best column, the deciding
 * row over four columns, the summary, the `cmp` link parameter and the dates export.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile, Site, Sites } from "../../../contracts/generated";
import { clampLanding } from "../../../app/mission/landing-control";
import type { SiteStatus } from "../../../app/mission/site-status";
import { parseCsv } from "../../../lib/export";
import type { Evaluation } from "../../../lib/scoring";
import { hourIndexToUtc } from "../../../lib/time";
import { lastLandingHour } from "../../../state/scenario";
import { scenarioLink } from "../share/share-link";
import { createScenarioStore } from "../../../state/scenario";
import { bestColumns, datesColumnSpecs, datesSummary, defaultPicks, readCmp, resolvePicks, writeCmp, type DatesPicks } from "./dates";
import { DATES_CSV_HEADER, datesCsv, datesFileName, scenarioJson, type ExportScenario } from "./export";
import { compareColumn, metricRows, type ColumnView } from "./model";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const json = <T,>(file: string) => JSON.parse(readFileSync(path.join(fixtures, file), "utf8")) as T;
const manifest = json<Manifest>("manifest.json");
const sites = json<Sites>("sites.json");
const profiles = json<MissionProfile[]>("profiles.json");
const grid = manifest.time_grid;
const athena = profiles.find((p) => p.id === "im2_athena") as MissionProfile;
const DAYS = athena.duration_days;
const LAST = hourIndexToUtc(grid, lastLandingHour(grid, DAYS));
const FIRST = hourIndexToUtc(grid, 0);
const ids = (n: number) => Array.from({ length: n }, (_, i) => `s${i + 1}`);

describe("the default picks", () => {
  const land = "2028-03-01T05:00:00Z";

  it("one site: B is A, one site at two dates", () => {
    expect(defaultPicks(["s1"], "s1", land, null, grid, DAYS)).toEqual({
      siteA: "s1",
      siteB: "s1",
      date1: land,
      date2: "2028-03-08T05:00:00Z",
    });
  });

  it("two sites: A is the focused site, B the next one, wrapping to the first", () => {
    expect(defaultPicks(ids(2), "s2", land, null, grid, DAYS)).toMatchObject({ siteA: "s2", siteB: "s1" });
    expect(defaultPicks(ids(2), "s1", land, null, grid, DAYS)).toMatchObject({ siteA: "s1", siteB: "s2" });
  });

  it("eight sites: B is the site after the focused one; no focus means the first two", () => {
    expect(defaultPicks(ids(8), "s3", land, null, grid, DAYS)).toMatchObject({ siteA: "s3", siteB: "s4" });
    expect(defaultPicks(ids(8), "s8", land, null, grid, DAYS)).toMatchObject({ siteA: "s8", siteB: "s1" });
    expect(defaultPicks(ids(8), null, land, null, grid, DAYS)).toMatchObject({ siteA: "s1", siteB: "s2" });
  });

  it("date 2 is A's next GO day when there is one, else date 1 plus 7 days", () => {
    expect(defaultPicks(ids(2), "s1", land, "2028-03-19T00:00:00Z", grid, DAYS)?.date2).toBe("2028-03-19T00:00:00Z");
    expect(defaultPicks(ids(2), "s1", land, null, grid, DAYS)?.date2).toBe("2028-03-08T05:00:00Z");
  });

  it("date 2 never passes the last landing whose window fits the data", () => {
    expect(defaultPicks(ids(2), "s1", LAST, null, grid, DAYS)).toMatchObject({ date1: LAST, date2: LAST });
  });

  it("no site: no picks", () => {
    expect(defaultPicks([], null, land, null, grid, DAYS)).toBeNull();
  });

  it("keeps the user's picks, and falls back to the default for a site no longer selected", () => {
    const defaults = defaultPicks(ids(3), "s1", land, null, grid, DAYS);
    const mine: DatesPicks = { siteA: "s3", siteB: "gone", date1: "2028-04-01T00:00:00Z", date2: "2028-05-01T00:00:00Z" };
    expect(resolvePicks(mine, defaults, ids(3))).toEqual({ ...mine, siteB: "s2" });
    expect(resolvePicks(null, defaults, ids(3))).toBe(defaults);
  });

  it("clamps the user's dates again, so a longer mission cannot leave one outside the data", () => {
    const defaults = defaultPicks(ids(2), "s1", land, null, grid, DAYS);
    const mine: DatesPicks = { siteA: "s1", siteB: "s2", date1: land, date2: "2031-12-31T00:00:00Z" };
    const clamp = (utc: string) => clampLanding(grid, DAYS, utc);
    expect(resolvePicks(mine, defaults, ids(2), clamp)).toEqual({ ...mine, date2: LAST });
    expect(resolvePicks(mine, defaults, ids(2), () => null)).toMatchObject({ date1: defaults?.date1, date2: defaults?.date2 });
  });
});

describe("a picked date at the data's edges, as the landing-date control limits it", () => {
  it("moves a date before the data to its first hour, and one too late to the last landing", () => {
    expect(clampLanding(grid, DAYS, "2025-06-01T00:00:00Z")).toBe(FIRST);
    expect(clampLanding(grid, DAYS, "2031-12-31T00:00:00Z")).toBe(LAST);
    expect(clampLanding(grid, DAYS, "2040-01-01T00:00:00Z")).toBe(LAST);
  });

  it("keeps a date that fits, and refuses text that is not a time", () => {
    expect(clampLanding(grid, DAYS, "2028-03-01T05:00:00Z")).toBe("2028-03-01T05:00:00Z");
    expect(clampLanding(grid, DAYS, LAST)).toBe(LAST);
    expect(clampLanding(grid, DAYS, FIRST)).toBe(FIRST);
    expect(clampLanding(grid, DAYS, "not a date")).toBeNull();
  });
});

// ── Columns built by hand, for the ranking rules ────────────────────────────────

function evaluation(status: Evaluation["status"], score: number, patch: { longestDarkH?: number; dark?: boolean } = {}): Evaluation {
  const dark = patch.longestDarkH ?? 4;
  const vetoes = {
    slope: { triggered: false, measured: 3, limit: athena.max_slope_deg },
    darkness: { triggered: patch.dark ?? false, measured: dark, limit: athena.max_dark_h },
    blackout: { triggered: false, measured: 10, limit: athena.max_blackout_h },
    landing_dark: { triggered: false, measured: true, limit: true },
    landing_sun_low: { triggered: false, measured: 1, limit: null },
    landing_sun_high: { triggered: false, measured: 1, limit: null },
  } as Evaluation["vetoes"];
  return {
    metrics: { sunFractionMean: 0.8, litFraction: 0.9, longestDarkH: dark, linkFraction: 0.9, longestBlackoutH: 10, landingSunElDeg: 1, landingLit: true },
    vetoes,
    utilities: { slope: 0.9, power: 0.8, comms: 0.7 },
    score,
    status,
    slopeNotAssessed: false,
  };
}

const base = sites[0] as Site;
const PICKS: DatesPicks = { siteA: base.id, siteB: (sites[1] as Site).id, date1: "2028-03-01T00:00:00Z", date2: "2028-03-08T00:00:00Z" };

function columns(statuses: SiteStatus[], picks: DatesPicks = PICKS): ColumnView[] {
  return datesColumnSpecs(picks).map((spec, i) => ({
    ...compareColumn(spec.siteId, sites, statuses[i] as SiteStatus, athena, spec.landingUtc),
    key: `${spec.site}${spec.date}`,
  }));
}
const ready = (e: Evaluation): SiteStatus => ({ kind: "ready", evaluation: e });

describe("the four columns", () => {
  it("are A on date 1, A on date 2, B on date 1, B on date 2", () => {
    expect(datesColumnSpecs(PICKS).map((s) => `${s.site}${s.date} ${s.siteId} ${s.landingUtc}`)).toEqual([
      `A1 ${PICKS.siteA} ${PICKS.date1}`,
      `A2 ${PICKS.siteA} ${PICKS.date2}`,
      `B1 ${PICKS.siteB} ${PICKS.date1}`,
      `B2 ${PICKS.siteB} ${PICKS.date2}`,
    ]);
  });
});

describe("the best column", () => {
  it("GO beats CAUTION, whatever the score", () => {
    const cols = columns([ready(evaluation("CAUTION", 69)), ready(evaluation("GO", 71)), ready(evaluation("NO-GO", 99)), ready(evaluation("CAUTION", 60))]);
    expect(bestColumns(cols)).toEqual([false, true, false, false]);
  });

  it("then the higher printed score; a tie on both marks every tied column", () => {
    const cols = columns([ready(evaluation("GO", 81.2)), ready(evaluation("GO", 81.9)), ready(evaluation("GO", 75)), ready(evaluation("CAUTION", 90))]);
    expect(bestColumns(cols)).toEqual([true, true, false, false]);
  });

  it("CAUTION beats NO-GO when nothing is GO", () => {
    const cols = columns([ready(evaluation("NO-GO", 95)), ready(evaluation("CAUTION", 50)), ready(evaluation("NO-GO", 10)), ready(evaluation("NO-GO", 20))]);
    expect(bestColumns(cols)).toEqual([false, true, false, false]);
  });

  it("nothing when every column is NO-GO, when all four tie, or while one is loading", () => {
    const nogo = ready(evaluation("NO-GO", 40));
    expect(bestColumns(columns([nogo, nogo, nogo, nogo]))).toEqual([false, false, false, false]);
    const go = ready(evaluation("GO", 80));
    expect(bestColumns(columns([go, go, go, go]))).toEqual([false, false, false, false]);
    expect(bestColumns(columns([go, ready(evaluation("GO", 90)), { kind: "loading" }, go]))).toEqual([false, false, false, false]);
  });

  it("ranks among the columns with a result when one failed", () => {
    const cols = columns([ready(evaluation("GO", 80)), ready(evaluation("GO", 90)), { kind: "error", message: "404" }, { kind: "error", message: "404" }]);
    expect(bestColumns(cols)).toEqual([false, true, false, false]);
  });
});

describe("the deciding row over four columns", () => {
  it("is the row where a column breaks a rule and another does not, as in the Sites table", () => {
    const cols = columns([
      ready(evaluation("NO-GO", 40, { longestDarkH: 30, dark: true })),
      ready(evaluation("GO", 90, { longestDarkH: 2 })),
      ready(evaluation("GO", 85, { longestDarkH: 3 })),
      ready(evaluation("NO-GO", 30, { longestDarkH: 50, dark: true })),
    ]);
    const rows = metricRows(cols, athena);
    expect(rows.filter((r) => r.deciding).map((r) => r.id)).toEqual(["dark"]);
    expect(rows.find((r) => r.id === "dark")?.cells.map((c) => c?.best)).toEqual([false, true, false, false]);
  });
});

describe("the summary sentence", () => {
  const plain = (s: string) => s.replace(/ /g, " ");
  it("gives each site on its two dates, and the best column", () => {
    const cols = columns([ready(evaluation("NO-GO", 40)), ready(evaluation("GO", 99)), ready(evaluation("NO-GO", 20)), ready(evaluation("NO-GO", 20))]);
    const best = bestColumns(cols);
    const a = cols[0]?.name;
    const b = cols[2]?.name;
    expect(plain(datesSummary(cols, athena, best))).toBe(
      `For IM-2 Athena, ${a} is NO-GO on 2028-03-01 00:00 UTC and GO on 2028-03-08 00:00 UTC; ${b} is NO-GO on both dates. Best: ${a} on 2028-03-08 00:00 UTC, 99 of 100.`,
    );
  });

  it("names one site once when A and B are the same", () => {
    const one = { ...PICKS, siteB: PICKS.siteA };
    const go = ready(evaluation("GO", 80));
    const cols = columns([go, ready(evaluation("GO", 90)), go, ready(evaluation("GO", 90))], one);
    const sentence = plain(datesSummary(cols, athena, bestColumns(cols)));
    expect(sentence).toBe(`For IM-2 Athena, ${cols[0]?.name} is GO on both dates. Best: ${cols[0]?.name} on 2028-03-08 00:00 UTC, 90 of 100.`);
  });

  it("says so when all four are NO-GO", () => {
    const nogo = ready(evaluation("NO-GO", 40, { longestDarkH: 30, dark: true }));
    const cols = columns([nogo, nogo, nogo, nogo]);
    expect(plain(datesSummary(cols, athena, bestColumns(cols)))).toContain("All four are NO-GO;");
  });

  it("does not say all four are NO-GO when a column has no result", () => {
    const nogo = ready(evaluation("NO-GO", 40, { longestDarkH: 30, dark: true }));
    const failed = columns([{ kind: "error", message: "could not load" }, { kind: "error", message: "could not load" }, nogo, nogo]);
    const sentence = plain(datesSummary(failed, athena, bestColumns(failed)));
    expect(sentence).not.toContain("All four");
    expect(sentence).toContain("Every column with a result is NO-GO;");
    expect(bestColumns(failed)).toEqual([false, false, false, false]);
  });

  it("one site at two dates, both NO-GO: says both dates", () => {
    const one = { ...PICKS, siteB: PICKS.siteA };
    const nogo = ready(evaluation("NO-GO", 40, { longestDarkH: 30, dark: true }));
    const cols = columns([nogo, nogo, nogo, nogo], one);
    expect(plain(datesSummary(cols, athena, bestColumns(cols)))).toContain("Both dates are NO-GO;");
  });

  it("waits while a column is loading", () => {
    const cols = columns([ready(evaluation("GO", 80)), { kind: "loading" }, ready(evaluation("GO", 80)), ready(evaluation("GO", 80))]);
    expect(plain(datesSummary(cols, athena, bestColumns(cols)))).toContain("loading on 2028-03-08 00:00 UTC");
    expect(datesSummary(cols, athena, bestColumns(cols))).not.toContain("Best");
  });
});

describe("the share link's cmp parameter", () => {
  const selected = sites.map((s) => s.id);

  it("round-trips through the scenario link, and old links are unchanged", () => {
    const catalog = { profiles, sites, grid };
    const store = createScenarioStore(catalog, `?profile=im2_athena&sites=${selected.join(",")}&land=2028-03-01T00:00Z&t=0&view=compare`);
    const state = store.getState();
    const picks: DatesPicks = { siteA: selected[1] as string, siteB: selected[3] as string, date1: "2028-03-01T05:00:00Z", date2: "2029-07-14T00:00:00Z" };
    const location = { origin: "https://truesouth.example", pathname: "/mission" };
    const link = new URL(scenarioLink(state, location, picks));
    expect(readCmp(link.searchParams.get("cmp"), state.siteIds, grid, DAYS)).toEqual(picks);
    // Without picks, or with Compare closed, the link is the old link.
    expect(scenarioLink(state, location)).not.toContain("cmp=");
    state.setView("system");
    expect(scenarioLink(store.getState(), location, picks)).not.toContain("cmp=");
    // The rest of the link still opens the same scenario.
    const reopened = createScenarioStore(catalog, link.search).getState();
    expect(reopened.notices).toEqual([]);
    expect(reopened.view).toBe("compare");
  });

  it("is written short, with dates as `land` writes them", () => {
    expect(writeCmp({ siteA: "a", siteB: "b", date1: "2028-03-01T05:00:00Z", date2: "2028-03-08T00:00:00Z" })).toBe(
      "a,b,2028-03-01T05:00Z,2028-03-08T00:00Z",
    );
  });

  it.each([
    ["nothing", null],
    ["three parts", `${sites[0]?.id},${sites[1]?.id},2028-03-01T00:00Z`],
    ["a site that is not selected", `nowhere,${sites[1]?.id},2028-03-01T00:00Z,2028-03-08T00:00Z`],
    ["a time that is not a whole hour", `${sites[0]?.id},${sites[1]?.id},2028-03-01T00:30Z,2028-03-08T00:00Z`],
    ["a date whose window ends past the data", `${sites[0]?.id},${sites[1]?.id},2028-03-01T00:00Z,2031-12-31T00:00Z`],
    ["a date before the data", `${sites[0]?.id},${sites[1]?.id},2025-12-31T00:00Z,2028-03-08T00:00Z`],
    ["not a date", `${sites[0]?.id},${sites[1]?.id},soon,2028-03-08T00:00Z`],
  ])("ignores %s", (_what, raw) => {
    expect(readCmp(raw, sites.map((s) => s.id), grid, DAYS)).toBeNull();
  });
});

describe("the dates export", () => {
  const cols = columns([ready(evaluation("NO-GO", 40)), ready(evaluation("GO", 99)), ready(evaluation("CAUTION", 55)), ready(evaluation("NO-GO", 20))]);
  const rows = metricRows(cols, athena);
  const best = bestColumns(cols);
  const scenario: ExportScenario = {
    profile: athena,
    basePresetId: "im2_athena",
    changedFields: [],
    siteIds: sites.map((s) => s.id),
    focusedSiteId: PICKS.siteA,
    landingUtc: "2028-02-01T00:00:00Z",
    currentUtc: "2028-02-01T00:00:00Z",
    view: "compare",
    grid,
    link: "https://truesouth.example/mission?cmp=x",
  };
  const made = new Date("2026-11-14T10:00:00Z");

  it("CSV: one row per site and date, landing_utc after the site, both dates in the header", () => {
    const parsed = parseCsv(datesCsv(cols, rows, best, scenario, PICKS, made));
    expect(parsed.header).toEqual([...DATES_CSV_HEADER]);
    expect(parsed.header[2]).toBe("landing_utc");
    expect(parsed.rows.map((r) => `${r[0]} ${r[2]} ${r[5 + 1]}`)).toEqual([
      `${PICKS.siteA} ${PICKS.date1} NO-GO`,
      `${PICKS.siteA} ${PICKS.date2} GO`,
      `${PICKS.siteB} ${PICKS.date1} CAUTION`,
      `${PICKS.siteB} ${PICKS.date2} NO-GO`,
    ]);
    const bestIn = parsed.header.indexOf("best_in");
    expect(parsed.rows.map((r) => (r[bestIn] ?? "").split(" ").includes("column"))).toEqual([false, true, false, false]);
    expect(parsed.comments).toContain(
      `Landing dates: date 1 ${PICKS.date1}, date 2 ${PICKS.date2} (the scenario's landing date is ${scenario.landingUtc})`,
    );
    expect(parsed.comments.some((c) => c.startsWith("Mission window, date 1: 2028-03-01T00:00:00Z to "))).toBe(true);
    expect(parsed.comments.some((c) => c.startsWith("Mission window, date 2: 2028-03-08T00:00:00Z to "))).toBe(true);
    expect(parsed.comments.filter((c) => c.startsWith("  ")).every((c) => /; (sourced: |assumed: )/.test(c))).toBe(true);
  });

  it("JSON: the picks, each result's landing date and window, and the best column, at full precision", () => {
    const doc = JSON.parse(scenarioJson(cols, scenario, made, { picks: PICKS, best }));
    expect(doc.compare).toMatchObject({ mode: "sites_and_dates", site_a: PICKS.siteA, site_b: PICKS.siteB, date_1_utc: PICKS.date1, date_2_utc: PICKS.date2 });
    expect(doc.results.map((r: { landing_utc: string; best_column: boolean }) => [r.landing_utc, r.best_column])).toEqual([
      [PICKS.date1, false],
      [PICKS.date2, true],
      [PICKS.date1, false],
      [PICKS.date2, false],
    ]);
    expect(doc.results[1].score_of_100).toBe(99);
    expect(doc.results[0].mission_window.start_utc).toBe(PICKS.date1);
  });

  it("names the files by profile and both dates", () => {
    expect(datesFileName(scenario, PICKS, "csv")).toBe("truesouth_compare_dates_im2_athena_2028-03-01_2028-03-08.csv");
    expect(datesFileName(scenario, PICKS, "json")).toBe("truesouth_compare_dates_im2_athena_2028-03-01_2028-03-08.json");
  });
});
