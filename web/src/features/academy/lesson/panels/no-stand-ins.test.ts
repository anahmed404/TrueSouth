/**
 * Lessons 1 to 4 show no stand-in. On the real derived data: every prompt and conversation
 * line (question, hint, explanation, reveal) is filled; every step's stage is rendered before
 * an answer and answered (the answered stage is also what review mode draws); every
 * Under-the-hood card and every lesson-complete screen is rendered. None says a panel will
 * come later or is not built, or shows a raw `{{example.…}}`. Every worked-example key the
 * lessons and their cards need (placeholders, and bare keys such as a slider readout's list)
 * has a value, in the real data and in the fixture. A file that fails to load says which.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Features, Manifest, SiteMeta, Sites } from "../../../../contracts/generated";
import { decodeSystem } from "../../../../data/decode/index";
import { parseManifest } from "../../../../data/parse";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../../../state/data";
import { keysIn } from "../../card/prose";
import { CARDS } from "../../cards";
import { CompleteScreen } from "../../complete-screen";
import { lesson1 } from "../../lessons/l1";
import { lesson2 } from "../../lessons/l2";
import { lesson3 } from "../../lessons/l3";
import { lesson4 } from "../../lessons/l4";
import { hasExample, type WorkedExamples } from "../../placeholders";
import { initialRunnerState, type RunnerState } from "../../runner";
import { conversationFor, initialDraft, optionViews } from "../../step-view";
import { fillPlaceholders } from "../../placeholders";
import { missingExampleKeys } from "../../validate";
import { UnderTheHoodCard } from "../../card";
import { installDocument, readAll, type FakeNode } from "../../testing/fake-dom";
import { realExamples, realSite } from "../../testing/real-site";
import type { Lesson, Step } from "../../types";
import { Stage } from "../stage";
import { PanelView } from "./panel-view";

const repoRoot = fileURLToPath(new URL("../../../../../../", import.meta.url));
const read = (path: string) => readFileSync(`${repoRoot}data/${path}`);
const json = <T,>(path: string) => JSON.parse(read(path).toString("utf8")) as T;
const lessons: readonly Lesson[] = [lesson1, lesson2, lesson3, lesson4];

/** What a stand-in or a missing value looks like to the learner. */
const STAND_IN = /once the lesson|will play this|appears here once|comes later|once mission control|not built yet|\{\{example\./i;

let root: Root;
let container: FakeNode;
const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });

function seed(extra: Record<string, unknown> = {}) {
  const manifest = json<Manifest>("derived/manifest.json");
  const bytes = read("derived/system.bin");
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const entries: Record<string, unknown> = {
    manifest: ready(manifest),
    sites: ready(json<Sites>("derived/sites.json")),
    features: ready(json<Features>("derived/features.json")),
    system: ready(decodeSystem(copy, parseManifest(manifest).time_grid.count, "system.bin")),
  };
  for (const id of ["connecting_ridge", "malapert_peak"]) {
    const site = realSite(id);
    entries[metaKey(id)] = ready(json<SiteMeta>(`derived/sites/${id}/meta.json`));
    entries[seriesKey(id)] = ready(site.series);
    entries[skylineKey(id)] = ready(site.skyline);
  }
  dataStore.setState({ entries: { ...entries, ...extra } as never });
}

async function show(element: ReturnType<typeof createElement>): Promise<string> {
  await act(async () => {
    root.render(createElement(MemoryRouter, null, element));
    // Let a lazily loaded panel (the countdowns) arrive.
    await new Promise((resolve) => setTimeout(resolve, 400));
  });
  return readAll(container);
}

/** A step as the learner leaves it: answered, so a prediction's reveal is on screen. */
function answered(_step: Step, index: number): RunnerState {
  return { ...initialRunnerState(), stepIndex: index, phase: "correct", stepXp: 10 };
}

beforeAll(async () => {
  seed();
  const document = installDocument();
  container = document.createElement("div");
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container as unknown as Element);
});

