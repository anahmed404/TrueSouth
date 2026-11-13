import { describe, expect, it } from "vitest";
import { createValueEvaluator } from "./evaluator";
import { fillPlaceholders } from "./placeholders";
import { sampleExamples, sampleLesson } from "./lessons/sample";
import { initialRunnerState, reduceRunner, type RunnerState } from "./runner";
import type { Step } from "./types";

const STEP_KINDS = [
  "choice",
  "predict",
  "drag-body",
  "draw-skyline",
  "drop-pin",
  "tune-slider",
  "fill-formula",
  "spot-bug",
] as const;

function textsOf(step: Step): string[] {
  const texts = [step.luna.says, step.hint, step.explain];
  if ("options" in step) texts.push(...step.options);
  if ("lines" in step) texts.push(...step.lines);
  if (step.kind === "fill-formula") texts.push(step.tex);
  if (step.kind === "tune-slider" && step.answerLabel) texts.push(step.answerLabel);
  if ((step.kind === "choice" || step.kind === "predict") && step.stage) texts.push(step.stage.caption);
  return texts;
}

describe("sample lesson", () => {
  it("has one step of every kind and is marked as a sample", () => {
    expect(sampleLesson.id).toBe("sample");
    expect(sampleLesson.tagline).toContain("A5 replaces it");
    expect(sampleLesson.steps.map((step) => step.kind).sort()).toEqual([...STEP_KINDS].sort());
  });

  it("puts the five kinds A2 builds first, so they can be played before the placeholders", () => {
    expect(sampleLesson.steps.slice(0, 5).map((step) => step.kind)).toEqual([
      "choice",
      "predict",
      "fill-formula",
      "spot-bug",
      "tune-slider",
    ]);
  });

  it("fills every placeholder it uses", () => {
    for (const step of sampleLesson.steps) {
      for (const text of textsOf(step)) {
        const filled = fillPlaceholders(text, sampleExamples);
        expect(filled.missing).toEqual([]);
        expect(filled.text).not.toContain("{{");
      }
    }
  });

  it("can be played to the end: the five built kinds answered, the three panel kinds skipped", () => {
    const evaluator = createValueEvaluator();
    let state: RunnerState = initialRunnerState();
    const play = (action: Parameters<typeof reduceRunner>[1]) => {
      state = reduceRunner(state, action, sampleLesson, evaluator, sampleExamples);
    };
    play({ type: "submit", submission: { kind: "choice", selected: 1 } });
    play({ type: "continue" });
    play({ type: "submit", submission: { kind: "predict", selected: 1 } });
    play({ type: "continue" });
    play({ type: "submit", submission: { kind: "fill-formula", selected: 1 } });
    play({ type: "continue" });
    play({ type: "submit", submission: { kind: "spot-bug", selected: 2 } });
    play({ type: "continue" });
    play({ type: "submit", submission: { kind: "tune-slider", value: 3 } });
    expect(state.phase).toBe("correct");
    play({ type: "continue" });
    play({ type: "skip" });
    play({ type: "skip" });
    play({ type: "skip" });
    expect(state.phase).toBe("complete");
    expect(state.xp).toBe(50);
    expect(state.stars).toBe(3);
  });
});
