import type { GoalAttempt, GoalEvaluator, PriorValue, ResolvedGoal } from "./evaluator";
import { fillPlaceholders, resolveValue, type WorkedExamples } from "./placeholders";
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

export type RunnerPhase = "prompt" | "hint" | "correct" | "revealed" | "unavailable" | "complete";

/**
 * How a step ended.
 * - first, second: right on the first or second try;
 * - revealed: the answer was shown (two misses, or a wrong prediction);
 * - sketched: a skyline sketch further than 1.0° from the real one;
 * - skipped: a panel step skipped until A3 builds it;
 * - unavailable: the goal's worked-example key is missing, so it cannot be checked yet;
 * - unreachable: no stop on the slider can meet the goal.
 * `skipped`, `unavailable` and `unreachable` are not scored.
 */
export type StepResult = "first" | "second" | "revealed" | "sketched" | "skipped" | "unavailable" | "unreachable";

export type RunnerState = {
  stepIndex: number;
  phase: RunnerPhase;
  /** Misses on the current step. Two misses reveal the answer. */
  misses: number;
  xp: number;
  results: readonly StepResult[];
  /** Every submission on the current step, oldest first. Cleared on Continue. */
  attempts: readonly Submission[];
  /** The submission that ended each earlier step. Kept so a later goal can refer to it. */
  answers: readonly { stepId: string; submission: Submission }[];
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
    answers: [],
    stepXp: null,
    shownAnswer: null,
    feedback: null,
    stars: 0,
    patchEarned: false,
  };
}

/**
 * 3 if every scored step was right first time; 2 if at least 60% were; 1 otherwise.
 * A lesson with no scored step earns 1 star. It does not earn a patch; see `advance`.
 */
export function starsFor(firstTryCount: number, stepCount: number): 1 | 2 | 3 {
  if (stepCount <= 0) return 1;
  if (firstTryCount >= stepCount) return 3;
  if (firstTryCount / stepCount >= 0.6) return 2;
  return 1;
}

const UNSCORED: readonly StepResult[] = ["skipped", "unavailable", "unreachable"];

/** Steps that count for stars, and how many of them were right first time. */
export function firstTimeTally(results: readonly StepResult[]): { first: number; scored: number } {
  const scored = results.filter((result) => !UNSCORED.includes(result));
  return { first: scored.filter((result) => result === "first").length, scored: scored.length };
}

function goalAnswer(goal: GoalSpec | undefined, label: string | undefined): string {
  if (label) return label;
  if (!goal) return "Any pin passes.";
  if ("comparedTo" in goal) return `${goal.metric} ${goal.op} ${goal.comparedTo}`;
  return `${goal.metric} ${goal.op} ${String(goal.value)}`;
}

function optionAnswer(step: Extract<Step, { kind: "choice" | "predict" | "fill-formula" }>): string {
  if (typeof step.answer === "number") return step.options[step.answer] ?? "";
  return String(step.answer.equals);
}

