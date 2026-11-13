import { describe, expect, it } from "vitest";
import type { Site } from "../../contracts/generated";
import type { CustomEntry } from "../../state/custom-sites";
import { beforeComputing, checkForm, checkLatitude, checkLongitude, checkName, readDegrees, tierHint, toEastLongitude } from "./custom-site-form";
import { COMPUTING_TEXT, NOT_COMPUTED_TEXT, customRowView, formatClockUtc, formatElapsed } from "./custom-site-row";
import {
  ARTEMIS_NOTE,
  bestLitVariantOf,
  isArtemisCentre,
  isVariant,
  nearbyRangeText,
  parentOf,
  pickerOrder,
  upperReadingLine,
  variantLine,
} from "./site-labels";

const NNBSP = " ";
const BAD_WORDS = /undefined|NaN|null/;

describe("the coordinates form", () => {
  it("reads degrees as people type them", () => {
    expect(readDegrees("−88.5")).toBe(-88.5);
    expect(readDegrees(" -88.5° ")).toBe(-88.5);
    expect(readDegrees("45")).toBe(45);
    expect(readDegrees(".5")).toBe(0.5);
    for (const bad of ["", "-", "abc", "1e3", "45,5", "--1", "88.5S"]) expect(readDegrees(bad)).toBeNull();
  });

  it("checks latitude beside the field, as the user types", () => {
    expect(checkLatitude("")).toEqual({ value: null, message: null, note: null });
    expect(checkLatitude("-88.5")).toMatchObject({ value: -88.5, message: null });
    expect(checkLatitude("-91").message).toBe("Latitude runs from −90° (south pole) to 90°.");
    expect(checkLatitude("x").message).toBe("Type a number of degrees, such as −88.5.");
    expect(checkLatitude("-90").message).toBe("Latitude must be at least 0.001° away from a pole.");
    expect(checkLatitude("89.9995").message).toBe("Latitude must be at least 0.001° away from a pole.");
    expect(checkLatitude("-89.999").message).toBeNull();
    expect(checkLatitude("-88.123456").note).toBe("The server rounds it to −88.1235°.");
  });

  it("turns −180 to 180 into the east-positive longitude and says so", () => {
    expect(toEastLongitude(-45)).toBe(315);
    expect(toEastLongitude(360)).toBe(0);
    expect(toEastLongitude(45)).toBe(45);
    expect(checkLongitude("-45")).toEqual({ value: 315, message: null, note: "That is 315.0000° E." });
    expect(checkLongitude("−180")).toMatchObject({ value: 180, note: "That is 180.0000° E." });
    expect(checkLongitude("360")).toMatchObject({ value: 0, note: "That is 0.0000° E." });
    expect(checkLongitude("200")).toEqual({ value: 200, message: null, note: null });
    expect(checkLongitude("-181").message).toBe("East longitude runs from 0° to 360°, or −180° to 180°.");
    expect(checkLongitude("361").message).toBe("East longitude runs from 0° to 360°, or −180° to 180°.");
  });

  it("limits the name to what the server accepts", () => {
    expect(checkName("Ridge")).toBeNull();
    expect(checkName(`  ${"a".repeat(120)}  `)).toBeNull();
    expect(checkName("a".repeat(121))).toBe("A name can have at most 120 characters.");
  });

  it("is ready only with two good numbers", () => {
    expect(checkForm("-88.5", "45", "").ready).toBe(true);
    expect(checkForm("-88.5", "", "").ready).toBe(false);
    expect(checkForm("-95", "45", "").ready).toBe(false);
    expect(checkForm("-88.5", "45", "a".repeat(130)).ready).toBe(false);
  });

  it("says before computing what will happen, from the documented tier bounds", () => {
    expect(tierHint(-88.5)).toBe("core80");
    expect(tierHint(-80)).toBe("core80");
    expect(tierHint(-70)).toBe("wide240");
    expect(tierHint(-60)).toBe("wide240");
    expect(tierHint(-58)).toBe("sphere");
    expect(tierHint(0.67)).toBe("sphere");
    expect(beforeComputing(-88.5)).toBe("TrueSouth will compute this point from NASA's terrain. It takes about a minute.");
    expect(beforeComputing(-58)).toMatch(/^Outside our terrain maps: computed on a smooth Moon, with no mountains\./);
  });
});

function entry(overrides: Partial<CustomEntry> = {}): CustomEntry {
  return {
    key: "c_-88.5000_45.0000",
    siteId: "c_-88.5000_45.0000",
    latDeg: -88.5,
    lonDeg: 45,
    name: null,
    phase: "queued",
    position: null,
    site: null,
    problem: null,
    retryAtMs: null,
    sinceMs: 0,
    ...overrides,
  };
}

