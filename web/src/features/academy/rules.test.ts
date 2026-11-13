import { describe, expect, it } from "vitest";
import { ALL_EIGHT_PATCH_NAME, PATCH_SHELF } from "./catalog";
import { compareGoalValues, createValueEvaluator, goalValueKind, type GoalEvaluator } from "./evaluator";
import { sampleProfile } from "./lessons/sample-profile";
import { resolveDegrees, resolveValue } from "./placeholders";
import {
  completionRecord,
  initialRunnerState,
  needsLeaveCheck,
  reduceRunner,
  type RunnerState,
} from "./runner";
import { skylineGapDeg, skylineRightFirstTime, skylineXp } from "./skyline-score";
import { createAcademyStore, type AcademyStorage } from "./store";
import { createStubEvaluator } from "./stub-evaluator";
import type { Lesson, Step, Submission } from "./types";

const scenario = {
  profile: sampleProfile,
  siteIds: ["sample-site"],
  focusedSiteId: "sample-site",
  landingUtc: "2028-01-01T00:00:00Z",
  currentUtc: "2028-01-01T00:00:00Z",
};

function lessonWith(steps: readonly Step[]): Lesson {
  return {
    id: "fixture",
    title: "Fixture",
    tagline: "Fixture",
    patch: { name: "Fixture patch", art: "fixture" },
    unlocks: "SystemView",
    recap: "Fixture recap.",
    card: "fixture",
    steps,
  };
}

const base = {
  luna: { mood: "thinking" as const, says: "Go." },
  hint: "A hint.",
  explain: "The reason.",
};

const values = createValueEvaluator();

function run(
  state: RunnerState,
  submission: Submission,
  lesson: Lesson,
  evaluator: GoalEvaluator = values,
  examples = {},
): RunnerState {
  return reduceRunner(state, { type: "submit", submission }, lesson, evaluator, examples);
}

describe("draw-skyline closeness XP", () => {
  it("gives 10 XP at 0.25° or closer", () => {
    expect(skylineXp(0)).toBe(10);
    expect(skylineXp(0.25)).toBe(10);
  });

  it("gives 7 XP at 1.0°: round(10 − 8 × 0.75 / 1.75)", () => {
    expect(skylineXp(1.0)).toBe(7);
  });

  it("gives 2 XP at 2.0° and beyond", () => {
    expect(skylineXp(2.0)).toBe(2);
    expect(skylineXp(3.5)).toBe(2);
    expect(skylineXp(40)).toBe(2);
  });

  it("scores a gap it cannot measure at the floor", () => {
    expect(skylineXp(Number.NaN)).toBe(2);
  });

  it("counts as right first time for stars at 1.0° or closer only", () => {
    expect(skylineRightFirstTime(1.0)).toBe(true);
    expect(skylineRightFirstTime(1.01)).toBe(false);
    expect(skylineRightFirstTime(Number.NaN)).toBe(false);
  });

  it("measures the mean absolute gap over the step's azimuth range", () => {
    const real = [
      { azDeg: 0, elDeg: 1 },
      { azDeg: 10, elDeg: 2 },
      { azDeg: 20, elDeg: 3 },
      { azDeg: 30, elDeg: 9 },
    ];
    const sketch = [
      { azDeg: 0, elDeg: 1.5 },
      { azDeg: 20, elDeg: 2.5 },
    ];
    // At 0: 0.5. At 10: sketch 2.0, gap 0. At 20: 0.5. 30 is out of range.
    expect(skylineGapDeg(sketch, real, 0, 20)).toBeCloseTo(1 / 3, 10);
    expect(skylineGapDeg([], real, 0, 20)).toBeNaN();
    expect(skylineGapDeg(sketch, real, 100, 200)).toBeNaN();
  });

  it("allows one attempt and scores it by closeness", () => {
    const lesson = lessonWith([{ ...base, id: "sk", kind: "draw-skyline", scene: { scenario }, azFrom: 0, azTo: 20 }]);
    const close = run(initialRunnerState(), { kind: "draw-skyline", sketch: [], gapDeg: 0.25 }, lesson);
    expect(close.phase).toBe("correct");
    expect(close.xp).toBe(10);
    expect(close.results).toEqual(["first"]);
    expect(run(close, { kind: "draw-skyline", sketch: [], gapDeg: 0 }, lesson)).toBe(close);

    const middling = run(initialRunnerState(), { kind: "draw-skyline", sketch: [], gapDeg: 1.0 }, lesson);
    expect(middling.xp).toBe(7);
    expect(middling.results).toEqual(["first"]);

    const far = run(initialRunnerState(), { kind: "draw-skyline", sketch: [], gapDeg: 2.5 }, lesson);
    expect(far.phase).toBe("correct");
    expect(far.xp).toBe(2);
    expect(far.results).toEqual(["sketched"]);
    const done = reduceRunner(far, { type: "continue" }, lesson, values);
    expect(done.stars).toBe(1);
  });
});

