import { describe, expect, it } from "vitest";
import type { GoalEvaluator } from "./evaluator";
import {
  initialRunnerState,
  reduceRunner,
  type RunnerState,
} from "./runner";
import { createStubEvaluator } from "./stub-evaluator";
import type { GoalSpec, Lesson, Step, Submission } from "./types";

const yes = createStubEvaluator(true);
const no = createStubEvaluator(false);

function lessonWith(steps: readonly Step[]): Lesson {
  return {
    id: "fixture",
    title: "Fixture",
    tagline: "Fixture",
    patch: { name: "Fixture patch", art: "fixture" },
    unlocks: "SystemView",
    recap: "Fixture recap.",
    card: "fixture",
    steps,
  };
}

function choiceStep(id: string): Step {
  return {
    id,
    luna: { mood: "thinking", says: "Pick the first." },
    hint: "Try the first option.",
    explain: "The first option is the one.",
    kind: "choice",
    options: ["first", "second"],
    answer: 0,
  };
}

const correctChoice: Submission = { kind: "choice", selected: 0 };
const wrongChoice: Submission = { kind: "choice", selected: 1 };

function submit(state: RunnerState, submission: Submission, lesson: Lesson, evaluator: GoalEvaluator = yes) {
  return reduceRunner(state, { type: "submit", submission }, lesson, evaluator);
}

function cont(state: RunnerState, lesson: Lesson, evaluator: GoalEvaluator = yes) {
  return reduceRunner(state, { type: "continue" }, lesson, evaluator);
}

describe("feedback flow", () => {
  const lesson = lessonWith([choiceStep("one"), choiceStep("two")]);

  it("starts on the first step, waiting for an answer", () => {
    const state = initialRunnerState();
    expect(state).toMatchObject({
      stepIndex: 0,
      phase: "prompt",
      misses: 0,
      xp: 0,
      stars: 0,
      patchEarned: false,
      feedback: null,
    });
  });

  it("marks a first-try correct answer and awards 10 XP", () => {
    const state = submit(initialRunnerState(), correctChoice, lesson);
    expect(state.phase).toBe("correct");
    expect(state.xp).toBe(10);
    expect(state.results).toEqual(["first"]);
    expect(state.feedback).toBe("Correct. The first option is the one.");
    expect(state.shownAnswer).toBeNull();
    expect(state.stepIndex).toBe(0);
  });

  it("shows a hint on the first miss and stays on the step", () => {
    const state = submit(initialRunnerState(), wrongChoice, lesson);
    expect(state.phase).toBe("hint");
    expect(state.misses).toBe(1);
    expect(state.xp).toBe(0);
    expect(state.results).toEqual([]);
    expect(state.stepIndex).toBe(0);
    expect(state.shownAnswer).toBeNull();
    expect(state.feedback).toBe("Not quite. Try the first option.");
  });

  it("awards 5 XP when the second try is correct", () => {
    const hinted = submit(initialRunnerState(), wrongChoice, lesson);
    const state = submit(hinted, correctChoice, lesson);
    expect(state.phase).toBe("correct");
    expect(state.xp).toBe(5);
    expect(state.results).toEqual(["second"]);
    expect(state.feedback).toBe("Correct. The first option is the one.");
  });

  it("shows the answer after two misses and awards 2 XP", () => {
    const hinted = submit(initialRunnerState(), wrongChoice, lesson);
    const state = submit(hinted, wrongChoice, lesson);
    expect(state.phase).toBe("revealed");
    expect(state.misses).toBe(2);
    expect(state.xp).toBe(2);
    expect(state.results).toEqual(["revealed"]);
    expect(state.shownAnswer).toBe("first");
    expect(state.feedback).toBe("Not quite. The answer is first. The first option is the one.");
    expect(state.stepIndex).toBe(0);
  });

  it("moves on after a correct answer when the learner continues", () => {
    const answered = submit(initialRunnerState(), correctChoice, lesson);
    const state = cont(answered, lesson);
    expect(state.phase).toBe("prompt");
    expect(state.stepIndex).toBe(1);
    expect(state.misses).toBe(0);
    expect(state.feedback).toBeNull();
    expect(state.xp).toBe(10);
  });

  it("moves on after the answer is shown when the learner continues", () => {
    const hinted = submit(initialRunnerState(), wrongChoice, lesson);
    const revealed = submit(hinted, wrongChoice, lesson);
    const state = cont(revealed, lesson);
    expect(revealed.phase).toBe("revealed");
    expect(state.phase).toBe("prompt");
    expect(state.stepIndex).toBe(1);
    expect(state.misses).toBe(0);
    expect(state.xp).toBe(2);
  });

  it("ignores Check while feedback is showing, and Continue while the learner is still answering", () => {
    const start = initialRunnerState();
    expect(cont(start, lesson)).toBe(start);

    const hinted = submit(start, wrongChoice, lesson);
    expect(cont(hinted, lesson)).toBe(hinted);

    const correct = submit(start, correctChoice, lesson);
    expect(submit(correct, wrongChoice, lesson)).toBe(correct);

    const revealed = submit(hinted, wrongChoice, lesson);
    expect(submit(revealed, correctChoice, lesson)).toBe(revealed);
  });

  it("ignores a submission for a different step kind", () => {
    const start = initialRunnerState();
    const state = submit(start, { kind: "spot-bug", selected: 0 }, lesson);
    expect(state).toBe(start);
  });
});

