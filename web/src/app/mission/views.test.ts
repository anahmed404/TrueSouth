import { describe, expect, it } from "vitest";
import { VIEWS as STORE_VIEWS } from "../../state/scenario";
import {
  CAMERA_VIEWS,
  DEFAULT_CAMERA_VIEW,
  VIEWS,
  WINDOW_VIEWS,
  closeWindow,
  isCameraView,
  isWindowView,
  linkView,
  pickView,
  viewState,
  type ViewState,
} from "./views";

describe("which views are camera views and which are windows", () => {
  it("has the four camera views, in the view bar's order", () => {
    expect(CAMERA_VIEWS.map((v) => v.id)).toEqual(["system", "map", "terrain", "panorama"]);
    expect(CAMERA_VIEWS.map((v) => v.name)).toEqual(["System view", "Polar map", "Local terrain", "Lander's eye"]);
  });

  it("has the two windows after them", () => {
    expect(WINDOW_VIEWS.map((v) => v.id)).toEqual(["slip", "compare"]);
    expect(WINDOW_VIEWS.map((v) => v.name)).toEqual(["Slip Planner", "Compare"]);
    expect(VIEWS.map((v) => v.id)).toEqual(["system", "map", "terrain", "panorama", "slip", "compare"]);
  });

  it("covers every view the scenario store knows, each exactly once", () => {
    expect([...VIEWS.map((v) => v.id)].sort()).toEqual([...STORE_VIEWS].sort());
    for (const id of STORE_VIEWS) expect(isCameraView(id) !== isWindowView(id)).toBe(true);
  });

  it("lands a new visitor on the System view", () => {
    expect(DEFAULT_CAMERA_VIEW).toBe("system");
  });
});

describe("the link's view and what is on screen", () => {
  it("a camera view in the link is that camera view, with no window", () => {
    for (const id of ["system", "map", "terrain", "panorama"] as const) {
      expect(viewState(id)).toEqual({ camera: id, window: null });
    }
  });

  it("a window in the link opens over the System view on load", () => {
    expect(viewState("slip")).toEqual({ camera: "system", window: "slip" });
    expect(viewState("compare")).toEqual({ camera: "system", window: "compare" });
  });

  it("a window opened in the page keeps the camera view under it", () => {
    expect(viewState("compare", "terrain")).toEqual({ camera: "terrain", window: "compare" });
  });

  it("round-trips every view through the link", () => {
    for (const id of STORE_VIEWS) expect(linkView(viewState(id))).toBe(id);
  });
});

describe("picking in the view bar", () => {
  const onMap: ViewState = { camera: "map", window: null };
  const slipOverMap: ViewState = { camera: "map", window: "slip" };

  it("a camera view moves the camera", () => {
    expect(pickView(onMap, "terrain")).toBe("terrain");
  });

  it("a window opens over the camera view without moving it", () => {
    const next = pickView(onMap, "slip");
    expect(next).toBe("slip");
    expect(viewState(next, onMap.camera)).toEqual(slipOverMap);
  });

  it("the open window's button closes it again", () => {
    expect(pickView(slipOverMap, "slip")).toBe("map");
  });

  it("the other window replaces it", () => {
    expect(pickView(slipOverMap, "compare")).toBe("compare");
  });

  it("a camera view closes an open window", () => {
    expect(pickView(slipOverMap, "panorama")).toBe("panorama");
  });

  it("closing a window returns to the camera view under it", () => {
    expect(closeWindow(slipOverMap)).toBe("map");
  });
});
