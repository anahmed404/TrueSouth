/**
 * The custom-site client: `POST /api/sites/custom`, `GET /api/sites/custom/{id}` and
 * `GET /api/health`, as documented in docs/data-contracts.md ("API messages") and
 * docs/architecture.md ("The API").
 *
 * Every answer is read defensively. A server body is never shown as it came: only a short
 * plain `message` string from it, and each field's `message`, and otherwise our own words.
 * No request is made until a caller asks for one.
 */

import type { Site } from "../contracts/generated.ts";
import { isRecord, parseSites } from "./parse.ts";
import { isCustomSiteId } from "./paths.ts";

export type CustomFetch = (url: string, init?: RequestInit) => Promise<Response>;

export function defaultCustomFetch(url: string, init?: RequestInit): Promise<Response> {
  return fetch(url, init);
}

export const customApi = {
  submit: "/api/sites/custom",
  status: (siteId: string) => `/api/sites/custom/${encodeURIComponent(siteId)}`,
  health: "/api/health",
} as const;

/** Why a request did not give a usable answer. */
export type ProblemKind =
  /** No answer: the network failed, or something other than the API answered. */
  | "offline"
  /** This server cannot compute custom sites (an older server, or no terrain maps). */
  | "unavailable"
  /** Too many new jobs from this client this hour (429 with Retry-After). */
  | "rate_limited"
  /** The server's queue is full (429 without Retry-After). */
  | "queue_full"
  /** The server's custom-site storage is full (507, or 503 saying so). */
  | "storage_full"
  /** The request itself was refused (413, 422). */
  | "refused"
  /** The job ran and failed. */
  | "failed"
  /** The server no longer knows a job it was running (it may have restarted). */
  | "lost"
  /** Still not ready after the waiting ceiling. */
  | "timeout"
  /** An answer we could not read. */
  | "unreadable"
  /** Any other server error. */
  | "server_error";

export type FieldMessage = { field: string; message: string };

export type Problem = {
  kind: ProblemKind;
  /** One plain sentence for the user. */
  message: string;
  /** Messages for single form fields, from a 422 answer. */
  fields: FieldMessage[];
  /** Seconds from the answer until a new start is allowed, when the server said. */
  retryAfterS: number | null;
};

export type JobStatus = "queued" | "running" | "ready" | "failed";

export type SubmitReply =
  | { ok: true; siteId: string; status: JobStatus; position: number | null }
  | ({ ok: false } & Problem);

export type StatusReply =
  | { ok: true; siteId: string; status: JobStatus; site: Site | null; failure: string | null }
  | { ok: false; unknown: true }
  | ({ ok: false; unknown?: false } & Problem);

export type Availability = "available" | "not_available" | "offline";

export const TEXT = {
  offline: "The TrueSouth server is not answering, so custom sites cannot be computed right now.",
  unavailable: "Custom sites are not available on this server.",
  mapsMissing: "Custom sites need the terrain maps, which are not installed on this server.",
  storageFull: "This server's storage for custom sites is full.",
  rateLimited: "This server allows 6 new custom sites an hour from one computer.",
  queueFull: "The server's queue for custom sites is full. Try again in a few minutes.",
  refused: "The server refused these coordinates.",
  tooLarge: "The request was too large for the server.",
  failed: "The server could not compute this site.",
  lost: "The server no longer has this job. It may have restarted.",
  timeout: "Still not ready after 15 minutes. The server may be busy.",
  unreadable: "The server sent an answer TrueSouth could not read.",
  serverError: "The server had a problem with this request.",
} as const;

const MAX_MESSAGE = 240;

/** A server's plain sentence, if it is one: a short string with no markup. */
function plainMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();
  if (text.length === 0 || text.length > MAX_MESSAGE || /[<>{}]/.test(text)) return null;
  return text;
}

