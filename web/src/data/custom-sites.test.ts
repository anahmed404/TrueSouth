import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  TEXT,
  coordinatesOfId,
  customSiteStatus,
  customSitesAvailability,
  driveCustomSite,
  parseCustomSite,
  parseRetryAfter,
  requestCustomSite,
  type CustomFetch,
  type JobSnapshot,
  type Wakeups,
} from "./custom-sites.ts";

const ID = "c_-88.5000_45.0000";

function siteEntry(overrides: Record<string, unknown> = {}) {
  return {
    id: ID,
    name: "My ridge",
    group: "contrast",
    lat_deg: -88.5,
    lon_deg: 45,
    terrain_tier: "core80",
    elevation_m: 1520.4,
    slope: { deg: 4.2, baseline_m: 80, source: "LOLA 80 m" },
    has_closeup: false,
    description: "Coordinates entered by the user.",
    source_url: "",
    outcome: null,
    quickmap_url: "https://quickmap.lroc.asu.edu/",
    moontrek_url: "https://trek.nasa.gov/moon/",
    ...overrides,
  };
}

function json(status: number, body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
}

function text(status: number, body: string, type = "text/plain"): Response {
  return new Response(body, { status, headers: { "content-type": type } });
}

type Call = { url: string; init?: RequestInit };

function scripted(replies: (Response | Error | ((call: Call) => Response))[]): { fetchImpl: CustomFetch; calls: Call[] } {
  const calls: Call[] = [];
  const fetchImpl: CustomFetch = async (url, init) => {
    const call = { url, init };
    calls.push(call);
    const next = replies.shift();
    if (!next) throw new Error(`unexpected request ${url}`);
    if (next instanceof Error) throw next;
    return typeof next === "function" ? next(call) : next;
  };
  return { fetchImpl, calls };
}

