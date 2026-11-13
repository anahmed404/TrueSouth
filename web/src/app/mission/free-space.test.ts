import { describe, expect, it } from "vitest";
import {
  WINDOW_MAX,
  clampToViewport,
  freeSpace,
  freeSpaceInput,
  insetsOf,
  intersect,
  sameFreeSpace,
  uncovered,
  windowPlacement,
  type Rect,
  type ShellState,
} from "./free-space";
import { DEFAULT_SHELL_LAYOUT, toggleShellPanel } from "./shell-layout";

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

  it("is empty while a window fills the room between the panels, and says a window is open", () => {
    const window: Rect = { ...gapOpen };
    const space = freeSpace({ viewport, gap: gapOpen, covers: [window], windowOpen: true });
    expect(space.windowOpen).toBe(true);
    expect(space.width * space.height).toBe(0);
  });

  it("keeps the strip a window leaves visible when it does not fill the room", () => {
    const gap: Rect = { x: 80, y: 182, width: 1280, height: 452 };
    const window: Rect = { x: 160, y: 182, width: 1120, height: 452 };
    const space = freeSpace({ viewport, gap, covers: [window], windowOpen: true });
    expect(space.width).toBe(80);
    expect(intersect(space, window)).toBeNull();
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

describe("freeSpaceInput: the shell's layout state to the gap between the panels", () => {
  /** 1440 × 900, both side panels open, the sentence ending at 182.5 px, the timeline at 668 px. */
  const open: ShellState = {
    viewport,
    phone: false,
    folded: { sitesRail: false, focusPanel: false },
    windowOpen: false,
    topBottom: 182.5,
    belowTops: [668],
    covers: [],
  };

  it("puts the gap between the open side panels, under the sentence and above the timeline", () => {
    expect(freeSpaceInput(open).gap).toEqual({ x: 288, y: 182.5, width: 792, height: 469.5 });
  });

  it("moves the left edge in when the sites rail folds", () => {
    const gap = freeSpaceInput({ ...open, folded: { sitesRail: true, focusPanel: false } }).gap;
    expect(gap.x).toBe(80);
    expect(gap.x + gap.width).toBe(1080);
  });

  it("moves the right edge out when the focused-site panel folds", () => {
    const gap = freeSpaceInput({ ...open, folded: { sitesRail: false, focusPanel: true } }).gap;
    expect(gap.x).toBe(288);
    expect(gap.x + gap.width).toBe(1360);
  });

  it("ends above the highest panel below it, such as the phone's one-line sheet", () => {
    const phone: ShellState = { ...open, viewport: { width: 390, height: 844 }, phone: true, topBottom: 206, belowTops: [688, 610] };
    expect(freeSpaceInput(phone).gap).toEqual({ x: 8, y: 206, width: 374, height: 396 });
  });

  it("ignores the side panels on a phone", () => {
    const folded = freeSpaceInput({ ...open, phone: true, folded: { sitesRail: true, focusPanel: true } }).gap;
    const unfolded = freeSpaceInput({ ...open, phone: true }).gap;
    expect(folded).toEqual(unfolded);
  });

  it("passes on what floats over the gap and whether a window is open", () => {
    const plate: Rect = { x: 400, y: 600, width: 560, height: 36 };
    const input = freeSpaceInput({ ...open, windowOpen: true, covers: [plate] });
    expect(input.covers).toEqual([plate]);
    expect(input.windowOpen).toBe(true);
    // The "why" plate at the foot: the free space ends above it.
    const space = freeSpace(input);
    expect(space.y + space.height).toBe(600);
  });
});

describe("windowPlacement", () => {
  const both = DEFAULT_SHELL_LAYOUT;
  const railFolded = toggleShellPanel(both, "sitesRail");
  const allFolded = toggleShellPanel(railFolded, "focusPanel");

  it("puts a window between the open side panels at 1440 px", () => {
    expect(windowPlacement(1440, both, false)).toBe("between");
  });

  it("lets it cover the panels at 1024 px with both open, and below", () => {
    expect(windowPlacement(1024, both, false)).toBe("over");
    expect(windowPlacement(1024, railFolded, false)).toBe("over");
  });

  it("puts it between them again at 1024 px once both are folded", () => {
    expect(windowPlacement(1024, allFolded, false)).toBe("between");
  });

  it("fills the screen on a phone", () => {
    expect(windowPlacement(390, both, true)).toBe("full");
  });

  it("caps its width at 1,120 px", () => {
    expect(WINDOW_MAX).toBe(1120);
  });
});
