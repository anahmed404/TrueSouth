import { describe, expect, it } from "vitest";
import { fillPlaceholders } from "./placeholders";

describe("fillPlaceholders", () => {
  it("fills a key and stringifies a number", () => {
    const filled = fillPlaceholders("Height {{example.l1.sun_el_max_deg}} degrees.", {
      "l1.sun_el_max_deg": 2.5,
    });
    expect(filled).toEqual({ text: "Height 2.5 degrees.", missing: [] });
  });

  it("reports a missing key and leaves the placeholder in place", () => {
    const filled = fillPlaceholders("A {{example.known}} B {{example.missing}}.", { known: 3 });
    expect(filled).toEqual({
      text: "A 3 B {{example.missing}}.",
      missing: ["missing"],
    });
  });

  it("reports every missing key, including a repeated one", () => {
    const filled = fillPlaceholders("{{example.a}} {{example.b}} {{example.a}}", {});
    expect(filled.missing).toEqual(["a", "b", "a"]);
    expect(filled.text).toBe("{{example.a}} {{example.b}} {{example.a}}");
  });

  it("leaves text with no placeholders unchanged", () => {
    expect(fillPlaceholders("No tokens here.", { unused: 1 })).toEqual({
      text: "No tokens here.",
      missing: [],
    });
  });
});
