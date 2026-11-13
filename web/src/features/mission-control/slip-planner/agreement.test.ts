import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile, Sites } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index";
import { cachedEvaluation, evaluationsAtUtcMidnight, siteSlopeDeg, slipSweep } from "../../../lib/scoring";
import { DAY_GO, cachedSlipDays, codeStatus, statusCode, vetoMaskOf, type SlipDays } from "../../../lib/scoring/slip-days";
import { nextGo, nextGoWords } from "./next-go-words";
import { utcToHourIndex } from "../../../lib/time";
import { anySiteDays, dayOfHour, isWholeDay, rank } from "./model";
import { siteReadout } from "./readout";
import { StripCanvas, type StripContext } from "./strips-canvas";
import { resultAt, type SiteDays } from "./use-slip-days";

/**
 * The Slip Planner's "Done when" agreement (docs/features/slip-planner.md): for every
 * selected fixture site and a spread of dates, the spot, the strip, the hover readout and the
 * sites rail say the same thing. The spot reads `resultAt` (the sweep at the landing hour), the
 * strip reads the day table, the hover builds its words from `resultAt` at the day's 00:00,
 * and the sites rail reads `cachedEvaluation` (what `useEvaluation` returns).
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const manifest = JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest;
const sites = JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as Sites;
const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
const grid = manifest.time_grid;

function loadSeries(siteId: string) {
  const bytes = readFileSync(path.join(fixtures, "sites", siteId, "series.bin"));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return decodeSeries(copy, SERIES_COLUMNS, grid.count, "series.bin");
}

const seriesById = new Map(sites.map((site) => [site.id, loadSeries(site.id)]));

function entryFor(siteId: string, profile: MissionProfile): SiteDays {
  const series = seriesById.get(siteId)!;
  const sweep = slipSweep(series, profile, siteSlopeDeg(sites, siteId));
  return { siteId, state: "ready", days: cachedSlipDays(sweep, profile), sweep, profile, stale: false, error: null };
}

const chosen = ["im2_athena", "viper"].map((id) => profiles.find((p) => p.id === id)!).filter(Boolean);
const entries = new Map(chosen.map((profile) => [profile.id, sites.map((site) => entryFor(site.id, profile))]));

/** A spread of landing days: the start, every 37th day, and the last days, where windows run off the grid. */
const lastDay = Math.floor((grid.count - 1) / 24);
const days = [0, 1, ...Array.from({ length: 60 }, (_, i) => i * 37), lastDay - 12, lastDay - 9, lastDay - 1, lastDay].filter(
  (d, i, all) => d >= 0 && d <= lastDay && all.indexOf(d) === i,
);

describe("the spot, the strip, the hover and the sites rail agree", () => {
  for (const profile of chosen) {
    for (const site of sites) {
      it(`${profile.id}, ${site.id}: every landing at 00:00 UTC`, () => {
        const entry = entries.get(profile.id)!.find((e) => e.siteId === site.id)!;
        const series = seriesById.get(site.id)!;
        const slope = siteSlopeDeg(sites, site.id);
        for (const day of days) {
          const hour = day * 24;
          const spot = resultAt(entry, hour);
          const strip = entry.days!.status[day]!;
          const hover = siteReadout(site.name, "when", spot, profile);
          const rail = cachedEvaluation(site.id, series, profile, hour, slope);
          if (rail === null) {
            expect(spot.kind).toBe("none");
            expect(strip).toBe(0);
            expect(hover.status).toBeNull();
            continue;
          }
          expect(spot.kind).toBe("ready");
          if (spot.kind !== "ready") continue;
          expect(spot.evaluation.status).toBe(rail.status);
          expect(spot.evaluation.score).toBeCloseTo(rail.score, 9);
          expect(codeStatus(strip)).toBe(rail.status);
          expect(entry.days!.score[day]).toBeCloseTo(rail.score, 3);
          expect(entry.days!.vetoMask[day]).toBe(vetoMaskOf(rail));
          expect(hover.status).toBe(rail.status);
        }
      });
    }
  }

  it("the day table is the sweep's own 00:00 UTC rows", () => {
    const profile = chosen[0]!;
    const entry = entries.get(profile.id)![0]!;
    const rows = evaluationsAtUtcMidnight(entry.sweep!, profile);
    expect(rows.length).toBe(entry.days!.dayCount);
    rows.forEach((row, day) => expect(entry.days!.status[day]).toBe(statusCode(row?.status ?? null)));
  });
});

