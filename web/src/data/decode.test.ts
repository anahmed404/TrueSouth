import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  SERIES_COLUMNS,
  SKYLINE_ARRAYS,
  SYSTEM_ARRAYS,
  TERRAIN_ARRAYS,
  decodeLookup,
  decodeSeries,
  decodeSkyline,
  decodeSystem,
  decodeTerrain,
  decodeTerrainGrid,
  lookupFraction,
  type SeriesColumnSpec,
} from "./decode/index.ts";
import {
  parseArtemisRegions,
  parseFeatures,
  parseManifest,
  parseMapsMeta,
  parseProfiles,
  parseSiteMeta,
  parseSites,
  parseValidation,
  parseWorkedExamples,
} from "./parse.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const fixtureRoot = path.join(repoRoot, "data", "fixtures");

function readFixture(relativePath: string): Buffer {
  return readFileSync(path.join(fixtureRoot, relativePath));
}

function arrayBufferFrom(bytes: Buffer): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function readBytes(relativePath: string): ArrayBuffer {
  return arrayBufferFrom(readFixture(relativePath));
}

function readJson(relativePath: string): unknown {
  return JSON.parse(readFixture(relativePath).toString("utf8")) as unknown;
}

function at(values: ArrayLike<number>, index: number): number {
  const value = values[index];
  if (value === undefined) throw new Error(`missing sample ${index}`);
  return value;
}

describe("fixture files", () => {
  const manifest = parseManifest(readJson("manifest.json"));
  const sites = parseSites(readJson("sites.json"));
  const count = manifest.time_grid.count;

  it("parses every JSON file in the fixture tree", () => {
    expect(sites.map((site) => site.id).sort()).toEqual([
      "fixture_crater",
      "fixture_edge",
      "fixture_ridge",
      "fixture_sphere",
      "fixture_wide",
    ]);
    expect(parseProfiles(readJson("profiles.json")).length).toBeGreaterThan(0);
    expect(parseFeatures(readJson("features.json")).length).toBeGreaterThan(0);
    expect(parseArtemisRegions(readJson("artemis_regions.json")).length).toBeGreaterThan(0);
    expect(parseValidation(readJson("validation.json")).gates.length).toBeGreaterThan(0);
    expect(parseWorkedExamples(readJson("academy/worked_examples.json"))["l1.example_utc"]).toMatch(/Z$/);
    const maps = parseMapsMeta(readJson("maps/meta.json"));
    expect(maps.projection).toBe("south_polar_stereographic");
    for (const layer of [maps.layers.hillshade, maps.layers.sunlight, maps.layers.earthvis]) {
      for (const fileName of layer.files) {
        const bytes = readFixture(path.join("maps", fileName));
        expect(bytes.subarray(0, 4).toString("ascii")).toBe("RIFF");
        expect(bytes.subarray(8, 12).toString("ascii")).toBe("WEBP");
      }
      if (layer.lookup != null && layer.lookup_size != null) {
        const lookup = decodeLookup(readBytes(path.join("maps", layer.lookup)), layer.lookup_size, layer.lookup);
        expect(lookup.length).toBe(layer.lookup_size * layer.lookup_size);
      }
    }
  });

  it("decodes system.bin and every site binary at the metadata lengths", () => {
    const system = decodeSystem(readBytes("system.bin"), count, "system.bin");
    for (const name of SYSTEM_ARRAYS) {
      expect(system[name].length).toBe(count);
    }

    for (const site of sites) {
      const meta = parseSiteMeta(readJson(path.join("sites", site.id, "meta.json")));
      expect(meta.site_id).toBe(site.id);
      expect(meta.skyline.bins).toBe(manifest.skyline_bins);
      expect(site.has_closeup).toBe(meta.closeup !== null);
      expect(site.terrain_tier === "sphere").toBe(meta.terrain === null);

      const series = decodeSeries(
        readBytes(path.join("sites", site.id, "series.bin")),
        meta.series.columns as SeriesColumnSpec[],
        count,
        "series.bin",
      );
      for (const column of SERIES_COLUMNS) {
        expect(series[column.name].length, site.id).toBe(count);
      }

      const skyline = decodeSkyline(
        readBytes(path.join("sites", site.id, "skyline.bin")),
        meta.skyline.bins,
        "skyline.bin",
      );
      for (const name of SKYLINE_ARRAYS) {
        expect(skyline[name].length, site.id).toBe(meta.skyline.bins);
      }

      const terrainPath = path.join(fixtureRoot, "sites", site.id, "terrain.bin");
      if (meta.terrain) {
        expect(existsSync(terrainPath), site.id).toBe(true);
        const terrain = decodeTerrain(readBytes(path.join("sites", site.id, "terrain.bin")), meta.terrain.size, "terrain.bin");
        for (const name of TERRAIN_ARRAYS) {
          expect(terrain[name].length, site.id).toBe(meta.terrain.size * meta.terrain.size);
        }
      } else {
        expect(existsSync(terrainPath), site.id).toBe(false);
      }

      const closeupPath = path.join(fixtureRoot, "sites", site.id, "closeup.bin");
      if (meta.closeup) {
        expect(existsSync(closeupPath), site.id).toBe(true);
        const closeup = decodeTerrain(readBytes(path.join("sites", site.id, "closeup.bin")), meta.closeup.size, "closeup.bin");
        for (const name of TERRAIN_ARRAYS) {
          expect(closeup[name].length, site.id).toBe(meta.closeup.size * meta.closeup.size);
        }
      } else {
        expect(existsSync(closeupPath), site.id).toBe(false);
      }
    }
  });
});

