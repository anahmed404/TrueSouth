/**
 * Custom sites in this session: one entry per job, from the click that starts it (or a
 * link's id) to ready or failed. Jobs live here, not in a component, so folding the rail or
 * closing the picker does not stop them; leaving Mission Control does (`suspend`).
 *
 * - Only `submit` and `retry` make a POST, and only a button press calls them, once per
 *   press. `check`, remounts, the page being shown again and the network coming back use
 *   GET (docs/data-contracts.md, "API messages").
 * - A typed point gets a local key (`local-1`) until the server answers with its id; the
 *   entry then moves to that id, which must be the one the coordinates make.
 * - `forget` (remove, "Stop waiting"), a failure and `suspend` stop that id's polling,
 *   reject whatever waits for its files, and release its cached data.
 * - Ready entries give their `Site` to the data layer (`readySites`).
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { Site } from "../contracts/generated.ts";
import { cleanSiteName } from "../data/custom-site-id.ts";
import {
  coordinatesOfId,
  customSitesAvailability,
  driveCustomSite,
  type Availability,
  type CustomFetch,
  type DriveOptions,
  type JobPhase,
  type JobSnapshot,
  type Problem,
} from "../data/custom-sites.ts";

export type CustomPhase = "sending" | "checking" | JobPhase;

export type CustomEntry = {
  key: string;
  /** The server's id, once known. */
  siteId: string | null;
  latDeg: number;
  lonDeg: number;
  /** Cleaned (`cleanSiteName`); null shows as "Custom site". */
  name: string | null;
  phase: CustomPhase;
  position: number | null;
  site: Site | null;
  problem: Problem | null;
  /** When a refused start may be tried again, in ms since 1970. */
  retryAtMs: number | null;
  /** When the current wait began, in ms since 1970. */
  sinceMs: number;
};

export type AvailabilityState = { state: "unknown" | "checking" | Availability; checkedAtMs: number | null };

/** One announcement for screen readers, made once on a change of state. */
export type Announcement = { id: number; text: string };

export type SiteIdListener = (siteId: string, previousKey: string) => void;

export type CustomSitesState = {
  entries: Record<string, CustomEntry>;
  /** Ready sites' entries. Stable while nothing changes. */
  readySites: readonly Site[];
  availability: AvailabilityState;
  announcement: Announcement | null;
  /** A button press: compute a typed point (one POST). Returns the row's key. */
  submit: (latDeg: number, lonDeg: number, name: string | null, onSiteId?: SiteIdListener) => string;
  /** Look up an id from a link, once (GET only). Does nothing if the id has a row. */
  check: (siteId: string) => void;
  /** A button press ("Compute this site", "Try again"): ask the server again (one POST). */
  retry: (key: string, onSiteId?: SiteIdListener) => void;
  /** Show a point that could not be asked for, as a failed row with the reason. Returns its key. */
  refuse: (latDeg: number, lonDeg: number, name: string | null, message: string, key?: string) => string;
  /** Remove a row, or stop waiting: stops its polling, rejects its waiters, releases its data. */
  forget: (key: string) => void;
  /** Leaving Mission Control: stop every job, and drop every row that is not ready. */
  suspend: () => void;
  /** Ask `/api/health` once, when the picker first opens. An offline answer is asked again later. */
  checkAvailability: () => void;
  /** Resolves when this id is ready; rejected if its row is removed, fails or is suspended. */
  whenReady: (siteId: string) => Promise<void>;
};

export type CustomSitesStore = StoreApi<CustomSitesState> & {
  /** Called with an id whose cached data must go (remove, failure, suspend). */
  onRelease: (listener: (siteId: string) => void) => () => void;
  /** For tests: what is still held for an id. */
  held: (key: string) => { waiters: number; polling: boolean };
};

export type CustomSitesDeps = {
  fetchImpl?: CustomFetch;
  now?: () => number;
  intervalMs?: number;
  ceilingMs?: number;
  maxErrors?: number;
  requestTimeoutMs?: number;
  wakeups?: DriveOptions["wakeups"];
};

const OFFLINE_RECHECK_MS = 30_000;
const BUSY: readonly CustomPhase[] = ["sending", "queued", "running"];

export class SiteReleasedError extends Error {
  constructor(siteId: string) {
    super(`${siteId} is no longer waited for`);
    this.name = "SiteReleasedError";
  }
}

function sameSites(a: readonly Site[], b: readonly Site[]): boolean {
  return a.length === b.length && a.every((site, index) => site === b[index]);
}

export function isLocalKey(key: string): boolean {
  return key.startsWith("local-");
}

/** The words a row and its announcements use for a site's name. */
export function entryTitle(entry: Pick<CustomEntry, "name" | "site">): string {
  return entry.site?.name ?? entry.name ?? "Custom site";
}

