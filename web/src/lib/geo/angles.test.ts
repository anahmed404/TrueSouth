import { describe, expect, it } from "vitest";
import {
  degreesToRadians,
  radiansToDegrees,
  signedAzimuthDifference,
  wrapAzimuth,
  wrapLongitude,
} from "./angles";

describe("degrees and radians", () => {
  it("converts a half turn", () => {
    // 180° = π rad. docs/science.md §1: degrees outside, radians only inside a formula.
    expect(degreesToRadians(180)).toBeCloseTo(Math.PI, 12);
    expect(radiansToDegrees(Math.PI)).toBeCloseTo(180, 12);
  });

  it("round-trips degrees through radians", () => {
    expect(radiansToDegrees(degreesToRadians(-80.25))).toBeCloseTo(-80.25, 12);
    expect(degreesToRadians(radiansToDegrees(1.25))).toBeCloseTo(1.25, 12);
  });
});

describe("wrapping", () => {
  it("wraps 360° back to 0", () => {
    expect(wrapAzimuth(360)).toBe(0);
    expect(wrapLongitude(360)).toBe(0);
    expect(wrapAzimuth(720)).toBe(0);
    expect(wrapLongitude(-360)).toBe(0);
  });

  it("wraps an azimuth into 0–360", () => {
    expect(wrapAzimuth(0)).toBe(0);
    expect(wrapAzimuth(90)).toBe(90);
    expect(wrapAzimuth(-90)).toBe(270);
    expect(wrapAzimuth(360.5)).toBeCloseTo(0.5, 12);
  });

  it("wraps a longitude into 0–360", () => {
    expect(wrapLongitude(0)).toBe(0);
    expect(wrapLongitude(222.5)).toBe(222.5);
    expect(wrapLongitude(-0.5)).toBeCloseTo(359.5, 12);
    expect(wrapLongitude(360.25)).toBeCloseTo(0.25, 12);
  });
});

describe("signed azimuth difference", () => {
  it("is the shortest clockwise-positive turn", () => {
    // Positive is clockwise, the same sense as azimuth in docs/science.md §1.
    // The result is in (−180, 180], and an exact half turn stays +180.
    expect(signedAzimuthDifference(10, 20)).toBeCloseTo(10, 12);
    expect(signedAzimuthDifference(10, 350)).toBeCloseTo(-20, 12);
    expect(signedAzimuthDifference(350, 10)).toBeCloseTo(20, 12);
    expect(signedAzimuthDifference(0, 180)).toBe(180);
    expect(signedAzimuthDifference(0, 360)).toBe(0);
  });

  it("wraps the inputs before measuring", () => {
    expect(signedAzimuthDifference(370, -10)).toBeCloseTo(-20, 12);
  });
});
