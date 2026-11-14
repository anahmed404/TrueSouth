import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import { apronCellLocalKm, localKmToSceneOffset, MOON_RADIUS_M, siteGroundScene } from "../../../lib/geo";
import { SphereGeometry, Vector3 } from "three";
import { APRON_EDGE_DROP_M, apronGeometry, apronUpGrid, GLOBE_FULL_SEGMENTS, globeSagM, globeSegments, gridIndex, patchUpGrid, smoothGroundGeometry, type GroundLod } from "./ground";
import { MOON_SEGMENTS, MOON_SEGMENTS_FULL } from "./perf";

const site = { latDeg: -89.4555, lonDeg: 222.6192, groundHeightM: 1_000 };
const grid = { rows: 161, columns: 161, windowM: 300_000 };
// A flat apron at the site's own height: any difference in a vertex is the drawing tweak.
const apron = { heights: new Float64Array(161 * 161).fill(1_000), rows: 161, columns: 161 };

/** How far a vertex sits below its true §13 position, in metres. */
function drop(row: number, column: number): number {
  const geometry = apronGeometry(apron, grid, 10, site);
  const position = geometry.getAttribute("position");
  const k = row * grid.columns + column;
  const truth = apronCellLocalKm(row, column, 1_000, 1_000, grid);
  const expected = localKmToSceneOffset(truth.eastKm, truth.northKm, truth.upKm, site.latDeg, site.lonDeg);
  const dx = position.getX(k) - expected[0];
  const dy = position.getY(k) - expected[1];
  const dz = position.getZ(k) - expected[2];
  geometry.dispose();
  return Math.hypot(dx, dy, dz) * MOON_RADIUS_M;
}

describe("the apron around the 20 km patch", () => {
  // Columns step 1.875 km: column 85 is 9.375 km east (under the patch), 86 is 11.25 km (outside).
  it("lowers a vertex strictly inside the patch, so the patch covers it", () => {
    expect(drop(80, 85)).toBeCloseTo(30, 3);
    expect(drop(75, 85)).toBeCloseTo(30, 3);
  });

  it("leaves every vertex outside the patch at its true height", () => {
    expect(drop(80, 86)).toBeLessThan(0.01);
    expect(drop(86, 80)).toBeLessThan(0.01);
    expect(drop(86, 86)).toBeLessThan(0.01);
    expect(drop(80, 100)).toBeLessThan(0.01);
  });
});

describe("what the shadow march and the near-ground texture read", () => {
  it("each vertex carries its local position in kilometres, the one it was placed from", () => {
    const geometry = apronGeometry(apron, grid, 10, site);
    const local = geometry.getAttribute("aL");
    for (const [row, column] of [[20, 30], [80, 120], [140, 50]] as const) {
      const k = row * grid.columns + column;
      const truth = apronCellLocalKm(row, column, 1_000, 1_000, grid);
      expect(local.getX(k)).toBeCloseTo(truth.eastKm, 3);
      expect(local.getY(k)).toBeCloseTo(truth.northKm, 3);
      expect(local.getZ(k)).toBeCloseTo(truth.upKm, 4);
    }
    geometry.dispose();
  });

  it("the apron's height grid is the drawn apron, without the 30 m drop under the patch", () => {
    const geometry = apronGeometry(apron, grid, 10, site);
    const local = geometry.getAttribute("aL");
    const heights = apronUpGrid(apron, grid, site);
    // Outside the patch: the drawn vertex. Under it: the true height, 30 m above the drawn vertex.
    expect(heights[80 * 161 + 100]).toBeCloseTo(local.getZ(80 * 161 + 100), 6);
    expect(heights[80 * 161 + 85]! - local.getZ(80 * 161 + 85)).toBeCloseTo(0.03, 6);
    // The outer edge eases down below the reference sphere, as drawn (APRON_EDGE_DROP_M).
    const edge = apronCellLocalKm(0, 80, APRON_EDGE_DROP_M, 1_000, grid).upKm;
    expect(heights[80]).toBeCloseTo(edge, 6);
    geometry.dispose();
  });

  it("the patch's height grid is terrain.bin's up, with a missing point at the site's height", () => {
    const size = 3;
    const up = Float32Array.from([0.1, Number.NaN, 0.3, 0.4, 0, 0.6, 0.7, 0.8, 0.9]);
    const terrain = { east_km: new Float32Array(9), north_km: new Float32Array(9), up_km: up, slope_deg: new Float32Array(9) };
    expect(Array.from(patchUpGrid(terrain, size))).toEqual(Array.from(up, (v) => (Number.isNaN(v) ? 0 : Math.fround(v))));
  });
});

