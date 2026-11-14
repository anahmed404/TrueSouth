/**
 * The custom-site client: `POST /api/sites/custom`, `GET /api/sites/custom/{id}` and
 * `GET /api/health`, as documented in docs/data-contracts.md ("API messages", "Errors") and
 * docs/architecture.md ("The API").
 *
 * Rules:
 * - A POST is made only by `requestCustomSite`, which only a button press calls. Waiting,
 *   links, focus and reconnecting use GET.
 * - Every answer is read defensively, and an answer about another place is refused.
 * - A server body is never shown as it came: only a short plain `message` string from it,
 *   each field's `message`, and otherwise our own words.
 */

import type { Site } from "../contracts/generated.ts";
import { canonicalCustomId, cleanSiteName, idCoordinates, isCanonicalCustomId } from "./custom-site-id.ts";
import { isRecord } from "./parse.ts";

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
  /** No answer: the network failed, timed out, or something other than the API answered. */
  | "offline"
  /** This server cannot compute custom sites (an older server, no maps, no ephemeris, shutting down). */
  | "unavailable"
  /** Too many new jobs from this computer this hour (429). */
  | "rate_limited"
  /** The server's queue is full (429). */
  | "queue_full"
  /** The server's custom-site storage is full (507, or a job that failed for it). */
  | "storage_full"
  /** The request itself was refused (413, 422). */
  | "refused"
  /** The job ran and failed. */
  | "failed"
  /** The server no longer knows a job it was running (it may have restarted). */
  | "lost"
  /** Still not ready after the waiting ceiling. */
  | "timeout"
  /** An answer we could not read, or one about another place. */
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
  /** Seconds until a new start is allowed, when the server said; clamped to 1 s to 1 h. */
  retryAfterS: number | null;
};

export type JobStatus = "queued" | "running" | "ready" | "failed";

export type SubmitReply =
  | { ok: true; siteId: string; status: JobStatus; position: number | null }
  | ({ ok: false } & Problem);

export type StatusReply =
  | { ok: true; siteId: string; status: JobStatus; site: Site | null; failure: Problem | null; position: number | null }
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
  unreadableSite: "The server's answer for this site could not be read.",
  otherPlace: "The server answered about a different place, so TrueSouth did not use it.",
  serverError: "The server had a problem with this request.",
} as const;

const MAX_MESSAGE = 240;
/** Each request gives up after this long. */
export const REQUEST_TIMEOUT_MS = 15_000;
/** `Retry-After` is kept between these bounds. */
export const RETRY_AFTER_MIN_S = 1;
export const RETRY_AFTER_MAX_S = 3600;

/** A server's plain sentence, if it is one: a short string with no markup or control text. */
function plainMessage(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.replace(/[\u0000-\u001f\u007f-\u009f؜‎‏‪-‮⁦-⁩]/g, "").trim();
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
  } catch (error) {
    if (isAbort(error)) throw error;
    return { ok: false };
  }
}

/**
 * `Retry-After` as whole seconds from now, kept between 1 s and 1 h: integer seconds or an
 * HTTP date. Negative, empty, fractional or unreadable values are null (no wait known).
 */
export function parseRetryAfter(raw: string | null, nowMs: number = Date.now()): number | null {
  if (raw === null) return null;
  const text = raw.trim();
  let seconds: number;
  if (/^\d{1,12}$/.test(text)) {
    seconds = Number(text);
  } else if (/^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/.test(text)) {
    const date = Date.parse(text);
    if (Number.isNaN(date)) return null;
    seconds = Math.ceil((date - nowMs) / 1000);
  } else {
    return null;
  }
  if (!Number.isFinite(seconds)) return null;
  return Math.min(RETRY_AFTER_MAX_S, Math.max(RETRY_AFTER_MIN_S, seconds));
}

const FIELDS = new Set(["lat_deg", "lon_deg", "name", "body"]);

