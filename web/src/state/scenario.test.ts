import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../contracts/generated.ts";
import { windowLength } from "../lib/scoring/scoring.ts";
import { hourIndexToUtc, utcToHourIndex } from "../lib/time/index.ts";
import {
  CHANGED_BY_YOU,
  DEFAULT_LANDING_UTC,
  DEFAULT_SITE_IDS,
  bindScenarioUrl,
  createScenarioStore,
  lastLandingHour,
  readScenarioQuery,
  selectScenario,
  writeScenarioQuery,
  type ScenarioCatalog,
  type ScenarioHistory,
} from "./scenario.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function loadCatalog(): ScenarioCatalog {
  const fixtures = path.join(repoRoot, "data", "fixtures");
  const manifest = JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest;
  const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
  const sites = JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as { id: string }[];
  return { profiles, sites, grid: manifest.time_grid };
}

const catalog = loadCatalog();
const EXAMPLE =
  "/mission?profile=im2_athena&sites=connecting_ridge,mons_mouton&land=2028-03-14T00:00Z&t=36&view=panorama";

function memoryHistory(initial = ""): ScenarioHistory & {
  index: number;
  back: () => void;
} {
  const stack = [bare(initial)];
  let index = 0;
  const listeners = new Set<(search: string) => void>();
  return {
    get index() {
      return index;
    },
    search: () => (stack[index] ? `?${stack[index]}` : ""),
    replace: (query) => {
      stack[index] = bare(query);
    },
    push: (query) => {
      stack.splice(index + 1);
      stack.push(bare(query));
      index += 1;
    },
    listen: (onPop) => {
      listeners.add(onPop);
      return () => listeners.delete(onPop);
    },
    back: () => {
      if (index === 0) return;
      index -= 1;
      const search = stack[index] ? `?${stack[index]}` : "";
      for (const listener of listeners) listener(search);
    },
  };
}

function bare(search: string): string {
  const query = search.indexOf("?");
  if (query >= 0) return search.slice(query + 1);
  return search.includes("=") ? search : "";
}

function customId(index: number): string {
  return `c_${(-80 - index).toFixed(4)}_10.0000`;
}

