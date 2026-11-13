import type { GoalSpec } from "./types";

/** What the learner did on a step whose goal an evaluator checks. */
export type GoalAttempt = {
  stepId: string;
  kind: "drag-body" | "drop-pin" | "tune-slider";
  value: number;
};

/**
 * The runner asks this whether a goal is met. Mission Control's evaluation
 * hooks (MC2) will provide the real one.
 */
export type GoalEvaluator = {
  meetsGoal(goal: GoalSpec, attempt: GoalAttempt): boolean;
};
