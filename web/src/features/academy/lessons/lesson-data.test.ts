/**
 * Each lesson's checks against a whole dataset, as the app would load it: every goal can be
 * reached, and every answer marked correct agrees with the data the lesson draws. Run on the
 * real derived data, and on the fixture that `VITE_DATA=fixtures` serves, so a dataset whose
 * worked examples disagree with its own series can never pass silently.
 */

import { describe, expect, it } from "vitest";
import { formatExample } from "../format-example";
import { metricExtremes, resolveTimeRange, storyMonth, type HourRange, type NumberGoal } from "../drag-body";
import { meetsAt } from "../drag-body";
import { hourFlags } from "../../../lib/scoring";
import { skylineReading } from "../../panorama/readings";
import { horizonMoment, monthBands, sunTurnDeg } from "../lesson/panels/panel-data";
import { resolveSkylineWindow } from "../skyline-score";
import { skylineInWindow } from "../sketch";
import { resolveValue } from "../placeholders";
import { loadDataset, type Dataset } from "../testing/real-site";
import type { Lesson, Step } from "../types";
import { hourOnGrid } from "../utc";
import { lesson1 } from "./l1";
import { lesson2 } from "./l2";
import { lesson4 } from "./l4";
import { oneMonth, pipProfile } from "./story";

function stepOf(lesson: Lesson, id: string): Step {
  const step = (lesson.steps as readonly Step[]).find((item) => item.id === id);
  if (!step) throw new Error(id);
  return step;
}

/** A drag-body step's goal with its placeholders filled from the dataset. */
function goalOf(step: Step, data: Dataset): NumberGoal | null {
  if (step.kind !== "drag-body" || "comparedTo" in step.goal) return null;
  const value = resolveValue(step.goal.value, data.examples).value;
  if (typeof value !== "number") return null;
  const goal: NumberGoal = { metric: step.goal.metric, op: step.goal.op, value, tolerance: step.goal.tolerance };
  if (!step.goal.also) return goal;
  const also = resolveValue(step.goal.also.value, data.examples).value;
  return typeof also === "number" ? { ...goal, also: { metric: step.goal.also.metric, op: step.goal.also.op, value: also } } : null;
}

