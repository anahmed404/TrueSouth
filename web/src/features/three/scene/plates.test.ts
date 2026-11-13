import { describe, expect, it } from "vitest";
import { sceneContent, type PlateInput } from "./plates";

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
      ]);
    }
  });

  it("a failed apron keeps the patch and says the wider terrain is missing", () => {
    const content = sceneContent(input({ view: "terrain", apron: "error" }));
    expect(content.ground).toBe("terrain");
    expect(content.plates.map((p) => p.id)).toEqual(["apron-error"]);
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
    ]);
  });

  it("no focused site: points to the sites rail", () => {
    const content = sceneContent(input({ view: "terrain", site: null }));
    expect(content.plates.map((p) => p.text)).toEqual(["Pick a site in the sites rail to see its ground."]);
    expect(content.sightLines).toBe(false);
  });
});
