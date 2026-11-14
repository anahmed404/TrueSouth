/**
 * A level-ground scene (lessons 1 and 4) draws the horizon as a level line at 0°, so nothing
 * that depends on the real terrain may show: no disc fraction, no "in view" or "behind" words,
 * no blocker, and the line is called "Level ground, 0°", never "skyline". The stored disc
 * fraction is measured against the real terrain, so beside a level line it would contradict
 * the picture (2028-01-18 00:00 UTC: the Sun 0.34° up, the whole disc drawn above the line,
 * a stored disc fraction of 0).
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { MemoryRouter } from "react-router";
import { describe, expect, it } from "vitest";
import type { Features, Manifest, SiteMeta, Sites } from "../../../contracts/generated";
import { hourIndexToUtc } from "../../../lib/time";
import { dataStore, metaKey, seriesKey, skylineKey } from "../../../state/data";
import { LEVEL_NAME, Readout } from "../../panorama/chart";
import { chartFrame, chartScales } from "../../panorama/geometry";
import { metricAt } from "../drag-body";
import { lesson1 } from "../lessons/l1";
import { lesson4 } from "../lessons/l4";
import { initialRunnerState } from "../runner";
import { realExamples, realGrid, realSite } from "../testing/real-site";
import type { Step } from "../types";
import { hourOnGrid } from "../utc";
import { formatUtc } from "../../../components/format";
import { installDocument, readAll } from "../testing/fake-dom";
import { DragBodyStage } from "./drag-body-stage";

const repoRoot = fileURLToPath(new URL("../../../../../", import.meta.url));
const json = <T,>(path: string) => JSON.parse(readFileSync(`${repoRoot}data/derived/${path}`, "utf8")) as T;
const site = realSite("connecting_ridge");
const hour = (utc: string) => hourOnGrid(realGrid, utc) ?? -1;
const scales = chartScales(chartFrame(358), 0, { lo: -3, hi: 3 });

/** Visible text and every aria text in a piece of markup. */
function words(markup: string): string {
  const aria = [...markup.matchAll(/aria-(?:label|valuetext)="([^"]*)"/g)].map((match) => match[1]);
  const text = markup.replace(/<[^>]+>/g, " ");
  return `${text} ${aria.join(" ")}`.replace(/&#x27;/g, "'").replace(/\s+/g, " ");
}

const TERRAIN_WORDS = /disc fraction|skyline|in view|behind|blocker/i;

function readout(cursor: Parameters<typeof Readout>[0]["cursor"], ground?: "level" | "skyline"): string {
  return words(
    renderToStaticMarkup(
      createElement(Readout, {
        cursor,
        scales,
        skyline: site.skyline,
        series: site.series,
        features: [],
        landingHour: hour("2028-01-01T00:00:00Z"),
        utcOfHour: (h: number) => hourIndexToUtc(realGrid, h),
        marked: false,
        ...(ground ? { ground } : {}),
      }),
    ),
  );
}

describe("the chart's readout over level ground", () => {
  const h = hour("2028-01-18T00:00:00Z");

  it("the reviewer's hour: the Sun is up, and the stored disc fraction (against the terrain) is 0", () => {
    expect(metricAt(site.series, "sun_el_deg", h)).toBeCloseTo(0.34, 2);
    expect(metricAt(site.series, "sun_frac", h)).toBe(0);
  });

  it("a day dot reads the hour, azimuth and elevation only", () => {
    const tick = { kind: "tick" as const, tick: { body: "sun" as const, hour: h, x: 100, y: 50 }, px: 100, py: 50 };
    const level = readout(tick, "level");
    expect(level).not.toMatch(TERRAIN_WORDS);
    expect(level).toContain("2028-01-18 00:00 UTC");
    expect(level).toMatch(/Azimuth/);
    expect(level).toContain("0.34°");
    // Mission Control's readout is unchanged: no ground, or the skyline, still shows the disc fraction.
    expect(readout(tick)).toMatch(/Disc fraction/);
    expect(readout(tick, "skyline")).toBe(readout(tick));
  });

  it("the line itself is named level ground, with no skyline elevation or blocker", () => {
    const sky = { kind: "sky" as const, azDeg: 120, px: 100, py: 50, keyboard: true };
    const level = readout(sky, "level");
    expect(level).toContain(LEVEL_NAME);
    expect(level).not.toMatch(TERRAIN_WORDS);
    expect(readout(sky)).toMatch(/Skyline/);
  });
});

describe("the whole drag step over level ground says nothing about terrain", () => {
  const manifest = json<Manifest>("manifest.json");
  const ready = (data: unknown) => ({ status: "ready" as const, data, error: null });
  dataStore.setState({
    entries: {
      manifest: ready(manifest),
      sites: ready(json<Sites>("sites.json")),
      features: ready(json<Features>("features.json")),
      [metaKey("connecting_ridge")]: ready(json<SiteMeta>("sites/connecting_ridge/meta.json")),
      [seriesKey("connecting_ridge")]: ready(site.series),
      [skylineKey("connecting_ridge")]: ready(site.skyline),
    },
  });

  const cases = [
    [lesson1, "l1-highest"],
    [lesson4, "l4-highest"],
  ] as const;
  const hours = ["2028-01-18T00:00:00Z", "2028-01-01T00:00:00Z", "2028-01-06T12:00:00Z", "2028-01-25T22:00:00Z"];

  it.each(cases)("%s at the reviewer's hour and three others", async (lesson, id) => {
    const step = (lesson.steps as readonly Step[]).find((item) => item.id === id);
    if (step?.kind !== "drag-body") throw new Error(id);
    const document = installDocument();
    Object.assign(globalThis, { addEventListener() {}, removeEventListener() {} });
    const { createRoot } = await import("react-dom/client");
    const container = document.createElement("div");
    const root = createRoot(container as unknown as Element);
    const runner = initialRunnerState();
    const noop = () => undefined;
    try {
      for (const utc of hours) {
        const view = createElement(
          MemoryRouter,
          null,
          createElement(DragBodyStage, {
            step,
            runner,
            examples: realExamples,
            onDraft: noop,
            onStatus: noop,
            draft: { kind: "drag-body", hour: hour(utc), utc, value: 0, sunFrac: null },
          }),
        );
        await act(async () => root.render(view));
        const text = readAll(container);
        expect(text, `${id} at ${utc}`).toContain("The ground is drawn level at 0°");
        expect(text, `${id} at ${utc}`).toContain(formatUtc(utc));
        expect(text, `${id} at ${utc}`).not.toMatch(TERRAIN_WORDS);
      }
    } finally {
      await act(async () => root.unmount());
      delete (globalThis as { document?: unknown }).document;
    }
  });
});
