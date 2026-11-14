import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { MOON_RADIUS_M } from "../../lib/geo/constants";
import { lesson1 } from "./lessons/l1";
import { lesson2 } from "./lessons/l2";
import { lesson3 } from "./lessons/l3";
import { lesson4 } from "./lessons/l4";
import { sampleExamples, sampleLesson } from "./lessons/sample";
import { sampleProfile } from "./lessons/sample-profile";
import { curvatureDropMetres, numberReadoutAt, piecewiseLinear } from "./readout";
import { resolveCentredHours } from "./time-range";
import type { Lesson, Step } from "./types";
import { FIXTURE_TIME_GRID, hourOnGrid, parseUtcHour } from "./utc";
import { lessonCheck, lessonScreenKind, validateLesson } from "./validate";
import { WORKED_EXAMPLE_KEYS } from "./worked-example-keys";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));

function readRepo(path: string): string {
  return readFileSync(`${repoRoot}${path}`, "utf8");
}

const scene = {
  scenario: {
    profile: sampleProfile,
    siteIds: ["sample-site"],
    focusedSiteId: "sample-site",
    landingUtc: "2028-01-01T00:00:00Z",
    currentUtc: "2028-01-01T00:00:00Z",
  },
  skyline: "terrain" as const,
  timeRange: null,
};

const choice: Step = {
  id: "only",
  luna: { mood: "thinking", says: "Go." },
  hint: "A hint.",
  explain: "Because.",
  kind: "choice",
  options: ["A"],
  answer: 0,
};

function lessonWith(steps: readonly Step[], id = "fixture"): Lesson {
  return {
    id,
    title: "Fixture",
    tagline: "Fixture",
    patch: { name: "Fixture", art: "fixture" },
    unlocks: "SystemView",
    recap: "Fixture.",
    card: "fixture",
    steps,
  };
}

