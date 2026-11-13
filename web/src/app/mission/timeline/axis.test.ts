import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index";
import { evaluate, hourFlags } from "../../../lib/scoring";
import { utcToHourIndex } from "../../../lib/time";
import {
  bandSegments,
  dayLabel,
  dayTicks,
  hourScale,
  hourToX,
  labelStep,
  longestOffRun,
  pillText,
  compactRowText,
  runAround,
  sliderValueText,
  timelineRange,
  windowText,
  xToHour,
} from "./axis";
import { placeLabels } from "./timeline";

const GRID_START = Date.parse("2026-01-01T00:00:00Z");
const COUNT = 52_584;
/** 2028-03-01T00:00Z on the grid. */
const MARCH_1 = 18_960;

describe("timelineRange", () => {
  it("shows three days either side of a 10-day window: 240 hours, not 241", () => {
    const range = timelineRange(COUNT, MARCH_1, 10);
    expect(range).toEqual({
      start: MARCH_1 - 72,
      end: MARCH_1 + 240 - 1 + 72,
      landing: MARCH_1,
      windowEnd: MARCH_1 + 240,
      hours: 240,
      fits: true,
    });
  });

  it("cuts the context days at the start of the grid", () => {
    expect(timelineRange(COUNT, 10, 10).start).toBe(0);
  });

  it("cuts the context days at the end of the grid when the window ends there", () => {
    const landing = COUNT - 240;
    const range = timelineRange(COUNT, landing, 10);
    expect(range.end).toBe(COUNT - 1);
    expect(range.windowEnd).toBe(COUNT);
    expect(range.fits).toBe(true);
  });

  it("marks a window that runs past the grid as having no result", () => {
    const range = timelineRange(COUNT, COUNT - 100, 10);
    expect(range.fits).toBe(false);
    expect(range.end).toBe(COUNT - 1);
  });
});

describe("hour to pixel and back", () => {
  const range = timelineRange(COUNT, MARCH_1, 10);
  const scale = hourScale(range, 48, 768);

  it("puts the first hour at the plot's left edge and one past the last at its right", () => {
    expect(hourToX(scale, range.start)).toBe(48);
    expect(hourToX(scale, range.end + 1)).toBe(48 + 768);
    expect(hourToX(scale, range.landing)).toBe(48 + 72 * 2);
  });

  it("is inverted by xToHour for every hour shown", () => {
    for (let hour = range.start; hour <= range.end; hour++) {
      expect(xToHour(scale, hourToX(scale, hour))).toBe(hour);
    }
  });

  it("picks the nearest hour start and clamps outside the plot", () => {
    expect(xToHour(scale, 48 + 2 * 10 + 0.9)).toBe(range.start + 10);
    expect(xToHour(scale, 48 + 2 * 10 + 1.1)).toBe(range.start + 11);
    expect(xToHour(scale, -500)).toBe(range.start);
    expect(xToHour(scale, 5_000)).toBe(range.end);
  });

  it("survives a plot with no width", () => {
    const empty = hourScale(range, 48, 0);
    expect(xToHour(empty, 100)).toBe(range.start);
  });
});

describe("bandSegments", () => {
  const flags = Uint8Array.from([0, 1, 1, 1, 0, 1, 1, 1, 1, 0]);
  const edges = { start: 0, end: 9, landing: 2, windowEnd: 7 };

  it("merges lit hours into runs and splits them at the window's edges", () => {
    expect(bandSegments(flags, edges)).toEqual([
      { from: 1, to: 2, inWindow: false, level: 1 },
      { from: 2, to: 4, inWindow: true, level: 1 },
      { from: 5, to: 7, inWindow: true, level: 1 },
      { from: 7, to: 9, inWindow: false, level: 1 },
    ]);
  });

  it("follows the Sun's disc fraction for the band's height", () => {
    const frac = [0, 0.5, 0.5, 0.75, 0, 1, 1, 1, 1, 0];
    const segments = bandSegments(flags, edges, (hour) => frac[hour] ?? 0);
    expect(segments.map((s) => [s.from, s.to, s.level])).toEqual([
      [1, 2, 0.5],
      [2, 3, 0.5],
      [3, 4, 0.75],
      [5, 7, 1],
      [7, 9, 1],
    ]);
  });

  it("stops at the last hour of the grid, for a window at the end", () => {
    const end = Uint8Array.from([1, 1, 1]);
    expect(bandSegments(end, { start: 0, end: 10, landing: 0, windowEnd: 3 })).toEqual([
      { from: 0, to: 3, inWindow: true, level: 1 },
    ]);
  });

  it("draws nothing for a window with no lit hour", () => {
    expect(bandSegments(new Uint8Array(10), edges)).toEqual([]);
  });
});

