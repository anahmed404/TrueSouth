import { describe, expect, it } from "vitest";
import { decimalsFor, formatExample, formatNumber } from "./format-example";
import { fillPlaceholders, resolveValue } from "./placeholders";

describe("the rounding rule for worked-example numbers", () => {
  it("picks the decimals from the key's unit suffix", () => {
    expect(decimalsFor("l1.sun_el_max_deg")).toBe(2);
    expect(decimalsFor("l1.example_subsolar_lat")).toBe(2);
    expect(decimalsFor("l1.example_sun_az")).toBe(2);
    expect(decimalsFor("l4.example_earth_clear")).toBe(2);
    expect(decimalsFor("l2.ridge_dist_km")).toBe(1);
    expect(decimalsFor("l3.drop_at_20km_m")).toBe(0);
    expect(decimalsFor("l7.slip_blackout_h")).toBe(1);
    expect(decimalsFor("l4.earth_up_pct")).toBe(0);
    expect(decimalsFor("l6.example_score")).toBe(2);
  });

  it("rounds, drops trailing zeros and groups thousands", () => {
    expect(formatExample("l3.example_el_true_deg", 1.8649)).toBe("1.86");
    expect(formatExample("l1.sun_el_max_deg", 2.0)).toBe("2");
    expect(formatExample("l1.sun_el_max_deg", 1.5)).toBe("1.5");
    expect(formatExample("l3.drop_at_130km_m", 4864.0)).toBe("4,864");
    expect(formatExample("l3.drop_at_20km_m", 115.1)).toBe("115");
    expect(formatExample("l2.ridge_dist_km", 12.345)).toBe("12.3");
    expect(formatExample("l6.example_score", 78.8125)).toBe("78.81");
  });

  it("writes a negative with a true minus, and never −0", () => {
    expect(formatExample("l4.earth_el_min_deg", -0.7)).toBe("−0.7");
    expect(formatExample("l4.earth_el_min_deg", -0.001)).toBe("0");
    expect(formatNumber(-1234.5, 0)).toBe("−1,235");
  });

  it("writes yes/no, text and lists", () => {
    expect(formatExample("l6.example_metrics.landing_lit", true)).toBe("yes");
    expect(formatExample("l2.ridge_feature", "Synthetic crater rim")).toBe("Synthetic crater rim");
    expect(formatExample("l7.slip_vetoes", ["blackout", "darkness"])).toBe("blackout, darkness");
  });

  it("is the rule lesson text uses too", () => {
    expect(fillPlaceholders("{{example.l3.drop_at_130km_m}} m", { "l3.drop_at_130km_m": 4864 }).text).toBe("4,864 m");
  });

  it("leaves goal values unrounded", () => {
    expect(resolveValue("{{example.l3.drop_at_20km_m}}", { "l3.drop_at_20km_m": 115.1 }).value).toBe(115.1);
  });
});
