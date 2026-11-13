/**
 * Custom sites the user asked for in this session: one entry per job, from the click that
 * starts it (or a link's id) to ready or failed. The jobs live here, not in a component, so
 * folding the sites rail or closing the picker does not stop them.
 *
 * - A typed point gets a local key (`local-1`) until the server answers with its id; the
 *   entry then moves to that id. The id is always the server's (docs/data-contracts.md).
 * - An id from a link is only looked up (`check`). It never starts a job without a click.
 * - `forget` stops waiting and drops the entry. The server keeps computing.
 * - Ready entries give their `Site` to the data layer (`readySites`), so a custom site is
 *   found by id wherever a catalog site is.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { Site } from "../contracts/generated.ts";
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
  name: string | null;
  phase: CustomPhase;
  position: number | null;
  site: Site | null;
  problem: Problem | null;
  /** When a rate-limited start may be tried again, in ms since 1970. */
  retryAtMs: number | null;
  /** When the current wait began, in ms since 1970. */
  sinceMs: number;
};

export type AvailabilityState = { state: "unknown" | "checking" | Availability; checkedAtMs: number | null };

export type CustomSitesState = {
  entries: Record<string, CustomEntry>;
  /** Ready sites' entries, in the order they became ready. Stable while nothing changes. */
  readySites: readonly Site[];
  availability: AvailabilityState;
  /** Start computing a typed point. Returns the entry's key. `onSiteId` runs once the server names it. */
  submit: (latDeg: number, lonDeg: number, name: string | null, onSiteId?: SiteIdListener) => string;
  /** Look up an id from a link, once. Never starts a job. */
  check: (siteId: string) => void;
  /** Ask the server again for this entry's point (a click on "Try again" or "Compute this site"). */
  retry: (key: string, onSiteId?: SiteIdListener) => void;
  /** Show a point that could not be asked for, as a failed row with the reason. Returns its key. */
  refuse: (latDeg: number, lonDeg: number, name: string | null, message: string, key?: string) => string;
  /** Stop waiting and drop the entry. */
  forget: (key: string) => void;
  /** Ask `/api/health` once, when the picker first opens. An offline answer is asked again later. */
  checkAvailability: () => void;
  /** Resolves when this id is ready. Starts a `check` if nothing knows the id yet. */
  whenReady: (siteId: string) => Promise<void>;
};

export type SiteIdListener = (siteId: string, previousKey: string) => void;

export type CustomSitesStore = StoreApi<CustomSitesState>;

export type CustomSitesDeps = {
  fetchImpl?: CustomFetch;
  now?: () => number;
  sleep?: DriveOptions["sleep"];
  intervalMs?: number;
  ceilingMs?: number;
};

const OFFLINE_RECHECK_MS = 30_000;

function sameSites(a: readonly Site[], b: readonly Site[]): boolean {
  return a.length === b.length && a.every((site, index) => site === b[index]);
}

export function isLocalKey(key: string): boolean {
  return key.startsWith("local-");
}

