import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { DecodedTerrain } from "../../../data";
import { decodeTerrain } from "../../../data/decode";
import { explanations } from "../../../lib/explain";
import { siteFrameScene, siteGroundScene } from "../../../lib/geo";
import {
  CLOSEUP_BLEND_KM,
  closeupBlendWeight,
  closeupComplete,
  closeupDrawable,
  closeupFits,
  closeupInventedWeight,
  closeupLevelOffsetM,
  closeupPlateState,
  drawnCloseup,
  patchSurfaceUpKm,
  patchWithCloseup,
  type MeshData,
} from "./closeup-ground";
import { GROUND_LOD_STEPS, patchRim, type GroundLod, type GroundLodStep, type GroundSite } from "./ground";
import { CLOSEUP_GRAIN_DEFAULT, closeupGrainFromQuery, GroundLook } from "./ground-material";
import { GRAIN_SLOPE } from "./ground-relief";
import { groundSourcePlate, sceneContent, type PlateInput } from "./plates";
import { World, type WorldSite } from "./world";

/**
 * NASA's 5 m close-up drawn inside the patch (closeup-ground.ts): on the shared fixture's
 * close-up (fixture_ridge, 33 × 33 over 2 km) and on synthetic 257 × 257 grids like the real
 * files. Joins are measured on the drawn triangles, as for the apron.
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtureDir = path.join(repoRoot, "data", "fixtures", "sites", "fixture_ridge");
function readMesh(name: string, size: number): DecodedTerrain {
  const bytes = readFileSync(path.join(fixtureDir, name));
  return decodeTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), size, name);
}
const fixturePatch: MeshData = { data: readMesh("terrain.bin", 33), size: 33, windowKm: 20 };
const fixtureClose: MeshData = { data: readMesh("closeup.bin", 33), size: 33, windowKm: 2 };

/** A synthetic grid like the real files: bumps of `amplitudeM` on a tilt, `offsetM` added everywhere. */
function synthetic(size: number, windowKm: number, amplitudeM: number, offsetM: number, wavelengthKm: number): MeshData {
  const count = size * size;
  const east = new Float32Array(count);
  const north = new Float32Array(count);
  const up = new Float32Array(count);
  const half = windowKm / 2;
  const step = windowKm / (size - 1);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const k = r * size + c;
      const e = -half + c * step;
      const n = half - r * step;
      east[k] = e;
      north[k] = n;
      up[k] = (amplitudeM * Math.sin(e / wavelengthKm) * Math.cos(n / wavelengthKm) + 0.01 * e * 1_000 + offsetM) / 1_000;
    }
  }
  // The site's own point is the reference: up 0 at the centre.
  const centre = ((size - 1) / 2) * size + (size - 1) / 2;
  const c0 = up[centre]!;
  for (let k = 0; k < count; k += 1) up[k] = up[k]! - c0 + offsetM / 1_000;
  return { data: { east_km: east, north_km: north, up_km: up, slope_deg: new Float32Array(count) }, size, windowKm };
}
const realPatch = synthetic(257, 20, 120, 0, 1.3);
const realClose = synthetic(257, 2, 6, 3, 0.07);

function drawnUpAt(geometry: THREE.BufferGeometry, east: number, north: number, step: GroundLodStep): number | null {
  const local = geometry.getAttribute("aL");
  const index = geometry.index!.array;
  const lod = geometry.userData.lod as GroundLod;
  const { start, count } = lod[step]!;
  for (let t = start; t < start + count; t += 3) {
    const [a, b, c] = [index[t]!, index[t + 1]!, index[t + 2]!];
    const ax = local.getX(a), ay = local.getY(a), bx = local.getX(b), by = local.getY(b), cx = local.getX(c), cy = local.getY(c);
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (d === 0) continue;
    const wa = ((by - cy) * (east - cx) + (cx - bx) * (north - cy)) / d;
    const wb = ((cy - ay) * (east - cx) + (ax - cx) * (north - cy)) / d;
    const wc = 1 - wa - wb;
    if (wa < -1e-7 || wb < -1e-7 || wc < -1e-7) continue;
    return wa * local.getZ(a) + wb * local.getZ(b) + wc * local.getZ(c);
  }
  return null;
}

