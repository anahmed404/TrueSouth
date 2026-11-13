import { describe, expect, it } from "vitest";
import { MOON_RADIUS_M } from "./constants";
import { latLonToPixel, pixelToLatLon, polarStereoForward, polarStereoInverse, polarStereoScale } from "./projection";

const map80 = { half_width_m: 304_000, size_px: 7_600 };

describe("south polar stereographic projection", () => {
  it("matches the closed form at 80°S on the prime meridian", () => {
    // docs/science.md §2.3
    // φ = −80°, λ = 0°
    // 45° + φ/2 = 5°
    // ρ = 2 × 1_737_400 × tan(5°)
    // tan(5°) = 0.08748866352592401
    // ρ = 3_474_800 × 0.08748866352592401 = 304_005.6080198807 m
    // x = ρ sin 0° = 0
    // y = ρ cos 0° = ρ
    // The section's check rounds ρ to 304.0 km.
    const projected = polarStereoForward(-80, 0);
    expect(projected.x_m).toBeCloseTo(0, 6);
    expect(projected.y_m).toBeCloseTo(304_005.6080198807, 4);
    expect(projected.y_m / 1000).toBeCloseTo(304.0, 1);
  });

  it("uses atan2(x, y) at 0°, 90°, 180° and 270° east", () => {
    // λ = atan2(x, y), not atan2(y, x). docs/science.md §2.3.
    // At 80°S, ρ is the value from the forward formula above.
    const cases = [
      { lonDeg: 0, xSign: 0, ySign: 1 },
      { lonDeg: 90, xSign: 1, ySign: 0 },
      { lonDeg: 180, xSign: 0, ySign: -1 },
      { lonDeg: 270, xSign: -1, ySign: 0 },
    ];
    for (const { lonDeg, xSign, ySign } of cases) {
      const projected = polarStereoForward(-80, lonDeg);
      const rho = 304_005.6080198807;
      expect(projected.x_m).toBeCloseTo(xSign * rho, 3);
      expect(projected.y_m).toBeCloseTo(ySign * rho, 3);
      const back = polarStereoInverse(projected.x_m, projected.y_m);
      expect(back.latDeg).toBeCloseTo(-80, 8);
      expect(back.lonDeg).toBeCloseTo(lonDeg, 8);
    }
  });

  it("round-trips a point that is not the pole", () => {
    const projected = polarStereoForward(-84.5, 222.5);
    const back = polarStereoInverse(projected.x_m, projected.y_m);
    expect(back.latDeg).toBeCloseTo(-84.5, 8);
    expect(back.lonDeg).toBeCloseTo(222.5, 8);
  });

  it("puts the south pole at the origin", () => {
    const projected = polarStereoForward(-90, 123);
    expect(projected.x_m).toBeCloseTo(0, 8);
    expect(projected.y_m).toBeCloseTo(0, 8);
    const back = polarStereoInverse(0, 0);
    expect(back.latDeg).toBeCloseTo(-90, 8);
    // atan2(0, 0) is 0, so the pole's longitude comes back as 0°.
    expect(back.lonDeg).toBe(0);
  });
});

describe("scale factor", () => {
  it("matches the section's three checks", () => {
    // docs/science.md §2.3. k(φ) = 2 / (1 + sin|φ|)
    // |φ| = 90°: 2 / (1 + 1) = 1
    // |φ| = 80°: 2 / (1 + sin 80°) = 1.0076542662455523, which rounds to 1.008
    // |φ| = 60°: 2 / (1 + sin 60°) = 1.0717967697244908, which rounds to 1.072
    expect(polarStereoScale(-90)).toBeCloseTo(1, 12);
    expect(polarStereoScale(-80)).toBeCloseTo(1.0076542662455523, 12);
    expect(polarStereoScale(-60)).toBeCloseTo(1.0717967697244908, 12);
    expect(polarStereoScale(80)).toBeCloseTo(polarStereoScale(-80), 12);
  });
});

describe("map pixels", () => {
  it("a map pixel converted to latitude and longitude and back returns the same pixel", () => {
    const pixels = [
      [0, 0],
      [100, 200],
      [3_800, 1_000],
      [3_799, 3_800],
      [7_599, 7_599],
    ];
    for (const [col, row] of pixels) {
      const { latDeg, lonDeg } = pixelToLatLon(col!, row!, map80);
      const back = latLonToPixel(latDeg, lonDeg, map80);
      expect(back.col).toBeCloseTo(col!, 4);
      expect(back.row).toBeCloseTo(row!, 4);
    }
  });

  it("the south pole lands on the centre pixel", () => {
    // Pixel centres. Column 0 is the left edge and row 0 is the top, so the
    // image centre is column and row (size − 1) / 2. An odd size has one
    // centre pixel. half_width_m is the maps/meta.json field; size is the image.
    const image = { half_width_m: 304_000, size_px: 5 };
    const centre = (image.size_px - 1) / 2;
    const pole = latLonToPixel(-90, 45, image);
    expect(pole.col).toBeCloseTo(centre, 8);
    expect(pole.row).toBeCloseTo(centre, 8);
    const back = pixelToLatLon(centre, centre, image);
    expect(back.latDeg).toBeCloseTo(-90, 8);

    // The 7,600 px map is even, so the pole is the shared corner of the four
    // central pixels: continuous column and row size/2 − 0.5.
    const evenCentre = map80.size_px / 2 - 0.5;
    const evenPole = latLonToPixel(-90, 0, map80);
    expect(evenPole.col).toBeCloseTo(evenCentre, 6);
    expect(evenPole.row).toBeCloseTo(evenCentre, 6);
  });

  it("steps one pixel north of the pole along longitude 0", () => {
    // size 5, half-width 304_000 m. A pixel is 121_600 m.
    // Pixel (2, 1) is one pixel north of the centre, so y = +121_600 m and x = 0.
    // ρ = 121_600
    // φ = 2 atan(ρ / (2R)) − 90° = −85.99152481157473°
    // λ = atan2(0, 121_600) = 0°
    const image = { half_width_m: 304_000, size_px: 5 };
    const { latDeg, lonDeg } = pixelToLatLon(2, 1, image);
    expect(lonDeg).toBeCloseTo(0, 8);
    expect(latDeg).toBeCloseTo(-85.99152481157473, 6);
    expect(MOON_RADIUS_M).toBe(1_737_400);
  });
});