describe("requestCustomSite", () => {
  it("posts numbers as JSON numbers and reads the server's id", async () => {
    const { fetchImpl, calls } = scripted([json(200, { site_id: ID, status: "queued", position_in_queue: 2 })]);
    const reply = await requestCustomSite(-88.5, 45, "  My ridge ", { fetchImpl });
    expect(reply).toEqual({ ok: true, siteId: ID, status: "queued", position: 2 });
    expect(calls[0]?.url).toBe("/api/sites/custom");
    expect(calls[0]?.init?.method).toBe("POST");
    const body = JSON.parse(String(calls[0]?.init?.body));
    expect(body).toEqual({ lat_deg: -88.5, lon_deg: 45, name: "My ridge" });
    expect(typeof body.lat_deg).toBe("number");
  });

  it("leaves out an empty name and never sends a number it cannot send", async () => {
    const { fetchImpl, calls } = scripted([json(200, { site_id: ID, status: "running", position_in_queue: 0 })]);
    expect(await requestCustomSite(-88.5, 45, "   ", { fetchImpl })).toMatchObject({ ok: true, status: "running", position: null });
    expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({ lat_deg: -88.5, lon_deg: 45 });
    const none = scripted([]);
    expect(await requestCustomSite(Number.NaN, 45, null, { fetchImpl: none.fetchImpl })).toMatchObject({ ok: false, kind: "refused" });
    expect(none.calls).toHaveLength(0);
  });

  it("refuses an answer about another place", async () => {
    for (const other of ["c_-10.0000_20.0000", "c_-88.5001_45.0000", "c_-88.5000_45.0000 "]) {
      const { fetchImpl } = scripted([json(200, { site_id: other, status: "queued", position_in_queue: 1 })]);
      expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable", message: TEXT.otherPlace });
    }
  });

  it("expects the id the server's own rules make", async () => {
    const cases: [number, number, string][] = [
      [-88.50004, 45, "c_-88.5000_45.0000"],
      [-88.50005, 45, "c_-88.5001_45.0000"],
      [10, 359.99995, "c_10.0000_0.0000"],
      [10, -45, "c_10.0000_315.0000"],
      [-0.00001, 10, "c_0.0000_10.0000"],
    ];
    for (const [lat, lon, id] of cases) {
      const { fetchImpl } = scripted([json(200, { site_id: id, status: "running", position_in_queue: 0 })]);
      expect(await requestCustomSite(lat, lon, null, { fetchImpl })).toMatchObject({ ok: true, siteId: id });
    }
  });

  it("sends a cleaned name", async () => {
    const { fetchImpl, calls } = scripted([json(200, { site_id: ID, status: "queued", position_in_queue: 1 })]);
    await requestCustomSite(-88.5, 45, "\u202eRidge\u0007   east\n", { fetchImpl });
    expect(JSON.parse(String(calls[0]?.init?.body)).name).toBe("Ridge east");
  });

  it.each([
    ["a 422 with field messages", json(422, { message: "Check the coordinates.", fields: [{ field: "lat_deg", message: "Latitude must be at least 0.001° away from a pole." }] }), "refused", "Check the coordinates."],
    ["a 422 without fields", json(422, { message: "Latitude must be a number." }), "refused", "Latitude must be a number."],
    ["FastAPI's own 422", json(422, { detail: [{ loc: ["body", "lon_deg"], msg: "Input should be a valid number", type: "float_parsing" }] }), "refused", TEXT.refused],
    ["a 413", json(413, { message: "The request is too large." }), "refused", "The request is too large."],
    ["a 413 with no body", text(413, ""), "refused", TEXT.tooLarge],
    ["a 429 for the hourly limit", json(429, { message: "You may start 6 custom sites per hour. Please try again later." }, { "retry-after": "1200" }), "rate_limited", "You may start 6 custom sites per hour. Please try again later."],
    ["a 429 for a full queue", json(429, { message: "The custom-site queue is full. Please try again later." }, { "retry-after": "1" }), "queue_full", "The custom-site queue is full. Please try again later."],
    ["an older 429 for a full queue", json(429, { message: "The custom-site queue is full. Please try again later." }), "queue_full", "The custom-site queue is full. Please try again later."],
    ["a 503 with no ephemeris", json(503, { message: "Custom sites need the global ephemeris, which is not installed on this server." }), "unavailable", "Custom sites need the global ephemeris, which is not installed on this server."],
    ["a 503 while shutting down", json(503, { message: "This server is shutting down. Please try again later." }), "unavailable", "This server is shutting down. Please try again later."],
    ["a 422 for a bad body", json(422, { message: "Please check the request fields.", fields: [{ field: "body", message: "Send a JSON object with latitude, longitude and an optional name. Only these fields are allowed." }] }), "refused", "Please check the request fields."],
    ["a 503 with no terrain maps", json(503, { message: TEXT.mapsMissing }), "unavailable", TEXT.mapsMissing],
    ["a 503 with full storage", json(503, { message: TEXT.storageFull }), "storage_full", TEXT.storageFull],
    ["a 507", json(507, { message: TEXT.storageFull }), "storage_full", TEXT.storageFull],
    ["a 507 with no message", json(507, {}), "storage_full", TEXT.storageFull],
    ["a 501 from an older server", json(501, { message: "Custom sites are not available in this version." }), "unavailable", TEXT.unavailable],
    ["a 404 from a server without the route", json(404, { message: "Not found" }), "unavailable", TEXT.unavailable],
    ["the dev proxy with no API", text(500, "Error occurred while trying to proxy"), "offline", TEXT.offline],
    ["a gateway page", text(502, "<html>Bad gateway</html>", "text/html"), "offline", TEXT.offline],
    ["a server error with JSON", json(500, { error: { code: "x", message: "Something broke." } }), "server_error", "Something broke."],
  ])("turns %s into a plain message", async (_label, response, kind, message) => {
    const { fetchImpl } = scripted([response]);
    const reply = await requestCustomSite(-88.5, 45, null, { fetchImpl, nowMs: 0 });
    expect(reply).toMatchObject({ ok: false, kind, message });
  });

  it("puts each field's message beside its field", async () => {
    const { fetchImpl } = scripted([
      json(422, { message: "Check the coordinates.", fields: [{ field: "lat_deg", message: "Latitude must be at least 0.001° away from a pole." }, { field: "lon_deg" }, "junk"] }),
    ]);
    const reply = await requestCustomSite(-90, 45, null, { fetchImpl });
    expect(reply.ok).toBe(false);
    if (!reply.ok) expect(reply.fields).toEqual([{ field: "lat_deg", message: "Latitude must be at least 0.001° away from a pole." }]);
  });

  it("reads Retry-After as seconds or a date, kept between 1 s and 1 h", async () => {
    const { fetchImpl } = scripted([json(429, { message: "Slow down." }, { "retry-after": "90" })]);
    expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ kind: "rate_limited", retryAfterS: 90 });
    const base = Date.parse("2031-01-01T00:00:00Z");
    expect(parseRetryAfter("Wed, 01 Jan 2031 00:01:00 GMT", base)).toBe(60);
    expect(parseRetryAfter("Thu, 01 Jan 2032 00:00:00 GMT", base)).toBe(3600);
    expect(parseRetryAfter("Mon, 01 Jan 2029 00:00:00 GMT", base)).toBe(1);
    expect(parseRetryAfter("0")).toBe(1);
    expect(parseRetryAfter("99999999999")).toBe(3600);
    for (const bad of ["soon", "-5", "1.5", "", "1e9", "Infinity", "NaN", "12 34"]) expect(parseRetryAfter(bad)).toBeNull();
    expect(parseRetryAfter(null)).toBeNull();
  });

  it("never shows a raw body: long or marked-up messages are replaced", async () => {
    const { fetchImpl } = scripted([json(422, { message: "<b>Traceback</b> (most recent call last)" }), json(422, { message: "x".repeat(400) })]);
    expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ message: TEXT.refused });
    expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ message: TEXT.refused });
  });

  it("treats a malformed success as unreadable", async () => {
    for (const body of [{ status: "queued" }, { site_id: "c_bad", status: "queued" }, { site_id: ID, status: "done" }, [], "ok"]) {
      const { fetchImpl } = scripted([json(200, body)]);
      expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable" });
    }
    const { fetchImpl } = scripted([text(200, "not json")]);
    expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable" });
  });

  it("calls a network failure offline", async () => {
    const { fetchImpl } = scripted([new TypeError("Failed to fetch")]);
    expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ ok: false, kind: "offline", message: TEXT.offline });
  });
});