/** Every way the lessons' checks disagree with the dataset, as sentences; empty when none. */
function disagreements(data: Dataset): string[] {
  const out: string[] = [];
  const ex = data.examples;
  const num = (key: string) => Number(ex[key]);
  const story = data.site(String(ex["story.site_id"]));
  const l2site = data.site(String(ex["l2.site_id"]));
  if (!story) return [`story.site_id ${String(ex["story.site_id"])} is not in the dataset`];
  if (!l2site) return [`l2.site_id ${String(ex["l2.site_id"])} is not in the dataset`];

  const month = storyMonth(ex, data.grid);
  if ("problem" in month || "missing" in month) {
    out.push(`the story month: ${"problem" in month ? month.problem : month.missing.join(", ")}`);
  }
  const range: HourRange | null = "fromIndex" in month ? month : null;

  // Every drag goal can be met at some hour of its range.
  for (const [lesson, id, site] of [
    [lesson1, "l1-highest", story],
    [lesson2, "l2-disc", l2site],
    [lesson4, "l4-highest", story],
  ] as const) {
    const step = stepOf(lesson, id);
    const goal = goalOf(step, data);
    const span = step.kind === "drag-body" && step.scene.timeRange ? resolveTimeRange(step.scene.timeRange, ex, data.grid) : null;
    if (!goal || !span || "missing" in span) {
      out.push(`${id}: its goal or its hours do not resolve`);
      continue;
    }
    let reachable = false;
    for (let hour = span.fromIndex; hour <= span.toIndex && !reachable; hour += 1) reachable = meetsAt(site.series, goal, hour);
    if (!reachable) out.push(`${id}: no hour in its range meets its goal (${goal.metric} ${goal.op} ${goal.value})`);
  }

  if (range) {
    // Lesson 1: "Under 3°", and the month's highest and lowest as the text says them.
    const sun = metricExtremes(story.series, "sun_el_deg", range);
    if (!sun || !(sun.max < 3)) out.push(`l1-height: "Under 3°" is marked correct, but the month's highest Sun is ${sun?.max}°`);
    if (sun && formatExample("l1.sun_el_max_deg", sun.max) !== formatExample("l1.sun_el_max_deg", num("l1.sun_el_max_deg"))) {
      out.push(`l1: the month's highest Sun is ${sun.max}°, the text says ${num("l1.sun_el_max_deg")}°`);
    }
    if (sun && formatExample("l1.sun_el_min_deg", sun.min) !== formatExample("l1.sun_el_min_deg", num("l1.sun_el_min_deg"))) {
      out.push(`l1: the month's lowest Sun is ${sun.min}°, the text says ${num("l1.sun_el_min_deg")}°`);
    }
    // Lesson 1 step 3: "All the way round".
    if (sunTurnDeg(data.system, range) < 360) out.push(`l1-directions: "All the way round" is marked correct, but the Sun turns ${sunTurnDeg(data.system, range)}°`);
    // Lesson 4: Earth's highest and lowest; "It bobs up and down at the horizon"; "About N%".
    const earth = metricExtremes(story.series, "earth_el_deg", range);
    if (earth && formatExample("l4.earth_el_max_deg", earth.max) !== formatExample("l4.earth_el_max_deg", num("l4.earth_el_max_deg"))) {
      out.push(`l4: the month's highest Earth is ${earth.max}°, the text says ${num("l4.earth_el_max_deg")}°`);
    }
    if (!earth || !(earth.min < 0 && earth.max > 0)) out.push(`l4-bob: "bobs up and down at the horizon" is marked correct, but Earth stays ${earth && earth.min >= 0 ? "above" : "below"} level`);
    const bands = monthBands(story.series, hourFlags(story.series, pipProfile), range);
    const drawn = (100 * bands.earthUpHours) / bands.hours;
    if (formatExample("l4.earth_up_pct", drawn) !== formatExample("l4.earth_up_pct", num("l4.earth_up_pct"))) {
      out.push(`l4-up: "About ${formatExample("l4.earth_up_pct", num("l4.earth_up_pct"))}%" is marked correct, but the drawn band is ${drawn.toFixed(1)}%`);
    }
  }

  // Lesson 2 step 1: "Shadow", with the Sun and the ridge the text quotes.
  const at = hourOnGrid(data.grid, String(ex["l2.example_utc"]));
  const moment = at === null ? null : horizonMoment(l2site.series, at);
  if (!moment?.sun) out.push("l2-shadow: no Sun is stored at l2.example_utc");
  else {
    if (!(moment.sun.frac < 0.5)) out.push(`l2-shadow: "Shadow" is marked correct, but ${moment.sun.frac} of the Sun's disc shows`);
    if (moment.sun.elDeg.toFixed(2) !== num("l2.sun_el_deg").toFixed(2)) out.push(`l2-shadow: the Sun is ${moment.sun.elDeg}° up, the text says ${num("l2.sun_el_deg")}°`);
    const ridge = skylineReading(l2site.skyline, moment.sun.azDeg, []).elDeg;
    if (Math.abs(ridge - num("l2.ridge_el_deg")) > 0.01) out.push(`l2-shadow: the skyline towards the Sun is ${ridge}°, the text says ${num("l2.ridge_el_deg")}°`);
  }

  // Lesson 2 step 3: the sketch's window holds stored skyline.
  const sketch = stepOf(lesson2, "l2-sketch");
  const window = sketch.kind === "draw-skyline" ? resolveSkylineWindow(sketch.window, ex) : null;
  if (!window || skylineInWindow(l2site.skyline.el_deg, window.fromDeg, window.toDeg).length === 0) out.push("l2-sketch: no stored skyline in its window");

  // The month the reveals play resolves, so nothing is drawn from a guessed month.
  if (resolveTimeRange(oneMonth("{{example.l1.example_utc}}"), ex, data.grid) === null) out.push("l1-directions: its month does not resolve");
  return out;
}

describe("each lesson's checks agree with the dataset it is played on", () => {
  it("the real derived data: every goal reachable, every correct answer true of the drawn data", () => {
    expect(disagreements(loadDataset("derived"))).toEqual([]);
  });

  // The fixture's worked examples are computed from the fixture's own series (Science, S2c).
  it("the fixture (VITE_DATA=fixtures): every goal reachable, every correct answer true of the drawn data", () => {
    expect(disagreements(loadDataset("fixtures"))).toEqual([]);
  });
});