afterAll(async () => {
  await act(async () => root.unmount());
  delete (globalThis as { document?: unknown }).document;
});

describe("no stand-in is reachable in lessons 1 to 4", () => {
  for (const lesson of lessons) {
    it(`${lesson.id}: every prompt and every conversation line, filled from the real data`, () => {
      const steps: readonly Step[] = lesson.steps;
      for (const [index, step] of steps.entries()) {
        // The question, a miss (hint), and the end (explanation or reveal), as the screen says them.
        const states: RunnerState[] = [
          { ...initialRunnerState(), stepIndex: index },
          { ...initialRunnerState(), stepIndex: index, phase: "hint", misses: 1, attempts: [{ kind: "choice", selected: 0 }] },
          { ...initialRunnerState(), stepIndex: index, phase: "revealed", misses: 2, attempts: [{ kind: "choice", selected: 0 }, { kind: "choice", selected: 1 }], shownAnswer: "x", stepXp: 2 },
        ];
        for (const state of states) {
          for (const entry of conversationFor(step, state)) {
            const filled = fillPlaceholders(entry.text, realExamples);
            expect(filled.missing, `${step.id}: ${entry.text}`).toEqual([]);
            expect(filled.text, step.id).not.toMatch(STAND_IN);
          }
        }
      }
      const texts: string[] = [];
      const walk = (value: unknown) => {
        if (typeof value === "string") texts.push(value);
        else if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") Object.values(value).forEach(walk);
      };
      walk(lesson);
      for (const text of texts) {
        const filled = fillPlaceholders(text, realExamples);
        expect(filled.missing, text).toEqual([]);
        expect(filled.text, text).not.toMatch(STAND_IN);
      }
    });

    it(`${lesson.id}: its Under-the-hood card`, async () => {
      const card = CARDS[lesson.card];
      if (!card) throw new Error(`${lesson.card} has no card`);
      // The card's maths measures its own width; the test DOM has no layout, so a stub observer.
      const host = globalThis as { ResizeObserver?: unknown };
      host.ResizeObserver = class {
        observe() {}
        unobserve() {}
        disconnect() {}
      };
      let text: string;
      try {
        text = await show(createElement(UnderTheHoodCard, { card, examples: realExamples, title: lesson.title }));
      } finally {
        delete host.ResizeObserver;
      }
      expect(text).not.toMatch(STAND_IN);
      expect(text).not.toMatch(/dashed box is a number/i);
    });

    it(`${lesson.id}: every step's stage, before an answer`, async () => {
      const steps: readonly Step[] = lesson.steps;
      for (const [index, step] of steps.entries()) {
        const runner: RunnerState = { ...initialRunnerState(), stepIndex: index };
        const text = await show(
          createElement(Stage, {
            step,
            runner,
            draft: initialDraft(step),
            views: optionViews(step, runner, null),
            examples: realExamples,
            celebrate: 0,
            onDraft: () => undefined,
            sceneFailed: false,
            onSceneStatus: () => undefined,
          }),
        );
        expect(text, `${step.id}: ${text.slice(0, 300)}`).not.toMatch(STAND_IN);
      }
    });

    it(`${lesson.id}: every step's stage, answered (which is also what review shows)`, async () => {
      const steps: readonly Step[] = lesson.steps;
      for (const [index, step] of steps.entries()) {
        const runner = answered(step, index);
        const text = await show(
          createElement(Stage, {
            step,
            runner,
            draft: null,
            views: optionViews(step, runner, null),
            examples: realExamples,
            celebrate: 0,
            onDraft: () => undefined,
            sceneFailed: false,
            onSceneStatus: () => undefined,
          }),
        );
        expect(text, `${step.id}: ${text.slice(0, 300)}`).not.toMatch(STAND_IN);
      }
    });

    it(`${lesson.id}: the lesson-complete screen shows the panels it unlocked`, async () => {
      const done: RunnerState = { ...initialRunnerState(), phase: "complete", stars: 3, xp: 50, patchEarned: true, results: ["first"] };
      let text = await show(createElement(CompleteScreen, { lesson, runner: done, examples: realExamples }));
      // The countdowns are loaded lazily: give the module time to arrive.
      for (let tries = 0; tries < 20 && text.includes("Loading"); tries += 1) {
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 250));
        });
        text = readAll(container);
      }
      expect(text).not.toMatch(STAND_IN);
      expect(text, text.slice(text.indexOf("Loading") - 80, text.indexOf("Loading") + 80)).not.toMatch(/Loading/);
    });
  }

  it("each prediction's panel shows the step's own site and moment", async () => {
    const l2 = (lesson2.steps as readonly Step[])[0] as Step;
    const text = await show(
      createElement(Stage, {
        step: l2,
        runner: answered(l2, 0),
        draft: null,
        views: optionViews(l2, answered(l2, 0), null),
        examples: realExamples,
        celebrate: 0,
        onDraft: () => undefined,
        sceneFailed: false,
        onSceneStatus: () => undefined,
      }),
    );
    expect(text).toContain("Malapert Massif peak · 2028-01-04 17:00 UTC");
    expect(text).toContain("Sun 0.54° up, behind the ridge");
  });
});

