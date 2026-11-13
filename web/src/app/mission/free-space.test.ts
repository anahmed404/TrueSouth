import { describe, expect, it } from "vitest";
import { clampToViewport, freeSpace, insetsOf, intersect, sameFreeSpace, uncovered, type Rect } from "./free-space";

const viewport = { width: 1440, height: 900 };
/** The gap at 1440 × 900 with both side panels open (measured in the built shell). */
const gapOpen: Rect = { x: 288, y: 182.5, width: 792, height: 469.5 };

describe("intersect", () => {
  it("finds the overlap, or none", () => {
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 5, y: 5, width: 10, height: 10 })).toEqual({ x: 5, y: 5, width: 5, height: 5 });
    expect(intersect({ x: 0, y: 0, width: 10, height: 10 }, { x: 10, y: 0, width: 5, height: 5 })).toBeNull();
  });
});

describe("uncovered", () => {
  const space: Rect = { x: 0, y: 0, width: 1000, height: 400 };

  it("leaves the space whole when the cover misses it", () => {
    expect(uncovered(space, { x: 1200, y: 0, width: 100, height: 100 })).toEqual(space);
  });

  it("keeps the larger side beside a cover", () => {
    expect(uncovered(space, { x: 0, y: 0, width: 300, height: 400 })).toEqual({ x: 300, y: 0, width: 700, height: 400 });
    expect(uncovered(space, { x: 800, y: -50, width: 400, height: 500 })).toEqual({ x: 0, y: 0, width: 800, height: 400 });
  });

  it("keeps the strip above or below when that is larger", () => {
    expect(uncovered(space, { x: -10, y: 300, width: 1100, height: 200 })).toEqual({ x: 0, y: 0, width: 1000, height: 300 });
  });

  it("leaves an empty rectangle at the centre when the cover hides everything", () => {
    expect(uncovered(space, { x: -10, y: -10, width: 1100, height: 500 })).toEqual({ x: 500, y: 200, width: 0, height: 0 });
  });
});

describe("freeSpace", () => {
  it("is the gap between the panels, in whole pixels, when no window is open", () => {
    const space = freeSpace({ viewport, gap: gapOpen, covers: [], windowOpen: false });
    expect(space).toEqual({ x: 288, y: 183, width: 792, height: 469, viewport, windowOpen: false });
    expect(insetsOf(space)).toEqual({ top: 183, left: 288, right: 360, bottom: 248 });
  });

  it("grows when the side panels fold", () => {
    const folded = freeSpace({ viewport, gap: { x: 80, y: 182.5, width: 1280, height: 452.3 }, covers: [], windowOpen: false });
    expect(folded.width).toBeGreaterThan(792);
    expect(folded.x).toBe(80);
  });

  it("keeps what a floating window leaves visible, and says a window is open", () => {
    // A 1,120 px window centred in a 1440 px window, with both side panels folded.
    const gap: Rect = { x: 80, y: 182, width: 1280, height: 452 };
    const window: Rect = { x: 160, y: 126, width: 1120, height: 484 };
    const space = freeSpace({ viewport, gap, covers: [window], windowOpen: true });
    expect(space.windowOpen).toBe(true);
    expect(space.height).toBeGreaterThan(0);
    expect(intersect(space, window)).toBeNull();
  });

  it("is empty when a window covers the whole gap", () => {
    const window: Rect = { x: 160, y: 126, width: 1120, height: 610 };
    const space = freeSpace({ viewport, gap: gapOpen, covers: [window], windowOpen: true });
    expect(space.width * space.height).toBe(0);
  });

  it("never reaches outside the browser window", () => {
    expect(clampToViewport({ x: -20, y: -5, width: 2000, height: 50 }, viewport)).toEqual({ x: 0, y: 0, width: 1440, height: 45 });
  });

  it("compares equal only when nothing the scene reads changed", () => {
    const a = freeSpace({ viewport, gap: gapOpen, covers: [], windowOpen: false });
    const b = freeSpace({ viewport, gap: { ...gapOpen }, covers: [], windowOpen: false });
    expect(sameFreeSpace(a, b)).toBe(true);
    expect(sameFreeSpace(a, { ...b, windowOpen: true })).toBe(false);
    expect(sameFreeSpace(a, { ...b, viewport: { width: 1024, height: 768 } })).toBe(false);
  });
});
