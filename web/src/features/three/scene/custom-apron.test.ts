import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it } from "vitest";
import { decodeTerrain } from "../../../data/decode";
import { destination, MOON_RADIUS_M, siteGroundScene, trueLocalPosition } from "../../../lib/geo";
import {
  CONTINUATION_BLEND_KM,
  CONTINUATION_GRID,
  continuationApron,
  continuationHeightM,
  continuationWeight,
  globalHeightM,
  globalHeightsState,
  patchHeightM,
  readGlobalHeights,
  requestGlobalHeights,
  resetGlobalHeightsForTests,
  subscribeGlobalHeights,
  type GlobalHeights,
  type HeightsPlatform,
} from "./custom-apron";
import { explanations } from "../../../lib/explain";
import { sceneContent } from "./plates";
import { apronGeometry, patchGeometry, smoothGroundGeometry, type GroundSite } from "./ground";

/**
 * A custom site's ground (custom-apron.ts) against the globe: the patch at the site's true
 * height, the apron joining it with no step, and the apron's edge on the reference sphere,
 * where the globe is drawn. On the shared fixture's terrain (fixture_ridge, 33 × 33 over
 * 20 km) placed as a custom site in each terrain tier, with positive, negative and zero
 * ground heights.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const terrainBytes = readFileSync(path.join(repoRoot, "data", "fixtures", "sites", "fixture_ridge", "terrain.bin"));
const terrain = decodeTerrain(
  terrainBytes.buffer.slice(terrainBytes.byteOffset, terrainBytes.byteOffset + terrainBytes.byteLength),
  33,
  "terrain.bin",
);
const SIZE = 33;
const WINDOW_KM = 20;

/** A global map whose height rises 1 km per 10° of latitude northward from −3 km at the pole, the same at every longitude. */
function rampMap(): GlobalHeights {
  const width = 1440;
  const height = 720;
  const values = new Uint8Array(width * height);
  for (let row = 0; row < height; row += 1) {
    const lat = 90 - ((row + 0.5) / height) * 180;
    const metres = -3_000 + (lat + 90) * 100;
    const v = Math.round(((metres + 9_000) / 19_600) * 255);
    values.fill(Math.min(255, Math.max(0, v)), row * width, (row + 1) * width);
  }
  return { width, height, values };
}

/** True height above the reference sphere (m) of a geometry vertex placed at the site's ground point. */
function trueHeight(site: GroundSite, position: { getX(k: number): number; getY(k: number): number; getZ(k: number): number }, k: number): number {
  const g = siteGroundScene(site.latDeg, site.lonDeg, site.groundHeightM);
  return Math.hypot(g[0] + position.getX(k), g[1] + position.getY(k), g[2] + position.getZ(k)) * MOON_RADIUS_M - MOON_RADIUS_M;
}

// One custom site in each terrain tier (core80 south of 80° S, wide240 from 80° S to 60° S),
// at a positive, a negative and a zero ground height.
const sites: GroundSite[] = [
  { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 1_394 },
  { latDeg: -85.8553, lonDeg: 269.0142, groundHeightM: -2_603 },
  { latDeg: -72, lonDeg: 10, groundHeightM: 0 },
  { latDeg: -72, lonDeg: 10, groundHeightM: -1_200 },
];

describe("the global height map, as read for a custom site's surroundings", () => {
  it("decodes −9.0 km at 0 and +10.6 km at 255, row 0 north, column 0 at 180° W", () => {
    const values = new Uint8Array(4 * 2);
    values.set([0, 0, 255, 255, 0, 0, 0, 0]);
    const map = { width: 4, height: 2, values };
    // Pixel centres are at 135° W, 45° W, 45° E and 135° E; row 0 (north) is 255 at the last two.
    expect(globalHeightM(map, 45, 90)).toBeCloseTo(10_600, 6);
    expect(globalHeightM(map, -45, 90)).toBeCloseTo(-9_000, 6);
    expect(globalHeightM(map, 45, -90)).toBeCloseTo(-9_000, 6);
    // Halfway between 45° W (0) and 45° E (255).
    expect(globalHeightM(map, 45, 0)).toBeCloseTo(800, 6);
    // Longitude wraps: 450° E is 90° E.
    expect(globalHeightM(map, 45, 450)).toBeCloseTo(10_600, 6);
  });
});

