import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createValueEvaluator } from "../evaluator";
import type { WorkedExamples } from "../placeholders";
import {
  commitLessonProgress,
  initialRunnerState,
  needsLeaveCheck,
  PANEL_STEP_KINDS,
  PENDING_STEP_KINDS,
  reduceRunner,
  type RunnerState,
} from "../runner";
import { createAcademyStore, type AcademyStorage } from "../store";
import type { Lesson, Step, Submission } from "../types";
import { lesson1 } from "./l1";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const real = JSON.parse(readFileSync(`${repoRoot}data/derived/academy/worked_examples.json`, "utf8")) as WorkedExamples;
const evaluator = createValueEvaluator();

function memory(): AcademyStorage {
  const values = new Map<string, string>();
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => void values.set(key, value),
    removeItem: (key) => void values.delete(key),
  };
}

function pick(step: Step, right: boolean): Submission {
  if (step.kind === "spot-bug") return { kind: "spot-bug", selected: right ? step.buggyLine : (step.buggyLine + 1) % step.lines.length };
  if (step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula") {
    const answer = typeof step.answer === "number" ? step.answer : 0;
    return { kind: step.kind, selected: right ? answer : (answer + 1) % step.options.length };
  }
  if (step.kind === "drag-body" && step.id === "l1-highest") {
    // The stored value at the hour the learner settles on: the month's highest, or its lowest.
    return { kind: "drag-body", value: Number(real[right ? "l1.sun_el_max_deg" : "l1.sun_el_min_deg"]), utc: right ? "a" : "b" };
  }
  throw new Error(`no pick for ${step.kind}`);
}

/**
 * Plays a lesson: each step missed first when `missFirst`. A panel step is played, or passed
 * through its holding form ("Continue") when `skipPanels`, as when its data does not load.
 */
function play(lesson: Lesson, missFirst: boolean, stopAfter = Number.POSITIVE_INFINITY, skipPanels = false): RunnerState {
  let state = initialRunnerState();
  const steps: readonly Step[] = lesson.steps;
  for (let index = 0; index < steps.length && index < stopAfter; index += 1) {
    const step = steps[index];
    if (!step) break;
    if (PENDING_STEP_KINDS.includes(step.kind) || (skipPanels && PANEL_STEP_KINDS.includes(step.kind))) {
      state = reduceRunner(state, { type: "skip" }, lesson, evaluator, real);
      continue;
    }
    if (missFirst) state = reduceRunner(state, { type: "submit", submission: pick(step, false) }, lesson, evaluator, real);
    if (state.phase === "prompt" || state.phase === "hint") {
      state = reduceRunner(state, { type: "submit", submission: pick(step, true) }, lesson, evaluator, real);
    }
    state = reduceRunner(state, { type: "continue" }, lesson, evaluator, real);
  }
  return state;
}

describe("progress through lesson 1", () => {
  it("wrong then right everywhere: second-try XP, a shown prediction, 1 star, the patch", () => {
    const done = play(lesson1, true);
    expect(done.phase).toBe("complete");
    // choice 5, drag 5, predict shown 2, formula 5, choice 5.
    expect(done.xp).toBe(22);
    expect(done.results).toEqual(["second", "second", "revealed", "second", "second"]);
    expect(done.stars).toBe(1);
    expect(done.patchEarned).toBe(true);
  });

  it("right first time everywhere, the drag included: 50 XP and 3 stars", () => {
    const done = play(lesson1, false);
    expect(done.xp).toBe(50);
    expect(done.results).toEqual(["first", "first", "first", "first", "first"]);
    expect(done.stars).toBe(3);
  });

  it("a drag step passed through its failed-load fallback earns no XP and is left out of the stars", () => {
    const done = play(lesson1, false, Number.POSITIVE_INFINITY, true);
    expect(done.xp).toBe(40);
    expect(done.results).toEqual(["first", "skipped", "first", "first", "first"]);
    expect(done.stars).toBe(3);
  });

  it("quitting mid-lesson saves nothing, and asks first", () => {
    const halfway = play(lesson1, false, 2);
    expect(halfway.phase).not.toBe("complete");
    expect(needsLeaveCheck(halfway)).toBe(true);
    const store = createAcademyStore(memory());
    expect(commitLessonProgress(halfway, (record) => store.getState().recordCompletion(lesson1.id, record.stars, record.xp, record.patch))).toBe(false);
    expect(store.getState().xp).toBe(0);
    expect(store.getState().lessons).toEqual({});
  });

  it("a replay keeps the best stars and XP, never adds them twice, and a reload keeps them", () => {
    const storage = memory();
    const store = createAcademyStore(storage);
    const save = (state: RunnerState) =>
      commitLessonProgress(state, (record) => store.getState().recordCompletion(lesson1.id, record.stars, record.xp, record.patch));

    expect(save(play(lesson1, true))).toBe(true);
    expect(store.getState().xp).toBe(22);
    expect(save(play(lesson1, false))).toBe(true);
    expect(store.getState().xp).toBe(50);
    expect(store.getState().lessons[lesson1.id]).toEqual({ stars: 3, xp: 50, patch: true });
    expect(save(play(lesson1, true))).toBe(true);
    expect(store.getState().xp).toBe(50);
    expect(store.getState().lessons[lesson1.id]?.stars).toBe(3);

    const reloaded = createAcademyStore(storage);
    expect(reloaded.getState().xp).toBe(50);
    expect(reloaded.getState().patches).toEqual([lesson1.id]);
  });
});
