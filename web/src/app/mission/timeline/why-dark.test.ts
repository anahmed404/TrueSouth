import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Feature, Manifest, MissionProfile } from "../../../contracts/generated";
import { SERIES_COLUMNS, SKYLINE_ARRAYS, decodeSeries, decodeSkyline } from "../../../data/decode/index";
import { hourFlags } from "../../../lib/scoring";
import { utcToHourIndex } from "../../../lib/time";
import {
  FEATURE_REACH,
  blockerAt,
  compassWord,
  explainEarth,
  explainSun,
  formatDistance,
  formatHeight,
  namedFeatureAt,
  surfaceDistanceKm,
  wordExplanation,
  type SkylineArrays,
} from "./why-dark";

const BINS = 1440;

/** A skyline whose bin k has distance k / 100 km, so a lookup shows which bin it read. */
function skyline(fill: (bin: number) => { el: number; dist: number; lat: number; lon: number; h: number }): SkylineArrays {
  const out = { el_deg: new Float32Array(BINS), dist_km: new Float32Array(BINS), lat_deg: new Float32Array(BINS), lon_deg: new Float32Array(BINS), height_m: new Float32Array(BINS) };
  for (let k = 0; k < BINS; k++) {
    const v = fill(k);
    out.el_deg[k] = v.el;
    out.dist_km[k] = v.dist;
    out.lat_deg[k] = v.lat;
    out.lon_deg[k] = v.lon;
    out.height_m[k] = v.h;
  }
  return out;
}

const indexed = skyline((k) => ({ el: 1, dist: k / 100, lat: -89, lon: 10, h: 1000 }));

describe("blockerAt", () => {
  it("reads the nearest 0.25° bin", () => {
    expect(blockerAt(indexed, 184.74)?.bin).toBe(739);
    expect(blockerAt(indexed, 184.74)?.bearingDeg).toBe(184.75);
    expect(blockerAt(indexed, 90)?.bin).toBe(360);
    expect(blockerAt(indexed, 90.124)?.bin).toBe(360);
    expect(blockerAt(indexed, 90.126)?.bin).toBe(361);
  });

  it("wraps at 0° and 360°", () => {
    expect(blockerAt(indexed, 359.9)?.bin).toBe(0);
    expect(blockerAt(indexed, 359.8)?.bin).toBe(1439);
    expect(blockerAt(indexed, 360)?.bin).toBe(0);
    expect(blockerAt(indexed, -0.2)?.bin).toBe(1439);
  });

  it("has no blocker where the bin's data is NaN, as on a sphere-tier site", () => {
    const sphere = skyline(() => ({ el: -0.087, dist: Number.NaN, lat: Number.NaN, lon: Number.NaN, h: Number.NaN }));
    expect(blockerAt(sphere, 120)).toBeNull();
    const oneMissing = skyline((k) => ({ el: 1, dist: k === 480 ? Number.NaN : 2, lat: -89, lon: 10, h: 5 }));
    expect(blockerAt(oneMissing, 120)).toBeNull();
    expect(blockerAt(oneMissing, 121)).not.toBeNull();
    expect(blockerAt(indexed, Number.NaN)).toBeNull();
  });
});

describe("namedFeatureAt", () => {
  const shackleton: Feature = { name: "Shackleton", kind: "crater", iau_id: 5450, lat_deg: -89.67, lon_deg: 129.78, diameter_km: 20.92 };
  const small: Feature = { name: "Small", kind: "crater", iau_id: 1, lat_deg: -89.67, lon_deg: 129.78, diameter_km: 2 };
  const far: Feature = { name: "de Gerlache", kind: "crater", iau_id: 1439, lat_deg: -88.48, lon_deg: 271.66, diameter_km: 32.71 };

  it("names a feature only within 0.6 of its diameter from its centre", () => {
    expect(FEATURE_REACH).toBe(0.6);
    expect(namedFeatureAt(-89.67, 129.78, [shackleton, far])?.name).toBe("Shackleton");
    // Walk out along a meridian: 1° of latitude is 30.32 km on the reference sphere.
    const kmPerDeg = surfaceDistanceKm(0, 0, 1, 0);
    expect(kmPerDeg).toBeCloseTo(30.32, 2);
    const inside = -89.67 + (0.55 * shackleton.diameter_km) / kmPerDeg;
    const outside = -89.67 + (0.65 * shackleton.diameter_km) / kmPerDeg;
    expect(namedFeatureAt(inside, 129.78, [shackleton])?.name).toBe("Shackleton");
    expect(namedFeatureAt(outside, 129.78, [shackleton])).toBeNull();
  });

  it("prefers the smallest feature that contains the blocker", () => {
    expect(namedFeatureAt(-89.67, 129.78, [shackleton, small])?.name).toBe("Small");
  });

  it("does not name a feature for a blocker that lies elsewhere", () => {
    // The Connecting Ridge blocker at 184.75°: none of the catalogue's features reach it.
    expect(namedFeatureAt(-89.4739, 222.4527, [shackleton, far])).toBeNull();
  });
});

