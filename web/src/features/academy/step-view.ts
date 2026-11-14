import { formatUtc } from "../../components/format";
import { formatNumber } from "./format-example";
import { answerText, PANEL_STEP_KINDS, PENDING_STEP_KINDS, type RunnerState } from "./runner";
import type { LunaMood, PanelPreview, SketchPoint, Step, Submission } from "./types";

/**
 * What the lesson screen shows for a step, derived from the step and the runner. Pure, so
 * every state transition can be tested without a browser.
 */

/** A step kind whose learner picks one of a list. */
export type PickKind = "choice" | "predict" | "fill-formula" | "spot-bug";

/**
 * What the learner has set but not yet checked. A date slider carries a UTC instant, not a
 * number. A dragged body carries the hour it stands at and the goal metric's stored value
 * there, read from the series by the stage; a sketch carries its points and its gap to the
 * real skyline, worked out by `sketch.ts`.
 */
export type Draft =
  | { kind: PickKind; selected: number }
  | { kind: "tune-slider"; variant: "number"; value: number }
  | { kind: "tune-slider"; variant: "date"; utc: string }
  | {
      kind: "drag-body";
      hour: number;
      utc: string;
      /** The goal metric's stored value at `hour`. */
      value: number;
      /** The Sun's stored disc fraction at `hour`, for Pip's power meter, or null. */
      sunFrac: number | null;
      /** Every goal metric's stored value at `hour`, for a goal with a second condition. */
      values?: Readonly<Record<string, number>>;
    }
  | { kind: "draw-skyline"; sketch: readonly SketchPoint[]; gapDeg: number }
  | null;

export type OptionState = "default" | "selected" | "missed" | "answer" | "dimmed";

export type OptionView = {
  state: OptionState;
  /** A short note at the end of the row, such as "1st try" or "Correct". */
  note: string | null;
  /** The row is the correct answer and the learner got it right (not shown to them). */
  correct: boolean;
};

export function isPickKind(kind: Step["kind"]): kind is PickKind {
  return kind === "choice" || kind === "predict" || kind === "fill-formula" || kind === "spot-bug";
}

export function correctIndex(step: Step): number | null {
  if (step.kind === "spot-bug") return step.buggyLine;
  if (step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula") {
    return typeof step.answer === "number" ? step.answer : null;
  }
  return null;
}

