import { describe, expect, it } from "vitest";
import { CAP_CORE_HALF_WIDTH_M, CAP_HALF_WIDTH_M, capUv, MOON_RADIUS_M } from "../../../lib/geo";
import { polarStereoForward } from "../../../lib/geo/projection";
import {
  CAP_HALF_WIDTH,
  CORE_HALF_WIDTH,
  capImageUv,
  capMapXY,
  capScaleFactor,
  drawnSunVisible,
  earthLitFraction,
  grainWeight,
  reliefWeights,
  slopeFromTexel,
  SUN_ANGULAR_RADIUS,
} from "./ground-relief";
import type { V3 } from "./vec";

/** A Moon-fixed vector at latitude, longitude and a height above the sphere (Moon radii). */
function moonFixed(latDeg: number, lonDeg: number, heightM = 0): V3 {
  const lat = (latDeg * Math.PI) / 180;
  const lon = (lonDeg * Math.PI) / 180;
  const r = 1 + heightM / MOON_RADIUS_M;
  return [r * Math.cos(lat) * Math.cos(lon), r * Math.cos(lat) * Math.sin(lon), r * Math.sin(lat)];
}

// Shackleton rim, Connecting Ridge, Malapert, IM-2 Athena, and points out to 80° S.
const places: [number, number][] = [
  [-89.7742, 204.2],
  [-89.4555, 222.6192],
  [-85.9948, 359.7642],
  [-84.7906, 29.2],
  [-80, -120],
  [-89.999, 10],
];

describe("science.md §2.3 on a fragment's Moon-fixed position", () => {
  it("agrees with the projection and placement.ts at known places, at any height", () => {
    for (const [lat, lon] of places) {
      const truth = polarStereoForward(lat, lon);
      for (const heightM of [0, 1_500, -4_000]) {
        const [x, y] = capMapXY(moonFixed(lat, lon, heightM));
        expect(x * MOON_RADIUS_M).toBeCloseTo(truth.x_m, 2);
        expect(y * MOON_RADIUS_M).toBeCloseTo(truth.y_m, 2);
      }
      const uv = capImageUv(capMapXY(moonFixed(lat, lon)), CAP_HALF_WIDTH);
      const placed = capUv(lat, lon, CAP_HALF_WIDTH_M);
      expect(uv.u).toBeCloseTo(placed.u, 9);
      expect(uv.v).toBeCloseTo(placed.v, 9);
      const core = capImageUv(capMapXY(moonFixed(lat, lon)), CORE_HALF_WIDTH);
      const placedCore = capUv(lat, lon, CAP_CORE_HALF_WIDTH_M);
      expect(core.u).toBeCloseTo(placedCore.u, 9);
    }
  });

  it("stays precise in float32 next to the pole, where asin of a number near −1 would not", () => {
    const m = moonFixed(-89.999, 10).map((v) => Math.fround(v)) as V3;
    const [x] = capMapXY(m);
    expect(x * MOON_RADIUS_M).toBeCloseTo(polarStereoForward(-89.999, 10).x_m, 0);
  });

  it("80° S is 304.0 km from the pole, the cap's edge", () => {
    const [x, y] = capMapXY(moonFixed(-80, 0));
    expect(Math.hypot(x, y) * MOON_RADIUS_M).toBeCloseTo(2 * MOON_RADIUS_M * Math.tan((5 * Math.PI) / 180), 0);
  });

  it("the scale factor k = 2 / (1 + sin|φ|): 1.000 at the pole, 1.008 at 80° S", () => {
    expect(capScaleFactor(moonFixed(-90, 0))).toBeCloseTo(1, 6);
    expect(capScaleFactor(moonFixed(-80, 0))).toBeCloseTo(1.0077, 4);
  });
});