describe("compass words and units", () => {
  it("rounds to eight directions", () => {
    expect(compassWord(0)).toBe("north");
    expect(compassWord(22.4)).toBe("north");
    expect(compassWord(22.6)).toBe("north-east");
    expect(compassWord(184.75)).toBe("south");
    expect(compassWord(265.75)).toBe("west");
    expect(compassWord(359)).toBe("north");
  });

  it("writes metres under 1 km and a thousands comma", () => {
    expect(formatDistance(0.56)).toBe("560 m");
    expect(formatDistance(0.08)).toBe("80 m");
    expect(formatDistance(12.43)).toBe("12.4 km");
    expect(formatHeight(1945.8)).toBe("1,946 m");
    expect(formatHeight(-1204.2)).toBe("−1,204 m");
  });
});

describe("explainSun: three cases from the data", () => {
  const rule = { minFraction: 0.5, minElDeg: null, antennaMaskDeg: 1 };
  const near = skyline(() => ({ el: 1.33, dist: 0.8, lat: -89.5, lon: 220, h: 1990 }));
  const far = skyline(() => ({ el: 1.33, dist: 42.1, lat: -88.2, lon: 250, h: 2900 }));
  const context = (sky: SkylineArrays) => ({ skyline: sky, features: [], sphere: false });

  it("blocked by near terrain", () => {
    const e = explainSun({ azDeg: 265.98, elDeg: 1.08, frac: 0, clearDeg: -0.25 }, false, rule, context(near));
    expect(e.cause).toBe("terrain");
    expect(e.skylineDeg).toBeCloseTo(1.33, 10);
    expect(e.blocker?.distKm).toBeCloseTo(0.8, 5);
    expect(wordExplanation(e, rule)).toEqual({
      text: "The Sun is 1.08° up. The skyline toward 265.98° (west) rises to 1.33°, set by ground 800 m away.",
      rule: null,
      verdict: "Blocked by terrain.",
    });
  });

  it("blocked by far terrain, partly", () => {
    const e = explainSun({ azDeg: 10, elDeg: 1.3, frac: 0.31, clearDeg: -0.03 }, false, rule, context(far));
    expect(e.cause).toBe("terrain");
    const words = wordExplanation(e, rule);
    expect(words.text).toBe("The Sun is 1.30° up. The skyline toward 10.00° (north) rises to 1.33°, set by ground 42.1 km away.");
    expect(words.rule).toBe("Only 0.31 of its disc shows; this profile needs 0.5");
  });

  it("below the horizon", () => {
    const e = explainSun({ azDeg: 102.74, elDeg: -1.38, frac: 0, clearDeg: -1.48 }, false, rule, context(near));
    expect(e.cause).toBe("below_horizon");
    expect(wordExplanation(e, rule).verdict).toBe("Below the horizon.");
    expect(wordExplanation(e, rule).text).toMatch(/^The Sun is 1\.38° below level\. The skyline toward 102\.74° \(east\) is at 0\.10°/);
  });

  it("on a sphere-tier site the horizon is the smooth Moon's, with no blocker", () => {
    const sphere = skyline(() => ({ el: -0.087, dist: Number.NaN, lat: Number.NaN, lon: Number.NaN, h: Number.NaN }));
    const e = explainSun({ azDeg: 48.38, elDeg: -0.43, frac: 0, clearDeg: -0.34 }, false, rule, { skyline: sphere, features: [], sphere: true });
    expect(e.cause).toBe("smooth_horizon");
    expect(e.blocker).toBeNull();
    expect(wordExplanation(e, rule).text).toBe(
      "The Sun is 0.43° below level. This site has no terrain model, so its horizon is the smooth Moon's, at −0.09°.",
    );
  });

  it("dark under an operations rule although the Sun is clear", () => {
    const strict = { minFraction: 0.5, minElDeg: 2, antennaMaskDeg: 1 };
    const e = explainSun({ azDeg: 10, elDeg: 1.2, frac: 1, clearDeg: 0.4 }, false, strict, context(near));
    expect(e.cause).toBe("too_low");
    expect(wordExplanation(e, strict).rule).toBe("This profile counts an hour as lit only from 2°");
  });

  it("says so briefly when lit", () => {
    const e = explainSun({ azDeg: 10, elDeg: 1.28, frac: 1, clearDeg: 0.59 }, true, rule, context(near));
    expect(e.ok).toBe(true);
    expect(wordExplanation(e, rule).text).toBe("The Sun is 1.28° up, 0.59° above the skyline.");
  });

  it("prints a value and its skyline apart when they round alike", () => {
    const e = explainSun({ azDeg: 10, elDeg: 1.331, frac: 0.2, clearDeg: -0.002 }, false, rule, context(near));
    expect(wordExplanation(e, rule).text).toContain("1.331° up");
    expect(wordExplanation(e, rule).text).toContain("rises to 1.333°");
  });
});

