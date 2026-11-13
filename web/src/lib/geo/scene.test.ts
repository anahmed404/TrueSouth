import { describe, expect, it } from "vitest";
import { MOON_RADIUS_M } from "./constants";
import {
  azimuthElevationToScene,
  enuToScene,
  sceneToAzimuthElevation,
  sceneToEnu,
  skylineWallHeightKm,
  trueLocalPosition,
  trueLocalToSceneKm,
} from "./scene";

describe("local terrain scene axes", () => {
  it("maps east, north and up to x, y and −z", () => {
    // docs/science.md §13. x = east, y = up, z = −north.
    const [x, y, z] = enuToScene(3, 4, 5);
    expect(x).toBe(3);
    expect(y).toBe(5);
    expect(z).toBe(-4);
  });

  it("round-trips local offsets through the scene", () => {
    const scene = enuToScene(-2.5, 8, 0.25);
    const back = sceneToEnu(scene);
    expect(back.east).toBeCloseTo(-2.5, 12);
    expect(back.north).toBeCloseTo(8, 12);
    expect(back.up).toBeCloseTo(0.25, 12);
  });
});

describe("azimuth and elevation to a scene direction", () => {
  it("azimuth 0° maps to −z", () => {
    const [x, y, z] = azimuthElevationToScene(0, 0);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(-1, 12);
  });

  it("azimuth 90° maps to +x", () => {
    const [x, y, z] = azimuthElevationToScene(90, 0);
    expect(x).toBeCloseTo(1, 12);
    expect(y).toBeCloseTo(0, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("elevation 90° maps to +y", () => {
    const [x, y, z] = azimuthElevationToScene(40, 90);
    expect(x).toBeCloseTo(0, 12);
    expect(y).toBeCloseTo(1, 12);
    expect(z).toBeCloseTo(0, 12);
  });

  it("matches the direction formula at azimuth 30° and elevation 10°", () => {
    // docs/science.md §13
    // (x, y, z) = (cos e sin A, sin e, −cos e cos A)
    // cos 10° = 0.984807753012208
    // sin 10° = 0.17364817766693033
    // sin 30° = 0.5
    // cos 30° = 0.8660254037844387
    // x = 0.984807753012208 × 0.5 = 0.492403876506104
    // y = 0.17364817766693033
    // z = −0.984807753012208 × 0.8660254037844387 = −0.8528685319524433
    const [x, y, z] = azimuthElevationToScene(30, 10);
    expect(x).toBeCloseTo(0.492403876506104, 12);
    expect(y).toBeCloseTo(0.17364817766693033, 12);
    expect(z).toBeCloseTo(-0.8528685319524433, 12);
  });

  it("round-trips a direction", () => {
    const scene = azimuthElevationToScene(222.5, -3.25);
    const back = sceneToAzimuthElevation(scene);
    expect(back.azimuthDeg).toBeCloseTo(222.5, 8);
    expect(back.elevationDeg).toBeCloseTo(-3.25, 8);
  });

  it("reports azimuth 0 when the direction is straight up", () => {
    const back = sceneToAzimuthElevation(azimuthElevationToScene(123, 90));
    expect(back.elevationDeg).toBeCloseTo(90, 8);
    expect(back.azimuthDeg).toBe(0);
  });

  it("wraps azimuth 360° to the same direction as 0°", () => {
    const full = azimuthElevationToScene(360, 12);
    const zero = azimuthElevationToScene(0, 12);
    expect(full[0]).toBeCloseTo(zero[0], 12);
    expect(full[1]).toBeCloseTo(zero[1], 12);
    expect(full[2]).toBeCloseTo(zero[2], 12);
  });
});

describe("true local position", () => {
  it("is the height difference when the offset is zero", () => {
    // s = 0, γ = 0, so east = 0, north = 0, up = (R + z) − (R + z0) = z − z0.
    const position = trueLocalPosition(0, 0, 150, 50);
    expect(position.eastM).toBeCloseTo(0, 8);
    expect(position.northM).toBeCloseTo(0, 8);
    expect(position.upM).toBeCloseTo(100, 8);
  });

  it("drops a point 10 km east by the Moon's curvature", () => {
    // docs/science.md §13. E = 10_000 m, N = 0, z = z0 = 0, R = 1_737_400 m
    // s = 10_000, γ = 10000 / 1737400 = 0.005755726948313572
    // A = atan2(E, N) = atan2(10000, 0) = 90°
    // east = R sin γ = 9_999.944786103617 m
    // north = 0
    // up = R (cos γ − 1) = −28.778555292418883 m
    const position = trueLocalPosition(10_000, 0, 0, 0);
    expect(position.eastM).toBeCloseTo(9_999.944786103617, 4);
    expect(position.northM).toBeCloseTo(0, 6);
    expect(position.upM).toBeCloseTo(-28.778555292418883, 4);
    expect(MOON_RADIUS_M).toBe(1_737_400);

    const [x, y, z] = trueLocalToSceneKm(10_000, 0, 0, 0);
    expect(x).toBeCloseTo(9.999944786103617, 6);
    expect(y).toBeCloseTo(-0.028778555292418883, 6);
    expect(z).toBeCloseTo(0, 8);
  });
});

describe("skyline wall", () => {
  it("sets the rim height from the skyline elevation", () => {
    // docs/science.md §13. height = 10 km × tan H(A)
    // H = 5°, tan 5° = 0.08748866352592401, height = 0.87488663525924 km
    expect(skylineWallHeightKm(5)).toBeCloseTo(0.87488663525924, 12);
    expect(skylineWallHeightKm(0, 10)).toBeCloseTo(0, 12);
  });
});