/** The documented error body: `{ message, fields? }`. FastAPI's own `{ detail }` is read too. */
function fieldMessages(body: unknown): FieldMessage[] {
  if (!isRecord(body)) return [];
  const out: FieldMessage[] = [];
  if (Array.isArray(body.fields)) {
    for (const item of body.fields) {
      if (!isRecord(item) || typeof item.field !== "string" || !FIELDS.has(item.field)) continue;
      const message = plainMessage(item.message);
      if (message) out.push({ field: item.field, message });
    }
  } else if (Array.isArray(body.detail)) {
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
async function problemFrom(response: Response, nowMs: number, route: "submit" | "status"): Promise<Problem> {
  const json = isJson(response) ? await readJson(response) : { ok: false as const };
  const body = json.ok ? json.value : null;
  const said = isRecord(body) ? plainMessage(body.message) ?? (isRecord(body.error) ? plainMessage(body.error.message) : null) : null;
  const status = response.status;
  const retry = parseRetryAfter(response.headers.get("retry-after"), nowMs);

  // Something other than the API answered: Vite's proxy with no API, or a gateway.
  if (!json.ok && status >= 500) return problem("offline", TEXT.offline);
  if (status === 501) return problem("unavailable", TEXT.unavailable);
  if (status === 404 && route === "submit") return problem("unavailable", TEXT.unavailable);
  if (status === 413) return problem("refused", said ?? TEXT.tooLarge);
  if (status === 422 || status === 400) return problem("refused", said ?? TEXT.refused, { fields: fieldMessages(body) });
  if (status === 429) {
    // Both cases send Retry-After. Until the server sends a code, the message tells them apart.
    const queue = said ? /queue/i.test(said) : false;
    return queue
      ? problem("queue_full", said ?? TEXT.queueFull, { retryAfterS: retry })
      : problem("rate_limited", said ?? TEXT.rateLimited, { retryAfterS: retry });
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
  return isRecord(error) && (error as { name?: unknown }).name === "AbortError";
}

/**
 * One request with its own timeout, also ended by `signal`. A timeout counts as no answer;
 * an abort from `signal` is thrown on to the caller.
 */
async function send(fetchImpl: CustomFetch, url: string, init: RequestInit, signal: AbortSignal | undefined, timeoutMs: number): Promise<Response | Problem> {
  if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  const controller = new AbortController();
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, Math.max(1, timeoutMs));
  try {
    const response = await Promise.race([
      fetchImpl(url, { ...init, signal: controller.signal }),
      // A fetch that ignores its signal still ends here.
      new Promise<never>((_, reject) =>
        controller.signal.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true }),
      ),
    ]);
    return response;
  } catch (error) {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
    if (timedOut || !isAbort(error)) return problem("offline", TEXT.offline);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onAbort);
  }
}

function isProblem(value: Response | Problem): value is Problem {
  return !(value instanceof Response) && typeof (value as Problem).kind === "string";
}

const STATUSES: readonly JobStatus[] = ["queued", "running", "ready", "failed"];

function asStatus(value: unknown): JobStatus | null {
  return typeof value === "string" && (STATUSES as readonly string[]).includes(value) ? (value as JobStatus) : null;
}

function asPosition(value: unknown): number | null {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value < 1_000_000 ? value : null;
}

type RequestOptions = { fetchImpl?: CustomFetch; signal?: AbortSignal; nowMs?: number; timeoutMs?: number };

/**
 * Ask the server to compute a site, or find the one it has. Call this only from a button
 * press. Numbers go as JSON numbers. The answer's id must be the one these coordinates make.
 */
export async function requestCustomSite(latDeg: number, lonDeg: number, name?: string | null, options: RequestOptions = {}): Promise<SubmitReply> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  const expected = canonicalCustomId(latDeg, lonDeg);
  if (expected === null) return { ok: false, ...problem("refused", TEXT.refused) };
  const body: { lat_deg: number; lon_deg: number; name?: string } = { lat_deg: latDeg, lon_deg: lonDeg };
  const clean = cleanSiteName(name);
  if (clean) body.name = clean;
  const response = await send(
    fetchImpl,
    customApi.submit,
    { method: "POST", headers: { "Content-Type": "application/json", Accept: "application/json" }, body: JSON.stringify(body) },
    options.signal,
    options.timeoutMs ?? REQUEST_TIMEOUT_MS,
  );
  if (isProblem(response)) return { ok: false, ...response };
  if (!response.ok) return { ok: false, ...(await problemFrom(response, options.nowMs ?? Date.now(), "submit")) };
  const json = await readJson(response);
  if (!json.ok || !isRecord(json.value)) return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  const value = json.value;
  const status = asStatus(value.status);
  if (status === null || typeof value.site_id !== "string") return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  if (value.site_id !== expected) return { ok: false, ...problem("unreadable", TEXT.otherPlace) };
  return { ok: true, siteId: expected, status, position: status === "queued" ? asPosition(value.position_in_queue) : null };
}