describe("two misses", () => {
  it("does not accept a third try, then continue leaves the step", () => {
    const lesson = lessonWith([choiceStep("one"), choiceStep("two")]);
    const hinted = submit(initialRunnerState(), wrongChoice, lesson);
    const revealed = submit(hinted, wrongChoice, lesson);
    expect(submit(revealed, correctChoice, lesson)).toBe(revealed);
    const next = cont(revealed, lesson);
    expect(next.stepIndex).toBe(1);
    expect(next.phase).toBe("prompt");
  });
});

describe("lesson completion", () => {
  it("awards 3 stars and 10 XP per step for a perfect run, and the mission patch", () => {
    const lesson = lessonWith([choiceStep("a"), choiceStep("b"), choiceStep("c"), choiceStep("d"), choiceStep("e")]);
    let state = initialRunnerState();
    for (let index = 0; index < lesson.steps.length; index += 1) {
      state = submit(state, correctChoice, lesson);
      state = cont(state, lesson);
    }
    expect(state.phase).toBe("complete");
    expect(state.xp).toBe(50);
    expect(state.stars).toBe(3);
    expect(state.patchEarned).toBe(true);
    expect(state.results).toEqual(["first", "first", "first", "first", "first"]);
  });

  it("awards 2 stars when 60% of steps were right first time", () => {
    const lesson = lessonWith([choiceStep("a"), choiceStep("b"), choiceStep("c"), choiceStep("d"), choiceStep("e")]);
    let state = initialRunnerState();
    state = cont(submit(state, correctChoice, lesson), lesson);
    state = cont(submit(submit(state, wrongChoice, lesson), correctChoice, lesson), lesson);
    state = cont(submit(submit(state, wrongChoice, lesson), wrongChoice, lesson), lesson);
    state = cont(submit(state, correctChoice, lesson), lesson);
    state = cont(submit(state, correctChoice, lesson), lesson);
    expect(state.phase).toBe("complete");
    expect(state.xp).toBe(37);
    expect(state.stars).toBe(2);
    expect(state.patchEarned).toBe(true);
    expect(state.results).toEqual(["first", "second", "revealed", "first", "first"]);
  });

  it("awards 1 star when fewer than 60% were right first time", () => {
    const lesson = lessonWith([choiceStep("a"), choiceStep("b"), choiceStep("c"), choiceStep("d"), choiceStep("e")]);
    let state = initialRunnerState();
    state = cont(submit(state, correctChoice, lesson), lesson);
    state = cont(submit(state, correctChoice, lesson), lesson);
    for (let index = 0; index < 3; index += 1) {
      state = cont(submit(submit(state, wrongChoice, lesson), wrongChoice, lesson), lesson);
    }
    expect(state.phase).toBe("complete");
    expect(state.xp).toBe(26);
    expect(state.stars).toBe(1);
    expect(state.patchEarned).toBe(true);
  });

  it("completes from a revealed last step", () => {
    const lesson = lessonWith([choiceStep("only")]);
    const revealed = submit(submit(initialRunnerState(), wrongChoice, lesson), wrongChoice, lesson);
    const state = cont(revealed, lesson);
    expect(state.phase).toBe("complete");
    expect(state.stars).toBe(1);
    expect(state.xp).toBe(2);
    expect(state.patchEarned).toBe(true);
    expect(submit(state, correctChoice, lesson)).toBe(state);
    expect(cont(state, lesson)).toBe(state);
  });
});

describe("goal steps", () => {
  const goal: GoalSpec = { metric: "sample_marker", op: ">=", value: 1 };
  const step: Step = {
    id: "goal",
    luna: { mood: "thinking", says: "Move it." },
    hint: "Try the other way.",
    explain: "That meets the goal.",
    kind: "tune-slider",
    slider: { min: 0, max: 2, step: 1, unit: "steps" },
    goal,
  };
  const lesson = lessonWith([step]);
  const attempt: Submission = { kind: "tune-slider", value: 2 };

  it("asks the evaluator and awards a first-try pass", () => {
    let asked = 0;
    const evaluator: GoalEvaluator = {
      meetsGoal(received, goalAttempt) {
        asked += 1;
        expect(received).toEqual(goal);
        expect(goalAttempt).toEqual({ stepId: "goal", kind: "tune-slider", value: 2 });
        return true;
      },
    };
    const state = submit(initialRunnerState(), attempt, lesson, evaluator);
    expect(asked).toBe(1);
    expect(state.phase).toBe("correct");
    expect(state.xp).toBe(10);
  });

  it("reveals the goal when the evaluator says it was missed twice", () => {
    const revealed = submit(submit(initialRunnerState(), attempt, lesson, no), attempt, lesson, no);
    expect(revealed.phase).toBe("revealed");
    expect(revealed.xp).toBe(2);
    expect(revealed.shownAnswer).toBe("sample_marker >= 1");
  });

  it("passes every skyline sketch", () => {
    const sketchLesson = lessonWith([
      {
        id: "sketch",
        luna: { mood: "thinking", says: "Sketch." },
        hint: "Any sketch.",
        explain: "Passed.",
        kind: "draw-skyline",
        scene: {
          scenario: {
            profile: { id: "sample" },
            siteIds: ["sample-site"],
            focusedSiteId: "sample-site",
            landingUtc: "2028-01-01T00:00:00Z",
            currentUtc: "2028-01-01T00:00:00Z",
          },
        },
        azFrom: 0,
        azTo: 1,
      },
    ]);
    const state = submit(initialRunnerState(), { kind: "draw-skyline", sketch: [] }, sketchLesson, no);
    expect(state.phase).toBe("correct");
    expect(state.xp).toBe(10);
  });
});
