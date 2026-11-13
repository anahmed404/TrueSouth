import { describe, expect, it } from "vitest";
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

  it("uses the id the server returns, even when it differs from the typed point", async () => {
    const other = "c_-88.5001_45.0000";
    const { fetchImpl } = scripted([json(200, { site_id: other, status: "ready", position_in_queue: 0 })]);
    expect(await requestCustomSite(-88.50005, 45, null, { fetchImpl })).toMatchObject({ ok: true, siteId: other });
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

  it("reads Retry-After as seconds or a date", async () => {
    const { fetchImpl } = scripted([json(429, { message: "Slow down." }, { "retry-after": "90" })]);
    expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ kind: "rate_limited", retryAfterS: 90 });
    expect(parseRetryAfter("Wed, 01 Jan 2031 00:01:00 GMT", Date.parse("2031-01-01T00:00:00Z"))).toBe(60);
    expect(parseRetryAfter("soon")).toBeNull();
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
      expect(await requestCustomSite(-88.5, 45, null, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable", message: TEXT.unreadable });
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
      failure: "The custom site could not be computed. Please try again.",
    });
    expect(calls[0]?.url).toBe(`/api/sites/custom/${ID}`);
  });

  it("says unknown for a 404, and offline when nothing answers", async () => {
    const { fetchImpl } = scripted([json(404, { message: "Custom site is not ready. Start it with POST /api/sites/custom." }), new TypeError("down"), text(504, "")]);
    expect(await customSiteStatus(ID, { fetchImpl })).toEqual({ ok: false, unknown: true });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "offline" });
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "offline" });
  });

  it("refuses a ready answer whose site cannot be read, or belongs to another id", async () => {
    for (const site of [null, siteEntry({ id: "c_-80.0000_0.0000" }), siteEntry({ lat_deg: "x" }), siteEntry({ terrain_tier: "moon" }), siteEntry({ slope: { deg: "steep" } })]) {
      const { fetchImpl } = scripted([json(200, { site_id: ID, status: "ready", site, error: null })]);
      expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable" });
    }
    const { fetchImpl } = scripted([json(200, { site_id: "c_-1.0000_1.0000", status: "queued" })]);
    expect(await customSiteStatus(ID, { fetchImpl })).toMatchObject({ ok: false, kind: "unreadable" });
  });

  it("keeps a sphere site's nulls, and drops variant fields a custom site cannot have", () => {
    const site = parseCustomSite(siteEntry({ terrain_tier: "sphere", slope: null, elevation_m: null, name: "  " }), ID);
    expect(site).toMatchObject({ terrain_tier: "sphere", slope: null, elevation_m: null, name: "Custom site", variant_of: null, nearby_sun: null, has_closeup: false });
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
  it("recognises a link's id and nothing else", () => {
    expect(coordinatesOfId(ID)).toEqual({ latDeg: -88.5, lonDeg: 45 });
    expect(coordinatesOfId("connecting_ridge")).toBeNull();
    expect(coordinatesOfId("c_-88.5_45")).toBeNull();
  });
});

