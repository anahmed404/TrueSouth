import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Manifest, MissionProfile } from "../../../contracts/generated";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index";
import { countdowns, hourFlags, windowLength, type Countdowns as CountdownValues } from "../../../lib/scoring";
import { hourIndexToUtc, utcToHourIndex } from "../../../lib/time";
import { createScenarioStore, type ScenarioCatalog } from "../../../state/scenario";
import { allNodes, installDocument, propsOf, textOf, type FakeNode } from "../fake-dom";
import { Countdowns, stretchChipText } from "./countdowns";
import { sunCountdown } from "./countdown-text";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const root = path.join(repoRoot, "data", "fixtures");
const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")) as Manifest;
const profiles = JSON.parse(readFileSync(path.join(root, "profiles.json"), "utf8")) as MissionProfile[];
const sites = JSON.parse(readFileSync(path.join(root, "sites.json"), "utf8")) as ScenarioCatalog["sites"];
const catalog: ScenarioCatalog = { profiles, sites, grid: manifest.time_grid };
const grid = manifest.time_grid;

function loadSeries(site: string) {
  const bytes = readFileSync(path.join(root, "sites", site, "series.bin"));
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return decodeSeries(copy, SERIES_COLUMNS, grid.count, "series.bin");
}

const im2 = profiles.find((p) => p.id === "im2_athena")!;
const n = windowLength(im2.duration_days);

/** The first fixture site with both a dark stretch and a blackout, so one site shows every kind. */
const { SITE, series } = (() => {
  for (const site of sites.map((s) => s.id)) {
    let loaded;
    try {
      loaded = loadSeries(site);
    } catch {
      continue;
    }
    const f = hourFlags(loaded, im2);
    if (f.lit.includes(0) && f.link.includes(0) && f.lit.includes(1) && f.link.includes(1)) return { SITE: site, series: loaded };
  }
  throw new Error("no fixture site has both a dark stretch and a blackout");
})();

/** What the card's hooks return: the real fixture computations, or nulls for "no data". */
const hooks = vi.hoisted(() => ({ missing: false }));
vi.mock("../../../data/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../data/hooks")>();
  return {
    ...actual,
    useManifest: () => ({ status: "ready", data: manifest, error: null }),
    useSeries: () => ({ status: "ready", data: series, error: null }),
  };
});
vi.mock("../../../lib/scoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../../lib/scoring")>();
  return {
    ...actual,
    useHourFlags: (_site: string, profile: MissionProfile) => ({ status: "ready", data: actual.hourFlags(series, profile), error: null }),
    useCountdowns: (_site: string, profile: MissionProfile, currentUtc: string): { status: "ready"; data: CountdownValues; error: null } => ({
      status: "ready",
      data: hooks.missing
        ? { sunset: null, sunrise: null, earthset: null, earthrise: null }
        : actual.countdowns(series, profile, utcToHourIndex(grid, currentUtc)),
      error: null,
    }),
  };
});

/** The first hour, from the grid's second day on, that `test` accepts. */
function firstHour(test: (hour: number) => boolean): number {
  for (let hour = 48; hour < grid.count - n; hour++) if (test(hour)) return hour;
  throw new Error("the fixture has no such hour");
}

const flags = hourFlags(series, im2);
const gridEnd = hourIndexToUtc(grid, grid.count - 1);
const sunSoon = (hour: number) => sunCountdown(countdowns(series, im2, hour), flags.lit[hour] === 1, gridEnd).soon;

/** Each kind of hour the cards draw, with the landing that puts it inside the window. */
const KINDS: { name: string; hour: number; profile: string; missing?: boolean }[] = [];
{
  const lit = firstHour((h) => flags.lit[h] === 1 && flags.link[h] === 1 && !sunSoon(h));
  const warning = firstHour((h) => flags.lit[h] === 1 && sunSoon(h));
  // A dark hour whose stretch inside the window (which starts at it) is longer than 6 h.
  const dark = firstHour((h) => flags.lit[h] === 0 && flags.lit[h - 1] === 1 && Array.from({ length: 7 }, (_, i) => flags.lit[h + i]).every((v) => v === 0));
  const blackout = firstHour((h) => flags.link[h] === 0 && flags.link[h - 1] === 1);
  KINDS.push(
    { name: "lit and linked", hour: lit, profile: "im2_athena" },
    { name: "lit, under 6 h to sunset (warning)", hour: warning, profile: "im2_athena" },
    { name: "dark, over the limit", hour: dark, profile: "im2_athena" },
    { name: "dark, within the limit", hour: dark, profile: "custom:im2_athena;max_dark_h=10000" },
    { name: "blackout", hour: blackout, profile: "im2_athena" },
    { name: "blackout, within the limit", hour: blackout, profile: "custom:im2_athena;max_blackout_h=10000" },
    { name: "no data before the grid's end", hour: lit, profile: "im2_athena", missing: true },
  );
}

