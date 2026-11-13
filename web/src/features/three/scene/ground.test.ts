import { describe, expect, it } from "vitest";
import { apronCellLocalKm, localKmToSceneOffset, MOON_RADIUS_M } from "../../../lib/geo";
import { apronGeometry, apronUpGrid, patchUpGrid } from "./ground";

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
    // The outer edge eases down to the reference sphere, as drawn.
    const edge = apronCellLocalKm(0, 80, 0, 1_000, grid).upKm;
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
