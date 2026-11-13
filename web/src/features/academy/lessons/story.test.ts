import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const lessonsDir = fileURLToPath(new URL("./", import.meta.url));

describe("story dates", () => {
  it("reads the landing from worked examples and keeps no provisional date", () => {
    const source = readFileSync(`${lessonsDir}story.ts`, "utf8");
    expect(source).not.toContain("PROVISIONAL(story-date)");
    expect(source).not.toMatch(/"\d{4}-\d{2}-\d{2}T/);
    expect(source).toContain("{{example.story.landing_utc}}");
    for (const name of ["l1.ts", "l2.ts", "l3.ts", "l4.ts"]) {
      const lesson = readFileSync(`${lessonsDir}${name}`, "utf8");
      expect(lesson, name).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
    }
  });
});
