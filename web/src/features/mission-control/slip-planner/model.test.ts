import { describe, expect, it } from "vitest";
import type { Site } from "../../../contracts/generated";
import type { Evaluation } from "../../../lib/scoring";
import { DAY_CAUTION, DAY_GO, DAY_NOGO, DAY_NONE } from "../../../lib/scoring/slip-days";
import { anyReadout } from "./readout";
import { nextGo, nextGoWords } from "./next-go-words";
import { MOON_RADIUS_M } from "../../../lib/geo";
import { flatProjection } from "./flat";
import {
  DAY_PENDING,
  anyNextGo,
  anySiteDays,
  bestSite,
  dayAtX,
  dayUtc,
  followStart,
  isWholeDay,
  lastLandingDay,
  markRect,
  metresApart,
  offViewWhere,
  panStart,
  signedDays,
  sliderKey,
  slipSummary,
  spotPriority,
  stripKey,
  stripMetrics,
  variantLine,
  variantOf,
  zoomDays,
  type SiteResult,
} from "./model";
import { overlaps, placeLabels, placeSpots, SPOT_MIN_PX, type SpotInput } from "./placement";
import { comparisonHour, createSlipStore } from "./slip-store";

const GRID_START = Date.parse("2026-01-01T00:00:00Z");

function evaluation(status: "GO" | "CAUTION" | "NO-GO", score: number): SiteResult {
  return { kind: "ready", evaluation: { status, score } as unknown as Evaluation };
}

describe("Any site", () => {
  it("is the best status among the sites on each day", () => {
    const a = { status: new Uint8Array([DAY_NOGO, DAY_CAUTION, DAY_NOGO, DAY_NONE, DAY_GO]) };
    const b = { status: new Uint8Array([DAY_NOGO, DAY_NOGO, DAY_GO, DAY_NONE, DAY_NOGO]) };
    expect([...anySiteDays([a, b], 5)]).toEqual([DAY_NOGO, DAY_CAUTION, DAY_GO, DAY_NONE, DAY_GO]);
  });

  it("is GO as soon as a known site is GO; anything else waits for every site", () => {
    // Day 0: one site CAUTION, one computing: not yet known, so pending, never CAUTION.
    // Day 1: one site GO: GO whatever the other turns out to be.
    const a = { status: new Uint8Array([DAY_CAUTION, DAY_GO, DAY_NOGO]) };
    expect([...anySiteDays([a, "pending"], 3)]).toEqual([DAY_PENDING, DAY_GO, DAY_PENDING]);
  });

  it("leaves a failed site out and works from the others", () => {
    const a = { status: new Uint8Array([DAY_CAUTION, DAY_NOGO]) };
    expect([...anySiteDays([a, "failed"], 2)]).toEqual([DAY_CAUTION, DAY_NOGO]);
    expect([...anySiteDays(["failed"], 2)]).toEqual([DAY_NONE, DAY_NONE]);
  });

  it("next GO is final only when no earlier day is still computing", () => {
    expect(anyNextGo([DAY_NOGO, DAY_GO, DAY_PENDING], 0)).toBe(1);
    expect(anyNextGo([DAY_NOGO, DAY_PENDING, DAY_GO], 0)).toBe("computing");
    expect(anyNextGo([DAY_GO, DAY_PENDING], 0)).toBe(0);
    expect(anyNextGo([DAY_NOGO, DAY_CAUTION], 0)).toBeNull();
    expect(anyNextGo([DAY_NOGO, DAY_PENDING], 0)).toBe("computing");
  });

  it("the readout follows the same rule as the mark", () => {
    const go = evaluation("GO", 91);
    const caution = evaluation("CAUTION", 60);
    const nogo = evaluation("NO-GO", 10);
    const pending: SiteResult = { kind: "pending" };
    const failed: SiteResult = { kind: "failed" };
    const site = (name: string, result: SiteResult) => ({ siteId: name, name, result });

    // A known GO with another site computing: GO, and it says the rest are computing.
    const early = anyReadout("d", [site("A", go), site("B", pending), site("C", pending)]);
    expect(early.status).toBe("GO");
    expect(early.lines).toEqual(["GO: A. 2 more still computing."]);

    // CAUTION known, another computing: no status yet, never CAUTION.
    const waiting = anyReadout("d", [site("A", caution), site("B", pending)]);
    expect(waiting.status).toBeNull();
    expect(waiting.lines[0]).toBe("Still computing 1 of 2 sites.");

    // Every site known: the best status.
    expect(anyReadout("d", [site("A", caution), site("B", nogo)]).status).toBe("CAUTION");
    expect(anyReadout("d", [site("A", nogo), site("B", nogo)]).status).toBe("NO-GO");

    // A failed site is left out, and the readout says so.
    const missing = anyReadout("d", [site("A", caution), site("B", failed)]);
    expect(missing.status).toBe("CAUTION");
    expect(missing.lines).toContain("B could not be computed, so it is left out.");
  });

  it("with every date NO-GO shows no GO either", () => {
    const a = { status: new Uint8Array(30).fill(DAY_NOGO) };
    const any = anySiteDays([a], 30);
    expect([...any].every((c) => c === DAY_NOGO)).toBe(true);
    expect(nextGo(a, 0)).toBeNull();
    expect(nextGoWords(null, 0, GRID_START, 2031)).toBe("no GO before 2032");
  });
});

