/**
 * The CSV writer's formula guard (docs/features/share-export.md, "Export data"): a string
 * cell a spreadsheet would run as a formula opens as text; a number stays a number.
 */

import { describe, expect, it } from "vitest";
import { neutraliseFormula, parseCsv, toCsv } from "./csv";

/** One data row, written and read back. */
function roundTrip(values: (string | number | null)[]): { raw: string; cells: string[] } {
  const header = values.map((_, i) => `c${i}`);
  const raw = toCsv([], header, [values]);
  const cells = parseCsv(raw).rows[0] ?? [];
  return { raw, cells };
}

describe("formula injection", () => {
  it.each([
    ["=CMD()", "'=CMD()"],
    ["+1+1", "'+1+1"],
    ["-2+3", "'-2+3"],
    ["@SUM(1,1)", "'@SUM(1,1)"],
    ["\tleading tab", "'\tleading tab"],
    ["\rleading return", "'\rleading return"],
    ["  =1+1", "'  =1+1"],
  ])("a string cell %j opens as text", (input, expected) => {
    expect(neutraliseFormula(input)).toBe(expected);
    expect(roundTrip([input]).cells[0]).toBe(expected);
  });

  it("still quotes a guarded cell that holds a comma", () => {
    const { raw } = roundTrip(["@SUM(1,1)"]);
    expect(raw).toContain(`"'@SUM(1,1)"`);
  });

  it("leaves ordinary text alone, and keeps commas, quotes and line breaks", () => {
    const name = 'Rim, "north", best-lit point';
    const note = "First line\nSecond line, with a comma";
    const { cells } = roundTrip([name, note, "Connecting Ridge", "a-b", "1.5 h"]);
    expect(cells).toEqual([name, note, "Connecting Ridge", "a-b", "1.5 h"]);
  });

  it("writes a negative number as a plain, unquoted number", () => {
    const { raw, cells } = roundTrip([-19.76, 0, -0.25, null]);
    const line = raw.split("\r\n")[1];
    expect(line).toBe("-19.76,0,-0.25,");
    expect(cells.slice(0, 3).map(Number)).toEqual([-19.76, 0, -0.25]);
  });

  it("guards each comma-separated part of a comment line", () => {
    const raw = toCsv(["Sites: a,=CMD(), @x", "Link: https://x.test/?a=1,b"], ["h"], []);
    const comments = parseCsv(raw).comments;
    expect(comments[0]).toBe("Sites: a,'=CMD(),' @x");
    expect(comments[1]).toBe("Link: https://x.test/?a=1,b");
  });
});
