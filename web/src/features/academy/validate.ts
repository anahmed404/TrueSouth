import { metricColumn } from "./drag-body";
import { hasExample, resolveValue, type WorkedExamples } from "./placeholders";
import { clockwiseWidthDeg } from "./skyline-score";
import type { GoalSpec, Lesson, Step } from "./types";
import { FIXTURE_TIME_GRID, hourOnGrid, parseUtcHour } from "./utc";
import type { TimeGrid } from "../../contracts/generated.ts";
import { PANEL_IDS } from "./ui/panels";
import { WORKED_EXAMPLE_KEYS } from "./worked-example-keys";

export type LessonCheck = {
  exampleKeys: ReadonlySet<string>;
  panels: ReadonlySet<string>;
  grid: TimeGrid;
  examples: WorkedExamples;
};

/** The check used when a lesson is opened. Sample toy keys are allowed on the sample lesson only. */
export function lessonCheck(examples: WorkedExamples = {}): LessonCheck {
  return {
    exampleKeys: new Set(WORKED_EXAMPLE_KEYS),
    panels: new Set(PANEL_IDS),
    grid: FIXTURE_TIME_GRID,
    examples,
  };
}

const EXAMPLE_KEY = /\{\{example\.([^}]+)\}\}/g;
const DATE_LITERAL = /^\d{4}-\d{2}-\d{2}T/;

function onNumberStep(value: number, min: number, step: number): boolean {
  if (!Number.isFinite(value) || !Number.isFinite(min) || !Number.isFinite(step) || step <= 0) return false;
  const steps = (value - min) / step;
  return Math.abs(steps - Math.round(steps)) < 1e-9;
}

function walkStrings(value: unknown, visit: (text: string, path: string) => void, path: string): void {
  if (typeof value === "string") {
    visit(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => walkStrings(item, visit, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) walkStrings(item, visit, `${path}.${key}`);
  }
}

function pushPanel(problems: string[], panels: ReadonlySet<string>, id: string, where: string): void {
  if (!panels.has(id)) problems.push(`${where} names a panel that does not exist: ${id}`);
}

function checkTolerance(problems: string[], goal: GoalSpec, where: string): void {
  if (!("tolerance" in goal) || goal.tolerance === undefined) return;
  if (!Number.isFinite(goal.tolerance) || goal.tolerance < 0) {
    problems.push(`${where} has a negative or non-finite tolerance`);
  }
}

/**
 * A goal's second condition is read from a stored series column at the dragged hour, so its
 * metric must be one the series has and its value a number. Only a drag-body step may carry
 * one: no other attempt has the values to check it.
 */
function checkAlso(problems: string[], step: Step, check: LessonCheck, where: string): void {
  const goal = "goal" in step ? step.goal : undefined;
  if (!goal || "comparedTo" in goal || !goal.also) return;
  if (step.kind !== "drag-body") {
    problems.push(`${where} has a second goal condition, which only a drag-body step can check`);
    return;
  }
  if (metricColumn(goal.also.metric) === null) {
    problems.push(`${where} has a second goal condition on a metric the series does not store: ${goal.also.metric}`);
  }
  const value = resolveValue(goal.also.value, check.examples).value;
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    problems.push(`${where} has a second goal condition whose value is not a finite number`);
  }
}

function checkSlider(problems: string[], step: Extract<Step, { kind: "tune-slider" }>, check: LessonCheck): void {
  const where = `step ${step.id}`;
  checkTolerance(problems, step.goal, where);
  if ("comparedTo" in step.goal) return;
  const resolved = resolveValue(step.goal.value, check.examples);
  if (resolved.value === null) return;
  if (step.slider.kind === "number") {
    if (typeof resolved.value !== "number" || !Number.isFinite(resolved.value)) {
      problems.push(`${where} has a number slider whose goal is not a finite number`);
      return;
    }
    const { min, max, step: stride } = step.slider;
    if (!(stride > 0) || !Number.isFinite(min) || !Number.isFinite(max) || min > max) {
      problems.push(`${where} has a number slider whose range is not usable`);
      return;
    }
    if (resolved.value < min || resolved.value > max) {
      problems.push(`${where} has a goal outside the slider range`);
    }
    if (!onNumberStep(resolved.value, min, stride)) {
      problems.push(`${where} has a goal that is not on a slider step`);
    }
    return;
  }
  const goalHour = typeof resolved.value === "string" ? hourOnGrid(check.grid, resolved.value) : null;
  const minHour = hourOnGrid(check.grid, step.slider.minUtc);
  const maxHour = hourOnGrid(check.grid, step.slider.maxUtc);
  if (goalHour === null || minHour === null || maxHour === null) {
    problems.push(`${where} has a date slider whose goal or ends are not hours on the time grid`);
    return;
  }
  if (goalHour < minHour || goalHour > maxHour) problems.push(`${where} has a goal outside the slider range`);
  const stride = (step.slider.stepDays * 86400) / check.grid.step_s;
  if (!Number.isInteger(stride) || stride <= 0 || (goalHour - minHour) % stride !== 0) {
    problems.push(`${where} has a goal that is not on a slider step`);
  }
}

