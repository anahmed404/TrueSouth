import { describe, expect, it } from "vitest";
import { DECORATION_SHORT, decorationDisclosure, sceneContent, visiblePlates, type PlateInput } from "./plates";

const ridge = { name: "Connecting Ridge", sphere: false };
const apollo = { name: "Apollo 11", sphere: true };

function input(change: Partial<PlateInput> = {}): PlateInput {
  return { view: "system", trueScale: false, system: "ready", site: ridge, series: "ready", terrain: "ready", apron: "ready", ...change };
}

const ids = (change: Partial<PlateInput>) => sceneContent(input(change)).plates.map((p) => p.id);

describe("what the scene draws for each load state", () => {
  it("draws everything when every file is in", () => {
    const content = sceneContent(input());
    expect(content).toMatchObject({ bodies: true, sightLines: true, ground: "terrain" });
    // No plate at all: the scale is explained in the view's About text, not on the scene.
    expect(content.plates).toEqual([]);
    expect(sceneContent(input({ trueScale: true })).plates).toEqual([]);
  });

  it("without system.bin: no Sun, no Earth, no distance, and a plate that says why", () => {
    const content = sceneContent(input({ system: "error" }));
    expect(content.bodies).toBe(false);
    expect(content.plates.map((p) => p.text)).toEqual([
      "The positions of the Sun and Earth could not be loaded, so they are not drawn.",
    ]);
    // The same in every camera view.
    for (const view of ["map", "terrain", "panorama"] as const) {
      expect(sceneContent(input({ view, system: "error" })).bodies).toBe(false);
      expect(ids({ view, system: "error" })).toContain("system-error");
    }
  });

  it("while system.bin loads: no bodies yet, and no not-to-scale line about bodies that are not there", () => {
    const content = sceneContent(input({ system: "loading" }));
    expect(content.bodies).toBe(false);
    expect(content.plates).toEqual([]);
  });

  it("without the series: no sight-lines and no state, with a plate", () => {
    const content = sceneContent(input({ series: "error" }));
    expect(content.sightLines).toBe(false);
    expect(ids({ series: "error" })).toContain("series-error");
    expect(sceneContent(input({ series: "loading" })).sightLines).toBe(false);
    expect(ids({ series: "loading" })).not.toContain("series-error");
  });

  it("a failed terrain file shows the smooth Moon in Local terrain and Lander's eye, and says so", () => {
    for (const view of ["terrain", "panorama"] as const) {
      const content = sceneContent(input({ view, terrain: "error" }));
      expect(content.ground).toBe("smooth");
      expect(content.plates.map((p) => p.text)).toEqual([
        "The terrain for Connecting Ridge could not be loaded. Showing the smooth Moon.",
        // No series answer passed in this input: the plate says only what the drawing is.
        "Shading, shadows and the fine ground texture are drawn for understanding only. Where the drawing differs, the series is right.",
      ]);
    }
  });

  it("a failed apron keeps the patch and says the wider terrain is missing", () => {
    const content = sceneContent(input({ view: "terrain", apron: "error" }));
    expect(content.ground).toBe("terrain");
    expect(content.plates.map((p) => p.id)).toEqual(["apron-error", "decoration"]);
  });

  it("a site with no apron by design (a custom site): the patch alone, and nothing reported missing", () => {
    const content = sceneContent(input({ view: "terrain", apron: "none" }));
    expect(content.ground).toBe("terrain");
    expect(content.plates.map((p) => p.id)).toEqual(["decoration"]);
  });

  it("terrain still loading says so, as a status", () => {
    const content = sceneContent(input({ view: "terrain", terrain: "loading" }));
    expect(content.ground).toBe("none");
    expect(content.plates).toEqual([{ id: "terrain-loading", text: "Loading the ground around Connecting Ridge…", status: true }]);
  });

  it("a sphere-tier site: the smooth Moon and the way back to the System view", () => {
    const content = sceneContent(input({ view: "panorama", site: apollo, terrain: "error", apron: "error" }));
    expect(content.ground).toBe("smooth");
    expect(content.plates).toEqual([
      { id: "sphere", text: "No terrain data for Apollo 11. This is the smooth Moon.", action: "show-system" },
      { id: "decoration", text: "Shading, shadows and the fine ground texture are drawn for understanding only. Where the drawing differs, the series is right.", place: "foot" },
    ]);
  });

  it("no focused site: points to the sites rail", () => {
    const content = sceneContent(input({ view: "terrain", site: null }));
    expect(content.plates.map((p) => p.text)).toEqual(["Pick a site in the sites rail to see its ground."]);
    expect(content.sightLines).toBe(false);
  });
});

