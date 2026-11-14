/**
 * Review mode, driven through the real lesson screen: its buttons, keys and stage handlers,
 * not a reconstructed runner. Lesson 1 is played on the real data; two finished steps (a
 * choice and the drag) are reviewed with every control the screen offers; then the lesson
 * is finished. The XP so far (read from the leave dialog), the saved progress, the stars and
 * the patch must be exactly what playing without any review gives. (There are no streaks in
 * the Academy.)
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Features, Manifest, SiteMeta, Sites } from "../../contracts/generated";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../state/data";
import { lesson1 } from "./lessons/l1";
import { LessonScreen } from "./lesson-screen";
import { useAcademyStore } from "./store";
import { byName, dispatch, findAll, installDocument, readAll, type FakeNode } from "./testing/fake-dom";
import { realExamples, realSite } from "./testing/real-site";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const json = <T,>(path: string) => JSON.parse(readFileSync(`${repoRoot}data/derived/${path}`, "utf8")) as T;

let root: Root;
let container: FakeNode;

/** Runs an interaction and lets React, its effects and the screen's frame callbacks settle. */
async function settle(run: () => void = () => undefined) {
  await act(async () => {
    run();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}

const hasClass = (node: FakeNode, name: string) => (node.attributes["class"] ?? "").split(/\s+/).includes(name);
const first = (name: string) => findAll(container, (node) => hasClass(node, name))[0] ?? null;
const text = (name: string) => {
  const node = first(name);
  return node ? readAll(node).trim() : "";
};
const button = (name: string) => {
  const found = byName(container, "button", name);
  if (!found) throw new Error(`no button "${name}" in: ${readAll(container).slice(0, 400)}`);
  return found;
};
const click = (name: string) => settle(() => dispatch(button(name), "click"));
const key = (target: FakeNode, k: string, extra: Record<string, unknown> = {}) => settle(() => dispatch(target, "keydown", { key: k, ...extra }));
/** The answer options on screen (choice, predict, formula tiles, spot-bug lines). */
const options = () => findAll(container, (node) => node.attributes["data-ac-option"] !== undefined);
const stepLine = () => text("ac-stepn");
const split = () => {
  const node = first("ac-split");
  if (!node) throw new Error("no step area");
  return node;
};

/** The lesson's XP so far, as the leave dialog says it; the dialog is closed again. */
async function xpSoFar(): Promise<number> {
  await click("Leave the lesson");
  const said = readAll(container).match(/lose this lesson's (\d+) XP/);
  await click("Keep going");
  if (!said) throw new Error("the leave dialog did not say the XP");
  return Number(said[1]);
}

const saved = () => {
  const state = useAcademyStore.getState();
  return { xp: state.xp, lessons: JSON.stringify(state.lessons), patches: JSON.stringify(state.patches) };
};

beforeAll(async () => {
  const site = realSite("connecting_ridge");
  const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });
  dataStore.setState({
    entries: {
      manifest: ready(json<Manifest>("manifest.json")),
      sites: ready(json<Sites>("sites.json")),
      features: ready(json<Features>("features.json")),
      [metaKey("connecting_ridge")]: ready(json<SiteMeta>("sites/connecting_ridge/meta.json")),
      [seriesKey("connecting_ridge")]: ready(site.series),
      [skylineKey("connecting_ridge")]: ready(site.skyline),
    },
  });
  const document = installDocument();
  container = document.createElement("div");
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container as unknown as Element);
  await settle(() => root.render(createElement(MemoryRouter, null, createElement(LessonScreen, { lesson: lesson1, examples: realExamples }))));
});

afterAll(async () => {
  await act(async () => root.unmount());
  delete (globalThis as { document?: unknown }).document;
});