describe("predict scoring", () => {
  const lesson = lessonWith([
    { ...base, id: "p", kind: "predict", options: ["Sunlight", "Shadow"], answer: 1, reveal: { text: "Shadow." } },
  ]);

  it("gives 10 XP for a right guess", () => {
    const state = run(initialRunnerState(), { kind: "predict", selected: 1 }, lesson);
    expect(state.phase).toBe("correct");
    expect(state.xp).toBe(10);
    expect(state.results).toEqual(["first"]);
  });

  it("gives one guess: a wrong one plays out at once for 2 XP, with no hint", () => {
    const state = run(initialRunnerState(), { kind: "predict", selected: 0 }, lesson);
    expect(state.phase).toBe("revealed");
    expect(state.xp).toBe(2);
    expect(state.results).toEqual(["revealed"]);
    expect(state.shownAnswer).toBe("Shadow");
    expect(run(state, { kind: "predict", selected: 1 }, lesson)).toBe(state);
  });
});

describe("goal values", () => {
  it("tells the four forms apart", () => {
    expect(goalValueKind(12)).toBe("number");
    expect(goalValueKind("2028-03-04T06:00:00Z")).toBe("utc");
    expect(goalValueKind("2028-03-04T06:00Z")).toBe("utc");
    expect(goalValueKind("{{example.l7.best_utc}}")).toBe("placeholder");
    expect(goalValueKind("connecting_ridge")).toBe("text");
    expect(goalValueKind("2028-03-04T06:00:00")).toBe("text");
  });

  it("compares numbers, UTC times as moments, and text only for equality", () => {
    expect(compareGoalValues(3, "<=", 12)).toBe(true);
    expect(compareGoalValues(13, "<=", 12)).toBe(false);
    expect(compareGoalValues("2028-03-05T00:00:00Z", ">", "2028-03-04T06:00:00Z")).toBe(true);
    expect(compareGoalValues("2028-03-04T06:00:00Z", "==", "2028-03-04T06:00Z")).toBe(true);
    expect(compareGoalValues("shackleton", "==", "shackleton")).toBe(true);
    expect(compareGoalValues("shackleton", ">", "haworth")).toBe(false);
    expect(compareGoalValues(3, "==", "3")).toBe(false);
  });

  it("fills a whole placeholder and keeps its type", () => {
    const examples = { "l3.drop_at_20km_m": 115.1, "l7.best_utc": "2028-03-04T06:00:00Z" };
    expect(resolveValue("{{example.l3.drop_at_20km_m}}", examples)).toEqual({ value: 115.1, missing: [] });
    expect(resolveValue("{{example.l7.best_utc}}", examples).value).toBe("2028-03-04T06:00:00Z");
    expect(resolveValue("{{example.nope}}", examples)).toEqual({ value: null, missing: ["nope"] });
    expect(resolveValue("plain", examples).value).toBe("plain");
    expect(resolveDegrees("{{example.l3.drop_at_20km_m}}", examples)).toBe(115.1);
    expect(resolveDegrees("{{example.nope}}", examples)).toBeNull();
    expect(resolveDegrees(null, examples)).toBeNull();
  });

  const slider = (value: number | string): Step => ({
    ...base,
    id: "slide",
    kind: "tune-slider",
    slider: { min: 0, max: 60, step: 1, unit: "km" },
    goal: { metric: "distance_km", op: "==", value },
  });

  it("resolves a placeholder goal before asking the evaluator", () => {
    const lesson = lessonWith([slider("{{example.l3.target_km}}")]);
    const examples = { "l3.target_km": 20 };
    expect(run(initialRunnerState(), { kind: "tune-slider", value: 20 }, lesson, values, examples).phase).toBe("correct");
    expect(run(initialRunnerState(), { kind: "tune-slider", value: 21 }, lesson, values, examples).phase).toBe("hint");
  });

  it("never meets a goal whose placeholder is missing", () => {
    const lesson = lessonWith([slider("{{example.l3.missing}}")]);
    const yes = createStubEvaluator(true);
    expect(run(initialRunnerState(), { kind: "tune-slider", value: 20 }, lesson, yes).phase).toBe("hint");
  });

  it("accepts a UTC time as a drag-body value", () => {
    const lesson = lessonWith([
      {
        ...base,
        id: "drag",
        kind: "drag-body",
        body: "sun",
        scene: { scenario },
        goal: { metric: "utc", op: "==", value: "2028-03-05T18:00:00Z" },
      },
    ]);
    const state = run(initialRunnerState(), { kind: "drag-body", value: "2028-03-05T18:00:00Z" }, lesson);
    expect(state.phase).toBe("correct");
  });
});

