import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createValueEvaluator } from "../evaluator";
import { formatNumber } from "../format-example";
import { exampleText, fillPlaceholders, type WorkedExamples } from "../placeholders";
import { numberReadoutAt } from "../readout";
import { answerText, initialRunnerState, PANEL_STEP_KINDS, reduceRunner, type RunnerState } from "../runner";
import { conversationFor, primaryAction } from "../step-view";
import type { Lesson, PanelId, Step, Submission } from "../types";
import { panelName } from "../ui/panels";
import { lessonCheck, validateLesson } from "../validate";
import { isWritten, WRITTEN_LESSONS } from "./index";
import { lesson1 } from "./l1";
import { lesson2 } from "./l2";
import { lesson3 } from "./l3";
import { lesson4 } from "./l4";

const lessons = [lesson1, lesson2, lesson3, lesson4] satisfies readonly Lesson[];

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const readRepo = (path: string) => readFileSync(`${repoRoot}${path}`, "utf8");
const lessonsDoc = readRepo("docs/academy/lessons.md");
const contractSource = readRepo("web/src/contracts/generated.ts");
const panelSource = readRepo("web/src/features/academy/ui/panels.ts");

/** The real worked examples, built by `truesouth build-worked-examples`, and the synthetic fixture. */
const real = JSON.parse(readRepo("data/derived/academy/worked_examples.json")) as Record<string, unknown>;
const fixture = JSON.parse(readRepo("data/fixtures/academy/worked_examples.json")) as Record<string, unknown>;

const num = (key: string): number => {
  const value = real[key];
  if (typeof value !== "number") throw new Error(`${key} is not a number in worked_examples.json`);
  return value;
};

function contractKeys(): Set<string> {
  const start = contractSource.indexOf("export interface WorkedExamples");
  const end = contractSource.indexOf("\n}", start);
  const block = contractSource.slice(start, end);
  return new Set([...block.matchAll(/"([^"]+)":/g)].map((match) => match[1] ?? ""));
}

/** `{{example.key}}` and the doc's `{{key}}` become the same text. */
function canon(text: string): string {
  return text.replace(/\{\{example\.([^}]+)\}\}/g, "{{$1}}").replace(/\s+/g, " ").trim();
}

/** As `canon`, and a sentence the doc quotes mid-line ("Reveal: a side view…") may start in lower case. */
function sentence(text: string): string {
  const plain = canon(text);
  return plain.charAt(0).toLowerCase() + plain.slice(1);
}

function section(number: number): string {
  const marker = `## ${number}. `;
  const start = lessonsDoc.indexOf(marker);
  const next = lessonsDoc.indexOf("\n## ", start + marker.length);
  return lessonsDoc.slice(start, next === -1 ? undefined : next);
}

type DocRow = { kind: string; asks: string; happens: string };

function sectionRows(number: number): DocRow[] {
  const rows: DocRow[] = [];
  for (const line of section(number).split("\n")) {
    if (!line.startsWith("| ")) continue;
    const cells = line.split("|").slice(1, -1).map((cell) => cell.trim());
    if (!/^\d+$/.test(cells[0] ?? "")) continue;
    const kind = cells[1]?.match(/`([a-z-]+)`/)?.[1] ?? "";
    const asks = cells[2]?.match(/"([^"]*)"/)?.[1] ?? "";
    rows.push({ kind, asks, happens: cells[3] ?? "" });
  }
  return rows;
}

/** Every quoted sentence in a lesson's section, plus the table's reveal descriptions. */
function docWords(number: number): Set<string> {
  const text = section(number);
  const words = new Set<string>();
  for (const quote of text.matchAll(/"([^"]+)"/g)) words.add(sentence(quote[1] ?? ""));
  for (const row of sectionRows(number)) {
    const reveal = row.happens.split("Reveal:")[1];
    if (reveal) words.add(sentence(reveal));
  }
  return words;
}

function walk(value: unknown, visit: (text: string) => void): void {
  if (typeof value === "string") {
    visit(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) walk(item, visit);
    return;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) walk(item, visit);
  }
}