export function createCustomSitesStore(deps: CustomSitesDeps = {}): CustomSitesStore {
  const now = deps.now ?? Date.now;
  const controllers = new Map<string, AbortController>();
  const waiters = new Map<string, Set<{ resolve: () => void; reject: (error: Error) => void }>>();
  const releaseListeners = new Set<(siteId: string) => void>();
  let counter = 0;
  let announced = 0;

  const store = createStore<CustomSitesState>((set, get) => {
    function write(entries: Record<string, CustomEntry>, patch: Partial<CustomSitesState> = {}): void {
      const next = Object.values(entries)
        .filter((entry) => entry.phase === "ready" && entry.site !== null && entry.siteId === entry.key)
        .map((entry) => entry.site as Site);
      const readySites = sameSites(get().readySites, next) ? get().readySites : next;
      set({ entries, readySites, ...patch });
    }

    function announce(text: string): void {
      announced += 1;
      set({ announcement: { id: announced, text } });
    }

    function stop(key: string): void {
      controllers.get(key)?.abort();
      controllers.delete(key);
    }

    /** Rejects the id's waiters and lets the data layer drop its files. */
    function release(siteId: string): void {
      const pending = waiters.get(siteId);
      waiters.delete(siteId);
      pending?.forEach((waiter) => waiter.reject(new SiteReleasedError(siteId)));
      releaseListeners.forEach((listener) => listener(siteId));
    }

    function settleReady(siteId: string): void {
      const pending = waiters.get(siteId);
      waiters.delete(siteId);
      pending?.forEach((waiter) => waiter.resolve());
    }

    /** Runs one job for the row now at `startKey`. Follows the row when the server names it. */
    function run(startKey: string, kind: "submit" | "check", onSiteId?: SiteIdListener): void {
      stop(startKey);
      const entry = get().entries[startKey];
      if (!entry) return;
      const controller = new AbortController();
      controllers.set(startKey, controller);
      let key = startKey;

      const onUpdate = (snapshot: JobSnapshot) => {
        if (controller.signal.aborted) return;
        if (snapshot.siteId && snapshot.siteId !== key) {
          const previous = key;
          const moved = get().entries[previous];
          const entries = { ...get().entries };
          delete entries[previous];
          controllers.delete(previous);
          const existing = entries[snapshot.siteId];
          if (existing && existing.phase === "ready") {
            // The server already had this site for us: keep the ready row.
            controller.abort();
            write(entries);
            onSiteId?.(snapshot.siteId, previous);
            return;
          }
          if (existing) stop(snapshot.siteId);
          if (moved) entries[snapshot.siteId] = { ...moved, key: snapshot.siteId, siteId: snapshot.siteId };
          controllers.set(snapshot.siteId, controller);
          key = snapshot.siteId;
          write(entries);
          onSiteId?.(snapshot.siteId, previous);
        }
        const current = get().entries[key];
        if (!current) return;
        const retryAtMs = snapshot.problem?.retryAfterS != null ? now() + snapshot.problem.retryAfterS * 1000 : null;
        const name = cleanSiteName(snapshot.site?.name) ?? current.name;
        write({
          ...get().entries,
          [key]: {
            ...current,
            siteId: snapshot.siteId ?? current.siteId,
            phase: snapshot.phase,
            position: snapshot.position,
            site: snapshot.site,
            problem: snapshot.problem,
            retryAtMs,
            sinceMs: current.phase !== snapshot.phase ? now() : current.sinceMs,
            name,
          },
        });
        const title = entryTitle({ name, site: snapshot.site });
        const wasBusy = BUSY.includes(current.phase);
        if ((snapshot.phase === "queued" || snapshot.phase === "running") && current.phase === "checking") {
          announce(`Computing terrain for ${title}…`);
        } else if (snapshot.phase === "ready") {
          if (wasBusy) announce(`${title} is ready`);
        } else if (snapshot.phase === "failed") {
          announce(`${title} could not be computed: ${snapshot.problem?.message ?? "the server did not say why."}`);
        }
        const done = snapshot.phase === "ready" || snapshot.phase === "failed" || snapshot.phase === "not_computed";
        if (done && controllers.get(key) === controller) controllers.delete(key);
        if (snapshot.phase === "ready" && snapshot.siteId) settleReady(snapshot.siteId);
        if (snapshot.phase === "failed" && snapshot.siteId) release(snapshot.siteId);
      };

      const start =
        kind === "submit"
          ? { kind: "submit" as const, latDeg: entry.latDeg, lonDeg: entry.lonDeg, name: entry.name }
          : { kind: "check" as const, siteId: startKey };

      void driveCustomSite(start, {
        signal: controller.signal,
        onUpdate,
        fetchImpl: deps.fetchImpl,
        now,
        intervalMs: deps.intervalMs,
        ceilingMs: deps.ceilingMs,
        maxErrors: deps.maxErrors,
        requestTimeoutMs: deps.requestTimeoutMs,
        wakeups: deps.wakeups,
      }).catch(() => {
        // A programming error in a reply handler: say so on the row rather than hang.
        if (controller.signal.aborted) return;
        const current = get().entries[key];
        if (!current) return;
        write({
          ...get().entries,
          [key]: {
            ...current,
            phase: "failed",
            problem: { kind: "unreadable", message: "Something went wrong while waiting for this site.", fields: [], retryAfterS: null },
          },
        });
        if (current.siteId) release(current.siteId);
      });
    }

    function blank(key: string, siteId: string | null, latDeg: number, lonDeg: number, name: string | null, phase: CustomPhase): CustomEntry {
      return { key, siteId, latDeg, lonDeg, name, phase, position: null, site: null, problem: null, retryAtMs: null, sinceMs: now() };
    }

    return {
      entries: {},
      readySites: [],
      availability: { state: "unknown", checkedAtMs: null },
      announcement: null,

      submit: (latDeg, lonDeg, name, onSiteId) => {
        counter += 1;
        const key = `local-${counter}`;
        const entry = blank(key, null, latDeg, lonDeg, cleanSiteName(name), "sending");
        write({ ...get().entries, [key]: entry });
        announce(`Computing terrain for ${entryTitle(entry)}…`);
        run(key, "submit", onSiteId);
        return key;
      },

      check: (siteId) => {
        if (get().entries[siteId]) return;
        const coords = coordinatesOfId(siteId);
        if (!coords) return;
        write({ ...get().entries, [siteId]: blank(siteId, siteId, coords.latDeg, coords.lonDeg, null, "checking") });
        run(siteId, "check");
      },

      retry: (key, onSiteId) => {
        const entry = get().entries[key];
        if (!entry || entry.phase === "ready" || BUSY.includes(entry.phase)) return;
        const next = { ...entry, phase: "sending" as const, problem: null, position: null, retryAtMs: null, sinceMs: now() };
        write({ ...get().entries, [key]: next });
        announce(`Computing terrain for ${entryTitle(next)}…`);
        run(key, "submit", onSiteId);
      },

      refuse: (latDeg, lonDeg, name, message, existing) => {
        let key = existing;
        if (!key) {
          counter += 1;
          key = `local-${counter}`;
        }
        stop(key);
        const entry = get().entries[key] ?? blank(key, null, latDeg, lonDeg, cleanSiteName(name), "failed");
        write({
          ...get().entries,
          [key]: { ...entry, phase: "failed", problem: { kind: "refused", message, fields: [], retryAfterS: null }, retryAtMs: null },
        });
        announce(`${entryTitle(entry)} could not be computed: ${message}`);
        return key;
      },

      forget: (key) => {
        stop(key);
        const entry = get().entries[key];
        if (entry) {
          const entries = { ...get().entries };
          delete entries[key];
          write(entries);
        }
        if (!isLocalKey(key)) release(key);
      },

      suspend: () => {
        for (const key of [...controllers.keys()]) stop(key);
        const entries: Record<string, CustomEntry> = {};
        const dropped: string[] = [];
        for (const [key, entry] of Object.entries(get().entries)) {
          if (entry.phase === "ready") entries[key] = entry;
          else if (!isLocalKey(key)) dropped.push(key);
        }
        write(entries);
        dropped.forEach(release);
      },

      checkAvailability: () => {
        const { state, checkedAtMs } = get().availability;
        if (state === "checking" || state === "available" || state === "not_available") return;
        if (state === "offline" && checkedAtMs !== null && now() - checkedAtMs < OFFLINE_RECHECK_MS) return;
        set({ availability: { state: "checking", checkedAtMs } });
        void customSitesAvailability({ fetchImpl: deps.fetchImpl, timeoutMs: deps.requestTimeoutMs }).then(
          (result) => set({ availability: { state: result, checkedAtMs: now() } }),
          () => set({ availability: { state: "offline", checkedAtMs: now() } }),
        );
      },

      whenReady: (siteId) => {
        if (get().entries[siteId]?.phase === "ready") return Promise.resolve();
        // Waits without asking the server: the rail looks up the scenario's ids itself.
        return new Promise<void>((resolve, reject) => {
          let set = waiters.get(siteId);
          if (!set) {
            set = new Set();
            waiters.set(siteId, set);
          }
          set.add({ resolve, reject });
        });
      },
    };
  });

  return Object.assign(store, {
    onRelease: (listener: (siteId: string) => void) => {
      releaseListeners.add(listener);
      return () => {
        releaseListeners.delete(listener);
      };
    },
    held: (key: string) => ({ waiters: waiters.get(key)?.size ?? 0, polling: controllers.has(key) }),
  });
}

/** The app's one store of custom sites. */
export const customSitesStore = createCustomSitesStore();