describe("validateLesson", () => {
  it("accepts the sample lesson and lessons 1 to 4", () => {
    expect(validateLesson(sampleLesson, lessonCheck(sampleExamples))).toEqual([]);
    for (const lesson of [lesson1, lesson2, lesson3, lesson4]) {
      expect(validateLesson(lesson, lessonCheck()), lesson.id).toEqual([]);
    }
  });

  it("matches the WorkedExamples contract and the manifest", () => {
    const source = readRepo("web/src/contracts/generated.ts");
    const start = source.indexOf("export interface WorkedExamples");
    const end = source.indexOf("\n}", start);
    const keys = [...source.slice(start, end).matchAll(/"([^"]+)":/g)].map((match) => match[1]);
    expect(keys).toEqual([...WORKED_EXAMPLE_KEYS]);
    const manifest = JSON.parse(readRepo("data/fixtures/manifest.json")) as {
      moon_radius_m: number;
      time_grid: typeof FIXTURE_TIME_GRID;
    };
    expect(manifest.time_grid).toEqual(FIXTURE_TIME_GRID);
    expect(manifest.moon_radius_m).toBe(MOON_RADIUS_M);
    expect(readRepo("web/src/features/academy/lessons/l3.ts")).not.toContain("1737400");
  });

  it("rejects a worked-example key that is not in the contract", () => {
    const lesson = lessonWith([
      { ...choice, luna: { mood: "thinking", says: "The Sun is {{example.not_a_real_key}}° up." } },
    ]);
    expect(validateLesson(lesson, lessonCheck()).join("\n")).toMatch(/not_a_real_key/);
  });

  it("rejects a panel id that does not exist", () => {
    const broken = { ...lessonWith([choice]), unlocks: "NotAPanel" as unknown as Lesson["unlocks"] };
    expect(validateLesson(broken, lessonCheck()).join("\n")).toMatch(/NotAPanel/);
  });

  it("rejects a draw-skyline window narrower than 10°", () => {
    const sky: Step = {
      id: "sky",
      luna: { mood: "thinking", says: "Sketch." },
      hint: "Any sketch.",
      explain: "Passed.",
      kind: "draw-skyline",
      scene,
      window: { kind: "centred", centre: 10, halfWidthDeg: 4 },
    };
    expect(validateLesson(lessonWith([sky]), lessonCheck()).join("\n")).toMatch(/narrower than 10/);
  });

  it("accepts a drag goal's second condition on a stored metric, and rejects one that cannot be checked", () => {
    const drag: Step = {
      ...choice,
      id: "drag",
      kind: "drag-body",
      body: "sun",
      panel: "LandersEye",
      scene,
      goal: { metric: "sun_frac", op: "<", value: 0.5, also: { metric: "sun_el_deg", op: ">", value: 0 } },
    };
    const check = lessonCheck();
    expect(validateLesson(lessonWith([drag]), check)).toEqual([]);
    const unknown: Step = { ...drag, id: "unknown", goal: { metric: "sun_frac", op: "<", value: 0.5, also: { metric: "moon_phase", op: ">", value: 0 } } };
    expect(validateLesson(lessonWith([unknown]), check).join(" | ")).toMatch(/second goal condition on a metric the series does not store: moon_phase/);
    const text: Step = { ...drag, id: "text", goal: { metric: "sun_frac", op: "<", value: 0.5, also: { metric: "sun_el_deg", op: ">", value: "up" } } };
    expect(validateLesson(lessonWith([text]), check).join(" | ")).toMatch(/not a finite number/);
    const slider: Step = {
      ...choice,
      id: "slider",
      kind: "tune-slider",
      slider: { kind: "number", min: 0, max: 8, step: 0.5, unit: "°" },
      goal: { metric: "margin", op: "==", value: 1, also: { metric: "sun_el_deg", op: ">", value: 0 } },
    };
    expect(validateLesson(lessonWith([slider]), check).join(" | ")).toMatch(/only a drag-body step can check/);
  });

  it("rejects a slider goal off the range or off a step, and a negative tolerance", () => {
    const offRange: Step = {
      ...choice,
      id: "far",
      kind: "tune-slider",
      slider: { kind: "number", min: 0, max: 8, step: 0.5, unit: "°" },
      goal: { metric: "margin", op: "==", value: 9 },
    };
    const offStep: Step = { ...offRange, id: "step", goal: { metric: "margin", op: "==", value: 0.2 } };
    const negative: Step = {
      ...offRange,
      id: "tol",
      goal: { metric: "margin", op: "==", value: 5, tolerance: -1 },
    };
    const check = lessonCheck();
    expect(validateLesson(lessonWith([offRange]), check).join("\n")).toMatch(/outside the slider/);
    expect(validateLesson(lessonWith([offStep]), check).join("\n")).toMatch(/not on a slider step/);
    expect(validateLesson(lessonWith([negative]), check).join("\n")).toMatch(/tolerance/);
  });

  it("rejects a step with no hint or no explanation", () => {
    expect(validateLesson(lessonWith([{ ...choice, hint: "  " }]), lessonCheck()).join("\n")).toMatch(/no hint/);
    expect(validateLesson(lessonWith([{ ...choice, explain: "" }]), lessonCheck()).join("\n")).toMatch(/no explanation/);
  });

  it("rejects a date without Z, with an offset, off the hour, or outside the time grid", () => {
    const dated = (landingUtc: string): Lesson =>
      lessonWith([
        {
          id: "drag",
          luna: { mood: "thinking", says: "Drag." },
          hint: "A hint.",
          explain: "Because.",
          kind: "drag-body",
          body: "sun",
          panel: "LandersEye",
          scene: { ...scene, scenario: { ...scene.scenario, landingUtc } },
          goal: { metric: "sun_el_deg", op: "==", value: 1 },
        },
      ]);
    const check = lessonCheck();
    expect(validateLesson(dated("2026-01-02T00:00:00"), check).join("\n")).toMatch(/not a UTC hour/);
    expect(validateLesson(dated("2026-01-02T00:00:00+00:00"), check).join("\n")).toMatch(/not a UTC hour/);
    expect(validateLesson(dated("2026-01-02T00:30:00Z"), check).join("\n")).toMatch(/not a UTC hour/);
    expect(validateLesson(dated("2025-12-31T23:00:00Z"), check).join("\n")).toMatch(/not a UTC hour/);
    expect(parseUtcHour("2026-01-02T00:00:00")).toBeNull();
    expect(parseUtcHour("2026-01-02T00:00:00+00:00")).toBeNull();
    expect(parseUtcHour("2026-01-02T00:30:00Z")).toBeNull();
    expect(hourOnGrid(FIXTURE_TIME_GRID, "2032-01-01T00:00:00Z")).toBeNull();
    expect(hourOnGrid(FIXTURE_TIME_GRID, "2026-01-02T00:00:00.000Z")).toBe(hourOnGrid(FIXTURE_TIME_GRID, "2026-01-02T00:00:00Z"));
  });

  it("shows the unwritten screen for a lesson that fails, and does not throw", () => {
    const bad = lessonWith([
      {
        id: "drag",
        luna: { mood: "thinking", says: "Drag." },
        hint: "A hint.",
        explain: "Because.",
        kind: "drag-body",
        body: "sun",
        panel: "LandersEye",
        scene: { ...scene, scenario: { ...scene.scenario, landingUtc: "2026-01-02T00:00:00" } },
        goal: { metric: "sun_el_deg", op: "==", value: 1 },
      },
    ]);
    expect(lessonScreenKind(bad, lessonCheck())).toBe("unwritten");
    expect(lessonScreenKind(sampleLesson, lessonCheck(sampleExamples))).toBe("play");
  });
});

