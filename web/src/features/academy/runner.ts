import type { GoalAttempt, GoalEvaluator, ResolvedGoal } from "./evaluator";
import { resolveValue, type WorkedExamples } from "./placeholders";
import { skylineRightFirstTime, skylineXp } from "./skyline-score";
import type { GoalSpec, Lesson, Step, StepKind, Submission } from "./types";

/** XP rules: docs/academy/overview.md, "Game rules". */
export const XP_FIRST = 10;
export const XP_SECOND = 5;
export const XP_REVEALED = 2;

/**
 * Step kinds that embed a Mission Control panel. Their components are work package A3.
 * Until then the lesson screen shows a placeholder for them, and the learner may skip
 * the step for no XP. A skipped step does not count for or against the stars.
 */
export const PANEL_STEP_KINDS: readonly StepKind[] = ["drag-body", "draw-skyline", "drop-pin"];

export type RunnerPhase = "prompt" | "hint" | "correct" | "revealed" | "complete";

/**
 * How a step ended.
 * - first, second: right on the first or second try;
 * - revealed: the answer was shown (two misses, or a wrong prediction);
 * - sketched: a skyline sketch further than 1.0° from the real one;
 * - skipped: a panel step skipped until A3 builds it.
 */
export type StepResult = "first" | "second" | "revealed" | "sketched" | "skipped";

export type RunnerState = {
  stepIndex: number;
  phase: RunnerPhase;
  /** Misses on the current step. Two misses reveal the answer. */
  misses: number;
  xp: number;
  results: readonly StepResult[];
  /** Every submission on the current step, oldest first. Cleared on Continue. */
  attempts: readonly Submission[];
  /** XP the current step earned, once it is answered; null while waiting. */
  stepXp: number | null;
  /** The answer text, set only while it is being shown. */
  shownAnswer: string | null;
  /** Learner-facing feedback for the current phase, or null while waiting. */
  feedback: string | null;
  stars: 0 | 1 | 2 | 3;
  patchEarned: boolean;
};

export type RunnerAction =
  | { type: "submit"; submission: Submission }
  | { type: "continue" }
  | { type: "skip" };

export function initialRunnerState(): RunnerState {
  return {
    stepIndex: 0,
    phase: "prompt",
    misses: 0,
    xp: 0,
    results: [],
    attempts: [],
    stepXp: null,
    shownAnswer: null,
    feedback: null,
    stars: 0,
    patchEarned: false,
  };
}

/** 3 if every step was right first time; 2 if at least 60% were; 1 otherwise. */
export function starsFor(firstTryCount: number, stepCount: number): 1 | 2 | 3 {
  if (stepCount <= 0) return 3;
  if (firstTryCount >= stepCount) return 3;
  if (firstTryCount / stepCount >= 0.6) return 2;
  return 1;
}

/** Steps that count for stars, and how many of them were right first time. */
export function firstTimeTally(results: readonly StepResult[]): { first: number; scored: number } {
  const scored = results.filter((result) => result !== "skipped");
  return { first: scored.filter((result) => result === "first").length, scored: scored.length };
}

function goalAnswer(goal: GoalSpec | undefined, label: string | undefined): string {
  if (label) return label;
  if (!goal) return "Any pin passes.";
  return `${goal.metric} ${goal.op} ${goal.value}`;
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
    case "tune-slider":
      return goalAnswer(step.goal, step.answerLabel);
    case "drop-pin":
      return goalAnswer(step.goal, step.answerLabel);
  }
}

export function reduceRunner(
  state: RunnerState,
  action: RunnerAction,
  lesson: Lesson,
  evaluator: GoalEvaluator,
  examples: WorkedExamples = {},
): RunnerState {
  if (action.type === "continue") return continueLesson(state, lesson);
  if (action.type === "skip") return skipStep(state, lesson);
  return submitAnswer(state, action.submission, lesson, evaluator, examples);
}

/**
 * True when closing the lesson now would lose something: the learner has answered at
 * least once and the lesson is not complete. Leaving drops the lesson's progress, so the
 * screen asks first.
 */
export function needsLeaveCheck(state: RunnerState): boolean {
  if (state.phase === "complete") return false;
  return state.stepIndex > 0 || state.attempts.length > 0;
}