function exampleKeys(lesson: Lesson): string[] {
  const keys: string[] = [];
  walk(lesson, (text) => {
    for (const match of text.matchAll(/\{\{example\.([^}]+)\}\}/g)) {
      if (match[1]) keys.push(match[1]);
    }
  });
  return keys;
}

/** The learner-facing sentences of a step that the table does not already pin down. */
function stepWords(step: Step): string[] {
  const words = [step.hint, step.explain];
  if (step.kind === "predict" && step.reveal.kind !== "text") words.push(step.reveal.caption);
  if (step.kind === "predict" && step.reveal.kind === "text") words.push(step.reveal.text);
  if (step.kind === "spot-bug" && step.title) words.push(step.title);
  if ((step.kind === "drag-body" || step.kind === "draw-skyline" || step.kind === "drop-pin") && step.preview) {
    words.push(step.preview.says, step.preview.reveal);
  }
  return words;
}

function panelsOf(lesson: Lesson): PanelId[] {
  const ids: PanelId[] = typeof lesson.unlocks === "string" ? [lesson.unlocks] : [...lesson.unlocks];
  for (const step of lesson.steps) {
    if (step.kind === "drag-body") ids.push(step.panel);
    if (step.kind === "predict" && step.reveal.kind === "panel") ids.push(step.reveal.panel);
    if (step.kind === "tune-slider" && step.slider.panel) ids.push(step.slider.panel);
    if (step.kind === "drop-pin" && step.map.aside) ids.push(step.map.aside);
  }
  return ids;
}

function bolds(text: string): string[] {
  return [...text.matchAll(/\*\*([^*]+)\*\*/g)].map((match) => canon(match[1] ?? ""));
}

