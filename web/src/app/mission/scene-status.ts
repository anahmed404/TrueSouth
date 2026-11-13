import type { CameraViewId, SceneMode, SceneReport, SceneStatus } from "../scene";
import { cameraView } from "./views";

/**
 * How the scene must draw: flat when WebGL is missing, or when the scene is slow and the user
 * has not pressed "Try 3D anyway"; otherwise in 3D (also before the scene has reported).
 */
export function sceneMode(status: SceneStatus | null, ignoreSlow: boolean): SceneMode {
  if (status === "no-webgl") return "flat";
  if (status === "slow" && !ignoreSlow) return "flat";
  return "3d";
}

/**
 * Whether the shell shows its still picture over the scene: in flat mode, for a camera view
 * the scene has not said it can draw flat. Never in the Slip Planner: with 3D off it draws
 * its own flat ground under the same spots (docs/features/slip-planner.md, "When 3D is off"),
 * in place of the still picture for this view only.
 */
export function showStill(mode: SceneMode, report: SceneReport | null, view: CameraViewId): boolean {
  if (mode === "3d") return false;
  if (view === "slip") return false;
  return !(report?.flatViews ?? []).includes(view);
}

/** The view's name as it reads in a sentence: "the System view", "Local terrain". */
function viewPhrase(view: CameraViewId): string {
  const name = cameraView(view).name;
  return view === "system" || view === "map" ? `the ${name}` : name;
}

/** The still picture's note (docs/features/system-view.md, "When 3D does not run"). */
export function stillNote(status: SceneStatus, view: CameraViewId): string {
  const why = status === "no-webgl" ? "This device could not start 3D" : "3D is slow on this device";
  return `${why}, so ${viewPhrase(view)} shows a still picture instead of the 3D scene. The panels, timeline and windows still work.`;
}

/** The still picture's accessible name. */
export function stillLabel(view: CameraViewId): string {
  return `Still picture of the System view in place of the 3D scene, for ${viewPhrase(view)}: the Moon half lit, with the Sun and Earth on either side.`;
}

/** What the status region says after "Try 3D anyway". */
export const TRY_AGAIN_ANNOUNCEMENT = "Trying the 3D scene again.";