describe("the ground's coarser mesh levels, for a moving camera", () => {
  it("share one index buffer with the full mesh, which is drawn by default", () => {
    const geometry = apronGeometry(apron, grid, 10, site);
    const lod = geometry.userData.lod as GroundLod;
    expect(lod[1]).toEqual({ start: 0, count: geometry.drawRange.count });
    expect(lod[2]!.start).toBe(lod[1]!.count);
    expect(lod[4]!.start).toBe(lod[2]!.start + lod[2]!.count);
    expect(geometry.index!.count).toBe(lod[4]!.start + lod[4]!.count);
    // Each step halves the grid: about a quarter of the triangles.
    expect(lod[2]!.count / lod[1]!.count).toBeCloseTo(0.25, 1);
    geometry.dispose();
  });

  it("use only the grid's own points, every 2nd or 4th, and keep the hole under the patch", () => {
    const index = gridIndex(5, 5, 2, () => true);
    expect(index).toEqual([0, 10, 2, 2, 10, 12, 2, 12, 4, 4, 12, 14, 10, 20, 12, 12, 20, 22, 12, 22, 14, 14, 22, 24]);
    const geometry = apronGeometry(apron, grid, 10, site);
    const lod = geometry.userData.lod as GroundLod;
    const position = geometry.getAttribute("aL");
    const all = geometry.index!.array;
    // Like the full mesh, no coarse triangle lies wholly inside the patch: the patch draws there.
    for (let t = lod[4]!.start; t < lod[4]!.start + lod[4]!.count; t += 3) {
      const inside = [0, 1, 2].every((i) => {
        const k = all[t + i]!;
        return Math.max(Math.abs(position.getX(k)), Math.abs(position.getY(k))) < 10 - 1e-6;
      });
      expect(inside).toBe(false);
    }
    geometry.dispose();
  });
});

describe("where the ground's outer edge meets the globe", () => {
  // The logarithmic depth step at the edge (camera far 5,000 Moon radii, 24 bits):
  // (1 + z) ln 2 log2(5,001) / 2^24 Moon radii, with z up to the far corner, 212 km.
  const depthStep = (1 + 212 / 1_737.4) * Math.LN2 * Math.log2(5_001) / 2 ** 24 * MOON_RADIUS_M;

  it("the depth buffer's step there is about 1 m", () => {
    expect(depthStep).toBeLessThan(1.1);
  });

  it("for every globe mesh the governor can ask for, the globe drawn with ground lies above the ground's edge by more than 10 depth steps", () => {
    for (const requested of MOON_SEGMENTS) {
      const drawn = globeSegments(requested, true);
      expect(drawn).toBe(GLOBE_FULL_SEGMENTS);
      expect(-APRON_EDGE_DROP_M - globeSagM(drawn)).toBeGreaterThan(10 * depthStep);
    }
    expect(GLOBE_FULL_SEGMENTS).toBe(MOON_SEGMENTS_FULL);
    // Without ground the governor's choice stands.
    for (const requested of MOON_SEGMENTS) expect(globeSegments(requested, false)).toBe(requested);
  });

  it("why: every coarser mesh would sit deeper than the edge (sag 4,185, 1,860, 1,046, 465 and 262 m)", () => {
    const sags = MOON_SEGMENTS.map((n) => Math.round(globeSagM(n)));
    expect(sags).toEqual([4185, 1860, 1046, 465, 262, 116]);
    for (const n of MOON_SEGMENTS) if (n !== GLOBE_FULL_SEGMENTS) expect(globeSagM(n)).toBeGreaterThan(-APRON_EDGE_DROP_M);
  });

  it("the actual finest globe mesh: no triangle's plane comes deeper than globeSagM(384)", () => {
    const sphere = new SphereGeometry(1, GLOBE_FULL_SEGMENTS, GLOBE_FULL_SEGMENTS / 2);
    const p = sphere.getAttribute("position");
    const index = sphere.index!.array;
    let deepest = 0;
    const a = new Vector3(), b = new Vector3(), c = new Vector3(), n = new Vector3();
    for (let t = 0; t < index.length; t += 3) {
      a.fromBufferAttribute(p, index[t]!);
      b.fromBufferAttribute(p, index[t + 1]!);
      c.fromBufferAttribute(p, index[t + 2]!);
      n.subVectors(b, a).cross(new Vector3().subVectors(c, a));
      if (n.lengthSq() < 1e-24) continue;
      n.normalize();
      deepest = Math.max(deepest, (1 - Math.abs(n.dot(a))) * MOON_RADIUS_M);
    }
    expect(deepest).toBeLessThanOrEqual(globeSagM(GLOBE_FULL_SEGMENTS) + 0.5);
    expect(-APRON_EDGE_DROP_M - deepest).toBeGreaterThan(10 * depthStep);
    sphere.dispose();
  });

  it("the apron's and the smooth ground's outer rings sit at that depth; the smooth ground's centre stays at the site", () => {
    const site = { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 };
    const trueHeight = (g: THREE.BufferGeometry, k: number) => {
      const p = g.getAttribute("position");
      const o = siteGroundScene(site.latDeg, site.lonDeg, 0);
      return Math.hypot(o[0] + p.getX(k), o[1] + p.getY(k), o[2] + p.getZ(k)) * MOON_RADIUS_M - MOON_RADIUS_M;
    };
    const apronGeo = apronGeometry({ heights: new Float64Array(161 * 161).fill(800), rows: 161, columns: 161 }, grid, 10, site);
    for (const k of [0, 80, 161 * 80, 161 * 161 - 1]) expect(trueHeight(apronGeo, k)).toBeCloseTo(APRON_EDGE_DROP_M, 0);
    const smoothGeo = smoothGroundGeometry(site);
    expect(trueHeight(smoothGeo, 60 * 121 + 60)).toBeCloseTo(0, 3);
    for (const k of [0, 60, 121 * 60, 121 * 121 - 1]) expect(trueHeight(smoothGeo, k)).toBeCloseTo(APRON_EDGE_DROP_M, 0);
    apronGeo.dispose();
    smoothGeo.dispose();
  });
});