describe("driveCustomSite", () => {
  function harness(replies: Parameters<typeof scripted>[0], options: { ceilingMs?: number } = {}) {
    const { fetchImpl, calls } = scripted(replies);
    let clock = 0;
    const updates: JobSnapshot[] = [];
    const controller = new AbortController();
    const run = (start: Parameters<typeof driveCustomSite>[0]) =>
      driveCustomSite(start, {
        signal: controller.signal,
        onUpdate: (snapshot) => updates.push(snapshot),
        fetchImpl,
        now: () => clock,
        sleep: async (ms) => {
          clock += ms;
        },
        ceilingMs: options.ceilingMs,
      });
    return { run, updates, calls, controller };
  }

  it("polls from queued through running to ready, about every two seconds", async () => {
    const h = harness([
      json(200, { site_id: ID, status: "queued", position_in_queue: 3 }),
      json(200, { site_id: ID, status: "queued", site: null, error: null }),
      json(200, { site_id: ID, status: "running", site: null, error: null }),
      json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null }),
    ]);
    const last = await h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 });
    expect(h.updates.map((u) => u.phase)).toEqual(["queued", "queued", "running", "ready"]);
    expect(h.updates[0]?.position).toBe(3);
    expect(h.updates[2]?.position).toBeNull();
    expect(last).toMatchObject({ phase: "ready", siteId: ID, site: { name: "My ridge" } });
    expect(h.calls.map((c) => c.init?.method ?? "GET")).toEqual(["POST", "GET", "GET", "GET"]);
  });

  it("refreshes the queue position while queued", async () => {
    const queued = () => json(200, { site_id: ID, status: "queued", site: null, error: null });
    const h = harness([
      json(200, { site_id: ID, status: "queued", position_in_queue: 4 }),
      queued(), queued(), queued(), queued(), queued(),
      json(200, { site_id: ID, status: "queued", position_in_queue: 2 }),
      json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null }),
    ]);
    await h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 });
    expect(h.updates.map((u) => u.position)).toEqual([4, 4, 4, 4, 4, 2, null]);
  });

  it("asks once for the site of a point the server already has", async () => {
    const h = harness([
      json(200, { site_id: ID, status: "ready", position_in_queue: 0 }),
      json(200, { site_id: ID, status: "ready", site: siteEntry({ terrain_tier: "sphere", slope: null }), error: null }),
    ]);
    const last = await h.run({ kind: "submit", latDeg: 10, lonDeg: 20 });
    expect(h.updates).toHaveLength(1);
    expect(last).toMatchObject({ phase: "ready", site: { terrain_tier: "sphere" } });
  });

  it("stops on a failed job with the server's message", async () => {
    const h = harness([
      json(200, { site_id: ID, status: "running", position_in_queue: 0 }),
      json(200, { site_id: ID, status: "failed", site: null, error: { code: "computation_failed", message: "The custom site could not be computed. Please try again." } }),
    ]);
    const last = await h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 });
    expect(last).toMatchObject({ phase: "failed", problem: { kind: "failed", message: "The custom site could not be computed. Please try again." } });
  });

  it("fails a refused start without an id", async () => {
    const h = harness([json(429, { message: "You may start 6 custom sites per hour." }, { "retry-after": "600" })]);
    const last = await h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 });
    expect(last).toMatchObject({ siteId: null, phase: "failed", problem: { kind: "rate_limited", retryAfterS: 600 } });
  });

  it("says the job was lost when the server forgets it, and gives up after three bad answers", async () => {
    const lost = harness([json(200, { site_id: ID, status: "queued", position_in_queue: 1 }), json(404, { message: "gone" })]);
    expect(await lost.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 })).toMatchObject({ phase: "failed", problem: { kind: "lost", message: TEXT.lost } });
    const flaky = harness([json(200, { site_id: ID, status: "running", position_in_queue: 0 }), new TypeError("x"), new TypeError("x"), new TypeError("x")]);
    expect(await flaky.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 })).toMatchObject({ phase: "failed", problem: { kind: "offline" } });
  });

  it("rides out one bad answer", async () => {
    const h = harness([
      json(200, { site_id: ID, status: "running", position_in_queue: 0 }),
      text(502, ""),
      json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null }),
    ]);
    expect(await h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 })).toMatchObject({ phase: "ready" });
  });

  it("stops after the ceiling with a plain message", async () => {
    const running = () => json(200, { site_id: ID, status: "running", site: null, error: null });
    const h = harness([json(200, { site_id: ID, status: "running", position_in_queue: 0 }), running(), running(), running()], { ceilingMs: 6000 });
    expect(await h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 })).toMatchObject({ phase: "failed", problem: { kind: "timeout", message: TEXT.timeout } });
    expect(h.calls).toHaveLength(4);
  });

  it("stops quietly when aborted", async () => {
    const h = harness([json(200, { site_id: ID, status: "queued", position_in_queue: 1 }), (call) => {
      h.controller.abort();
      return json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null, url: call.url });
    }]);
    expect(await h.run({ kind: "submit", latDeg: -88.5, lonDeg: 45 })).toBeNull();
    expect(h.updates.map((u) => u.phase)).toEqual(["queued"]);
  });

  describe("an id from a link", () => {
    it("loads a site the server already has, with one request", async () => {
      const h = harness([json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null })]);
      expect(await h.run({ kind: "check", siteId: ID })).toMatchObject({ phase: "ready" });
      expect(h.calls).toHaveLength(1);
      expect(h.calls[0]?.init?.method).toBeUndefined();
    });

    it("never starts a job for an unknown id", async () => {
      const h = harness([json(404, { message: "Custom site is not ready. Start it with POST /api/sites/custom." })]);
      expect(await h.run({ kind: "check", siteId: ID })).toMatchObject({ phase: "not_computed", siteId: ID });
      expect(h.calls.every((c) => (c.init?.method ?? "GET") === "GET")).toBe(true);
    });

    it("follows a job that is already running", async () => {
      const h = harness([json(200, { site_id: ID, status: "running", site: null, error: null }), json(200, { site_id: ID, status: "ready", site: siteEntry(), error: null })]);
      expect(await h.run({ kind: "check", siteId: ID })).toMatchObject({ phase: "ready" });
      expect(h.calls.every((c) => (c.init?.method ?? "GET") === "GET")).toBe(true);
    });

    it("says so when the server is offline or answers 503", async () => {
      const offline = harness([new TypeError("down")]);
      expect(await offline.run({ kind: "check", siteId: ID })).toMatchObject({ phase: "failed", problem: { kind: "offline" } });
      const noMaps = harness([json(503, { message: TEXT.mapsMissing })]);
      expect(await noMaps.run({ kind: "check", siteId: ID })).toMatchObject({ phase: "failed", problem: { message: TEXT.mapsMissing } });
    });
  });
});
