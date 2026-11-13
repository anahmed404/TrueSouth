import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { SERIES_COLUMNS } from "./decode/layouts.ts";
import {
  loadCloseup,
  loadManifest,
  loadSeries,
  loadSites,
  loadTerrain,
  loadValidation,
  type FetchLike,
} from "./load.ts";
import { parseManifest } from "./parse.ts";
import { isCustomSiteId } from "./paths.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("manifest schema version", () => {
  const manifest = JSON.parse(
    readFileSync(path.join(repoRoot, "data", "fixtures", "manifest.json"), "utf8"),
  ) as { schema_version: number };

  it("refuses an unknown schema_version", () => {
    expect(() => parseManifest({ ...manifest, schema_version: 2 })).toThrow(/schema_version 2/);
    expect(() => parseManifest({ ...manifest, schema_version: 2 })).toThrow(/schema_version 1/);
  });

  it("refuses an unknown schema_version from the loader", async () => {
    const fetchImpl: FetchLike = async (url) => {
      expect(url).toBe("/data/manifest.json");
      return jsonResponse({ ...manifest, schema_version: 99 });
    };
    await expect(loadManifest(fetchImpl)).rejects.toThrow(/schema_version 99/);
  });
});

describe("loaders", () => {
  it("treats a custom site id as /api/custom and a catalog id as /data/sites", async () => {
    const urls: string[] = [];
    const fetchImpl: FetchLike = async (url) => {
      urls.push(url);
      return new Response("missing", { status: 404 });
    };
    const columns = SERIES_COLUMNS.map((column) => ({ ...column }));
    await expect(loadSeries("c_-89.2000_130.5000", 1, columns, fetchImpl)).rejects.toThrow(/series\.bin/);
    await expect(loadSeries("fixture_ridge", 1, columns, fetchImpl)).rejects.toThrow(/series\.bin/);
    expect(urls).toEqual([
      "/api/custom/c_-89.2000_130.5000/series.bin",
      "/data/sites/fixture_ridge/series.bin",
    ]);
  });

  it("returns not available for a missing optional file and errors for a required one", async () => {
    const fetchImpl: FetchLike = async () => new Response("missing", { status: 404 });
    await expect(loadTerrain("fixture_sphere", 33, fetchImpl)).resolves.toBeNull();
    await expect(loadCloseup("fixture_sphere", null, fetchImpl)).resolves.toBeNull();
    await expect(loadValidation(fetchImpl)).resolves.toBeNull();
    await expect(loadSites(fetchImpl)).rejects.toThrow(/sites\.json is missing/);
    await expect(loadManifest(fetchImpl)).rejects.toThrow(/manifest\.json is missing/);
  });

  it("reports an HTTP error that is not a 404", async () => {
    const fetchImpl: FetchLike = async () => new Response("bad", { status: 500 });
    await expect(loadManifest(fetchImpl)).rejects.toThrow(/manifest\.json returned HTTP 500/);
  });

  it("recognises custom site ids with four decimal places", () => {
    expect(isCustomSiteId("c_-89.2000_130.5000")).toBe(true);
    expect(isCustomSiteId("c_89.2000_130.5000")).toBe(true);
    expect(isCustomSiteId("fixture_ridge")).toBe(false);
    expect(isCustomSiteId("c_-89.200_130.5000")).toBe(false);
    expect(isCustomSiteId("c_-89.2000_-1.0000")).toBe(false);
  });
});
