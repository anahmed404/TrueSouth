import { describe, expect, it } from "vitest";
import { createValueEvaluator } from "./evaluator";
import { initialRunnerState, reduceRunner, type RunnerState } from "./runner";
import {
  canCheck,
  conversationFor,
  draftAfterCheck,
  initialDraft,
  optionViews,
  pipAt,
  primaryAction,
  resultFor,
  type Draft,
} from "./step-view";
import type { Lesson, Step, Submission } from "./types";

const base = {
  luna: { mood: "thinking" as const, says: "Which one?" },
  hint: "Look again.",
  explain: "Because.",
};

function lessonWith(steps: readonly Step[]): Lesson {
  return {
    id: "fixture",
    title: "Fixture",
    tagline: "Fixture",
    patch: { name: "Patch", art: "fixture" },
    unlocks: "SystemView",
    recap: "Recap.",
    card: "fixture",
    steps,
  };
}

const evaluator = createValueEvaluator();

function submit(state: RunnerState, submission: Submission, lesson: Lesson) {
  return reduceRunner(state, { type: "submit", submission }, lesson, evaluator);
}

const states = (views: ReturnType<typeof optionViews>) => views.map((view) => view.state);

/** The pick kinds share one state machine: default, selected, missed, answer, dimmed. */
const pickSteps: Step[] = [
  { ...base, id: "choice", kind: "choice", options: ["a", "b", "c"], answer: 2 },
  { ...base, id: "formula", kind: "fill-formula", tex: "x = ?", options: ["a", "b", "c"], answer: 2 },
  { ...base, id: "bug", kind: "spot-bug", lines: ["a", "b", "c"], buggyLine: 2 },
];

describe.each(pickSteps)("$kind step states", (step) => {
  const lesson = lessonWith([step]);
  const kind = step.kind as "choice" | "fill-formula" | "spot-bug";
  const pick = (selected: number): Submission => ({ kind, selected });
  const draft = (selected: number): Draft => ({ kind, selected });

  it("starts with every option at default and Check off", () => {
    const runner = initialRunnerState();
    expect(initialDraft(step)).toBeNull();
    expect(states(optionViews(step, runner, null))).toEqual(["default", "default", "default"]);
    expect(primaryAction(step, runner, null, true)).toEqual({ kind: "check", label: "Check", enabled: false });
  });

  it("marks the selected option and turns Check on", () => {
    const runner = initialRunnerState();
    expect(states(optionViews(step, runner, draft(0)))).toEqual(["selected", "default", "default"]);
    expect(canCheck(step, runner, draft(0))).toBe(true);
  });

  it("after a first miss: the pick is crossed out, the draft clears, and it cannot be checked again", () => {
    const runner = submit(initialRunnerState(), pick(0), lesson);
    expect(runner.phase).toBe("hint");
    expect(draftAfterCheck(step, runner, draft(0))).toBeNull();
    const views = optionViews(step, runner, null);
    expect(states(views)).toEqual(["missed", "default", "default"]);
    expect(views[0]?.note).toBe("Not this one");
    expect(canCheck(step, runner, draft(0))).toBe(false);
    expect(canCheck(step, runner, draft(1))).toBe(true);
    const talk = conversationFor(step, runner);
    expect(talk.map((entry) => entry.who)).toEqual(["luna", "me", "luna"]);
    expect(talk[0]).toMatchObject({ old: true });
    expect(talk[1]).toMatchObject({ miss: true });
    expect(talk[2]).toMatchObject({ mood: "worried", text: "Not quite. Look again.", old: false });
  });

  it("after a second miss: both are marked by try, the answer is shown, Continue is next", () => {
    const runner = submit(submit(initialRunnerState(), pick(0), lesson), pick(1), lesson);
    expect(runner.phase).toBe("revealed");
    const views = optionViews(step, runner, null);
    expect(states(views)).toEqual(["missed", "missed", "answer"]);
    expect(views.map((view) => view.note)).toEqual(["1st try", "2nd try", "The answer"]);
    expect(primaryAction(step, runner, null, false)).toEqual({ kind: "continue", label: "Continue" });
    expect(resultFor(step, runner)).toEqual({ tone: "shown", headline: "c", xp: 2 });
    const talk = conversationFor(step, runner);
    expect(talk.filter((entry) => entry.who === "me")).toHaveLength(2);
    expect(talk[talk.length - 1]).toMatchObject({ who: "luna", text: "It's c. Because.", old: false });
  });

  it("when correct: the answer reads Correct, the rest dim, and the result row shows +10 XP", () => {
    const runner = submit(initialRunnerState(), pick(2), lesson);
    const views = optionViews(step, runner, null);
    expect(states(views)).toEqual(["dimmed", "dimmed", "answer"]);
    expect(views[2]).toEqual({ state: "answer", note: "Correct", correct: true });
    expect(resultFor(step, runner)).toEqual({ tone: "correct", headline: "Correct", xp: 10 });
    expect(primaryAction(step, runner, null, true)).toEqual({ kind: "continue", label: "Finish the lesson" });
    const talk = conversationFor(step, runner);
    expect(talk[talk.length - 1]).toMatchObject({ who: "luna", mood: "cheering", text: "Because." });
  });

  it("when correct on the second try: +5 XP", () => {
    const runner = submit(submit(initialRunnerState(), pick(0), lesson), pick(2), lesson);
    expect(resultFor(step, runner)).toEqual({ tone: "correct", headline: "Correct", xp: 5 });
    expect(states(optionViews(step, runner, null))).toEqual(["missed", "dimmed", "answer"]);
  });
});

