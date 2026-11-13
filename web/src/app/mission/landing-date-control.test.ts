import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement, type ReactElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Manifest, MissionProfile } from "../../contracts/generated";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { createScenarioStore, lastLandingHour, selectScenario, type ScenarioCatalog, type ScenarioStore } from "../../state/scenario";
import { allNodes, buttons, click, installDocument, propsOf, textOf, type FakeNode } from "./fake-dom";
import { LandingDateControl, SlipButtons } from "./landing-date-control";
import { endReasons } from "./landing-control";
import { ScenarioStoreProvider, useScenario } from "./scenario-context";
import { Timeline } from "./timeline";

/** Counts the control's renders: it draws one "one day earlier" chevron per render. */
const chevrons = vi.hoisted(() => ({ count: 0 }));
vi.mock("lucide-react", async (importOriginal) => {
  const actual = await importOriginal<typeof import("lucide-react")>();
  return {
    ...actual,
    ChevronLeft: () => {
      chevrons.count += 1;
      return null;
    },
  };
});

// "Next GO" has its own tests (next-go-button.test.ts); here it would only start a sweep.
vi.mock("./next-go-button", () => ({ NextGoButton: () => null }));

// The timeline's data: the manifest is ready and the site's hourly data still loading, so
// each strip variant draws its head, with the landing date, and no plot.
const manifest = vi.hoisted(() => ({ data: null as unknown }));
vi.mock("../../data/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../data/hooks")>();
  const loading = () => ({ status: "loading", data: null, error: null });
  return {
    ...actual,
    useManifest: () => ({ status: "ready", data: manifest.data, error: null }),
    useSeries: loading,
    useSites: loading,
  };
});
vi.mock("../../lib/scoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/scoring")>();
  const loading = () => ({ status: "loading", data: null, error: null });
  return { ...actual, useHourFlags: loading, useEvaluation: loading, useCountdowns: loading, useSweep: loading };
});

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function loadCatalog(): ScenarioCatalog {
  const fixtures = path.join(repoRoot, "data", "fixtures");
  const manifestFile = JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest;
  const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
  const sites = JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as ScenarioCatalog["sites"];
  manifest.data = manifestFile;
  return { profiles, sites, grid: manifestFile.time_grid };
}

const catalog = loadCatalog();
const grid = catalog.grid;

/** The strip's wiring: it re-renders on every scrub, as the shell's TimelineStrip does. */
function Strip() {
  useScenario((s) => s.currentUtc);
  return createElement(LandingDateControl);
}

/** The timeline in one of its three variants, with the control in its landing slot. */
function TimelineVariant({ variant }: { variant: "open" | "folded" | "phone" }) {
  const scenario = useScenario(selectScenario);
  return createElement(Timeline, {
    scenario,
    mode: "mission",
    folded: variant === "folded",
    compact: variant === "phone",
    onToggleFold: variant === "phone" ? undefined : () => undefined,
    landing: createElement(LandingDateControl),
  });
}

/** The nodes whose class list includes `name`. */
function byClass(host: FakeNode, name: string): FakeNode[] {
  return allNodes(host).filter((node) => String(propsOf(node).className ?? "").split(" ").includes(name));
}

/** Text with the narrow no-break space between a number and its unit made a plain space. */
function plain(text: string): string {
  return text.replace(/ /g, " ");
}

/** "2026-01-01T00:00:00Z" → "2026-01-01 00:00 UTC". */
function shown(utc: string): string {
  return `${utc.slice(0, 16).replace("T", " ")} UTC`;
}

