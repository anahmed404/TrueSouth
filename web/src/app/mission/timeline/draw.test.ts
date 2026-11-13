import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index";
import { evaluate, hourFlags } from "../../../lib/scoring";
import { utcToHourIndex } from "../../../lib/time";
import { hourScale, hourToX, timelineRange } from "./axis";
import { PLOT, bandLayers, clearanceSummary, plotLayout, segmentRects, stretchOutline, stretches } from "./draw";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const root = path.join(repoRoot, "data", "fixtures");
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")) as Manifest;
const profiles = JSON.parse(readFileSync(path.join(root, "profiles.json"), "utf8")) as MissionProfile[];
const im2 = profiles.find((p) => p.id === "im2_athena");
if (!im2) throw new Error("im2_athena missing");

function series(site: string) {
  const bytes = readFileSync(path.join(root, "sites", site, "series.bin"));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return decodeSeries(copy, SERIES_COLUMNS, manifest.time_grid.count, "series.bin");
}

/** Hours covered by segments, as a set, scanned independently of the code under test. */
function covered(segments: { from: number; to: number }[]): Set<number> {
  const hours = new Set<number>();
  for (const s of segments) for (let h = s.from; h < s.to; h++) hours.add(h);
  return hours;
}

/** The first longest run of `0` flags in [from, to), found by a plain scan. */
function firstLongestOff(flags: Uint8Array, from: number, to: number): { from: number; to: number } | null {
  let best: { from: number; to: number } | null = null;
  let h = from;
  while (h < to) {
    if (flags[h] === 1) {
      h++;
      continue;
    }
    const start = h;
    while (h < to && flags[h] !== 1) h++;
    if (!best || h - start > best.to - best.from) best = { from: start, to: h };
  }
  return best;
}

const SITES = ["fixture_crater", "fixture_edge", "fixture_ridge", "fixture_sphere", "fixture_wide"];
const LANDINGS = ["2028-03-01T00:00:00Z", "2027-07-14T05:00:00Z", "2029-11-30T18:00:00Z"];

describe("the bands draw the right flags", () => {
  for (const site of SITES) {
    it(`${site}: the Sun band covers exactly the lit hours, the Earth band exactly the link hours`, () => {
      const data = series(site);
      const flags = hourFlags(data, im2);
      for (const landingUtc of LANDINGS) {
        const landing = utcToHourIndex(manifest.time_grid, landingUtc);
        const range = timelineRange(manifest.time_grid.count, landing, im2.duration_days);
        const layers = bandLayers(flags, data.sun_frac, range);
        const sunHours = covered(layers.sun);
        const earthHours = covered(layers.earth);
        for (let h = range.start; h <= range.end; h++) {
          expect(sunHours.has(h), `${site} ${landingUtc} sun ${h}`).toBe(flags.lit[h] === 1);
          expect(earthHours.has(h), `${site} ${landingUtc} earth ${h}`).toBe(flags.link[h] === 1);
        }
        // Inside the window full strength, outside it the faint context.
        for (const s of [...layers.sun, ...layers.earth]) {
          expect(s.inWindow).toBe(s.from >= range.landing && s.to <= range.windowEnd);
        }
        // The Sun band's height is the disc fraction of each hour it covers.
        for (const s of layers.sun) {
          for (let h = s.from; h < s.to; h++) expect(Math.abs(s.level - (data.sun_frac[h] ?? 0))).toBeLessThanOrEqual(0.005);
        }
        for (const s of layers.earth) expect(s.level).toBe(1);
      }
    });
  }
});

describe("segment rectangles in pixels", () => {
  it("span each segment's hours and fill from the band's bottom", () => {
    const range = timelineRange(manifest.time_grid.count, 18_960, 10);
    const scale = hourScale(range, 48, 768);
    const rects = segmentRects(
      [
        { from: 18_960, to: 18_970, inWindow: true, level: 1 },
        { from: 18_980, to: 18_981, inWindow: true, level: 0.5 },
      ],
      scale,
      40,
      26,
    );
    expect(rects[0]).toEqual({ x: hourToX(scale, 18_960), y: 40, width: 20, height: 26, inWindow: true });
    expect(rects[1]).toEqual({ x: hourToX(scale, 18_980), y: 53, width: 2, height: 13, inWindow: true });
  });
});