describe("runs", () => {
  const flags = Uint8Array.from([1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0]);

  it("finds the first longest off-run inside the window", () => {
    expect(longestOffRun(flags, 0, 11)).toEqual({ from: 4, to: 7 });
    expect(longestOffRun(flags, 0, 7)).toEqual({ from: 4, to: 7 });
    expect(longestOffRun(flags, 0, 6)).toEqual({ from: 1, to: 3 });
    // A run that reaches the window's end counts up to the end.
    expect(longestOffRun(flags, 8, 11)).toEqual({ from: 8, to: 11 });
    expect(longestOffRun(Uint8Array.from([1, 1]), 0, 2)).toBeNull();
  });

  it("finds the run around an hour, cut to bounds", () => {
    expect(runAround(flags, 5)).toEqual({ from: 4, to: 7 });
    expect(runAround(flags, 5, 5, 6)).toEqual({ from: 5, to: 6 });
    expect(runAround(flags, 0)).toEqual({ from: 0, to: 1 });
  });

  it("puts the longest stretches where the metrics say they are, on fixture_crater", () => {
    const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
    const root = path.join(repoRoot, "data", "fixtures");
    const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")) as Manifest;
    const profiles = JSON.parse(readFileSync(path.join(root, "profiles.json"), "utf8")) as MissionProfile[];
    const bytes = readFileSync(path.join(root, "sites/fixture_crater/series.bin"));
    const copy = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(copy).set(bytes);
    const series = decodeSeries(copy, SERIES_COLUMNS, manifest.time_grid.count, "series.bin");
    for (const profile of profiles) {
      for (const landingUtc of ["2028-03-01T00:00:00Z", "2027-07-14T05:00:00Z", "2029-11-30T18:00:00Z"]) {
        const landing = utcToHourIndex(manifest.time_grid, landingUtc);
        const range = timelineRange(manifest.time_grid.count, landing, profile.duration_days);
        const flags = hourFlags(series, profile);
        const result = evaluate(series, profile, landing, 8);
        if (!result) throw new Error("fixture window should fit");
        const dark = longestOffRun(flags.lit, range.landing, range.windowEnd);
        const blackout = longestOffRun(flags.link, range.landing, range.windowEnd);
        expect(dark ? dark.to - dark.from : 0, `${profile.id} ${landingUtc}`).toBe(result.metrics.longestDarkH);
        expect(blackout ? blackout.to - blackout.from : 0, `${profile.id} ${landingUtc}`).toBe(result.metrics.longestBlackoutH);
      }
    }
  });
});

