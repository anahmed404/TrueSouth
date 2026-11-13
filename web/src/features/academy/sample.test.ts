import { describe, expect, it } from "vitest";
import { fillPlaceholders } from "./placeholders";
import { sampleExamples, sampleLesson } from "./lessons/sample";

const STEP_KINDS = [
  "choice",
  "predict",
  "drag-body",
  "draw-skyline",
  "drop-pin",
  "tune-slider",
  "fill-formula",
  "spot-bug",
] as const;

describe("sample lesson", () => {
  it("exercises every step kind and is marked as a sample", () => {
    expect(sampleLesson.id).toBe("sample");
    expect(sampleLesson.tagline).toContain("A5 replaces it");
    expect(sampleLesson.steps.map((step) => step.kind).sort()).toEqual([...STEP_KINDS].sort());
  });

  it("fills its own placeholder and does not leave a missing key", () => {
    const line = sampleLesson.steps[0]?.luna.says ?? "";
    const filled = fillPlaceholders(line, sampleExamples);
    expect(filled.missing).toEqual([]);
    expect(filled.text).toContain("alpha");
    expect(filled.text).not.toContain("{{");
  });
});
