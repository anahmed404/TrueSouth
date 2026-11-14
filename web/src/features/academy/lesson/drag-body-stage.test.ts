/**
 * Dragging the body moves only the discs: the chart's skyline, paths and axes are one
 * memoised layer, and the drag-body stage must hand it the same props while the hour
 * changes (docs/features/panorama.md, "The view stays smooth while the scrubber plays").
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Features, Manifest, SiteMeta, Sites } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries, decodeSkyline } from "../../../data/decode/index";
import { hourIndexToUtc } from "../../../lib/time";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../../state/data";
import { initialRunnerState } from "../runner";
import type { Step } from "../types";
import { pipProfile } from "../lessons/story";

/** Counts the static layer's renders (one elevationTicks call each) and the discs placed. */
const calls = vi.hoisted(() => ({ staticRenders: 0, discs: 0 }));
vi.mock("../../panorama/geometry", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../panorama/geometry")>();
  return {
    ...actual,
    elevationTicks: (...args: Parameters<typeof actual.elevationTicks>) => {
      calls.staticRenders += 1;
      return actual.elevationTicks(...args);
    },
    discShape: (...args: Parameters<typeof actual.discShape>) => {
      calls.discs += 1;
      return actual.discShape(...args);
    },
  };
});

const { DragBodyStage } = await import("./drag-body-stage");
const { installDocument } = await import("../testing/fake-dom");

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const dir = path.join(repoRoot, "data", "fixtures");
const json = <T,>(file: string) => JSON.parse(readFileSync(path.join(dir, file), "utf8")) as T;
const bytes = (file: string) => {
  const buffer = readFileSync(path.join(dir, file));
  const copy = new ArrayBuffer(buffer.byteLength);
  new Uint8Array(copy).set(buffer);
  return copy;
};

describe("the drag-body stage while the body is dragged", () => {
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

  it.each(["flat", "terrain"] as const)("with a %s skyline, moves the discs and never redraws the static layer", async (skylineKind) => {
    const manifest = json<Manifest>("manifest.json");
    const grid = manifest.time_grid;
    const meta = json<SiteMeta>("sites/fixture_ridge/meta.json");
    const series = decodeSeries(bytes("sites/fixture_ridge/series.bin"), SERIES_COLUMNS, grid.count, "series.bin");
    const skyline = decodeSkyline(bytes("sites/fixture_ridge/skyline.bin"), manifest.skyline_bins, "skyline.bin");
    const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });
    dataStore.setState({
      entries: {
        manifest: ready(manifest),
        sites: ready(json<Sites>("sites.json")),
        features: ready(json<Features>("features.json")),
        [metaKey("fixture_ridge")]: ready(meta),
        [seriesKey("fixture_ridge")]: ready(series),
        [skylineKey("fixture_ridge")]: ready(skyline),
      },
    });
    const from = 4700;
    const to = 4940;
    const step: Extract<Step, { kind: "drag-body" }> = {
      id: "test-drag",
      luna: { mood: "thinking", says: "Drag the Sun." },
      hint: "Hint.",
      explain: "Explain.",
      kind: "drag-body",
      body: "sun",
      panel: "LandersEye",
      scene: {
        scenario: {
          profile: pipProfile,
          siteIds: ["fixture_ridge"],
          focusedSiteId: "fixture_ridge",
          landingUtc: hourIndexToUtc(grid, from),
          currentUtc: hourIndexToUtc(grid, from),
        },
        skyline: skylineKind,
        timeRange: { kind: "utc", fromUtc: hourIndexToUtc(grid, from), toUtc: hourIndexToUtc(grid, to) },
      },
      goal: { metric: "sun_el_deg", op: ">", value: 90 },
      follow: { power: "sun-fraction" },
    };
    // Pip's power follows the hour on screen live, through its own channel.
    const powers: (number | null)[] = [];
    const onLivePower = (power: number | null) => {
      powers.push(power);
    };
    const runner = initialRunnerState();
    const onDraft = () => undefined;
    const onStatus = () => undefined;
    const view = (hour: number) =>
      createElement(MemoryRouter, null, stage(hour));
    const stage = (hour: number) =>
      createElement(DragBodyStage, {
        step,
        runner,
        examples: {},
        onDraft,
        onStatus,
        onLivePower,
        draft: { kind: "drag-body", hour, utc: hourIndexToUtc(grid, hour), value: 0, sunFrac: null },
      });

    const document = installDocument();
    // The stage ends a drag when the window loses focus; the fake window takes the listeners.
    Object.assign(globalThis, { addEventListener() {}, removeEventListener() {} });
    const { createRoot } = await import("react-dom/client");
    root = createRoot(document.createElement("div") as unknown as Element);
    await act(async () => root?.render(view(from + 10)));
    const mounted = { ...calls };
    expect(mounted.discs).toBeGreaterThan(0);

    for (let hour = from + 11; hour <= from + 58; hour += 1) {
      await act(async () => root?.render(view(hour)));
    }
    expect(calls.staticRenders).toBe(mounted.staticRenders);
    // Pip's power was reported at every hour, as the stored disc fraction there in percent.
    expect(powers.at(-1)).toBeCloseTo((series.sun_frac[from + 58] ?? Number.NaN) * 100, 6);
    expect(powers.length).toBeGreaterThanOrEqual(49);
    // The disc was placed again at each of the 48 hours.
    expect(calls.discs).toBeGreaterThanOrEqual(mounted.discs + 48);
  });
});
