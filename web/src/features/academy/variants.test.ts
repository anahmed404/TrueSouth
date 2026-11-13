import { describe, expect, it } from "vitest";
import { createValueEvaluator, type GoalEvaluator } from "./evaluator";
import { sampleProfile } from "./lessons/sample-profile";
import { initialRunnerState, reduceRunner, type RunnerState } from "./runner";
import { resolveSkylineWindow } from "./skyline-score";
import { initialDraft, type Draft } from "./step-view";
import type { Lesson, SceneSpec, Step, Submission } from "./types";

const scenario: SceneSpec["scenario"] = {
  profile: sampleProfile,
  siteIds: ["sample-site"],
  focusedSiteId: "sample-site",
  landingUtc: "2028-01-01T00:00:00Z",
  currentUtc: "2028-01-01T00:00:00Z",
};

const scene = (skyline: SceneSpec["skyline"]): SceneSpec => ({ scenario, skyline, timeRange: null });

const base = {
  luna: { mood: "thinking" as const, says: "Go." },
  hint: "A hint.",
  explain: "The reason.",
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

const values = createValueEvaluator();

function run(state: RunnerState, submission: Submission, lesson: Lesson, evaluator: GoalEvaluator = values, examples = {}) {
  return reduceRunner(state, { type: "submit", submission }, lesson, evaluator, examples);
}

/** First and last instants of the shared time grid in data/fixtures/manifest.json. */
const GRID_START = "2026-01-01T00:00:00Z";
const GRID_END = "2031-12-31T23:00:00Z";

const choice = {
  ...base,
  id: "choice",
  kind: "choice",
  options: ["East", "Up"],
  answer: 0,
} satisfies Step;

const predictText = {
  ...base,
  id: "predict-text",
  kind: "predict",
  options: ["Yes", "No"],
  answer: 0,
  reveal: { kind: "text", text: "Yes." },
} satisfies Step;

const predictPanel = {
  ...base,
  id: "predict-panel",
  kind: "predict",
  options: ["Yes", "No"],
  answer: 1,
  reveal: {
    kind: "panel",
    panel: "LandersEye",
    caption: "At that hour.",
    scene: scene("terrain"),
    when: { kind: "hour", utc: "{{example.l2.example_utc}}" },
  },
} satisfies Step;

const predictPicture = {
  ...base,
  id: "predict-picture",
  kind: "predict",
  options: ["Tip", "Nothing"],
  answer: 0,
  reveal: { kind: "illustration", illustration: "curved-moon-side", caption: "A side view." },
} satisfies Step;

const dragFlat = {
  ...base,
  id: "drag-flat",
  kind: "drag-body",
  body: "sun",
  panel: "LandersEye",
  scene: { scenario, skyline: "flat", timeRange: { kind: "span", span: "one-month", aroundUtc: GRID_START } },
  goal: { metric: "sun_el_deg", op: "==", value: 2 },
  follow: { power: "sun-fraction" },
} satisfies Step;

const dragSmooth = {
  ...base,
  id: "drag-smooth",
  kind: "drag-body",
  body: "earth",
  panel: "Timeline",
  scene: {
    scenario,
    skyline: "smooth",
    timeRange: { kind: "utc", fromUtc: GRID_START, toUtc: GRID_END },
  },
  goal: { metric: "earth_el_deg", op: ">", value: 0 },
  readout: ["highest"],
} satisfies Step;

const skylineNumbers = {
  ...base,
  id: "sky-numbers",
  kind: "draw-skyline",
  scene: scene("terrain"),
  azFrom: 0,
  azTo: 90,
} satisfies Step;

const skylineKeys = {
  ...base,
  id: "sky-keys",
  kind: "draw-skyline",
  scene: scene("terrain"),
  azFrom: "{{example.l2.sun_az_deg}}",
  azTo: "{{example.l2.sun_az_deg}}",
} satisfies Step;

const pinFree = {
  ...base,
  id: "pin-free",
  kind: "drop-pin",
  map: { view: "polar", siteIds: [], sitesKey: "l8.candidates", aside: "SlipPlanner" },
} satisfies Step;

const pinSlope = {
  ...base,
  id: "pin-slope",
  kind: "drop-pin",
  map: { view: "closeup", siteIds: ["connecting_ridge"], sitesKey: null, aside: null },
  goal: { metric: "slope_deg", op: "<=", value: 10 },
} satisfies Step;

const numberSlider = {
  ...base,
  id: "number-slider",
  kind: "tune-slider",
  slider: {
    kind: "number",
    min: 0,
    max: 20,
    step: 1,
    unit: "°",
    label: "Margin",
    readout: { label: "drop", stops: [{ at: 10, text: "115 m" }] },
    scene: scene("smooth"),
    follow: { link: "link-up" },
  },
  goal: { metric: "margin_deg", op: "==", value: 10, tolerance: 1 },
} satisfies Step;

const dateSlider = {
  ...base,
  id: "date-slider",
  kind: "tune-slider",
  slider: { kind: "date", minUtc: GRID_START, maxUtc: GRID_END, stepDays: 1, label: "Landing" },
  goal: { metric: "landing_utc", op: "==", value: GRID_START },
  unreachable: { says: "No GO date in range.", offer: ["best-caution-date", "change-site"] },
} satisfies Step;

const formula = {
  ...base,
  id: "formula",
  kind: "fill-formula",
  tex: "drop = distance² ÷ ( ? )",
  options: ["R", "2R"],
  answer: 1,
} satisfies Step;

const bug = {
  ...base,
  id: "bug",
  kind: "spot-bug",
  lines: ["one", "two"],
  buggyLine: 1,
} satisfies Step;

const everyVariant = [
  choice,
  predictText,
  predictPanel,
  predictPicture,
  dragFlat,
  dragSmooth,
  skylineNumbers,
  skylineKeys,
  pinFree,
  pinSlope,
  numberSlider,
  dateSlider,
  formula,
  bug,
] satisfies readonly Step[];

describe("every step kind and every new variant type-checks", () => {
  it("lists one step of each kind and of each new variant, with no casts", () => {
    expect(everyVariant.map((step) => step.kind)).toEqual([
      "choice",
      "predict",
      "predict",
      "predict",
      "drag-body",
      "drag-body",
      "draw-skyline",
      "draw-skyline",
      "drop-pin",
      "drop-pin",
      "tune-slider",
      "tune-slider",
      "fill-formula",
      "spot-bug",
    ]);
    expect(predictPanel.reveal.kind).toBe("panel");
    expect(predictPicture.reveal.kind).toBe("illustration");
    expect(dragFlat.scene.skyline).toBe("flat");
    expect(dragSmooth.scene.skyline).toBe("smooth");
    expect(numberSlider.slider.kind).toBe("number");
    expect(dateSlider.slider.kind).toBe("date");
  });
});

describe("a number slider with a readout, a scene and a tolerance", () => {
  const lesson = lessonWith([numberSlider]);
  const at = (value: number): Submission => ({ kind: "tune-slider", variant: "number", value });

  it("passes on the tolerance edge and fails one step outside it", () => {
    expect(run(initialRunnerState(), at(9), lesson).phase).toBe("correct");
    expect(run(initialRunnerState(), at(11), lesson).xp).toBe(10);
    expect(run(initialRunnerState(), at(8.999), lesson).phase).toBe("hint");
    expect(run(initialRunnerState(), at(11.001), lesson).phase).toBe("hint");
  });

  it("gives a second try, then shows the answer", () => {
    const second = run(run(initialRunnerState(), at(0), lesson), at(10), lesson);
    expect(second.phase).toBe("correct");
    expect(second.xp).toBe(5);
    expect(second.results).toEqual(["second"]);
    const shown = run(run(initialRunnerState(), at(0), lesson), at(1), lesson);
    expect(shown.phase).toBe("revealed");
    expect(shown.xp).toBe(2);
    expect(shown.results).toEqual(["revealed"]);
  });

  it("starts the draft at the numeric minimum", () => {
    const draft: Draft = initialDraft(numberSlider);
    expect(draft).toEqual({ kind: "tune-slider", variant: "number", value: 0 });
  });
});

describe("a date slider on the time grid", () => {
  const at = (utc: string): Submission => ({ kind: "tune-slider", variant: "date", utc });
  const before = "2025-12-31T23:00:00Z";
  const after = "2032-01-01T00:00:00Z";

  it("accepts the first day and the last day, and rejects a day outside", () => {
    const first = lessonWith([{ ...dateSlider, goal: { metric: "landing_utc", op: "==", value: GRID_START } }]);
    expect(run(initialRunnerState(), at(GRID_START), first).phase).toBe("correct");
    expect(run(initialRunnerState(), at(GRID_END), first).phase).toBe("hint");
    expect(run(initialRunnerState(), at(before), first).phase).toBe("hint");

    const last = lessonWith([{ ...dateSlider, goal: { metric: "landing_utc", op: "==", value: GRID_END } }]);
    expect(run(initialRunnerState(), at(GRID_END), last).phase).toBe("correct");
    expect(run(initialRunnerState(), at(GRID_START), last).phase).toBe("hint");
    expect(run(initialRunnerState(), at(after), last).phase).toBe("hint");
  });

  it("scores a second try and a shown answer", () => {
    const lesson = lessonWith([dateSlider]);
    const second = run(run(initialRunnerState(), at(GRID_END), lesson), at(GRID_START), lesson);
    expect(second.xp).toBe(5);
    expect(second.results).toEqual(["second"]);
    const shown = run(run(initialRunnerState(), at(GRID_END), lesson), at(GRID_END), lesson);
    expect(shown.phase).toBe("revealed");
    expect(shown.xp).toBe(2);
  });

  it("starts the draft on the first day", () => {
    expect(initialDraft(dateSlider)).toEqual({ kind: "tune-slider", variant: "date", utc: GRID_START });
  });

  it("ignores a number submitted to a date slider", () => {
    const lesson = lessonWith([dateSlider]);
    const start = initialRunnerState();
    expect(run(start, { kind: "tune-slider", variant: "number", value: 1 }, lesson)).toBe(start);
  });
});

describe("a goal that cannot be checked yet", () => {
  it("does not pass and does not crash when the worked-example key is missing", () => {
    const lesson = lessonWith([
      { ...dateSlider, goal: { metric: "landing_utc", op: "==", value: "{{example.l7.next_go_date}}" } },
    ]);
    const yes: GoalEvaluator = { meetsGoal: () => true };
    const state = run(initialRunnerState(), { kind: "tune-slider", variant: "date", utc: GRID_START }, lesson, yes, {});
    expect(state.phase).toBe("unavailable");
    expect(state.feedback).toBe("This cannot be checked yet.");
    expect(state.xp).toBe(0);
    expect(state.results).toEqual(["unavailable"]);
    const done = reduceRunner(state, { type: "continue" }, lesson, yes);
    expect(done.phase).toBe("complete");
    expect(done.stars).toBe(1);
    expect(done.patchEarned).toBe(false);
  });

  it("says so for an option whose equals-key is missing, and passes when the key is there", () => {
    const step: Step = {
      ...base,
      id: "site",
      kind: "choice",
      options: ["{{example.l7.alt_site}}", "somewhere else"],
      answer: { equals: "{{example.l7.alt_site}}" },
    };
    const lesson = lessonWith([step]);
    const missing = run(initialRunnerState(), { kind: "choice", selected: 0 }, lesson, values, {});
    expect(missing.phase).toBe("unavailable");
    expect(missing.feedback).toBe("This cannot be checked yet.");
    const right = run(initialRunnerState(), { kind: "choice", selected: 0 }, lesson, values, { "l7.alt_site": "fixture_ridge" });
    expect(right.phase).toBe("correct");
    expect(right.xp).toBe(10);
    const wrong = run(initialRunnerState(), { kind: "choice", selected: 1 }, lesson, values, { "l7.alt_site": "fixture_ridge" });
    expect(wrong.phase).toBe("hint");
  });
});

describe("a goal that compares two metrics, and one that uses an earlier answer", () => {
  it("asks the evaluator which score is higher", () => {
    const step: Step = {
      ...base,
      id: "rank",
      kind: "tune-slider",
      slider: { kind: "number", min: 0, max: 1, step: 0.1, unit: "", label: "Power weight" },
      goal: { metric: "score_b", op: ">", comparedTo: "score_a" },
    };
    const lesson = lessonWith([step]);
    const attempt: Submission = { kind: "tune-slider", variant: "number", value: 0.2 };
    expect(run(initialRunnerState(), attempt, lesson, values).phase).toBe("hint");
    const yes: GoalEvaluator = { meetsGoal: () => true };
    expect(run(initialRunnerState(), attempt, lesson, yes).phase).toBe("correct");
  });

  it("passes the earlier pin's site id to the date goal", () => {
    const lesson = lessonWith([
      pinFree,
      {
        ...dateSlider,
        id: "when",
        goal: { metric: "status", op: "==", value: "GO", prior: { stepId: "pin-free", field: "siteId" } },
      },
    ]);
    let seen: unknown = null;
    const spy: GoalEvaluator = {
      meetsGoal(_goal, attempt) {
        seen = attempt;
        return true;
      },
    };
    const pinned = run(initialRunnerState(), { kind: "drop-pin", pin: { siteId: "fixture_ridge" } }, lesson, spy);
    const next = reduceRunner(pinned, { type: "continue" }, lesson, spy);
    const dated = run(next, { kind: "tune-slider", variant: "date", utc: GRID_START }, lesson, spy);
    expect(dated.phase).toBe("correct");
    expect(seen).toEqual({
      stepId: "when",
      kind: "tune-slider",
      value: GRID_START,
      prior: { stepId: "pin-free", value: "fixture_ridge" },
    });
  });

  it("cannot check a prior site id when the pin was only coordinates", () => {
    const lesson = lessonWith([
      { ...pinSlope, goal: undefined },
      {
        ...dateSlider,
        id: "when",
        goal: { metric: "status", op: "==", value: "GO", prior: { stepId: "pin-slope", field: "siteId" } },
      },
    ]);
    const pinned = run(initialRunnerState(), { kind: "drop-pin", pin: { latDeg: -89, lonEastDeg: 0 } }, lesson);
    const next = reduceRunner(pinned, { type: "continue" }, lesson, values);
    const dated = run(next, { kind: "tune-slider", variant: "date", utc: GRID_START }, lesson);
    expect(dated.phase).toBe("unavailable");
    expect(dated.feedback).toBe("This cannot be checked yet.");
  });
});

describe("a slider no stop can satisfy", () => {
  it("offers the fallback and does not count it as a pass", () => {
    const lesson = lessonWith([dateSlider]);
    const impossible: GoalEvaluator = {
      meetsGoal: () => true,
      status: () => "impossible",
    };
    const state = run(initialRunnerState(), { kind: "tune-slider", variant: "date", utc: GRID_START }, lesson, impossible);
    expect(state.phase).toBe("unavailable");
    expect(state.feedback).toBe("No GO date in range.");
    expect(state.results).toEqual(["unreachable"]);
    expect(state.xp).toBe(0);
  });
});

describe("predict reveals", () => {
  it("scores a panel reveal and an illustration the same way: right, then shown", () => {
    for (const step of [predictPanel, predictPicture, predictText]) {
      const lesson = lessonWith([step]);
      if (typeof step.answer !== "number") throw new Error("these reveals use an index");
      const right = run(initialRunnerState(), { kind: "predict", selected: step.answer }, lesson);
      expect(right.phase).toBe("correct");
      expect(right.xp).toBe(10);
      const wrongIndex = step.answer === 0 ? 1 : 0;
      const wrong = run(initialRunnerState(), { kind: "predict", selected: wrongIndex }, lesson);
      expect(wrong.phase).toBe("revealed");
      expect(wrong.xp).toBe(2);
    }
  });
});

describe("the skyline window", () => {
  it("fills a placeholder azimuth and refuses a missing key", () => {
    expect(resolveSkylineWindow("{{example.l2.sun_az_deg}}", 10, { "l2.sun_az_deg": 4 })).toEqual({ azFrom: 4, azTo: 10 });
    expect(resolveSkylineWindow(0, 90, {})).toEqual({ azFrom: 0, azTo: 90 });
    expect(resolveSkylineWindow("{{example.l2.missing}}", 10, {})).toBeNull();
  });
});