describe("series.bin", () => {
  const count = 2;
  const columns: SeriesColumnSpec[] = SERIES_COLUMNS.map((column) => ({
    name: column.name,
    scale: column.scale,
    offset: column.offset,
  }));
  const rawByColumn = {
    sun_az: [-100, 250],
    sun_el: [-200, 100],
    sun_frac: [-1, 5000],
    sun_clear: [10, -10],
    earth_az: [-300, 40],
    earth_el: [15, -15],
    earth_frac: [1, -2],
    earth_clear: [20, -20],
  } as const;

  function littleEndianSeries(): ArrayBuffer {
    const buffer = new ArrayBuffer(columns.length * count * 2);
    const view = new DataView(buffer);
    columns.forEach((column, columnIndex) => {
      const raw = rawByColumn[column.name];
      raw.forEach((sample, sampleIndex) => {
        view.setInt16((columnIndex * count + sampleIndex) * 2, sample, true);
      });
    });
    return buffer;
  }

  it("decodes little-endian Int16 as raw * scale + offset, including azimuth offset 180", () => {
    const decoded = decodeSeries(littleEndianSeries(), columns, count, "series.bin");
    for (const column of columns) {
      const raw = rawByColumn[column.name];
      expect(at(decoded[column.name], 0)).toBe(at(raw, 0) * column.scale + column.offset);
      expect(at(decoded[column.name], 1)).toBe(at(raw, 1) * column.scale + column.offset);
    }
    expect(columns[0]?.offset).toBe(180);
    expect(columns[4]?.offset).toBe(180);
    expect(at(decoded.sun_az, 0)).toBe(-100 * 0.01 + 180);
    expect(at(decoded.sun_el, 0)).toBe(-200 * 0.01);
  });

  it("does not match a big-endian reading of the same bytes", () => {
    const buffer = littleEndianSeries();
    const view = new DataView(buffer);
    const little = view.getInt16(0, true);
    const big = view.getInt16(0, false);
    expect(little).not.toBe(big);
    const decoded = decodeSeries(buffer, columns, count, "series.bin");
    const scale = columns[0]?.scale ?? 0;
    const offset = columns[0]?.offset ?? 0;
    expect(at(decoded.sun_az, 0)).toBe(little * scale + offset);
    expect(at(decoded.sun_az, 0)).not.toBe(big * scale + offset);
  });

  it("uses the scale and offset from the column metadata", () => {
    const adjusted = columns.map((column) =>
      column.name === "sun_el" ? { ...column, scale: 0.02, offset: 1 } : column,
    );
    const decoded = decodeSeries(littleEndianSeries(), adjusted, count, "series.bin");
    expect(at(decoded.sun_el, 0)).toBe(-200 * 0.02 + 1);
  });

  it("refuses a buffer whose length does not match the metadata", () => {
    expect(() => decodeSeries(new ArrayBuffer(3), columns, count, "series.bin")).toThrow(
      "series.bin has 3 bytes; expected 32 bytes",
    );
  });
});