describe("strip marks: status by height as well as colour", () => {
  it("GO full, CAUTION half, NO-GO a low line, no data a faint 1 px line", () => {
    expect(markRect(DAY_GO, 14)).toEqual({ y: 0, h: 14 });
    expect(markRect(DAY_CAUTION, 14)).toEqual({ y: 7, h: 7 });
    expect(markRect(DAY_NOGO, 14)).toEqual({ y: 14 - 2.4, h: 2.4 });
    expect(markRect(DAY_NONE, 14)).toEqual({ y: 6.5, h: 1 });
    // Every status a different height, so no two read the same without colour.
    const heights = [DAY_GO, DAY_CAUTION, DAY_NOGO, DAY_NONE].map((c) => markRect(c, 12).h);
    expect(new Set(heights).size).toBe(4);
  });

  it("strips are 14 px with 7 px gaps, 12 and 5 with seven or eight sites, 18 with one", () => {
    expect(stripMetrics(4, false)).toEqual({ height: 14, gap: 7 });
    expect(stripMetrics(7, false)).toEqual({ height: 12, gap: 5 });
    expect(stripMetrics(8, false)).toEqual({ height: 12, gap: 5 });
    expect(stripMetrics(1, false)).toEqual({ height: 18, gap: 7 });
  });
});

describe("next GO", () => {
  const status = new Uint8Array([DAY_NOGO, DAY_CAUTION, DAY_GO, DAY_NOGO, DAY_GO]);
  it("is the first GO on or after the day", () => {
    expect(nextGo({ status }, 0)).toBe(2);
    expect(nextGo({ status }, 2)).toBe(2);
    expect(nextGo({ status }, 3)).toBe(4);
    expect(nextGo({ status }, 5)).toBeNull();
  });

  it("says so in words, with the year only when it changes", () => {
    const mar1 = 790; // 2028-03-01
    expect(nextGoWords(mar1, mar1, GRID_START, 2031)).toBe("GO on this date");
    expect(nextGoWords(mar1 + 21, mar1, GRID_START, 2031)).toBe("next GO 22 Mar");
    expect(nextGoWords(mar1 + 320, mar1, GRID_START, 2031)).toBe("next GO 15 Jan 2029"); // 2028 is a leap year
  });
});

describe("days, zoom and the visible range", () => {
  it("zooms to 3 months, 18 months or the whole time grid", () => {
    expect(zoomDays("3m", 2191)).toBe(91);
    expect(zoomDays("18m", 2191)).toBe(548);
    expect(zoomDays("6y", 2191)).toBe(2191);
  });

  it("follows the landing day, and stays put while it moves inside", () => {
    expect(followStart(null, 548, 790, 2191)).toBe(790 - 137);
    expect(followStart(700, 548, 790, 2191)).toBe(700);
    expect(followStart(700, 548, 700 + 500, 2191)).toBe(1200 - 137);
    expect(followStart(null, 548, 2190, 2191)).toBe(2191 - 548);
    expect(followStart(123, 2191, 900, 2191)).toBe(0);
  });

  it("pans by scroll within the time grid", () => {
    expect(panStart(100, 548, 1, 2191)).toBe(144);
    expect(panStart(10, 548, -1, 2191)).toBe(0);
  });

  it("finds the day under the pointer and its 00:00 UTC landing", () => {
    expect(dayAtX(0, 800, 100, 400)).toBe(100);
    expect(dayAtX(400, 800, 100, 400)).toBe(300);
    expect(dayUtc(GRID_START, 790)).toBe("2028-03-01T00:00:00Z");
    expect(isWholeDay(790 * 24)).toBe(true);
    expect(isWholeDay(790 * 24 + 5)).toBe(false);
  });

  it("ends at the last day whose mission window fits", () => {
    expect(lastLandingDay(52_584, 240)).toBe(Math.floor((52_584 - 240) / 24));
  });
});

