import { describe, expect, it } from "vitest";
import { apronCellLocalKm, localKmToSceneOffset, MOON_RADIUS_M } from "../../../lib/geo";
import { apronGeometry } from "./ground";

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