describe("the whole-days rule", () => {
  it("with a landing at another hour, the spot equals the sites rail at that exact hour", () => {
    for (const profile of chosen) {
      for (const site of sites) {
        const entry = entries.get(profile.id)!.find((e) => e.siteId === site.id)!;
        const series = seriesById.get(site.id)!;
        for (const hour of [13, 24 * 400 + 7, 24 * 1000 + 15, 24 * 1500 + 23]) {
          expect(isWholeDay(hour)).toBe(false);
          const spot = resultAt(entry, hour);
          const rail = cachedEvaluation(site.id, series, profile, hour, siteSlopeDeg(sites, site.id));
          expect(spot.kind === "ready" ? spot.evaluation.status : null).toBe(rail?.status ?? null);
          // The slider and the strips sit on the landing's day, at its 00:00 UTC row.
          expect(dayOfHour(hour)).toBe(Math.floor(hour / 24));
        }
      }
    }
  });

  it("a landing on the hour grid parses to the day it falls on", () => {
    expect(dayOfHour(utcToHourIndex(grid, "2028-03-01T00:00:00Z"))).toBe(790);
    expect(dayOfHour(utcToHourIndex(grid, "2028-03-01T17:00:00Z"))).toBe(790);
    expect(isWholeDay(utcToHourIndex(grid, "2028-03-01T00:00:00Z"))).toBe(true);
  });
});

describe("Any site and next GO on the fixture", () => {
  it("Any site is the best status among the sites on every day", () => {
    const list = entries.get(chosen[0]!.id)!;
    const any = anySiteDays(list.map((e) => e.days), list[0]!.days!.dayCount);
    for (const day of days) {
      const best = Math.max(...list.map((e) => rank(e.days!.status[day]!)));
      expect(rank(any[day]!)).toBe(best);
    }
  });

  it("next GO is the first GO day at or after the landing day, in words", () => {
    const start = Date.parse(grid.start_utc);
    for (const entry of entries.get(chosen[0]!.id)!) {
      const status = entry.days!.status;
      for (const from of [0, 400, 1200, lastDay]) {
        const next = nextGo(entry.days!, from);
        if (next === null) {
          for (let d = from; d < status.length; d += 1) expect(status[d]).not.toBe(DAY_GO);
          expect(nextGoWords(next, from, start, 2031)).toBe("no GO before 2032");
        } else {
          expect(status[next]).toBe(DAY_GO);
          for (let d = from; d < next; d += 1) expect(status[d]).not.toBe(DAY_GO);
          const words = nextGoWords(next, from, start, 2031);
          expect(words).toBe(next === from ? "GO on this date" : words);
          if (next !== from) expect(words.startsWith("next GO ")).toBe(true);
        }
      }
    }
  });
});

/** A canvas context that only counts. */
function countingContext(): StripContext & { fills: number } {
  const ctx = {
    fills: 0,
    fillStyle: "",
    globalAlpha: 1,
    setTransform() {},
    clearRect() {},
    fillRect() {
      ctx.fills += 1;
    },
    beginPath() {},
    save() {},
    restore() {},
    clip() {},
    rect() {},
  };
  return ctx as unknown as StripContext & { fills: number };
}

describe("moving the landing date is cheap", () => {
  it("dragging across days never rebuilds the day table and draws the canvas at most once per change", () => {
    const profile = chosen[0]!;
    const list = entries.get(profile.id)!;
    const tables: SlipDays[] = list.map((e) => e.days!);
    const ctx = countingContext();
    const strips = new StripCanvas();
    const colours = { plot: "a", go: "b", caution: "c", nogo: "d", none: "e", pending: "f" };
    const rows = tables.map((t) => t.status);
    let starts = new Set<number>();
    // A drag over 120 landing days, with the visible range following the landing day.
    let start: number | null = null;
    for (let day = 800; day < 920; day += 1) {
      // What the panel and the spots read on each change: another entry of the same arrays.
      for (const entry of list) {
        expect(cachedSlipDays(entry.sweep!, profile)).toBe(entry.days); // no rebuild, no new sweep
        resultAt(entry, day * 24);
        nextGo(entry.days!, day);
      }
      const span = 548;
      const fresh = Math.max(0, day - Math.round(span * 0.25));
      start = start === null || day < start + span * 0.04 || day > start + span * 0.86 ? fresh : start;
      starts = new Set([...starts, start]);
      strips.update(ctx, { rows, start, span, width: 800, rowHeight: 14, gap: 7, dpr: 1, colours });
    }
    // One draw for each visible range shown, never one per day dragged.
    expect(strips.draws).toBe(starts.size);
    expect(strips.draws).toBeLessThan(5);
  });

  it("a new sweep or a new range draws again", () => {
    const ctx = countingContext();
    const strips = new StripCanvas();
    const colours = { plot: "a", go: "b", caution: "c", nogo: "d", none: "e", pending: "f" };
    const a = new Uint8Array(100);
    const frame = { rows: [a], start: 0, span: 50, width: 400, rowHeight: 14, gap: 7, dpr: 1, colours };
    expect(strips.update(ctx, frame)).toBe(true);
    expect(strips.update(ctx, { ...frame })).toBe(false);
    expect(strips.update(ctx, { ...frame, rows: [new Uint8Array(100)] })).toBe(true);
    expect(strips.update(ctx, { ...frame, start: 10 })).toBe(true);
    expect(strips.draws).toBe(3);
  });
});