describe("axis labels", () => {
  const range = timelineRange(COUNT, MARCH_1, 10);

  it("numbers the window's days from landing and the context days around it", () => {
    expect(dayLabel(range, MARCH_1)).toBe("Day 1");
    expect(dayLabel(range, MARCH_1 + 23)).toBe("Day 1");
    expect(dayLabel(range, MARCH_1 + 24 * 9 + 23)).toBe("Day 10");
    expect(dayLabel(range, MARCH_1 - 1)).toBe("−1 d");
    expect(dayLabel(range, MARCH_1 - 72)).toBe("−3 d");
    expect(dayLabel(range, MARCH_1 + 240)).toBe("+1 d");
    expect(dayLabel(range, MARCH_1 + 240 + 71)).toBe("+3 d");
  });

  it("ticks every 24 hours from landing with UTC dates, 2028 being a leap year", () => {
    const ticks = dayTicks(range, GRID_START, 2);
    expect(ticks).toHaveLength(16);
    expect(ticks[0]).toMatchObject({ hour: MARCH_1 - 72, label: "−3 d", date: "27 Feb", inWindow: false });
    expect(ticks[2]).toMatchObject({ date: "29 Feb" });
    expect(ticks[3]).toMatchObject({ hour: MARCH_1, label: "Day 1", date: "01 Mar", inWindow: true });
    expect(ticks[13]).toMatchObject({ label: "+1 d", date: "11 Mar", inWindow: false });
  });

  it("thins labels on a long or narrow timeline", () => {
    expect(labelStep(60)).toBe(1);
    expect(labelStep(30)).toBe(2);
    expect(labelStep(2)).toBe(30);
  });

  it("writes the window and the pill in UTC", () => {
    expect(windowText(range, GRID_START)).toBe("01 Mar 2028 00:00 → 11 Mar 00:00 UTC");
    expect(pillText(range, MARCH_1 + 63, GRID_START)).toBe("Day 3 · 03 Mar 15:00 UTC");
    expect(pillText(range, MARCH_1 - 5, GRID_START)).toBe("−1 d · 29 Feb 19:00 UTC");
  });
});

describe("sliderValueText", () => {
  const range = timelineRange(COUNT, MARCH_1, 10);
  const base = { range, gridStartMs: GRID_START, relay: false };

  it("reads the day, the full UTC time and both flags", () => {
    expect(sliderValueText({ ...base, hour: MARCH_1 + 63, lit: true, link: true })).toBe(
      "Day 3, 03 March 2028 15:00 UTC, lit, link",
    );
    expect(sliderValueText({ ...base, hour: MARCH_1 + 63, lit: false, link: false })).toBe(
      "Day 3, 03 March 2028 15:00 UTC, dark, blackout",
    );
  });

  it("says before landing and after the window in days", () => {
    expect(sliderValueText({ ...base, hour: MARCH_1 - 1, lit: true, link: true })).toBe(
      "1 day before landing, 29 February 2028 23:00 UTC, lit, link",
    );
    expect(sliderValueText({ ...base, hour: MARCH_1 - 72, lit: null, link: null })).toBe(
      "3 days before landing, 27 February 2028 00:00 UTC",
    );
    expect(sliderValueText({ ...base, hour: MARCH_1 + 240 + 30, lit: false, link: true })).toBe(
      "2 days after the window, 12 March 2028 06:00 UTC, dark, link",
    );
  });

  it("names a relay link", () => {
    expect(sliderValueText({ ...base, relay: true, hour: MARCH_1, lit: true, link: true })).toBe(
      "Day 1, 01 March 2028 00:00 UTC, lit, link by relay",
    );
  });
});

describe("placeLabels", () => {
  it("centres labels under their stretches when they fit", () => {
    expect(placeLabels([200, 600], [100, 100], 800, 48)).toEqual({ left: [150, 550], row: [0, 0], rows: 1 });
  });

  it("keeps labels inside the plot and apart", () => {
    const placed = placeLabels([60, 70], [100, 100], 800, 48);
    expect(placed.left[0]).toBe(48);
    expect(placed.left[1]).toBe(164);
    expect(placed.rows).toBe(1);
  });

  it("stacks them when two cannot fit side by side", () => {
    const placed = placeLabels([200, 210], [300, 300], 400, 48);
    expect(placed.rows).toBe(2);
    expect(placed.row).toEqual([0, 1]);
  });
});

describe("compactRowText", () => {
  const range = timelineRange(COUNT, MARCH_1, 10);

  it("names the zone once: the phone strip's time is the scrubber pill's text", () => {
    const row = compactRowText(range, MARCH_1 + 150, GRID_START, null);
    expect(row.time).toBe("Day 7 · 07 Mar 06:00 UTC");
    expect(row.time).not.toMatch(/UTC\s+UTC/);
  });

  it("puts both countdowns on one line", () => {
    const row = compactRowText(range, MARCH_1, GRID_START, { sun: "Sunrise in 18 d 23 h", earth: "Earthrise in 14 d 1 h" });
    expect(row.counts).toBe("Sunrise in 18 d 23 h · Earthrise in 14 d 1 h");
  });
});