/** Largest drawn gap (m) between the close-up (inside) and the patch (outside) along the close-up's edge at one level. */
function joinGapM(patch: MeshData, close: MeshData, step: GroundLodStep): { gap: number; missing: number } {
  const site: GroundSite = { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 };
  const parts = patchWithCloseup({ ...patch, closeup: close }, site);
  expect(parts.closeup).not.toBeNull();
  const rim = patchRim(drawnCloseup(close, patch), close.size, close.windowKm).points.filter((_, i) => i % step === 0);
  let gap = 0;
  let missing = 0;
  for (let i = 0; i < rim.length; i += 1) {
    const p = rim[i]!;
    const q = rim[(i + 1) % rim.length]!;
    for (const f of close.size > 100 ? [0.5] : [0.25, 0.5, 0.75]) {
      const e = p.eastKm + (q.eastKm - p.eastKm) * f;
      const n = p.northKm + (q.northKm - p.northKm) * f;
      const [ox, oy] = Math.abs(e) > Math.abs(n) ? [Math.sign(e), 0] : [0, Math.sign(n)];
      const inside = drawnUpAt(parts.closeup!, e - ox * 1e-7, n - oy * 1e-7, step);
      const outside = drawnUpAt(parts.patch, e + ox * 1e-7, n + oy * 1e-7, step);
      if (inside === null || outside === null) missing += 1;
      else gap = Math.max(gap, Math.abs(outside - inside) * 1_000);
    }
  }
  parts.patch.dispose();
  parts.closeup!.dispose();
  return { gap, missing };
}

describe("which close-ups are drawn", () => {
  it("one that fits inside the patch and joins at every level: the real files' 257 over 2 km, and the fixture's 33", () => {
    expect(closeupFits({ size: 257, windowKm: 20 }, { size: 257, windowKm: 2 })).toBe(true);
    expect(closeupFits({ size: 33, windowKm: 20 }, { size: 33, windowKm: 2 })).toBe(true);
    expect(closeupFits({ size: 257, windowKm: 20 }, { size: 257, windowKm: 20 })).toBe(false);
    expect(closeupFits({ size: 257, windowKm: 20 }, { size: 258, windowKm: 2 })).toBe(false);
  });

  it("none, or a failed load, draws the patch alone (no close-up mesh, no close-up heights)", () => {
    const site: GroundSite = { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 };
    for (const closeup of [undefined, null]) {
      const parts = patchWithCloseup({ ...fixturePatch, closeup }, site);
      expect(parts.closeup).toBeNull();
      expect(parts.closeHeights).toBeNull();
      expect(parts.patch.userData.joined).toBeUndefined();
      parts.patch.dispose();
    }
  });
});

