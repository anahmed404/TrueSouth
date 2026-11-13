import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { Manifest, MissionProfile } from "../../contracts/generated";
import { CHANGED_BY_YOU, PROFILE_FIELDS, createScenarioStore, type ScenarioCatalog } from "../../state/scenario";
import { joinUtc, splitUtc, utcDay } from "./landing";
import { FIELD_GROUPS, inputText, parseNumberInput, profileTitle, storeAccepted, withWeight } from "./profile-fields";
import { dropIndex, moveById, moveItem } from "./reorder";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..");
const fixtures = path.join(repoRoot, "data", "fixtures");
const catalog: ScenarioCatalog = {
  profiles: JSON.parse(readFileSync(path.join(fixtures, "profiles.json"), "utf8")) as MissionProfile[],
  sites: JSON.parse(readFileSync(path.join(fixtures, "sites.json"), "utf8")) as { id: string }[],
  grid: (JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as Manifest).time_grid,
};

describe("profile editor fields", () => {
  it("has exactly one row for every profile value field", () => {
    const fields = FIELD_GROUPS.flatMap((group) => group.fields.map((f) => f.field));
    expect([...fields].sort()).toEqual([...PROFILE_FIELDS].sort());
  });

  it("reads typed numbers, and an empty optional box as no limit", () => {
    expect(parseNumberInput("12", false)).toEqual({ ok: true, value: 12 });
    expect(parseNumberInput(" 6.5 ", false)).toEqual({ ok: true, value: 6.5 });
    expect(parseNumberInput("−3", false)).toEqual({ ok: true, value: -3 });
    expect(parseNumberInput(".5", false)).toEqual({ ok: true, value: 0.5 });
    expect(parseNumberInput("0,25", false)).toEqual({ ok: true, value: 0.25 });
    expect(parseNumberInput("", true)).toEqual({ ok: true, value: null });
    expect(parseNumberInput("", false)).toEqual({ ok: false });
    expect(parseNumberInput("1e3", false)).toEqual({ ok: false });
    expect(parseNumberInput("abc", true)).toEqual({ ok: false });
  });

  it("shows a value in its box without float noise", () => {
    expect(inputText(0.1 + 0.2)).toBe("0.3");
    expect(inputText(null)).toBe("");
    expect(inputText(10)).toBe("10");
  });

  it("changes one weight and keeps the other two", () => {
    expect(withWeight({ slope: 0.4, power: 0.35, comms: 0.25 }, "power", 0)).toEqual({ slope: 0.4, power: 0, comms: 0.25 });
  });

  it("names a changed profile after its base preset", () => {
    const athena = catalog.profiles.find((p) => p.id === "im2_athena") as MissionProfile;
    expect(profileTitle(athena, 0, "IM-2 Athena")).toBe("IM-2 Athena");
    expect(profileTitle({ ...athena, name: "Custom" }, 2, "IM-2 Athena")).toBe("Custom, based on IM-2 Athena");
  });
});

describe("which fields count as changed (through the scenario store)", () => {
  it("marks an edited field changed and assumed, and a reset clears it", () => {
    const store = createScenarioStore(catalog, "?profile=im2_athena");
    store.getState().editProfileField("max_dark_h", 8);
    let state = store.getState();
    expect(storeAccepted(state.profile, "max_dark_h", 8)).toBe(true);
    expect(state.changedFields).toEqual(["max_dark_h"]);
    expect(state.profile.provenance.max_dark_h).toEqual({ kind: "assumed", reason: CHANGED_BY_YOU });

    store.getState().resetProfileField("max_dark_h");
    state = store.getState();
    expect(state.changedFields).toEqual([]);
    expect(state.profile.id).toBe("im2_athena");
  });

  it("typing the preset's own value back is not a change", () => {
    const store = createScenarioStore(catalog, "?profile=im2_athena");
    store.getState().editProfileField("max_dark_h", 8);
    store.getState().editProfileField("max_dark_h", 6);
    expect(store.getState().changedFields).toEqual([]);
  });

  it("refuses an invalid value, so the editor can say so", () => {
    const store = createScenarioStore(catalog, "?profile=im2_athena");
    store.getState().editProfileField("slope_ideal_deg", 12); // above the 10° limit
    expect(storeAccepted(store.getState().profile, "slope_ideal_deg", 12)).toBe(false);
    expect(store.getState().changedFields).toEqual([]);

    const weights = { slope: 1, power: 0, comms: 0 };
    store.getState().editProfileField("weights", weights);
    expect(storeAccepted(store.getState().profile, "weights", weights)).toBe(false);
    expect(store.getState().notices.at(-1)).toMatch(/must not both be zero/);
  });
});

describe("reordering the selected sites", () => {
  it("moves an item and clamps out-of-range targets", () => {
    expect(moveItem(["a", "b", "c", "d"], 0, 2)).toEqual(["b", "c", "a", "d"]);
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
    expect(moveItem(["a", "b", "c"], 1, 99)).toEqual(["a", "c", "b"]);
    expect(moveItem(["a", "b"], 5, 0)).toEqual(["a", "b"]);
  });

  it("steps one place with the arrow keys and stops at the ends", () => {
    expect(moveById(["a", "b", "c"], "b", -1)).toEqual(["b", "a", "c"]);
    expect(moveById(["a", "b", "c"], "c", 1)).toEqual(["a", "b", "c"]);
    expect(moveById(["a", "b", "c"], "x", 1)).toEqual(["a", "b", "c"]);
  });

  it("drops a dragged row before the first row whose middle is below the pointer", () => {
    const middles = [20, 60, 100, 140];
    expect(dropIndex(10, middles, 2)).toBe(0);
    expect(dropIndex(70, middles, 0)).toBe(1);
    expect(dropIndex(130, middles, 0)).toBe(2);
    expect(dropIndex(500, middles, 0)).toBe(3);
    expect(dropIndex(95, middles, 2)).toBe(2);
  });
});

describe("landing date boxes", () => {
  it("splits and joins a UTC hour", () => {
    expect(splitUtc("2028-03-01T05:00:00Z")).toEqual({ date: "2028-03-01", hour: 5 });
    expect(splitUtc("2028-03-01T05:00Z")).toEqual({ date: "2028-03-01", hour: 5 });
    expect(splitUtc("2028-03-01 05:00")).toBeNull();
    expect(joinUtc("2028-03-01", 5)).toBe("2028-03-01T05:00:00Z");
    expect(utcDay("2031-12-22T00:00:00Z")).toBe("2031-12-22");
  });

  it("refuses dates that do not exist and hours off the clock", () => {
    expect(joinUtc("2028-02-30", 0)).toBeNull();
    expect(joinUtc("2028-02-29", 0)).toBe("2028-02-29T00:00:00Z");
    expect(joinUtc("2028-03-01", 24)).toBeNull();
    expect(joinUtc("", 0)).toBeNull();
  });
});
