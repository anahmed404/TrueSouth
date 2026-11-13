import type { ScenarioHistory } from "../../state/scenario";

/** At most one address-bar replace per this many milliseconds while scrubbing or playing. */
export const REPLACE_INTERVAL_MS = 250;

type Timers = {
  set: (callback: () => void, ms: number) => unknown;
  clear: (handle: unknown) => void;
};

const browserTimers: Timers = {
  set: (callback, ms) => window.setTimeout(callback, ms),
  clear: (handle) => window.clearTimeout(handle as number),
};

/**
 * The address bar, with replaces coalesced. Dragging the scrubber or playing time changes
 * the current time many times a second; browsers ignore history updates past about 200
 * in 10 seconds (Chrome logs "Throttling navigation"), which would leave the link behind
 * the scenario. A replace is written at once if none was written in the last interval,
 * otherwise once at the end of it, with the newest query. A push, or Back and Forward,
 * settles any waiting replace first, so the history order never changes.
 */
export function throttledHistory(inner: ScenarioHistory, timers: Timers = browserTimers): ScenarioHistory & {
  flush: () => void;
} {
  let pending: string | null = null;
  let handle: unknown = null;
  let lastWrite = -Infinity;
  const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

  const flush = () => {
    if (handle !== null) {
      timers.clear(handle);
      handle = null;
    }
    if (pending !== null) {
      const query = pending;
      pending = null;
      lastWrite = now();
      inner.replace(query);
    }
  };

  return {
    search: () => (pending !== null ? `?${pending.replace(/^\?/, "")}` : inner.search()),
    replace: (query) => {
      const wait = REPLACE_INTERVAL_MS - (now() - lastWrite);
      if (handle === null && wait <= 0) {
        lastWrite = now();
        inner.replace(query);
        return;
      }
      pending = query;
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
        if (handle !== null) timers.clear(handle);
        handle = null;
        pending = null;
        onPop(search);
      }),
    flush,
  };
}