describe("customSiteStatus", () => {
  it("reads each status", async () => {
    const { fetchImpl, calls } = scripted([
      json(200, { site_id: ID, status: "queued", site: null, error: null }),
      json(200, { site_id: ID, status: "running", site: null, error: null }),
      json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null }),
      json(200, { site_id: ID, status: "failed", site: null, error: { code: "computation_failed", message: "The custom site could not be computed. Please try again." } }),
    ]);
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: true, status: "queued", site: null });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: true, status: "running" });
    const ready = await customSiteStatus(ID, { fetchImpl });
    expect(ready).toMatchObject({ ok: true, status: "ready", site: { id: ID, name: "My ridge", terrain_tier: "core80" } });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({
      ok: true,
      status: "failed",
      failure: { kind: "failed", message: "The custom site could not be computed. Please try again." },
    });
    expect(calls[0]?.url).toBe(`/api/sites/custom/${ID}`);
  });

  it("says unknown for a 404, and offline when nothing answers", async () => {
    const { fetchImpl } = scripted([json(404, { message: "Custom site is not ready. Start it with POST /api/sites/custom." }), new TypeError("down"), text(504, "")]);
    expect(await customSiteStatus(ID, { fetchImpl })).toEqual({ ok: false, unknown: true });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "offline" });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "offline" });
  });

  it("refuses a ready answer whose site cannot be read, or is about another place", async () => {
    const bad = [
      null,
      siteEntry({ id: "c_-80.0000_0.0000" }),
      siteEntry({ lat_deg: -10 }),
      siteEntry({ lon_deg: 45.0002 }),
      siteEntry({ lat_deg: "x" }),
      siteEntry({ lon_deg: 360 }),
      siteEntry({ terrain_tier: "moon" }),
      siteEntry({ slope: { deg: "steep" } }),
      siteEntry({ slope: { deg: 4.2, source: "LOLA" } }),
      siteEntry({ slope: { deg: 120, baseline_m: 80, source: "LOLA" } }),
      siteEntry({ slope: { deg: 4.2, baseline_m: 0, source: "LOLA" } }),
      siteEntry({ elevation_m: 1e9 }),
      siteEntry({ elevation_m: "1520" }),
      siteEntry({ has_closeup: "no" }),
      siteEntry({ name: 7 }),
      siteEntry({ variant_of: "connecting_ridge", offset_m: 3 }),
      siteEntry({ nearby_sun: { radius_m: 160, points: 1, min: 0, max: 1 } }),
      siteEntry({ quickmap_url: "javascript:alert(1)" }),
      siteEntry({ terrain_tier: "sphere" }),
    ];
    for (const site of bad) {
      const { fetchImpl } = scripted([json(200, { site_id: ID, status: "ready", site, error: null })]);
      expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable", message: TEXT.unreadableSite });
    }
    const { fetchImpl } = scripted([json(200, { site_id: "c_-1.0000_1.0000", status: "queued" })]);
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable" });
  });

  it("keeps a sphere site's nulls, and never carries variant fields", () => {
    const site = parseCustomSite(siteEntry({ terrain_tier: "sphere", slope: null, elevation_m: null, name: "  " }), ID);
    expect(site).toMatchObject({ terrain_tier: "sphere", slope: null, elevation_m: null, name: "Custom site", variant_of: null, nearby_sun: null, has_closeup: false });
  });

  it("cleans a server's name like a typed one", () => {
    const names: [string, string][] = [
      ["\u202eetis ruoy", "etis ruoy"],
      ["Ridge\u2066\u2067\u2068\u2069\u200e\u200f\u061c\u202a\u202b\u202c\u202d", "Ridge"],
      ["Ri\u0000dg\u001be\u007f", "Ridge"],
      ["  Ridge \t\n east  ", "Ridge east"],
      ["x".repeat(500), "x".repeat(60)],
    ];
    for (const [raw, clean] of names) expect(parseCustomSite(siteEntry({ name: raw }), ID)?.name).toBe(clean);
  });

  it("reads a queue position from the status answer when a server sends one", async () => {
    const { fetchImpl } = scripted([
      json(200, { site_id: ID, status: "queued", site: null, error: null, position_in_queue: 3 }),
      json(200, { site_id: ID, status: "queued", site: null, error: null }),
      json(200, { site_id: ID, status: "queued", site: null, error: null, position_in_queue: -1 }),
    ]);
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ position: 3 });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ position: null });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ position: null });
  });

  it("reads a storage-full job failure", async () => {
    const { fetchImpl } = scripted([json(200, { site_id: ID, status: "failed", site: null, error: { code: "storage_full", message: TEXT.storageFull } })]);
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ failure: { kind: "storage_full", message: TEXT.storageFull } });
  });
});

