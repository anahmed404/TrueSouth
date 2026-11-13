import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeStars, starBrightness, starExposure, starSize } from "./stars";

const here = path.dirname(fileURLToPath(import.meta.url));
const file = readFileSync(path.resolve(here, "../../../../public/stars.bin"));
const buffer = file.buffer.slice(file.byteOffset, file.byteOffset + file.byteLength) as ArrayBuffer;
const stars = decodeStars(buffer);

function angleDeg(a: readonly number[], b: readonly number[]): number {
  const d = a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
  return (Math.acos(Math.min(1, Math.max(-1, d))) * 180) / Math.PI;
}

function radec(raDeg: number, decDeg: number): [number, number, number] {
  const a = (raDeg * Math.PI) / 180;
  const d = (decDeg * Math.PI) / 180;
  return [Math.cos(d) * Math.cos(a), Math.cos(d) * Math.sin(a), Math.sin(d)];
}

describe("stars.bin, from the Yale Bright Star Catalogue", () => {
  it("holds the naked-eye sky: about 8,400 stars to magnitude 6.5, brightest first", () => {
    expect(stars.count).toBeGreaterThan(8_000);
    expect(stars.count).toBeLessThan(9_200);
    expect(file.byteLength).toBeLessThan(80_000);
    for (let i = 1; i < stars.count; i += 1) expect(stars.magnitudes[i]!).toBeGreaterThanOrEqual(stars.magnitudes[i - 1]! - 1e-6);
    expect(stars.magnitudes[stars.count - 1]!).toBeLessThanOrEqual(6.5 + 0.03);
  });

  it("starts with Sirius (V −1.46, B−V 0.00), then Canopus, then Arcturus", () => {
    expect(stars.magnitudes[0]!).toBeCloseTo(-1.46, 1);
    expect(stars.colours[0]!).toBeCloseTo(0, 1);
    expect(stars.magnitudes[1]!).toBeCloseTo(-0.72, 1);
    expect(stars.colours[2]!).toBeCloseTo(1.23, 1); // Arcturus is orange
  });

  it("stores unit directions", () => {
    for (let i = 0; i < stars.count; i += 1) {
      const l = Math.hypot(stars.directions[i * 3]!, stars.directions[i * 3 + 1]!, stars.directions[i * 3 + 2]!);
      expect(Math.abs(l - 1)).toBeLessThan(2e-4);
    }
  });

  it("puts the Moon's south pole (scene −y) where it points in the sky: Canopus is 14.2° from it", () => {
    // IAU: the Moon's south pole points to right ascension 89.9949°, declination −66.5392°.
    const expected = angleDeg(radec(95.988, -52.696), radec(89.9949, -66.5392));
    const canopus = [stars.directions[3]!, stars.directions[4]!, stars.directions[5]!];
    expect(angleDeg(canopus, [0, -1, 0])).toBeCloseTo(expected, 0);
  });

  it("refuses a file that is not a star file", () => {
    expect(() => decodeStars(new ArrayBuffer(16))).toThrow();
  });
});

describe("how a star is drawn", () => {
  it("gets dimmer and smaller with magnitude, from full white to faint", () => {
    expect(starBrightness(-1.46)).toBe(1);
    expect(starBrightness(4)).toBeGreaterThan(starBrightness(6));
    expect(starBrightness(6.5)).toBeGreaterThan(0.15);
    expect(starBrightness(6.5)).toBeLessThan(0.3);
    expect(starSize(-1.46)).toBeCloseTo(2.6, 6);
    expect(starSize(6)).toBe(1);
  });

  it("dims as the lit Moon fills the view, never to nothing", () => {
    expect(starExposure(0)).toBe(1);
    expect(starExposure(0.1)).toBe(1);
    expect(starExposure(0.4)).toBeLessThan(1);
    expect(starExposure(1)).toBeCloseTo(0.35, 9);
  });
});
