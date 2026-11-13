import { describe, expect, it } from "vitest";
import type { ScenarioHistory } from "../../state/scenario";
import { REPLACE_INTERVAL_MS, throttledHistory } from "./throttled-history";

/**
 * A fake browser: a stack of entries, each a path, a router key and a query. `navigate`
 * is a router link (a new entry, maybe on another page); `back` is the Back button.
 */
function fakeBrowser() {
  type Entry = { path: string; key: string; query: string };
  const stack: Entry[] = [{ path: "/mission", key: "a", query: "t=0" }];
  let index = 0;
  let keys = 0;
  const pops: ((search: string) => void)[] = [];
  const log: string[] = [];
  const at = () => stack[index] as Entry;
  const inner: ScenarioHistory = {
    search: () => `?${at().query}`,
    replace: (q) => {
      at().query = q;
      log.push(`replace ${at().path} ${q}`);
    },
    push: (q) => {
      stack.splice(index + 1);
      stack.push({ ...at(), query: q });
      index += 1;
      log.push(`push ${at().path} ${q}`);
    },
    listen: (onPop) => {
      pops.push(onPop);
      return () => undefined;
    },
  };
  return {
    inner,
    log,
    stack,
    entry: () => `${at().path}|${at().key}`,
    navigate: (path: string, query = "") => {
      stack.splice(index + 1);
      stack.push({ path, key: `k${++keys}`, query });
      index += 1;
    },
    back: () => {
      index -= 1;
      pops.forEach((p) => p(`?${at().query}`));
    },
    current: () => at(),
  };
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

function setup() {
  const browser = fakeBrowser();
  const t = manualTimers();
  const history = throttledHistory(browser.inner, { timers: t.timers, entry: browser.entry });
  return { browser, t, history };
}

describe("throttledHistory", () => {
  it("writes the first replace at once and the newest of a burst at the end of the interval", () => {
    const { browser, t, history } = setup();
    history.replace("t=1");
    history.replace("t=2");
    history.replace("t=3");
    expect(browser.log).toEqual(["replace /mission t=1"]);
    expect(history.search()).toBe("?t=3");
    t.run();
    expect(browser.log).toEqual(["replace /mission t=1", "replace /mission t=3"]);
    expect(REPLACE_INTERVAL_MS).toBeGreaterThan(0);
  });

  it("writes a waiting replace before a push, so the order of entries holds", () => {
    const { browser, t, history } = setup();
    history.replace("t=1");
    history.replace("t=2");
    history.push("t=3&view=map");
    expect(browser.log).toEqual(["replace /mission t=1", "replace /mission t=2", "push /mission t=3&view=map"]);
    expect(t.pending()).toBe(0);
  });

  it("drops a waiting replace when the user goes Back", () => {
    const { browser, t, history } = setup();
    history.push("t=5");
    const seen: string[] = [];
    history.listen((s) => seen.push(s));
    history.replace("t=6");
    history.replace("t=7");
    browser.back();
    t.run();
    // The push was just written, so both replaces waited; Back drops them.
    expect(browser.log).toEqual(["push /mission t=5"]);
    expect(browser.current().query).toBe("t=0");
    expect(seen).toEqual(["?t=0"]);
  });

  it("never writes Mission Control's query onto another page: schedule, navigate, flush", () => {
    const { browser, t, history } = setup();
    history.replace("t=1");
    history.replace("t=2");
    browser.navigate("/academy");
    history.flush();
    t.run();
    expect(browser.log).toEqual(["replace /mission t=1"]);
    expect(browser.current()).toMatchObject({ path: "/academy", query: "" });
    expect(browser.stack[0]?.query).toBe("t=1");
  });

  it("never writes over a newer navigation on the same page", () => {
    const { browser, t, history } = setup();
    history.replace("t=1");
    history.replace("t=2");
    browser.navigate("/mission", "sites=other");
    t.run();
    expect(browser.current().query).toBe("sites=other");
    expect(browser.log).toEqual(["replace /mission t=1"]);
  });

  it("drops a replace still waiting for a page that is gone when a new one is asked for", () => {
    const { browser, t, history } = setup();
    history.replace("t=1");
    history.replace("t=2");
    browser.navigate("/mission", "t=40");
    history.replace("t=41");
    t.run();
    expect(browser.stack[0]?.query).toBe("t=1");
    expect(browser.current().query).toBe("t=41");
  });

  it("flushes on demand while still on the same entry, and cancel forgets", () => {
    const { browser, history } = setup();
    history.replace("t=1");
    history.replace("t=9");
    history.flush();
    expect(browser.log).toEqual(["replace /mission t=1", "replace /mission t=9"]);
    history.replace("t=10");
    history.cancel();
    history.flush();
    expect(browser.log).toHaveLength(2);
  });
});
