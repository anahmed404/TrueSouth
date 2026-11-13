import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { TimeGrid } from "../../contracts/generated.ts";
import { hourIndexToUtc, utcToHourIndex } from "./index.ts";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

describe("time grid", () => {
  const grid: TimeGrid = {
    start_utc: "2026-01-01T00:00:00Z",
    step_s: 3600,
    count: 3,
  };

  it("maps the first hour, the last hour, and times outside the grid", () => {
    expect(hourIndexToUtc(grid, 0)).toBe("2026-01-01T00:00:00Z");
    expect(hourIndexToUtc(grid, 2)).toBe("2026-01-01T02:00:00Z");
    expect(utcToHourIndex(grid, "2026-01-01T00:00:00Z")).toBe(0);
    expect(utcToHourIndex(grid, "2026-01-01T02:00:00.000Z")).toBe(2);
    expect(utcToHourIndex(grid, "2026-01-01T00:00Z")).toBe(0);
    expect(() => hourIndexToUtc(grid, -1)).toThrow(RangeError);
    expect(() => hourIndexToUtc(grid, 3)).toThrow(RangeError);
    expect(() => hourIndexToUtc(grid, 1.5)).toThrow(RangeError);
    expect(() => utcToHourIndex(grid, "2025-12-31T23:00:00Z")).toThrow(RangeError);
    expect(() => utcToHourIndex(grid, "2026-01-01T03:00:00Z")).toThrow(RangeError);
    expect(() => utcToHourIndex(grid, "2026-01-01T01:30:00Z")).toThrow(RangeError);
    expect(() => utcToHourIndex(grid, "2026-01-01T00:00:00+00:00")).toThrow(RangeError);
  });

  it("uses the grid step and round-trips the fixture manifest", () => {
    const twoHours: TimeGrid = { start_utc: "2026-01-01T00:00:00Z", step_s: 7200, count: 2 };
    expect(hourIndexToUtc(twoHours, 1)).toBe("2026-01-01T02:00:00Z");

    const manifest = JSON.parse(
      readFileSync(path.join(repoRoot, "data", "fixtures", "manifest.json"), "utf8"),
    ) as { time_grid: TimeGrid };
    const fixture = manifest.time_grid;
    expect(hourIndexToUtc(fixture, 0)).toBe("2026-01-01T00:00:00Z");
    const last = hourIndexToUtc(fixture, fixture.count - 1);
    expect(utcToHourIndex(fixture, last)).toBe(fixture.count - 1);
    expect(last.endsWith("Z")).toBe(true);
    expect(() => hourIndexToUtc(fixture, -1)).toThrow(RangeError);
    expect(() => hourIndexToUtc(fixture, fixture.count)).toThrow(RangeError);
    const before = new Date(Date.parse(fixture.start_utc) - fixture.step_s * 1000).toISOString().replace(/\.000Z$/, "Z");
    const after = new Date(Date.parse(last) + fixture.step_s * 1000).toISOString().replace(/\.000Z$/, "Z");
    expect(() => utcToHourIndex(fixture, before)).toThrow(RangeError);
    expect(() => utcToHourIndex(fixture, after)).toThrow(RangeError);
  });
});
