import { describe, expect, it } from "vitest";
import { createValueEvaluator } from "./evaluator";
import {
  answerHour,
  barXOfHour,
  goalValuesAt,
  hourAfterKey,
  hourAtBarX,
  hourNearPointer,
  meetsAt,
  metricAt,
  metricExtremes,
  resolveTimeRange,
  startHour,
  storyMonth,
  type HourRange,
  type NumberGoal,
} from "./drag-body";
import { lesson1 } from "./lessons/l1";
import { lesson2 } from "./lessons/l2";
import { lesson4 } from "./lessons/l4";
import { resolveValue } from "./placeholders";
import { initialRunnerState, reduceRunner } from "./runner";
import { realExamples, realGrid, realSite } from "./testing/real-site";
import type { Lesson, Step } from "./types";
import { hourOnGrid } from "./utc";
import { lessonCheck, lessonScreenKind, validateLesson } from "./validate";
import { hourIndexToUtc } from "../../lib/time";

type DragStep = Extract<Step, { kind: "drag-body" }>;

function dragStep(lesson: Lesson, id: string): DragStep {
  const step = lesson.steps.find((item) => item.id === id);
  if (step?.kind !== "drag-body") throw new Error(`${id} is not a drag-body step`);
  return step;
}

function rangeOf(step: DragStep): HourRange {
  if (!step.scene.timeRange) throw new Error(`${step.id} has no time range`);
  const range = resolveTimeRange(step.scene.timeRange, realExamples, realGrid);
  if (!range || "missing" in range) throw new Error(`${step.id}'s range does not resolve`);
  return range;
}

function goalOf(step: DragStep): NumberGoal {
  if ("comparedTo" in step.goal) throw new Error("compared goal");
  const value = resolveValue(step.goal.value, realExamples).value;
  if (typeof value !== "number") throw new Error(`${step.id}'s goal is not a number`);
  const goal: NumberGoal = { metric: step.goal.metric, op: step.goal.op, value, tolerance: step.goal.tolerance };
  if (!step.goal.also) return goal;
  const also = resolveValue(step.goal.also.value, realExamples).value;
  if (typeof also !== "number") throw new Error(`${step.id}'s second condition is not a number`);
  return { ...goal, also: { metric: step.goal.also.metric, op: step.goal.also.op, value: also } };
}

const hour = (utc: string) => {
  const index = hourOnGrid(realGrid, utc);
  if (index === null) throw new Error(utc);
  return index;
};

const story = realSite("connecting_ridge");
const malapert = realSite("malapert_peak");

describe("the drag's time range", () => {
  it("lessons 1 and 4 drag the story month: 720 hours from the story landing", () => {
    for (const step of [dragStep(lesson1, "l1-highest"), dragStep(lesson4, "l4-highest")]) {
      const range = rangeOf(step);
      expect(range.fromIndex).toBe(hour("2028-01-01T00:00:00Z"));
      expect(range.toIndex - range.fromIndex + 1).toBe(720);
    }
  });

  it("lesson 2 step 4 drags the 48 hours centred on l2.example_utc", () => {
    const range = rangeOf(dragStep(lesson2, "l2-disc"));
    const centre = hour(String(realExamples["l2.example_utc"]));
    expect(range).toEqual({ fromIndex: centre - 24, toIndex: centre + 24 });
  });

  it("reports a missing key, and refuses a month that does not hold its hour", () => {
    expect(resolveTimeRange({ kind: "span", span: "one-month", aroundUtc: "{{example.l1.example_utc}}" }, {}, realGrid)).toEqual({
      missing: ["l1.example_utc", "story.landing_utc", "story.month_end_utc"],
    });
    expect(resolveTimeRange({ kind: "span", span: "one-month", aroundUtc: "2028-06-01T00:00:00Z" }, realExamples, realGrid)).toBeNull();
  });
});

