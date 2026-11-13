import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Manifest, MissionProfile } from "../../contracts/generated";
import type { DayResult } from "../../lib/scoring";
import { createScenarioStore, type ScenarioCatalog, type ScenarioStore } from "../../state/scenario";
import { allNodes, buttons, click, installDocument, propsOf, textOf, type FakeNode } from "./fake-dom";
import { NextGoButton } from "./next-go-button";
import { ScenarioStoreProvider } from "./scenario-context";

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

/** The sweep the button sees: set per test. Its 00:00 UTC rows are `sweep.rows`. */
const sweep = vi.hoisted(() => ({
  status: "loading" as "loading" | "ready" | "error",
  rows: [] as DayResult[],
}));

vi.mock("../../lib/scoring", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../lib/scoring")>();
  return {
    ...actual,
    useSweep: () =>
      sweep.status === "ready"
        ? { status: "ready", data: { rows: sweep.rows }, error: null }
        : sweep.status === "error"
          ? { status: "error", data: null, error: "the series could not load" }
          : { status: "loading", data: null, error: null },
    evaluationsAtUtcMidnight: (data: { rows: DayResult[] }) => data.rows,
  };
});

vi.mock("../../data/hooks", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../data/hooks")>();
  return { ...actual, useSites: () => ({ status: "ready", data: catalog.sites, error: null }) };
});

function dayOf(utc: string): number {
  return (Date.parse(utc) - Date.parse(grid.start_utc)) / 86_400_000;
}

function rowsWithGo(...go: string[]): DayResult[] {
  const rows: DayResult[] = Array.from({ length: Math.floor((grid.count - 1) / 24) + 1 }, () => ({ status: "NO-GO" }));
  for (const utc of go) rows[dayOf(utc)] = { status: "GO" };
  return rows;
}

describe("the Next GO button", () => {
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

  beforeEach(() => {
    sweep.status = "loading";
    sweep.rows = [];
  });

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => mounted.unmount());
    }
    delete (globalThis as { document?: unknown }).document;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  async function mount(store: ScenarioStore): Promise<FakeNode> {
    const document = installDocument();
    const host = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as Element);
    await act(async () => {
      root?.render(createElement(MemoryRouter, null, createElement(ScenarioStoreProvider, { store, children: createElement(NextGoButton) })));
    });
    return host;
  }

  const statusLine = (host: FakeNode) =>
    allNodes(host)
      .filter((node) => propsOf(node).role === "status")
      .map(textOf)
      .join("");

  it("is not shown when no site is focused", async () => {
    sweep.status = "ready";
    sweep.rows = rowsWithGo("2028-03-14T00:00:00Z");
    const store = createScenarioStore(catalog, "?sites=fixture_ridge");
    store.getState().removeSite("fixture_ridge");
    expect(store.getState().focusedSiteId).toBeNull();
    const host = await mount(store);
    expect(buttons(host, "Next GO")).toHaveLength(0);
  });

  it("shows it is working, and cannot be pressed, while the sweep runs", async () => {
    const host = await mount(createScenarioStore(catalog, "?sites=fixture_ridge"));
    const [button] = buttons(host, "Next GO");
    expect(propsOf(button!).disabled).toBe(true);
    expect(propsOf(button!)["aria-busy"]).toBe(true);
  });

  it("cannot be pressed when the sweep fails, and says why", async () => {
    sweep.status = "error";
    const host = await mount(createScenarioStore(catalog, "?sites=fixture_ridge"));
    expect(propsOf(buttons(host, "Next GO")[0]!).disabled).toBe(true);
    expect(allNodes(host).some((node) => textOf(node).includes("could not be worked out"))).toBe(true);
  });

  it("says there is no later GO date and offers no button", async () => {
    sweep.status = "ready";
    sweep.rows = rowsWithGo("2027-01-01T00:00:00Z");
    const host = await mount(createScenarioStore(catalog, "?sites=fixture_ridge&land=2028-03-01T00:00Z"));
    expect(buttons(host, "Next GO")).toHaveLength(0);
    expect(textOf(host)).toContain("No GO date before 2032");
  });

  it("moves the landing to 00:00 UTC on the next GO day, says so, and Undo puts it back", async () => {
    sweep.status = "ready";
    sweep.rows = rowsWithGo("2028-03-01T00:00:00Z", "2028-03-14T00:00:00Z");
    const store = createScenarioStore(catalog, "?sites=fixture_ridge&land=2028-03-01T00:00Z&t=30");
    const before = { landingUtc: store.getState().landingUtc, currentUtc: store.getState().currentUtc };
    const host = await mount(store);

    const [button] = buttons(host, "Next GO");
    expect(propsOf(button!).disabled).toBe(false);
    await act(async () => click(button!));
    expect(store.getState().landingUtc).toBe("2028-03-14T00:00:00Z");
    expect(statusLine(host)).toBe("Landing moved to 14 Mar 2028, the next GO date for Fixture Ridge.");

    const [undo] = buttons(host, "Undo");
    expect(undo).toBeDefined();
    await act(async () => click(undo!));
    expect(store.getState().landingUtc).toBe(before.landingUtc);
    expect(store.getState().currentUtc).toBe(before.currentUtc);
    expect(buttons(host, "Undo")).toHaveLength(0);
    expect(statusLine(host)).toBe("Landing moved back to 01 Mar 2028.");
  });

  it("drops the note and its status line when the landing date changes another way", async () => {
    sweep.status = "ready";
    sweep.rows = rowsWithGo("2028-03-14T00:00:00Z");
    const store = createScenarioStore(catalog, "?sites=fixture_ridge&land=2028-03-01T00:00Z");
    const host = await mount(store);
    await act(async () => click(buttons(host, "Next GO")[0]!));
    expect(buttons(host, "Undo")).toHaveLength(1);
    await act(async () => store.getState().slipLanding(1));
    expect(buttons(host, "Undo")).toHaveLength(0);
    expect(statusLine(host)).toBe("");
  });
});