describe("which normals light the ground", () => {
  const xyAt = (lat: number, lon: number) => capMapXY(moonFixed(lat, lon));
  const near = xyAt(-89.4555, 222.6192);

  it("uses the patch's mesh near the site and the slope maps beyond the patch", () => {
    expect(reliefWeights(0, 0, near, 10, true, true)).toMatchObject({ mesh: 1, map: 0 });
    expect(reliefWeights(12, -3, near, 10, true, true)).toMatchObject({ mesh: 0, map: 1 });
    expect(reliefWeights(0, 50, near, 10, true, true).map).toBe(1);
  });

  it("hands over inside the patch's last 1.6 km, smoothly: no step at the patch edge", () => {
    let previous = reliefWeights(7, 0, near, 10, true, true);
    for (let east = 7; east <= 11; east += 0.01) {
      const w = reliefWeights(east, 2, near, 10, true, true);
      expect(w.mesh + w.map).toBeCloseTo(1, 9);
      expect(Math.abs(w.mesh - previous.mesh)).toBeLessThan(0.02);
      previous = w;
    }
    expect(reliefWeights(9.9, 0, near, 10, true, true).mesh).toBe(0);
  });

  it("takes the 160 m core within ±76 km of the pole and the 320 m cap beyond, with a soft edge", () => {
    expect(reliefWeights(50, 0, near, 10, true, true).core).toBe(1);
    expect(reliefWeights(50, 0, xyAt(-86, 0), 10, true, true).core).toBe(0);
    const edge = 0.96 * CORE_HALF_WIDTH;
    const mid = reliefWeights(50, 0, [edge, 0], 10, true, true).core;
    expect(mid).toBeGreaterThan(0);
    expect(mid).toBeLessThan(1);
  });

  it("falls back to the meshes outside the cap, in the north, and before the cap images load", () => {
    expect(reliefWeights(50, 0, xyAt(-75, 0), 10, true, true).map).toBe(0);
    expect(reliefWeights(50, 0, near, 10, false, true).map).toBe(0);
    expect(reliefWeights(50, 0, near, 10, true, false).map).toBe(0);
    // A sphere-tier site has no patch: its smooth ground keeps its mesh normal.
    expect(reliefWeights(0, 0, xyAt(0.674, 23.47), 0, true, false)).toMatchObject({ mesh: 0, map: 0 });
  });

  it("reads the slope maps' encoding, round(128 + 160 s)", () => {
    expect(slopeFromTexel(128 / 255)).toBe(0);
    expect(slopeFromTexel(200 / 255)).toBeCloseTo(0.45, 9);
    expect(slopeFromTexel(0)).toBeCloseTo(-0.8, 9);
  });
});

describe("the drawing's light", () => {
  it("shows the Sun's disc across the drawn horizon over exactly one disc", () => {
    expect(drawnSunVisible(0.02, 0.02)).toBeCloseTo(0.5, 9);
    expect(drawnSunVisible(0.02 + SUN_ANGULAR_RADIUS, 0.02)).toBe(1);
    expect(drawnSunVisible(0.02 - SUN_ANGULAR_RADIUS, 0.02)).toBe(0);
  });

  it("draws earthshine by Earth's phase seen from the Moon: full Earth when the Sun is behind the Moon", () => {
    expect(earthLitFraction([1, 0, 0], [-1, 0, 0])).toBe(1);
    expect(earthLitFraction([1, 0, 0], [1, 0, 0])).toBe(0);
    expect(earthLitFraction([1, 0, 0], [0, 1, 0])).toBeCloseTo(0.5, 9);
  });

  it("fades the near-ground texture out as a feature shrinks to a few pixels", () => {
    expect(grainWeight(0.01, 14)).toBe(1);
    expect(grainWeight(14 * 0.14, 14)).toBe(0);
    expect(grainWeight(80, 14)).toBe(0);
    let previous = 1;
    for (let foot = 0; foot < 3; foot += 0.05) {
      const w = grainWeight(foot, 14);
      expect(w).toBeLessThanOrEqual(previous);
      previous = w;
    }
  });
});
