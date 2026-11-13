/**
 * "A copied link, opened in a private window, shows the same scenario"
 * (docs/features/share-export.md): the link Share copies restores every part of the
 * scenario, including a custom profile, the view and the Compare window being open.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../../../contracts/generated";
import { createScenarioStore, type ScenarioCatalog, type ScenarioState } from "../../../state/scenario";
import { coordinatesText, moonTrekLink, quickmapLink, signedLongitude } from "./nasa-links";
import { scenarioLink } from "./share-link";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const json = <T,>(file: string) => JSON.parse(readFileSync(path.join(fixtures, file), "utf8")) as T;
const catalog: ScenarioCatalog = {
  profiles: json<MissionProfile[]>("profiles.json"),
  sites: json<ScenarioCatalog["sites"]>("sites.json"),
  grid: json<Manifest>("manifest.json").time_grid,
};
const location = { origin: "https://truesouth.example", pathname: "/mission" };

function scenarioOf(state: ScenarioState) {
  return {
    profile: state.profile,
    basePresetId: state.basePresetId,
    changedFields: [...state.changedFields].sort(),
    siteIds: state.siteIds,
    focusedSiteId: state.focusedSiteId,
    landingUtc: state.landingUtc,
    currentUtc: state.currentUtc,
    view: state.view,
  };
}

function reopen(link: string): ScenarioState {
  const url = new URL(link);
  expect(`${url.origin}${url.pathname}`).toBe("https://truesouth.example/mission");
  return createScenarioStore(catalog, url.search).getState();
}

describe("the shared link", () => {
  it("round-trips a custom profile, the sites, the focus, both times and the open Compare window", () => {
    const store = createScenarioStore(catalog, "");
    const s = store.getState();
    s.choosePreset("viper");
    s.editProfileField("max_dark_h", 9);
    s.editProfileField("antenna_mask_deg", 2.5);
    s.editProfileField("weights", { slope: 0.2, power: 0.5, comms: 0.3 });
    s.editProfileField("landing_sun_el_min_deg", null);
    store.getState().removeSite(store.getState().siteIds[0] as string);
    store.getState().addSite("fixture_sphere");
    store.getState().focusSite("fixture_sphere");
    store.getState().slipLanding(14);
    store.getState().stepCurrentTime(37);
    store.getState().setView("compare");

    const before = store.getState();
    expect(before.changedFields.length).toBeGreaterThan(0);
    expect(before.view).toBe("compare");
    const link = scenarioLink(before, location);
    const after = reopen(link);
    expect(after.notices).toEqual([]);
    expect(scenarioOf(after)).toEqual(scenarioOf(before));
  });

  it("round-trips every view", () => {
    for (const view of ["slip", "system", "map", "terrain", "panorama", "compare"] as const) {
      const store = createScenarioStore(catalog, "");
      store.getState().setView(view);
      expect(reopen(scenarioLink(store.getState(), location)).view).toBe(view);
    }
  });

  it("is built from the store, so it is never behind the address bar", () => {
    const store = createScenarioStore(catalog, "");
    store.getState().stepCurrentTime(5);
    expect(new URL(scenarioLink(store.getState(), location)).searchParams.get("t")).toBe(
      String(Math.round((Date.parse(store.getState().currentUtc) - Date.parse(store.getState().landingUtc)) / 3600000)),
    );
  });
});

describe("links to NASA's maps", () => {
  it("wraps east longitude to −180..180", () => {
    expect(signedLongitude(222.619)).toBeCloseTo(-137.381, 6);
    expect(signedLongitude(23.473)).toBeCloseTo(23.473, 6);
    expect(signedLongitude(180)).toBe(180);
    expect(signedLongitude(0)).toBe(0);
  });

  it("open in a new tab only at a confirmed address, else the front page with the coordinates", () => {
    for (const link of [quickmapLink(-89.456, 222.619), moonTrekLink(-89.456, 222.619)]) {
      const url = new URL(link.href);
      expect(url.protocol).toBe("https:");
      if (!link.centred) expect(url.pathname === "/" || url.pathname === "/moon/").toBe(true);
    }
    expect(coordinatesText(-89.456, 222.619)).toBe("−89.4560°, 222.6190° E");
  });
});
