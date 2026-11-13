import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const lessonsDir = fileURLToPath(new URL("./", import.meta.url));

/** Every provisional story instant, in the order `story.ts` writes them. */
const PROVISIONAL_STORY_DATES = ["2028-01-01T00:00:00Z", "2028-01-01T00:00:00Z"] as const;

describe("provisional story dates", () => {
  it("lists every provisional value, and keeps them all in story.ts", () => {
    const source = readFileSync(`${lessonsDir}story.ts`, "utf8");
    const dates = [...source.matchAll(/"(\d{4}-\d{2}-\d{2}T[^"]+)"/g)].map((match) => match[1]);
    expect(dates).toEqual([...PROVISIONAL_STORY_DATES]);
    for (const line of source.split("\n")) {
      if (/"\d{4}-\d{2}-\d{2}T/.test(line)) expect(line).toContain("PROVISIONAL(story-date)");
    }
    for (const name of ["l1.ts", "l2.ts", "l3.ts", "l4.ts"]) {
      const lesson = readFileSync(`${lessonsDir}${name}`, "utf8");
      expect(lesson, name).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });
});