describe("drop-pin", () => {
  it("passes any pin when the step has no goal", () => {
    const lesson = lessonWith([{ ...base, id: "pin", kind: "drop-pin", map: { siteIds: [] } }]);
    const state = run(initialRunnerState(), { kind: "drop-pin", pin: { latDeg: -89.4, lonEastDeg: 222.6 } }, lesson);
    expect(state.phase).toBe("correct");
    expect(state.xp).toBe(10);
  });

  it("checks a site id against the goal and hands coordinates to the evaluator", () => {
    const lesson = lessonWith([
      {
        ...base,
        id: "pin",
        kind: "drop-pin",
        map: { siteIds: ["a", "b"] },
        goal: { metric: "site_id", op: "==", value: "b" },
        answerLabel: "Site b",
      },
    ]);
    expect(run(initialRunnerState(), { kind: "drop-pin", pin: { siteId: "b" } }, lesson).phase).toBe("correct");
    const missed = run(initialRunnerState(), { kind: "drop-pin", pin: { siteId: "a" } }, lesson);
    expect(missed.phase).toBe("hint");

    let seen: unknown = null;
    const spy: GoalEvaluator = {
      meetsGoal(_goal, attempt) {
        seen = attempt;
        return false;
      },
    };
    const revealed = run(run(initialRunnerState(), { kind: "drop-pin", pin: { latDeg: -88, lonEastDeg: 10 } }, lesson, spy), { kind: "drop-pin", pin: { siteId: "a" } }, lesson, spy);
    expect(revealed.shownAnswer).toBe("Site b");
    expect(seen).toEqual({ stepId: "pin", kind: "drop-pin", pin: { siteId: "a" } });
  });
});

describe("skipping a panel step until A3", () => {
  const lesson = lessonWith([
    { ...base, id: "c", kind: "choice", options: ["a", "b"], answer: 0 },
    { ...base, id: "pin", kind: "drop-pin", map: { siteIds: [] } },
  ]);

  it("skips only a panel step, for no XP, and leaves it out of the stars", () => {
    const start = initialRunnerState();
    expect(reduceRunner(start, { type: "skip" }, lesson, values)).toBe(start);
    const answered = reduceRunner(run(start, { kind: "choice", selected: 0 }, lesson), { type: "continue" }, lesson, values);
    const done = reduceRunner(answered, { type: "skip" }, lesson, values);
    expect(done.phase).toBe("complete");
    expect(done.xp).toBe(10);
    expect(done.results).toEqual(["first", "skipped"]);
    expect(done.stars).toBe(3);
  });
});

describe("leaving a lesson part-way", () => {
  const lesson = lessonWith([
    { ...base, id: "one", kind: "choice", options: ["a", "b"], answer: 0 },
    { ...base, id: "two", kind: "choice", options: ["a", "b"], answer: 0 },
  ]);

  function memory(): AcademyStorage {
    const map = new Map<string, string>();
    return {
      getItem: (key) => map.get(key) ?? null,
      setItem: (key, value) => void map.set(key, value),
      removeItem: (key) => void map.delete(key),
    };
  }

  it("asks first only once something would be lost", () => {
    const start = initialRunnerState();
    expect(needsLeaveCheck(start)).toBe(false);
    const missed = run(start, { kind: "choice", selected: 1 }, lesson);
    expect(needsLeaveCheck(missed)).toBe(true);
    const second = reduceRunner(run(start, { kind: "choice", selected: 0 }, lesson), { type: "continue" }, lesson, values);
    expect(needsLeaveCheck(second)).toBe(true);
  });

  it("drops the lesson's XP: nothing is saved until the lesson is complete", () => {
    const store = createAcademyStore(memory());
    const partway = run(initialRunnerState(), { kind: "choice", selected: 0 }, lesson);
    expect(partway.xp).toBe(10);
    expect(completionRecord(partway)).toBeNull();
    // Leaving saves nothing, so the store is unchanged.
    expect(store.getState().xp).toBe(0);
    expect(store.getState().lessons).toEqual({});

    const first = reduceRunner(partway, { type: "continue" }, lesson, values);
    const done = reduceRunner(run(first, { kind: "choice", selected: 0 }, lesson), { type: "continue" }, lesson, values);
    expect(needsLeaveCheck(done)).toBe(false);
    const record = completionRecord(done);
    expect(record).toEqual({ stars: 3, xp: 20 });
    if (record) store.getState().recordCompletion(lesson.id, record.stars, record.xp);
    expect(store.getState().xp).toBe(20);
  });
});

describe("the ninth patch", () => {
  it("is named True South and ends the shelf of nine", () => {
    expect(ALL_EIGHT_PATCH_NAME).toBe("True South");
    expect(PATCH_SHELF).toHaveLength(9);
    expect(PATCH_SHELF[8]?.name).toBe("True South");
  });
});