describe("the real data agrees with the worked examples", () => {
  it("lesson 1: the highest stored Sun in the story month is l1.sun_el_max_deg, and the lowest l1.sun_el_min_deg", () => {
    const extremes = metricExtremes(story.series, "sun_el_deg", rangeOf(dragStep(lesson1, "l1-highest")));
    expect(extremes?.max.toFixed(2)).toBe(Number(realExamples["l1.sun_el_max_deg"]).toFixed(2));
    expect(extremes?.min.toFixed(2)).toBe(Number(realExamples["l1.sun_el_min_deg"]).toFixed(2));
  });

  it("lesson 4: the highest stored Earth in the story month is l4.earth_el_max_deg, and the lowest l4.earth_el_min_deg", () => {
    const extremes = metricExtremes(story.series, "earth_el_deg", rangeOf(dragStep(lesson4, "l4-highest")));
    expect(extremes?.max.toFixed(2)).toBe(Number(realExamples["l4.earth_el_max_deg"]).toFixed(2));
    expect(extremes?.min.toFixed(2)).toBe(Number(realExamples["l4.earth_el_min_deg"]).toFixed(2));
  });

  it("lesson 1 and 4: only hours that print as the maximum meet the goal, and the highest hour does", () => {
    for (const step of [dragStep(lesson1, "l1-highest"), dragStep(lesson4, "l4-highest")]) {
      const range = rangeOf(step);
      const goal = goalOf(step);
      const extremes = metricExtremes(story.series, goal.metric, range);
      if (!extremes) throw new Error("no data");
      expect(meetsAt(story.series, goal, extremes.maxHour), step.id).toBe(true);
      for (let h = range.fromIndex; h <= range.toIndex; h += 1) {
        const value = metricAt(story.series, goal.metric, h) ?? Number.NaN;
        expect(meetsAt(story.series, goal, h), `${step.id} at ${h}`).toBe(value.toFixed(2) === goal.value.toFixed(2));
      }
    }
  });

  it("lesson 2 step 4: the 48 hours hold hours with under half the disc showing, and the example hour shows none", () => {
    const step = dragStep(lesson2, "l2-disc");
    const range = rangeOf(step);
    let hidden = 0;
    for (let h = range.fromIndex; h <= range.toIndex; h += 1) if ((metricAt(malapert.series, "sun_frac", h) ?? 1) < 0.5) hidden += 1;
    expect(hidden).toBeGreaterThan(0);
    expect(metricAt(malapert.series, "sun_frac", hour(String(realExamples["l2.example_utc"])))).toBe(0);
  });

  it("lesson 2 step 4: a risen Sun hidden by the ridge passes; plain night does not", () => {
    const step = dragStep(lesson2, "l2-disc");
    const range = rangeOf(step);
    const goal = goalOf(step);
    const passing: string[] = [];
    for (let h = range.fromIndex; h <= range.toIndex; h += 1) {
      if (meetsAt(malapert.series, goal, h)) passing.push(hourIndexToUtc(realGrid, h));
    }
    // The 20 hours from 02:00 to 21:00 UTC on 2028-01-04, the example hour among them.
    expect(passing).toHaveLength(20);
    expect(passing[0]).toBe("2028-01-04T02:00:00Z");
    expect(passing[passing.length - 1]).toBe("2028-01-04T21:00:00Z");
    expect(passing).toContain(String(realExamples["l2.example_utc"]));
    for (let h = range.fromIndex; h <= range.toIndex; h += 1) {
      const passes = meetsAt(malapert.series, goal, h);
      const el = metricAt(malapert.series, "sun_el_deg", h) ?? Number.NaN;
      const frac = metricAt(malapert.series, "sun_frac", h) ?? Number.NaN;
      expect(passes, hourIndexToUtc(realGrid, h)).toBe(el > 0 && frac < 0.5);
    }
    // 2028-01-03T17:00:00Z: no disc shows, but the Sun is 0.29° below level. A miss, with the hint.
    const night = hour("2028-01-03T17:00:00Z");
    expect(metricAt(malapert.series, "sun_frac", night)).toBe(0);
    expect(metricAt(malapert.series, "sun_el_deg", night) ?? 0).toBeLessThan(0);
    const at = { ...initialRunnerState(), stepIndex: (lesson2.steps as readonly Step[]).indexOf(step) };
    const submission = (h: number) => ({
      kind: "drag-body" as const,
      value: metricAt(malapert.series, "sun_frac", h) ?? Number.NaN,
      values: goalValuesAt(malapert.series, goal, h) ?? {},
      utc: hourIndexToUtc(realGrid, h),
    });
    const missed = reduceRunner(at, { type: "submit", submission: submission(night) }, lesson2, createValueEvaluator(), realExamples);
    expect(missed.phase).toBe("hint");
    expect(missed.feedback).toMatch(/above level/);
    const right = reduceRunner(missed, { type: "submit", submission: submission(hour("2028-01-04T17:00:00Z")) }, lesson2, createValueEvaluator(), realExamples);
    expect(right.phase).toBe("correct");
  });

  it("the body starts where the goal is not yet met, and the marked answer meets it", () => {
    const cases = [
      [dragStep(lesson1, "l1-highest"), story],
      [dragStep(lesson2, "l2-disc"), malapert],
      [dragStep(lesson4, "l4-highest"), story],
    ] as const;
    for (const [step, site] of cases) {
      const range = rangeOf(step);
      const goal = goalOf(step);
      expect(meetsAt(site.series, goal, startHour(site.series, goal, range)), step.id).toBe(false);
      const answer = answerHour(site.series, goal, range);
      expect(answer, step.id).not.toBeNull();
      expect(meetsAt(site.series, goal, answer ?? -1), step.id).toBe(true);
    }
  });
});