/** The card's own rows, top to bottom, by class name. */
function rows(card: FakeNode): string[] {
  return card.childNodes.filter((node) => node.nodeType === 1).map((node) => String(propsOf(node).className ?? node.nodeName).split(" ")[0] ?? "");
}

function cards(host: FakeNode): FakeNode[] {
  return allNodes(host).filter((node) => String(propsOf(node).className ?? "").split(" ").includes("cd"));
}

describe("the countdown cards keep the same rows at every hour", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => mounted.unmount());
    }
    hooks.missing = false;
    delete (globalThis as { document?: unknown }).document;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  async function render(kind: (typeof KINDS)[number]): Promise<FakeNode> {
    hooks.missing = kind.missing ?? false;
    const landing = hourIndexToUtc(grid, kind.hour).replace(":00:00Z", ":00Z");
    const store = createScenarioStore(catalog, `?profile=${kind.profile}&sites=${SITE}&land=${landing}&t=0`);
    const document = installDocument();
    const host = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as Element);
    const scenario = store.getState().scenario;
    await act(async () => {
      root?.render(createElement(MemoryRouter, null, createElement(Countdowns, { scenario, mode: "mission" })));
    });
    return host;
  }

  it("finds every kind of hour in the fixture", () => {
    expect(KINDS.map((kind) => kind.name)).toHaveLength(7);
    for (const kind of KINDS) expect(kind.hour).toBeGreaterThan(0);
  });

  it.each(KINDS.map((kind) => [kind.name, kind] as const))("%s: head, countdown, values, then the notes row", async (_name, kind) => {
    const host = await render(kind);
    const found = cards(host);
    expect(found).toHaveLength(2);
    for (const card of found) expect(rows(card)).toEqual(["cd-head", "cd-main", "cd-vals", "cd-notes"]);
  });

  it("has the same rows in every kind of hour: nothing appears or disappears below the readouts", async () => {
    const seen: string[] = [];
    for (const kind of KINDS) {
      const host = await render(kind);
      seen.push(cards(host).map((card) => rows(card).join(" > ")).join(" | "));
      await act(async () => root?.unmount());
      root = null;
    }
    expect(new Set(seen).size, seen.join(" / ")).toBe(1);
  });

  it("puts the stretch, with its tag, and the warning in the notes row, never in a row of their own", async () => {
    const dark = await render(KINDS[2]!);
    const [sun, earth] = cards(dark);
    const notes = (card: FakeNode) => card.childNodes.find((node) => propsOf(node).className === "cd-notes")!;
    const sunNotes = textOf(notes(sun!)).replace(/ /g, " ");
    expect(sunNotes).toMatch(/^\d+ h dark · limit 6 h/);
    expect(sunNotes).toMatch(/This dark stretch lasts \d+ h, over the 6 h limit\./);
    expect(allNodes(notes(sun!)).some((node) => String(propsOf(node).className ?? "").includes("tag"))).toBe(true);
    expect(textOf(notes(earth!))).not.toContain("dark");
    await act(async () => root?.unmount());
    root = null;

    const warning = await render(KINDS[1]!);
    expect(textOf(cards(warning)[0]!.childNodes.find((node) => propsOf(node).className === "cd-notes")!)).toContain("Under 6");
  });

  it("words the chip and its sentence plainly", () => {
    expect(stretchChipText("dark", { value: "130 h", limit: "6 h", broken: true })).toEqual({
      short: "130 h dark · limit 6 h",
      sentence: "This dark stretch lasts 130 h, over the 6 h limit.",
    });
    expect(stretchChipText("blackout", { value: "4 h", limit: "12 h", broken: false }).sentence).toBe("This blackout lasts 4 h, within the 12 h limit.");
  });
});