function submitAnswer(
  state: RunnerState,
  submission: Submission,
  lesson: Lesson,
  evaluator: GoalEvaluator,
  examples: WorkedExamples,
): RunnerState {
  if (state.phase !== "prompt" && state.phase !== "hint") return state;
  const step = lesson.steps[state.stepIndex];
  if (!step || submission.kind !== step.kind) return state;
  const attempts = [...state.attempts, submission];

  if (step.kind === "draw-skyline" && submission.kind === "draw-skyline") {
    const xp = skylineXp(submission.gapDeg);
    const close = skylineRightFirstTime(submission.gapDeg);
    const gap = Number.isFinite(submission.gapDeg) ? `${submission.gapDeg.toFixed(1)}°` : "unknown";
    return {
      ...state,
      phase: "correct",
      attempts,
      xp: state.xp + xp,
      stepXp: xp,
      results: [...state.results, close ? "first" : "sketched"],
      shownAnswer: null,
      feedback: `${close ? "A close sketch." : "Every sketch counts."} Your average gap is ${gap}. ${step.explain}`,
    };
  }

  if (isCorrect(step, submission, evaluator, examples)) {
    const firstTry = state.misses === 0;
    const xp = firstTry ? XP_FIRST : XP_SECOND;
    return {
      ...state,
      phase: "correct",
      attempts,
      xp: state.xp + xp,
      stepXp: xp,
      results: [...state.results, firstTry ? "first" : "second"],
      shownAnswer: null,
      feedback: `Correct. ${step.explain}`,
    };
  }

  // A prediction gets one guess: a wrong one is played out at once, like a shown answer.
  if (state.misses === 0 && step.kind !== "predict") {
    return {
      ...state,
      phase: "hint",
      attempts,
      misses: 1,
      shownAnswer: null,
      feedback: `Not quite. ${step.hint}`,
    };
  }

  const shownAnswer = answerText(step);
  return {
    ...state,
    phase: "revealed",
    attempts,
    misses: state.misses + 1,
    xp: state.xp + XP_REVEALED,
    stepXp: XP_REVEALED,
    results: [...state.results, "revealed"],
    shownAnswer,
    feedback: `Not quite. The answer is ${shownAnswer}. ${step.explain}`,
  };
}

function skipStep(state: RunnerState, lesson: Lesson): RunnerState {
  if (state.phase !== "prompt" && state.phase !== "hint") return state;
  const step = lesson.steps[state.stepIndex];
  if (!step || !PANEL_STEP_KINDS.includes(step.kind)) return state;
  return advance({ ...state, results: [...state.results, "skipped"] }, lesson);
}

function continueLesson(state: RunnerState, lesson: Lesson): RunnerState {
  if (state.phase !== "correct" && state.phase !== "revealed") return state;
  return advance(state, lesson);
}

function advance(state: RunnerState, lesson: Lesson): RunnerState {
  const nextIndex = state.stepIndex + 1;
  if (nextIndex >= lesson.steps.length) {
    const tally = firstTimeTally(state.results);
    return {
      ...state,
      phase: "complete",
      attempts: [],
      stepXp: null,
      shownAnswer: null,
      feedback: null,
      stars: starsFor(tally.first, tally.scored),
      patchEarned: true,
    };
  }
  return {
    ...state,
    stepIndex: nextIndex,
    phase: "prompt",
    misses: 0,
    attempts: [],
    stepXp: null,
    shownAnswer: null,
    feedback: null,
  };
}

function resolveGoal(goal: GoalSpec, examples: WorkedExamples): ResolvedGoal | null {
  const resolved = resolveValue(goal.value, examples);
  if (resolved.value === null) return null;
  return { ...goal, value: resolved.value };
}

function isCorrect(
  step: Step,
  submission: Submission,
  evaluator: GoalEvaluator,
  examples: WorkedExamples,
): boolean {
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
    case "drop-pin": {
      if (submission.kind !== "drop-pin") return false;
      if (!step.goal) return true;
      const goal = resolveGoal(step.goal, examples);
      if (!goal) return false;
      const attempt: GoalAttempt = { stepId: step.id, kind: "drop-pin", pin: submission.pin };
      return evaluator.meetsGoal(goal, attempt);
    }
    case "drag-body":
    case "tune-slider": {
      if (submission.kind !== step.kind) return false;
      const goal = resolveGoal(step.goal, examples);
      if (!goal) return false;
      return evaluator.meetsGoal(goal, { stepId: step.id, kind: step.kind, value: submission.value });
    }
  }
}

/**
 * What to save for a lesson: its stars and XP once it is complete, and nothing before.
 * Leaving part-way therefore drops the lesson's progress (docs/academy/overview.md).
 */
export function completionRecord(state: RunnerState): { stars: 1 | 2 | 3; xp: number } | null {
  if (state.phase !== "complete" || state.stars === 0) return null;
  return { stars: state.stars, xp: state.xp };
}