describe("the attempt is the series' value at the chosen hour", () => {
  it("checks the stored value through the lesson's own evaluator, with the hint, reveal and XP rules", () => {
    const step = dragStep(lesson1, "l1-highest");
    const range = rangeOf(step);
    const goal = goalOf(step);
    const extremes = metricExtremes(story.series, goal.metric, range);
    if (!extremes) throw new Error("no data");
    const evaluator = createValueEvaluator();
    const at = { ...initialRunnerState(), stepIndex: (lesson1.steps as readonly Step[]).indexOf(step) };
    const submit = (h: number) => ({
      type: "submit" as const,
      submission: { kind: "drag-body" as const, value: metricAt(story.series, goal.metric, h) ?? Number.NaN, utc: String(h) },
    });
    const right = reduceRunner(at, submit(extremes.maxHour), lesson1, evaluator, realExamples);
    expect(right.phase).toBe("correct");
    expect(right.stepXp).toBe(10);
    expect(right.results).toEqual(["first"]);

    const low = extremes.minHour;
    const missed = reduceRunner(at, submit(low), lesson1, evaluator, realExamples);
    expect(missed.phase).toBe("hint");
    const second = reduceRunner(missed, submit(extremes.maxHour), lesson1, evaluator, realExamples);
    expect(second.stepXp).toBe(5);
    const shown = reduceRunner(missed, submit(low + 1), lesson1, evaluator, realExamples);
    expect(shown.phase).toBe("revealed");
    expect(shown.stepXp).toBe(2);
  });
});

