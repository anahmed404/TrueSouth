/**
 * Test helper: a site's real stored data from `data/derived/`, decoded as the app decodes it.
 * Imported by tests only.
 */
import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { TimeGrid } from "../../../contracts/generated.ts";
import { decodeSeries, decodeSkyline, decodeSystem, type DecodedSeries, type DecodedSkyline, type DecodedSystem, type SeriesColumnSpec } from "../../../data/decode/index.ts";
import { parseManifest, parseSiteMeta } from "../../../data/parse.ts";
import type { WorkedExamples } from "../placeholders";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const derived = `${repoRoot}data/derived/`;

function bytes(path: string): ArrayBuffer {
  const buffer = readFileSync(`${derived}${path}`);
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
}

function json(path: string): unknown {
  return JSON.parse(readFileSync(`${derived}${path}`, "utf8"));
}

export const realGrid: TimeGrid = parseManifest(json("manifest.json")).time_grid;

export const realExamples = json("academy/worked_examples.json") as WorkedExamples;

export function realSite(siteId: string): {
  series: DecodedSeries;
  skyline: DecodedSkyline;
  sunRadiusDeg: number;
  earthRadiusDeg: number;
} {
  const meta = parseSiteMeta(json(`sites/${siteId}/meta.json`));
  return {
    series: decodeSeries(bytes(`sites/${siteId}/series.bin`), meta.series.columns as SeriesColumnSpec[], realGrid.count, "series.bin"),
    skyline: decodeSkyline(bytes(`sites/${siteId}/skyline.bin`), meta.skyline.bins, "skyline.bin"),
    sunRadiusDeg: meta.sun_radius_deg,
    earthRadiusDeg: meta.earth_radius_deg,
  };
}

/** A whole dataset as the app would load it: `derived` (the real data) or `fixtures`. */
export type Dataset = {
  name: "derived" | "fixtures";
  grid: TimeGrid;
  examples: WorkedExamples;
  site(siteId: string): { series: DecodedSeries; skyline: DecodedSkyline } | null;
  system: DecodedSystem;
};

export function loadDataset(name: "derived" | "fixtures"): Dataset {
  const root = `${repoRoot}data/${name}/`;
  const read = (path: string) => {
    const buffer = readFileSync(`${root}${path}`);
    const copy = new ArrayBuffer(buffer.byteLength);
    new Uint8Array(copy).set(buffer);
    return copy;
  };
  const readJson = (path: string): unknown => JSON.parse(readFileSync(`${root}${path}`, "utf8"));
  const manifest = parseManifest(readJson("manifest.json"));
  const grid = manifest.time_grid;
  return {
    name,
    grid,
    examples: readJson("academy/worked_examples.json") as WorkedExamples,
    site(siteId) {
      if (!existsSync(`${root}sites/${siteId}/meta.json`)) return null;
      const meta = parseSiteMeta(readJson(`sites/${siteId}/meta.json`));
      return {
        series: decodeSeries(read(`sites/${siteId}/series.bin`), meta.series.columns as SeriesColumnSpec[], grid.count, "series.bin"),
        skyline: decodeSkyline(read(`sites/${siteId}/skyline.bin`), meta.skyline.bins, "skyline.bin"),
      };
    },
    system: decodeSystem(read("system.bin"), grid.count, "system.bin"),
  };
}
