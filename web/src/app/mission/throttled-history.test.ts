import { describe, expect, it } from "vitest";
import type { ScenarioHistory } from "../../state/scenario";
import { REPLACE_INTERVAL_MS, throttledHistory } from "./throttled-history";

function recorder() {
  const log: string[] = [];
  let search = "";
  const pops: ((s: string) => void)[] = [];
  const inner: ScenarioHistory = {
    search: () => search,
    replace: (q) => {
      search = `?${q}`;
      log.push(`replace ${q}`);
    },
    push: (q) => {
      search = `?${q}`;
      log.push(`push ${q}`);
    },
    listen: (onPop) => {
      pops.push(onPop);
      return () => undefined;
    },
  };
  return { inner, log, pop: (s: string) => pops.forEach((p) => p(s)) };
}

function manualTimers() {
  const queue = new Map<number, () => void>();
  let next = 1;
  return {
    timers: {
      set: (callback: () => void) => {
        queue.set(next, callback);
        return next++;
      },
      clear: (handle: unknown) => queue.delete(handle as number),
    },
    run: () => {
      for (const [id, callback] of [...queue]) {
        queue.delete(id);
        callback();
      }
    },
    pending: () => queue.size,
  };
}

describe("throttledHistory", () => {
  it("writes the first replace at once and the newest of a burst at the end of the interval", () => {
    const { inner, log } = recorder();
    const t = manualTimers();
    const history = throttledHistory(inner, t.timers);
    history.replace("t=1");
    history.replace("t=2");
    history.replace("t=3");
    expect(log).toEqual(["replace t=1"]);
    expect(history.search()).toBe("?t=3");
    t.run();
    expect(log).toEqual(["replace t=1", "replace t=3"]);
    expect(REPLACE_INTERVAL_MS).toBeGreaterThan(0);
  });

  it("writes a waiting replace before a push, so the order of entries holds", () => {
    const { inner, log } = recorder();
    const t = manualTimers();
    const history = throttledHistory(inner, t.timers);
    history.replace("t=1");
    history.replace("t=2");
    history.push("t=3&view=map");
    expect(log).toEqual(["replace t=1", "replace t=2", "push t=3&view=map"]);
    expect(t.pending()).toBe(0);
  });

  it("drops a waiting replace when the user goes Back", () => {
    const { inner, log, pop } = recorder();
    const t = manualTimers();
    const history = throttledHistory(inner, t.timers);
    const seen: string[] = [];
    history.listen((s) => seen.push(s));
    history.replace("t=1");
    history.replace("t=2");
    pop("?t=0");
    t.run();
    expect(log).toEqual(["replace t=1"]);
    expect(seen).toEqual(["?t=0"]);
  });

  it("flushes on demand", () => {
    const { inner, log } = recorder();
    const t = manualTimers();
    const history = throttledHistory(inner, t.timers);
    history.replace("t=1");
    history.replace("t=9");
    history.flush();
    expect(log).toEqual(["replace t=1", "replace t=9"]);
  });
});