describe("lessons 1 to 4 against docs/academy/lessons.md", () => {
  const keys = contractKeys();

  it.each(lessons.map((lesson, index) => [index + 1, lesson] as const))(
    "lesson %s has the doc's steps and answers, and every sentence is in the doc",
    (number, lesson) => {
      const rows = sectionRows(number);
      const words = docWords(number);
      expect(lesson.steps).toHaveLength(rows.length);
      lesson.steps.forEach((step, index) => {
        const row = rows[index];
        expect(row, `step ${index + 1}`).toBeDefined();
        if (!row) return;
        expect(step.kind).toBe(row.kind);
        expect(canon(step.luna.says)).toBe(canon(row.asks));
        for (const text of stepWords(step)) {
          expect(text.trim().length, step.id).toBeGreaterThan(0);
          expect(words.has(sentence(text)), `${step.id}: "${text}" is not in lessons.md`).toBe(true);
        }
        if ((step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula") && typeof step.answer === "number") {
          const option = canon(step.options[step.answer] ?? "");
          expect(bolds(row.happens).some((bold) => bold.includes(option) || option.includes(bold))).toBe(true);
        }
        if (step.kind === "spot-bug") {
          const line = canon(step.lines[step.buggyLine] ?? "");
          expect(bolds(row.happens).some((bold) => bold.includes(line))).toBe(true);
        }
      });
      for (const key of exampleKeys(lesson)) expect(keys.has(key), key).toBe(true);
      for (const panel of panelsOf(lesson)) {
        expect(panelSource).toContain(`${panel}:`);
        expect(panelName(panel).length).toBeGreaterThan(0);
      }
    },
  );

  it("has no placeholder words left", () => {
    for (const lesson of lessons) {
      walk(lesson, (text) => {
        expect(text, lesson.id).not.toMatch(/TODO|PROVISIONAL/);
      });
    }
  });

  it("gives every panel step a preview: what the learner will do, and the real answer", () => {
    for (const lesson of lessons) {
      const steps: readonly Step[] = lesson.steps;
      for (const step of steps) {
        if (step.kind !== "drag-body" && step.kind !== "draw-skyline" && step.kind !== "drop-pin") continue;
        expect(step.preview, step.id).toBeDefined();
        expect(step.preview?.reveal, step.id).toMatch(/\{\{example\./);
      }
    }
  });

  it("are the written lessons, in path order", () => {
    expect(WRITTEN_LESSONS.map((lesson) => lesson.id)).toEqual(["l1_sun", "l2_skyline", "l3_horizon", "l4_link"]);
    expect(isWritten("l5_slope")).toBe(false);
    expect(isWritten("sample")).toBe(false);
  });
});

describe("lessons 1 to 4 validate", () => {
  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))("%s has no problems on the real worked examples", (_, lesson) => {
    expect(validateLesson(lesson, lessonCheck(real))).toEqual([]);
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))("%s has no problems on the fixture", (_, lesson) => {
    expect(validateLesson(lesson, lessonCheck(fixture))).toEqual([]);
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))("%s fills every placeholder from the real data", (_, lesson) => {
    walk(lesson, (text) => {
      expect(fillPlaceholders(text, real).missing, text).toEqual([]);
    });
  });
});

/**
 * Each multiple-choice answer checked against the real numbers in worked_examples.json.
 * The right option must be right and every wrong option clearly wrong.
 */
describe("multiple-choice answers on the real data", () => {
  it("lesson 1: the Sun stays under 3° (not overhead, not 45°), even at the best-season 2.08°", () => {
    expect(num("l1.sun_el_max_deg")).toBeLessThan(3);
    expect(num("l1.sun_el_max_deg")).toBeLessThan(45 / 2);
    expect(90 - Math.abs(num("l1.site_lat_deg")) + 1.54).toBeCloseTo(2.08, 2);
    expect(2.08).toBeLessThan(3);
    // The tilt, not Earth's 23.4° or the orbit's 5.1°: those would put the polar Sun far higher.
    expect(90 - Math.abs(num("l1.site_lat_deg")) + 5.1).toBeGreaterThan(5);
  });

  it("lesson 1 step 3: the month's Sun dips just below level, so 'circles' never reads as 'always visible'", () => {
    expect(num("l1.sun_el_min_deg")).toBeLessThan(0);
    expect(num("l1.sun_el_min_deg")).toBeGreaterThan(-1);
  });

  it("lesson 2: from the lesson 2 site the ridge stands above Pip and higher than the Sun, so Pip is in shadow", () => {
    expect(num("l2.sun_el_deg")).toBeGreaterThan(0);
    expect(num("l2.ridge_rise_m")).toBeGreaterThan(0);
    expect(num("l2.ridge_dist_km")).toBeGreaterThan(5);
    expect(num("l2.ridge_el_deg")).toBeGreaterThan(num("l2.sun_el_deg"));
    expect(num("l2.sun_frac")).toBeLessThan(0.5);
  });

  it("lesson 2 step 5: the near ridge looks taller; the far mountain is below the horizon (drops from §4)", () => {
    const radius = Number(JSON.parse(readRepo("data/derived/manifest.json")).moon_radius_m);
    const angle = (heightM: number, distanceKm: number) => {
      const s = distanceKm * 1000;
      return (Math.atan((heightM - (s * s) / (2 * radius)) / s) * 180) / Math.PI;
    };
    expect(angle(300, 12)).toBeGreaterThan(1);
    expect(angle(3000, 150)).toBeLessThan(0);
  });

  it("lesson 3: at 130 km most of a 5 km mountain has dropped away, but not all of it", () => {
    expect(num("l3.drop_at_130km_m")).toBeLessThan(5000);
    expect(num("l3.drop_at_130km_m")).toBeGreaterThan(4000);
    expect(num("l3.drop_at_20km_m")).toBeCloseTo(115.1, 1);
    // Spot the bug: a 1,000 m ridge at 60 km has dropped more than its height.
    expect(num("l3.drop_at_60km_m")).toBeGreaterThan(1000);
    // Why a third of a degree matters: the month's Sun is not even two-thirds of a degree up.
    expect(num("l1.sun_el_max_deg")).toBeLessThan(1);
    // The card's example: the most distant blocker lies below Pip, and the card says so.
    expect(num("l3.example_height_m")).toBeLessThan(0);
    expect(num("l3.example_el_true_deg")).toBeLessThan(num("l3.example_el_flat_deg"));
  });

  it("lesson 4: Earth bobs across the horizon, up for a share that is neither always nor almost never", () => {
    expect(num("l4.earth_el_max_deg")).toBeGreaterThan(0);
    expect(num("l4.earth_el_min_deg")).toBeLessThan(0);
    expect(num("l4.earth_up_pct")).toBeGreaterThan(30);
    expect(num("l4.earth_up_pct")).toBeLessThan(90);
  });

  it("lesson 4: the goal margin is the first with link time under 15%, and a 5° margin never gives half the month", () => {
    const list = real["l4.link_pct_by_mask"] as number[];
    const goal = num("l4.mask_for_15pct_deg");
    const index = goal / 0.5;
    expect(list[index]).toBeLessThan(15);
    expect(list[index - 1]).toBeGreaterThanOrEqual(15);
    expect(num("l4.link_pct_mask5")).toBeLessThan(50);
    expect(num("l4.link_pct_mask5")).toBeGreaterThan(0);
    // The slider's readout reads the same list.
    const step = lesson4.steps[3];
    if (step?.kind !== "tune-slider" || step.slider.kind !== "number" || !step.slider.readout) throw new Error("step 4 is the slider");
    expect(numberReadoutAt(step.slider.readout, goal, real)).toBe(list[index]);
  });
});

function pickRight(step: Step): Submission | null {
  switch (step.kind) {
    case "choice":
    case "predict":
    case "fill-formula":
      return { kind: step.kind, selected: typeof step.answer === "number" ? step.answer : 0 };
    case "spot-bug":
      return { kind: "spot-bug", selected: step.buggyLine };
    case "tune-slider":
      if (step.slider.kind !== "number") return null;
      if (step.id === "l3-distance") return { kind: "tune-slider", variant: "number", value: 20 };
      return { kind: "tune-slider", variant: "number", value: num("l4.mask_for_15pct_deg") };
    default:
      return null;
  }
}

function pickWrong(step: Step, nth: number): Submission | null {
  switch (step.kind) {
    case "choice":
    case "predict":
    case "fill-formula": {
      const right = typeof step.answer === "number" ? step.answer : 0;
      const wrong = [...step.options.keys()].filter((index) => index !== right);
      return { kind: step.kind, selected: wrong[nth % wrong.length] ?? 0 };
    }
    case "spot-bug": {
      const wrong = [...step.lines.keys()].filter((index) => index !== step.buggyLine);
      return { kind: "spot-bug", selected: wrong[nth % wrong.length] ?? 0 };
    }
    case "tune-slider":
      return { kind: "tune-slider", variant: "number", value: nth };
    default:
      return null;
  }
}

function play(lesson: Lesson, examples: WorkedExamples, choose: (step: Step, state: RunnerState) => Submission[]): RunnerState {
  const evaluator = createValueEvaluator();
  let state = initialRunnerState();
  for (let guard = 0; guard < 40 && state.phase !== "complete"; guard += 1) {
    const step = lesson.steps[state.stepIndex];
    if (!step) break;
    if (PANEL_STEP_KINDS.includes(step.kind)) {
      expect(primaryAction(step, state, null, false)).toEqual({ kind: "skip", label: "Continue" });
      state = reduceRunner(state, { type: "skip" }, lesson, evaluator, examples);
      continue;
    }
    for (const submission of choose(step, state)) {
      if (state.phase !== "prompt" && state.phase !== "hint") break;
      state = reduceRunner(state, { type: "submit", submission }, lesson, evaluator, examples);
    }
    state = reduceRunner(state, { type: "continue" }, lesson, evaluator, examples);
  }
  return state;
}

describe("playing lessons 1 to 4 on the real data", () => {
  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))("%s: right first time everywhere earns 3 stars and the patch", (_, lesson) => {
    const done = play(lesson, real, (step) => [pickRight(step)].filter((item): item is Submission => item !== null));
    const scored = lesson.steps.filter((step) => !PANEL_STEP_KINDS.includes(step.kind)).length;
    expect(done.phase).toBe("complete");
    expect(done.results.filter((result) => result === "first")).toHaveLength(scored);
    expect(done.xp).toBe(10 * scored);
    expect(done.stars).toBe(3);
    expect(done.patchEarned).toBe(true);
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))("%s: a skipped panel step earns no XP and is not counted for the stars", (_, lesson) => {
    const done = play(lesson, real, (step) => [pickRight(step)].filter((item): item is Submission => item !== null));
    const skipped = done.results.filter((result) => result === "skipped").length;
    expect(skipped).toBe(lesson.steps.filter((step) => PANEL_STEP_KINDS.includes(step.kind)).length);
    expect(done.xp).toBe(10 * (lesson.steps.length - skipped));
  });

  it.each(lessons.map((lesson) => [lesson.id, lesson] as const))("%s: a miss gets a hint, a second miss shows the answer, never a scolding", (_, lesson) => {
    const evaluator = createValueEvaluator();
    for (const [index, step] of lesson.steps.entries()) {
      if (PANEL_STEP_KINDS.includes(step.kind)) continue;
      const at: RunnerState = { ...initialRunnerState(), stepIndex: index };
      const first = pickWrong(step, 0);
      if (!first) continue;
      const missed = reduceRunner(at, { type: "submit", submission: first }, lesson, evaluator, real);
      if (step.kind === "predict") {
        expect(missed.phase, step.id).toBe("revealed");
      } else {
        expect(missed.phase, step.id).toBe("hint");
        expect(missed.feedback).toBe(`Not quite. ${step.hint}`);
        const second = pickWrong(step, 1);
        if (!second) continue;
        const shown = reduceRunner(missed, { type: "submit", submission: second }, lesson, evaluator, real);
        expect(shown.phase, step.id).toBe("revealed");
        expect(shown.shownAnswer).toBe(answerText(step));
      }
      const said = conversationFor(step, { ...missed })
        .filter((entry) => entry.who === "luna" && !entry.key.endsWith("-ask"))
        .map((entry) => fillPlaceholders(entry.text, real).text)
        .join(" ");
      expect(said).not.toMatch(/wrong|mistake|bad|!/i);
    }
  });

  it("a panel step says what the learner will do and shows the real answer, not the question it cannot ask", () => {
    const step = lesson1.steps[1];
    if (step?.kind !== "drag-body") throw new Error("lesson 1 step 2 drags the Sun");
    const first = conversationFor(step, initialRunnerState())[0];
    expect(first?.text).toBe(step.preview?.says);
    expect(fillPlaceholders(step.preview?.reveal ?? "", real).text).toBe(
      "This month the Sun climbs only to 0.63°, and sinks to −0.25°. It skims my horizon.",
    );
  });
});