describe("keyboard use", () => {
  const last = 2180;
  it("the slider: arrows a day, Shift a week, Page Up and Down 30 days, Home and End the ends", () => {
    expect(sliderKey("ArrowRight", false, 100, last)).toBe(101);
    expect(sliderKey("ArrowLeft", false, 100, last)).toBe(99);
    expect(sliderKey("ArrowRight", true, 100, last)).toBe(107);
    expect(sliderKey("ArrowLeft", true, 100, last)).toBe(93);
    expect(sliderKey("PageUp", false, 100, last)).toBe(130);
    expect(sliderKey("PageDown", false, 100, last)).toBe(70);
    expect(sliderKey("Home", false, 100, last)).toBe(0);
    expect(sliderKey("End", false, 100, last)).toBe(last);
    expect(sliderKey("PageDown", false, 10, last)).toBe(0);
    expect(sliderKey("ArrowRight", true, last - 2, last)).toBe(last);
    expect(sliderKey("a", false, 100, last)).toBeNull();
  });

  it("a strip's reading point: arrows and pages; Home, End and up and down are not its keys", () => {
    expect(stripKey("ArrowRight", false, 100, last)).toBe(101);
    expect(stripKey("ArrowLeft", true, 100, last)).toBe(93);
    expect(stripKey("PageUp", false, 100, last)).toBe(130);
    expect(stripKey("Home", false, 100, last)).toBeNull();
    expect(stripKey("ArrowUp", false, 100, last)).toBeNull();
  });
});

describe("before and after a slip", () => {
  it("is shown only after the first change of date, and the cross clears it", () => {
    const store = createSlipStore();
    store.getState().observeLanding(1000);
    expect(comparisonHour(store.getState(), 1000)).toBeNull();
    store.getState().observeLanding(1000 + 21 * 24);
    expect(comparisonHour(store.getState(), 1000 + 21 * 24)).toBe(1000);
    // Later moves keep comparing with the first date.
    store.getState().observeLanding(1000 + 30 * 24);
    expect(comparisonHour(store.getState(), 1000 + 30 * 24)).toBe(1000);
    // Back on the first date: nothing to compare.
    expect(comparisonHour(store.getState(), 1000)).toBeNull();
    store.getState().clearComparison(1720);
    expect(comparisonHour(store.getState(), 1720)).toBeNull();
    store.getState().observeLanding(1744);
    expect(comparisonHour(store.getState(), 1744)).toBe(1720);
    store.getState().leave();
    expect(store.getState().fromHour).toBeNull();
  });

  it("the summary line names the slip, the changes and the best site", () => {
    const from = 790 * 24;
    const to = (790 + 21) * 24;
    const text = slipSummary({
      fromHour: from,
      toHour: to,
      gridStartMs: GRID_START,
      scoreText: (s) => String(Math.floor(s)),
      sites: [
        { siteId: "cr", name: "Connecting Ridge", before: evaluation("NO-GO", 40), after: evaluation("GO", 88) },
        { siteId: "mm", name: "Malapert Massif", before: evaluation("GO", 90), after: evaluation("CAUTION", 60) },
        { siteId: "mo", name: "Mons Mouton", before: evaluation("CAUTION", 65), after: evaluation("GO", 99.4) },
        { siteId: "dg", name: "de Gerlache Rim 2", before: evaluation("CAUTION", 60), after: evaluation("NO-GO", 30) },
        { siteId: "sr", name: "Shackleton rim", before: evaluation("NO-GO", 10), after: evaluation("NO-GO", 12) },
      ],
    });
    expect(text).toBe(
      "Slipped +21 d, 01 Mar → 22 Mar 2028. 4 of 5 sites changed. Best now: Mons Mouton, GO, score 99 (was Malapert Massif).",
    );
  });

  it("stays blank until every result is known", () => {
    const text = slipSummary({
      fromHour: 0,
      toHour: 24,
      gridStartMs: GRID_START,
      scoreText: String,
      sites: [{ siteId: "a", name: "A", before: { kind: "pending" }, after: evaluation("GO", 80) }],
    });
    expect(text).toBeNull();
  });

  it("uses a true minus sign for an earlier date", () => {
    expect(signedDays(-3)).toBe("−3 d");
    expect(signedDays(7)).toBe("+7 d");
  });

  it("never calls a NO-GO site best", () => {
    expect(bestSite([{ siteId: "a", result: evaluation("NO-GO", 99) }])).toBeNull();
    expect(bestSite([{ siteId: "a", result: evaluation("CAUTION", 99) }, { siteId: "b", result: evaluation("GO", 71) }])?.siteId).toBe("b");
  });
});