/** The options' count for a pick step: options, or the lines of a spot-bug step. */
export function optionCount(step: Step): number {
  if (step.kind === "spot-bug") return step.lines.length;
  if (step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula") return step.options.length;
  return 0;
}

function pickedIndices(attempts: readonly Submission[]): number[] {
  return attempts.flatMap((attempt) => ("selected" in attempt ? [attempt.selected] : []));
}

export function isAnswered(runner: RunnerState): boolean {
  return runner.phase === "correct" || runner.phase === "revealed" || runner.phase === "unavailable";
}

/** The state of every option of a pick step. */
export function optionViews(step: Step, runner: RunnerState, draft: Draft): OptionView[] {
  const count = optionCount(step);
  const answer = correctIndex(step);
  const picks = pickedIndices(runner.attempts);
  const missed = picks.filter((pick) => pick !== answer);
  const answered = isAnswered(runner);
  const selected = draft && "selected" in draft ? draft.selected : null;

  return Array.from({ length: count }, (_, index): OptionView => {
    if (answered) {
      if (index === answer) {
        const right = runner.phase === "correct";
        return { state: "answer", note: right ? "Correct" : "The answer", correct: right };
      }
      const missIndex = missed.indexOf(index);
      if (missIndex >= 0) {
        const note = missed.length > 1 ? (missIndex === 0 ? "1st try" : "2nd try") : step.kind === "predict" ? "Your guess" : "Not this one";
        return { state: "missed", note, correct: false };
      }
      return { state: "dimmed", note: null, correct: false };
    }
    if (missed.includes(index)) return { state: "missed", note: "Not this one", correct: false };
    if (index === selected) return { state: "selected", note: null, correct: false };
    return { state: "default", note: null, correct: false };
  });
}

/** True when a draft can be checked: something is set, and it is not a repeat of a miss. */
export function canCheck(step: Step, runner: RunnerState, draft: Draft): boolean {
  if (runner.phase !== "prompt" && runner.phase !== "hint") return false;
  if (!draft || draft.kind !== step.kind) return false;
  if ("selected" in draft) {
    if (draft.selected < 0 || draft.selected >= optionCount(step)) return false;
    return !pickedIndices(runner.attempts).includes(draft.selected);
  }
  if (draft.kind === "drag-body") {
    if (!Number.isFinite(draft.value)) return false;
    // A miss is not checked again at the same hour: the learner moves the body first.
    return !runner.attempts.some((attempt) => attempt.kind === "drag-body" && attempt.utc === draft.utc);
  }
  if (draft.kind === "draw-skyline") return draft.sketch.length >= 2 && Number.isFinite(draft.gapDeg);
  if (step.kind !== "tune-slider" || draft.variant !== step.slider.kind) return false;
  const last = runner.attempts[runner.attempts.length - 1];
  if (!last || last.kind !== "tune-slider") return true;
  if (draft.variant === "number" && last.variant === "number") return last.value !== draft.value;
  if (draft.variant === "date" && last.variant === "date") return last.utc !== draft.utc;
  return true;
}

export type PrimaryAction =
  | { kind: "check"; label: "Check" | "Show me" | "Done"; enabled: boolean }
  | { kind: "continue"; label: "Continue" | "Finish the lesson" }
  /** A panel step shown in its holding form: Continue moves on, for no XP. */
  | { kind: "skip"; label: "Continue" };

/**
 * True when a step shows its holding form: its panel is not built (`PENDING_STEP_KINDS`), or
 * it embeds a panel whose site data failed to load (`sceneFailed`).
 */
export function isHeld(step: Step, sceneFailed = false): boolean {
  if (PENDING_STEP_KINDS.includes(step.kind)) return true;
  return sceneFailed && PANEL_STEP_KINDS.includes(step.kind);
}

export function primaryAction(
  step: Step,
  runner: RunnerState,
  draft: Draft,
  isLastStep: boolean,
  sceneFailed = false,
): PrimaryAction {
  if (isAnswered(runner)) return { kind: "continue", label: isLastStep ? "Finish the lesson" : "Continue" };
  if (isHeld(step, sceneFailed)) return { kind: "skip", label: "Continue" };
  return {
    kind: "check",
    label: step.kind === "predict" ? "Show me" : step.kind === "draw-skyline" ? "Done" : "Check",
    enabled: canCheck(step, runner, draft),
  };
}

/** The draft to start a step with. A slider starts at its minimum; a pick starts empty. */
export function initialDraft(step: Step | undefined): Draft {
  if (step?.kind !== "tune-slider") return null;
  if (step.slider.kind === "date") return { kind: "tune-slider", variant: "date", utc: step.slider.minUtc };
  return { kind: "tune-slider", variant: "number", value: step.slider.min };
}

/** The draft after a check: a missed pick is cleared, so the learner picks again. */
export function draftAfterCheck(step: Step, runner: RunnerState, draft: Draft): Draft {
  if (runner.phase === "hint" && draft && "selected" in draft) return null;
  // A slider, a dragged body and a sketch stay where the learner left them.
  if (isAnswered(runner) && step.kind !== "tune-slider" && step.kind !== "drag-body" && step.kind !== "draw-skyline") {
    return null;
  }
  return draft;
}

export type ConversationEntry =
  | { who: "luna"; mood: LunaMood; text: string; old: boolean; key: string }
  | { who: "me"; text: string; miss: boolean; key: string };

/** A number with its unit: "20 km", but "6.5°" and "11%", which sit on the number. */
export function withUnit(value: number, unit: string): string {
  return unit === "°" || unit === "%" ? `${value}${unit}` : `${value} ${unit}`;
}

/** How the learner's reply reads in the conversation. Text may hold placeholders. */
export function replyText(step: Step, submission: Submission): string {
  switch (submission.kind) {
    case "choice":
    case "predict":
    case "fill-formula":
      return step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula"
        ? (step.options[submission.selected] ?? "")
        : "";
    case "spot-bug":
      return `Line ${submission.selected + 1} is wrong.`;
    case "tune-slider":
      if (step.kind !== "tune-slider") return "";
      if (submission.variant === "date") return submission.utc;
      return step.slider.kind === "number" ? withUnit(submission.value, step.slider.unit) : String(submission.value);
    case "drag-body":
      return dragReply(step, submission);
    case "drop-pin":
      return "siteId" in submission.pin
        ? `Here: ${submission.pin.siteId}.`
        : `Here: ${submission.pin.latDeg}°, ${submission.pin.lonEastDeg}°E.`;
    case "draw-skyline":
      return "Here is my sketch.";
  }
}

/** "0.63° at 2028-01-01 00:00 UTC", or for a disc share "0.14 of the disc showing at …". */
function dragReply(step: Step, submission: Extract<Submission, { kind: "drag-body" }>): string {
  const value = submission.value;
  const when = submission.utc ? ` at ${formatUtc(submission.utc)}` : "";
  if (typeof value !== "number") return `${value}${when}`;
  if (step.kind === "drag-body" && !("comparedTo" in step.goal) && step.goal.metric.endsWith("_frac")) {
    return `${formatNumber(value, { min: 2, max: 2 })} of the disc showing${when}`;
  }
  return `${formatNumber(value, { min: 2, max: 2 })}°${when}`;
}

/** Luna's lead-in when a drag-body answer is shown: the answer is marked on the chart. */
export const DRAG_SHOWN = "Here it is, marked on the chart.";

/**
 * The conversation for the current step: Luna's question, each reply, Luna's hint after a
 * miss and her explanation at the end. Every Luna line but the newest is "old". A pending
 * step (its panel not built) opens with its holding line instead of the question.
 */
export function conversationFor(step: Step, runner: RunnerState): ConversationEntry[] {
  const preview = panelPreview(step);
  const entries: ConversationEntry[] = [
    preview?.says && PENDING_STEP_KINDS.includes(step.kind)
      ? { who: "luna", mood: "happy", text: preview.says, old: false, key: `${step.id}-preview` }
      : { who: "luna", mood: step.luna.mood, text: step.luna.says, old: false, key: `${step.id}-ask` },
  ];
  const answer = correctIndex(step);
  runner.attempts.forEach((attempt, index) => {
    const last = index === runner.attempts.length - 1;
    const right =
      attempt.kind === "draw-skyline" ||
      (answer !== null && "selected" in attempt ? attempt.selected === answer : last && (runner.phase === "correct" || runner.phase === "unavailable"));
    entries.push({ who: "me", text: replyText(step, attempt), miss: !right, key: `${step.id}-me-${index}` });

    if (!last) {
      entries.push({ who: "luna", mood: "worried", text: `Not quite. ${step.hint}`, old: false, key: `${step.id}-hint-${index}` });
      return;
    }
    if (runner.phase === "hint") {
      entries.push({ who: "luna", mood: "worried", text: `Not quite. ${step.hint}`, old: false, key: `${step.id}-hint-${index}` });
    } else if (runner.phase === "correct") {
      entries.push({ who: "luna", mood: "cheering", text: lunaOnCorrect(step, runner), old: false, key: `${step.id}-ok` });
    } else if (runner.phase === "unavailable") {
      entries.push({
        who: "luna",
        mood: "worried",
        text: runner.feedback ?? "This cannot be checked yet.",
        old: false,
        key: `${step.id}-unchecked`,
      });
    } else if (runner.phase === "revealed") {
      entries.push({
        who: "luna",
        mood: step.kind === "predict" ? "surprised" : "happy",
        text: step.kind === "drag-body" ? `${DRAG_SHOWN} ${step.explain}` : `It's ${answerText(step)}. ${step.explain}`,
        old: false,
        key: `${step.id}-shown`,
      });
    }
  });
  const lastLuna = entries.reduce((found, entry, index) => (entry.who === "luna" ? index : found), 0);
  return entries.map((entry, index) =>
    entry.who === "luna" && index !== lastLuna ? { ...entry, old: true } : entry,
  );
}

/**
 * The "not ready" form of a panel step (see `PanelPreview`), or null for any other step.
 * A panel step with no preview of its own falls back to its question and explanation.
 */
export function panelPreview(step: Step): PanelPreview | null {
  if (step.kind !== "drag-body" && step.kind !== "draw-skyline" && step.kind !== "drop-pin") return null;
  return step.preview ?? { says: step.luna.says, reveal: step.explain };
}

function lunaOnCorrect(step: Step, runner: RunnerState): string {
  if (step.kind === "draw-skyline") return (runner.feedback ?? step.explain).trim();
  return step.explain;
}

/** The result row after Check: what happened, and the XP the step earned. */
export type ResultView = {
  tone: "correct" | "shown";
  headline: string;
  xp: number;
};

export function resultFor(step: Step, runner: RunnerState): ResultView | null {
  if (!isAnswered(runner) || runner.stepXp === null) return null;
  if (runner.phase === "unavailable") {
    return { tone: "shown", headline: runner.feedback ?? "This cannot be checked yet.", xp: runner.stepXp };
  }
  if (runner.phase === "correct") {
    if (step.kind === "draw-skyline") {
      const close = runner.results[runner.results.length - 1] === "first";
      return { tone: close ? "correct" : "shown", headline: close ? "A close sketch" : "Sketch scored", xp: runner.stepXp };
    }
    return { tone: "correct", headline: "Correct", xp: runner.stepXp };
  }
  if (step.kind === "drag-body") return { tone: "shown", headline: "Marked on the chart", xp: runner.stepXp };
  return { tone: "shown", headline: runner.shownAnswer ?? answerText(step), xp: runner.stepXp };
}

/** Pip's meters at a step: the latest values set at or before it, carried forward. */
export function pipAt(steps: readonly Step[], stepIndex: number): { power?: number; link?: boolean } | null {
  let power: number | undefined;
  let link: boolean | undefined;
  for (let index = 0; index <= stepIndex && index < steps.length; index += 1) {
    const pip = steps[index]?.pip;
    if (pip?.power !== undefined) power = pip.power;
    if (pip?.link !== undefined) link = pip.link;
  }
  if (power === undefined && link === undefined) return null;
  return { power, link };
}