describe("a close-up is drawn whole or not at all", () => {
  const site: GroundSite = { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 };
  /** A copy of the fixture's close-up with one change. */
  const broken = (change: (d: { east_km: Float32Array; north_km: Float32Array; up_km: Float32Array }) => void): MeshData => {
    const d = fixtureClose.data;
    const columns = { east_km: Float32Array.from(d.east_km), north_km: Float32Array.from(d.north_km), up_km: Float32Array.from(d.up_km) };
    change(columns);
    return { ...fixtureClose, data: { ...columns, slope_deg: Float32Array.from(d.slope_deg) } };
  };
  const cases: [string, MeshData][] = [
    ["every height NaN", broken((d) => d.up_km.fill(Number.NaN))],
    ["one height NaN", broken((d) => (d.up_km[400] = Number.NaN))],
    ["one height infinite", broken((d) => (d.up_km[17] = Number.POSITIVE_INFINITY))],
    ["one east NaN", broken((d) => (d.east_km[5] = Number.NaN))],
    ["one north minus infinity", broken((d) => (d.north_km[900] = Number.NEGATIVE_INFINITY))],
    ["the wrong number of points", broken((d) => (d.up_km = d.up_km.subarray(0, 33 * 33 - 1)))],
  ];

  it("the fixture's own close-up is whole", () => {
    expect(closeupComplete(fixtureClose)).toBe(true);
    expect(closeupDrawable(fixturePatch, fixtureClose)).toBe(true);
  });

  for (const [name, close] of cases) {
    it(`${name}: rejected whole, the patch drawn alone, and the plate gives the patch's sentence`, () => {
      expect(closeupComplete(close)).toBe(false);
      expect(closeupDrawable(fixturePatch, close)).toBe(false);
      const parts = patchWithCloseup({ ...fixturePatch, closeup: close }, site);
      expect(parts.closeup).toBeNull();
      expect(parts.closeHeights).toBeNull();
      expect(parts.patch.userData.joined).toBeUndefined();
      parts.patch.dispose();
      // The file loaded, but nothing of it is drawn: the plate says what is drawn.
      const state = closeupPlateState("ready", false);
      expect(state).toBe("none");
      expect(groundSourcePlate("core80", state).text).toBe(explanations.terrain_ground_core80!.text);
    });
  }

  it("a wrong file length is already refused by the decoder", () => {
    expect(() => decodeTerrain(new ArrayBuffer(16 * 33 * 33 - 4), 33, "closeup.bin")).toThrow();
  });

  it("the plate's state: loading and failed pass through; ready only when drawn", () => {
    expect(closeupPlateState("loading", false)).toBe("loading");
    expect(closeupPlateState("error", false)).toBe("error");
    expect(closeupPlateState("ready", true)).toBe("ready");
  });
});

describe("the drawn join between the close-up and the patch, at every level the scene can show (within 0.25 m, sampled 0.1 mm either side of the rim)", () => {
  for (const step of GROUND_LOD_STEPS) {
    it(`step ${step}: the fixture's close-up`, () => {
      const result = joinGapM(fixturePatch, fixtureClose, step);
      expect(result.missing).toBe(0);
      expect(result.gap).toBeLessThan(0.25);
    });
    it(`step ${step}: 257 × 257 grids like the real files, the close-up 3 m off the patch`, () => {
      const result = joinGapM(realPatch, realClose, step);
      expect(result.missing).toBe(0);
      expect(result.gap).toBeLessThan(0.25);
    }, 180_000);
  }
});

describe("the close-up as drawn", () => {
  it("is levelled so its centre is the site's ground point, by the constant it was off (3 m here)", () => {
    expect(closeupLevelOffsetM(realClose, realPatch)).toBeCloseTo(3, 3);
    const drawn = drawnCloseup(realClose, realPatch);
    const centre = 128 * 257 + 128;
    expect(drawn.up_km[centre]).toBeCloseTo(0, 9);
    // Inside the hand-over its own relief is kept: every point moved by the same 3 m.
    for (const k of [100 * 257 + 100, 140 * 257 + 90, 128 * 257 + 30]) {
      expect((realClose.data.up_km[k]! - drawn.up_km[k]!) * 1_000).toBeCloseTo(3, 3);
    }
  });

  it("lies on the patch's drawn surface at its rim, and hands over across its outer 200 m", () => {
    expect(CLOSEUP_BLEND_KM).toBe(0.2);
    expect(closeupBlendWeight(0.79, 0, 1)).toBe(0);
    expect(closeupBlendWeight(1, 0.3, 1)).toBe(1);
    const drawn = drawnCloseup(realClose, realPatch);
    for (const k of [0, 128, 256, 128 * 257, 257 * 257 - 1]) {
      const e = -1 + (k % 257) * (2 / 256);
      const n = 1 - Math.floor(k / 257) * (2 / 256);
      expect(Math.abs(drawn.up_km[k]! - patchSurfaceUpKm(realPatch, e, n)) * 1_000).toBeLessThan(0.001);
    }
  });

  it("the lander stands on it: the drawn ground at the site is where the patch puts it (the ground point, up 0, for real §13 files), at every level", () => {
    const site: GroundSite = { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 };
    expect(patchSurfaceUpKm(realPatch, 0, 0)).toBe(0);
    for (const close of [fixtureClose, realClose]) {
      const patch = close === fixtureClose ? fixturePatch : realPatch;
      const parts = patchWithCloseup({ ...patch, closeup: close }, site);
      const expected = patchSurfaceUpKm(patch, 0, 0);
      for (const step of GROUND_LOD_STEPS) expect(Math.abs(drawnUpAt(parts.closeup!, 0, 0, step)! - expected) * 1_000).toBeLessThan(0.001);
      parts.patch.dispose();
      parts.closeup!.dispose();
    }
  });

  it("gives the shadow march its own heights", () => {
    const parts = patchWithCloseup({ ...realPatch, closeup: realClose }, { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 });
    expect(parts.closeHeights).toMatchObject({ columns: 257, rows: 257, halfKm: 1 });
    parts.patch.dispose();
    parts.closeup!.dispose();
  });
});