describe("other binary lengths", () => {
  it("refuses a short skyline and a short lookup by file name", () => {
    expect(() => decodeSkyline(new ArrayBuffer(4), 1, "skyline.bin")).toThrow(
      "skyline.bin has 4 bytes; expected 20 bytes",
    );
    expect(() => decodeLookup(new ArrayBuffer(3), 2, "sunlight_u8.bin")).toThrow(
      "sunlight_u8.bin has 3 bytes; expected 4 bytes",
    );
  });

  it("reads Float32 little-endian", () => {
    const buffer = new ArrayBuffer(SKYLINE_ARRAYS.length * 4);
    const view = new DataView(buffer);
    view.setFloat32(0, 1, true);
    const decoded = decodeSkyline(buffer, 1, "skyline.bin");
    expect(at(decoded.el_deg, 0)).toBe(1);
    expect(view.getFloat32(0, false)).not.toBe(1);
  });

  it("maps lookup bytes with v/255 and 255 as no data", () => {
    expect(lookupFraction(0)).toBe(0);
    expect(lookupFraction(51)).toBe(51 / 255);
    expect(lookupFraction(255)).toBeNull();
  });
});

describe("sphere-tier fixture site", () => {
  it("has no terrain and a flat skyline with NaN blockers", () => {
    const sites = parseSites(readJson("sites.json"));
    const site = sites.find((item) => item.terrain_tier === "sphere");
    expect(site?.id).toBe("fixture_sphere");
    if (!site) return;
    const meta = parseSiteMeta(readJson(path.join("sites", site.id, "meta.json")));
    expect(meta.terrain).toBeNull();
    expect(meta.closeup).toBeNull();
    expect(existsSync(path.join(fixtureRoot, "sites", site.id, "terrain.bin"))).toBe(false);
    const skyline = decodeSkyline(
      readBytes(path.join("sites", site.id, "skyline.bin")),
      meta.skyline.bins,
      "skyline.bin",
    );
    const elevation = at(skyline.el_deg, 0);
    expect(Number.isFinite(elevation)).toBe(true);
    for (let index = 0; index < skyline.el_deg.length; index += 1) {
      expect(at(skyline.el_deg, index)).toBe(elevation);
    }
    for (const name of ["dist_km", "lat_deg", "lon_deg", "height_m"] as const) {
      for (let index = 0; index < skyline[name].length; index += 1) {
        expect(Number.isNaN(at(skyline[name], index))).toBe(true);
      }
    }
  });
});

describe("clearance consistency", () => {
  it("matches sun_clear to sun_el minus the skyline at sun_az within 0.011 degrees", () => {
    const manifest = parseManifest(readJson("manifest.json"));
    const sites = parseSites(readJson("sites.json"));
    const site = sites.find((item) => item.id === "fixture_ridge");
    expect(site).toBeTruthy();
    if (!site) return;
    const meta = parseSiteMeta(readJson(path.join("sites", site.id, "meta.json")));
    const bins = meta.skyline.bins;
    const stepDeg = 0.25;
    expect(bins * stepDeg).toBe(360);
    const series = decodeSeries(
      readBytes(path.join("sites", site.id, "series.bin")),
      meta.series.columns as SeriesColumnSpec[],
      manifest.time_grid.count,
      "series.bin",
    );
    const skyline = decodeSkyline(
      readBytes(path.join("sites", site.id, "skyline.bin")),
      bins,
      "skyline.bin",
    );
    let worst = 0;
    for (let hour = 0; hour < series.sun_el.length; hour += 1) {
      const azimuth = at(series.sun_az, hour);
      const elevation = at(series.sun_el, hour);
      const clearance = at(series.sun_clear, hour);
      const error = Math.abs(clearance - (elevation - skylineAt(skyline.el_deg, azimuth, bins, stepDeg)));
      if (error > worst) worst = error;
    }
    expect(worst).toBeLessThanOrEqual(0.011);
  });
});

