import { describe, expect, it } from "vitest";
import { freeSpaceInput, type ShellState } from "../../app/mission/free-space";
import { CHART_FOLD_KEY, loadChartOpen, saveChartOpen, toggleName } from "./fold";

/** A storage that keeps values in a map, as sessionStorage does. */
function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => void values.set(key, value),
    values,
  };
}

const throwing = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("full");
  },
};

describe("the chart's fold is remembered for the session", () => {
  it("starts closed: no storage, nothing saved, or anything but 'open'", () => {
    expect(loadChartOpen(null)).toBe(false);
    expect(loadChartOpen(memoryStorage())).toBe(false);
    expect(loadChartOpen(memoryStorage({ [CHART_FOLD_KEY]: "closed" }))).toBe(false);
    expect(loadChartOpen(memoryStorage({ [CHART_FOLD_KEY]: "true" }))).toBe(false);
    expect(loadChartOpen(throwing)).toBe(false);
  });

  it("keeps an open chart open after a reload in the same tab", () => {
    const storage = memoryStorage();
    saveChartOpen(storage, true);
    expect(storage.values.get(CHART_FOLD_KEY)).toBe("open");
    expect(loadChartOpen(storage)).toBe(true);
    saveChartOpen(storage, false);
    expect(loadChartOpen(storage)).toBe(false);
  });

  it("ignores a storage that throws", () => {
    expect(() => saveChartOpen(throwing, true)).not.toThrow();
    expect(() => saveChartOpen(null, true)).not.toThrow();
  });

  it("names the toggle by what pressing it does", () => {
    expect(toggleName(false)).toBe("Show the horizon chart");
    expect(toggleName(true)).toBe("Hide the horizon chart");
  });
});

describe("the free space follows the panel, folded or open", () => {
  // 1440 × 900 with both side panels open; the timeline strip's top at 664 px. The shell
  // pushes the foot stack's top to belowTops in Lander's eye (mission-screen.tsx, readShell).
  const state = (footTop: number): ShellState => ({
    viewport: { width: 1440, height: 900 },
    phone: false,
    folded: { sitesRail: false, focusPanel: false },
    windowOpen: false,
    topBottom: 184,
    belowTops: [664, footTop],
    covers: [],
  });

  it("is taller by the panel's change in height when the chart folds", () => {
    const folded = freeSpaceInput(state(664 - 16 - 48)).gap;
    const open = freeSpaceInput(state(664 - 16 - 372)).gap;
    expect(folded.y).toBe(open.y);
    expect(folded.height - open.height).toBe(372 - 48);
    // Folded, the 3D horizon keeps nearly all of the room above the timeline.
    expect(folded.height).toBeGreaterThan(0.85 * (664 - 16 - 184));
  });
});
