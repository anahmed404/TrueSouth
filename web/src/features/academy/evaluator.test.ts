import { describe, expect, it } from "vitest";
import { alsoHolds, createValueEvaluator, type GoalAttempt, type ResolvedGoal } from "./evaluator";

describe("a goal's second condition", () => {
  const evaluator = createValueEvaluator();
  const hidden: ResolvedGoal = { metric: "sun_frac", op: "<", value: 0.5, also: { metric: "sun_el_deg", op: ">", value: 0 } };
  const at = (frac: number, el: number | undefined): GoalAttempt => ({
    stepId: "s",
    kind: "drag-body",
    value: frac,
    ...(el === undefined ? {} : { values: { sun_frac: frac, sun_el_deg: el } }),
  });

  it("is met only when both conditions hold at the same moment", () => {
    expect(evaluator.meetsGoal(hidden, at(0, 0.54))).toBe(true);
    // Plain night: no disc shows, but the Sun is below level.
    expect(evaluator.meetsGoal(hidden, at(0, -0.29))).toBe(false);
    // Level exactly is not above level.
    expect(evaluator.meetsGoal(hidden, at(0, 0))).toBe(false);
    // Up, but more than half the disc shows.
    expect(evaluator.meetsGoal(hidden, at(0.55, 0.7))).toBe(false);
  });

  it("is not met when the attempt carries no value for its metric", () => {
    expect(alsoHolds(hidden, at(0, undefined))).toBe(false);
    expect(evaluator.meetsGoal(hidden, at(0, undefined))).toBe(false);
  });

  it("leaves a goal with no second condition as it was", () => {
    const plain: ResolvedGoal = { metric: "sun_frac", op: "<", value: 0.5 };
    expect(alsoHolds(plain, at(0, undefined))).toBe(true);
    expect(evaluator.meetsGoal(plain, at(0.2, undefined))).toBe(true);
    expect(evaluator.meetsGoal(plain, at(0.6, undefined))).toBe(false);
  });
});