describe("series column scale and offset", () => {
  function ridgeMeta(): { series: { columns: { name: string; scale: number; offset: number }[] } } {
    return structuredClone(readJson("sites/fixture_ridge/meta.json")) as {
      series: { columns: { name: string; scale: number; offset: number }[] };
    };
  }

  function column(
    meta: { series: { columns: { name: string; scale: number; offset: number }[] } },
    name: string,
  ): { name: string; scale: number; offset: number } {
    const found = meta.series.columns.find((item) => item.name === name);
    if (!found) throw new Error(`fixture meta has no ${name}`);
    return found;
  }

  it("rejects an azimuth offset of 0", () => {
    const meta = ridgeMeta();
    column(meta, "sun_az").offset = 0;
    expect(() => parseSiteMeta(meta)).toThrow("meta.json series column sun_az offset is 0; expected 180");
  });

  it("rejects a series scale that is not the contract value", () => {
    const meta = ridgeMeta();
    column(meta, "sun_az").scale = 1;
    expect(() => parseSiteMeta(meta)).toThrow("meta.json series column sun_az scale is 1; expected 0.01");
  });
});

describe("terrain row and column order", () => {
  it("keeps each cell of a 3 by 5 mesh", () => {
    const rows = 3;
    const columns = 5;
    const length = rows * columns;
    const buffer = new ArrayBuffer(TERRAIN_ARRAYS.length * length * 4);
    const view = new DataView(buffer);
    for (let arrayIndex = 0; arrayIndex < TERRAIN_ARRAYS.length; arrayIndex += 1) {
      for (let row = 0; row < rows; row += 1) {
        for (let column = 0; column < columns; column += 1) {
          const index = row * columns + column;
          view.setFloat32((arrayIndex * length + index) * 4, arrayIndex * 100 + row * 10 + column, true);
        }
      }
    }
    const mesh = decodeTerrainGrid(buffer, rows, columns, "terrain.bin");
    expect(mesh.east_km[0 * columns + 4]).toBe(4);
    expect(mesh.east_km[2 * columns + 0]).toBe(20);
    expect(mesh.east_km[1 * columns + 3]).toBe(13);
    expect(mesh.north_km[2 * columns + 4]).toBe(124);
  });

  it("matches two off-diagonal cells from the Python reader", () => {
    // fixture_ridge/terrain.bin, size 33. Values from
    // uv run python: truesouth.derived_io.read_terrain(..., 33)["east_km"][0, 1]
    // and [1, 0], which printed -9.375 and -10.0. Flat index is row * size + column.
    const size = 33;
    const terrain = decodeTerrain(readBytes("sites/fixture_ridge/terrain.bin"), size, "terrain.bin");
    expect(terrain.east_km[0 * size + 1]).toBe(-9.375);
    expect(terrain.east_km[1 * size + 0]).toBe(-10);
  });
});

function skylineAt(elevation: Float32Array, azimuthDeg: number, bins: number, stepDeg: number): number {
  const wrapped = ((azimuthDeg % 360) + 360) % 360;
  const pos = wrapped / stepDeg;
  const lower = Math.floor(pos);
  const fraction = pos - lower;
  const index = ((lower % bins) + bins) % bins;
  const next = (index + 1) % bins;
  return at(elevation, index) * (1 - fraction) + at(elevation, next) * fraction;
}

describe("layout constants", () => {
  it("matches the generated schema's array order", () => {
    const schema = JSON.parse(readFileSync(path.join(repoRoot, "web", "src", "contracts", "schema.json"), "utf8")) as {
      $defs: Record<string, {
        properties?: {
          arrays?: { default?: string[]; prefixItems?: { $ref?: string }[] };
          name?: { const?: string };
          scale?: { const?: number };
          offset?: { const?: number };
        };
      }>;
    };
    const seriesItems = schema.$defs.SeriesLayout?.properties?.arrays?.prefixItems ?? [];
    expect(seriesItems).toHaveLength(SERIES_COLUMNS.length);
    seriesItems.forEach((item, index) => {
      const defName = item.$ref?.split("/").pop() ?? "";
      const props = schema.$defs[defName]?.properties;
      expect(props?.name?.const).toBe(SERIES_COLUMNS[index]?.name);
      expect(props?.scale?.const).toBe(SERIES_COLUMNS[index]?.scale);
      expect(props?.offset?.const).toBe(SERIES_COLUMNS[index]?.offset);
    });
    expect(schema.$defs.SkylineLayout?.properties?.arrays?.default).toEqual([...SKYLINE_ARRAYS]);
    expect(schema.$defs.TerrainLayout?.properties?.arrays?.default).toEqual([...TERRAIN_ARRAYS]);
    expect(schema.$defs.SystemLayout?.properties?.arrays?.default).toEqual([...SYSTEM_ARRAYS]);
  });
});
