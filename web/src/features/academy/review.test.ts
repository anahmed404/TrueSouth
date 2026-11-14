import { describe, expect, it } from "vitest";
import { createValueEvaluator } from "./evaluator";
import { lesson1 } from "./lessons/l1";
import { lesson2 } from "./lessons/l2";
import { canReview, progressMarks, reviewRunner, reviewTarget, SKIPPED_NOTE } from "./review";
import { initialRunnerState, reduceRunner, type RunnerAction, type RunnerState } from "./runner";
import { conversationFor, optionViews, primaryAction, resultFor } from "./step-view";
import { realExamples } from "./testing/real-site";
import type { Lesson, Step } from "./types";

const evaluator = createValueEvaluator();
const act = (state: RunnerState, action: RunnerAction, lesson: Lesson = lesson1) => reduceRunner(state, action, lesson, evaluator, realExamples);
const steps = lesson1.steps as readonly Step[];
const count = steps.length;

/** Lesson 1: step 1 missed then right, step 2's drag right first time. Now on step 3. */
function twoStepsIn(): RunnerState {
  let state = initialRunnerState();
  state = act(state, { type: "submit", submission: { kind: "choice", selected: 0 } });
  state = act(state, { type: "submit", submission: { kind: "choice", selected: 2 } });
  state = act(state, { type: "continue" });
  state = act(state, {
    type: "submit",
    submission: { kind: "drag-body", value: Number(realExamples["l1.sun_el_max_deg"]), utc: "2028-01-01T00:00:00Z" },
  });
  state = act(state, { type: "continue" });
  return state;
}

describe("the progress marks", () => {
  it("at the start: the first step is current, nothing is a control, the rest are not yet reached", () => {
    const marks = progressMarks(initialRunnerState(), count, null);
    expect(marks.map((mark) => mark.state)).toEqual(["current", "ahead", "ahead", "ahead", "ahead"]);
    expect(marks.some((mark) => mark.control)).toBe(false);
    expect(marks[0]?.label).toBe("Step 1 of 5, current step");
    expect(marks[1]?.label).toBe("Step 2 of 5, not yet reached");
  });

  it("mid-lesson: finished steps are review buttons, the current one is not, later ones never are", () => {
    const state = twoStepsIn();
    const marks = progressMarks(state, count, null);
    expect(marks.map((mark) => [mark.state, mark.control])).toEqual([
      ["done", true],
      ["done", true],
      ["current", false],
      ["ahead", false],
      ["ahead", false],
    ]);
    expect(marks[0]?.label).toBe("Step 1 of 5, completed. Review");
    expect(marks[2]?.shown).toBe(true);
  });

  it("an answered current step, waiting for Continue, is still the current step and not a review", () => {
    const answered = act(twoStepsIn(), { type: "submit", submission: { kind: "predict", selected: 1 } });
    expect(answered.phase).toBe("correct");
    const marks = progressMarks(answered, count, null);
    expect(marks[2]).toMatchObject({ state: "current", control: false });
    expect(canReview(answered, 2)).toBe(false);
  });

  it("while reviewing: the reviewed mark is shown and not a button, the current one goes back", () => {
    const marks = progressMarks(twoStepsIn(), count, 0);
    expect(marks[0]).toMatchObject({ state: "done", shown: true, control: false, label: "Step 1 of 5, completed, shown now" });
    expect(marks[1]).toMatchObject({ state: "done", control: true });
    expect(marks[2]).toMatchObject({ state: "current", shown: false, control: true, label: "Step 3 of 5, current step. Go back to it" });
    expect(marks[3]).toMatchObject({ state: "ahead", control: false });
  });

  it("at the last step every earlier step can be reviewed", () => {
    let state = twoStepsIn();
    state = act(state, { type: "submit", submission: { kind: "predict", selected: 1 } });
    state = act(state, { type: "continue" });
    state = act(state, { type: "submit", submission: { kind: "fill-formula", selected: 0 } });
    state = act(state, { type: "continue" });
    expect(state.stepIndex).toBe(4);
    expect(progressMarks(state, count, null).map((mark) => mark.control)).toEqual([true, true, true, true, false]);
  });
});