describe("close sites", () => {
  const spots: SpotInput[] = [
    { id: "focused", x: 400, y: 300, visible: true, priority: spotPriority({ focused: true, best: false, changed: false, variant: false }), variant: false },
    { id: "near", x: 412, y: 296, visible: true, priority: spotPriority({ focused: false, best: false, changed: false, variant: false }), variant: false },
    { id: "variant", x: 400.4, y: 300.2, visible: true, priority: spotPriority({ focused: false, best: false, changed: false, variant: true }), variant: true },
    { id: "far", x: 600, y: 200, visible: true, priority: 1, variant: false },
    { id: "hidden", x: 401, y: 301, visible: false, priority: 9, variant: false },
  ];

  it("spots never overlap; a displaced spot keeps its true place for the hairline and dot", () => {
    const placed = placeSpots(spots);
    const shown = placed.filter((p) => p.visible);
    for (let i = 0; i < shown.length; i += 1) {
      for (let j = i + 1; j < shown.length; j += 1) {
        expect(Math.hypot(shown[i]!.x - shown[j]!.x, shown[i]!.y - shown[j]!.y)).toBeGreaterThanOrEqual(SPOT_MIN_PX - 1e-9);
      }
    }
    const byId = new Map(placed.map((p) => [p.id, p]));
    expect(byId.get("focused")!.moved).toBe(false);
    expect(byId.get("far")!.moved).toBe(false);
    expect(byId.get("near")!.moved).toBe(true);
    expect(byId.get("near")!.ax).toBe(412);
    expect(byId.get("near")!.ay).toBe(296);
    // The variant steps 40 px or more aside; its dot stays under the focused spot.
    const variant = byId.get("variant")!;
    expect(variant.moved).toBe(true);
    expect(Math.hypot(variant.x - variant.ax, variant.y - variant.ay)).toBeGreaterThanOrEqual(39);
    expect(Math.hypot(variant.ax - 400, variant.ay - 300)).toBeLessThan(1);
    expect(byId.get("hidden")!.visible).toBe(false);
  });

  it("the phone's 44 px spots step further aside", () => {
    const placed = placeSpots(spots, 44 / 32).filter((p) => p.visible);
    for (let i = 0; i < placed.length; i += 1) {
      for (let j = i + 1; j < placed.length; j += 1) {
        expect(Math.hypot(placed[i]!.x - placed[j]!.x, placed[i]!.y - placed[j]!.y)).toBeGreaterThanOrEqual(SPOT_MIN_PX * (44 / 32) - 1e-9);
      }
    }
  });

  it("labels never overlap each other or a spot, try right, left, below and above, then a callout", () => {
    const placed = placeSpots(spots).filter((p) => p.visible);
    const bounds = { l: 0, r: 1000, t: 0, b: 800 };
    const labels = placed.map((p) => ({ id: p.id, x: p.x, y: p.y, w: 130, h: 22 }));
    const result = placeLabels(labels, placed, 15, bounds);
    const boxes = result.flatMap((r) => (r.kind === "hidden" ? [] : [r.box]));
    for (let i = 0; i < boxes.length; i += 1) {
      for (let j = i + 1; j < boxes.length; j += 1) expect(overlaps(boxes[i]!, boxes[j]!)).toBe(false);
      for (const s of placed) expect(overlaps(boxes[i]!, { l: s.x - 15, r: s.x + 15, t: s.y - 15, b: s.y + 15 })).toBe(false);
    }
    // The focused label, placed first, always finds a side.
    expect(result[0]!.kind).toBe("side");
  });

  it("with no room beside a spot, its label goes out as a callout; with no room at all, the lamp alone", () => {
    const one = [{ id: "a", x: 100, y: 100, w: 120, h: 20 }];
    const walls = [
      { x: 100, y: 100 },
      { x: 150, y: 100 },
      { x: 50, y: 100 },
      { x: 100, y: 140 },
      { x: 100, y: 60 },
    ];
    const callout = placeLabels(one, walls, 15, { l: 0, r: 400, t: 0, b: 400 });
    expect(callout[0]!.kind).toBe("callout");
    const none = placeLabels(one, walls, 15, { l: 70, r: 130, t: 70, b: 130 });
    expect(none[0]!.kind).toBe("hidden");
  });
});