describe("the decided readouts and the lesson 2 drag window", () => {
  it("computes the curvature drop from the Moon's radius", () => {
    const drop = curvatureDropMetres(20, MOON_RADIUS_M);
    expect(drop).toBeCloseTo((20_000 * 20_000) / (2 * MOON_RADIUS_M), 6);
    expect(drop).toBeCloseTo(115.11, 1);
    const step = lesson3.steps[2];
    if (step?.kind !== "tune-slider" || step.slider.kind !== "number" || step.slider.readout?.kind !== "curvature-drop") {
      throw new Error("lesson 3 step 3 should be the distance slider");
    }
    expect(numberReadoutAt(step.slider.readout, 20)).toBeCloseTo(115.11, 1);
    expect(numberReadoutAt(step.slider.readout, 60)).toBeCloseTo(1036, 0);
  });

  it("reads link time as a piecewise line through the worked examples", () => {
    const readout = {
      kind: "piecewise-linear" as const,
      label: "link time",
      knots: [
        { at: 0, value: 40 },
        { at: 1, value: 20 },
        { at: 5, value: 10 },
        { at: 6, value: 0 },
      ],
    };
    expect(piecewiseLinear(0.5, readout.knots)).toBe(30);
    expect(piecewiseLinear(3, readout.knots)).toBe(15);
    expect(piecewiseLinear(8, readout.knots)).toBe(0);
    expect(numberReadoutAt(readout, 5.5)).toBe(5);
  });

  it("reads lesson 4's slider goal and link time from the fixture", () => {
    const fixture = JSON.parse(readRepo("data/fixtures/academy/worked_examples.json")) as Record<string, unknown>;
    const shares = fixture["l4.link_pct_by_mask"];
    const goal = fixture["l4.mask_for_15pct_deg"];
    if (!Array.isArray(shares) || typeof goal !== "number") throw new Error("fixture mask list");
    const step = lesson4.steps[3];
    if (step?.kind !== "tune-slider" || step.slider.kind !== "number" || step.slider.readout?.kind !== "example-list") {
      throw new Error("lesson 4 step 4");
    }
    expect(step.slider).toMatchObject({ min: 0, max: 10, step: 0.5 });
    // Any margin at or above the first one under 15% answers "less than 15% of the time".
    expect(step.goal).toEqual({ metric: "antenna_mask_deg", op: ">=", value: "{{example.l4.mask_for_15pct_deg}}" });
    expect(step.slider.follow).toEqual({ link: "link-up", source: "readout" });
    expect(step.slider.readout.key).toBe("l4.link_pct_by_mask");
    shares.forEach((share, index) => {
      expect(numberReadoutAt(step.slider.kind === "number" ? step.slider.readout! : { kind: "stops", label: "", stops: [] }, index * 0.5, fixture)).toBe(share);
    });
    expect(goal).toBe(shares.findIndex((share) => typeof share === "number" && share < 15) * 0.5);
    expect(validateLesson(lesson4, lessonCheck(fixture))).toEqual([]);
  });

  it("clamps the 48 hours around lesson 2's hour to the time grid", () => {
    const middle = resolveCentredHours("2028-06-15T12:00:00Z", 24, {});
    if (!middle || "missing" in middle) throw new Error("the centre should resolve");
    const centre = hourOnGrid(FIXTURE_TIME_GRID, "2028-06-15T12:00:00Z");
    expect(middle).toEqual({ fromIndex: (centre ?? 0) - 24, toIndex: (centre ?? 0) + 24 });
    const early = resolveCentredHours("2026-01-01T10:00:00Z", 24, {});
    expect(early).toEqual({ fromIndex: 0, toIndex: 34 });
    const missing = resolveCentredHours("{{example.l2.example_utc}}", 24, {});
    expect(missing).toEqual({ missing: ["l2.example_utc"] });
    const drag = lesson2.steps[3];
    if (drag?.kind !== "drag-body" || drag.scene.timeRange?.kind !== "hours") throw new Error("lesson 2 step 4");
    expect(drag.scene.timeRange.halfHours).toBe(24);
  });
});
