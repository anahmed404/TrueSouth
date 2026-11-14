import type { ComparedGoal, GoalSpec, GoalValue, PinAttempt, ValueGoal } from "./types";
import { compareUtcHours, parseUtcHour } from "./utc";

/**
 * What the learner did on a step whose goal an evaluator checks.
 * - `drag-body`, `tune-slider`: the value they set (a number, or a UTC time as text).
 * - `drop-pin`: a catalog site id, or coordinates in degrees.
 */
export type PriorValue = { stepId: string; value: number | string };

export type GoalAttempt =
  | {
      stepId: string;
      kind: "drag-body" | "tune-slider";
      value: number | string;
      prior?: PriorValue;
      /** Each goal metric's value at the chosen moment, for a goal's `also` condition. */
      values?: Readonly<Record<string, number>>;
    }
  | { stepId: string; kind: "drop-pin"; pin: PinAttempt; prior?: PriorValue };

/**
 * A goal whose `{{example.key}}` placeholder has already been filled from
 * `worked_examples.json`, so its value is a plain number, UTC time or text.
 * A compared goal has no value to fill.
 */
export type ResolvedGoal =
  | (Omit<ValueGoal, "value" | "also"> & {
      value: number | string;
      also?: { metric: string; op: GoalSpec["op"]; value: number | string };
    })
  | ComparedGoal;

/**
 * Whether a goal's `also` condition holds for an attempt: true when there is none, false
 * when the attempt has no value for its metric.
 */
export function alsoHolds(goal: ResolvedGoal, attempt: GoalAttempt): boolean {
  if ("comparedTo" in goal || !goal.also) return true;
  const value = attempt.kind === "drop-pin" ? undefined : attempt.values?.[goal.also.metric];
  if (value === undefined) return false;
  return compareGoalValues(value, goal.also.op, goal.also.value);
}

/**
 * The runner asks this whether a goal is met. Mission Control's evaluation
 * hooks (MC2) will provide the real one.
 * `status` is optional. When it returns `"impossible"`, no value in range can meet the goal.
 */
export type GoalEvaluator = {
  meetsGoal(goal: ResolvedGoal, attempt: GoalAttempt): boolean;
  status?(goal: ResolvedGoal, attempt: GoalAttempt): "met" | "unmet" | "impossible";
};

const PLACEHOLDER_PATTERN = /^\{\{example\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*\}\}$/;

export type GoalValueKind = "number" | "utc" | "placeholder" | "text";

/** Which of the four allowed forms a goal value takes. */
export function goalValueKind(value: GoalValue): GoalValueKind {
  if (typeof value === "number") return "number";
  if (PLACEHOLDER_PATTERN.test(value)) return "placeholder";
  if (parseUtcHour(value) !== null) return "utc";
  return "text";
}

/**
 * Compares an attempt's value with a resolved goal value.
 * - Numbers compare as numbers. For `==`, `tolerance` is how far either side still counts.
 * - Two UTC times compare as hour indexes on the time grid, not as strings.
 * - Text compares only with "==". Any other pairing is not met.
 */
export function compareGoalValues(
  actual: number | string,
  op: GoalSpec["op"],
  expected: number | string,
  tolerance?: number,
): boolean {
  if (typeof actual === "number" && typeof expected === "number") {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    if (op === "==" && tolerance !== undefined) {
      if (!Number.isFinite(tolerance) || tolerance < 0) return false;
      return Math.abs(actual - expected) <= tolerance;
    }
    return compareNumbers(actual, op, expected);
  }
  if (typeof actual === "string" && typeof expected === "string") {
    if (goalValueKind(actual) === "utc" && goalValueKind(expected) === "utc") {
      return compareUtcHours(actual, op, expected);
    }
    return op === "==" && actual === expected;
  }
  return false;
}

function compareNumbers(a: number, op: GoalSpec["op"], b: number): boolean {
  switch (op) {
    case "<":
      return a < b;
    case "<=":
      return a <= b;
    case ">":
      return a > b;
    case ">=":
      return a >= b;
    case "==":
      return a === b;
  }
}

/**
 * An evaluator for goals on the value the learner sets directly, such as a slider's own
 * position. It compares the attempt's value with the goal. A dropped pin meets a goal
 * whose value is the pin's site id. Lessons whose goal is a mission metric use the
 * evaluation hooks instead.
 */
export function createValueEvaluator(): GoalEvaluator {
  return {
    meetsGoal(goal, attempt) {
      if ("comparedTo" in goal) return false;
      if (attempt.kind === "drop-pin") {
        return "siteId" in attempt.pin && compareGoalValues(attempt.pin.siteId, goal.op, goal.value, goal.tolerance);
      }
      return compareGoalValues(attempt.value, goal.op, goal.value, goal.tolerance) && alsoHolds(goal, attempt);
    },
  };
}