describe("no way to reach a step not yet reached", () => {
  it("a request to review the current step, a later one, or nonsense opens nothing", () => {
    const state = twoStepsIn();
    for (const index of [2, 3, 4, 99, -1, 1.5, Number.NaN]) {
      expect(reviewTarget(state, index), String(index)).toBeNull();
      expect(reviewRunner(state, index), String(index)).toBeNull();
    }
    expect(reviewTarget(state, 1)).toBe(1);
  });

  it("nothing is reviewed once the lesson is complete; the complete screen shows instead", () => {
    const done = { ...twoStepsIn(), phase: "complete" as const };
    expect(reviewTarget(done, 0)).toBeNull();
  });
});

describe("a reviewed step shows what the learner did, and awards nothing", () => {
  it("step 1: both answers, the hint, the right answer, its 5 XP, read-only", () => {
    const state = twoStepsIn();
    const view = reviewRunner(state, 0);
    if (!view) throw new Error("step 1 can be reviewed");
    const step = steps[0];
    if (!step) throw new Error("step");
    expect(view.phase).toBe("correct");
    expect(view.attempts).toEqual([
      { kind: "choice", selected: 0 },
      { kind: "choice", selected: 2 },
    ]);
    const said = conversationFor(step, view).map((entry) => entry.text);
    expect(said).toContain(`Not quite. ${step.hint}`);
    expect(said).toContain(step.explain);
    expect(resultFor(step, view)).toEqual({ tone: "correct", headline: "Correct", xp: 5 });
    expect(optionViews(step, view, null).map((option) => option.state)).toEqual(["missed", "dimmed", "answer"]);
    // An answered view offers no Check, so nothing could be submitted from it.
    expect(primaryAction(step, view, null, false).kind).toBe("continue");
    // The lesson's own state is untouched: same XP, same step, same results.
    expect(view.xp).toBe(state.xp);
    expect(state.stepIndex).toBe(2);
    expect(state.xp).toBe(15);
    expect(state.results).toEqual(["second", "first"]);
  });

  it("step 2: the drag's checked value and time, right first time", () => {
    const view = reviewRunner(twoStepsIn(), 1);
    const step = steps[1];
    if (!view || !step) throw new Error("step 2");
    expect(view.attempts).toEqual([{ kind: "drag-body", value: 0.63, utc: "2028-01-01T00:00:00Z" }]);
    expect(conversationFor(step, view)[1]).toMatchObject({ who: "me", text: "0.63° at 2028-01-01 00:00 UTC", miss: false });
    expect(resultFor(step, view)?.xp).toBe(10);
  });

  it("the sketch step: the sketch, its gap and its XP", () => {
    let state: RunnerState = { ...initialRunnerState(), stepIndex: 2 };
    const sketch = [
      { azDeg: 60.25, elDeg: 0 },
      { azDeg: 120.25, elDeg: 1 },
    ];
    state = act(state, { type: "submit", submission: { kind: "draw-skyline", sketch, gapDeg: 0.8 } }, lesson2);
    state = act(state, { type: "continue" }, lesson2);
    const view = reviewRunner(state, 2);
    expect(view?.attempts).toEqual([{ kind: "draw-skyline", sketch, gapDeg: 0.8 }]);
    expect(view?.stepXp).toBe(7);
    expect(view?.feedback).toMatch(/^A close sketch\. Your average gap is 0\.8°/);
  });

  it("a step passed through its holding form says so, with 0 XP", () => {
    let state: RunnerState = { ...initialRunnerState(), stepIndex: 1 };
    state = act(state, { type: "skip" });
    const view = reviewRunner(state, 1);
    expect(view).toMatchObject({ phase: "unavailable", stepXp: 0, feedback: SKIPPED_NOTE });
  });

  it("replaying the runner's own actions after a review gives the same lesson: reviews are not actions", () => {
    const state = twoStepsIn();
    reviewRunner(state, 0);
    reviewRunner(state, 1);
    const next = act(state, { type: "submit", submission: { kind: "predict", selected: 1 } });
    expect(next.xp).toBe(25);
    expect(next.history).toHaveLength(2);
  });
});