/**
 * A slider position the lesson accepts must be one whose own readout answers the question,
 * and every position whose readout answers it must be accepted.
 */
describe("slider goals agree with their own readouts", () => {
  const evaluator = createValueEvaluator();

  function stops(step: Extract<Step, { kind: "tune-slider" }>): number[] {
    if (step.slider.kind !== "number") throw new Error(`${step.id} is not a number slider`);
    const { min, max, step: stride } = step.slider;
    const count = Math.round((max - min) / stride);
    return Array.from({ length: count + 1 }, (_, index) => min + index * stride);
  }

  function accepted(lesson: Lesson, step: Extract<Step, { kind: "tune-slider" }>, value: number): boolean {
    const index = lesson.steps.indexOf(step);
    const at: RunnerState = { ...initialRunnerState(), stepIndex: index };
    const next = reduceRunner(at, { type: "submit", submission: { kind: "tune-slider", variant: "number", value } }, lesson, evaluator, real);
    return next.phase === "correct";
  }

  function readoutText(step: Extract<Step, { kind: "tune-slider" }>, value: number): string {
    if (step.slider.kind !== "number" || !step.slider.readout) throw new Error(`${step.id} has no readout`);
    const reading = numberReadoutAt(step.slider.readout, value, real);
    if (typeof reading !== "number") throw new Error(`${step.id} has no reading at ${value}`);
    return formatNumber(reading, 0);
  }

  it("lesson 3: only the distance whose drop reads the asked-for metres is right; 19 and 21 km are misses", () => {
    const step = lesson3.steps[2];
    if (step?.kind !== "tune-slider") throw new Error("lesson 3 step 3 is the slider");
    const asked = exampleText(real, "l3.drop_at_20km_m");
    expect(asked).toBe("115");
    for (const value of stops(step)) {
      expect(accepted(lesson3, step, value), `${value} km reads ${readoutText(step, value)} m`).toBe(readoutText(step, value) === asked);
    }
    expect(accepted(lesson3, step, 19)).toBe(false);
    expect(accepted(lesson3, step, 21)).toBe(false);
  });

  it("lesson 4: a margin is right exactly when its link-time readout is under 15%", () => {
    const step = lesson4.steps[3];
    if (step?.kind !== "tune-slider" || step.slider.kind !== "number" || !step.slider.readout) throw new Error("lesson 4 step 4 is the slider");
    for (const value of stops(step)) {
      const reading = numberReadoutAt(step.slider.readout, value, real);
      expect(typeof reading).toBe("number");
      expect(accepted(lesson4, step, value), `${value}° reads ${String(reading)}%`).toBe((reading as number) < 15);
    }
  });

  it("every slider in lessons 1 to 4 is covered above", () => {
    const sliders = lessons.flatMap((lesson) => lesson.steps.filter((step) => step.kind === "tune-slider").map((step) => step.id));
    expect(sliders).toEqual(["l3-distance", "l4-margin"]);
  });
});

