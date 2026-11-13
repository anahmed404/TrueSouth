import { describe, expect, it } from "vitest";
import { createStubEvaluator } from "./stub-evaluator";

describe("stub evaluator", () => {
  const goal = { metric: "longest_blackout_h", op: "<=" as const, value: 12 };
  const attempt = { stepId: "s", kind: "tune-slider" as const, value: 99 };

  it("returns the fixed result for every goal", () => {
    expect(createStubEvaluator(false).meetsGoal(goal, attempt)).toBe(false);
    expect(createStubEvaluator(true).meetsGoal(goal, attempt)).toBe(true);
  });
});
