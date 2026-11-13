import type { SceneStatus } from "../scene";

/**
 * What the scene slot shows for the scene's status: the scene itself (also while it has not
 * reported yet), or the still picture.
 *
 * After "Try 3D anyway", a slow scene is drawn anyway; a scene without WebGL still cannot be.
 */
export function sceneDisplay(status: SceneStatus | null, ignoreSlow: boolean): "scene" | "still" {
  if (status === "no-webgl") return "still";
  if (status === "slow" && !ignoreSlow) return "still";
  return "scene";
}

/** The still picture's note (docs/features/system-view.md, "When 3D does not run"). */
export function stillNote(status: SceneStatus): string {
  const why =
    status === "no-webgl"
      ? "This device could not start 3D, so this is a still picture of the System view."
      : "3D is slow on this device, so this is a still picture of the System view.";
  return `${why} The panels, timeline and windows still work.`;
}
