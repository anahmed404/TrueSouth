import { describe, expect, it } from "vitest";
import { MOON_RADIUS_M } from "./constants";
import { azimuthElevation, destination, localBasis, unitVector } from "./frames";

describe("unit vector", () => {
  it("puts the equator on the prime meridian at +x", () => {
    // docs/science.md §2.1. φ = 0, λ = 0:
    // (cos 0 cos 0, cos 0 sin 0, sin 0) = (1, 0, 0)
    const [x, y, z] = unitVector(0, 0);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("puts longitude 90° east on the equator at +y", () => {
    // φ = 0, λ = 90°: (0, 1, 0)
    const [x, y, z] = unitVector(0, 90);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("puts the poles on ±z", () => {
    const north = unitVector(90, 40);
    const south = unitVector(-90, 40);
    expect(north[0]).toBeCloseTo(0, 12);
    expect(north[1]).toBeCloseTo(0, 12);
    expect(north[2]).toBeCloseTo(1, 12);
    expect(south[2]).toBeCloseTo(-1, 12);
  });

  it("round-trips through azimuth and elevation at a site that is not a pole", () => {
    const site = { latDeg: -89.2, lonDeg: 222.5 };
    const up = unitVector(site.latDeg, site.lonDeg);
    const observed = azimuthElevation(up, site.latDeg, site.lonDeg);
    expect(observed.elevationDeg).toBeCloseTo(90, 6);
    expect(observed.azimuthDeg).toBe(0);
  });
});

describe("local basis", () => {
  it("matches the closed form at latitude 45° and longitude 30°", () => {
    // docs/science.md §2.1
    // ê = (−sin λ, cos λ, 0)
    // sin 30° = 0.5, cos 30° = √3/2 = 0.8660254037844387
    // ê = (−0.5, 0.8660254037844387, 0)
    // n̂ = (−sin φ cos λ, −sin φ sin λ, cos φ)
    // sin 45° = cos 45° = √2/2 = 0.7071067811865476
    // n̂ = (−0.7071067811865476 × 0.8660254037844387,
    //       −0.7071067811865476 × 0.5,
    //        0.7071067811865476)
    //     = (−0.6123724356957945, −0.35355339059327373, 0.7071067811865476)
    // û = (cos φ cos λ, cos φ sin λ, sin φ)
    //     = (0.6123724356957946, 0.3535533905932738, 0.7071067811865475)
    const { east, north, up } = localBasis(45, 30);
    expect(east[0]).toBeCloseTo(-0.5, 12);
    expect(east[1]).toBeCloseTo(0.8660254037844387, 12);
    expect(east[2]).toBeCloseTo(0, 12);
    expect(north[0]).toBeCloseTo(-0.6123724356957945, 12);
    expect(north[1]).toBeCloseTo(-0.35355339059327373, 12);
    expect(north[2]).toBeCloseTo(0.7071067811865476, 12);
    expect(up[0]).toBeCloseTo(0.6123724356957946, 12);
    expect(up[1]).toBeCloseTo(0.3535533905932738, 12);
    expect(up[2]).toBeCloseTo(0.7071067811865475, 12);
  });

  it("is orthonormal away from the pole", () => {
    const { east, north, up } = localBasis(0, 0);
    // At the equator on the prime meridian: east +y, north +z, up +x.
    expect(east[1]).toBeCloseTo(1, 12);
    expect(north[2]).toBeCloseTo(1, 12);
    expect(up[0]).toBeCloseTo(1, 12);
    const dot = (a: readonly number[], b: readonly number[]) =>
      a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
    expect(dot(east, north)).toBeCloseTo(0, 12);
    expect(dot(east, up)).toBeCloseTo(0, 12);
    expect(dot(north, up)).toBeCloseTo(0, 12);
  });

  it("rejects a site on the pole", () => {
    expect(() => localBasis(90, 0)).toThrow(RangeError);
    expect(() => localBasis(-89.9991, 10)).toThrow(RangeError);
    expect(() => localBasis(89.999, 10)).not.toThrow();
  });
});

describe("azimuth and elevation", () => {
  it("reads east as azimuth 90° and north as azimuth 0°", () => {
    const { east, north } = localBasis(0, 0);
    expect(azimuthElevation(east, 0, 0)).toEqual({ azimuthDeg: 90, elevationDeg: 0 });
    const northward = azimuthElevation(north, 0, 0);
    expect(northward.azimuthDeg).toBeCloseTo(0, 12);
    expect(northward.elevationDeg).toBeCloseTo(0, 12);
  });

  it("rejects a pole", () => {
    expect(() => azimuthElevation([0, 0, 1], 90, 0)).toThrow(RangeError);
  });
});

describe("destination", () => {
  it("walks a quarter turn east along the equator to longitude 90°", () => {
    // docs/science.md §2.2. Start at (0°, 0°), azimuth 90°, s = R π/2, so γ = π/2.
    // φ2 = asin(sin 0 cos γ + cos 0 sin γ cos 90°) = asin(0) = 0°
    // λ2 = 0 + atan2(sin 90° sin γ cos 0, cos γ − sin 0 sin φ2)
    //    = atan2(1, 0) = 90°
    const arrived = destination(0, 0, 90, (MOON_RADIUS_M * Math.PI) / 2);
    expect(arrived.latDeg).toBeCloseTo(0, 8);
    expect(arrived.lonDeg).toBeCloseTo(90, 8);
  });

  it("matches a 50 km walk from 70°S", () => {
    // φ1 = −70°, λ1 = 15°, A = 40°, s = 50_000 m, R = 1_737_400 m
    // γ = 50000 / 1737400
    // sin φ2 = sin φ1 cos γ + cos φ1 sin γ cos 40° = −0.9317644790696437
    // φ2 = asin(sin φ2) = −68.71155697903677°
    // Δλ = atan2(0.0063260033720162505, 0.12401371837872588) = 2.92015603169474°
    // λ2 = 15 + 2.92015603169474 = 17.92015603169474°
    const arrived = destination(-70, 15, 40, 50_000);
    expect(arrived.latDeg).toBeCloseTo(-68.71155697903677, 8);
    expect(arrived.lonDeg).toBeCloseTo(17.92015603169474, 8);
  });

  it("round-trips a walk north and back south along a meridian", () => {
    // Along a meridian the reverse azimuth is 180°. A diagonal walk is not:
    // meridian convergence means A+180° at the arrival point is a different path.
    const start = { latDeg: -70, lonDeg: 15 };
    const out = destination(start.latDeg, start.lonDeg, 0, 50_000);
    const back = destination(out.latDeg, out.lonDeg, 180, 50_000);
    expect(back.latDeg).toBeCloseTo(start.latDeg, 6);
    expect(back.lonDeg).toBeCloseTo(start.lonDeg, 6);
  });

  it("wraps longitude past 360°", () => {
    // On the equator, walking east by 20° of arc adds 20° of longitude.
    const distanceM = MOON_RADIUS_M * 20 * (Math.PI / 180);
    const arrived = destination(0, 350, 90, distanceM);
    expect(arrived.latDeg).toBeCloseTo(0, 8);
    expect(arrived.lonDeg).toBeCloseTo(10, 8);
  });

  it("stays put when the distance is zero", () => {
    const arrived = destination(-89.2, 222.5, 30, 0);
    expect(arrived.latDeg).toBeCloseTo(-89.2, 10);
    expect(arrived.lonDeg).toBeCloseTo(222.5, 10);
  });

  it("rejects a start on the pole", () => {
    expect(() => destination(-90, 0, 0, 10)).toThrow(RangeError);
  });
});