describe("explainEarth", () => {
  const rule = { minFraction: 0.5, minElDeg: null, antennaMaskDeg: 1 };
  const sky = skyline(() => ({ el: -0.73, dist: 0.12, lat: -89.46, lon: 222.9, h: 1950.7 }));

  it("explains a link lost under the antenna mask", () => {
    const e = explainEarth({ azDeg: 131.82, elDeg: 0.2, frac: 0.99, clearDeg: 0.93 }, false, false, { skyline: sky, features: [], sphere: false });
    expect(e.cause).toBe("under_mask");
    expect(wordExplanation(e, rule)).toEqual({
      text: "Earth is 0.93° above the skyline toward 131.82° (south-east).",
      rule: "The antenna needs 1°",
      verdict: "Too low for a link.",
    });
  });

  it("needs no explanation with a relay", () => {
    const e = explainEarth({ azDeg: 0, elDeg: -5, frac: 0, clearDeg: -5 }, true, true, { skyline: sky, features: [], sphere: false });
    expect(e.cause).toBe("relay");
  });
});

describe("on the real Connecting Ridge data", () => {
  it("names the bin, distance, height and bearing stored for 2028-03-07 06:00 UTC", () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
    const root = path.join(repoRoot, "data", "derived");
    const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")) as Manifest;
    const profiles = JSON.parse(readFileSync(path.join(root, "profiles.json"), "utf8")) as MissionProfile[];
    const im2 = profiles.find((p) => p.id === "im2_athena");
    if (!im2) throw new Error("im2_athena missing");
    const read = (file: string) => {
      const bytes = readFileSync(path.join(root, "sites/connecting_ridge", file));
      const copy = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(copy).set(bytes);
      return copy;
    };
    const series = decodeSeries(read("series.bin"), SERIES_COLUMNS, manifest.time_grid.count, "series.bin");
    const sky = decodeSkyline(read("skyline.bin"), BINS, "skyline.bin");
    expect(Object.keys(sky)).toEqual([...SKYLINE_ARRAYS]);
    const hour = utcToHourIndex(manifest.time_grid, "2028-03-07T06:00:00Z");
    const flags = hourFlags(series, im2);
    const now = { azDeg: series.sun_az[hour]!, elDeg: series.sun_el[hour]!, frac: series.sun_frac[hour]!, clearDeg: series.sun_clear[hour]! };
    const e = explainSun(now, flags.lit[hour] === 1, { minFraction: im2.min_sun_fraction, minElDeg: im2.ops_sun_el_min_deg }, { skyline: sky, features: [], sphere: false });
    expect(e.cause).toBe("below_horizon");
    expect(e.blocker?.bin).toBe(739);
    expect(formatDistance(e.blocker?.distKm ?? 0)).toBe("560 m");
    expect(formatHeight(e.blocker?.heightM ?? 0)).toBe("1,946 m");
    expect(wordExplanation(e, { minFraction: 0.5, minElDeg: null, antennaMaskDeg: 1 }).text).toBe(
      "The Sun is 1.64° below level. The skyline toward 184.74° (south) is at −0.67°, set by ground 560 m away.",
    );
  });
});