function problem(kind: ProblemKind, message: string, extra: Partial<Problem> = {}): Problem {
  return { kind, message, fields: [], retryAfterS: null, ...extra };
}

function isJson(response: Response): boolean {
  return (response.headers.get("content-type") ?? "").toLowerCase().includes("json");
}

async function readJson(response: Response): Promise<{ ok: true; value: unknown } | { ok: false }> {
  try {
    return { ok: true, value: await response.json() };
  } catch {
    return { ok: false };
  }
}

/** `Retry-After`: whole seconds, or an HTTP date. */
export function parseRetryAfter(raw: string | null, nowMs: number = Date.now()): number | null {
  if (raw === null) return null;
  const text = raw.trim();
  if (/^\d+$/.test(text)) return Number(text);
  const date = Date.parse(text);
  if (Number.isNaN(date)) return null;
  return Math.max(0, Math.ceil((date - nowMs) / 1000));
}

/** The documented error body: `{ message, fields? }`. Older servers send `{ message }`, or FastAPI's `{ detail }`. */
function fieldMessages(body: unknown): FieldMessage[] {
  if (!isRecord(body)) return [];
  const out: FieldMessage[] = [];
  if (Array.isArray(body.fields)) {
    for (const item of body.fields) {
      if (!isRecord(item) || typeof item.field !== "string") continue;
      const message = plainMessage(item.message);
      if (message) out.push({ field: item.field, message });
    }
  } else if (Array.isArray(body.detail)) {
    // FastAPI's own 422: name the field, in our words; its text is not shown.
    for (const item of body.detail) {
      if (!isRecord(item) || !Array.isArray(item.loc)) continue;
      const field = item.loc[item.loc.length - 1];
      if (field === "lat_deg") out.push({ field, message: "The server refused this latitude." });
      else if (field === "lon_deg") out.push({ field, message: "The server refused this longitude." });
      else if (field === "name") out.push({ field, message: "The server refused this name." });
    }
  }
  return out;
}

/** Turns a failed HTTP answer into a problem, whatever its body. */
async function problemFrom(response: Response, nowMs: number, route: "submit" | "status" | "health"): Promise<Problem> {
  const json = isJson(response) ? await readJson(response) : { ok: false as const };
  const body = json.ok ? json.value : null;
  const said = isRecord(body) ? plainMessage(body.message) ?? (isRecord(body.error) ? plainMessage(body.error.message) : null) : null;
  const status = response.status;

  // Something other than the API answered: Vite's proxy with no API, or a gateway.
  if (!json.ok && status >= 500) return problem("offline", TEXT.offline);
  if (status === 501) return problem("unavailable", TEXT.unavailable);
  if (status === 404 && route === "submit") return problem("unavailable", TEXT.unavailable);
  if (status === 413) return problem("refused", said ?? TEXT.tooLarge);
  if (status === 422 || status === 400) return problem("refused", said ?? TEXT.refused, { fields: fieldMessages(body) });
  const retry = parseRetryAfter(response.headers.get("retry-after"), nowMs);
  if (status === 429) {
    // A full queue says so (and sends Retry-After: 1); the hourly limit sends the wait.
    if (said ? /queue/i.test(said) : retry === null || retry <= 5) return problem("queue_full", said ?? TEXT.queueFull, { retryAfterS: retry });
    return problem("rate_limited", said ?? TEXT.rateLimited, { retryAfterS: retry });
  }
  if (status === 507) return problem("storage_full", said ?? TEXT.storageFull);
  if (status === 503) {
    if (said && /storage/i.test(said)) return problem("storage_full", said);
    // No terrain maps, no ephemeris, too many clients, or shutting down: the server says which.
    return problem("unavailable", said ?? TEXT.mapsMissing, { retryAfterS: retry });
  }
  if (!json.ok && status >= 400) return problem("unreadable", TEXT.unreadable);
  return problem("server_error", said ?? TEXT.serverError);
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException ? error.name === "AbortError" : isRecord(error) && error.name === "AbortError";
}

