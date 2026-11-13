import type { GoalEvaluator } from "./evaluator";
import type { Lesson, Step, Submission } from "./types";

export const XP_FIRST = 10;
export const XP_SECOND = 5;
export const XP_REVEALED = 2;

export type RunnerPhase = "prompt" | "hint" | "correct" | "revealed" | "complete";

export type StepResult = "first" | "second" | "revealed";

export type RunnerState = {
  stepIndex: number;
  phase: RunnerPhase;
  /** Misses on the current step. Two misses reveal the answer. */
  misses: number;
  xp: number;
  results: readonly StepResult[];
  /** The answer text, set only while it is being shown. */
  shownAnswer: string | null;
  /** Learner-facing feedback for the current phase, or null while waiting. */
  feedback: string | null;
  stars: 0 | 1 | 2 | 3;
  patchEarned: boolean;
};

export type RunnerAction =
  | { type: "submit"; submission: Submission }
  | { type: "continue" };

export function initialRunnerState(): RunnerState {
  return {
    stepIndex: 0,
    phase: "prompt",
    misses: 0,
    xp: 0,
    results: [],
    shownAnswer: null,
    feedback: null,
    stars: 0,
    patchEarned: false,
  };
}

/** 3 if every step was right first time; 2 if at least 60% were; 1 otherwise. */
export function starsFor(firstTryCount: number, stepCount: number): 1 | 2 | 3 {
  if (stepCount <= 0) return 1;
  if (firstTryCount >= stepCount) return 3;
  if (firstTryCount / stepCount >= 0.6) return 2;
  return 1;
}

export function answerText(step: Step): string {
  switch (step.kind) {
    case "choice":
    case "predict":
    case "fill-formula":
      return step.options[step.answer] ?? "";
    case "spot-bug":
      return step.lines[step.buggyLine] ?? "";
    case "draw-skyline":
      return "Any sketch passes.";
    case "drag-body":
    case "drop-pin":
    case "tune-slider":
      return `${step.goal.metric} ${step.goal.op} ${step.goal.value}`;
  }
}

export function reduceRunner(
  state: RunnerState,
  action: RunnerAction,
  lesson: Lesson,
  evaluator: GoalEvaluator,
): RunnerState {
  if (action.type === "continue") return continueLesson(state, lesson);
  return submitAnswer(state, action.submission, lesson, evaluator);
}

function submitAnswer(
  state: RunnerState,
  submission: Submission,
  lesson: Lesson,
  evaluator: GoalEvaluator,
): RunnerState {
  if (state.phase !== "prompt" && state.phase !== "hint") return state;
  const step = lesson.steps[state.stepIndex];
  if (!step || submission.kind !== step.kind) return state;

  if (isCorrect(step, submission, evaluator)) {
    const firstTry = state.misses === 0;
    return {
      ...state,
      phase: "correct",
      xp: state.xp + (firstTry ? XP_FIRST : XP_SECOND),
      results: [...state.results, firstTry ? "first" : "second"],
      shownAnswer: null,
      feedback: `Correct. ${step.explain}`,
    };
  }

  if (state.misses === 0) {
    return {
      ...state,
      phase: "hint",
      misses: 1,
      shownAnswer: null,
      feedback: `Not quite. ${step.hint}`,
    };
  }

  const shownAnswer = answerText(step);
  return {
    ...state,
    phase: "revealed",
    misses: 2,
    xp: state.xp + XP_REVEALED,
    results: [...state.results, "revealed"],
    shownAnswer,
    feedback: `Not quite. The answer is ${shownAnswer}. ${step.explain}`,
  };
}

function continueLesson(state: RunnerState, lesson: Lesson): RunnerState {
  if (state.phase !== "correct" && state.phase !== "revealed") return state;
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= lesson.steps.length) {
    const firstTries = state.results.filter((result) => result === "first").length;
    return {
      ...state,
      phase: "complete",
      shownAnswer: null,
      feedback: null,
      stars: starsFor(firstTries, lesson.steps.length),
      patchEarned: true,
    };
  }
  return {
    ...state,
    stepIndex: nextIndex,
    phase: "prompt",
    misses: 0,
    shownAnswer: null,
    feedback: null,
  };
}

function isCorrect(step: Step, submission: Submission, evaluator: GoalEvaluator): boolean {
  switch (step.kind) {
    case "choice":
      return submission.kind === "choice" && submission.selected === step.answer;
    case "predict":
      return submission.kind === "predict" && submission.selected === step.answer;
    case "fill-formula":
      return submission.kind === "fill-formula" && submission.selected === step.answer;
    case "spot-bug":
      return submission.kind === "spot-bug" && submission.selected === step.buggyLine;
    case "draw-skyline":
      return submission.kind === "draw-skyline";
    case "drag-body":
    case "drop-pin":
    case "tune-slider": {
      if (submission.kind !== step.kind) return false;
      return evaluator.meetsGoal(step.goal, {
        stepId: step.id,
        kind: step.kind,
        value: submission.value,
      });
    }
  }
}
