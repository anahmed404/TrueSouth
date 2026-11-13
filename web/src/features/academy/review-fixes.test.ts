import { describe, expect, it } from "vitest";
import { starsFor } from "./runner";
import type { OptionView } from "./step-view";
import { optionTabStop } from "./ui/answer-option";

describe("stars at the 60% boundary", () => {
  it("gives 2 stars at exactly 60% and 1 star just under it", () => {
    expect(starsFor(3, 5)).toBe(2); // 60%
    expect(starsFor(6, 10)).toBe(2); // 60%
    expect(starsFor(5, 9)).toBe(1); // 55.6%: between 50% and 60%
    expect(starsFor(11, 20)).toBe(1); // 55%
    expect(starsFor(1, 2)).toBe(1); // 50%
  });

  it("gives 3 stars only when every step was right first time", () => {
    expect(starsFor(5, 5)).toBe(3);
    expect(starsFor(4, 5)).toBe(2);
  });
});

describe("a radio group is one tab stop", () => {
  const view = (state: OptionView["state"]): OptionView => ({ state, note: null, correct: false });

  it("is the first option when nothing is picked", () => {
    expect(optionTabStop([view("default"), view("default"), view("default")])).toBe(0);
  });

  it("skips a missed option", () => {
    expect(optionTabStop([view("missed"), view("default"), view("default")])).toBe(1);
  });

  it("is the selected option, or the shown answer", () => {
    expect(optionTabStop([view("default"), view("default"), view("selected")])).toBe(2);
    expect(optionTabStop([view("missed"), view("answer"), view("dimmed")])).toBe(1);
  });

  it("uses the given checked option when the caller tracks it", () => {
    expect(optionTabStop([view("default"), view("default"), view("default")], 2)).toBe(2);
    expect(optionTabStop([view("default"), view("default"), view("default")], -1)).toBe(0);
  });

  it("is exactly one option, or none when every option is missed", () => {
    expect(optionTabStop([view("missed"), view("missed")])).toBe(-1);
  });
});