async function send(fetchImpl: CustomFetch, url: string, init: RequestInit): Promise<Response | Problem> {
  try {
    return await fetchImpl(url, init);
  } catch (error) {
    if (isAbort(error)) throw error;
    return problem("offline", TEXT.offline);
  }
}

function isProblem(value: Response | Problem): value is Problem {
  return !(value instanceof Response) && typeof (value as Problem).kind === "string";
}

const STATUSES: readonly JobStatus[] = ["queued", "running", "ready", "failed"];

function asStatus(value: unknown): JobStatus | null {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value) ? (value as JobStatus) : null;
}

/** Ask the server to compute a site, or find the one it has. Numbers go as JSON numbers. */
export async function requestCustomSite(
  latDeg: number,
  lonDeg: number,
  name?: string | null,
  options: { fetchImpl?: CustomFetch; signal?: AbortSignal; nowMs?: number } = {},
): Promise<SubmitReply> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  if (!Number.isFinite(latDeg) || !Number.isFinite(lonDeg)) {
    return { ok: false, ...problem("refused", TEXT.refused) };
  }
  const body: { lat_deg: number; lon_deg: number; name?: string } = { lat_deg: latDeg, lon_deg: lonDeg };
  const trimmed = name?.trim();
  if (trimmed) body.name = trimmed;
  const response = await send(fetchImpl, customApi.submit, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal: options.signal,
  });
  if (isProblem(response)) return { ok: false, ...response };
  if (!response.ok) return { ok: false, ...(await problemFrom(response, options.nowMs ?? Date.now(), "submit")) };
  const json = await readJson(response);
  if (!json.ok || !isRecord(json.value)) return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  const value = json.value;
  const status = asStatus(value.status);
  if (typeof value.site_id !== "string" || !isCustomSiteId(value.site_id) || status === null) {
    return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  }
  const position = typeof value.position_in_queue === "number" && Number.isInteger(value.position_in_queue) && value.position_in_queue > 0
    ? value.position_in_queue
    : null;
  return { ok: true, siteId: value.site_id, status, position: status === "queued" ? position : null };
}

/** One `sites.json`-shaped entry from a status answer, checked as carefully as the catalog. */
export function parseCustomSite(value: unknown, siteId: string): Site | null {
  if (!isRecord(value)) return null;
  try {
    const [site] = parseSites([value]);
    if (!site || site.id !== siteId) return null;
    if (typeof site.name !== "string" || !Number.isFinite(site.lat_deg) || !Number.isFinite(site.lon_deg)) return null;
    if (!["core80", "wide240", "sphere"].includes(site.terrain_tier)) return null;
    if (site.elevation_m !== null && !Number.isFinite(site.elevation_m)) return null;
    if (site.slope !== null && (!isRecord(site.slope) || !Number.isFinite(site.slope.deg))) return null;
    return {
      ...site,
      name: site.name.trim() || "Custom site",
      quickmap_url: typeof site.quickmap_url === "string" ? site.quickmap_url : "",
      moontrek_url: typeof site.moontrek_url === "string" ? site.moontrek_url : "",
      has_closeup: false,
      // A custom site is never a variant or a sunlit-peak entry, whatever the entry says.
      variant_of: null,
      offset_m: null,
      nearby_sun: null,
    };
  } catch {
    return null;
  }
}