describe("scenario store", () => {
  it("fills a first visit from the loaded sites when the named defaults are missing", () => {
    const store = createScenarioStore(catalog);
    const state = store.getState();

    expect(state.profile.id).toBe("im2_athena");
    expect(state.profile.name).toBe("IM-2 Athena");
    expect(state.changedFields).toEqual([]);
    expect(state.siteIds).toEqual(["fixture_ridge", "fixture_crater", "fixture_edge", "fixture_wide"]);
    expect(state.focusedSiteId).toBe("fixture_ridge");
    expect(state.landingUtc).toBe(DEFAULT_LANDING_UTC);
    expect(state.currentUtc).toBe(DEFAULT_LANDING_UTC);
    expect(state.view).toBe("slip");
    expect(state.notices).toEqual([]);
    expect(DEFAULT_SITE_IDS.every((id) => !catalog.sites.some((site) => site.id === id))).toBe(true);
  });

  it("uses the four named polar sites when sites.json lists them", () => {
    const named: ScenarioCatalog = {
      ...catalog,
      sites: [...DEFAULT_SITE_IDS, "apollo11"].map((id) => ({ id })),
    };
    const store = createScenarioStore(named);
    expect(store.getState().siteIds).toEqual([...DEFAULT_SITE_IDS]);
    expect(store.getState().focusedSiteId).toBe(DEFAULT_SITE_IDS[0]);
  });

  it("keeps the scenario object while the view changes, and replaces it when the scenario changes", () => {
    const store = createScenarioStore(catalog);
    const first = selectScenario(store.getState());
    expect(selectScenario(store.getState())).toBe(first);

    store.getState().setView("panorama");
    expect(store.getState().view).toBe("panorama");
    expect(selectScenario(store.getState())).toBe(first);

    store.getState().focusSite("fixture_crater");
    expect(selectScenario(store.getState())).not.toBe(first);
    expect(selectScenario(store.getState()).focusedSiteId).toBe("fixture_crater");
  });

  it("edits a field into Custom, resets one mark, and clears every mark with a preset", () => {
    const store = createScenarioStore(catalog);
    const sourced = store.getState().profile.provenance.duration_days;
    expect(sourced.kind).toBe("sourced");

    store.getState().editProfileField("duration_days", 12);
    store.getState().editProfileField("max_dark_h", 9);
    expect(store.getState().profile.id).toBe("custom");
    expect(store.getState().profile.name).toBe("Custom");
    expect(store.getState().profile.based_on).toBe("Intuitive Machines IM-2 Athena");
    expect(store.getState().changedFields).toEqual(["duration_days", "max_dark_h"]);
    expect(store.getState().profile.duration_days).toBe(12);
    expect(store.getState().profile.provenance.duration_days).toEqual({
      kind: "assumed",
      reason: CHANGED_BY_YOU,
    });
    expect(store.getState().profile.provenance.max_slope_deg.kind).toBe("assumed");
    expect(store.getState().basePresetId).toBe("im2_athena");

    store.getState().resetProfileField("duration_days");
    expect(store.getState().profile.id).toBe("custom");
    expect(store.getState().changedFields).toEqual(["max_dark_h"]);
    expect(store.getState().profile.duration_days).toBe(10);
    expect(store.getState().profile.provenance.duration_days).toEqual(sourced);

    store.getState().editProfileField("max_dark_h", 6);
    expect(store.getState().profile.id).toBe("im2_athena");
    expect(store.getState().changedFields).toEqual([]);

    store.getState().editProfileField("weights", { slope: 1, power: 1, comms: 1 });
    store.getState().editProfileField("max_dark_h", 4);
    store.getState().choosePreset("viper");
    expect(store.getState().profile.id).toBe("viper");
    expect(store.getState().profile.duration_days).toBe(100);
    expect(store.getState().changedFields).toEqual([]);
    expect(store.getState().basePresetId).toBe("viper");
  });

  it("ignores an edit that would make the profile invalid", () => {
    const store = createScenarioStore(catalog);
    const before = selectScenario(store.getState());
    store.getState().editProfileField("min_sun_fraction", 2);
    store.getState().editProfileField("duration_days", 0);
    store.getState().editProfileField("slope_ideal_deg", 10);
    store.getState().editProfileField("weights", { slope: 0, power: 0, comms: 0 });
    expect(selectScenario(store.getState())).toBe(before);
    expect(catalog.profiles.find((item) => item.id === "im2_athena")?.duration_days).toBe(10);
  });

  it("holds at most 8 sites, refuses duplicates, and focuses a neighbour when the focused site goes", () => {
    const store = createScenarioStore(catalog);
    const [ridge, crater, edge, wide] = store.getState().siteIds;
    if (!ridge || !crater || !edge || !wide) throw new Error("expected four default sites");

    store.getState().addSite(ridge);
    expect(store.getState().siteIds).toEqual([ridge, crater, edge, wide]);

    store.getState().addSite("not_a_site");
    expect(store.getState().siteIds).toHaveLength(4);

    for (let index = 0; index < 4; index += 1) store.getState().addSite(customId(index));
    expect(store.getState().siteIds).toHaveLength(8);
    const full = selectScenario(store.getState());
    store.getState().addSite(customId(4));
    expect(selectScenario(store.getState())).toBe(full);

    store.getState().focusSite(crater);
    store.getState().removeSite(crater);
    expect(store.getState().focusedSiteId).toBe(edge);
    expect(store.getState().siteIds).not.toContain(crater);

    store.getState().focusSite(store.getState().siteIds.at(-1) ?? "");
    const last = store.getState().focusedSiteId;
    const beforeLast = store.getState().siteIds.at(-2);
    store.getState().removeSite(last ?? "");
    expect(store.getState().focusedSiteId).toBe(beforeLast);

    const beforeReorder = [...store.getState().siteIds];
    store.getState().reorderSites([wide, ridge, edge]);
    expect(store.getState().siteIds).toEqual(beforeReorder);

    const remaining = store.getState().siteIds;
    store.getState().reorderSites([...remaining].reverse());
    expect(store.getState().siteIds).toEqual([...remaining].reverse());

    while (store.getState().siteIds.length > 0) {
      store.getState().removeSite(store.getState().siteIds[0] ?? "");
    }
    expect(store.getState().focusedSiteId).toBeNull();
    expect(selectScenario(store.getState()).siteIds).toEqual([]);
  });

  it("clamps landing to the last hour whose window fits, for 100 days and for 6.5 days", () => {
    const store = createScenarioStore(catalog);
    const grid = catalog.grid;
    const end = "2031-12-31T23:00:00Z";

    store.getState().choosePreset("artemis_crewed");
    store.getState().setLandingDate(end);
    expect(store.getState().landingUtc).toBe(hourIndexToUtc(grid, lastLandingHour(grid, 6.5)));
    expect(windowLength(6.5)).toBe(156);
    expect(lastLandingHour(grid, 6.5)).toBe(grid.count - 156);

    store.getState().choosePreset("viper");
    store.getState().setLandingDate(end);
    expect(store.getState().landingUtc).toBe(hourIndexToUtc(grid, lastLandingHour(grid, 100)));
    expect(windowLength(100)).toBe(2400);
    expect(lastLandingHour(grid, 100)).toBe(grid.count - 2400);

    store.getState().slipLanding(10_000);
    expect(store.getState().landingUtc).toBe(hourIndexToUtc(grid, grid.count - 2400));
    store.getState().slipLanding(-10_000);
    expect(store.getState().landingUtc).toBe(hourIndexToUtc(grid, 0));
  });

  it("keeps the current time inside the timeline the scrubber shows", () => {
    const store = createScenarioStore(catalog);
    const grid = catalog.grid;
    const landingHour = utcToHourIndex(grid, store.getState().landingUtc);
    const lastShown = Math.min(grid.count - 1, landingHour + windowLength(10) - 1 + 72);

    store.getState().stepCurrentTime(100_000);
    expect(store.getState().currentUtc).toBe(hourIndexToUtc(grid, lastShown));
    store.getState().stepCurrentTime(-100_000);
    expect(store.getState().currentUtc).toBe(hourIndexToUtc(grid, Math.max(0, landingHour - 72)));

    const before = selectScenario(store.getState());
    store.getState().setCurrentTime("2028-03-01T00:30:00Z");
    store.getState().setLandingDate("1999-01-01T00:00:00Z");
    expect(selectScenario(store.getState())).toBe(before);

    store.getState().stepCurrentTime(24);
    expect(store.getState().currentUtc).toBe(hourIndexToUtc(grid, Math.max(0, landingHour - 72) + 24));
  });
});

