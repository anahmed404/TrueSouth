import { act, createElement } from "react";
import type { Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SERIES_COLUMNS } from "./decode/layouts.ts";
import type { HookResult } from "./hooks.ts";
import { useSeries } from "./hooks.ts";
import type { DecodedSeries } from "./decode/layouts.ts";
import { dataStore } from "../state/data.ts";

class HostNode {
  nodeType: number;
  nodeName: string;
  tagName: string;
  childNodes: HostNode[] = [];
  parentNode: HostNode | null = null;
  ownerDocument: HostNode | null = null;
  nodeValue = "";
  textContent = "";
  style: Record<string, string> = {};
  documentElement: HostNode | null = null;
  head: HostNode | null = null;
  body: HostNode | null = null;
  activeElement: HostNode | null = null;
  defaultView: object | null = null;

  constructor(nodeType: number, name: string) {
    this.nodeType = nodeType;
    this.nodeName = name;
    this.tagName = name;
  }

  get firstChild(): HostNode | null {
    return this.childNodes[0] ?? null;
  }

  addEventListener(): void {}
  removeEventListener(): void {}
  setAttribute(): void {}
  getAttribute(): null {
    return null;
  }
  removeAttribute(): void {}

  appendChild(child: HostNode): HostNode {
    child.parentNode = this;
    this.childNodes.push(child);
    return child;
  }

  removeChild(child: HostNode): HostNode {
    this.childNodes = this.childNodes.filter((item) => item !== child);
    child.parentNode = null;
    return child;
  }

  insertBefore(child: HostNode, before: HostNode | null): HostNode {
    if (!before) return this.appendChild(child);
    const index = this.childNodes.indexOf(before);
    child.parentNode = this;
    this.childNodes.splice(index < 0 ? this.childNodes.length : index, 0, child);
    return child;
  }

  contains(other: HostNode | null): boolean {
    let current = other;
    while (current) {
      if (current === this) return true;
      current = current.parentNode;
    }
    return false;
  }

  createElement(tag: string): HostNode {
    const element = new HostNode(1, tag.toUpperCase());
    element.ownerDocument = this;
    return element;
  }

  createElementNS(namespace: string, tag: string): HostNode {
    void namespace;
    return this.createElement(tag);
  }

  createTextNode(text: string): HostNode {
    const node = new HostNode(3, "#text");
    node.nodeValue = text;
    node.ownerDocument = this;
    return node;
  }

  createComment(text: string): HostNode {
    const node = new HostNode(8, "#comment");
    node.nodeValue = text;
    node.ownerDocument = this;
    return node;
  }
}

function installDocument(): void {
  const document = new HostNode(9, "#document");
  document.ownerDocument = document;
  document.documentElement = new HostNode(1, "HTML");
  document.head = new HostNode(1, "HEAD");
  document.body = new HostNode(1, "BODY");
  for (const element of [document.documentElement, document.head, document.body]) {
    element.ownerDocument = document;
  }
  document.defaultView = globalThis;
  document.activeElement = null;
  const host = globalThis as unknown as Record<string, unknown>;
  host.document = document;
  host.window = globalThis;
  host.HTMLElement = class HTMLElement {};
  host.HTMLIFrameElement = class HTMLIFrameElement {};
  host.Element = class Element {};
  host.Node = class Node {};
}

const manifest = {
  schema_version: 1,
  generated_utc: "2026-01-01T00:00:00Z",
  moon_radius_m: 1737400,
  observer_height_m: 2,
  skyline_bins: 1440,
  time_grid: { start_utc: "2026-01-01T00:00:00Z", step_s: 3600, count: 2 },
};

const meta = {
  site_id: "fixture_ridge",
  sun_radius_deg: 0.266,
  earth_radius_deg: 0.95,
  series: {
    columns: SERIES_COLUMNS.map((column) => ({
      name: column.name,
      scale: column.scale,
      offset: column.offset,
    })),
  },
  skyline: { bins: 1, missing_samples: 0, max_range_km: 300 },
  terrain: null,
  closeup: null,
};

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  return input.url;
}

describe("mounted data hooks", () => {
  const originalFetch = globalThis.fetch;
  const hadWindow = "window" in globalThis;
  let root: Root | null = null;

  afterEach(async () => {
    if (root) {
      const mounted = root;
      root = null;
      await act(async () => {
        mounted.unmount();
      });
    }
    globalThis.fetch = originalFetch;
    dataStore.getState().dropSite("fixture_ridge");
    delete (globalThis as { document?: unknown }).document;
    if (!hadWindow) delete (globalThis as { window?: unknown }).window;
  });

  it("reloads a still-mounted series hook after dropSite, once", async () => {
    const counts = new Map<string, number>();
    const seriesUrl = "/data/sites/fixture_ridge/series.bin";
    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url = requestUrl(input);
      counts.set(url, (counts.get(url) ?? 0) + 1);
      if (url === "/data/manifest.json") {
        return new Response(JSON.stringify(manifest), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === "/data/sites/fixture_ridge/meta.json") {
        return new Response(JSON.stringify(meta), {
          headers: { "Content-Type": "application/json" },
        });
      }
      if (url === seriesUrl) {
        return new Response(new Uint8Array(SERIES_COLUMNS.length * manifest.time_grid.count * 2));
      }
      return new Response("missing", { status: 404 });
    };

    installDocument();
    const { createRoot } = await import("react-dom/client");
    let latest: HookResult<DecodedSeries> = { status: "loading", data: null, error: null };
    function Probe() {
      latest = useSeries("fixture_ridge");
      return null;
    }

    const container = (globalThis.document as unknown as HostNode).createElement("div");
    root = createRoot(container as unknown as Element);
    await act(async () => {
      root?.render(createElement(Probe));
    });

    async function waitUntil(fetchCount: number): Promise<void> {
      for (let attempt = 0; attempt < 30; attempt += 1) {
        if ((counts.get(seriesUrl) ?? 0) === fetchCount && latest.status === "ready") return;
        await act(async () => {
          await new Promise((resolve) => setTimeout(resolve, 0));
        });
      }
    }

    await waitUntil(1);
    expect(latest.status).toBe("ready");
    expect(counts.get(seriesUrl)).toBe(1);
    const fetchesAfterLoad = [...counts.values()].reduce((sum, count) => sum + count, 0);

    await act(async () => {
      dataStore.getState().dropSite("fixture_ridge");
    });
    await waitUntil(2);
    expect(latest.status).toBe("ready");
    expect(counts.get(seriesUrl)).toBe(2);
    const fetchesAfterReload = [...counts.values()].reduce((sum, count) => sum + count, 0);
    expect(fetchesAfterReload - fetchesAfterLoad).toBe(1);

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(counts.get(seriesUrl)).toBe(2);
    expect([...counts.values()].reduce((sum, count) => sum + count, 0)).toBe(fetchesAfterReload);
  });
});
