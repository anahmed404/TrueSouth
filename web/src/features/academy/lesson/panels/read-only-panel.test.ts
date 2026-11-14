/**
 * A lesson's reveal is a picture: the reused horizon chart is read-only there. Driven through
 * the real lesson screen (lesson 2, on the real data): no instructions for actions that do
 * nothing, no tab stop, the wheel over the picture is left to the page, and in review Enter
 * returns to the current step even with the picture hovered and focused. Mission Control's
 * own chart keeps its wheel zoom (its default is unchanged).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Features, Manifest, SiteMeta, Sites } from "../../../../contracts/generated";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../../../state/data";
import { HorizonChart } from "../../../panorama/chart";
import { chartFrame, chartScales } from "../../../panorama/geometry";
import { LessonScreen } from "../../lesson-screen";
import { lesson2 } from "../../lessons/l2";
import { byName, dispatch, findAll, installDocument, readAll, type FakeNode } from "../../testing/fake-dom";
import { realExamples, realSite } from "../../testing/real-site";

const repoRoot = fileURLToPath(new URL("../../../../../../", import.meta.url));
const json = <T,>(path: string) => JSON.parse(readFileSync(`${repoRoot}data/derived/${path}`, "utf8")) as T;

let root: Root;
let container: FakeNode;

async function settle(run: () => void = () => undefined) {
  await act(async () => {
    run();
    await new Promise((resolve) => setTimeout(resolve, 5));
  });
}
const hasClass = (node: FakeNode, name: string) => (node.attributes["class"] ?? "").split(/\s+/).includes(name);
const byClass = (name: string) => findAll(container, (node) => hasClass(node, name));
const stepLine = () => readAll(byClass("ac-stepn")[0] as FakeNode).trim();
const click = (name: string) => {
  const found = byName(container, "button", name);
  if (!found) throw new Error(`no button "${name}"`);
  return settle(() => dispatch(found, "click"));
};
const chart = () => {
  const found = byClass("pano-chart")[0];
  if (!found) throw new Error("no chart");
  return found;
};

/** What a screen reader or the eye reads that tells the learner to operate the chart. */
const INSTRUCTIONS = /arrows move a cursor|Drag to turn|Enter marks|Click to mark|vertical stretch|Skyline at the pointer/i;

beforeAll(async () => {
  const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });
  const site = realSite("malapert_peak");
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
  const document = installDocument();
  container = document.createElement("div");
  const { createRoot } = await import("react-dom/client");
  root = createRoot(container as unknown as Element);
  await settle(() => root.render(createElement(MemoryRouter, null, createElement(LessonScreen, { lesson: lesson2, examples: realExamples }))));
});

afterAll(async () => {
  await act(async () => root.unmount());
  delete (globalThis as { document?: unknown }).document;
});

describe("the Lander's eye in a lesson's reveal is a picture", () => {
  it("shows the real horizon, with no instructions, no tab stop, and a text alternative", async () => {
    await settle(() => dispatch(findAll(container, (node) => node.attributes["data-ac-option"] !== undefined)[1] as FakeNode, "click"));
    await click("Show me");
    const picture = chart();
    expect(picture.attributes["role"]).toBe("img");
    expect(picture.attributes["tabindex"]).toBeUndefined();
    expect(picture.attributes["aria-label"]).toMatch(/^Lander's eye at Malapert Massif peak, 2028-01-04 17:00 UTC\. Sun 0\.54° up, behind the ridge/);
    expect(readAll(byClass("ac-mcbox")[0] as FakeNode)).not.toMatch(INSTRUCTIONS);
    // Hovering or pressing on it opens no readout.
    await settle(() => dispatch(picture, "pointermove", { pointerType: "mouse", clientX: 120, clientY: 40 }));
    await settle(() => dispatch(picture, "pointerdown", { pointerId: 2 }));
    await settle(() => dispatch(picture, "pointerup", { pointerId: 2 }));
    expect(byClass("pano-readout")).toHaveLength(0);
  });

  it("leaves the wheel to the page", async () => {
    const wheel = dispatch(chart(), "wheel", { deltaY: 120, clientY: 40 });
    expect(wheel.defaultPrevented).toBe(false);
  });

  it("in review, Enter goes back to the current step with the picture hovered and focused", async () => {
    await click("Continue");
    expect(stepLine()).toBe("Step 2 of 5");
    await click("Step 1 of 5, completed. Review");
    expect(stepLine()).toBe("Reviewing step 1 of 5");
    const picture = chart();
    await settle(() => dispatch(picture, "pointermove", { pointerType: "mouse", clientX: 120, clientY: 40 }));
    picture.focus();
    for (const key of ["ArrowLeft", "ArrowUp", " "]) await settle(() => dispatch(picture, "keydown", { key }));
    expect(stepLine()).toBe("Reviewing step 1 of 5");
    await settle(() => dispatch(picture, "keydown", { key: "Enter" }));
    expect(stepLine()).toBe("Step 2 of 5");
  });
});

describe("Mission Control's chart keeps its own behaviour", () => {
  it("still zooms on the wheel and still describes its keys when interactive is not set", async () => {
    const site = realSite("malapert_peak");
    const scales = chartScales(chartFrame(358), 90, { lo: -2, hi: 3 });
    const noop = () => undefined;
    await settle(() =>
      root.render(
        createElement(HorizonChart, {
          scales,
          skyline: site.skyline,
          series: site.series,
          window: null,
          hour: null,
          landingHour: null,
          radii: null,
          maskDeg: null,
          features: [],
          marker: null,
          onMark: noop,
          onCentreChange: noop,
          onZoom: noop,
          onResetZoom: noop,
          utcOfHour: () => null,
          showLabels: false,
          label: "Horizon chart",
        }),
      ),
    );
    const live = chart();
    expect(live.attributes["role"]).toBe("application");
    expect(live.attributes["tabindex"]).toBe("0");
    expect(readAll(container)).toMatch(/arrows move a cursor along the skyline/);
    expect(dispatch(live, "wheel", { deltaY: 120, clientY: 40 }).defaultPrevented).toBe(true);
  });
});
