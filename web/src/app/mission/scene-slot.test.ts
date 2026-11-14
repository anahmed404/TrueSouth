import { act, createElement, useEffect } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import type { CameraViewId, FlatLayer, FlatLayerProps, SceneProps, SceneStatus } from "../scene";
import { allNodes, installDocument, propsOf, type FakeNode } from "./fake-dom";
import { SceneSlot } from "./scene-slot";

/** A scene that reports a status once, as the 3D scene does after its first flight. */
function sceneReporting(status: SceneStatus) {
  return function Scene(props: SceneProps) {
    const { onStatus } = props;
    useEffect(() => onStatus(status), [onStatus]);
    return null;
  };
}

/** A flat layer that records the props it last got. */
function recordingLayer(views: CameraViewId[], seen: FlatLayerProps[]): FlatLayer {
  return {
    views,
    Layer: (props: FlatLayerProps) => {
      seen.push(props);
      return createElement("i", { "data-layer": views.join(",") });
    },
  };
}

const freeSpace = { x: 0, y: 0, width: 800, height: 600, viewport: { width: 1440, height: 900 }, windowOpen: false };

describe("the scene slot's flat layers", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => mounted.unmount());
    }
    delete (globalThis as { document?: unknown }).document;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  async function mount(view: CameraViewId, status: SceneStatus, flat: FlatLayer | readonly FlatLayer[]): Promise<FakeNode> {
    const document = installDocument();
    const host = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as Element);
    await act(async () => {
      root?.render(
        createElement(SceneSlot, {
          Scene: sceneReporting(status),
          flat,
          view,
          scenario: { profile: {} as SceneProps["scenario"]["profile"], siteIds: [], focusedSiteId: null, landingUtc: "2028-01-01T00:00:00Z", currentUtc: "2028-01-01T00:00:00Z" },
          freeSpace,
          reduceMotion: true,
          onFocusSite: () => undefined,
          onViewChange: () => undefined,
          onAddSite: () => undefined,
        }),
      );
    });
    return host;
  }

  const still = (host: FakeNode) => allNodes(host).some((n) => propsOf(n).className === "scene-still");

  it("with 3D off, the views of every layer show no still picture, and every layer gets the mode and try-again", async () => {
    const seen: FlatLayerProps[] = [];
    const layers = [recordingLayer(["map"], seen), recordingLayer(["slip"], seen)];
    for (const view of ["map", "slip"] as const) {
      seen.length = 0;
      const host = await mount(view, "slow", layers);
      expect(still(host)).toBe(false);
      // Both layers are mounted (each decides itself whether to draw for this view).
      expect(allNodes(host).filter((n) => propsOf(n)["data-layer"] !== undefined)).toHaveLength(2);
      const last = seen.slice(-2);
      for (const props of last) {
        expect(props.mode).toBe("flat");
        expect(props.view).toBe(view);
        expect(props.canTryAgain).toBe(true);
        expect(typeof props.onTryAgain).toBe("function");
      }
      await act(async () => root?.unmount());
      root = null;
    }
  });

  it("another view still gets the still picture; without WebGL, trying again cannot help", async () => {
    const seen: FlatLayerProps[] = [];
    const host = await mount("terrain", "no-webgl", [recordingLayer(["map"], seen), recordingLayer(["slip"], seen)]);
    expect(still(host)).toBe(true);
    expect(seen.at(-1)?.canTryAgain).toBe(false);
  });

  it("one layer on its own works as before", async () => {
    const seen: FlatLayerProps[] = [];
    const host = await mount("map", "no-webgl", recordingLayer(["map"], seen));
    expect(still(host)).toBe(false);
    expect(seen.at(-1)?.mode).toBe("flat");
  });
});