describe("shareable scenario link", () => {
  it("round-trips a preset scenario", () => {
    const store = createScenarioStore(catalog);
    store.getState().setView("compare");
    store.getState().stepCurrentTime(36);
    store.getState().focusSite("fixture_crater");
    const query = writeScenarioQuery(store.getState());
    const read = readScenarioQuery(query, catalog);

    expect(read.notices).toEqual([]);
    expect(read.profile.id).toBe("im2_athena");
    expect(read.changedFields).toEqual([]);
    expect(read.siteIds).toEqual(store.getState().siteIds);
    expect(read.landingUtc).toBe(store.getState().landingUtc);
    expect(read.currentUtc).toBe(store.getState().currentUtc);
    expect(read.view).toBe("compare");
    expect(read.focusedSiteId).toBe(read.siteIds[0]);
    expect(query).toContain("t=36");
    expect(query).toContain("view=compare");
  });

  it("round-trips a custom profile and a custom site id", () => {
    const store = createScenarioStore(catalog);
    store.getState().editProfileField("duration_days", 12);
    store.getState().editProfileField("max_dark_h", 8);
    store.getState().editProfileField("weights", { slope: 0.5, power: 0.3, comms: 0.2 });
    store.getState().addSite("c_-89.2000_130.5000");
    const query = writeScenarioQuery(store.getState());
    const read = readScenarioQuery(query, catalog);

    expect(read.notices).toEqual([]);
    expect(read.profile.id).toBe("custom");
    expect(read.basePresetId).toBe("im2_athena");
    expect(read.changedFields).toEqual(["duration_days", "max_dark_h", "weights"]);
    expect(read.profile.duration_days).toBe(12);
    expect(read.profile.max_dark_h).toBe(8);
    expect(read.profile.weights).toEqual({ slope: 0.5, power: 0.3, comms: 0.2 });
    expect(read.profile.provenance.duration_days).toEqual({ kind: "assumed", reason: CHANGED_BY_YOU });
    expect(read.profile.provenance.max_slope_deg).toEqual(
      catalog.profiles.find((item) => item.id === "im2_athena")?.provenance.max_slope_deg,
    );
    expect(read.siteIds).toContain("c_-89.2000_130.5000");
    expect(decodeURIComponent(query)).toContain(
      "custom:im2_athena;duration_days=12;max_dark_h=8;weights=0.5:0.3:0.2",
    );
  });

  it("parses the example link in docs/data-contracts.md", () => {
    const catalogSites = JSON.parse(
      readFileSync(path.join(repoRoot, "data", "catalog", "sites.json"), "utf8"),
    ) as { id: string }[];
    const withRidge: ScenarioCatalog = { ...catalog, sites: catalogSites };
    const read = readScenarioQuery(EXAMPLE, withRidge);

    expect(read.profile.id).toBe("im2_athena");
    expect(read.siteIds).toEqual(["connecting_ridge"]);
    expect(read.focusedSiteId).toBe("connecting_ridge");
    expect(read.landingUtc).toBe("2028-03-14T00:00:00Z");
    expect(read.currentUtc).toBe("2028-03-15T12:00:00Z");
    expect(read.view).toBe("panorama");
    expect(read.notices).toEqual(['Ignored unknown site "mons_mouton".']);
  });

  it("ignores each bad parameter and loads the rest", () => {
    const sites = ["fixture_ridge", "fixture_crater", "fixture_edge", "fixture_wide", ...Array.from({ length: 5 }, (_, index) => customId(index))];
    const ninth = sites[8];
    const unknown = readScenarioQuery("?profile=im2_athena&sites=fixture_ridge,not_a_site,fixture_crater&view=map", catalog);
    expect(unknown.siteIds).toEqual(["fixture_ridge", "fixture_crater"]);
    expect(unknown.view).toBe("map");
    expect(unknown.profile.id).toBe("im2_athena");
    expect(unknown.notices).toEqual(['Ignored unknown site "not_a_site".']);

    const tooMany = readScenarioQuery(`?sites=${sites.join(",")}`, catalog);
    expect(tooMany.siteIds).toEqual(sites.slice(0, 8));
    expect(tooMany.notices).toEqual([`Ignored site "${ninth}" because a scenario holds at most 8 sites.`]);

    const offGrid = readScenarioQuery("?sites=fixture_ridge&land=1999-01-01T00:00Z&view=panorama", catalog);
    expect(offGrid.siteIds).toEqual(["fixture_ridge"]);
    expect(offGrid.view).toBe("panorama");
    expect(offGrid.landingUtc).toBe(DEFAULT_LANDING_UTC);
    expect(offGrid.notices).toEqual(['Ignored the landing date "1999-01-01T00:00Z" because it is outside the time grid.']);

    const badView = readScenarioQuery("?sites=fixture_ridge&land=2028-03-14T00:00Z&view=nope", catalog);
    expect(badView.view).toBe("slip");
    expect(badView.landingUtc).toBe("2028-03-14T00:00:00Z");
    expect(badView.siteIds).toEqual(["fixture_ridge"]);
    expect(badView.notices).toEqual(['Ignored unknown view "nope".']);

    const malformed = readScenarioQuery(
      "?profile=custom:im2_athena;duration_days&sites=fixture_edge&land=2028-06-01T00:00Z&view=terrain",
      catalog,
    );
    expect(malformed.profile.id).toBe("im2_athena");
    expect(malformed.profile.duration_days).toBe(10);
    expect(malformed.siteIds).toEqual(["fixture_edge"]);
    expect(malformed.landingUtc).toBe("2028-06-01T00:00:00Z");
    expect(malformed.view).toBe("terrain");
    expect(malformed.notices).toEqual(["Ignored the custom profile because it could not be read."]);

    const partial = readScenarioQuery(
      "?profile=custom:im2_athena;nope=1;min_sun_fraction=2;max_dark_h=4",
      catalog,
    );
    expect(partial.profile.id).toBe("custom");
    expect(partial.profile.max_dark_h).toBe(4);
    expect(partial.profile.min_sun_fraction).toBe(0.5);
    expect(partial.notices).toEqual([
      'Ignored unknown profile field "nope".',
      'Ignored min_sun_fraction because "2" is out of range.',
    ]);
  });

  it("replaces the address bar while a value is dragged and pushes on a discrete change", () => {
    const store = createScenarioStore(catalog);
    const history = memoryHistory();
    const stop = bindScenarioUrl(store, history);
    expect(history.index).toBe(0);
    expect(history.search().length).toBeGreaterThan(1);

    const grid = catalog.grid;
    const landingHour = utcToHourIndex(grid, store.getState().landingUtc);
    store.getState().setCurrentTime(hourIndexToUtc(grid, landingHour + 3), "replace");
    expect(history.index).toBe(0);
    expect(history.search()).toContain("t=3");

    store.getState().setView("map");
    expect(history.index).toBe(1);
    expect(store.getState().view).toBe("map");

    history.back();
    expect(store.getState().view).toBe("slip");
    expect(store.getState().currentUtc).toBe(hourIndexToUtc(grid, landingHour + 3));

    const before = history.index;
    store.getState().slipLanding(1);
    expect(history.index).toBe(before + 1);
    stop();
  });
});