/** Every string a learner can see in a lesson, with where it comes from. */
function visibleStrings(lesson: Lesson): { where: string; text: string }[] {
  const out: { where: string; text: string }[] = [
    { where: "title", text: lesson.title },
    { where: "tagline", text: lesson.tagline },
    { where: "recap", text: lesson.recap },
    { where: "patch", text: lesson.patch.name },
  ];
  const steps: readonly Step[] = lesson.steps;
  for (const step of steps) {
    const at = (field: string) => `${step.id}.${field}`;
    out.push({ where: at("luna"), text: step.luna.says }, { where: at("hint"), text: step.hint }, { where: at("explain"), text: step.explain });
    if (step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula") {
      step.options.forEach((option, index) => out.push({ where: at(`option ${index + 1}`), text: option }));
    }
    if (step.kind === "fill-formula") out.push({ where: at("tex"), text: step.tex });
    if (step.kind === "predict") {
      out.push({ where: at("reveal"), text: step.reveal.kind === "text" ? step.reveal.text : step.reveal.caption });
    }
    if (step.kind === "spot-bug") {
      step.lines.forEach((line, index) => out.push({ where: at(`line ${index + 1}`), text: line }));
      if (step.title) out.push({ where: at("title"), text: step.title });
    }
    if (step.kind === "drag-body" || step.kind === "tune-slider" || step.kind === "drop-pin") {
      if (step.answerLabel) out.push({ where: at("answer label"), text: step.answerLabel });
    }
    if (step.kind === "drag-body") (step.readout ?? []).forEach((line) => out.push({ where: at("readout"), text: line }));
    if (step.kind === "drag-body" || step.kind === "draw-skyline" || step.kind === "drop-pin") {
      if (step.preview) out.push({ where: at("preview"), text: step.preview.says }, { where: at("preview reveal"), text: step.preview.reveal });
    }
    if (step.kind === "tune-slider") {
      if (step.slider.label) out.push({ where: at("slider label"), text: step.slider.label });
      if (step.slider.kind === "number") {
        out.push({ where: at("slider unit"), text: step.slider.unit });
        if (step.slider.readout) out.push({ where: at("readout label"), text: step.slider.readout.label });
      }
    }
  }
  return out;
}

