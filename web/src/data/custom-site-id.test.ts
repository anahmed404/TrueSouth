import { describe, expect, it } from "vitest";
import { NAME_MAX, canonicalCustomId, cleanSiteName, isCanonicalCustomId, roundTo4, siteNameTooLong } from "./custom-site-id.ts";
import { isCustomSiteId, siteBase } from "./paths.ts";

describe("the server's custom-site id", () => {
  it("rounds like Python: the exact binary value, exact ties to even", () => {
    expect(roundTo4(1.03125)).toBe("1.0312");
    expect(roundTo4(1.03135)).toBe("1.0313");
    expect(roundTo4(-1.03125)).toBe("-1.0312");
    expect(roundTo4(-88.50005)).toBe("-88.5001");
    expect(roundTo4(-88.50004)).toBe("-88.5000");
    expect(roundTo4(0)).toBe("0.0000");
    expect(roundTo4(359.99995)).toBe("360.0000");
    expect(roundTo4(45)).toBe("45.0000");
  });

  it("makes the id the server makes", () => {
    const cases: [number, number, string][] = [
      [-89.2, 130.5, "c_-89.2000_130.5000"],
      [-88.5, 45, "c_-88.5000_45.0000"],
      [10, 359.99995, "c_10.0000_0.0000"],
      [10, 360, "c_10.0000_0.0000"],
      [10, -45, "c_10.0000_315.0000"],
      [10, -360, "c_10.0000_0.0000"],
      [10, 720.5, "c_10.0000_0.5000"],
      [-0.00001, 10, "c_0.0000_10.0000"],
      [-0, 0, "c_0.0000_0.0000"],
      [10, -1e-20, "c_10.0000_0.0000"],
      [90, 123, "c_90.0000_0.0000"],
      [-90, 45, "c_-90.0000_0.0000"],
      [-89.99996, 45, "c_-90.0000_0.0000"],
    ];
    for (const [lat, lon, id] of cases) expect(canonicalCustomId(lat, lon)).toBe(id);
    for (const [lat, lon] of [[91, 0], [-90.1, 0], [Number.NaN, 0], [0, Number.POSITIVE_INFINITY]]) {
      expect(canonicalCustomId(lat as number, lon as number)).toBeNull();
    }
  });

  it("accepts only canonical ids in range", () => {
    for (const good of ["c_-89.2000_130.5000", "c_89.2000_130.5000", "c_0.0000_0.0000", "c_-0.5000_359.9999", "c_-90.0000_0.0000", "c_90.0000_0.0000"]) {
      expect(isCanonicalCustomId(good)).toBe(true);
      expect(isCustomSiteId(good)).toBe(true);
    }
    for (const bad of [
      "c_999.0000_999.0000",
      "c_-0.0000_10.0000",
      "c_-90.0000_10.0000",
      "c_10.0000_360.0000",
      "c_10.0000_-1.0000",
      "c_-89.200_130.5000",
      "c_-89.20000_130.5000",
      "c_+1.0000_1.0000",
      "c_01.0000_1.0000",
      "c_91.0000_1.0000",
      "c_1.0000_01.0000",
      "c_-89.2000_130.5000 ",
      "connecting_ridge",
    ]) {
      expect(isCanonicalCustomId(bad)).toBe(false);
      expect(isCustomSiteId(bad)).toBe(false);
    }
  });

  it("routes only a valid custom id to the API", () => {
    expect(siteBase("c_-88.5000_45.0000")).toBe("/api/custom/c_-88.5000_45.0000");
    expect(siteBase("connecting_ridge")).toBe("/data/sites/connecting_ridge");
  });
});

describe("names", () => {
  it("removes control and bidirectional characters and collapses spaces", () => {
    expect(cleanSiteName("‮etis ruoy")).toBe("etis ruoy");
    expect(cleanSiteName("A‪B‫C‬D‭E⁦F⁧G⁨H⁩I‎J‏K؜L")).toBe("ABCDEFGHIJKL");
    expect(cleanSiteName("Ri\u0000dg\u0007e\u001b\u007f\u0085")).toBe("Ridge");
    expect(cleanSiteName("  Ridge \t\n  east  ")).toBe("Ridge east");
    expect(cleanSiteName("مرتفع الشرق")).toBe("مرتفع الشرق");
  });

  it("caps the length at 60 characters, counting emoji as one", () => {
    expect(cleanSiteName("x".repeat(500))).toBe("x".repeat(NAME_MAX));
    expect(Array.from(cleanSiteName("🌕".repeat(80)) ?? "")).toHaveLength(NAME_MAX);
    expect(siteNameTooLong("x".repeat(60))).toBe(false);
    expect(siteNameTooLong("x".repeat(61))).toBe(true);
    expect(siteNameTooLong(`‮${"x".repeat(60)}‬`)).toBe(false);
  });

  it("gives null for nothing", () => {
    for (const empty of ["", "   ", "‮‬", null, undefined]) expect(cleanSiteName(empty)).toBeNull();
  });
});
