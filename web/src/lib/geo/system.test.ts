import { describe, expect, it } from "vitest";
import {
  latLonToScene,
  moonFixedToScene,
  sceneToLatLon,
  sceneToMoonFixed,
  sunElevationDeg,
} from "./system";

describe("System view axes", () => {
  it("the Moon's north pole maps to +y in the System view", () => {
    // Moon-fixed û(90°, λ) = (0, 0, 1). Scene (x, z, −y) = (0, 1, 0).
    const [x, y, z] = latLonToScene(90, 222);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("swaps a Moon-fixed vector to (x, z, −y)", () => {
    // docs/science.md §14.
    const [x, y, z] = moonFixedToScene(1, 2, 3);
    expect(x).toBe(1);
    expect(y).toBe(3);
    expect(z).toBe(-2);
  });

  it("round-trips a Moon-fixed vector", () => {
    const scene = moonFixedToScene(-4, 0.5, 8);
    const [x, y, z] = sceneToMoonFixed(...scene);
    expect(x).toBeCloseTo(-4, 12);
    expect(y).toBeCloseTo(0.5, 12);
    expect(z).toBeCloseTo(8, 12);
  });

  it("round-trips a site on the unit sphere", () => {
    const scene = latLonToScene(-89.2, 222.5);
    const back = sceneToLatLon(scene);
    expect(back.latDeg).toBeCloseTo(-89.2, 8);
    expect(back.lonDeg).toBeCloseTo(222.5, 8);
    const length = Math.hypot(scene[0], scene[1], scene[2]);
    expect(length).toBeCloseTo(1, 12);
  });

  it("matches the unit vector of a southern site after the axis swap", () => {
    // φ = −89.5°, λ = 222.5°
    // û = (cos φ cos λ, cos φ sin λ, sin φ)
    //   = (−0.006433876851820115, −0.005895561929111849, −0.9999619230641713)
    // scene = (x, z, −y)
    //       = (−0.006433876851820115, −0.9999619230641713, 0.005895561929111849)
    const [x, y, z] = latLonToScene(-89.5, 222.5);
    expect(x).toBeCloseTo(-0.006433876851820115, 12);
    expect(y).toBeCloseTo(-0.9999619230641713, 12);
    expect(z).toBeCloseTo(0.005895561929111849, 12);
  });
});

describe("Sun elevation from the sub-solar point", () => {
  it("is 90° when the sub-solar point is the site", () => {
    // sin e = sin φ sin φs + cos φ cos φs cos(λ − λs) = 1 when the points match.
    expect(sunElevationDeg(0, 0, 0, 0)).toBeCloseTo(90, 8);
  });

  it("matches the formula for a site at 30°S", () => {
    // docs/science.md §14
    // φ = −30°, λ = 10°, φs = 20°, λs = 40°
    // sin(−30) sin 20 = −0.5 × 0.3420201433256687 = −0.17101007166283433
    // cos 30 cos 20 cos(−30°)
    //   = 0.8660254037844387 × 0.9396926207859084 × 0.8660254037844387
    //   = 0.7047694655894314
    // sin e = 0.5337593939265971
    // e = asin(sin e) = 32.259815625139275°
    expect(sunElevationDeg(-30, 10, 20, 40)).toBeCloseTo(32.259815625139275, 8);
  });

  it("is zero on the day/night line at the equator, 90° of longitude away", () => {
    expect(sunElevationDeg(0, 0, 0, 90)).toBeCloseTo(0, 8);
  });
});
