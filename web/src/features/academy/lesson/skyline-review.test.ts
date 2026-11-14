/**
 * The sketch stage's handlers, driven through its real pointer and key handlers in a fake DOM:
 * - in review (an answered step) nothing the learner does sends a draft or changes the line;
 * - a sketch of one point is kept as a draft, and is drawn again when the stage remounts
 *   (as it does when the learner opens a past step and comes back), with Done still off.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import type { Features, Manifest, SiteMeta, Sites } from "../../../contracts/generated";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../../state/data";
import { lesson2 } from "../lessons/l2";
import { initialRunnerState, type RunnerState } from "../runner";
import { canCheck, type Draft } from "../step-view";
import { dispatch, findAll, installDocument, type FakeNode } from "../testing/fake-dom";
import { realExamples, realSite } from "../testing/real-site";
import type { Step } from "../types";
import { SkylineStage } from "./skyline-stage";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const json = <T,>(path: string) => JSON.parse(readFileSync(`${repoRoot}data/derived/${path}`, "utf8")) as T;
const found = (lesson2.steps as readonly Step[]).find((item) => item.id === "l2-sketch");
if (found?.kind !== "draw-skyline") throw new Error("lesson 2 step 3 sketches");
const step: Extract<Step, { kind: "draw-skyline" }> = found;
const stepIndex = (lesson2.steps as readonly Step[]).indexOf(step);

let root: Root | null = null;
let container: FakeNode;

beforeAll(() => {
  const site = realSite("malapert_peak");
  const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });
  dataStore.setState({
    entries: {
      manifest: ready(json<Manifest>("manifest.json")),
      sites: ready(json<Sites>("sites.json")),
      features: ready(json<Features>("features.json")),
      [metaKey("malapert_peak")]: ready(json<SiteMeta>("sites/malapert_peak/meta.json")),
      [seriesKey("malapert_peak")]: ready(site.series),
      [skylineKey("malapert_peak")]: ready(site.skyline),
    },
  });
});

afterEach(async () => {
  if (root) {
    const mounted = root;
    root = null;
    await act(async () => mounted.unmount());
  }
});

async function mount(runner: RunnerState, draft: Draft, onDraft: (draft: Draft) => void) {
  const document = installDocument();
  container = document.createElement("div");
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container as unknown as Element);
  await act(async () => {
    root?.render(
      createElement(
        MemoryRouter,
        null,
        createElement(SkylineStage, { step, runner, draft, examples: realExamples, onDraft, onStatus: () => undefined }),
      ),
    );
  });
}

const byClass = (name: string) => findAll(container, (node) => (node.attributes["class"] ?? "").split(/\s+/).includes(name));
const line = () => byClass("ac-sketch-line")[0]?.attributes["d"] ?? null;
const fire = (node: FakeNode, type: string, init: Record<string, unknown> = {}) => act(async () => void dispatch(node, type, init));

describe("the sketch stage in review", () => {
  it("sends no draft and keeps the line, whatever the pointer and the keys do", async () => {
    const sketch = [
      { azDeg: 60.25, elDeg: 0.2 },
      { azDeg: 90.25, elDeg: 1.1 },
      { azDeg: 120.25, elDeg: -0.8 },
    ];
    const reviewed: RunnerState = {
      ...initialRunnerState(),
      stepIndex,
      phase: "correct",
      attempts: [{ kind: "draw-skyline", sketch, gapDeg: 0.6 }],
      stepXp: 9,
    };
    const sent: Draft[] = [];
    await mount(reviewed, { kind: "draw-skyline", sketch, gapDeg: 0.6 }, (draft) => sent.push(draft));
    const drawn = line();
    expect(drawn).not.toBeNull();
    // The real skyline is laid over it, and no keyboard points are offered.
    expect(byClass("ac-sketch-real")).toHaveLength(1);
    expect(byClass("ac-sketch-handle")).toHaveLength(0);
    const surface = byClass("ac-sketch-surface")[0];
    if (!surface) throw new Error("no drawing surface");
    await fire(surface, "pointerdown", { clientX: 100, clientY: 60 });
    await fire(surface, "pointermove", { clientX: 250, clientY: 150 });
    await fire(surface, "pointerup", { clientX: 250, clientY: 150 });
    await fire(surface, "pointerdown", { clientX: 120, clientY: 90 });
    await fire(surface, "pointercancel", {});
    await fire(surface, "lostpointercapture", {});
    for (const key of ["ArrowUp", "ArrowDown", "Enter", " "]) await fire(surface, "keydown", { key });
    expect(sent).toEqual([]);
    expect(line()).toBe(drawn);
    // No "Start again" in review: the answer has been shown, and the step is one attempt.
    expect(findAll(container, (node) => node.nodeName === "BUTTON")).toHaveLength(0);
  });
});

describe("a one-point sketch", () => {
  it("is kept as a draft, drawn again after a remount, and cannot be checked yet", async () => {
    const live: RunnerState = { ...initialRunnerState(), stepIndex };
    const sent: Draft[] = [];
    await mount(live, null, (draft) => sent.push(draft));
    const surface = byClass("ac-sketch-surface")[0];
    if (!surface) throw new Error("no drawing surface");
    await fire(surface, "pointerdown", { clientX: 150, clientY: 100 });
    await fire(surface, "pointerup", { clientX: 150, clientY: 100 });
    const draft = sent.at(-1) ?? null;
    if (draft?.kind !== "draw-skyline") throw new Error("the point was not kept");
    expect(draft.sketch).toHaveLength(1);
    expect(canCheck(step, live, draft)).toBe(false);

    // The learner opens a past step and comes back: the stage remounts with the draft.
    await act(async () => root?.unmount());
    root = null;
    await mount(live, draft, () => undefined);
    expect(line()).toMatch(/^M[\d.]+,[\d.]+$/);
  });
});