export function answerText(step: Step): string {
  switch (step.kind) {
    case "choice":
    case "predict":
    case "fill-formula":
      return optionAnswer(step);
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

type Grade = "met" | "unmet" | "unavailable" | "impossible";

function remember(state: RunnerState, stepId: string, submission: Submission): RunnerState["answers"] {
  return [...state.answers, { stepId, submission }];
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
  if (step.kind === "tune-slider" && submission.kind === "tune-slider" && submission.variant !== step.slider.kind) {
    return state;
  }
  const attempts = [...state.attempts, submission];
  const answers = remember(state, step.id, submission);

  if (step.kind === "draw-skyline" && submission.kind === "draw-skyline") {
    const xp = skylineXp(submission.gapDeg);
    const close = skylineRightFirstTime(submission.gapDeg);
    const gap = Number.isFinite(submission.gapDeg) && submission.gapDeg >= 0 ? `${submission.gapDeg.toFixed(1)}°` : "invalid";
    return {
      ...state,
      phase: "correct",
      attempts,
      answers,
      xp: state.xp + xp,
      stepXp: xp,
      results: [...state.results, close ? "first" : "sketched"],
      shownAnswer: null,
      feedback: `${close ? "A close sketch." : "Every sketch counts."} Your average gap is ${gap}. ${step.explain}`,
    };
  }

  let grade = gradeSubmission(state, step, submission, evaluator, examples);
  if (grade === "impossible" && !(step.kind === "tune-slider" && step.unreachable)) grade = "unmet";

  if (grade === "unavailable" || grade === "impossible") {
    const unreachable = grade === "impossible" && step.kind === "tune-slider" ? step.unreachable : undefined;
    return {
      ...state,
      phase: "unavailable",
      attempts,
      answers,
      stepXp: 0,
      results: [...state.results, unreachable ? "unreachable" : "unavailable"],
      shownAnswer: null,
      feedback: unreachable ? unreachable.says : "This cannot be checked yet.",
    };
  }

  if (grade === "met") {
    const firstTry = state.misses === 0;
    const xp = firstTry ? XP_FIRST : XP_SECOND;
    return {
      ...state,
      phase: "correct",
      attempts,
      answers,
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
    answers,
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
  if (state.phase !== "correct" && state.phase !== "revealed" && state.phase !== "unavailable") return state;
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
      patchEarned: tally.scored > 0,
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

function resolveGoal(goal: GoalSpec, examples: WorkedExamples): { goal: ResolvedGoal } | { missing: string[] } {
  if ("comparedTo" in goal) return { goal };
  const resolved = resolveValue(goal.value, examples);
  if (resolved.value === null) return { missing: resolved.missing };
  const next: ResolvedGoal = {
    metric: goal.metric,
    op: goal.op,
    value: resolved.value,
    ...(goal.tolerance !== undefined ? { tolerance: goal.tolerance } : {}),
    ...(goal.prior ? { prior: goal.prior } : {}),
  };
  return { goal: next };
}

function priorValue(state: RunnerState, goal: GoalSpec): PriorValue | "missing" | undefined {
  if (!goal.prior) return undefined;
  const found = [...state.answers].reverse().find((answer) => answer.stepId === goal.prior?.stepId);
  if (!found) return "missing";
  const submission = found.submission;
  const stepId = goal.prior.stepId;
  if (goal.prior.field === "siteId" && submission.kind === "drop-pin" && "siteId" in submission.pin) {
    return { stepId, value: submission.pin.siteId };
  }
  if (goal.prior.field === "utc" && submission.kind === "tune-slider" && submission.variant === "date") {
    return { stepId, value: submission.utc };
  }
  if (goal.prior.field === "value" && submission.kind === "drag-body") {
    return { stepId, value: submission.value };
  }
  if (goal.prior.field === "value" && submission.kind === "tune-slider" && submission.variant === "number") {
    return { stepId, value: submission.value };
  }
  if (goal.prior.field === "selected" && "selected" in submission) {
    return { stepId, value: submission.selected };
  }
  return "missing";
}

function withPrior(attempt: GoalAttempt, prior: PriorValue | undefined): GoalAttempt {
  if (!prior) return attempt;
  return { ...attempt, prior };
}

function askEvaluator(evaluator: GoalEvaluator, goal: ResolvedGoal, attempt: GoalAttempt): Grade {
  const status = evaluator.status?.(goal, attempt);
  if (status === "impossible") return "impossible";
  if (status === "met") return "met";
  if (status === "unmet") return "unmet";
  return evaluator.meetsGoal(goal, attempt) ? "met" : "unmet";
}

function dateOnSlider(step: Extract<Step, { kind: "tune-slider" }>, utc: string): boolean {
  if (step.slider.kind !== "date") return true;
  const value = Date.parse(utc);
  const min = Date.parse(step.slider.minUtc);
  const max = Date.parse(step.slider.maxUtc);
  return Number.isFinite(value) && Number.isFinite(min) && Number.isFinite(max) && value >= min && value <= max;
}

function optionGrade(
  answer: Extract<Step, { kind: "choice" | "predict" }>["answer"],
  selected: number,
  options: readonly string[],
  examples: WorkedExamples,
): Grade {
  if (typeof answer === "number") return selected === answer ? "met" : "unmet";
  const resolved = resolveValue(answer.equals, examples);
  if (resolved.value === null) return "unavailable";
  const option = options[selected] ?? "";
  const filled = fillPlaceholders(option, examples).text;
  const expected = String(resolved.value);
  return option === expected || filled === expected ? "met" : "unmet";
}

function gradeSubmission(
  state: RunnerState,
  step: Step,
  submission: Submission,
  evaluator: GoalEvaluator,
  examples: WorkedExamples,
): Grade {
  switch (step.kind) {
    case "choice":
      return submission.kind === "choice" ? optionGrade(step.answer, submission.selected, step.options, examples) : "unmet";
    case "predict":
      return submission.kind === "predict" ? optionGrade(step.answer, submission.selected, step.options, examples) : "unmet";
    case "fill-formula":
      return submission.kind === "fill-formula" && submission.selected === step.answer ? "met" : "unmet";
    case "spot-bug":
      return submission.kind === "spot-bug" && submission.selected === step.buggyLine ? "met" : "unmet";
    case "draw-skyline":
      return submission.kind === "draw-skyline" ? "met" : "unmet";
    case "drop-pin": {
      if (submission.kind !== "drop-pin") return "unmet";
      if (!step.goal) return "met";
      return gradeGoal(state, step.goal, { stepId: step.id, kind: "drop-pin", pin: submission.pin }, evaluator, examples);
    }
    case "drag-body": {
      if (submission.kind !== "drag-body") return "unmet";
      return gradeGoal(state, step.goal, { stepId: step.id, kind: "drag-body", value: submission.value }, evaluator, examples);
    }
    case "tune-slider": {
      if (submission.kind !== "tune-slider") return "unmet";
      if (submission.variant === "date" && !dateOnSlider(step, submission.utc)) return "unmet";
      const value = submission.variant === "date" ? submission.utc : submission.value;
      return gradeGoal(state, step.goal, { stepId: step.id, kind: "tune-slider", value }, evaluator, examples);
    }
  }
}

function gradeGoal(
  state: RunnerState,
  goal: GoalSpec,
  attempt: GoalAttempt,
  evaluator: GoalEvaluator,
  examples: WorkedExamples,
): Grade {
  const resolved = resolveGoal(goal, examples);
  if ("missing" in resolved) return "unavailable";
  const prior = priorValue(state, goal);
  if (prior === "missing") return "unavailable";
  return askEvaluator(evaluator, resolved.goal, withPrior(attempt, prior));
}

export type CompletionRecord = { stars: 1 | 2 | 3; xp: number; patch: boolean };

/**
 * What to save for a lesson: its stars, XP and whether a patch was earned, once it is
 * complete, and nothing before. Leaving part-way therefore drops the lesson's progress.
 */
export function completionRecord(state: RunnerState): CompletionRecord | null {
  if (state.phase !== "complete" || state.stars === 0) return null;
  return { stars: state.stars, xp: state.xp, patch: state.patchEarned };
}

/**
 * The lesson screen's save. It writes only when `completionRecord` has something,
 * so a lesson that is still in progress records nothing.
 */
export function commitLessonProgress(state: RunnerState, commit: (record: CompletionRecord) => void): boolean {
  const record = completionRecord(state);
  if (!record) return false;
  commit(record);
  return true;
}

/** What the lesson-complete screen should say. The layout stays as it is. */
export type CompleteScreenData = {
  stars: 1 | 2 | 3;
  xp: number;
  showPatch: boolean;
  heading: string;
  firstTime: string;
};

export function completeScreenData(lesson: Lesson, runner: RunnerState): CompleteScreenData {
  const tally = firstTimeTally(runner.results);
  const showPatch = runner.phase === "complete" && runner.patchEarned;
  return {
    stars: runner.stars === 0 ? 1 : runner.stars,
    xp: runner.xp,
    showPatch,
    heading: showPatch
      ? `You earned the ${lesson.patch.name} patch`
      : `${lesson.title} is complete. No patch: this lesson had no scored step.`,
    firstTime: `${tally.first} of ${tally.scored} right first time`,
  };
}
