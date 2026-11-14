import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Site } from "../contracts/generated.ts";
import type { CustomFetch, Wakeups } from "../data/custom-sites.ts";
import { mergeSites } from "../data/hooks.ts";
import { siteSlopeDeg } from "../lib/scoring/cache.ts";
import { createCustomSitesStore, type CustomSitesStore } from "./custom-sites.ts";
import { createDataStore, metaKey, seriesKey } from "./data.ts";

const ID = "c_-88.5000_45.0000";

function siteEntry(id = ID, lat = -88.5, lon = 45): Record<string, unknown> {
  return {
    id,
    name: "My ridge",
    group: "contrast",
    lat_deg: lat,
    lon_deg: lon,
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

type Job = "queued" | "running" | "ready" | "failed";

/** A fake server: answers by route; the test moves jobs along. Counts every POST. */
function fakeServer() {
  const jobs = new Map<string, Job>();
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
    const id = decodeURIComponent(url.split("/").pop() ?? "");
    const status = jobs.get(id);
    if (!status) return json(404, { message: "Custom site is not ready. Start it with POST /api/sites/custom." });
    const [, lat, lon] = id.split("_");
    return json(200, {
      site_id: id,
      status,
      site: status === "ready" ? siteEntry(id, Number(lat), Number(lon)) : null,
      error: status === "failed" ? { code: "computation_failed", message: "The custom site could not be computed. Please try again." } : null,
    });
  };
  const posts = () => calls.filter((c) => c.startsWith("POST")).length;
  return { jobs, calls, fetchImpl, posts };
}

function fakePage() {
  let hidden = false;
  const listeners = new Set<() => void>();
  const wakeups: Wakeups = {
    hidden: () => hidden,
    onWake: (callback) => {
      listeners.add(callback);
      return () => listeners.delete(callback);
    },
  };
  return {
    wakeups,
    hide: () => {
      hidden = true;
    },
    show: () => {
      hidden = false;
      listeners.forEach((l) => l());
    },
    online: () => listeners.forEach((l) => l()),
  };
}

/** Lets the fake clock and the promises run. */
async function run(ms = 2500) {
  await vi.advanceTimersByTimeAsync(ms);
}

function makeStore(server: ReturnType<typeof fakeServer>, page = fakePage()) {
  const store = createCustomSitesStore({ fetchImpl: server.fetchImpl, wakeups: page.wakeups });
  return { store, page };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a POST only on a button press", () => {
  it("never POSTs for a link: unknown, queued, failed or ready", async () => {
    for (const state of [undefined, "queued", "running", "failed", "ready"] as const) {
      const server = fakeServer();
      if (state) server.jobs.set(ID, state);
      const { store } = makeStore(server);
      store.getState().check(ID);
      await run(10_000);
      expect(server.posts()).toBe(0);
      expect(server.calls.length).toBeGreaterThan(0);
      store.getState().suspend();
    }
  });

  it("never POSTs for a double effect run, a remount, the tab coming back or the network coming back", async () => {
    const server = fakeServer();
    server.jobs.set(ID, "running");
    const { store, page } = makeStore(server);
    // React strict mode: effect, cleanup, effect.
    store.getState().check(ID);
    store.getState().suspend();
    store.getState().check(ID);
    await run();
    // A remount.
    store.getState().suspend();
    store.getState().check(ID);
    await run();
    // The tab is hidden, then shown again; the network drops, then comes back.
    page.hide();
    await run(30_000);
    page.show();
    await run();
    page.online();
    await run();
    expect(server.posts()).toBe(0);
    server.jobs.set(ID, "ready");
    await run();
    expect(store.getState().entries[ID]?.phase).toBe("ready");
    expect(server.posts()).toBe(0);
  });

  it("makes exactly one POST per press", async () => {
    const server = fakeServer();
    const { store } = makeStore(server);
    store.getState().check(ID);
    await run();
    expect(store.getState().entries[ID]?.phase).toBe("not_computed");
    // "Compute this site", pressed twice quickly: the second press finds a busy row.
    store.getState().retry(ID);
    store.getState().retry(ID);
    await run();
    expect(server.posts()).toBe(1);
    // "Your own coordinates" → "Compute this site".
    store.getState().submit(-80, 10, null);
    await run(10_000);
    expect(server.posts()).toBe(2);
    // A failure, then "Try again": one more.
    server.jobs.set(ID, "failed");
    await run();
    expect(store.getState().entries[ID]?.phase).toBe("failed");
    store.getState().retry(ID);
    await run();
    expect(server.posts()).toBe(3);
    store.getState().suspend();
  });
});