/** Ask where a job is. A 404 means the server does not know the id (`unknown`). */
export async function customSiteStatus(
  siteId: string,
  options: { fetchImpl?: CustomFetch; signal?: AbortSignal; nowMs?: number } = {},
): Promise<StatusReply> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  const response = await send(fetchImpl, customApi.status(siteId), {
    headers: { Accept: "application/json" },
    signal: options.signal,
  });
  if (isProblem(response)) return { ok: false, ...response };
  if (response.status === 404 && isJson(response)) return { ok: false, unknown: true };
  if (!response.ok) return { ok: false, ...(await problemFrom(response, options.nowMs ?? Date.now(), "status")) };
  const json = await readJson(response);
  if (!json.ok || !isRecord(json.value)) return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  const value = json.value;
  const status = asStatus(value.status);
  if (status === null || value.site_id !== siteId) return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  if (status === "ready") {
    const site = parseCustomSite(value.site, siteId);
    if (!site) return { ok: false, ...problem("unreadable", TEXT.unreadable) };
    return { ok: true, siteId, status, site, failure: null };
  }
  if (status === "failed") {
    const error = isRecord(value.error) ? plainMessage(value.error.message) : null;
    return { ok: true, siteId, status, site: null, failure: error ?? TEXT.failed };
  }
  return { ok: true, siteId, status, site: null, failure: null };
}

/** Whether this server computes custom sites. A server that is not there counts as `offline`. */
export async function customSitesAvailability(options: { fetchImpl?: CustomFetch; signal?: AbortSignal } = {}): Promise<Availability> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  const response = await send(fetchImpl, customApi.health, { headers: { Accept: "application/json" }, signal: options.signal });
  if (isProblem(response)) return "offline";
  if (!isJson(response)) return "offline";
  const json = await readJson(response);
  if (!json.ok || !isRecord(json.value)) return "offline";
  if (!response.ok) return "not_available";
  return json.value.custom_sites === "available" ? "available" : "not_available";
}

// ── Driving one job ─────────────────────────────────────────────────────────

export type JobPhase = "queued" | "running" | "ready" | "failed" | "not_computed";

export type JobSnapshot = {
  /** The server's id, once it has given one. */
  siteId: string | null;
  phase: JobPhase;
  /** Place in the server's queue, when queued and known. */
  position: number | null;
  site: Site | null;
  problem: Problem | null;
};

export type JobStart =
  | { kind: "submit"; latDeg: number; lonDeg: number; name?: string | null }
  /** Look up an id from a link. Never starts a job. */
  | { kind: "check"; siteId: string };

export type DriveOptions = {
  signal: AbortSignal;
  onUpdate: (snapshot: JobSnapshot) => void;
  fetchImpl?: CustomFetch;
  sleep?: (ms: number, signal: AbortSignal) => Promise<void>;
  now?: () => number;
  /** Between two status checks. */
  intervalMs?: number;
  /** Stop waiting after this long, with a plain message. */
  ceilingMs?: number;
  /** While queued, refresh the queue position every this many checks. */
  positionEvery?: number;
  /** Give up after this many answers in a row that were not usable. */
  maxErrors?: number;
};

export const POLL_INTERVAL_MS = 2000;
export const POLL_CEILING_MS = 15 * 60 * 1000;

export function abortableSleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    const timer = setTimeout(() => {
      signal.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new DOMException("Aborted", "AbortError"));
    };
    signal.addEventListener("abort", onAbort, { once: true });
  });
}

/** The coordinates written in a custom id. Used only to recognise an id from a link. */
export function coordinatesOfId(siteId: string): { latDeg: number; lonDeg: number } | null {
  if (!isCustomSiteId(siteId)) return null;
  const [, lat, lon] = siteId.split("_");
  const latDeg = Number(lat);
  const lonDeg = Number(lon);
  return Number.isFinite(latDeg) && Number.isFinite(lonDeg) ? { latDeg, lonDeg } : null;
}

/**
 * Drives one job from a request (or a link's id) to ready or failed, checking about every
 * two seconds. It stops on ready or failed, when `signal` aborts (without a last update),
 * after three unusable answers in a row, and after the ceiling. Resolves to the last state.
 */
