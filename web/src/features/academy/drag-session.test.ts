import { describe, expect, it } from "vitest";
import { beginDrag, endDrag, idleDrag, moveDrag, setHourNow, type HourDrag } from "./drag-session";
import { createValueEvaluator } from "./evaluator";
import { goalValuesAt, metricAt, resolveTimeRange } from "./drag-body";
import { lesson1 } from "./lessons/l1";
import { initialRunnerState, reduceRunner } from "./runner";
import { canCheck, type Draft } from "./step-view";
import { realExamples, realGrid, realSite } from "./testing/real-site";
import type { Step } from "./types";
import { hourIndexToUtc } from "../../lib/time";

/** The hour on screen is the hour "Check" judges, once no drag is under way. */
const settled = (state: HourDrag) => state.pointer === null && state.shown === state.committed;

describe("a drag of the body or the time bar", () => {
  it("commits the hour on screen when the pointer is lifted", () => {
    let state = beginDrag(idleDrag(100), 1);
    state = moveDrag(state, 1, 130);
    state = moveDrag(state, 1, 150);
    expect(state.shown).toBe(150);
    expect(state.committed).toBe(100);
    state = endDrag(state, 1);
    expect(state).toEqual({ pointer: null, shown: 150, committed: 150 });
  });

  it("commits the hour on screen when the browser cancels the drag, or capture is lost", () => {
    const moved = moveDrag(beginDrag(idleDrag(100), 7), 7, 180);
    // pointercancel and lostpointercapture both end the drag with its own pointer.
    expect(settled(endDrag(moved, 7))).toBe(true);
    expect(endDrag(moved, 7).committed).toBe(180);
  });

  it("commits the hour on screen when the window loses focus or the tab is hidden", () => {
    const moved = moveDrag(beginDrag(idleDrag(100), 7), 7, 180);
    const ended = endDrag(moved, null);
    expect(ended).toEqual({ pointer: null, shown: 180, committed: 180 });
    // With no drag under way, losing focus changes nothing.
    expect(endDrag(idleDrag(100), null)).toEqual(idleDrag(100));
  });

  it("ignores a second pointer, and the end of a pointer that is not dragging", () => {
    let state = beginDrag(idleDrag(100), 1);
    state = beginDrag(state, 2);
    expect(state.pointer).toBe(1);
    state = moveDrag(state, 2, 300);
    expect(state.shown).toBe(100);
    state = moveDrag(state, 1, 120);
    expect(endDrag(state, 2)).toBe(state);
  });

  it("a key press moves and commits at once", () => {
    expect(setHourNow(idleDrag(100), 101)).toEqual({ pointer: null, shown: 101, committed: 101 });
  });
});

describe("down, move, cancel, then Check: the judged hour is the hour on screen", () => {
  const site = realSite("connecting_ridge");
  const step = (lesson1.steps as readonly Step[]).find((item) => item.id === "l1-highest");
  if (step?.kind !== "drag-body" || "comparedTo" in step.goal || !step.scene.timeRange) throw new Error("l1-highest");
  const range = resolveTimeRange(step.scene.timeRange, realExamples, realGrid);
  if (!range || "missing" in range) throw new Error("range");
  const goal = { metric: step.goal.metric, op: step.goal.op, value: Number(realExamples["l1.sun_el_max_deg"]), tolerance: step.goal.tolerance };

  /** What the stage sends to the lesson for an hour: the series' value there. */
  const draftAt = (hour: number): Draft => ({
    kind: "drag-body",
    hour,
    utc: hourIndexToUtc(realGrid, hour),
    value: metricAt(site.series, goal.metric, hour) ?? Number.NaN,
    values: goalValuesAt(site.series, goal, hour) ?? {},
    sunFrac: null,
  });

  it("on the month's highest hour, after a cancelled drag", () => {
    const start = range.fromIndex + 360;
    const target = range.fromIndex; // 2028-01-01 00:00 UTC, the highest Sun.
    let state = beginDrag(idleDrag(start), 1);
    state = moveDrag(state, 1, range.fromIndex + 200);
    state = moveDrag(state, 1, target);
    state = endDrag(state, 1); // pointercancel
    expect(settled(state)).toBe(true);

    const draft = draftAt(state.committed);
    if (draft?.kind !== "drag-body") throw new Error("draft");
    expect(draft.hour).toBe(state.shown);
    const runner = initialRunnerState();
    expect(canCheck(step, runner, draft)).toBe(true);
    const at = { ...runner, stepIndex: (lesson1.steps as readonly Step[]).indexOf(step) };
    const judged = reduceRunner(
      at,
      { type: "submit", submission: { kind: "drag-body", value: draft.value, utc: draft.utc, values: draft.values } },
      lesson1,
      createValueEvaluator(),
      realExamples,
    );
    // The hour on screen is the month's highest, so the check is right; had the earlier
    // draft (the middle of the month) been judged, it would have been a miss.
    expect(judged.phase).toBe("correct");
    expect(reduceRunner(at, { type: "submit", submission: { kind: "drag-body", value: metricAt(site.series, goal.metric, start) ?? 0, utc: "x" } }, lesson1, createValueEvaluator(), realExamples).phase).toBe("hint");
  });
});