describe("the plate that says the drawn ground is decoration", () => {
  const plate = (change: Partial<PlateInput>) => sceneContent(input(change)).plates.find((p) => p.id === "decoration");

  it("is shown wherever the ground is drawn: Local terrain and Lander's eye", () => {
    expect(plate({ view: "terrain" })).toBeDefined();
    expect(plate({ view: "panorama" })).toBeDefined();
    expect(plate({ view: "panorama", site: apollo })).toBeDefined();
  });

  it("is not shown where no ground is drawn", () => {
    expect(plate({ view: "system" })).toBeUndefined();
    expect(plate({ view: "map" })).toBeUndefined();
    expect(plate({ view: "terrain", terrain: "loading" })).toBeUndefined();
    expect(plate({ view: "terrain", site: null })).toBeUndefined();
  });

  it("gives the series' answer first, in the words of local-terrain.md", () => {
    expect(plate({ view: "terrain", sun: { lit: true, discFraction: 0.6243 } })).toEqual({
      id: "decoration",
      text: "The series says: lit. 62 % of the Sun's disc is above the skyline.",
      note: "Shading, shadows and the fine ground texture are drawn for understanding only. Where the drawing differs, the series is right.",
      place: "foot",
    });
    expect(plate({ view: "terrain", sun: { lit: false, discFraction: 0.1234 } })?.text).toBe(
      "The series says: dark. Sun disc fraction 0.12 above the skyline.",
    );
  });

  it("follows the series' flag, never the drawing: a dark hour with part of the disc up still says dark", () => {
    expect(plate({ view: "terrain", sun: { lit: false, discFraction: 0.59 } })?.text).toMatch(/^The series says: dark\./);
  });

  it("in Lander's eye is one line: the horizon bar there already gives the series' answer", () => {
    const eye = plate({ view: "panorama", sun: { lit: true, discFraction: 0.59 } });
    expect(eye?.text).toMatch(/^Shading, shadows and the fine ground texture are drawn for understanding only\./);
    expect(eye?.note).toBeUndefined();
  });

  it("without the series' answer says only what the drawing is", () => {
    expect(plate({ view: "terrain", sun: null })).toEqual({
      id: "decoration",
      text: "Shading, shadows and the fine ground texture are drawn for understanding only. Where the drawing differs, the series is right.",
      place: "foot",
    });
    expect(plate({ view: "terrain", sun: { lit: true, discFraction: Number.NaN } })?.note).toBeUndefined();
  });
});

describe("the decoration plate is on screen wherever the drawing is (visiblePlates)", () => {
  const content = sceneContent(input({ view: "terrain", sun: { lit: true, discFraction: 1 } }));
  const decoration = content.plates.find((p) => p.id === "decoration")!;
  const other = { id: "apron-error", text: "The terrain beyond 10 km could not be loaded." };
  const plates = [other, decoration];
  const roomy = { width: 900, height: 500, windowOpen: false };

  it("roomy: the full plate at the foot, other plates at the top", () => {
    expect(decorationDisclosure(roomy)).toBe("full");
    expect(visiblePlates(plates, roomy, false)).toEqual({ top: [other], foot: [decoration] });
  });

  it("the phone's free space (374 × 300) still takes the full plate", () => {
    expect(visiblePlates(plates, { width: 374, height: 300, windowOpen: false }, false).foot).toEqual([decoration]);
  });

  it("a floating window open (Compare over Local terrain): other plates hide, the decoration shortens to one line", () => {
    const beside = { width: 420, height: 380, windowOpen: true };
    expect(visiblePlates(plates, beside, true)).toEqual({ top: [], foot: [{ id: "decoration", text: DECORATION_SHORT, place: "foot" }] });
  });

  it("a tight free space: one line, even where the overlay hides everything else", () => {
    const tight = { width: 210, height: 60, windowOpen: false };
    expect(decorationDisclosure(tight)).toBe("short");
    expect(visiblePlates(plates, tight, true).foot).toEqual([{ id: "decoration", text: DECORATION_SHORT, place: "foot" }]);
  });

  it("no room for even one line: no plate, and the scene draws the ground plain (see ground-material.test.ts)", () => {
    for (const space of [
      { width: 180, height: 300, windowOpen: false },
      { width: 600, height: 40, windowOpen: true },
      { width: 0, height: 0, windowOpen: true },
    ]) {
      expect(decorationDisclosure(space)).toBe("none");
      expect(visiblePlates(plates, space, true).foot).toEqual([]);
    }
  });

  it("the short line names both made-up things", () => {
    expect(DECORATION_SHORT).toBe("Shadows and ground texture are illustrative.");
  });
});