describe("a custom site's patch, placed against the globe", () => {
  for (const site of sites) {
    describe(`${site.latDeg}°, ${site.lonDeg}° E, ground ${site.groundHeightM} m`, () => {
      const patch = patchGeometry(terrain, SIZE, WINDOW_KM, site);
      const apron = continuationApron(terrain, SIZE, WINDOW_KM, site, rampMap());
      const apronGeo = apronGeometry(apron, CONTINUATION_GRID, WINDOW_KM / 2, site);
      const patchPos = patch.getAttribute("position");
      const apronPos = apronGeo.getAttribute("position");
      const centre = ((SIZE - 1) / 2) * SIZE + (SIZE - 1) / 2;

      it("puts the patch's centre at the site's true height above the reference sphere", () => {
        expect(trueHeight(site, patchPos, centre)).toBeCloseTo(site.groundHeightM + terrain.up_km[centre]! * 1_000, 1);
      });

      // Within 0.25 m: up to 14 km from the centre the drawn vertex and the grid offset the
      // height is read at differ at second order in distance (about 0.1 m at the corners).
      it("reads the patch's own true height back from terrain.bin (within 0.25 m)", () => {
        for (const k of [0, centre, SIZE * SIZE - 1, 5 * SIZE + 20]) {
          // The grid offset of point k (625 m spacing), where terrain.bin walked to.
          const e = -10_000 + (k % SIZE) * 625;
          const n = 10_000 - Math.floor(k / SIZE) * 625;
          expect(Math.abs(patchHeightM(terrain, SIZE, WINDOW_KM, site, e, n) - trueHeight(site, patchPos, k))).toBeLessThan(0.25);
        }
      });

      it("ends the apron on the reference sphere, where the globe is drawn (within 1 m)", () => {
        for (const k of [0, 80, 160, 161 * 80, 161 * 161 - 1]) expect(Math.abs(trueHeight(site, apronPos, k))).toBeLessThan(1);
      });

      it("joins the patch with no step or gap: the height is continuous across the patch's edge (2 m apart, within 0.5 m)", () => {
        const map = rampMap();
        for (const [e0, n0] of [[1, 0], [0, -1], [-1, 0.3], [0.7, 1]] as const) {
          const unit = 1 / Math.max(Math.abs(e0), Math.abs(n0));
          const at = (s: number) => continuationHeightM(terrain, SIZE, WINDOW_KM, site, map, e0 * unit * s, n0 * unit * s);
          expect(Math.abs(at(10_001) - at(9_999))).toBeLessThan(0.5);
          // On the patch the surroundings are the patch itself.
          expect(at(9_000)).toBeCloseTo(patchHeightM(terrain, SIZE, WINDOW_KM, site, e0 * unit * 9_000, n0 * unit * 9_000), 9);
        }
      });

      it("drawn: the apron's first vertices beyond the patch sit within 15 m of the patch's rim beside them", () => {
        // Apron columns step 1.875 km: column 86 is 11.25 km east, the first beyond the 10 km edge.
        for (const row of [76, 80, 84]) {
          const k = row * 161 + 86;
          const north = 150 - row * 1.875;
          // The patch's rim point due west of it (east = 10 km), by the same bilinear read.
          const rim = patchHeightM(terrain, SIZE, WINDOW_KM, site, 10_000, north * 1_000);
          const w = continuationWeight(11_250, north * 1_000, WINDOW_KM / 2);
          expect(w).toBeLessThan(0.02);
          expect(Math.abs(trueHeight(site, apronPos, k) - rim)).toBeLessThan(15 + w * 6_000);
        }
      });

      it("is the global map's own height from 25 km beyond the patch", () => {
        const map = rampMap();
        expect(continuationWeight(75_000, 0, WINDOW_KM / 2)).toBe(1);
        // Row 80 (due east of the site), column 120: 75 km east.
        const at = continuationHeightM(terrain, SIZE, WINDOW_KM, site, map, 75_000, 0);
        expect(apron.heights[80 * 161 + 120]).toBeCloseTo(at, 9);
        const point = destination(site.latDeg, site.lonDeg, 90, 75_000);
        expect(at).toBeCloseTo(globalHeightM(map, point.latDeg, point.lonDeg), 9);
        expect(CONTINUATION_BLEND_KM).toBe(25);
      });
    });
  }

  it("the sphere tier (no terrain): the smooth ground lies on the reference sphere, where the globe is", () => {
    const site = { latDeg: 20, lonDeg: 30, groundHeightM: 0 };
    const geometry = smoothGroundGeometry(site);
    const position = geometry.getAttribute("position");
    for (const k of [0, 60 * 121 + 60, 121 * 121 - 1]) expect(Math.abs(trueHeight(site, position, k))).toBeLessThan(0.01);
  });

  it("matches §13: a cell's local up for a true height is what trueLocalPosition gives", () => {
    const up = trueLocalPosition(5_000, -3_000, 1_000, -2_603).upM;
    const site = { latDeg: -85.8553, lonDeg: 269.0142, groundHeightM: -2_603 };
    const flat = { ...terrain, up_km: new Float32Array(SIZE * SIZE).fill(up / 1_000) };
    // A patch whose every point has this up reads back as about 1 km at (5 km, −3 km).
    expect(patchHeightM(flat, SIZE, WINDOW_KM, site, 5_000, -3_000)).toBeCloseTo(1_000, 1);
  });
});

