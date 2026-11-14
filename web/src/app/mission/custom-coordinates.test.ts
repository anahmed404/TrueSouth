import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../../contracts/generated";
import { customSitesStore } from "../../state/custom-sites";
import { createScenarioStore, type ScenarioCatalog } from "../../state/scenario";
import { CustomCoordinates } from "./custom-site-ui";
import { allNodes, buttons, click, installDocument, propsOf, textOf, type FakeNode } from "./fake-dom";
import { ScenarioStoreProvider } from "./scenario-context";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const catalog: ScenarioCatalog = {
  profiles: JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[],
  sites: JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as ScenarioCatalog["sites"],
  grid: (JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest).time_grid,
};

/** The row's button: the one controlling the form, whatever its name says. */
function toggle(host: FakeNode): FakeNode {
  const found = allNodes(host).find((node) => node.nodeName === "BUTTON" && propsOf(node)["aria-expanded"] !== undefined);
  if (!found) throw new Error("no coordinates row");
  return found;
}

describe('the "Enter coordinates" row in the add-site picker', () => {
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

  async function mount(availability: "available" | "not_available"): Promise<FakeNode> {
    // A known answer, so the row does not ask the server.
    customSitesStore.setState({ availability: { state: availability, checkedAtMs: Date.now() } });
    const document = installDocument();
    const host = document.createElement("div");
    const { createRoot } = await import("react-dom/client");
    root = createRoot(host as unknown as Element);
    const store = createScenarioStore(catalog);
    await act(async () => {
      root?.render(
        createElement(MemoryRouter, null, createElement(ScenarioStoreProvider, { store, children: createElement(CustomCoordinates, { full: false, onStarted: () => undefined }) })),
      );
    });
    return host;
  }

  it("is a closed control named for its action", async () => {
    const host = await mount("available");
    const row = toggle(host);
    expect(textOf(row).trim()).toBe("Enter coordinates");
    expect(propsOf(row)["aria-expanded"]).toBe(false);
    // Closed, the form is not in the page, so the row points at nothing.
    expect(propsOf(row)["aria-controls"]).toBeUndefined();
    expect(allNodes(host).some((node) => propsOf(node).id && String(propsOf(node).id).endsWith("-lat"))).toBe(false);
  });

  it("opens the form with one click", async () => {
    const host = await mount("available");
    await act(async () => click(toggle(host)));
    expect(propsOf(toggle(host))["aria-expanded"]).toBe(true);
    const controls = propsOf(toggle(host))["aria-controls"];
    expect(typeof controls).toBe("string");
    expect(allNodes(host).some((node) => node.nodeName === "FORM" && propsOf(node).id === controls)).toBe(true);
    expect(allNodes(host).some((node) => node.nodeName === "INPUT" && String(propsOf(node).id).endsWith("-lat"))).toBe(true);
    expect(buttons(host, "Compute this site").length + allNodes(host).filter((n) => n.nodeName === "FORM").length).toBeGreaterThan(0);
  });

  it("still shows when the server has no custom sites, and says so under its label", async () => {
    const host = await mount("not_available");
    const row = toggle(host);
    expect(textOf(row)).toContain("Enter coordinates");
    expect(textOf(row)).toContain("Not available on this server");
  });
});