// ── A ready site's entry ─────────────────────────────────────────────────────

const TIERS = new Set(["core80", "wide240", "sphere"]);

function finiteIn(value: unknown, min: number, max: number): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min && value <= max;
}

function safeUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  if (value === "") return "";
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/**
 * One `sites.json`-shaped entry from a status answer, checked field by field: every field the
 * app reads, its type, its range, and nulls only where the contract allows. The entry must
 * name the id that was asked for, at the same coordinates to four decimals. Anything else is
 * null: a failed row, never a half-drawn site.
 */
export function parseCustomSite(value: unknown, siteId: string): Site | null {
  if (!isRecord(value)) return null;
  if (value.id !== siteId) return null;
  if (!finiteIn(value.lat_deg, -90, 90) || !finiteIn(value.lon_deg, 0, 360) || value.lon_deg === 360) return null;
  if (canonicalCustomId(value.lat_deg, value.lon_deg) !== siteId) return null;
  if (typeof value.terrain_tier !== "string" || !TIERS.has(value.terrain_tier)) return null;
  if (value.elevation_m !== null && !finiteIn(value.elevation_m, -20_000, 20_000)) return null;
  let slope: Site["slope"] = null;
  if (value.slope !== null) {
    const s = value.slope;
    if (!isRecord(s) || !finiteIn(s.deg, 0, 90) || !finiteIn(s.baseline_m, 0.001, 1_000_000) || typeof s.source !== "string") return null;
    slope = { deg: s.deg, baseline_m: s.baseline_m, source: s.source.slice(0, 200) };
  }
  if (value.has_closeup !== undefined && typeof value.has_closeup !== "boolean") return null;
  if (value.name !== undefined && typeof value.name !== "string") return null;
  if (value.description !== undefined && typeof value.description !== "string") return null;
  if (value.outcome !== undefined && value.outcome !== null && typeof value.outcome !== "string") return null;
  // A custom site is never a variant or a sunlit-peak entry.
  for (const field of ["variant_of", "offset_m", "nearby_sun"] as const) {
    if (value[field] !== undefined && value[field] !== null) return null;
  }
  const quickmap = safeUrl(value.quickmap_url ?? "");
  const moontrek = safeUrl(value.moontrek_url ?? "");
  if (quickmap === null || moontrek === null) return null;
  if (value.terrain_tier === "sphere" && slope !== null) return null;
  return {
    id: siteId,
    name: cleanSiteName(value.name as string | undefined) ?? "Custom site",
    group: "contrast",
    lat_deg: value.lat_deg,
    lon_deg: value.lon_deg,
    terrain_tier: value.terrain_tier as Site["terrain_tier"],
    elevation_m: value.elevation_m as number | null,
    slope,
    has_closeup: false,
    description: "",
    source_url: "",
    outcome: null,
    quickmap_url: quickmap,
    moontrek_url: moontrek,
    variant_of: null,
    offset_m: null,
    nearby_sun: null,
  };
}

/** Ask where a job is. A 404 means the server does not know the id (`unknown`). Never a POST. */
export async function customSiteStatus(siteId: string, options: RequestOptions = {}): Promise<StatusReply> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  const response = await send(fetchImpl, customApi.status(siteId), { headers: { Accept: "application/json" } }, options.signal, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  if (isProblem(response)) return { ok: false, ...response };
  if (response.status === 404 && isJson(response)) return { ok: false, unknown: true };
  if (!response.ok) return { ok: false, ...(await problemFrom(response, options.nowMs ?? Date.now(), "status")) };
  const json = await readJson(response);
  if (!json.ok || !isRecord(json.value)) return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  const value = json.value;
  const status = asStatus(value.status);
  if (status === null) return { ok: false, ...problem("unreadable", TEXT.unreadable) };
  if (value.site_id !== siteId) return { ok: false, ...problem("unreadable", TEXT.otherPlace) };
  if (status === "ready") {
    const site = parseCustomSite(value.site, siteId);
    if (!site) return { ok: false, ...problem("unreadable", TEXT.unreadableSite) };
    return { ok: true, siteId, status, site, failure: null, position: null };
  }
  if (status === "failed") {
    const error = isRecord(value.error) ? value.error : null;
    const said = error ? plainMessage(error.message) : null;
    const kind: ProblemKind = error?.code === "storage_full" ? "storage_full" : "failed";
    return { ok: true, siteId, status, site: null, failure: problem(kind, said ?? (kind === "storage_full" ? TEXT.storageFull : TEXT.failed)), position: null };
  }
  // The status answer has no queue position today; a later server may add one.
  return { ok: true, siteId, status, site: null, failure: null, position: status === "queued" ? asPosition(value.position_in_queue) : null };
}

