import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Manifest, MissionProfile } from "../../contracts/generated";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { createScenarioStore, lastLandingHour, type ScenarioCatalog, type ScenarioStore } from "../../state/scenario";
import { buttons, click, installDocument, propsOf, textOf, type FakeNode } from "./fake-dom";
import { LandingDateControl } from "./landing-date-control";
import { ScenarioStoreProvider, useScenario } from "./scenario-context";

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

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");

function loadCatalog(): ScenarioCatalog {
  const fixtures = path.join(repoRoot, "data", "fixtures");
  const manifest = JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest;
  const profiles = JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[];
  const sites = JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as ScenarioCatalog["sites"];
  return { profiles, sites, grid: manifest.time_grid };
}

const catalog = loadCatalog();
const grid = catalog.grid;

/** The strip's wiring: it re-renders on every scrub, as the shell's TimelineStrip does. */
function Strip({ density }: { density: "full" | "compact" }) {
  useScenario((s) => s.currentUtc);
  return createElement(LandingDateControl, { density });
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

  async function mount(store: ScenarioStore, density: "full" | "compact" = "full"): Promise<FakeNode> {
    const document = installDocument();
    const host = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as Element);
    await act(async () => {
      root?.render(createElement(MemoryRouter, null, createElement(ScenarioStoreProvider, { store, children: createElement(Strip, { density }) })));
    });
    return host;
  }

  it("shows the landing date in UTC, from the store", async () => {
    const store = createScenarioStore(catalog, "?land=2028-03-14T06:00Z");
    const host = await mount(store);
    const [date] = buttons(host, "Landing date 2028-03-14 06:00 UTC. Change");
    expect(date).toBeDefined();
    expect(textOf(date!).replace(/\s+/g, " ").trim()).toBe("2028-03-14 06:00 UTC");

    await act(async () => store.getState().setLandingDate("2028-04-02T00:00:00Z"));
    expect(buttons(host, "Landing date 2028-04-02 00:00 UTC. Change")).toHaveLength(1);
  });

  it("moves the landing date by a day each way and slips it by 7 and 14 days", async () => {
    const store = createScenarioStore(catalog, "?land=2028-03-14T06:00Z");
    const host = await mount(store);
    const press = async (name: string) => {
      const [button] = buttons(host, name);
      expect(button, name).toBeDefined();
      await act(async () => click(button!));
    };

    await press("One day later");
    expect(store.getState().landingUtc).toBe("2028-03-15T06:00:00Z");
    await press("One day earlier");
    expect(store.getState().landingUtc).toBe("2028-03-14T06:00:00Z");
    await press("Slip the landing 7 days later");
    expect(store.getState().landingUtc).toBe("2028-03-21T06:00:00Z");
    await press("Slip the landing 14 days later");
    expect(store.getState().landingUtc).toBe("2028-04-04T06:00:00Z");
  });

  it("keeps the scrubber at the same offset from the landing when the date moves", async () => {
    const store = createScenarioStore(catalog, "?land=2028-03-14T06:00Z&t=30");
    const host = await mount(store);
    await act(async () => click(buttons(host, "One day later")[0]!));
    const state = store.getState();
    expect(utcToHourIndex(grid, state.currentUtc) - utcToHourIndex(grid, state.landingUtc)).toBe(30);
  });

  it("cannot step before the first hour or past the last landing that fits", async () => {
    const first = await mount(createScenarioStore(catalog, `?land=${hourIndexToUtc(grid, 0)}`));
    expect(propsOf(buttons(first, "One day earlier")[0]!).disabled).toBe(true);
    expect(propsOf(buttons(first, "One day later")[0]!).disabled).toBe(false);
    await act(async () => root?.unmount());
    root = null;

    const store = createScenarioStore(catalog);
    const last = lastLandingHour(grid, store.getState().profile.duration_days);
    store.getState().setLandingDate(hourIndexToUtc(grid, last));
    const host = await mount(store);
    expect(propsOf(buttons(host, "One day later")[0]!).disabled).toBe(true);
    expect(propsOf(buttons(host, "Slip the landing 7 days later")[0]!).disabled).toBe(true);
  });

  it("drops the slip buttons from the row when compact (they move into the date's popover)", async () => {
    const full = await mount(createScenarioStore(catalog), "full");
    expect(buttons(full, "Slip the landing 7 days later")).toHaveLength(1);
    await act(async () => root?.unmount());
    root = null;

    const compact = await mount(createScenarioStore(catalog), "compact");
    expect(buttons(compact, "Slip the landing 7 days later")).toHaveLength(0);
    expect(buttons(compact, "One day later")).toHaveLength(1);
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
