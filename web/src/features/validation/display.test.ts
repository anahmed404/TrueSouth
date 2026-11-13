import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Validation } from "../../contracts/generated.ts";
import { gateLimitText, gateMeasuredText, kindOf, largestDegreesText, markText, measureText } from "./display";
import { formatFixed, formatPercent, formatPoints, formatSignedDegrees, formatValue, roundAt } from "./format";
import { checkReport } from "./check";
import { comparisonIds, comparisonRows, gateVerdict, g2Peak } from "./model";

const repoRoot = fileURLToPath(new URL("../../../../", import.meta.url));
const readJson = (path: string) => JSON.parse(readFileSync(`${repoRoot}${path}`, "utf8")) as Validation;

const FILES = {
  derived: readJson("data/derived/validation.json"),
  fixtures: readJson("data/fixtures/validation.json"),
};

/** The real G2 measurement in data/derived/validation.json. */
const REAL_G2 = 0.006007249421241467;

const SUPER: Record<string, string> = { "⁰": "0", "¹": "1", "²": "2", "³": "3", "⁴": "4", "⁵": "5", "⁶": "6", "⁷": "7", "⁸": "8", "⁹": "9", "⁻": "-" };

/** Reads a printed number back: "3.1 × 10⁻⁹ m", "−6.3 points", "0.0061°", "10 percentage points". */
function shownNumber(text: string): number {
  const clean = text.replace(/−/g, "-").replace(/\+/g, "");
  const power = /(-?[\d.]+) × 10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/.exec(clean);
  if (power) return Number(power[1]) * 10 ** Number([...power[2]!].map((char) => SUPER[char]).join(""));
  const plain = /-?[\d.]+/.exec(clean);
  if (!plain) throw new Error(`no number in "${text}"`);
  return Number(plain[0]);
}

describe("rounding modes", () => {
  it("rounds a largest difference up, a lower bound down and a reading to nearest", () => {
    expect(roundAt(0.006007, 3, "up")).toBe(0.007);
    expect(roundAt(0.006007, 3, "down")).toBe(0.006);
    expect(roundAt(0.006007, 3, "nearest")).toBe(0.006);
    expect(roundAt(-6.21, 1, "up")).toBe(-6.3);
    expect(roundAt(-6.29, 1, "down")).toBe(-6.2);
  });

  it("ignores binary noise, so an exact value is not pushed up", () => {
    expect(roundAt(0.1 * 100, 1, "up")).toBe(10);
    expect(formatPoints(0.1, 1, { round: "up" })).toBe("+10.0");
  });

  it("shows the real G2 value as an upper bound, never under it", () => {
    expect(formatValue(REAL_G2, { round: "up" })).toBe("0.0061");
    expect(formatValue(REAL_G2, { round: "up", sig: 1 })).toBe("0.007");
    expect(formatValue(REAL_G2)).toBe("0.006");
    expect(formatValue(REAL_G2, { round: "down" })).toBe("0.006");
    expect(Number(formatValue(REAL_G2, { round: "up" }))).toBeGreaterThanOrEqual(REAL_G2);
  });

  it("rounds small values up in the mantissa, carrying into the power", () => {
    expect(formatValue(8.980419932691497e-8, { round: "up" })).toBe("9 × 10⁻⁸");
    expect(formatValue(9.96e-8, { round: "up" })).toBe("1 × 10⁻⁷");
    expect(formatValue(3.0886440072208643e-9, { round: "down" })).toBe("3 × 10⁻⁹");
  });

  it("keeps a value on its own side of a limit", () => {
    // Under the limit stays under it, even rounding up.
    expect(formatValue(0.0049996002397847406, { round: "up", against: 0.005 })).toBe("0.0049997");
    // Over the limit stays over it, even rounding down.
    expect(formatValue(0.0200001, { round: "down", against: 0.02 })).toBe("0.0200001");
    // Equal stays equal.
    expect(formatValue(0.02, { round: "up", against: 0.02 })).toBe("0.02");
    expect(formatFixed(0.0999, 2, { round: "up", against: 0.1 })).toBe("0.0999");
  });

  it("formats percentages, points and degrees in each mode", () => {
    expect(formatPercent(0.5985822873877985)).toBe("59.9%");
    expect(formatPoints(-0.0625, 1, { round: "up" })).toBe("−6.3");
    expect(formatPoints(-0.0621, 1, { round: "up" })).toBe("−6.3");
    expect(formatSignedDegrees(1.0321, 2, { round: "up" })).toBe("+1.04°");
  });
});

describe("printed numbers agree with printed results, in both data files", () => {
  for (const [label, file] of Object.entries(FILES)) {
    it(`${label}: every measured gate`, () => {
      for (const gate of file.gates) {
        if (gate.measured === null) continue;
        const shown = shownNumber(gateMeasuredText({ ...gate, measured: gate.measured }));
        const limit = shownNumber(gateLimitText(gate));
        expect(shown, `${gate.id} is at least the true value`).toBeGreaterThanOrEqual(gate.measured);
        if (gateVerdict(gate) === "passed") expect(shown, `${gate.id} passed`).toBeLessThanOrEqual(limit);
        if (gateVerdict(gate) === "failed") expect(shown, `${gate.id} failed`).toBeGreaterThan(limit);
        if (gate.measured < gate.limit) expect(shown, `${gate.id} under its limit`).toBeLessThan(limit);
      }
    });

    it(`${label}: every comparison row against its mark`, () => {
      const items = checkReport(file)!.comparisons;
      for (const id of comparisonIds(items)) {
        const rows = comparisonRows(items, id);
        const kind = kindOf(rows);
        for (const row of rows) {
          const shown = Math.abs(shownNumber(measureText(row, kind)));
          const mark = shownNumber(markText(row.mark, kind));
          const where = `${id} ${row.siteId}`;
          if (row.verdict === "outside") expect(shown, `${where} outside`).toBeGreaterThan(mark);
          else expect(shown, `${where} within`).toBeLessThanOrEqual(mark);
        }
      }
    });

    it(`${label}: the chart's largest daily value against G2's limit`, () => {
      const g2 = file.gates.find((gate) => gate.id === "G2")!;
      const peak = g2Peak(file.g2_over_time);
      if (!peak) return;
      const shown = shownNumber(largestDegreesText(peak.value, g2.limit));
      expect(shown).toBeGreaterThanOrEqual(peak.value);
      expect(shown <= g2.limit).toBe(peak.value <= g2.limit);
    });
  }

  it("prints the real headline value as 0.0061°", () => {
    const g2 = FILES.derived.gates.find((gate) => gate.id === "G2")!;
    expect(g2.measured).toBe(REAL_G2);
    expect(gateMeasuredText({ ...g2, measured: REAL_G2 })).toBe("0.0061°");
  });
});