describe("customSitesAvailability", () => {
  it("reads custom_sites from /api/health", async () => {
    const { fetchImpl, calls } = scripted([
      json(200, { status: "ok", custom_sites: "available" }),
      json(200, { status: "ok", custom_sites: "not_available", message: TEXT.mapsMissing }),
      json(501, { message: "no" }),
      text(500, "proxy error"),
      new TypeError("down"),
      json(200, "nonsense"),
    ]);
    expect(await customSitesAvailability({ fetchImpl })).toBe("available");
    expect(await customSitesAvailability({ fetchImpl })).toBe("not_available");
    expect(await customSitesAvailability({ fetchImpl })).toBe("not_available");
    expect(await customSitesAvailability({ fetchImpl })).toBe("offline");
    expect(await customSitesAvailability({ fetchImpl })).toBe("offline");
    expect(await customSitesAvailability({ fetchImpl })).toBe("offline");
    expect(calls[0]?.url).toBe("/api/health");
  });
});

describe("coordinatesOfId", () => {
  it("recognises a valid link id and nothing else", () => {
    expect(coordinatesOfId(ID)).toEqual({ latDeg: -88.5, lonDeg: 45 });
    for (const bad of ["connecting_ridge", "c_-88.5_45", "c_999.0000_999.0000", "c_-0.0000_10.0000", "c_10.0000_360.0000"]) {
      expect(coordinatesOfId(bad)).toBeNull();
    }
  });
});

