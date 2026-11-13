import type { GoalSpec, GoalValue, PinAttempt } from "./types";

/**
 * What the learner did on a step whose goal an evaluator checks.
 * - `drag-body`, `tune-slider`: the value they set (a number, or a UTC time as text).
 * - `drop-pin`: a catalog site id, or coordinates in degrees.
 */
export type GoalAttempt =
  | { stepId: string; kind: "drag-body" | "tune-slider"; value: number | string }
  | { stepId: string; kind: "drop-pin"; pin: PinAttempt };

/**
 * A goal whose `{{example.key}}` placeholder has already been filled from
 * `worked_examples.json`, so its value is a plain number, UTC time or text.
 */
export type ResolvedGoal = Omit<GoalSpec, "value"> & { value: number | string };

/**
 * The runner asks this whether a goal is met. Mission Control's evaluation
 * hooks (MC2) will provide the real one.
 */
export type GoalEvaluator = {
  meetsGoal(goal: ResolvedGoal, attempt: GoalAttempt): boolean;
};

const UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?Z$/;
const PLACEHOLDER_PATTERN = /^\{\{example\.[A-Za-z0-9_]+(?:\.[A-Za-z0-9_]+)*\}\}$/;

export type GoalValueKind = "number" | "utc" | "placeholder" | "text";

/** Which of the four allowed forms a goal value takes. */
export function goalValueKind(value: GoalValue): GoalValueKind {
  if (typeof value === "number") return "number";
  if (PLACEHOLDER_PATTERN.test(value)) return "placeholder";
  if (UTC_PATTERN.test(value) && !Number.isNaN(Date.parse(value))) return "utc";
  return "text";
}

/**
 * Compares an attempt's value with a resolved goal value.
 * - Numbers compare as numbers.
 * - Two UTC times compare as moments.
 * - Text compares only with "==". Any other pairing is not met.
 */
export function compareGoalValues(
  actual: number | string,
  op: GoalSpec["op"],
  expected: number | string,
): boolean {
  if (typeof actual === "number" && typeof expected === "number") {
    if (!Number.isFinite(actual) || !Number.isFinite(expected)) return false;
    return compareNumbers(actual, op, expected);
  }
  if (typeof actual === "string" && typeof expected === "string") {
    if (goalValueKind(actual) === "utc" && goalValueKind(expected) === "utc") {
      return compareNumbers(Date.parse(actual), op, Date.parse(expected));
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
      if (attempt.kind === "drop-pin") {
        return "siteId" in attempt.pin && compareGoalValues(attempt.pin.siteId, goal.op, goal.value);
      }
      return compareGoalValues(attempt.value, goal.op, goal.value);
    },
  };
}
