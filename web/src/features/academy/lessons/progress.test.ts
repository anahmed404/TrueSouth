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
  throw new Error(`no pick for ${step.kind}`);
}

/** Plays a lesson: each scored step missed first when `missFirst`, panel steps continued past. */
function play(lesson: Lesson, missFirst: boolean, stopAfter = Number.POSITIVE_INFINITY): RunnerState {
  let state = initialRunnerState();
  const steps: readonly Step[] = lesson.steps;
  for (let index = 0; index < steps.length && index < stopAfter; index += 1) {
    const step = steps[index];
    if (!step) break;
    if (PANEL_STEP_KINDS.includes(step.kind)) {
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
    // choice 5, panel 0, predict shown 2, formula 5, choice 5.
    expect(done.xp).toBe(17);
    expect(done.results).toEqual(["second", "skipped", "revealed", "second", "second"]);
    expect(done.stars).toBe(1);
    expect(done.patchEarned).toBe(true);
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
    expect(store.getState().xp).toBe(17);
    expect(save(play(lesson1, false))).toBe(true);
    expect(store.getState().xp).toBe(40);
    expect(store.getState().lessons[lesson1.id]).toEqual({ stars: 3, xp: 40, patch: true });
    expect(save(play(lesson1, true))).toBe(true);
    expect(store.getState().xp).toBe(40);
    expect(store.getState().lessons[lesson1.id]?.stars).toBe(3);

    const reloaded = createAcademyStore(storage);
    expect(reloaded.getState().xp).toBe(40);
    expect(reloaded.getState().patches).toEqual([lesson1.id]);
  });
});