describe("reading the global height map: loading, ready, failed, and a retry", () => {
  const pixels = (w: number, h: number) => ({ data: new Uint8ClampedArray(w * h * 4).fill(128) });
  const image = { width: 4, height: 2, close: () => undefined } as unknown as { width: number; height: number } & CanvasImageSource;
  const good: HeightsPlatform = {
    fetch: async () => ({ ok: true, blob: async () => new Blob() }),
    decode: async () => image,
    canvas: (w, h) => ({ drawImage: () => undefined, getImageData: () => pixels(w, h) }),
  };
  const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

  beforeEach(() => resetGlobalHeightsForTests());

  it("reads the red channel into a map", async () => {
    const map = await readGlobalHeights(good);
    expect(map).toMatchObject({ width: 4, height: 2 });
    expect(map.values[7]).toBe(128);
  });

  for (const [name, platform] of [
    ["a failed fetch", { ...good, fetch: async () => ({ ok: false, blob: async () => new Blob() }) }],
    ["a fetch that throws", { ...good, fetch: async () => Promise.reject(new Error("offline")) }],
    ["a failed image decode", { ...good, decode: async () => Promise.reject(new Error("bad image")) }],
    ["no canvas to read pixels with", { ...good, canvas: () => null }],
  ] as const) {
    it(`${name}: "failed", not kept: the next request tries again and can succeed`, async () => {
      requestGlobalHeights(platform as HeightsPlatform);
      expect(globalHeightsState().status).toBe("loading");
      await settle();
      expect(globalHeightsState()).toEqual({ status: "failed", heights: null });
      requestGlobalHeights(good);
      await settle();
      expect(globalHeightsState().status).toBe("ready");
    });
  }

  it("tells its listeners each change, and is not read twice once in", async () => {
    const seen: string[] = [];
    const stop = subscribeGlobalHeights(() => seen.push(globalHeightsState().status));
    let fetches = 0;
    const counting: HeightsPlatform = { ...good, fetch: async (url) => ((fetches += 1), good.fetch(url)) };
    requestGlobalHeights(counting);
    requestGlobalHeights(counting);
    await settle();
    requestGlobalHeights(counting);
    stop();
    expect(seen).toEqual(["loading", "ready"]);
    expect(fetches).toBe(1);
  });
});

describe("the plate for a custom site's surroundings, in each state of the map", () => {
  const input = (surroundings: "idle" | "loading" | "ready" | "failed" | undefined) =>
    sceneContent({
      view: "terrain",
      trueScale: false,
      system: "ready",
      site: { name: "Custom site", sphere: false },
      series: "ready",
      terrain: "ready",
      apron: "none",
      surroundings,
    }).plates.filter((p) => p.id.startsWith("surroundings"));

  it("ready: the quiet line that the surroundings are coarse", () => {
    expect(input("ready")).toEqual([{ id: "surroundings", text: explanations.custom_site_surroundings!.text }]);
  });

  it("failed: says plainly that only the nearest ground is drawn, never the coarse-map line", () => {
    expect(input("failed")).toEqual([
      { id: "surroundings-error", text: "The ground around Custom site could not be loaded, so only the nearest ground is drawn." },
    ]);
  });

  it("loading (or not asked yet): a status line", () => {
    for (const state of ["loading", "idle", undefined] as const) {
      expect(input(state)).toEqual([{ id: "surroundings-loading", text: "Loading the ground around Custom site…", status: true }]);
    }
  });

  it("a catalog site (apron listed) shows none of these", () => {
    const plates = sceneContent({
      view: "terrain",
      trueScale: false,
      system: "ready",
      site: { name: "Connecting Ridge", sphere: false },
      series: "ready",
      terrain: "ready",
      apron: "ready",
      surroundings: "failed",
    }).plates;
    expect(plates.some((p) => p.id.startsWith("surroundings"))).toBe(false);
  });
});