describe("the landing-date control", () => {
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

  async function mount(store: ScenarioStore, child: ReactElement = createElement(Strip)): Promise<FakeNode> {
    const document = installDocument();
    const host = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as Element);
    await act(async () => {
      root?.render(createElement(MemoryRouter, null, createElement(ScenarioStoreProvider, { store, children: child })));
    });
    return host;
  }

  async function unmount() {
    const mounted = root;
    root = null;
    await act(async () => mounted?.unmount());
  }

  it("shows the landing date in UTC, from the store", async () => {
    const store = createScenarioStore(catalog, "?land=2028-03-14T06:00Z");
    const host = await mount(store);
    const [date] = buttons(host, "Landing date 2028-03-14 06:00 UTC. Change");
    expect(date).toBeDefined();
    expect(plain(textOf(date!)).replace(/\s+/g, " ").trim()).toBe("2028-03-14 06:00 UTC");

    await act(async () => store.getState().setLandingDate("2028-04-02T00:00:00Z"));
    expect(buttons(host, "Landing date 2028-04-02 00:00 UTC. Change")).toHaveLength(1);
  });

  it("moves the landing date by a day each way; the slip buttons (in the picker) by 7 and 14 days", async () => {
    const store = createScenarioStore(catalog, "?land=2028-03-14T06:00Z");
    const host = await mount(store);
    const press = async (within: FakeNode, name: string) => {
      const [button] = buttons(within, name);
      expect(button, name).toBeDefined();
      await act(async () => click(button!));
    };

    await press(host, "One day later");
    expect(store.getState().landingUtc).toBe("2028-03-15T06:00:00Z");
    await press(host, "One day earlier");
    expect(store.getState().landingUtc).toBe("2028-03-14T06:00:00Z");
    // The row holds no slip buttons: they are in the date's picker, which renders when open.
    expect(buttons(host, "Slip the landing 7 days later")).toHaveLength(0);
    await unmount();

    const slips = await mount(store, createElement(SlipButtons, { reason: null }));
    await press(slips, "Slip the landing 7 days later");
    expect(store.getState().landingUtc).toBe("2028-03-21T06:00:00Z");
    await press(slips, "Slip the landing 14 days later");
    expect(store.getState().landingUtc).toBe("2028-04-04T06:00:00Z");
  });

  it("keeps the scrubber at the same offset from the landing when the date moves", async () => {
    const store = createScenarioStore(catalog, "?land=2028-03-14T06:00Z&t=30");
    const host = await mount(store);
    await act(async () => click(buttons(host, "One day later")[0]!));
    const state = store.getState();
    expect(utcToHourIndex(grid, state.currentUtc) - utcToHourIndex(grid, state.landingUtc)).toBe(30);
  });

  it("names the real dates that stop the landing at the ends of the time grid", () => {
    const durationDays = createScenarioStore(catalog).getState().profile.duration_days;
    const last = lastLandingHour(grid, durationDays);
    const reasons = endReasons(grid, durationDays, last);
    expect(plain(reasons.first)).toBe("The data starts at 2026-01-01 00:00 UTC, so the landing cannot be earlier.");
    expect(plain(reasons.last)).toBe(`A 10 d mission cannot land later than ${shown(hourIndexToUtc(grid, last))}: its window must end inside the data.`);
  });

  it("keeps a day button focusable but inert at an end of the grid, and says why", async () => {
    const durationDays = createScenarioStore(catalog).getState().profile.duration_days;
    const last = lastLandingHour(grid, durationDays);
    const reasons = endReasons(grid, durationDays, last);

    const firstStore = createScenarioStore(catalog, `?land=${hourIndexToUtc(grid, 0)}`);
    const first = await mount(firstStore);
    const earlier = buttons(first, "One day earlier")[0]!;
    // Not `disabled`, which would take it out of the tab order and hide its reason.
    expect(propsOf(earlier).disabled).toBeUndefined();
    expect(propsOf(earlier)["aria-disabled"]).toBe(true);
    const reasonId = String(propsOf(earlier)["aria-describedby"]);
    const reasonNode = allNodes(first).find((node) => propsOf(node).id === reasonId);
    expect(reasonNode && plain(textOf(reasonNode))).toBe(plain(reasons.first));
    await act(async () => click(earlier));
    expect(firstStore.getState().landingUtc).toBe(hourIndexToUtc(grid, 0));
    // The other way still works and carries no reason.
    expect(propsOf(buttons(first, "One day later")[0]!)["aria-disabled"]).toBeUndefined();
    await unmount();

    const lastStore = createScenarioStore(catalog);
    lastStore.getState().setLandingDate(hourIndexToUtc(grid, last));
    const host = await mount(lastStore);
    const later = buttons(host, "One day later")[0]!;
    expect(propsOf(later)["aria-disabled"]).toBe(true);
    const lastReason = allNodes(host).find((node) => propsOf(node).id === propsOf(later)["aria-describedby"]);
    expect(lastReason && plain(textOf(lastReason))).toBe(plain(reasons.last));
    await act(async () => click(later));
    expect(lastStore.getState().landingUtc).toBe(hourIndexToUtc(grid, last));
  });

  it("gives the slip buttons the reason at the last landing, and leaves them inert", async () => {
    const store = createScenarioStore(catalog);
    const before = store.getState().landingUtc;
    const host = await mount(store, createElement(SlipButtons, { reason: "A 10 d mission cannot land later than then." }));
    const slip = buttons(host, "Slip the landing 7 days later")[0]!;
    expect(propsOf(slip).disabled).toBeUndefined();
    expect(propsOf(slip)["aria-disabled"]).toBe(true);
    expect(typeof propsOf(slip)["aria-describedby"]).toBe("string");
    await act(async () => click(slip));
    expect(store.getState().landingUtc).toBe(before);
  });

  it("shows where the mission window ends and how long it is, with the duration's tag", async () => {
    const host = await mount(createScenarioStore(catalog, "?land=2028-03-14T06:00Z"));
    const [window] = byClass(host, "ldc-window");
    expect(window).toBeDefined();
    const text = plain(textOf(window!));
    expect(text).toContain("Mission window ends 24 Mar 2028 06:00 UTC, 10 d after landing.");
    expect(text).toContain("→ 24 Mar");
    expect(text).toContain("10 d");
    expect(byClass(window!, "tag").map(textOf).join(" ")).toContain("sourced");
    // Whole days: the end's time equals the landing's, so it is not repeated on screen.
    expect(byClass(window!, "ldc-window-time")).toHaveLength(0);
  });

  it("shows the end's time when it differs from the landing's, and an assumed tag once changed", async () => {
    const store = createScenarioStore(catalog, "?profile=artemis_crewed&land=2028-03-01T00:00Z");
    const host = await mount(store);
    const [window] = byClass(host, "ldc-window");
    expect(plain(textOf(window!))).toContain("Mission window ends 07 Mar 2028 12:00 UTC, 6.5 d after landing.");
    expect(textOf(byClass(window!, "ldc-window-time")[0]!).trim()).toBe("12:00 UTC");

    await act(async () => store.getState().editProfileField("duration_days", 8));
    const [changed] = byClass(host, "ldc-window");
    expect(plain(textOf(changed!))).toContain("Mission window ends 09 Mar 2028 00:00 UTC, 8 d after landing.");
    expect(byClass(changed!, "tag").map(textOf).join(" ")).toContain("assumed");
  });

  it.each(["open", "folded", "phone"] as const)("puts the window's end and its tag in the %s strip", async (variant) => {
    const host = await mount(createScenarioStore(catalog), createElement(TimelineVariant, { variant }));
    const [slot] = byClass(host, "tl-landing");
    expect(slot, "the landing slot").toBeDefined();
    const [window] = byClass(slot!, "ldc-window");
    expect(window, "the window's end").toBeDefined();
    expect(plain(textOf(window!))).toContain("Mission window ends 11 Mar 2028 00:00 UTC, 10 d after landing.");
    expect(plain(textOf(window!))).toContain("→ 11 Mar");
    expect(byClass(window!, "tag").map(textOf).join(" ")).toContain("sourced");
    expect(buttons(slot!, "Landing date 2028-03-01 00:00 UTC. Change")).toHaveLength(1);
  });

  it("does not re-render on a scrub of the current time, only when the landing date changes", async () => {
    const store = createScenarioStore(catalog);
    chevrons.count = 0;
    await mount(store);
    const afterMount = chevrons.count;
    expect(afterMount).toBeGreaterThan(0);

    const landing = utcToHourIndex(grid, store.getState().landingUtc);
    for (let step = 1; step <= 6; step += 1) {
      await act(async () => store.getState().setCurrentTime(hourIndexToUtc(grid, landing + step), "replace"));
    }
    expect(store.getState().currentUtc).toBe(hourIndexToUtc(grid, landing + 6));
    expect(chevrons.count).toBe(afterMount);

    await act(async () => store.getState().slipLanding(1));
    expect(chevrons.count).toBe(afterMount + 1);
  });
});