describe("every worked-example key the lessons and their cards use has a value", () => {
  const fixture = json<WorkedExamples>("fixtures/academy/worked_examples.json");
  const keysOf = (lesson: Lesson): string[] => {
    const keys = new Set<string>();
    const walk = (value: unknown) => {
      if (typeof value === "string") for (const key of keysIn(value)) keys.add(key);
      else if (Array.isArray(value)) value.forEach(walk);
      else if (value && typeof value === "object") Object.values(value).forEach(walk);
    };
    walk(lesson);
    walk(CARDS[lesson.card]);
    // A bare key that is not written as a placeholder, such as a slider readout's list
    // (l4.link_pct_by_mask), is in the validator's own list of what a lesson needs.
    for (const key of missingExampleKeys(lesson, {})) keys.add(key);
    return [...keys];
  };
  for (const lesson of lessons) {
    it(`${lesson.id}: in the real data and in the fixture`, () => {
      const keys = keysOf(lesson);
      expect(keys.length).toBeGreaterThan(0);
      if (lesson.id === "l4_link") expect(keys).toContain("l4.link_pct_by_mask");
      expect(keys.filter((key) => !hasExample(realExamples, key))).toEqual([]);
      expect(keys.filter((key) => !hasExample(fixture, key))).toEqual([]);
    });
  }
});

describe("a file that fails to load", () => {
  it("says which picture is missing and why, never a stand-in", async () => {
    seed({ [seriesKey("malapert_peak")]: { status: "error", data: null, error: "series.bin: 404" } });
    const l2 = (lesson2.steps as readonly Step[])[0] as Step;
    if (l2.kind !== "predict" || l2.reveal.kind !== "panel") throw new Error("lesson 2 step 1 reveals a panel");
    const text = await show(createElement(PanelView, { panel: l2.reveal.panel, scene: l2.reveal.scene, when: l2.reveal.when, examples: realExamples, caption: "The caption." }));
    // (The test DOM joins adjacent text pieces with a space: "peak 's".)
    expect(text).toMatch(/The Lander's eye could not load Malapert Massif peak ?'s stored data, so this picture is missing/);
    expect(text).toContain("The caption.");
    expect(text).not.toMatch(STAND_IN);

    seed({ system: { status: "error", data: null, error: "system.bin: 404" } });
    const l1 = (lesson1.steps as readonly Step[])[2] as Step;
    if (l1.kind !== "predict" || l1.reveal.kind !== "panel") throw new Error("lesson 1 step 3 reveals a panel");
    const system = await show(createElement(PanelView, { panel: l1.reveal.panel, scene: l1.reveal.scene, when: l1.reveal.when, examples: realExamples }));
    expect(system).toMatch(/The System view could not load the positions of the Sun and Earth around the Moon, so this picture is missing/);
    seed();
  });
});