describe("review mode through the lesson screen", () => {
  const before = saved();

  it("plays steps 1 and 2 right first time, and is on step 3 with an answer picked but not checked", async () => {
    expect(stepLine()).toBe("Step 1 of 5");
    await settle(() => dispatch(options()[2] as FakeNode, "click"));
    await click("Check");
    await click("Continue");
    expect(stepLine()).toBe("Step 2 of 5");
    const sun = findAll(container, (node) => node.attributes["role"] === "slider")[0];
    if (!sun) throw new Error("no draggable Sun");
    await key(sun, "Home");
    await click("Check");
    expect(readAll(container)).toContain("Correct");
    await click("Continue");
    expect(stepLine()).toBe("Step 3 of 5");
    // Half-answered: "All the way round" picked, not checked.
    await settle(() => dispatch(options()[1] as FakeNode, "click"));
    expect(options()[1]?.attributes["aria-checked"]).toBe("true");
    expect(await xpSoFar()).toBe(20);
  });

  it("the progress marks: steps 1 and 2 are review buttons; steps 3 to 5 are not", () => {
    const buttons = findAll(container, (node) => node.nodeName === "BUTTON" && /^Step \d of 5/.test(node.attributes["aria-label"] ?? ""));
    expect(buttons.map((node) => node.attributes["aria-label"])).toEqual(["Step 1 of 5, completed. Review", "Step 2 of 5, completed. Review"]);
  });

  it("a reviewed choice cannot be answered: options, number keys, Space, Backspace and Check do nothing", async () => {
    await click("Step 1 of 5, completed. Review");
    expect(stepLine()).toBe("Reviewing step 1 of 5");
    const shown = readAll(split());
    for (const option of options()) await settle(() => dispatch(option, "click"));
    for (const k of ["1", "2", "3", " ", "Backspace", "ArrowDown"]) await key(split(), k);
    for (const option of options()) await key(option, " ");
    await key(button("Back to step 3"), " ");
    // No Check is offered in review.
    expect(byName(container, "button", "Check")).toBeNull();
    expect(stepLine()).toBe("Reviewing step 1 of 5");
    expect(readAll(split())).toBe(shown);
  });

  it("the primary button, Enter and Esc each leave review; the picked answer on step 3 is still there", async () => {
    await click("Back to step 3");
    expect(stepLine()).toBe("Step 3 of 5");
    expect(options()[1]?.attributes["aria-checked"]).toBe("true");

    await click("Step 1 of 5, completed. Review");
    await key(split(), "Enter");
    expect(stepLine()).toBe("Step 3 of 5");

    await click("Step 1 of 5, completed. Review");
    await key(split(), "Escape");
    expect(stepLine()).toBe("Step 3 of 5");

    // The current step's mark goes back too.
    await click("Step 1 of 5, completed. Review");
    await click("Step 3 of 5, current step. Go back to it");
    expect(stepLine()).toBe("Step 3 of 5");
    expect(options()[1]?.attributes["aria-checked"]).toBe("true");
  });

  it("Esc leaves review from the Under the hood tab too, back on Luna's tab", async () => {
    await click("Step 1 of 5, completed. Review");
    await settle(() => dispatch(button("Under the hood"), "click"));
    expect(button("Under the hood").attributes["aria-selected"]).toBe("true");
    await key(split(), "Escape");
    expect(stepLine()).toBe("Step 3 of 5");
    expect(button("Luna").attributes["aria-selected"]).toBe("true");
  });

  it("a reviewed drag cannot be moved: keys, the body and the time bar do nothing", async () => {
    await click("Step 2 of 5, completed. Review");
    expect(stepLine()).toBe("Reviewing step 2 of 5");
    const shown = text("ac-drag-read");
    expect(shown).toContain("2028-01-01 00:00 UTC");
    const sun = findAll(container, (node) => node.attributes["role"] === "slider")[0];
    if (!sun) throw new Error("no Sun in review");
    for (const k of ["End", "ArrowLeft", "ArrowRight", "PageUp"]) await key(sun, k, { shiftKey: k === "ArrowRight" });
    await settle(() => dispatch(sun, "pointerdown", { pointerId: 3 }));
    await settle(() => dispatch(sun, "pointermove", { pointerId: 3, clientX: 300, clientY: 40 }));
    await settle(() => dispatch(sun, "pointerup", { pointerId: 3 }));
    const bar = first("ac-drag-bar");
    if (!bar) throw new Error("no time bar");
    await settle(() => dispatch(bar, "pointerdown", { pointerId: 4, clientX: 200 }));
    await settle(() => dispatch(bar, "pointermove", { pointerId: 4, clientX: 260 }));
    await settle(() => dispatch(bar, "pointercancel", { pointerId: 4 }));
    expect(text("ac-drag-read")).toBe(shown);
    expect(byName(container, "button", "Check")).toBeNull();
    await click("Back to step 3");
  });

  it("after all of that the XP is unchanged and nothing was saved", async () => {
    expect(await xpSoFar()).toBe(20);
    expect(saved()).toEqual(before);
  });

  it("finishing the lesson saves exactly what playing without reviews saves: 50 XP, 3 stars, the patch", async () => {
    await click("Show me");
    await click("Continue");
    expect(stepLine()).toBe("Step 4 of 5");
    await settle(() => dispatch(options()[0] as FakeNode, "click"));
    await click("Check");
    await click("Continue");
    await settle(() => dispatch(options()[2] as FakeNode, "click"));
    await click("Check");
    await click("Finish the lesson");
    const progress = useAcademyStore.getState();
    expect(progress.lessons[lesson1.id]).toEqual({ stars: 3, xp: 50, patch: true });
    expect(progress.xp).toBe(50);
  });
});
