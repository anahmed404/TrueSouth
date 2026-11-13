import { describe, expect, it } from "vitest";
import { SERIES_COLUMNS } from "../data/decode/layouts.ts";
import type { FetchLike } from "../data/load.ts";
import { createDataStore, metaKey, seriesKey, terrainKey } from "./data.ts";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const manifest = {
  schema_version: 1,
  generated_utc: "2026-01-01T00:00:00Z",
  moon_radius_m: 1737400,
  observer_height_m: 2,
  skyline_bins: 1440,
  time_grid: { start_utc: "2026-01-01T00:00:00Z", step_s: 3600, count: 2 },
};

function siteMeta(siteId: string, terrain: { size: number; window_km: number } | null) {
  return {
    site_id: siteId,
    sun_radius_deg: 0.266,
    earth_radius_deg: 0.95,
    series: {
      columns: SERIES_COLUMNS.map((column) => ({
        name: column.name,
        scale: column.scale,
        offset: column.offset,
      })),
    },
    skyline: { bins: 1, missing_samples: 0, max_range_km: 300 },
    terrain,
    closeup: null,
  };
}

describe("data store", () => {
  it("fetches each file once however many callers ask", async () => {
    const counts = new Map<string, number>();
    const fetchImpl: FetchLike = async (url) => {
      counts.set(url, (counts.get(url) ?? 0) + 1);
      if (url === "/data/manifest.json") return jsonResponse(manifest);
      if (url === "/data/sites/fixture_ridge/meta.json") return jsonResponse(siteMeta("fixture_ridge", null));
      if (url === "/data/sites/fixture_ridge/series.bin") {
        return new Response(new Uint8Array(SERIES_COLUMNS.length * manifest.time_grid.count * 2));
      }
      return new Response("missing", { status: 404 });
    };
    const store = createDataStore(fetchImpl);
    await Promise.all([
      store.getState().ensure(seriesKey("fixture_ridge")),
      store.getState().ensure(seriesKey("fixture_ridge")),
      store.getState().ensure(seriesKey("fixture_ridge")),
    ]);
    expect(counts.get("/data/manifest.json")).toBe(1);
    expect(counts.get("/data/sites/fixture_ridge/meta.json")).toBe(1);
    expect(counts.get("/data/sites/fixture_ridge/series.bin")).toBe(1);
    expect(store.getState().entries[seriesKey("fixture_ridge")]?.status).toBe("ready");

    await store.getState().ensure("manifest");
    expect(counts.get("/data/manifest.json")).toBe(1);
  });

  it("keeps a required-file 404 as an error and does not fetch it again", async () => {
    const counts = new Map<string, number>();
    const fetchImpl: FetchLike = async (url) => {
      counts.set(url, (counts.get(url) ?? 0) + 1);
      return new Response("missing", { status: 404 });
    };
    const store = createDataStore(fetchImpl);
    await expect(store.getState().ensure("manifest")).rejects.toThrow(/manifest\.json/);
    await expect(store.getState().ensure("manifest")).rejects.toThrow(/manifest\.json/);
    expect(counts.get("/data/manifest.json")).toBe(1);
    expect(store.getState().entries.manifest?.status).toBe("error");
    expect(store.getState().entries.manifest?.error).toMatch(/manifest\.json/);
  });

  it("treats a missing terrain file as ready and not available", async () => {
    const fetchImpl: FetchLike = async (url) => {
      if (url.endsWith("/meta.json")) return jsonResponse(siteMeta("fixture_sphere", null));
      return new Response("missing", { status: 404 });
    };
    const store = createDataStore(fetchImpl);
    await store.getState().ensure(terrainKey("fixture_sphere"));
    const entry = store.getState().entries[terrainKey("fixture_sphere")];
    expect(entry?.status).toBe("ready");
    expect(entry?.data).toBeNull();
    expect(entry?.error).toBeNull();
  });

  it("loads a custom site from /api/custom", async () => {
    const urls: string[] = [];
    const store = createDataStore(async (url) => {
      urls.push(url);
      return new Response("missing", { status: 404 });
    });
    await expect(store.getState().ensure(metaKey("c_-89.2000_130.5000"))).rejects.toThrow(/meta\.json/);
    expect(urls).toEqual(["/api/custom/c_-89.2000_130.5000/meta.json"]);
  });

  it("drops a site's large arrays so the next request fetches again", async () => {
    let seriesFetches = 0;
    const fetchImpl: FetchLike = async (url) => {
      if (url === "/data/manifest.json") return jsonResponse(manifest);
      if (url.endsWith("/meta.json")) return jsonResponse(siteMeta("fixture_ridge", null));
      if (url.endsWith("/series.bin")) {
        seriesFetches += 1;
        return new Response(new Uint8Array(SERIES_COLUMNS.length * manifest.time_grid.count * 2));
      }
      return new Response("missing", { status: 404 });
    };
    const store = createDataStore(fetchImpl);
    const key = seriesKey("fixture_ridge");
    await store.getState().ensure(key);
    expect(seriesFetches).toBe(1);
    store.getState().dropSite("fixture_ridge");
    expect(store.getState().entries[key]).toBeUndefined();
    await store.getState().ensure(key);
    expect(seriesFetches).toBe(2);
    expect(store.getState().entries[key]?.status).toBe("ready");
  });
});