/** Lower case, placeholders in the doc's form, bold marks and spacing removed. */
function loose(text: string): string {
  return canon(text).replaceAll("**", "").toLowerCase();
}

/** The options a doc row lists before its first sentence break: "A / **B** / C". */
function docOptions(row: DocRow): string[] {
  const head = row.happens.split(/\.\s/)[0] ?? "";
  return head.split(" / ").map((option) => canon(option.replaceAll("**", "")));
}

/** The numbered lines of a spot-bug row: "Lines: (1) a; (2) b; **(3) c**; (4) d. …". */
function docLines(row: DocRow): string[] {
  const text = row.happens.replaceAll("**", "");
  return [...text.matchAll(/\((\d)\)\s*(.+?)(?=;|\.\s+[A-Z]|\.?$)/g)].map((match) => canon(match[2] ?? ""));
}

describe("every learner-visible string of lessons 1 to 4 is in the doc", () => {
  it.each(lessons.map((lesson, index) => [index + 1, lesson] as const))("lesson %s", (number, lesson) => {
    const text = loose(section(number));
    // Short strings must sit in their own slot of the doc, or a key name could match them.
    const slot = (where: string, value: string): string => {
      if (where === "title") return `## ${number}. ${value}`;
      if (where === "tagline" || where === "recap") return `**idea:** ${value}`;
      if (where === "patch") return `**patch:** ${value}.`;
      if (where.endsWith("slider label") || where.endsWith("readout label")) return `"${value}"`;
      if (where.endsWith("slider unit")) return `in ${value}`;
      if (where.endsWith("answer label") && sliders.has(where.split(".")[0] ?? "")) return `goal: ${value}`;
      return value;
    };
    const sliders = new Set(lesson.steps.filter((step) => step.kind === "tune-slider").map((step) => step.id));
    const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    for (const item of visibleStrings(lesson)) {
      const want = loose(slot(item.where, item.text));
      const found = new RegExp(`(^|[^\\p{L}\\p{N}])${escape(want)}($|[^\\p{L}\\p{N}])`, "u").test(text);
      expect(found, `${lesson.id} ${item.where}: "${item.text}" is not in lessons.md as ${want}`).toBe(true);
    }
  });

  it.each(lessons.map((lesson, index) => [index + 1, lesson] as const))("lesson %s lists exactly the doc's options and lines, in order", (number, lesson) => {
    const rows = sectionRows(number);
    const steps: readonly Step[] = lesson.steps;
    steps.forEach((step, index) => {
      const row = rows[index];
      if (!row) throw new Error(`lesson ${number} has no doc row ${index + 1}`);
      if (step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula") {
        expect(step.options.map(canon), step.id).toEqual(docOptions(row));
      }
      if (step.kind === "spot-bug") expect(step.lines.map(canon), step.id).toEqual(docLines(row));
    });
  });

  it("no step has two identical options or lines, and every marked answer is in range", () => {
    for (const lesson of lessons) {
      const steps: readonly Step[] = lesson.steps;
      for (const step of steps) {
        const list =
          step.kind === "choice" || step.kind === "predict" || step.kind === "fill-formula"
            ? step.options
            : step.kind === "spot-bug"
              ? step.lines
              : null;
        if (!list) continue;
        expect(new Set(list.map(loose)).size, `${step.id} repeats an option`).toBe(list.length);
        expect(list.length).toBeGreaterThanOrEqual(2);
        const answer = step.kind === "spot-bug" ? step.buggyLine : "answer" in step ? step.answer : null;
        expect(typeof answer, step.id).toBe("number");
        expect(Number.isInteger(answer) && (answer as number) >= 0 && (answer as number) < list.length, `${step.id} answer ${String(answer)}`).toBe(true);
      }
    }
  });
});