function checkWindow(problems: string[], step: Extract<Step, { kind: "draw-skyline" }>, check: LessonCheck): void {
  const where = `step ${step.id}`;
  if (step.window.kind === "centred") {
    const width = step.window.halfWidthDeg * 2;
    if (!Number.isFinite(width) || width < 10) {
      problems.push(`${where} has a draw-skyline window narrower than 10°`);
    }
    return;
  }
  const from = resolveValue(step.window.from, check.examples).value;
  const to = resolveValue(step.window.to, check.examples).value;
  if (typeof from !== "number" || typeof to !== "number") return;
  const width = clockwiseWidthDeg(from, to);
  if (!Number.isFinite(width) || width < 10) {
    problems.push(`${where} has a draw-skyline window narrower than 10°`);
  }
}

/**
 * Problems that make a lesson unsafe to play. An empty list means it can open.
 * A worked-example key must be in the contract. The sample lesson may also use
 * its own `sample.*` toy keys. Dates must be UTC hours on the time grid.
 */
export function validateLesson(lesson: Lesson, check: LessonCheck): readonly string[] {
  const problems: string[] = [];
  const unlocks = typeof lesson.unlocks === "string" ? [lesson.unlocks] : lesson.unlocks;
  if (unlocks.length === 0) problems.push("the lesson unlocks no panel");
  for (const panel of unlocks) pushPanel(problems, check.panels, panel, "unlocks");

  for (const step of lesson.steps) {
    const where = `step ${step.id}`;
    if (step.hint.trim() === "") problems.push(`${where} has no hint`);
    if (step.explain.trim() === "") problems.push(`${where} has no explanation`);
    if (step.kind === "drag-body") pushPanel(problems, check.panels, step.panel, where);
    if (step.kind === "predict" && step.reveal.kind === "panel") pushPanel(problems, check.panels, step.reveal.panel, where);
    if (step.kind === "tune-slider") {
      if (step.slider.panel) pushPanel(problems, check.panels, step.slider.panel, where);
      checkSlider(problems, step, check);
      const readout = step.slider.kind === "number" ? step.slider.readout : undefined;
      if (readout?.kind === "example-list" && !check.exampleKeys.has(readout.key)) {
        problems.push(`${where} reads a worked-example list that is not in the contract: ${readout.key}`);
      }
    }
    if (step.kind === "drop-pin" && step.map.aside) pushPanel(problems, check.panels, step.map.aside, where);
    if (step.kind === "draw-skyline") checkWindow(problems, step, check);
    checkAlso(problems, step, check, where);
    if (step.kind === "drag-body" || step.kind === "drop-pin") {
      if (step.kind === "drop-pin" && step.goal) checkTolerance(problems, step.goal, where);
      if (step.kind === "drag-body") checkTolerance(problems, step.goal, where);
    }
  }

  walkStrings(lesson, (text, path) => {
    if (DATE_LITERAL.test(text) && (parseUtcHour(text) === null || hourOnGrid(check.grid, text) === null)) {
      problems.push(`${path} is not a UTC hour on the time grid: ${text}`);
    }
    for (const match of text.matchAll(EXAMPLE_KEY)) {
      const key = match[1] ?? "";
      if (lesson.id === "sample" && key.startsWith("sample.")) continue;
      if (!check.exampleKeys.has(key)) problems.push(`${path} uses a worked-example key that is not in the contract: ${key}`);
    }
  }, "lesson");

  return problems;
}

/**
 * Worked-example keys the lesson needs that `examples` has no usable value for: absent,
 * null, NaN, an empty string and so on (see `hasExample`). A lesson with any of these must
 * not open, or the learner would see a raw placeholder.
 */
export function missingExampleKeys(lesson: Lesson, examples: WorkedExamples): string[] {
  const keys = new Set<string>();
  walkStrings(lesson, (text) => {
    for (const match of text.matchAll(EXAMPLE_KEY)) keys.add(match[1] ?? "");
  }, "lesson");
  for (const step of lesson.steps) {
    if (step.kind === "tune-slider" && step.slider.kind === "number" && step.slider.readout?.kind === "example-list") {
      keys.add(step.slider.readout.key);
    }
  }
  return [...keys].filter((key) => !hasExample(examples, key)).sort();
}

/** What to show when the lesson is opened. A lesson that fails validation uses the unwritten screen. */
export function lessonScreenKind(lesson: Lesson, check: LessonCheck): "play" | "unwritten" {
  return validateLesson(lesson, check).length === 0 ? "play" : "unwritten";
}