describe("predict step states", () => {
  const step: Step = {
    ...base,
    id: "predict",
    kind: "predict",
    options: ["Sunlight", "Shadow"],
    answer: 1,
    reveal: { kind: "text", text: "It is shadow." },
  };
  const lesson = lessonWith([step]);

  it("labels its button Show me", () => {
    const action = primaryAction(step, initialRunnerState(), { kind: "predict", selected: 0 }, false);
    expect(action).toEqual({ kind: "check", label: "Show me", enabled: true });
  });

  it("plays a wrong guess out at once and marks it as the guess", () => {
    const runner = submit(initialRunnerState(), { kind: "predict", selected: 0 }, lesson);
    const views = optionViews(step, runner, null);
    expect(states(views)).toEqual(["missed", "answer"]);
    expect(views[0]?.note).toBe("Your guess");
    const talk = conversationFor(step, runner);
    expect(talk[talk.length - 1]).toMatchObject({ mood: "surprised", text: "It's Shadow. Because." });
    expect(resultFor(step, runner)).toEqual({ tone: "shown", headline: "Shadow", xp: 2 });
  });
});

describe("tune-slider step states", () => {
  const step: Step = {
    ...base,
    id: "slide",
    kind: "tune-slider",
    slider: { kind: "number", min: 0, max: 4, step: 1, unit: "steps" },
    goal: { metric: "value", op: "==", value: 3 },
    answerLabel: "3 steps",
  };
  const lesson = lessonWith([step]);

  it("starts at its minimum and can be checked at once", () => {
    const draft = initialDraft(step);
    expect(draft).toEqual({ kind: "tune-slider", variant: "number", value: 0 });
    expect(canCheck(step, initialRunnerState(), draft)).toBe(true);
  });

  it("after a miss, keeps the slider where it is but will not check the same value twice", () => {
    const draft: Draft = { kind: "tune-slider", variant: "number", value: 1 };
    const runner = submit(initialRunnerState(), { kind: "tune-slider", variant: "number", value: 1 }, lesson);
    expect(runner.phase).toBe("hint");
    expect(draftAfterCheck(step, runner, draft)).toEqual(draft);
    expect(canCheck(step, runner, draft)).toBe(false);
    expect(canCheck(step, runner, { kind: "tune-slider", variant: "number", value: 2 })).toBe(true);
    expect(conversationFor(step, runner)[1]).toMatchObject({ who: "me", text: "1 steps", miss: true });
  });

  it("shows its answer label after two misses, and its value when right", () => {
    const shown = submit(submit(initialRunnerState(), { kind: "tune-slider", variant: "number", value: 1 }, lesson), { kind: "tune-slider", variant: "number", value: 2 }, lesson);
    expect(resultFor(step, shown)).toEqual({ tone: "shown", headline: "3 steps", xp: 2 });
    const right = submit(initialRunnerState(), { kind: "tune-slider", variant: "number", value: 3 }, lesson);
    expect(conversationFor(step, right)[1]).toMatchObject({ who: "me", text: "3 steps", miss: false });
  });
});

describe("panel steps before A3", () => {
  it("offer a skip instead of Check", () => {
    const step: Step = { ...base, id: "pin", kind: "drop-pin", map: { view: "polar", siteIds: [], sitesKey: null, aside: null } };
    expect(primaryAction(step, initialRunnerState(), null, false)).toEqual({ kind: "skip", label: "Continue" });
  });
});

describe("Pip's meters", () => {
  it("carry the last known value forward", () => {
    const steps: Step[] = [
      { ...base, id: "a", kind: "choice", options: ["x"], answer: 0, pip: { power: 80, link: true } },
      { ...base, id: "b", kind: "choice", options: ["x"], answer: 0, pip: { power: 20 } },
      { ...base, id: "c", kind: "choice", options: ["x"], answer: 0 },
    ];
    expect(pipAt(steps, 0)).toEqual({ power: 80, link: true });
    expect(pipAt(steps, 2)).toEqual({ power: 20, link: true });
    expect(pipAt([{ ...base, id: "z", kind: "choice", options: ["x"], answer: 0 }], 0)).toBeNull();
  });
});

describe("a slider value with its unit", () => {
  it("puts degrees and percent on the number, and spaces other units", async () => {
    const { withUnit } = await import("./step-view");
    expect(withUnit(6.5, "°")).toBe("6.5°");
    expect(withUnit(11, "%")).toBe("11%");
    expect(withUnit(20, "km")).toBe("20 km");
  });
});
