import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Manifest, MissionProfile } from "../../contracts/generated";
import type { CustomFetch } from "../../data/custom-sites";
import { polarMapLayer } from "../../features/polar-map/layer";
import { requestSiteAt } from "../../features/polar-map/map";
import { createCustomSitesStore } from "../../state/custom-sites";
import { MAX_SITES, createScenarioStore, type ScenarioCatalog } from "../../state/scenario";
import { FULL_TEXT, mapRequest, requestFromMap } from "./custom-site-actions";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../data/fixtures");

function catalog(): ScenarioCatalog {
  const manifest = JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest;
  const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
  const sites = JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as { id: string }[];
  return { profiles, sites, grid: manifest.time_grid };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function server() {
  const posts: { lat_deg: number; lon_deg: number }[] = [];
  const fetchImpl: CustomFetch = async (url, init) => {
    if (init?.method === "POST") {
      const body = JSON.parse(String(init.body)) as { lat_deg: number; lon_deg: number };
      posts.push(body);
      return json(200, { site_id: `c_${body.lat_deg.toFixed(4)}_${body.lon_deg.toFixed(4)}`, status: "queued", position_in_queue: 1 });
    }
    return json(200, { site_id: decodeURIComponent(url.split("/").pop() ?? ""), status: "queued", site: null, error: null });
  };
  return { posts, fetchImpl };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("the Polar map's Compute this site", () => {
  it("passes the clicked point through, east-positive, with one POST per press", async () => {
    const s = server();
    const custom = createCustomSitesStore({ fetchImpl: s.fetchImpl });
    const scenario = createScenarioStore(catalog(), "?sites=fixture_ridge");
    const onRequestSite = (lat: number, lon: number) => requestFromMap(scenario, lat, lon, custom);
    const layer = polarMapLayer({ onRequestSite });
    expect(layer.onRequestSite).toBe(onRequestSite);
    // The map folds the longitude into 0 to 360 before calling.
    requestSiteAt({ latDeg: -88.5, lonDeg: -315 }, layer.onRequestSite);
    await vi.advanceTimersByTimeAsync(10);
    expect(s.posts).toEqual([{ lat_deg: -88.5, lon_deg: 45 }]);
    expect(scenario.getState().siteIds).toContain("c_-88.5000_45.0000");
    // A second press on another point: one more POST, a second row.
    requestSiteAt({ latDeg: -87, lonDeg: 120 }, layer.onRequestSite);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(s.posts).toHaveLength(2);
    custom.getState().suspend();
  });

  it("shows a point the form would refuse as a failed row, with no POST", async () => {
    const s = server();
    const custom = createCustomSitesStore({ fetchImpl: s.fetchImpl });
    const scenario = createScenarioStore(catalog(), "?sites=fixture_ridge");
    requestFromMap(scenario, -89.9995, 10, custom);
    await vi.advanceTimersByTimeAsync(10);
    const rows = Object.values(custom.getState().entries);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ phase: "failed", problem: { kind: "refused", message: "Latitude must be at least 0.001° away from a pole." } });
    expect(s.posts).toEqual([]);
  });

  it("refuses a press when the scenario is full", async () => {
    const s = server();
    const custom = createCustomSitesStore({ fetchImpl: s.fetchImpl });
    const ids = Array.from({ length: MAX_SITES }, (_, i) => `c_${(-80 - i).toFixed(4)}_10.0000`);
    const scenario = createScenarioStore(catalog(), `?sites=${ids.join(",")}`);
    expect(scenario.getState().siteIds).toHaveLength(MAX_SITES);
    requestFromMap(scenario, -88.5, 45, custom);
    await vi.advanceTimersByTimeAsync(10);
    expect(Object.values(custom.getState().entries)[0]).toMatchObject({ phase: "failed", problem: { message: FULL_TEXT } });
    expect(s.posts).toEqual([]);
  });

  it("gives the map no callback, so no button, unless the server computes custom sites", () => {
    const request = () => undefined;
    expect(mapRequest("available", request)).toBe(request);
    for (const state of ["unknown", "checking", "not_available", "offline"] as const) {
      expect(mapRequest(state, request)).toBeUndefined();
      expect(polarMapLayer({ onRequestSite: mapRequest(state, request) }).onRequestSite).toBeUndefined();
    }
  });
});
