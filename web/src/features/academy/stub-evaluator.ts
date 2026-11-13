import type { GoalEvaluator } from "./evaluator";

/**
 * STUB. Work package MC2 replaces this file with the evaluation hooks.
 * Until then, every goal returns one fixed result. The attempt is ignored.
 */
export function createStubEvaluator(met: boolean): GoalEvaluator {
  return {
    meetsGoal: () => met,
  };
}
