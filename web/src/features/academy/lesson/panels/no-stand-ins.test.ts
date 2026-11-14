/**
 * Lessons 1 to 4 show no stand-in: every step's stage (answered, so each prediction's panel
 * reveal shows) and every lesson-complete screen is rendered on the real derived data, and no
 * text says a panel will come later, is not built, or shows a raw `{{example.…}}`. Every
 * worked-example key the lessons and their cards use has a value, in the real data and in the
 * fixture. A file that fails to load says so, honestly, instead of a stand-in.
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
import { optionViews } from "../../step-view";
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
    it(`${lesson.id}: every step's stage, answered`, async () => {
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
    return [...keys];
  };
  for (const lesson of lessons) {
    it(`${lesson.id}: in the real data and in the fixture`, () => {
      const keys = keysOf(lesson);
      expect(keys.length).toBeGreaterThan(0);
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
    expect(system).toMatch(/The System view could not load/);
    seed();
  });
});
