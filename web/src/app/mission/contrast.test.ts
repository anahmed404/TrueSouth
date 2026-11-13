import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * The contrast guarantee for text over the scene (DESIGN.md, "The scene"), checked against
 * the real tokens in theme.css:
 *
 * - Panels are opaque --surface: every text colour is measured on --surface alone.
 * - Text on a plate (the view sentence, the footer line, the scene slot's lines) uses only
 *   Ink and Ink 2. The plate is --surface at 92 %, so it is measured over the worst
 *   background the scene can put behind it: pure white, and pure black.
 */

const theme = readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../theme.css"), "utf8");

function token(name: string): string {
  const match = new RegExp(`--${name}:\\s*([^;]+);`).exec(theme);
  if (!match?.[1]) throw new Error(`no --${name} in theme.css`);
  return match[1].trim();
}

type Rgb = [number, number, number];

function hex(value: string): Rgb {
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  if (!m?.[1]) throw new Error(`not a hex colour: ${value}`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** `rgb(20 20 21 / 0.92)` → colour and alpha. */
function rgba(value: string): { rgb: Rgb; alpha: number } {
  const m = /^rgb\((\d+)\s+(\d+)\s+(\d+)\s*\/\s*([\d.]+)\)$/.exec(value);
  if (!m) throw new Error(`not an rgb() colour: ${value}`);
  return { rgb: [Number(m[1]), Number(m[2]), Number(m[3])], alpha: Number(m[4]) };
}

function blend(top: Rgb, alpha: number, under: Rgb): Rgb {
  return [0, 1, 2].map((i) => (top[i] ?? 0) * alpha + (under[i] ?? 0) * (1 - alpha)) as Rgb;
}

function luminance([r, g, b]: Rgb): number {
  const lin = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function ratio(a: Rgb, b: Rgb): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const AA = 4.5;
const WHITE: Rgb = [255, 255, 255];
const BLACK: Rgb = [0, 0, 0];

describe("text on the floating panels", () => {
  const surface = hex(token("surface"));
  for (const ink of ["ink", "ink-2", "ink-3"]) {
    it(`--${ink} on --surface meets WCAG AA`, () => {
      expect(ratio(hex(token(ink)), surface)).toBeGreaterThanOrEqual(AA);
    });
  }
});

describe("text on a plate over the scene", () => {
  const plate = rgba(token("plate"));

  it("the plate is --surface at 92 %", () => {
    expect(plate.rgb).toEqual(hex(token("surface")));
    expect(plate.alpha).toBe(0.92);
  });

  for (const under of [
    ["pure white", WHITE],
    ["pure black", BLACK],
  ] as const) {
    for (const ink of ["ink", "ink-2"]) {
      it(`--${ink} on a plate over ${under[0]} meets WCAG AA`, () => {
        expect(ratio(hex(token(ink)), blend(plate.rgb, plate.alpha, under[1]))).toBeGreaterThanOrEqual(AA);
      });
    }
  }

  it("matches DESIGN.md's figures over white: Ink 12.7:1, Ink 2 7.1:1", () => {
    const back = blend(plate.rgb, plate.alpha, WHITE);
    expect(ratio(hex(token("ink")), back)).toBeCloseTo(12.7, 0);
    expect(ratio(hex(token("ink-2")), back)).toBeCloseTo(7.1, 0);
  });
});