describe("the drag's time mapping", () => {
  const range: HourRange = { fromIndex: 100, toIndex: 819 };

  it("maps the time bar's pixels to hours, snapping and clamping at the ends", () => {
    expect(hourAtBarX(range, 719, 0)).toBe(100);
    expect(hourAtBarX(range, 719, 719)).toBe(819);
    expect(hourAtBarX(range, 719, 10.4)).toBe(110);
    expect(hourAtBarX(range, 719, -50)).toBe(100);
    expect(hourAtBarX(range, 719, 5000)).toBe(819);
    expect(barXOfHour(range, 719, 110)).toBeCloseTo(10);
  });

  it("steps an hour with the arrows, a day with Shift, and jumps to the ends with Home and End", () => {
    expect(hourAfterKey(range, 200, "ArrowRight", false)).toBe(201);
    expect(hourAfterKey(range, 200, "ArrowLeft", false)).toBe(199);
    expect(hourAfterKey(range, 200, "ArrowRight", true)).toBe(224);
    expect(hourAfterKey(range, 200, "ArrowLeft", true)).toBe(176);
    expect(hourAfterKey(range, 110, "ArrowLeft", true)).toBe(100);
    expect(hourAfterKey(range, 819, "ArrowRight", false)).toBe(819);
    expect(hourAfterKey(range, 200, "Home", false)).toBe(100);
    expect(hourAfterKey(range, 200, "End", false)).toBe(819);
    expect(hourAfterKey(range, 200, "ArrowUp", false)).toBeNull();
  });

  it("snaps a pointer to the nearest stored hour on the path, preferring hours near the current one", () => {
    const points = [
      { hour: 0, x: 10, y: 50 },
      { hour: 1, x: 20, y: 50 },
      { hour: 2, x: 30, y: 50 },
      // The path comes back over itself much later.
      { hour: 500, x: 21, y: 50 },
    ];
    expect(hourNearPointer(points, 19, 50, 0)).toBe(1);
    expect(hourNearPointer(points, 21, 50, 1)).toBe(1);
    expect(hourNearPointer(points, 21, 50, 499)).toBe(500);
    expect(hourNearPointer(points, 31, 80, 0)).toBe(2);
    expect(hourNearPointer([], 0, 0, 0)).toBeNull();
  });
});

describe("the story month is complete and agrees with its two keys, or it is a data error", () => {
  const at = (hours: number) => hourIndexToUtc(realGrid, hours);
  const landing = hour(String(realExamples["story.landing_utc"]));
  const month = (end: string, start = at(landing)) => ({ ...realExamples, "story.landing_utc": start, "story.month_end_utc": end, "l1.example_utc": start });

  it("on the real data: the 720 hours from the landing, ending at story.month_end_utc", () => {
    expect(storyMonth(realExamples, realGrid)).toEqual({ fromIndex: landing, toIndex: hour(String(realExamples["story.month_end_utc"])) - 1 });
    expect(storyMonth(realExamples, realGrid)).toEqual({ fromIndex: landing, toIndex: landing + 719 });
  });

  it("an end that is not 720 hours after the landing is a problem, and nothing is drawn", () => {
    const short = month(at(landing + 719));
    expect(storyMonth(short, realGrid)).toEqual({ problem: "story.month_end_utc is 719 hours after story.landing_utc, not 720" });
    expect(resolveTimeRange({ kind: "span", span: "one-month", aroundUtc: "{{example.l1.example_utc}}" }, short, realGrid)).toBeNull();
    // The lesson does not start: the "numbers do not match" page.
    expect(validateLesson(lesson1, { ...lessonCheck(short), grid: realGrid }).join(" | ")).toMatch(/the story month does not match/);
    expect(lessonScreenKind(lesson1, { ...lessonCheck(short), grid: realGrid })).toBe("unwritten");
    expect(validateLesson(lesson1, { ...lessonCheck(realExamples), grid: realGrid })).toEqual([]);
  });

  it("a month that would run past the end of the time grid is rejected, never shortened", () => {
    const lateStart = realGrid.count - 100;
    const late = month(hourEnd(lateStart), at(lateStart));
    expect(storyMonth(late, realGrid)).toEqual({ problem: "the story month runs past the end of the time grid" });
    expect(resolveTimeRange({ kind: "span", span: "one-month", aroundUtc: "{{example.l1.example_utc}}" }, late, realGrid)).toBeNull();
    expect(lessonScreenKind(lesson4, { ...lessonCheck(late), grid: realGrid })).toBe("unwritten");
  });

  /** The UTC instant 720 hours after hour `from`, which may lie past the grid's last hour. */
  function hourEnd(from: number): string {
    const ms = Date.parse(realGrid.start_utc) + (from + 720) * realGrid.step_s * 1000;
    return new Date(ms).toISOString().replace(".000Z", "Z");
  }
});