describe("the stretch outlines sit on the stretches the metrics measured", () => {
  for (const site of SITES) {
    it(site, () => {
      const data = series(site);
      const flags = hourFlags(data, im2);
      for (const landingUtc of LANDINGS) {
        const landing = utcToHourIndex(manifest.time_grid, landingUtc);
        const range = timelineRange(manifest.time_grid.count, landing, im2.duration_days);
        const result = evaluate(data, im2, landing, 5);
        if (!result) throw new Error("fixture window should fit");
        const list = stretches(range, flags, result, im2);
        const layout = plotLayout(false);
        const scale = hourScale(range, 48, 1000);
        for (const stretch of list) {
          const lineFlags = stretch.kind === "dark" ? flags.lit : flags.link;
          const metric = stretch.kind === "dark" ? result.metrics.longestDarkH : result.metrics.longestBlackoutH;
          const expected = firstLongestOff(lineFlags, range.landing, range.windowEnd);
          expect(stretch.hours, `${site} ${landingUtc} ${stretch.kind}`).toBe(metric);
          expect(stretch.run, `${site} ${landingUtc} ${stretch.kind}`).toEqual(expected);
          expect(stretch.broken).toBe(stretch.kind === "dark" ? result.vetoes.darkness.triggered : result.vetoes.blackout.triggered);
          const rect = stretchOutline(stretch, scale, layout);
          if (!expected) {
            expect(rect).toBeNull();
            continue;
          }
          expect(rect).toEqual({
            x: hourToX(scale, expected.from) - PLOT.outlinePad,
            y: (stretch.kind === "dark" ? layout.sunY : layout.earthY) - PLOT.outlineRise,
            width: hourToX(scale, expected.to) - hourToX(scale, expected.from) + 2 * PLOT.outlinePad,
            height: PLOT.bandH + 2 * PLOT.outlineRise,
          });
        }
      }
    });
  }

  it("has no outline and no limit for blackouts with a relay", () => {
    const relay = { ...im2, relay_available: true };
    const data = series("fixture_edge");
    const flags = hourFlags(data, relay);
    const landing = utcToHourIndex(manifest.time_grid, LANDINGS[0] ?? "");
    const range = timelineRange(manifest.time_grid.count, landing, relay.duration_days);
    const result = evaluate(data, relay, landing, 5);
    const blackout = stretches(range, flags, result, relay).find((s) => s.kind === "blackout");
    expect(blackout).toMatchObject({ run: null, limit: null, broken: false });
  });
});

describe("plotLayout", () => {
  it("puts the bands under the chart when it is open", () => {
    const closed = plotLayout(false);
    const open = plotLayout(true);
    expect(closed.sunY).toBe(PLOT.dayRow);
    expect(closed.earthY).toBe(PLOT.dayRow + PLOT.bandH + PLOT.bandGap);
    expect(open.sunY - closed.sunY).toBe(PLOT.chartH + PLOT.chartGap);
    expect(open.height - closed.height).toBe(PLOT.chartH + PLOT.chartGap);
  });
});

describe("clearanceSummary", () => {
  it("gives each curve's range and its hours on or above its line over the window", () => {
    const sun = Float64Array.from([5, -1, 0, 2, -0.5, 9]);
    const earth = Float64Array.from([9, 1, 0.5, 1.5, 2, 9]);
    const text = clearanceSummary({ sun_clear: sun, earth_clear: earth }, { landing: 1, windowEnd: 5 }, { relay_available: false, antenna_mask_deg: 1 });
    expect(text).toBe(
      "Clearance chart. Sun clearance runs from −1.00° to 2.00° over the mission window, and is at or above 0° for 2 of 4 hours. Earth clearance runs from 0.50° to 2.00°, and is at or above the 1° antenna mask for 3 of 4 hours.",
    );
  });

  it("measures Earth against 0° with a relay", () => {
    const flat = Float64Array.from([1, 1]);
    expect(clearanceSummary({ sun_clear: flat, earth_clear: flat }, { landing: 0, windowEnd: 2 }, { relay_available: true, antenna_mask_deg: 1 })).toContain(
      "at or above 0° for 2 of 2 hours.",
    );
  });
});