/** A page that can be hidden, shown again and go back online, on demand. */
function fakeWakeups() {
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
    listeners,
  };
}

describe("driveCustomSite", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  function harness(replies: Parameters<typeof scripted>[0], options: { ceilingMs?: number; requestTimeoutMs?: number } = {}) {
    const { fetchImpl, calls } = scripted(replies);
    const updates: JobSnapshot[] = [];
    const controller = new AbortController();
    const page = fakeWakeups();
    const run = (start: Parameters<typeof driveCustomSite>[0]) =>
      driveCustomSite(start, {
        signal: controller.signal,
        onUpdate: (snapshot) => updates.push(snapshot),
        fetchImpl,
        wakeups: page.wakeups,
        ceilingMs: options.ceilingMs,
        requestTimeoutMs: options.requestTimeoutMs,
      });
    const posts = () => calls.filter((c) => c.init?.method === "POST").length;
    return { run, updates, calls, controller, page, posts };
  }

  /** Runs the job to its end, moving the fake clock along. */
  async function finish<T>(promise: Promise<T>, ms = 20 * 60 * 1000): Promise<T> {
    let done = false;
    void promise.finally(() => {
      done = true;
    });
    for (let t = 0; t < ms && !done; t += 500) await vi.advanceTimersByTimeAsync(500);
    return promise;
  }

  it("polls with GET from queued through running to ready, after one POST", async () => {
    const h = harness([
      json(200, { site_id: ID, status: "queued", position_in_queue: 3 }),
      json(200, { site_id: ID, status: "queued", site: null, error: null }),
      json(200, { site_id: ID, status: "running", site: null, error: null }),
      json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null }),
    ]);
    const last = await finish(h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 }));
    expect(h.updates.map((u) => u.phase)).toEqual(["queued", "queued", "running", "ready"]);
    // The POST's position, then "Queued" without a number: the status answer has none.
    expect(h.updates.map((u) => u.position)).toEqual([3, null, null, null]);
    expect(last).toMatchObject({ phase: "ready", siteId: ID, site: { name: "My ridge" } });
    expect(h.calls.map((c) => c.init?.method ?? "GET")).toEqual(["POST", "GET", "GET", "GET"]);
  });

  it("never POSTs while queued, whatever happens between two looks", async () => {
    const queued = () => json(200, { site_id: ID, status: "queued", site: null, error: null });
    const h = harness([
      json(200, { site_id: ID, status: "queued", position_in_queue: 4 }),
      queued(), queued(), queued(), queued(), queued(), queued(), queued(),
      json(200, { site_id: ID, status: "failed", site: null, error: { code: "computation_failed", message: "Broke." } }),
    ]);
    const last = await finish(h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 }));
    expect(last).toMatchObject({ phase: "failed", problem: { message: "Broke." } });
    expect(h.posts()).toBe(1);
  });

  it("asks once for the site of a point the server already has", async () => {
    const h = harness([
      json(200, { site_id: "c_10.0000_20.0000", status: "ready", position_in_queue: 0 }),
      json(200, { site_id: "c_10.0000_20.0000", status: "ready", site: siteEntry({ id: "c_10.0000_20.0000", lat_deg: 10, lon_deg: 20, terrain_tier: "sphere", slope: null }), error: null }),
    ]);
    const last = await finish(h.run({ kind: "submit", latDeg: 10, lonDeg: 20 }));
    expect(h.updates).toHaveLength(1);
    expect(last).toMatchObject({ phase: "ready", site: { terrain_tier: "sphere" } });
  });

  it("fails a refused start without an id", async () => {
    const h = harness([json(429, { message: "You may start 6 custom sites per hour. Please try again later." }, { "retry-after": "600" })]);
    const last = await finish(h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 }));
    expect(last).toMatchObject({ siteId: null, phase: "failed", problem: { kind: "rate_limited", retryAfterS: 600 } });
  });

  it("says the job was lost when the server forgets it", async () => {
    const h = harness([json(200, { site_id: ID, status: "queued", position_in_queue: 1 }), json(404, { message: "gone" })]);
    expect(await finish(h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 }))).toMatchObject({ phase: "failed", problem: { kind: "lost", message: TEXT.lost } });
  });

  it("waits longer after each error, then gives up", async () => {
    const page = fakeWakeups();
    const backoff: number[] = [];
    const flaky: CustomFetch = async (_url, init) => {
      backoff.push(Date.now());
      if (init?.method === "POST") return json(200, { site_id: ID, status: "running", position_in_queue: 0 });
      throw new TypeError("x");
    };
    const last = await finish(
      driveCustomSite({ kind: "submit", latDeg: -88.5, lonDeg: 45 }, { signal: new AbortController().signal, onUpdate: () => undefined, fetchImpl: flaky, wakeups: page.wakeups }),
    );
    expect(last).toMatchObject({ phase: "failed", problem: { kind: "offline" } });
    const gaps = backoff.slice(1).map((t, i) => t - (backoff[i] ?? 0));
    expect(gaps).toEqual([2000, 4000, 8000, 16000, 30000]);
  });

  it("rides out one bad answer", async () => {
    const h = harness([
      json(200, { site_id: ID, status: "running", position_in_queue: 0 }),
      text(502, ""),
      json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null }),
    ]);
    expect(await finish(h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 }))).toMatchObject({ phase: "ready" });
  });

  it("stops after the ceiling, even with a request that never returns", async () => {
    const hanging: CustomFetch = (_url, init) =>
      init?.method === "POST" ? Promise.resolve(json(200, { site_id: ID, status: "running", position_in_queue: 0 })) : new Promise<Response>(() => undefined);
    const page = fakeWakeups();
    const last = await finish(
      driveCustomSite(
        { kind: "submit", latDeg: -88.5, lonDeg: 45 },
        { signal: new AbortController().signal, onUpdate: () => undefined, fetchImpl: hanging, wakeups: page.wakeups, ceilingMs: 60_000, requestTimeoutMs: 1_000_000 },
      ),
    );
    expect(last).toMatchObject({ phase: "failed", problem: { kind: "timeout", message: TEXT.timeout } });
  });

  it("times out one request that never returns, and counts it as no answer", async () => {
    let n = 0;
    const slow: CustomFetch = (_url, init) => {
      if (init?.method === "POST") return Promise.resolve(json(200, { site_id: ID, status: "running", position_in_queue: 0 }));
      n += 1;
      return n === 1 ? new Promise<Response>(() => undefined) : Promise.resolve(json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null }));
    };
    const page = fakeWakeups();
    const last = await finish(
      driveCustomSite({ kind: "submit", latDeg: -88.5, lonDeg: 45 }, { signal: new AbortController().signal, onUpdate: () => undefined, fetchImpl: slow, wakeups: page.wakeups, requestTimeoutMs: 5000 }),
    );
    expect(last).toMatchObject({ phase: "ready" });
  });

  it("stops quietly when aborted, with no last update", async () => {
    const h = harness([
      json(200, { site_id: ID, status: "queued", position_in_queue: 1 }),
      () => {
        h.controller.abort();
        return json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null });
      },
    ]);
    expect(await finish(h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 }))).toBeNull();
    expect(h.updates.map((u) => u.phase)).toEqual(["queued"]);
  });

  it("does not poll while the page is hidden, and looks once at once when it is shown", async () => {
    const running = () => json(200, { site_id: ID, status: "running", site: null, error: null });
    const h = harness([json(200, { site_id: ID, status: "running", position_in_queue: 0 }), running(), running(), json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null })]);
    const job = h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 });
    await vi.advanceTimersByTimeAsync(2100);
    expect(h.calls).toHaveLength(2);
    h.page.hide();
    await vi.advanceTimersByTimeAsync(2100);
    const whileHidden = h.calls.length;
    await vi.advanceTimersByTimeAsync(60_000);
    expect(h.calls.length).toBe(whileHidden);
    h.page.show();
    await vi.advanceTimersByTimeAsync(10);
    expect(h.calls.length).toBe(whileHidden + 1);
    expect(await finish(job)).toMatchObject({ phase: "ready" });
    expect(h.posts()).toBe(1);
  });

  it("looks again at once when the network comes back, with GET", async () => {
    const h = harness([json(200, { site_id: ID, status: "running", position_in_queue: 0 }), json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null })]);
    const job = h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 });
    await vi.advanceTimersByTimeAsync(100);
    h.page.online();
    await vi.advanceTimersByTimeAsync(10);
    expect(await finish(job)).toMatchObject({ phase: "ready" });
    expect(h.calls.map((c) => c.init?.method ?? "GET")).toEqual(["POST", "GET"]);
    expect(h.page.listeners.size).toBe(0);
  });

  describe("an id from a link: GET only", () => {
    it("loads a site the server already has, with one request", async () => {
      const h = harness([json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null })]);
      expect(await finish(h.run({ kind: "check", siteId: ID }))).toMatchObject({ phase: "ready" });
      expect(h.calls).toHaveLength(1);
      expect(h.posts()).toBe(0);
    });

    it("never starts a job for an unknown id", async () => {
      const h = harness([json(404, { message: "Custom site is not ready. Start it with POST /api/sites/custom." })]);
      expect(await finish(h.run({ kind: "check", siteId: ID }))).toMatchObject({ phase: "not_computed", siteId: ID });
      expect(h.posts()).toBe(0);
    });

    it("follows a queued job, and shows a failed one, without a POST", async () => {
      const queued = harness([
        json(200, { site_id: ID, status: "queued", site: null, error: null }),
        json(200, { site_id: ID, status: "queued", site: null, error: null }),
        json(200, { site_id: ID, status: "failed", site: null, error: { code: "computation_failed", message: "Broke." } }),
      ]);
      expect(await finish(queued.run({ kind: "check", siteId: ID }))).toMatchObject({ phase: "failed" });
      expect(queued.posts()).toBe(0);
      const failed = harness([json(200, { site_id: ID, status: "failed", site: null, error: { code: "computation_failed", message: "Broke." } })]);
      expect(await finish(failed.run({ kind: "check", siteId: ID }))).toMatchObject({ phase: "failed", problem: { message: "Broke." } });
      expect(failed.posts()).toBe(0);
    });

    it("says so when the server is offline or answers 503", async () => {
      const offline = harness([new TypeError("down")]);
      expect(await finish(offline.run({ kind: "check", siteId: ID }))).toMatchObject({ phase: "failed", problem: { kind: "offline" } });
      const noMaps = harness([json(503, { message: TEXT.mapsMissing })]);
      expect(await finish(noMaps.run({ kind: "check", siteId: ID }))).toMatchObject({ phase: "failed", problem: { message: TEXT.mapsMissing } });
    });

    it("refuses a status answer about another id", async () => {
      const h = harness([json(200, { site_id: "c_-10.0000_20.0000", status: "ready", site: siteEntry({ id: "c_-10.0000_20.0000", lat_deg: -10, lon_deg: 20 }), error: null })]);
      expect(await finish(h.run({ kind: "check", siteId: ID }))).toMatchObject({ phase: "failed", problem: { message: TEXT.otherPlace } });
    });
  });
});
