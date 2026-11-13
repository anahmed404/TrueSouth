import type { ScenarioHistory } from "../../state/scenario";

/** At most one address-bar replace per this many milliseconds while scrubbing or playing. */
export const REPLACE_INTERVAL_MS = 250;

type Timers = {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

type Options = {
  timers?: Timers;
  /**
   * Which page and history entry the browser is on now. A waiting replace is written only
   * if this is still what it was when the replace was asked for.
   */
  entry?: () => string;
};

const browserTimers: Timers = {
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: (handle) => window.clearTimeout(handle as number),
};

/**
 * The page's path and the router's key for the current history entry. A link to another
 * page changes the path; a router navigation on the same page gets a new key. Our own
 * replaces and pushes copy `history.state`, so they keep the key.
 */
export function browserEntry(): string {
  const state: unknown = window.history.state;
  const key = typeof state === "object" && state !== null && "key" in state ? String((state as { key: unknown }).key) : "";
  return `${window.location.pathname}|${key}`;
}

export type ThrottledHistory = ScenarioHistory & {
  /** Write a waiting replace now, if the browser is still on its page and entry. */
  flush: () => void;
  /** Forget a waiting replace without writing it. */
  cancel: () => void;
};

/**
 * The address bar, with replaces coalesced. Dragging the scrubber or playing time changes
 * the current time many times a second; browsers ignore history updates past about 200
 * in 10 seconds (Chrome logs "Throttling navigation"), which would leave the link behind
 * the scenario.
 *
 * A replace is written at once if none was written in the last interval, otherwise once at
 * the end of it, with the newest query. A waiting replace only ever writes to the page and
 * history entry it was asked for on: if the browser has moved on (a link to the Academy,
 * Back or Forward, a router navigation), it is dropped, never written over the newer
 * entry. A push settles a waiting replace first, so the order of entries never changes.
 */
export function throttledHistory(inner: ScenarioHistory, options: Options = {}): ThrottledHistory {
  const timers = options.timers ?? browserTimers;
  const entry = options.entry ?? browserEntry;
  let pending: { query: string; entry: string } | null = null;
  let handle: unknown = null;
  let lastWrite = -Infinity;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const cancel = () => {
    if (handle !== null) timers.clear(handle);
    handle = null;
    pending = null;
  };

  const flush = () => {
    const waiting = pending;
    cancel();
    if (waiting === null || entry() !== waiting.entry) return;
    lastWrite = now();
    inner.replace(waiting.query);
  };

  return {
    search: () => (pending !== null && entry() === pending.entry ? `?${pending.query.replace(/^\?/, "")}` : inner.search()),
    replace: (query) => {
      const here = entry();
      // A replace waiting for another page or entry belongs to a page that is gone.
      if (pending !== null && pending.entry !== here) cancel();
      const wait = REPLACE_INTERVAL_MS - (now() - lastWrite);
      if (handle === null && wait <= 0) {
        lastWrite = now();
        inner.replace(query);
        return;
      }
      pending = { query, entry: here };
      if (handle === null) handle = timers.set(flush, Math.max(0, wait));
    },
    push: (query) => {
      flush();
      lastWrite = now();
      inner.push(query);
    },
    listen: (onPop) =>
      inner.listen((search) => {
        // The page moved to another entry: a waiting replace belonged to the old one.
        cancel();
        onPop(search);
      }),
    flush,
    cancel,
  };
}
