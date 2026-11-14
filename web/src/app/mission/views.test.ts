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
  it("has the five camera views, the Slip Planner between the Polar map and Local terrain", () => {
    expect(CAMERA_VIEWS.map((v) => v.id)).toEqual(["system", "map", "slip", "terrain", "panorama"]);
    expect(CAMERA_VIEWS.map((v) => v.name)).toEqual(["System view", "Polar map", "Slip Planner", "Local terrain", "Lander's eye"]);
  });

  it("has the one window after them: Compare", () => {
    expect(WINDOW_VIEWS.map((v) => v.id)).toEqual(["compare"]);
    expect(WINDOW_VIEWS.map((v) => v.name)).toEqual(["Compare"]);
    expect(VIEWS.map((v) => v.id)).toEqual(["system", "map", "slip", "terrain", "panorama", "compare"]);
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
    for (const id of ["system", "map", "slip", "terrain", "panorama"] as const) {
      expect(viewState(id)).toEqual({ camera: id, window: null });
    }
  });

  it("an old link with view=slip opens the Slip Planner's camera view, not a window", () => {
    expect(viewState("slip")).toEqual({ camera: "slip", window: null });
    expect(viewState("slip", "terrain")).toEqual({ camera: "slip", window: null });
  });

  it("a window in the link opens over the System view on load", () => {
    expect(viewState("compare")).toEqual({ camera: "system", window: "compare" });
  });

  it("a window opened in the page keeps the camera view under it", () => {
    expect(viewState("compare", "terrain")).toEqual({ camera: "terrain", window: "compare" });
    expect(viewState("compare", "slip")).toEqual({ camera: "slip", window: "compare" });
  });

  it("round-trips every view through the link", () => {
    for (const id of STORE_VIEWS) expect(linkView(viewState(id))).toBe(id);
  });
});

describe("picking in the view bar", () => {
  const onMap: ViewState = { camera: "map", window: null };
  const compareOverMap: ViewState = { camera: "map", window: "compare" };

  it("a camera view moves the camera", () => {
    expect(pickView(onMap, "terrain")).toBe("terrain");
    expect(pickView(onMap, "slip")).toBe("slip");
  });

  it("a window opens over the camera view without moving it", () => {
    const next = pickView(onMap, "compare");
    expect(next).toBe("compare");
    expect(viewState(next, onMap.camera)).toEqual(compareOverMap);
  });

  it("the open window's button closes it again", () => {
    expect(pickView(compareOverMap, "compare")).toBe("map");
  });

  it("a camera view closes an open window, the Slip Planner too", () => {
    expect(pickView(compareOverMap, "panorama")).toBe("panorama");
    expect(viewState(pickView(compareOverMap, "slip"), "map")).toEqual({ camera: "slip", window: null });
  });

  it("closing a window returns to the camera view under it", () => {
    expect(closeWindow(compareOverMap)).toBe("map");
  });
});
