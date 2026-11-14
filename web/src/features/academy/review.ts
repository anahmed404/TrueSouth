import type { RunnerState } from "./runner";

/**
 * Revisiting finished steps from the progress marks (work package A3b). Pure, so which marks
 * are controls, and what a reviewed step shows, are tested without a browser.
 *
 * - A step the learner has finished in this lesson can be opened again, read-only: it shows
 *   what they did (their answers, how it ended, its XP and Luna's feedback) and offers one
 *   way back. Nothing is rescored: a review never sends anything to the runner.
 * - The current step is where the lesson is. While a finished step is shown, its mark
 *   returns there; the current step's unsaved state (a picked option, a dragged hour, a
 *   sketch) is kept and is waiting on return.
 * - A step not yet reached is never a control.
 */

export type MarkState = "done" | "current" | "ahead";

export type ProgressMark = {
  index: number;
  state: MarkState;
  /** The step on screen: the reviewed one while reviewing, else the current one. */
  shown: boolean;
  /** A button the learner can press: a finished step, or the current one while reviewing. */
  control: boolean;
  /** Its accessible name. */
  label: string;
};

/** True when step `index` is finished in this lesson and so can be reviewed. */
export function canReview(runner: RunnerState, index: number): boolean {
  if (!Number.isInteger(index) || index < 0 || index >= runner.stepIndex) return false;
  return runner.history.some((record) => record.stepIndex === index);
}

/** The step being reviewed, or null: a request for any step that cannot be reviewed is ignored. */
export function reviewTarget(runner: RunnerState, requested: number | null): number | null {
  if (requested === null || runner.phase === "complete") return null;
  return canReview(runner, requested) ? requested : null;
}

export function progressMarks(runner: RunnerState, stepCount: number, viewing: number | null): ProgressMark[] {
  const reviewing = reviewTarget(runner, viewing);
  return Array.from({ length: stepCount }, (_, index): ProgressMark => {
    const name = `Step ${index + 1} of ${stepCount}`;
    if (index < runner.stepIndex && canReview(runner, index)) {
      const shown = reviewing === index;
      return { index, state: "done", shown, control: !shown, label: shown ? `${name}, completed, shown now` : `${name}, completed. Review` };
    }
    if (index === runner.stepIndex) {
      const back = reviewing !== null;
      return { index, state: "current", shown: !back, control: back, label: back ? `${name}, current step. Go back to it` : `${name}, current step` };
    }
    return { index, state: "ahead", shown: false, control: false, label: `${name}, not yet reached` };
  });
}

/** Said in place of feedback when a finished step was passed through its holding form. */
export const SKIPPED_NOTE = "You moved on from this step without answering it, so it earned no XP.";

/**
 * The runner as it stood when the learner finished step `index`, for drawing that step
 * read-only, or null when the step is not finished. It is a view: it is never dispatched.
 */
export function reviewRunner(runner: RunnerState, index: number): RunnerState | null {
  if (!canReview(runner, index)) return null;
  const record = runner.history.find((item) => item.stepIndex === index);
  if (!record) return null;
  const skipped = record.phase === "skipped";
  return {
    ...runner,
    stepIndex: index,
    phase: record.phase === "skipped" ? "unavailable" : record.phase,
    attempts: record.attempts,
    misses: record.misses,
    stepXp: record.stepXp,
    feedback: skipped ? SKIPPED_NOTE : record.feedback,
    shownAnswer: record.shownAnswer,
  };
}
