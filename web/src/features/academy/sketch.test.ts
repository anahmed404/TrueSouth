import { describe, expect, it } from "vitest";
import { lesson2 } from "./lessons/l2";
import { initialRunnerState, reduceRunner } from "./runner";
import { createValueEvaluator } from "./evaluator";
import {
  columnAt,
  columnCount,
  emptySketch,
  handleColumns,
  handlesFrom,
  hasLine,
  nudgeHandle,
  sketchAzimuths,
  sketchFromHandles,
  sketchGapDeg,
  skylineInWindow,
  strokeTo,
} from "./sketch";
import { resolveSkylineWindow, skylineXp } from "./skyline-score";
import { realExamples, realSite } from "./testing/real-site";
import type { Step } from "./types";

describe("a sketch keeps one height per column", () => {
  it("fills every column a fast stroke passes, straight between samples", () => {
    let sketch = emptySketch(11);
    sketch = strokeTo(sketch, null, { column: 2, elDeg: 0 });
    sketch = strokeTo(sketch, { column: 2, elDeg: 0 }, { column: 6, elDeg: 4 });
    expect(sketch.slice(2, 7)).toEqual([0, 1, 2, 3, 4]);
    expect(sketch[1]).toBeNull();
    expect(sketch[7]).toBeNull();
  });

  it("cannot double back: moving left redraws the columns, never adds a second height", () => {
    let sketch = emptySketch(11);
    sketch = strokeTo(sketch, null, { column: 0, elDeg: 1 });
    sketch = strokeTo(sketch, { column: 0, elDeg: 1 }, { column: 8, elDeg: 1 });
    sketch = strokeTo(sketch, { column: 8, elDeg: 1 }, { column: 4, elDeg: 3 });
    expect(sketch).toHaveLength(11);
    expect(sketch[4]).toBe(3);
    expect(sketch[6]).toBe(2);
    expect(sketch[8]).toBe(1);
    expect(sketch[2]).toBe(1);
  });

  it("maps an offset to its column, clamped to the window", () => {
    expect(columnCount(60)).toBe(61);
    expect(columnAt(30.4, 61, 60)).toBe(30);
    expect(columnAt(-5, 61, 60)).toBe(0);
    expect(columnAt(80, 61, 60)).toBe(60);
  });
});

describe("the keyboard's handles make the same kind of line", () => {
  it("spreads nine handles from the first column to the last", () => {
    expect(handleColumns(61)).toEqual([0, 8, 15, 23, 30, 38, 45, 53, 60]);
  });

  it("moves a handle by 0.1° (0.5° with Shift), inside the range, and draws straight between handles", () => {
    const range = { lo: -1, hi: 2 };
    let heights = handlesFrom(emptySketch(61), 0);
    expect(heights).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 0]);
    heights = nudgeHandle(heights, 4, "ArrowUp", true, range) ?? heights;
    heights = nudgeHandle(heights, 4, "ArrowUp", false, range) ?? heights;
    expect(heights[4]).toBeCloseTo(0.6);
    expect(nudgeHandle(heights, 4, "ArrowLeft", false, range)).toBeNull();
    for (let i = 0; i < 10; i += 1) heights = nudgeHandle(heights, 0, "ArrowDown", true, range) ?? heights;
    expect(heights[0]).toBe(-1);

    const line = sketchFromHandles(heights, 61);
    expect(line).toHaveLength(61);
    expect(line[30]).toBeCloseTo(0.6);
    expect(line[0]).toBe(-1);
    expect(line[34]).toBeCloseTo(0.3, 5);
    expect(hasLine(line)).toBe(true);
  });

  it("takes the handles from a drawn line, so the keyboard carries on from the pointer", () => {
    let sketch = emptySketch(61);
    sketch = strokeTo(sketch, null, { column: 0, elDeg: 2 });
    sketch = strokeTo(sketch, { column: 0, elDeg: 2 }, { column: 60, elDeg: 2 });
    expect(handlesFrom(sketch, 0)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2]);
  });
});

describe("lesson 2 step 3 on the real skyline", () => {
  const step = lesson2.steps.find((item) => item.id === "l2-sketch") as Extract<Step, { kind: "draw-skyline" }>;
  const window = resolveSkylineWindow(step.window, realExamples);
  const site = realSite(String(realExamples["l2.site_id"]));
  if (!window) throw new Error("the window does not resolve");
  const real = skylineInWindow(site.skyline.el_deg, window.fromDeg, window.toDeg);

  it("is a 60° window centred on l2.sun_az_deg, holding the stored bins in it", () => {
    expect(window.toDeg - window.fromDeg).toBeCloseTo(60);
    expect((window.fromDeg + window.toDeg) / 2).toBeCloseTo(Number(realExamples["l2.sun_az_deg"]));
    // A quarter-degree skyline: 240 bins in 60°, plus both ends.
    expect(real.length).toBeGreaterThanOrEqual(240);
    expect(real[0]?.azDeg).toBeGreaterThanOrEqual(0);
    expect(real[real.length - 1]?.azDeg).toBeLessThanOrEqual(60);
  });

  it("a sketch traced on the real skyline earns 10 XP; a flat line at 0° earns less; every sketch passes", () => {
    const columns = columnCount(60);
    const traced = emptySketch(columns).map((_, column) => {
      const near = real.reduce((best, p) => (Math.abs(p.azDeg - column) < Math.abs(best.azDeg - column) ? p : best));
      return near.elDeg;
    });
    const tracedGap = sketchGapDeg(traced, real, 60);
    expect(skylineXp(tracedGap)).toBe(10);

    const flat = emptySketch(columns).map(() => 0);
    const flatGap = sketchGapDeg(flat, real, 60);
    expect(flatGap).toBeGreaterThan(tracedGap);

    const lesson = lesson2;
    const at = { ...initialRunnerState(), stepIndex: (lesson.steps as readonly Step[]).indexOf(step) };
    for (const [sketch, gapDeg] of [
      [traced, tracedGap],
      [flat, flatGap],
    ] as const) {
      const done = reduceRunner(
        at,
        { type: "submit", submission: { kind: "draw-skyline", sketch: sketchAzimuths(sketch, window.fromDeg, 60), gapDeg } },
        lesson,
        createValueEvaluator(),
        realExamples,
      );
      expect(done.phase).toBe("correct");
      expect(done.stepXp).toBe(skylineXp(gapDeg));
    }
  });

  it("scores closeness by the overview's rule: 10 XP to 0.25°, 2 XP from 2°", () => {
    expect(skylineXp(0.25)).toBe(10);
    expect(skylineXp(1.125)).toBe(6);
    expect(skylineXp(2)).toBe(2);
    expect(skylineXp(5)).toBe(2);
  });
});