describe("the best-lit variant", () => {
  const parent = { id: "connecting_ridge", name: "Connecting Ridge", lat_deg: -89.4545, lon_deg: 222.6192 } as unknown as Site;
  // A made-up variant 149 m away (the real ones may not be on main yet; decision 0012).
  const metres = 149;
  const dLat = (metres / MOON_RADIUS_M) * (180 / Math.PI);
  const variant = { id: "connecting_ridge_best_lit", name: "Connecting Ridge, best-lit", lat_deg: -89.4545 + dLat, lon_deg: 222.6192, variant_of: "connecting_ridge" } as unknown as Site;

  it("is recognised by variant_of, and says how far it is from its site", () => {
    expect(variantOf(variant)).toBe("connecting_ridge");
    expect(variantOf(parent)).toBeNull();
    expect(Math.round(metresApart(variant, parent, MOON_RADIUS_M))).toBe(149);
    expect(variantLine(metresApart(variant, parent, MOON_RADIUS_M), parent.name)).toBe("Best-lit variant, 149 m from Connecting Ridge");
  });

  it("comes last in the spots' priority", () => {
    expect(spotPriority({ focused: false, best: false, changed: false, variant: true })).toBeLessThan(
      spotPriority({ focused: false, best: false, changed: false, variant: false }),
    );
    expect(spotPriority({ focused: true, best: false, changed: false, variant: false })).toBeGreaterThan(
      spotPriority({ focused: false, best: true, changed: true, variant: false }),
    );
  });
});

describe("sites outside the view and the flat fallback", () => {
  it("says where an off-view site is", () => {
    expect(offViewWhere(0.67)).toBe("near the equator");
    expect(offViewWhere(-69.4)).toBe("at 69°S");
  });

  it("with 3D off, every site with 16 km around it fits the free space, north up", () => {
    const space = { x: 272, y: 120, width: 824, height: 520, viewport: { width: 1440, height: 900 }, windowOpen: false };
    const sites = [
      { latDeg: -89.45, lonDeg: 222.69 },
      { latDeg: -85.99, lonDeg: 0.97 },
      { latDeg: -84.79, lonDeg: 1.39 },
    ];
    const flat = flatProjection(sites, space);
    for (const s of sites) {
      const p = flat.project(s.latDeg, s.lonDeg);
      expect(p.x).toBeGreaterThan(space.x + 90);
      expect(p.x).toBeLessThan(space.x + space.width - 90);
      expect(p.y).toBeGreaterThan(space.y);
      expect(p.y).toBeLessThan(space.y + space.height);
    }
    // 0° E (map north) is up the screen from the pole.
    expect(flat.project(-85, 0).y).toBeLessThan(flat.project(-90, 0).y);
  });
});

describe("the shading is never on without its label", () => {
  it("keeps a label at every free-space size, short when the controls do not fit", async () => {
    const { footFor, SHADING_LABEL } = await import("./spots-layer");
    for (const width of [0, 100, 219, 220, 1200]) {
      for (const height of [0, 30, 47, 48, 600]) {
        const on = footFor({ width, height }, true);
        expect(on.label).not.toBeNull();
        expect(on.label).toMatch(/NASA's .*not for your date/);
        expect(footFor({ width, height }, false).label).toBeNull();
        if (width >= 220 && height >= 48) expect(on).toEqual({ controls: true, label: SHADING_LABEL });
        else expect(on.controls).toBe(false);
      }
    }
  });
});
