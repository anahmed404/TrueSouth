import { describe, expect, it } from "vitest";
import { FrameMeter, MOON_SEGMENTS_FULL, SLOW_MEDIAN_MS, STEP_DOWN_MS, drawDpr, judgeWindow, median, moonSegments, qualityStages } from "./perf";

describe("quality stages from the screen", () => {
  it("stage 0 is today's picture: the device pixel ratio up to 2, unchanged while moving", () => {
    for (const dpr of [1, 1.5, 2, 3]) {
      const [first] = qualityStages(dpr);
      expect(first!.restDpr).toBe(Math.min(dpr, 2));
      expect(drawDpr(first!, true)).toBe(drawDpr(first!, false));
    }
  });

  it("later stages draw fewer pixels while moving, and never more than the stage before", () => {
    const stages = qualityStages(2);
    for (let i = 1; i < stages.length; i += 1) {
      expect(drawDpr(stages[i]!, true)).toBeLessThan(drawDpr(stages[i]!, false));
      expect(drawDpr(stages[i]!, false)).toBeLessThanOrEqual(drawDpr(stages[i - 1]!, false));
      expect(drawDpr(stages[i]!, true)).toBeLessThanOrEqual(drawDpr(stages[i - 1]!, true));
    }
  });

  it("stage 1 keeps the full resolution at rest, so a still picture stays sharp", () => {
    const stages = qualityStages(2);
    expect(drawDpr(stages[1]!, false)).toBe(2);
    expect(drawDpr(stages[1]!, true)).toBe(1.2);
  });

  it("rounds the pixel ratio to 1/20 and never goes below 0.35", () => {
    expect(drawDpr({ restDpr: 1.234, movingScale: 1 }, false)).toBe(1.25);
    expect(drawDpr({ restDpr: 0.5, movingScale: 0.5 }, true)).toBe(0.35);
  });
});

describe("stepping down from measured frame times", () => {
  const last = qualityStages(1).length - 1;

  it("keeps the stage when moving frames are fast enough", () => {
    expect(judgeWindow(0, last, 16.7)).toEqual({ stage: 0, slow: false });
    expect(judgeWindow(0, last, STEP_DOWN_MS)).toEqual({ stage: 0, slow: false });
  });

  it("steps down one stage when frames are slow, two when far too slow", () => {
    expect(judgeWindow(0, last, 45)).toEqual({ stage: 1, slow: false });
    expect(judgeWindow(0, last, 200)).toEqual({ stage: 2, slow: false });
    expect(judgeWindow(2, last, 200)).toEqual({ stage: last, slow: false });
  });

  it("says slow only at the last stage, and only over the slow threshold", () => {
    expect(judgeWindow(last, last, 45)).toEqual({ stage: last, slow: false });
    expect(judgeWindow(last, last, SLOW_MEDIAN_MS + 1)).toEqual({ stage: last, slow: true });
  });
});

describe("the frame meter", () => {
  it("records the time between frames and drops a rest", () => {
    const meter = new FrameMeter(8);
    meter.tick(1_000);
    meter.tick(1_020);
    meter.tick(1_050);
    meter.tick(2_000); // a rest, not a frame
    meter.tick(2_016);
    expect(meter.count).toBe(3);
    expect(meter.median()).toBe(20);
  });

  it("keeps only the latest frames in its ring", () => {
    const meter = new FrameMeter(4);
    let t = 0;
    for (const gap of [100, 100, 100, 100, 10, 10, 10, 10]) {
      t += gap;
      meter.tick(t);
    }
    expect(meter.count).toBe(4);
    expect(meter.median()).toBe(10);
    meter.reset();
    expect(meter.count).toBe(0);
    expect(median([3, 1, 2])).toBe(2);
  });
});

describe("the Moon's level of detail", () => {
  /** How far a facet's flat edge falls inside the true circle, in pixels. */
  const edgeError = (radius: number, segments: number) => radius * (1 - Math.cos(Math.PI / segments));

  it("keeps the silhouette within a quarter of a pixel at every size", () => {
    for (const radius of [20, 105, 300, 700, 1_000, 1_800]) {
      expect(edgeError(radius, moonSegments(radius))).toBeLessThan(0.25);
    }
  });

  it("draws far fewer triangles for a small Moon, and the full mesh close up", () => {
    expect(moonSegments(105)).toBe(64);
    expect(moonSegments(5_000)).toBe(MOON_SEGMENTS_FULL);
    expect(moonSegments(Number.POSITIVE_INFINITY)).toBe(MOON_SEGMENTS_FULL);
    expect(moonSegments(Number.NaN)).toBe(MOON_SEGMENTS_FULL);
  });

  it("never needs fewer segments for a bigger Moon", () => {
    let previous = 0;
    for (let radius = 1; radius < 6_000; radius *= 1.1) {
      const n = moonSegments(radius);
      expect(n).toBeGreaterThanOrEqual(previous);
      previous = n;
    }
  });
});
