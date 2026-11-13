import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { MissionProfile } from "../../contracts/generated.ts";
import { decodeSeriesFile, type SeriesColumnEncoding } from "./__fixtures__/decodeSeries";
import { evaluate, evaluationsAtUtcMidnight, siteSlopeDeg, slipSweep, type Evaluation } from "./index";
import { dayToHour, hourToDay, nextGoDay, type DayResult } from "./next-go";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../../../../data/fixtures");

/** The shared fixture: one full-grid site and the IM-2 Athena preset. */
function fixtureRows(siteId: string, profileId: string): { rows: Array<Evaluation | null>; slope: number | null } {
  const binPath = path.join(fixtures, "sites", siteId, "series.bin");
  const meta = JSON.parse(readFileSync(path.join(path.dirname(binPath), "meta.json"), "utf8")) as {
    series: { columns: SeriesColumnEncoding[] };
  };
  const series = decodeSeriesFile(binPath, meta.series.columns);
  const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
  const sites = JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as { id: string; slope: { deg: number } | null }[];
  const profile = profiles.find((p) => p.id === profileId)!;
  const slope = siteSlopeDeg(sites, siteId);
  return { rows: evaluationsAtUtcMidnight(slipSweep(series, profile, slope), profile), slope };
}

const { rows } = fixtureRows("fixture_ridge", "im2_athena");
const goDays = rows.flatMap((row, day) => (row?.status === "GO" ? [day] : []));

describe("nextGoDay on the shared fixture", () => {
  it("has GO days to find, and days at the end whose window does not fit", () => {
    expect(goDays.length).toBeGreaterThan(1);
    expect(rows.at(-1)).toBeNull();
  });

  it("finds the first GO day after a day that is not GO", () => {
    expect(nextGoDay(rows, 0)).toBe(goDays[0]);
    const notGo = rows.findIndex((row, day) => day > goDays[0]! && row?.status !== "GO");
    const expected = goDays.find((day) => day > notGo)!;
    expect(expected).toBeGreaterThan(notGo);
    expect(nextGoDay(rows, notGo)).toBe(expected);
    for (let day = notGo; day < expected; day++) expect(rows[day]?.status).not.toBe("GO");
  });

  it("returns the day itself when it is GO", () => {
    for (const day of goDays.slice(0, 5)) expect(nextGoDay(rows, day)).toBe(day);
  });

  it("returns null when there is no GO before the end of the time grid", () => {
    const last = goDays.at(-1)!;
    expect(nextGoDay(rows, last + 1)).toBeNull();
    expect(nextGoDay(rows, rows.length)).toBeNull();
  });

  it("reads the last day: null there, since the last window does not fit", () => {
    expect(nextGoDay(rows, rows.length - 1)).toBeNull();
  });

  it("agrees with a single evaluation at 00:00 UTC on the day it returns", () => {
    const binPath = path.join(fixtures, "sites", "fixture_ridge", "series.bin");
    const meta = JSON.parse(readFileSync(path.join(path.dirname(binPath), "meta.json"), "utf8")) as {
      series: { columns: SeriesColumnEncoding[] };
    };
    const series = decodeSeriesFile(binPath, meta.series.columns);
    const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
    const profile = profiles.find((p) => p.id === "im2_athena")!;
    const day = nextGoDay(rows, 100)!;
    expect(day).not.toBeNull();
    const slope = fixtureRows("fixture_ridge", "im2_athena").slope;
    expect(evaluate(series, profile, dayToHour(day), slope)?.status).toBe("GO");
  });
});

describe("nextGoDay on small inputs", () => {
  const go: DayResult = { status: "GO" };
  const caution: DayResult = { status: "CAUTION" };
  const nogo: DayResult = { status: "NO-GO" };

  it("skips CAUTION, NO-GO and days with no result", () => {
    expect(nextGoDay([nogo, caution, null, go, go], 0)).toBe(3);
  });

  it("finds a GO on the last day", () => {
    expect(nextGoDay([nogo, nogo, go], 1)).toBe(2);
    expect(nextGoDay([nogo, nogo, go], 2)).toBe(2);
  });

  it("returns null for an empty result or a start past its end", () => {
    expect(nextGoDay([], 0)).toBeNull();
    expect(nextGoDay([go], 1)).toBeNull();
    expect(nextGoDay([go], Number.NaN)).toBeNull();
  });

  it("never looks before the day it starts from", () => {
    expect(nextGoDay([go, nogo, go], -4)).toBe(0);
    expect(nextGoDay([go, nogo, go], 0.5)).toBe(2);
  });

  it("maps days to 00:00 UTC hours and back", () => {
    expect(dayToHour(3)).toBe(72);
    expect(hourToDay(72)).toBe(3);
    expect(hourToDay(95)).toBe(3);
  });
});