/** Whether this server computes custom sites. A server that is not there counts as `offline`. */
export async function customSitesAvailability(options: RequestOptions = {}): Promise<Availability> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  const response = await send(fetchImpl, customApi.health, { headers: { Accept: "application/json" } }, options.signal, options.timeoutMs ?? REQUEST_TIMEOUT_MS);
  if (isProblem(response)) return "offline";
  if (!isJson(response)) return "offline";
  const json = await readJson(response);
  if (!json.ok || !isRecord(json.value)) return "offline";
  if (!response.ok) return "not_available";
  return json.value.custom_sites === "available" ? "available" : "not_available";
}

// ── Waiting for one job ──────────────────────────────────────────────────────

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
  /** A button press: one POST, then GET. */
  | { kind: "submit"; latDeg: number; lonDeg: number; name?: string | null }
  /** An id from a link, a remount or a return to the page: GET only, never a job. */
  | { kind: "check"; siteId: string };

/** When to wait, and when to look again at once. Defaults to the page's own events. */
export type Wakeups = {
  hidden: () => boolean;
  /** Calls back when the page is shown again or the network comes back. Returns an unsubscribe. */
  onWake: (callback: () => void) => () => void;
};

export function pageWakeups(): Wakeups {
  const doc = typeof document === "undefined" ? null : document;
  const win = typeof window === "undefined" ? null : window;
  return {
    hidden: () => doc?.visibilityState === "hidden",
    onWake: (callback) => {
      const onVisible = () => {
        if (doc?.visibilityState !== "hidden") callback();
      };
      doc?.addEventListener("visibilitychange", onVisible);
      win?.addEventListener("online", callback);
      return () => {
        doc?.removeEventListener("visibilitychange", onVisible);
        win?.removeEventListener("online", callback);
      };
    },
  };
}

export type DriveOptions = {
  signal: AbortSignal;
  onUpdate: (snapshot: JobSnapshot) => void;
  fetchImpl?: CustomFetch;
  now?: () => number;
  /** Between two status checks while all is well. */
  intervalMs?: number;
  /** Stop waiting after this long, with a plain message. Ends any request still open. */
  ceilingMs?: number;
  /** Give up after this many unusable answers in a row. */
  maxErrors?: number;
  /** The longest wait between checks after errors. */
  maxBackoffMs?: number;
  requestTimeoutMs?: number;
  wakeups?: Wakeups;
};

export const POLL_INTERVAL_MS = 2000;
export const POLL_CEILING_MS = 15 * 60 * 1000;
export const MAX_BACKOFF_MS = 30_000;

/** Waits `ms`, or less if woken; never while the page is hidden; ends on abort or the deadline. */
function pause(ms: number, signal: AbortSignal, wakeups: Wakeups, deadline: number, now: () => number): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(new DOMException("Aborted", "AbortError"));
      return;
    }
    let timer: ReturnType<typeof setTimeout> | null = null;
    let wakeTimer: ReturnType<typeof setTimeout> | null = null;
    const finish = (error?: Error) => {
      if (timer) clearTimeout(timer);
      if (wakeTimer) clearTimeout(wakeTimer);
      unsubscribe();
      signal.removeEventListener("abort", onAbort);
      if (error) reject(error);
      else resolve();
    };
    const onAbort = () => finish(new DOMException("Aborted", "AbortError"));
    const arm = () => {
      if (timer) clearTimeout(timer);
      // While hidden, only the deadline ends the wait; a wake event resumes it.
      const left = Math.max(0, deadline - now());
      const wait = wakeups.hidden() ? left : Math.min(ms, left);
      timer = setTimeout(() => {
        if (wakeups.hidden() && now() < deadline) arm();
        else finish();
      }, wait);
    };
    // A wake (page shown, network back) looks again at once: one GET.
    const unsubscribe = wakeups.onWake(() => {
      if (wakeTimer) return;
      wakeTimer = setTimeout(() => finish(), 0);
    });
    signal.addEventListener("abort", onAbort, { once: true });
    arm();
  });
}

/**
 * Drives one job to ready or failed. A submit makes exactly one POST; everything after it,
 * and every check, is GET. It stops on ready, failed, abort (with no last update), after
 * `maxErrors` unusable answers in a row (waiting longer after each), and at the ceiling,
 * which also ends a request still open.
 */