export async function driveCustomSite(start: JobStart, options: DriveOptions): Promise<JobSnapshot | null> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  const sleep = options.sleep ?? abortableSleep;
  const now = options.now ?? Date.now;
  const interval = options.intervalMs ?? POLL_INTERVAL_MS;
  const ceiling = options.ceilingMs ?? POLL_CEILING_MS;
  const positionEvery = options.positionEvery ?? 5;
  const maxErrors = options.maxErrors ?? 3;
  const { signal } = options;

  const emit = (snapshot: JobSnapshot): JobSnapshot | null => {
    if (signal.aborted) return null;
    options.onUpdate(snapshot);
    return snapshot;
  };
  const fail = (siteId: string | null, reason: Problem) =>
    emit({ siteId, phase: "failed", position: null, site: null, problem: reason });

  try {
    let siteId: string;
    let coords: { latDeg: number; lonDeg: number } | null;
    let name: string | null = null;
    let position: number | null = null;

    if (start.kind === "submit") {
      const reply = await requestCustomSite(start.latDeg, start.lonDeg, start.name, { fetchImpl, signal, nowMs: now() });
      if (!reply.ok) return fail(null, reply);
      siteId = reply.siteId;
      coords = { latDeg: start.latDeg, lonDeg: start.lonDeg };
      name = start.name ?? null;
      position = reply.position;
      if (reply.status === "failed") {
        return fail(siteId, problem("failed", TEXT.failed));
      }
      if (reply.status !== "ready") {
        if (!emit({ siteId, phase: reply.status, position, site: null, problem: null })) return null;
      }
      if (reply.status === "ready") {
        // The submit answer has no site entry: ask for it once.
        const status = await customSiteStatus(siteId, { fetchImpl, signal, nowMs: now() });
        if (status.ok && status.status === "ready") {
          return emit({ siteId, phase: "ready", position: null, site: status.site, problem: null });
        }
        // Not ready after all (another tab, a restart): fall through to waiting.
        if (!status.ok && !status.unknown) return fail(siteId, status);
      }
    } else {
      siteId = start.siteId;
      coords = coordinatesOfId(siteId);
      const status = await customSiteStatus(siteId, { fetchImpl, signal, nowMs: now() });
      if (!status.ok) {
        if (status.unknown) return emit({ siteId, phase: "not_computed", position: null, site: null, problem: null });
        return fail(siteId, status);
      }
      if (status.status === "ready") return emit({ siteId, phase: "ready", position: null, site: status.site, problem: null });
      if (status.status === "failed") return fail(siteId, problem("failed", status.failure ?? TEXT.failed));
      if (!emit({ siteId, phase: status.status, position: null, site: null, problem: null })) return null;
    }

    const started = now();
    let errors = 0;
    let tick = 0;
    for (;;) {
      if (now() - started >= ceiling) return fail(siteId, problem("timeout", TEXT.timeout));
      await sleep(interval, signal);
      tick += 1;
      const status = await customSiteStatus(siteId, { fetchImpl, signal, nowMs: now() });
      if (!status.ok) {
        if (status.unknown) return fail(siteId, problem("lost", TEXT.lost));
        errors += 1;
        if (errors >= maxErrors) return fail(siteId, status);
        continue;
      }
      errors = 0;
      if (status.status === "ready") return emit({ siteId, phase: "ready", position: null, site: status.site, problem: null });
      if (status.status === "failed") return fail(siteId, problem("failed", status.failure ?? TEXT.failed));
      if (status.status === "queued" && coords && tick % positionEvery === 0) {
        // The status answer has no queue position; asking again for a queued job costs
        // nothing on the server (docs/architecture.md) and returns it.
        const again = await requestCustomSite(coords.latDeg, coords.lonDeg, name, { fetchImpl, signal, nowMs: now() });
        if (again.ok && again.siteId === siteId && again.status === "queued") position = again.position;
      }
      if (status.status === "running") position = null;
      if (!emit({ siteId, phase: status.status, position, site: null, problem: null })) return null;
    }
  } catch (error) {
    if (isAbort(error) || signal.aborted) return null;
    throw error;
  }
}