export function createCustomSitesStore(deps: CustomSitesDeps = {}): CustomSitesStore {
  const now = deps.now ?? Date.now;
  const controllers = new Map<string, AbortController>();
  let counter = 0;

  return createStore<CustomSitesState>((set, get, api) => {
    function write(entries: Record<string, CustomEntry>, patch: Partial<CustomSitesState> = {}): void {
      const next = Object.values(entries)
        .filter((entry) => entry.phase === "ready" && entry.site !== null && entry.siteId === entry.key)
        .map((entry) => entry.site as Site);
      const readySites = sameSites(get().readySites, next) ? get().readySites : next;
      set({ entries, readySites, ...patch });
    }

    function patchEntry(key: string, patch: Partial<CustomEntry>): void {
      const current = get().entries[key];
      if (!current) return;
      write({ ...get().entries, [key]: { ...current, ...patch } });
    }

    /** Runs one job for the entry now at `key`. Follows the entry when the server names it. */
    function run(startKey: string, kind: "submit" | "check", onSiteId?: SiteIdListener): void {
      controllers.get(startKey)?.abort();
      const controller = new AbortController();
      controllers.set(startKey, controller);
      let key = startKey;
      const entry = get().entries[startKey];
      if (!entry) return;

      const onUpdate = (snapshot: JobSnapshot) => {
        if (controller.signal.aborted) return;
        if (snapshot.siteId && snapshot.siteId !== key) {
          const previous = key;
          const moved = get().entries[previous];
          const entries = { ...get().entries };
          delete entries[previous];
          const existing = entries[snapshot.siteId];
          if (existing && existing.phase === "ready") {
            // The server already had this site for us: keep the ready entry.
            controllers.delete(previous);
            controller.abort();
            write(entries);
            onSiteId?.(snapshot.siteId, previous);
            return;
          }
          if (existing) controllers.get(snapshot.siteId)?.abort();
          if (moved) entries[snapshot.siteId] = { ...moved, key: snapshot.siteId, siteId: snapshot.siteId };
          controllers.delete(previous);
          controllers.set(snapshot.siteId, controller);
          key = snapshot.siteId;
          write(entries);
          onSiteId?.(snapshot.siteId, previous);
        }
        const retryAtMs =
          snapshot.problem?.retryAfterS !== null && snapshot.problem?.retryAfterS !== undefined
            ? now() + snapshot.problem.retryAfterS * 1000
            : null;
        const current = get().entries[key];
        patchEntry(key, {
          siteId: snapshot.siteId ?? current?.siteId ?? null,
          phase: snapshot.phase,
          position: snapshot.position,
          site: snapshot.site,
          problem: snapshot.problem,
          retryAtMs,
          // A new wait starts when the job starts running; queued time is its own wait.
          sinceMs: current && current.phase !== snapshot.phase ? now() : (current?.sinceMs ?? now()),
          name: snapshot.site?.name ?? current?.name ?? null,
        });
        if (snapshot.phase === "ready" || snapshot.phase === "failed" || snapshot.phase === "not_computed") {
          if (controllers.get(key) === controller) controllers.delete(key);
        }
      };

      const start =
        kind === "submit"
          ? { kind: "submit" as const, latDeg: entry.latDeg, lonDeg: entry.lonDeg, name: entry.name }
          : { kind: "check" as const, siteId: startKey };

      void driveCustomSite(start, {
        signal: controller.signal,
        onUpdate,
        fetchImpl: deps.fetchImpl,
        sleep: deps.sleep,
        now,
        intervalMs: deps.intervalMs,
        ceilingMs: deps.ceilingMs,
      }).catch(() => {
        // A programming error in a reply handler: say so on the row rather than hang.
        if (controller.signal.aborted) return;
        patchEntry(key, {
          phase: "failed",
          problem: { kind: "unreadable", message: "Something went wrong while waiting for this site.", fields: [], retryAfterS: null },
        });
      });
    }

    function blank(key: string, siteId: string | null, latDeg: number, lonDeg: number, name: string | null, phase: CustomPhase): CustomEntry {
      return { key, siteId, latDeg, lonDeg, name, phase, position: null, site: null, problem: null, retryAtMs: null, sinceMs: now() };
    }

    return {
      entries: {},
      readySites: [],
      availability: { state: "unknown", checkedAtMs: null },

      submit: (latDeg, lonDeg, name, onSiteId) => {
        counter += 1;
        const key = `local-${counter}`;
        const trimmed = name?.trim() ? name.trim() : null;
        write({ ...get().entries, [key]: blank(key, null, latDeg, lonDeg, trimmed, "sending") });
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
        if (!entry || entry.phase === "ready") return;
        patchEntry(key, { phase: "sending", problem: null, position: null, retryAtMs: null, sinceMs: now() });
        run(key, "submit", onSiteId);
      },

      refuse: (latDeg, lonDeg, name, message, existing) => {
        let key = existing;
        if (!key) {
          counter += 1;
          key = `local-${counter}`;
        }
        controllers.get(key)?.abort();
        controllers.delete(key);
        const entry = get().entries[key] ?? blank(key, null, latDeg, lonDeg, name, "failed");
        write({
          ...get().entries,
          [key]: { ...entry, phase: "failed", problem: { kind: "refused", message, fields: [], retryAfterS: null }, retryAtMs: null },
        });
        return key;
      },

      forget: (key) => {
        controllers.get(key)?.abort();
        controllers.delete(key);
        if (!get().entries[key]) return;
        const entries = { ...get().entries };
        delete entries[key];
        write(entries);
      },

      checkAvailability: () => {
        const { state, checkedAtMs } = get().availability;
        if (state === "checking" || state === "available" || state === "not_available") return;
        if (state === "offline" && checkedAtMs !== null && now() - checkedAtMs < OFFLINE_RECHECK_MS) return;
        set({ availability: { state: "checking", checkedAtMs } });
        void customSitesAvailability({ fetchImpl: deps.fetchImpl }).then(
          (result) => set({ availability: { state: result, checkedAtMs: now() } }),
          () => set({ availability: { state: "offline", checkedAtMs: now() } }),
        );
      },

      whenReady: (siteId) => {
        const ready = () => get().entries[siteId]?.phase === "ready";
        if (ready()) return Promise.resolve();
        get().check(siteId);
        return new Promise<void>((resolve) => {
          const unsubscribe = api.subscribe(() => {
            if (!ready()) return;
            unsubscribe();
            resolve();
          });
        });
      },
    };

  });
}


/** The app's one store of custom sites. */
export const customSitesStore = createCustomSitesStore();