describe("the invented texture", () => {
  const blank = new THREE.Texture();
  const look = new GroundLook(
    { light: { value: new THREE.Vector3(0, 1, 0) }, noLight: { value: 0 } },
    { map: { value: blank }, loaded: { value: 0 }, capSlope: { value: blank }, coreSlope: { value: blank }, capLoaded: { value: 0 } },
    () => undefined,
  );
  const shader = look.material.fragmentShader;

  it("has no craters or rocks any more: only sparse, very shallow dimples (0.02 of the diameter, no rim) and a fine grain", () => {
    expect(shader).not.toMatch(/vec4 craters\(|vec3 rocks\(/);
    expect(shader).toContain("float depth = 2. * rad * .02;");
  });

  it("inside a real close-up: no dimples; the fine grain on by default, and the address can turn it off", () => {
    expect(shader).toContain("float invented = 1. - inClose;");
    expect(shader).toContain("float fine = mix(1., uCloseGrain, inClose);");
    expect(CLOSEUP_GRAIN_DEFAULT).toBe(true);
    expect(closeupGrainFromQuery("")).toBe(true);
    expect(closeupGrainFromQuery("?ground-closeup-grain=off")).toBe(false);
    expect(closeupGrainFromQuery("?ground-closeup-grain=on")).toBe(true);
    expect(look.uniforms.uCloseGrain.value).toBe(1);
  });

  it("no dimples anywhere inside the close-up, up to its edge; they fade back in over the next 200 m outside it", () => {
    expect(closeupInventedWeight(0, 1)).toBe(0);
    expect(closeupInventedWeight(0.975, 1)).toBe(0);
    expect(closeupInventedWeight(1, 1)).toBe(0);
    expect(closeupInventedWeight(1.1, 1)).toBeCloseTo(0.5, 9);
    expect(closeupInventedWeight(1 + CLOSEUP_BLEND_KM, 1)).toBe(1);
    expect(shader).toContain("float inClose = uClose.w * (1. - smoothstep(uClose.x, uClose.x + 0.200, max(abs(vL.x), abs(vL.y))));");
  });

  it("the grain stays under about a degree of slope: at the poles the Sun is only a few degrees up", () => {
    expect(GRAIN_SLOPE).toBeLessThanOrEqual(0.015);
    expect(shader).toContain("#define GRAIN_SLOPE");
  });

  it("the shadow march reads the close-up's heights first", () => {
    expect(shader).toContain("if (uClose.w > .5 && max(abs(q.x), abs(q.y)) < uClose.x) return gridHeight(uHClose, uClose, q, footKm);");
    look.setHeights(null, null, { heights: new Float32Array(9), columns: 3, rows: 3, halfKm: 1 });
    look.clearHeights();
    expect(look.uniforms.uClose.value.w).toBe(0);
  });
});

describe("a site change releases the close-up", () => {
  it("disposes the close-up's geometry and forgets its heights", () => {
    const world = new World(() => undefined, 1);
    const site = (id: string): WorldSite => ({
      id,
      name: id,
      latDeg: -85.3,
      lonDeg: 31.2,
      groundHeightM: 0,
      sphere: false,
      frame: { ground: siteGroundScene(-85.3, 31.2, 0), ...siteFrameScene(-85.3, 31.2) },
    });
    world.setGround(site("a"), { ...realPatch, closeup: realClose }, null);
    const ground = (world as unknown as { ground: THREE.Group }).ground;
    const meshes = ground.children.filter((m): m is THREE.Mesh => m instanceof THREE.Mesh);
    expect(meshes).toHaveLength(2);
    const spies = meshes.map((m) => vi.spyOn(m.geometry, "dispose"));
    world.setGround(site("b"), realPatch, null);
    for (const spy of spies) expect(spy).toHaveBeenCalled();
    expect(ground.children.filter((m) => m instanceof THREE.Mesh)).toHaveLength(1);
    expect(world.groundLook.uniforms.uClose.value.w).toBe(0);
    world.dispose();
  });
});

describe("the line that says what the ground is drawn from", () => {
  const input = (change: Partial<PlateInput>): PlateInput => ({
    view: "panorama",
    trueScale: false,
    system: "ready",
    site: { name: "Connecting Ridge", sphere: false, tier: "core80" },
    series: "ready",
    terrain: "ready",
    apron: "ready",
    ...change,
  });
  const source = (change: Partial<PlateInput>) => sceneContent(input(change)).plates.filter((p) => p.id === "ground-source" || p.id.startsWith("surroundings") || p.id === "sphere");

  it("with the close-up drawn: the shape comes from NASA's 5 m close-up DEM", () => {
    expect(source({ closeup: "ready" })).toEqual([{ id: "ground-source", text: explanations.closeup_ground!.text }]);
    expect(explanations.closeup_ground!.text).toBe(
      "The shape of the ground nearest the lander comes from NASA's close-up DEM of this site, with squares 5 metres across.",
    );
  });

  it("says only where the shape comes from, never that nothing finer is drawn: the decoration line beside it says the fine texture is drawn", () => {
    for (const key of ["closeup_ground", "terrain_ground_core80", "terrain_ground_wide240"]) {
      const text = explanations[key]!.text;
      expect(text).toMatch(/^The shape of the ground /);
      expect(text).not.toMatch(/nothing smaller|not shown|texture|grain|series/);
    }
    // Wherever the line shows, the decoration line shows too, and names the texture as drawn.
    for (const view of ["terrain", "panorama"] as const) {
      for (const closeup of ["ready", "none"] as const) {
        const plates = sceneContent(input({ view, closeup })).plates;
        expect(plates.map((p) => p.id)).toContain("ground-source");
        const decoration = plates.find((p) => p.id === "decoration")!;
        expect(`${decoration.text} ${decoration.note ?? ""}`).toMatch(/fine ground texture are drawn for understanding only/);
      }
    }
  });

  it("without one on a terrain tier: the shape from the 80 m (or 240 m) DEM", () => {
    expect(source({ closeup: "none" })).toEqual([{ id: "ground-source", text: explanations.terrain_ground_core80!.text }]);
    expect(source({ closeup: "none", site: { name: "Chandrayaan-3", sphere: false, tier: "wide240" } })).toEqual([
      { id: "ground-source", text: explanations.terrain_ground_wide240!.text },
    ]);
  });

  it("while a close-up loads, or after it failed, the 80 m line: that is what is drawn (no false sentence)", () => {
    for (const closeup of ["loading", "error"] as const) {
      expect(groundSourcePlate("core80", closeup)).toEqual({ id: "ground-source", text: explanations.terrain_ground_core80!.text });
    }
  });

  it("custom sites and the smooth Moon keep their own sentence, and only one line about the ground is shown", () => {
    const custom = source({ apron: "none", surroundings: "ready", closeup: "none" });
    expect(custom.map((p) => p.id)).toEqual(["surroundings"]);
    const smooth = source({ site: { name: "Apollo 11", sphere: true, tier: "sphere" } });
    expect(smooth.map((p) => p.id)).toEqual(["sphere"]);
  });
});
