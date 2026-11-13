import { describe, expect, it } from "vitest";
import type { Site } from "../contracts/generated.ts";
import type { CustomFetch } from "../data/custom-sites.ts";
import { mergeSites } from "../data/hooks.ts";
import { siteSlopeDeg } from "../lib/scoring/cache.ts";
import { createCustomSitesStore } from "./custom-sites.ts";
import { createDataStore, metaKey } from "./data.ts";

const ID = "c_-88.5000_45.0000";

function siteEntry(id = ID): Record<string, unknown> {
  return {
    id,
    name: "My ridge",
    group: "contrast",
    lat_deg: -88.5,
    lon_deg: 45,
    terrain_tier: "core80",
    elevation_m: 1520,
    slope: { deg: 4.2, baseline_m: 80, source: "LOLA 80 m" },
    has_closeup: false,
    description: "Coordinates entered by the user.",
    source_url: "",
    outcome: null,
    quickmap_url: "",
    moontrek_url: "",
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

/** A fake server: answers by route, and lets the test move a job along. */
function fakeServer() {
  const jobs = new Map<string, "queued" | "running" | "ready" | "failed">();
  const calls: string[] = [];
  const fetchImpl: CustomFetch = async (url, init) => {
    const method = init?.method ?? "GET";
    calls.push(`${method} ${url}`);
    if (url === "/api/health") return json(200, { custom_sites: "available" });
    if (method === "POST" && url === "/api/sites/custom") {
      const body = JSON.parse(String(init?.body)) as { lat_deg: number; lon_deg: number };
      const id = `c_${body.lat_deg.toFixed(4)}_${body.lon_deg.toFixed(4)}`;
      if (!jobs.has(id) || jobs.get(id) === "failed") jobs.set(id, "queued");
      return json(200, { site_id: id, status: jobs.get(id), position_in_queue: jobs.get(id) === "queued" ? 1 : 0 });
    }
    const id = url.split("/").pop() ?? "";
    const status = jobs.get(id);
    if (!status) return json(404, { message: "Custom site is not ready. Start it with POST /api/sites/custom." });
    return json(200, { site_id: id, status, site: status === "ready" ? siteEntry(id) : null, error: null });
  };
  return { jobs, calls, fetchImpl };
}

/** Lets queued promises and the store's job loop run. */
async function settle(times = 20) {
  for (let i = 0; i < times; i += 1) await Promise.resolve();
  await new Promise((resolve) => setTimeout(resolve, 0));
  for (let i = 0; i < times; i += 1) await Promise.resolve();
}

function makeStore(server: ReturnType<typeof fakeServer>) {
  const ticks: (() => void)[] = [];
  const store = createCustomSitesStore({
    fetchImpl: server.fetchImpl,
    sleep: (_ms, signal) =>
      new Promise((resolve, reject) => {
        ticks.push(resolve);
        signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
      }),
  });
  const tick = async () => {
    ticks.splice(0).forEach((resolve) => resolve());
    await settle();
  };
  return { store, tick };
}

describe("custom sites store", () => {
  it("shows a typed point at once, then moves it to the server's id", async () => {
    const server = fakeServer();
    const { store, tick } = makeStore(server);
    const named: [string, string][] = [];
    const key = store.getState().submit(-88.5, 45, " My ridge ", (siteId, previous) => named.push([siteId, previous]));
    expect(store.getState().entries[key]).toMatchObject({ phase: "sending", siteId: null, name: "My ridge" });
    await settle();
    expect(named).toEqual([[ID, key]]);
    expect(store.getState().entries[key]).toBeUndefined();
    expect(store.getState().entries[ID]).toMatchObject({ phase: "queued", position: 1, siteId: ID, key: ID });
    server.jobs.set(ID, "running");
    await tick();
    expect(store.getState().entries[ID]?.phase).toBe("running");
    server.jobs.set(ID, "ready");
    await tick();
    expect(store.getState().entries[ID]).toMatchObject({ phase: "ready", site: { id: ID, name: "My ridge" } });
    expect(store.getState().readySites.map((s) => s.id)).toEqual([ID]);
  });

  it("checks a link's id without starting a job, and computes it only on a click", async () => {
    const server = fakeServer();
    const { store } = makeStore(server);
    store.getState().check(ID);
    store.getState().check(ID);
    await settle();
    expect(store.getState().entries[ID]?.phase).toBe("not_computed");
    expect(server.calls).toEqual([`GET /api/sites/custom/${ID}`]);
    store.getState().retry(ID);
    store.getState().retry(ID);
    await settle();
    expect(server.calls.filter((c) => c.startsWith("POST"))).toHaveLength(2);
    expect(server.jobs.size).toBe(1);
    expect(store.getState().entries[ID]?.phase).toBe("queued");
  });

  it("stops waiting when forgotten", async () => {
    const server = fakeServer();
    const { store, tick } = makeStore(server);
    store.getState().submit(-88.5, 45, null);
    await settle();
    store.getState().forget(ID);
    const before = server.calls.length;
    await tick();
    expect(server.calls.length).toBe(before);
    expect(store.getState().entries[ID]).toBeUndefined();
  });

  it("keeps readySites stable while nothing changes", async () => {
    const server = fakeServer();
    server.jobs.set(ID, "ready");
    const { store } = makeStore(server);
    store.getState().check(ID);
    await settle();
    const first = store.getState().readySites;
    store.getState().check("c_-80.0000_10.0000");
    await settle();
    expect(store.getState().readySites).toBe(first);
  });

  it("asks /api/health once", async () => {
    const server = fakeServer();
    const { store } = makeStore(server);
    store.getState().checkAvailability();
    store.getState().checkAvailability();
    await settle();
    store.getState().checkAvailability();
    expect(store.getState().availability.state).toBe("available");
    expect(server.calls.filter((c) => c.endsWith("/api/health"))).toHaveLength(1);
  });

  it("shows a refused point as a failed row", () => {
    const { store } = makeStore(fakeServer());
    const key = store.getState().refuse(-90, 0, null, "Latitude must be at least 0.001° away from a pole.");
    expect(store.getState().entries[key]).toMatchObject({ phase: "failed", problem: { kind: "refused" } });
  });
});

describe("a custom site through the data layer", () => {
  it("is found by id next to the catalog once ready", () => {
    const catalog = [{ ...siteEntry("connecting_ridge"), group: "sunlit_peak" }] as unknown as Site[];
    const custom = [siteEntry() as unknown as Site];
    const merged = mergeSites(catalog, custom);
    expect(merged?.map((s) => s.id)).toEqual(["connecting_ridge", ID]);
    expect(siteSlopeDeg(merged ?? [], ID)).toBe(4.2);
    expect(mergeSites(catalog, [])).toBeNull();
    expect(mergeSites(custom, custom)).toBeNull();
  });

  it("asks for no file of a custom site until its job is ready", async () => {
    const server = fakeServer();
    const { store, tick } = makeStore(server);
    const files: string[] = [];
    const data = createDataStore(
      async (url) => {
        files.push(url);
        return json(200, { site_id: ID });
      },
      (siteId) => store.getState().whenReady(siteId),
    );
    store.getState().submit(-88.5, 45, null);
    await settle();
    const meta = data.getState().ensure(metaKey(ID)).catch(() => null);
    await tick();
    expect(files).toEqual([]);
    server.jobs.set(ID, "ready");
    await tick();
    await meta;
    expect(files).toEqual([`/api/custom/${ID}/meta.json`]);
  });

  it("does not wait for a catalog site", async () => {
    const urls: string[] = [];
    const data = createDataStore(
      async (url) => {
        urls.push(url);
        return json(404, {});
      },
      () => new Promise<void>(() => undefined),
    );
    await data.getState().ensure(metaKey("connecting_ridge")).catch(() => null);
    expect(urls).toEqual(["/data/sites/connecting_ridge/meta.json"]);
  });
});