describe("a custom site's row", () => {
  it("says what is happening in each state, never a raw value", () => {
    const states: Partial<CustomEntry>[] = [
      { phase: "sending", siteId: null, key: "local-1" },
      { phase: "checking" },
      { phase: "queued", position: 2 },
      { phase: "queued", position: null },
      { phase: "running" },
      { phase: "not_computed" },
      { phase: "failed", problem: { kind: "offline", message: "The TrueSouth server is not answering, so custom sites cannot be computed right now.", fields: [], retryAfterS: null } },
      { phase: "failed", problem: null },
      { phase: "failed", retryAtMs: 90_000, problem: { kind: "rate_limited", message: "Slow down.", fields: [], retryAfterS: 90 } },
    ];
    for (const state of states) {
      const view = customRowView(entry(state), 31_000);
      const words = [view.title, view.coordinates, view.line, view.detail ?? "", view.primary?.label ?? "", view.close.label].join(" ");
      expect(words).not.toMatch(BAD_WORDS);
    }
  });

  it("shows the computing state with the queue position and the time so far", () => {
    const queued = customRowView(entry({ phase: "queued", position: 2, name: "My ridge" }), 31_000);
    expect(queued).toMatchObject({ title: "My ridge", coordinates: "−88.5000°, 45.0000° E", line: COMPUTING_TEXT, busy: true });
    expect(queued.detail).toBe("Number 2 in the queue · 0:31");
    expect(queued.close).toEqual({ action: "stop", label: "Stop waiting for My ridge" });
    expect(customRowView(entry({ phase: "running", sinceMs: 0 }), 75_000).detail).toBe("1:15 so far · usually about a minute");
    expect(customRowView(entry({ phase: "running" }), 0).title).toBe("Custom site");
  });

  it("offers Compute this site for a link's id the server does not have", () => {
    const view = customRowView(entry({ phase: "not_computed" }), 0);
    expect(view.line).toBe(NOT_COMPUTED_TEXT);
    expect(view.primary).toEqual({ action: "compute", label: "Compute this site", disabled: false });
    expect(view.close.action).toBe("remove");
  });

  it("says why it failed and offers Try again and Remove, waiting for Retry-After", () => {
    const failed = customRowView(entry({ phase: "failed", problem: { kind: "failed", message: "The server could not compute this site.", fields: [], retryAfterS: null } }), 0);
    expect(failed).toMatchObject({ line: "The server could not compute this site.", failed: true, primary: { label: "Try again", disabled: false } });
    expect(failed.close.label).toBe("Remove Custom site");
    const limited = customRowView(entry({ phase: "failed", retryAtMs: Date.parse("2028-03-01T14:32:00Z"), problem: { kind: "rate_limited", message: "Slow down.", fields: [], retryAfterS: 600 } }), Date.parse("2028-03-01T14:22:00Z"));
    expect(limited.primary?.disabled).toBe(true);
    expect(limited.detail).toBe("You can try again after 14:32 UTC.");
    const later = customRowView(entry({ phase: "failed", retryAtMs: 10, problem: null }), 20);
    expect(later.primary?.disabled).toBe(false);
  });

  it("formats times", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(-5)).toBe("0:00");
    expect(formatElapsed(725_000)).toBe("12:05");
    expect(formatClockUtc(Date.parse("2028-03-01T09:05:00Z"))).toBe("09:05 UTC");
  });
});

function site(id: string, overrides: Partial<Site> = {}): Site {
  return {
    id,
    name: id,
    group: "sunlit_peak",
    lat_deg: -89.45,
    lon_deg: 222.69,
    terrain_tier: "core80",
    elevation_m: 1000,
    slope: null,
    has_closeup: false,
    description: "",
    source_url: "",
    outcome: null,
    quickmap_url: "",
    moontrek_url: "",
    variant_of: null,
    offset_m: null,
    nearby_sun: null,
    ...overrides,
  };
}

const nearby = { radius_m: 160, points: 13, min: 0.3974903475727703, max: 0.8696149458331431 };
const ridge = site("ridge", { name: "Connecting Ridge", nearby_sun: nearby });
const ridgeBest = site("ridge_best_lit", { name: "Connecting Ridge, best-lit point", variant_of: "ridge", offset_m: 148.53657861694535, nearby_sun: nearby });

