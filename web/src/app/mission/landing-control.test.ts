import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest } from "../../contracts/generated";
import type { DayResult } from "../../lib/scoring";
import { dayText, endReasons, gridEndYear, movedText, nextGoView, noGoText, searchFromDay, undoneText, windowEnd } from "./landing-control";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const grid = (JSON.parse(readFileSync(path.join(repoRoot, "data", "fixtures", "manifest.json"), "utf8")) as Manifest).time_grid;

const GO: DayResult = { status: "GO" };
const NOGO: DayResult = { status: "NO-GO" };
const CAUTION: DayResult = { status: "CAUTION" };

/** A day of the grid at 00:00 UTC, as the sweep lists them. */
function dayOf(utc: string): number {
  return (Date.parse(utc) - Date.parse(grid.start_utc)) / 86_400_000;
}

/** One result per grid day, NO-GO except the days given. */
function days(go: string[] = [], caution: string[] = []): DayResult[] {
  const count = Math.floor((grid.count - 1) / 24) + 1;
  const rows: DayResult[] = Array.from({ length: count }, () => NOGO);
  for (const utc of go) rows[dayOf(utc)] = GO;
  for (const utc of caution) rows[dayOf(utc)] = CAUTION;
  return rows;
}

const base = { siteId: "connecting_ridge", siteName: "Connecting Ridge", grid, landingUtc: "2028-03-01T00:00:00Z" };

describe("the Next GO button's states", () => {
  it("is not shown when no site is focused", () => {
    expect(nextGoView({ ...base, siteId: null, days: { status: "ready", data: days(), error: null } })).toEqual({ kind: "hidden" });
  });

  it("shows it is working while the sweep runs", () => {
    const view = nextGoView({ ...base, days: { status: "loading", data: null, error: null } });
    expect(view.kind).toBe("working");
    expect(view.kind === "working" && view.description).toBe("Working out the GO dates for Connecting Ridge…");
  });

  it("says why when the sweep fails", () => {
    const view = nextGoView({ ...base, days: { status: "error", data: null, error: "no series" } });
    expect(view).toEqual({ kind: "error", description: "The GO dates for Connecting Ridge could not be worked out: no series" });
  });

  it("moves to 00:00 UTC on the next GO day, skipping CAUTION", () => {
    const view = nextGoView({ ...base, days: { status: "ready", data: days(["2028-03-14T00:00:00Z"], ["2028-03-05T00:00:00Z"]), error: null } });
    expect(view.kind).toBe("ready");
    if (view.kind !== "ready") return;
    expect(view.targetUtc).toBe("2028-03-14T00:00:00Z");
    expect(view.description).toContain("00:00 UTC on 14 Mar 2028");
  });

  it("searches from the day after the landing date: today being GO does not count", () => {
    const rows = days(["2028-03-01T00:00:00Z", "2028-03-20T00:00:00Z"]);
    const view = nextGoView({ ...base, landingUtc: "2028-03-01T00:00:00Z", days: { status: "ready", data: rows, error: null } });
    expect(view.kind === "ready" && view.targetUtc).toBe("2028-03-20T00:00:00Z");
    // A landing later on a GO day still looks from the next day.
    const later = nextGoView({ ...base, landingUtc: "2028-03-01T18:00:00Z", days: { status: "ready", data: rows, error: null } });
    expect(later.kind === "ready" && later.targetUtc).toBe("2028-03-20T00:00:00Z");
    expect(searchFromDay(grid, "2028-03-01T18:00:00Z")).toBe(dayOf("2028-03-02T00:00:00Z"));
  });

  it("says there is no later GO date, from the grid's real end, and offers no button", () => {
    const view = nextGoView({ ...base, days: { status: "ready", data: days(["2028-02-01T00:00:00Z"]), error: null } });
    expect(view.kind).toBe("none");
    expect(view.kind === "none" && view.text).toBe("No later GO before 2032");
  });
});

describe("the landing-date words", () => {
  it("names days as on the timeline's axis", () => {
    expect(dayText("2028-03-14T00:00:00Z")).toBe("14 Mar 2028");
  });

  it("finds the year the time grid ends before", () => {
    expect(gridEndYear(grid)).toBe(2032);
    expect(noGoText(grid)).toBe("No later GO before 2032");
  });

  it("confirms a jump and an undo in plain words", () => {
    expect(movedText("2028-03-14T00:00:00Z", "Connecting Ridge")).toBe("Landing moved to 14 Mar 2028, the next GO date for Connecting Ridge.");
    expect(undoneText("2028-03-01T00:00:00Z")).toBe("Landing moved back to 01 Mar 2028.");
  });
});

describe("the mission window's end", () => {
  it("is the landing plus the window's hours, the first hour after the window", () => {
    expect(windowEnd("2028-03-01T00:00:00Z", 10)).toEqual({ utc: "2028-03-11T00:00:00Z", day: "11 Mar", time: "00:00", long: "11 Mar 2028 00:00 UTC" });
  });

  it("carries the year when the window crosses into the next one", () => {
    expect(windowEnd("2028-12-28T06:00:00Z", 10)?.day).toBe("07 Jan 2029");
  });

  it("keeps the time for a window that is not whole days", () => {
    expect(windowEnd("2028-03-01T00:00:00Z", 6.5)?.time).toBe("12:00");
  });

  it("is null for a landing that is not a time", () => {
    expect(windowEnd("soon", 10)).toBeNull();
  });
});

describe("why the landing cannot move past an end of the grid", () => {
  it("names the grid's first hour and the last landing whose window fits", () => {
    const last = grid.count - 240;
    const reasons = endReasons(grid, 10, last);
    expect(reasons.first).toBe("The data starts at 2026-01-01 00:00 UTC, so the landing cannot be earlier.");
    expect(reasons.last.replace(/ /g, " ")).toBe("A 10 d mission cannot land later than 2031-12-22 00:00 UTC: its window must end inside the data.");
  });
});
