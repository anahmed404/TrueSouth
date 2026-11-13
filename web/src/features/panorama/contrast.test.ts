import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * A graphic that carries meaning needs 3:1 against what is next to it (WCAG 1.4.11). The
 * chart's faded disc and faded paths sit on the ground (--terrain); they are checked here
 * with the real tokens in theme.css and the real opacities in panorama.css.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const theme = readFileSync(path.resolve(here, "../../app/theme.css"), "utf8");
const css = readFileSync(path.resolve(here, "panorama.css"), "utf8");

type Rgb = [number, number, number];

function token(name: string): Rgb {
  const m = new RegExp(`--${name}:\\s*#([0-9a-f]{6});`, "i").exec(theme);
  if (!m?.[1]) throw new Error(`no hex --${name} in theme.css`);
  const n = Number.parseInt(m[1], 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The number a rule in panorama.css sets for one property. */
function cssNumber(selector: string, property: string): number {
  const block = new RegExp(`${selector.replace(/[.-]/g, (c) => `\\${c}`)}\\s*\\{([^}]*)\\}`).exec(css)?.[1];
  const m = block ? new RegExp(`${property}:\\s*([\\d.]+)`).exec(block) : null;
  if (!m?.[1]) throw new Error(`no ${property} in ${selector}`);
  return Number(m[1]);
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

const GRAPHIC = 3;
const ground = token("terrain");

describe("the chart's faded parts stay visible on the ground", () => {
  const discAlpha = cssNumber(".pano-disc-hidden", "fill-opacity");
  const pathAlpha = cssNumber(".pano-faded", "opacity");

  for (const [body, core] of [
    ["Sun", token("sun-core")],
    ["Earth", token("earth-core")],
  ] as const) {
    it(`${body}'s faded disc: at least 3:1 on the ground, and distinct from the clear disc`, () => {
      const faded = blend(core, discAlpha, ground);
      expect(ratio(faded, ground)).toBeGreaterThanOrEqual(GRAPHIC);
      expect(ratio(faded, core)).toBeGreaterThanOrEqual(GRAPHIC);
    });
  }

  for (const [body, stroke] of [
    ["Sun", token("sun")],
    ["Earth", token("earth")],
  ] as const) {
    it(`${body}'s faded path: at least 3:1 on the ground`, () => {
      expect(ratio(blend(stroke, pathAlpha, ground), ground)).toBeGreaterThanOrEqual(GRAPHIC);
    });
  }

  it("the old faded disc (0.3) was under 3:1, as the review measured", () => {
    expect(ratio(blend(token("sun-core"), 0.3, ground), ground)).toBeCloseTo(2.58, 2);
    expect(ratio(blend(token("earth-core"), 0.3, ground), ground)).toBeCloseTo(2.21, 2);
  });
});
