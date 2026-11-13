import { describe, expect, it } from "vitest";
import { explanations } from "../lib/explain";
import { MINUS, cx, firstSentence, formatNumber, formatUtc } from "./format";

describe("formatNumber", () => {
  it("fixes the decimals", () => {
    expect(formatNumber(3.14159, 2)).toBe("3.14");
    expect(formatNumber(31)).toBe("31");
    expect(formatNumber(222.6192, 4)).toBe("222.6192");
  });

  it("uses a real minus sign", () => {
    expect(formatNumber(-89.45551, 4)).toBe(`${MINUS}89.4555`);
  });

  it("never shows minus zero", () => {
    expect(formatNumber(-0.001, 2)).toBe("0.00");
    expect(formatNumber(-0)).toBe("0");
  });

  it("shows a dash for a value that is not a number", () => {
    expect(formatNumber(Number.NaN)).toBe("—");
    expect(formatNumber(Number.POSITIVE_INFINITY, 1)).toBe("—");
  });
});

describe("formatUtc", () => {
  it("formats an ISO-8601 UTC time with its zone", () => {
    expect(formatUtc("2028-03-01T00:00:00Z")).toBe("2028-03-01 00:00 UTC");
    expect(formatUtc("2028-03-09T17:00Z")).toBe("2028-03-09 17:00 UTC");
  });

  it("can leave the zone off when the caller prints it", () => {
    expect(formatUtc("2028-03-01T06:30:00.000Z", { withZone: false })).toBe("2028-03-01 06:30");
  });

  it("returns anything that is not UTC unchanged", () => {
    expect(formatUtc("2028-03-01T00:00:00+02:00")).toBe("2028-03-01T00:00:00+02:00");
  });
});

describe("cx", () => {
  it("joins the truthy names", () => {
    expect(cx("a", false, null, undefined, "", "b")).toBe("a b");
  });
});

describe("firstSentence", () => {
  it("keeps a single sentence whole", () => {
    expect(firstSentence("One sentence only.")).toBe("One sentence only.");
  });

  it("stops at the first sentence", () => {
    expect(firstSentence("First part. Second part.")).toBe("First part.");
  });

  it("does not split on a decimal point", () => {
    expect(firstSentence("Squares 0.5 km across. More.")).toBe("Squares 0.5 km across.");
  });

  it("gives every view entry in explain.ts a one-sentence description", () => {
    for (const term of [
      "slip_planner",
      "polar_map",
      "system_view",
      "local_terrain",
      "landers_eye",
      "compare",
    ]) {
      const text = explanations[term]?.text ?? "";
      const sentence = firstSentence(text);
      expect(sentence.length).toBeGreaterThan(20);
      expect(sentence.endsWith(".")).toBe(true);
      expect(text.startsWith(sentence)).toBe(true);
    }
  });
});