describe("the custom sites store", () => {
  it("shows a typed point at once, then moves it to the server's id", async () => {
    const server = fakeServer();
    const { store } = makeStore(server);
    const named: [string, string][] = [];
    const key = store.getState().submit(-88.5, 45, " My‮ ridge ", (siteId, previous) => named.push([siteId, previous]));
    expect(store.getState().entries[key]).toMatchObject({ phase: "sending", siteId: null, name: "My ridge" });
    await run(10);
    expect(named).toEqual([[ID, key]]);
    expect(store.getState().entries[key]).toBeUndefined();
    expect(store.getState().entries[ID]).toMatchObject({ phase: "queued", position: 1, key: ID });
    server.jobs.set(ID, "running");
    await run();
    expect(store.getState().entries[ID]).toMatchObject({ phase: "running", position: null });
    server.jobs.set(ID, "ready");
    await run();
    expect(store.getState().entries[ID]).toMatchObject({ phase: "ready", site: { id: ID, name: "My ridge" } });
    expect(store.getState().readySites.map((s) => s.id)).toEqual([ID]);
  });

  it("announces each change of state once, and never the ticking time", async () => {
    const server = fakeServer();
    const { store } = makeStore(server);
    const said: string[] = [];
    store.subscribe((state, before) => {
      if (state.announcement && state.announcement !== before.announcement) said.push(state.announcement.text);
    });
    store.getState().submit(-88.5, 45, "Ridge", undefined);
    await run(10_000);
    server.jobs.set(ID, "ready");
    await run();
    store.getState().submit(-80, 10, null);
    await run(10);
    server.jobs.set("c_-80.0000_10.0000", "failed");
    await run();
    expect(said).toEqual([
      "Computing terrain for Ridge…",
      "My ridge is ready",
      "Computing terrain for Custom site…",
      "Custom site could not be computed: The custom site could not be computed. Please try again.",
    ]);
  });

  it("asks /api/health once", async () => {
    const server = fakeServer();
    const { store } = makeStore(server);
    store.getState().checkAvailability();
    store.getState().checkAvailability();
    await run(10);
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

describe("removing and failing leave nothing behind", () => {
  function wired(server: ReturnType<typeof fakeServer>) {
    const { store, page } = makeStore(server);
    const files: string[] = [];
    const data = createDataStore(
      async (url) => {
        files.push(url);
        if (url.endsWith("meta.json")) return json(200, { site_id: ID });
        return json(404, {});
      },
      (siteId) => store.getState().whenReady(siteId),
    );
    store.onRelease((siteId) => data.getState().forgetSite(siteId));
    return { store, page, data, files };
  }

  function nothingHeld(store: CustomSitesStore, data: ReturnType<typeof createDataStore>, id: string) {
    expect(store.held(id)).toEqual({ waiters: 0, polling: false });
    expect(Object.keys(data.getState().entries).filter((key) => key.endsWith(`:${id}`))).toEqual([]);
  }

  it("add, remove, add the same id again", async () => {
    const server = fakeServer();
    const { store, data, files } = wired(server);
    store.getState().submit(-88.5, 45, null);
    await run(10);
    const waiting = data.getState().ensure(metaKey(ID));
    const outcome = waiting.then(() => "loaded", () => "released");
    await run(10);
    expect(store.held(ID)).toEqual({ waiters: 1, polling: true });
    store.getState().forget(ID);
    expect(await outcome).toBe("released");
    await run(10_000);
    nothingHeld(store, data, ID);
    expect(files).toEqual([]);
    const callsAfterRemove = server.calls.length;
    await run(10_000);
    expect(server.calls.length).toBe(callsAfterRemove);
    // The same id again, and this time it gets ready: only now are its files asked for.
    store.getState().submit(-88.5, 45, null);
    await run(10);
    const again = data.getState().ensure(metaKey(ID)).catch(() => "a test meta file");
    server.jobs.set(ID, "ready");
    await run();
    await again;
    expect(files).toEqual([`/api/custom/${ID}/meta.json`]);
    store.getState().forget(ID);
    nothingHeld(store, data, ID);
  });

  it("add, fail, retry", async () => {
    const server = fakeServer();
    const { store, data } = wired(server);
    store.getState().submit(-88.5, 45, null);
    await run(10);
    const first = data.getState().ensure(seriesKey(ID)).then(() => "loaded", () => "released");
    await run(10);
    server.jobs.set(ID, "failed");
    await run();
    expect(await first).toBe("released");
    expect(store.getState().entries[ID]?.phase).toBe("failed");
    nothingHeld(store, data, ID);
    store.getState().retry(ID);
    await run(10);
    expect(store.held(ID).polling).toBe(true);
    const second = data.getState().ensure(metaKey(ID)).catch(() => "a test meta file");
    server.jobs.set(ID, "ready");
    await run();
    await second;
    expect(store.getState().entries[ID]?.phase).toBe("ready");
    expect(store.held(ID)).toEqual({ waiters: 0, polling: false });
  });

  it("stops waiting on Stop waiting, and lets the server finish", async () => {
    const server = fakeServer();
    const { store, data } = wired(server);
    store.getState().submit(-88.5, 45, null);
    await run(10);
    store.getState().forget(ID);
    const calls = server.calls.length;
    await run(60_000);
    expect(server.calls.length).toBe(calls);
    expect(server.jobs.get(ID)).toBe("queued");
    nothingHeld(store, data, ID);
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
