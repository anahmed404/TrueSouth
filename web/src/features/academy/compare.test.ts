import { describe, expect, it } from "vitest";
import { comparedDecimals, comparisonWord, MAX_COMPARE_DECIMALS, precisionFor } from "./compare";
import { exampleText } from "./placeholders";

const WORDS = { less: "lower than", more: "higher than", same: "as high as" };
const FLAT = "l3.example_el_flat_deg";
const TRUE = "l3.example_el_true_deg";

function printed(examples: Record<string, unknown>, keys: string[]): (string | null)[] {
  const precision = precisionFor([keys], examples);
  return keys.map((key) => exampleText(examples, key, precision.get(key)));
}

describe("a compared set", () => {
  it("gains decimals until values that differ print differently: 1.864 against 1.861", () => {
    const examples = { [TRUE]: 1.861, [FLAT]: 1.864 };
    expect(exampleText(examples, TRUE)).toBe(exampleText(examples, FLAT)); // alone, both are 1.86
    expect(comparedDecimals([TRUE, FLAT], examples)).toEqual({ min: 1, max: 3 });
    expect(printed(examples, [TRUE, FLAT])).toEqual(["1.861", "1.864"]);
    expect(comparisonWord(examples, TRUE, FLAT, WORDS)).toBe("lower than");
  });

  it("prints equal values the same and says so", () => {
    const examples = { [TRUE]: 1.86, [FLAT]: 1.86 };
    expect(comparedDecimals([TRUE, FLAT], examples)).toEqual({ min: 1, max: 2 });
    expect(printed(examples, [TRUE, FLAT])).toEqual(["1.86", "1.86"]);
    expect(comparisonWord(examples, TRUE, FLAT, WORDS)).toBe("as high as");
  });

  it("follows the data when the pair is reversed", () => {
    const examples = { [TRUE]: 1.864, [FLAT]: 1.861 };
    expect(printed(examples, [TRUE, FLAT])).toEqual(["1.864", "1.861"]);
    expect(comparisonWord(examples, TRUE, FLAT, WORDS)).toBe("higher than");
    expect(comparisonWord(examples, FLAT, TRUE, WORDS)).toBe("lower than");
  });

  it("keeps the keys' own decimals when they already differ", () => {
    const examples = { [TRUE]: 1.86, [FLAT]: 1.91 };
    expect(printed(examples, [TRUE, FLAT])).toEqual(["1.86", "1.91"]);
    expect(comparisonWord(examples, TRUE, FLAT, WORDS)).toBe("lower than");
  });

  it(`stops at ${MAX_COMPARE_DECIMALS} decimals, where a smaller gap prints and reads as the same`, () => {
    const examples = { [TRUE]: 1.86001, [FLAT]: 1.86002 };
    expect(comparedDecimals([TRUE, FLAT], examples).max).toBe(MAX_COMPARE_DECIMALS);
    // Both round to 1.8600, and trailing zeros are dropped.
    expect(printed(examples, [TRUE, FLAT])).toEqual(["1.86", "1.86"]);
    expect(comparisonWord(examples, TRUE, FLAT, WORDS)).toBe("as high as");
  });

  it("works for three values and for negative ones", () => {
    const keys = ["a_deg", "b_deg", "c_deg"];
    const examples = { a_deg: -0.4012, b_deg: -0.4018, c_deg: -0.4 };
    expect(printed(examples, keys)).toEqual(["−0.401", "−0.402", "−0.4"]);
  });

  it("gives no word when a value is missing or not a number", () => {
    expect(comparisonWord({ [TRUE]: 1.86 }, TRUE, FLAT, WORDS)).toBeNull();
    expect(comparisonWord({ [TRUE]: 1.86, [FLAT]: null }, TRUE, FLAT, WORDS)).toBeNull();
    expect(comparisonWord({ [TRUE]: "high", [FLAT]: 1 }, TRUE, FLAT, WORDS)).toBeNull();
  });
});
