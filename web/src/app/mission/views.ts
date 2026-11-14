import type { ComponentType } from "react";
import type { ExplainTerm } from "../../lib/explain";
import { DEFAULT_VIEW, type ViewId } from "../../state/scenario";
import type { PanelProps } from "../panel";
import Compare from "../../features/mission-control/compare";

export type { ViewId };

/** A place in the scene. Picking one moves the camera (CONTEXT.md, "Camera view"). */
export type CameraViewId = Extract<ViewId, "system" | "map" | "slip" | "terrain" | "panorama">;

/** A table that opens over the scene without moving the camera (CONTEXT.md, "Floating window"). */
export type WindowViewId = Extract<ViewId, "compare">;

type ViewBase = {
  /** The glossary name, exactly as in CONTEXT.md. */
  name: string;
  /** The explain.ts entry whose first sentence describes the view. */
  term: ExplainTerm;
};

export type CameraViewDefinition = ViewBase & { id: CameraViewId; kind: "camera" };

export type WindowViewDefinition = ViewBase & {
  id: WindowViewId;
  kind: "window";
  /** What the window shows. The Compare placeholder until MC9. */
  Panel: ComponentType<PanelProps>;
};

export type ViewDefinition = CameraViewDefinition | WindowViewDefinition;

/**
 * The five camera views, in the view bar's order. The Slip Planner is a place, the south pole
 * with your sites on it, between the Polar map and Local terrain (docs/features/slip-planner.md).
 */
export const CAMERA_VIEWS: readonly CameraViewDefinition[] = [
  { id: "system", kind: "camera", name: "System view", term: "system_view" },
  { id: "map", kind: "camera", name: "Polar map", term: "polar_map" },
  { id: "slip", kind: "camera", name: "Slip Planner", term: "slip_planner" },
  { id: "terrain", kind: "camera", name: "Local terrain", term: "local_terrain" },
  { id: "panorama", kind: "camera", name: "Lander's eye", term: "landers_eye" },
];

/** The one floating window, after the view bar's divider. */
export const WINDOW_VIEWS: readonly WindowViewDefinition[] = [
  { id: "compare", kind: "window", name: "Compare", term: "compare", Panel: Compare },
];

/** All six, in the view bar's order: the camera views, then the window. */
export const VIEWS: readonly ViewDefinition[] = [...CAMERA_VIEWS, ...WINDOW_VIEWS];

/** The camera view a new visitor lands on, and the one under a window opened from a link. */
export const HOME_CAMERA_VIEW: CameraViewId = "system";

export function isCameraView(view: ViewId): view is CameraViewId {
  return CAMERA_VIEWS.some((v) => v.id === view);
}

export function isWindowView(view: ViewId): view is WindowViewId {
  return WINDOW_VIEWS.some((v) => v.id === view);
}

export function cameraView(id: CameraViewId): CameraViewDefinition {
  return CAMERA_VIEWS.find((v) => v.id === id) ?? (CAMERA_VIEWS[0] as CameraViewDefinition);
}

export function windowView(id: WindowViewId): WindowViewDefinition {
  return WINDOW_VIEWS.find((v) => v.id === id) ?? (WINDOW_VIEWS[0] as WindowViewDefinition);
}

/**
 * What is on screen: the camera view, and the floating window open over it (or none).
 *
 * The scenario keeps one `view`, the link's `view` parameter. The rule that maps the two:
 *
 * - With no window open, `view` is the camera view.
 * - With a window open, `view` is the window (`compare`). The camera view under it is not in
 *   the link: it stays what it was in this page, and a link or a reload opens the window over
 *   the System view.
 *
 * So old links keep working and the link needs no new parameter: `view=slip`, which once
 * opened the Slip Planner's window, now opens its camera view
 * (docs/features/mission-control.md, "The view bar").
 */
export type ViewState = { camera: CameraViewId; window: WindowViewId | null };

/**
 * The view state for the scenario's `view`. `camera` is the camera view on screen before
 * this change, kept while a window opens over it; on load there is none and the home view
 * is used.
 */
export function viewState(view: ViewId, camera: CameraViewId = HOME_CAMERA_VIEW): ViewState {
  if (isCameraView(view)) return { camera: view, window: null };
  return { camera, window: view };
}

/** The scenario's `view` for a view state: the window when one is open, else the camera view. */
export function linkView(state: ViewState): ViewId {
  return state.window ?? state.camera;
}

/**
 * The scenario's next `view` when the user picks an entry in the view bar.
 *
 * - A camera view moves the camera there and closes any open window.
 * - A window opens over the current camera view.
 * - The window that is already open closes again.
 */
export function pickView(state: ViewState, picked: ViewId): ViewId {
  if (isCameraView(picked)) return picked;
  if (state.window === picked) return state.camera;
  return picked;
}

/** The scenario's `view` once the open window closes: the camera view under it. */
export function closeWindow(state: ViewState): ViewId {
  return state.camera;
}

/** The scenario store's own first-visit default, which must be a camera view. */
export const DEFAULT_CAMERA_VIEW: CameraViewId = isCameraView(DEFAULT_VIEW) ? DEFAULT_VIEW : HOME_CAMERA_VIEW;