export async function driveCustomSite(start: JobStart, options: DriveOptions): Promise<JobSnapshot | null> {
  const fetchImpl = options.fetchImpl ?? defaultCustomFetch;
  const now = options.now ?? Date.now;
  const interval = options.intervalMs ?? POLL_INTERVAL_MS;
  const ceiling = options.ceilingMs ?? POLL_CEILING_MS;
  const maxErrors = options.maxErrors ?? 5;
  const maxBackoff = options.maxBackoffMs ?? MAX_BACKOFF_MS;
  const requestTimeout = options.requestTimeoutMs ?? REQUEST_TIMEOUT_MS;
  const wakeups = options.wakeups ?? pageWakeups();
  const deadline = now() + ceiling;

  // The ceiling ends everything, including a request that never returns.
  const local = new AbortController();
  const onOuterAbort = () => local.abort();
  options.signal.addEventListener("abort", onOuterAbort, { once: true });
  const ceilingTimer = setTimeout(() => local.abort(), Math.max(1, ceiling));
  const signal = local.signal;
  const timeLeft = () => Math.max(1, Math.min(requestTimeout, deadline - now()));
  const request = { fetchImpl, signal, get nowMs() { return now(); } };

  let siteId: string | null = null;
  const emit = (snapshot: JobSnapshot): JobSnapshot | null => {
    if (options.signal.aborted) return null;
    options.onUpdate(snapshot);
    return snapshot;
  };
  const fail = (id: string | null, reason: Problem) => emit({ siteId: id, phase: "failed", position: null, site: null, problem: reason });

  try {
    let position: number | null = null;
    // A check looks at once; a submit looks at once only when the server says it is ready
    // (its answer has no site entry), otherwise after one interval.
    let first = start.kind === "check";
    if (start.kind === "submit") {
      const reply = await requestCustomSite(start.latDeg, start.lonDeg, start.name, { ...request, timeoutMs: timeLeft() });
      if (!reply.ok) return fail(null, reply);
      siteId = reply.siteId;
      position = reply.position;
      if (reply.status === "failed") return fail(siteId, problem("failed", TEXT.failed));
      if (reply.status === "ready") first = true;
      else if (!emit({ siteId, phase: reply.status, position, site: null, problem: null })) return null;
    } else {
      siteId = start.siteId;
    }

    // Look now (a check, or a submit that came back ready), then every interval.
    let errors = 0;
    for (;;) {
      if (!first) {
        const wait = errors === 0 ? interval : Math.min(maxBackoff, interval * 2 ** errors);
        await pause(wait, signal, wakeups, deadline, now);
      }
      if (now() >= deadline) return fail(siteId, problem("timeout", TEXT.timeout));
      const status = await customSiteStatus(siteId, { ...request, timeoutMs: timeLeft() });
      if (!status.ok) {
        if (status.unknown) {
          // A link's id the server does not have; or, after a start, a job it forgot.
          if (first && start.kind === "check") return emit({ siteId, phase: "not_computed", position: null, site: null, problem: null });
          return fail(siteId, problem("lost", TEXT.lost));
        }
        // A link's first look that cannot reach the server: say so now, not in a minute.
        if (first && start.kind === "check") return fail(siteId, status);
        errors += 1;
        first = false;
        if (errors >= maxErrors) return fail(siteId, status);
        continue;
      }
      errors = 0;
      first = false;
      if (status.status === "ready") return emit({ siteId, phase: "ready", position: null, site: status.site, problem: null });
      if (status.status === "failed") return fail(siteId, status.failure ?? problem("failed", TEXT.failed));
      position = status.status === "queued" ? status.position : null;
      if (!emit({ siteId, phase: status.status, position, site: null, problem: null })) return null;
    }
  } catch (error) {
    if (options.signal.aborted) return null;
    if (signal.aborted) return fail(siteId, problem("timeout", TEXT.timeout));
    if (isAbort(error)) return null;
    throw error;
  } finally {
    clearTimeout(ceilingTimer);
    options.signal.removeEventListener("abort", onOuterAbort);
  }
}

/** The coordinates of a valid custom id, or null. Used only to recognise an id from a link. */
export function coordinatesOfId(siteId: string): { latDeg: number; lonDeg: number } | null {
  return isCanonicalCustomId(siteId) ? idCoordinates(siteId) : null;
}
