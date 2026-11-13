import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../../../contracts/generated";
import { hourIndexToUtc, utcToHourIndex } from "../../../lib/time";
import { bindScenarioUrl, createScenarioStore, type ScenarioCatalog, type ScenarioHistory } from "../../../state/scenario";
import { dragStart, dragStep, type DragState } from "./drag";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");

function catalog(): ScenarioCatalog {
  const root = path.join(repoRoot, "data", "fixtures");
  const manifest = JSON.parse(readFileSync(path.join(root, "manifest.json"), "utf8")) as Manifest;
  const profiles = JSON.parse(readFileSync(path.join(root, "profiles.json"), "utf8")) as MissionProfile[];
  const sites = JSON.parse(readFileSync(path.join(root, "sites.json"), "utf8")) as { id: string }[];
  return { profiles, sites, grid: manifest.time_grid };
}

function memoryHistory() {
  const stack = [""];
  let index = 0;
  const history: ScenarioHistory = {
    search: () => (stack[index] ? `?${stack[index]}` : ""),
    replace: (q) => {
      stack[index] = q;
    },
    push: (q) => {
      stack.splice(index + 1);
      stack.push(q);
      index += 1;
    },
    listen: () => () => undefined,
  };
  return { history, entries: () => stack.length, top: () => stack[index] ?? "" };
}

/** Plays a drag through the same rule the scrubber uses, into the real store. */
function drag(hoursUnderPointer: number[]) {
  const cat = catalog();
  const store = createScenarioStore(cat);
  const memory = memoryHistory();
  const stop = bindScenarioUrl(store, memory.history);
  // An earlier discrete change: focus another site. A drag must not overwrite its entry.
  store.getState().focusSite(store.getState().siteIds[1] ?? "");
  const afterFocus = memory.entries();
  const focusQuery = memory.top();
  const current = utcToHourIndex(cat.grid, store.getState().currentUtc);
  let state: DragState = dragStart(current);
  for (const offset of hoursUnderPointer) {
    const step = dragStep(state, current + offset);
    if (!step) continue;
    state = step.next;
    store.getState().setCurrentTime(hourIndexToUtc(cat.grid, step.next.last), step.write);
  }
  stop();
  return { added: memory.entries() - afterFocus, focusQuery, top: memory.top() };
}

describe("dragStep", () => {
  it("pushes on the first change of hour and replaces after", () => {
    const first = dragStep(dragStart(10), 11);
    expect(first?.write).toBe("push");
    const second = dragStep(first?.next ?? dragStart(10), 12);
    expect(second?.write).toBe("replace");
  });

  it("writes nothing while the hour does not change, even on the drag's first press", () => {
    expect(dragStep(dragStart(10), 10)).toBeNull();
    const moved = dragStep(dragStart(10), 11);
    expect(dragStep(moved?.next ?? dragStart(10), 11)).toBeNull();
  });
});

describe("one drag, one history entry", () => {
  it("starting on the knob (the current hour)", () => {
    const result = drag([0, 0, 1, 2, 3, 5, 8]);
    expect(result.added).toBe(1);
    expect(result.top).toContain("t=8");
  });

  it("starting anywhere else", () => {
    const result = drag([20, 21, 22, 10, -5]);
    expect(result.added).toBe(1);
    expect(result.top).toContain("t=-5");
  });

  it("none when the time never changes, and the earlier entry is kept", () => {
    const result = drag([0, 0, 0]);
    expect(result.added).toBe(0);
    expect(result.top).toBe(result.focusQuery);
  });

  it("back to the start hour still keeps its one entry", () => {
    const result = drag([0, 4, 0]);
    expect(result.added).toBe(1);
    expect(result.top).toContain("t=0");
  });
});
