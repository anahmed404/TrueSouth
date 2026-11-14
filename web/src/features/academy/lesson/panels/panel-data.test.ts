/**
 * The lessons' panel reveals draw stored data only, and their numbers equal the worked
 * examples the lesson text quotes, on the real derived data and on the shared fixture.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest } from "../../../../contracts/generated";
import { decodeSystem } from "../../../../data/decode/index";
import { parseManifest } from "../../../../data/parse";
import { hourFlags } from "../../../../lib/scoring";
import { skylineReading } from "../../../panorama/readings";
import { resolveTimeRange } from "../../drag-body";
import { oneMonth, pipProfile } from "../../lessons/story";
import { realExamples, realGrid, realSite } from "../../testing/real-site";
import { hourOnGrid } from "../../utc";
import { horizonMoment, monthBands, sunTurnDeg, systemFrame, systemFrames } from "./panel-data";

const repoRoot = fileURLToPath(new URL("../../../../../../", import.meta.url));
const bytes = (path: string) => {
  const buffer = readFileSync(`${repoRoot}data/${path}`);
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
};
const hour = (utc: string) => hourOnGrid(realGrid, utc) ?? -1;
const n = (key: string) => Number(realExamples[key]);
const month = () => {
  const range = resolveTimeRange(oneMonth("{{example.l1.example_utc}}"), realExamples, realGrid);
  if (!range || "missing" in range) throw new Error("the story month does not resolve");
  return range;
};

describe("lesson 2 step 1: the Lander's eye at the step's hour, at the step's site", () => {
  const site = realSite(String(realExamples["l2.site_id"]));
  const at = hour(String(realExamples["l2.example_utc"]));
  const moment = horizonMoment(site.series, at);

  it("the Sun on the picture is the Sun the text quotes: its elevation, and no disc showing", () => {
    expect(moment.sun?.elDeg.toFixed(2)).toBe(n("l2.sun_el_deg").toFixed(2));
    expect(moment.sun?.frac).toBe(n("l2.sun_frac"));
  });

  it("the skyline under the Sun is the ridge the text quotes, above the Sun", () => {
    if (!moment.sun) throw new Error("no Sun");
    const ridge = skylineReading(site.skyline, moment.sun.azDeg, []);
    expect(ridge.elDeg).toBeCloseTo(n("l2.ridge_el_deg"), 2);
    expect(ridge.elDeg).toBeGreaterThan(moment.sun.elDeg);
  });
});

describe("lesson 1 step 3: the System view over the story month", () => {
  const manifest = JSON.parse(readFileSync(`${repoRoot}data/derived/manifest.json`, "utf8")) as Manifest;
  const system = decodeSystem(bytes("derived/system.bin"), parseManifest(manifest).time_grid.count, "system.bin");
  const range = month();

  it("the Sun's direction goes all the way round over the month, as the answer says", () => {
    expect(sunTurnDeg(system, range)).toBeGreaterThanOrEqual(360);
  });

  it("each drawn direction is the stored sub-solar longitude; Earth sits at the System view's schematic distance", () => {
    const frame = systemFrame(system, range.fromIndex);
    if (!frame) throw new Error("no frame");
    const lon = system.subsolar_lon[range.fromIndex] ?? Number.NaN;
    expect(frame.sunAngleDeg).toBeCloseTo(((lon % 360) + 360) % 360, 6);
    // About three Moon radii out, as proportions.ts draws Earth.
    expect(frame.earthDistance).toBeGreaterThan(2.8);
    expect(frame.earthDistance).toBeLessThan(3.1);
    const frames = systemFrames(system, range);
    expect(frames[0]?.hour).toBe(range.fromIndex);
    expect(frames[frames.length - 1]?.hour).toBe(range.toIndex);
  });
});

describe("lesson 4 step 3: the month's bands at the story site", () => {
  const site = realSite("connecting_ridge");
  const range = month();
  const bands = monthBands(site.series, hourFlags(site.series, pipProfile), range);

  it("Earth is in Pip's sky for l4.earth_up_pct of the 720 hours, as the caption says", () => {
    expect(bands.hours).toBe(720);
    expect(((100 * bands.earthUpHours) / bands.hours).toFixed(2)).toBe(n("l4.earth_up_pct").toFixed(2));
  });

  it("the bands are the timeline's segments: they cover exactly the counted hours", () => {
    const covered = (segments: { from: number; to: number }[]) => segments.reduce((sum, s) => sum + s.to - s.from, 0);
    expect(covered(bands.earth)).toBe(bands.earthUpHours);
    expect(covered(bands.sun)).toBe(bands.litHours);
    for (const segment of [...bands.earth, ...bands.sun]) {
      expect(segment.from).toBeGreaterThanOrEqual(range.fromIndex);
      expect(segment.to).toBeLessThanOrEqual(range.toIndex + 1);
      expect(segment.inWindow).toBe(true);
    }
  });
});

describe("the shared fixture", () => {
  const fixtures = JSON.parse(readFileSync(`${repoRoot}data/fixtures/academy/worked_examples.json`, "utf8")) as Record<string, unknown>;
  const manifest = parseManifest(JSON.parse(readFileSync(`${repoRoot}data/fixtures/manifest.json`, "utf8")) as Manifest);

  it("resolves the story month, so the month's lessons play in fixtures mode", () => {
    const range = resolveTimeRange(oneMonth("{{example.l1.example_utc}}"), fixtures, manifest.time_grid);
    expect(range).toEqual({ fromIndex: hourOnGrid(manifest.time_grid, String(fixtures["story.landing_utc"])), toIndex: (range as { fromIndex: number }).fromIndex + 719 });
  });

  it("draws the System view from the fixture's system.bin", () => {
    const system = decodeSystem(bytes("fixtures/system.bin"), manifest.time_grid.count, "system.bin");
    expect(systemFrame(system, 0)).not.toBeNull();
  });
});