describe("sunlit-peak labels", () => {
  it("names a variant's distance from its parent, rounded to the metre", () => {
    expect(isVariant(ridgeBest)).toBe(true);
    expect(isVariant(ridge)).toBe(false);
    expect(variantLine(ridgeBest, "Connecting Ridge")).toBe(`Best-lit map pixel, 149${NNBSP}m from Connecting Ridge`);
    expect(variantLine(ridgeBest, null)).toBe(`Best-lit map pixel, 149${NNBSP}m from the listed point`);
    expect(variantLine(ridge, "x")).toBeNull();
  });

  it("calls a variant's sunlight an upper reading, with the radius from the data", () => {
    expect(upperReadingLine(ridgeBest, ridge)).toBe(`Its sunlight is an upper reading: the brightest of the map pixels within 160${NNBSP}m.`);
    expect(upperReadingLine({ ...ridgeBest, nearby_sun: null }, { ...ridge, nearby_sun: { ...nearby, radius_m: 200 } })).toBe(
      `Its sunlight is an upper reading: the brightest of the map pixels within 200${NNBSP}m.`,
    );
    expect(upperReadingLine({ ...ridgeBest, nearby_sun: null }, null)).toBe("Its sunlight is an upper reading: the brightest of the map pixels nearby.");
    expect(upperReadingLine(ridge, null)).toBeNull();
  });

  it("rounds the nearby range outward, so it never looks narrower than it is", () => {
    expect(nearbyRangeText(nearby)).toBe(`Within 160${NNBSP}m: 39${NNBSP}% to 87${NNBSP}%`);
    expect(nearbyRangeText({ radius_m: 160, points: 3, min: 0.29, max: 0.71 })).toBe(`Within 160${NNBSP}m: 29${NNBSP}% to 71${NNBSP}%`);
    expect(nearbyRangeText({ radius_m: 160, points: 3, min: 0.401, max: 0.401 })).toBe(`Within 160${NNBSP}m: 40${NNBSP}% to 41${NNBSP}%`);
    expect(nearbyRangeText({ radius_m: 160, points: 1, min: 0, max: 1 })).toBe(`Within 160${NNBSP}m: 0${NNBSP}% to 100${NNBSP}%`);
    expect(nearbyRangeText(null)).toBeNull();
    expect(nearbyRangeText(undefined)).toBeNull();
    expect(nearbyRangeText({ radius_m: Number.NaN, points: 1, min: 0, max: 1 })).toBeNull();
  });

  it("finds a site's variant and a variant's parent", () => {
    const sites = [ridge, ridgeBest];
    expect(bestLitVariantOf(ridge, sites)).toBe(ridgeBest);
    expect(bestLitVariantOf(ridgeBest, sites)).toBeNull();
    expect(parentOf(ridgeBest, sites)).toBe(ridge);
    expect(bestLitVariantOf(ridge, [ridge])).toBeNull();
  });

  it("sorts each variant directly under its parent in the picker", () => {
    const other = site("shackleton", { name: "Shackleton rim" });
    const otherBest = site("shackleton_best_lit", { variant_of: "shackleton", offset_m: 94 });
    const order = pickerOrder([ridge, other, otherBest, ridgeBest]).map((s) => s.id);
    expect(order).toEqual(["ridge", "ridge_best_lit", "shackleton", "shackleton_best_lit"]);
    // A variant whose parent is already selected keeps its own place.
    expect(pickerOrder([other, ridgeBest]).map((s) => s.id)).toEqual(["shackleton", "ridge_best_lit"]);
  });

  it("leaves today's 20-site catalog as it is", () => {
    const today = [ridge, site("artemis_haworth", { group: "artemis" }), site("apollo11", { group: "contrast", terrain_tier: "sphere" })].map((s) => ({
      ...s,
      nearby_sun: undefined,
      variant_of: undefined,
      offset_m: undefined,
    })) as Site[];
    expect(pickerOrder(today).map((s) => s.id)).toEqual(["ridge", "artemis_haworth", "apollo11"]);
    expect(today.map((s) => [isVariant(s), nearbyRangeText(s.nearby_sun), variantLine(s, null)])).toEqual([
      [false, null, null],
      [false, null, null],
      [false, null, null],
    ]);
  });

  it("notes that an Artemis entry is a map centre, never for a custom site", () => {
    expect(isArtemisCentre(site("artemis_haworth", { group: "artemis" }))).toBe(true);
    expect(isArtemisCentre(site("c_-86.0000_10.0000", { group: "artemis" }))).toBe(false);
    expect(isArtemisCentre(ridge)).toBe(false);
    expect(ARTEMIS_NOTE).toBe("This is the centre of a candidate region on NASA's map, not a chosen landing point.");
  });
});
