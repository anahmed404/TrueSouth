/**
 * Every key press on the dragged body counts, even when presses come faster than the screen
 * redraws (a held arrow key, or a quick hand): five presses in one batch move five hours.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Features, Manifest, SiteMeta, Sites } from "../../../contracts/generated";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../../state/data";
import { lesson1 } from "../lessons/l1";
import { initialRunnerState } from "../runner";
import type { Draft } from "../step-view";
import { dispatch, findAll, installDocument, readAll } from "../testing/fake-dom";
import { realExamples, realSite } from "../testing/real-site";
import type { Step } from "../types";
import { DragBodyStage } from "./drag-body-stage";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const json = <T,>(path: string) => JSON.parse(readFileSync(`${repoRoot}data/derived/${path}`, "utf8")) as T;

describe("the dragged body's keys", () => {
  it("counts every press in a batch: five ArrowRight presses move five hours", async () => {
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
    const step = (lesson1.steps as readonly Step[]).find((item) => item.id === "l1-highest");
    if (step?.kind !== "drag-body") throw new Error("l1-highest");
    const document = installDocument();
    const container = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    const root = createRoot(container as unknown as Element);
    let draft: Draft = null;
    const render = () =>
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(DragBodyStage, {
            step,
            runner: initialRunnerState(),
            draft,
            examples: realExamples,
            onDraft: (next: Draft) => {
              draft = next;
            },
            onStatus: () => undefined,
          }),
        ),
      );
    await act(async () => render());
    const sun = findAll(container, (node) => node.attributes["role"] === "slider")[0];
    if (!sun) throw new Error("no Sun");
    const time = () => readAll(findAll(container, (node) => (node.attributes["class"] ?? "") === "ac-drag-read")[0]!).match(/\d{4}-\d{2}-\d{2} \d{2}:\d{2} UTC/)?.[0];

    await act(async () => void dispatch(sun, "keydown", { key: "Home" }));
    expect(time()).toBe("2028-01-01 00:00 UTC");
    // Five presses in one batch, with no redraw between them.
    await act(async () => {
      for (let i = 0; i < 5; i += 1) dispatch(sun, "keydown", { key: "ArrowRight" });
    });
    expect(time()).toBe("2028-01-01 05:00 UTC");
    await act(async () => {
      for (let i = 0; i < 2; i += 1) dispatch(sun, "keydown", { key: "ArrowRight", shiftKey: true });
    });
    expect(time()).toBe("2028-01-03 05:00 UTC");
    await act(async () => root.unmount());
    delete (globalThis as { document?: unknown }).document;
  });
});
