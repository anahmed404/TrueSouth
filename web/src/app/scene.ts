import type { FreeSpace } from "./mission/free-space";
import type { CameraViewId } from "./mission/views";
import type { Scenario } from "./panel";

export type { FreeSpace, Rect } from "./mission/free-space";
export type { CameraViewId } from "./mission/views";

/**
 * How the scene is doing, reported once it knows:
 *
 * - "ready": it draws, and its first camera flight was fast enough.
 * - "slow": the first flight's median frame was over the threshold in
 *   docs/features/system-view.md ("When 3D does not run").
 * - "no-webgl": WebGL could not start.
 *
 * On "slow" or "no-webgl" the shell puts the still picture behind the interface, with the
 * note and "Try 3D anyway".
 */
export type SceneStatus = "ready" | "slow" | "no-webgl";

/**
 * Everything the shell gives the 3D scene (work package T1). The scene fills the window
 * behind the floating interface. It draws no text straight on itself: labels sit on plates
 * (DESIGN.md, "The scene").
 */
export type SceneProps = {
  /** The camera view to fly to. The windows (Slip Planner, Compare) never move the camera. */
  view: CameraViewId;
  /**
   * The scenario: profile, selected sites, focused site, landing date and the current time.
   * Pin and sight-line colours come from the evaluation hooks for it, never from shading.
   */
  scenario: Scenario;
  /** The part of the window no panel covers. Keep the subject centred in it. */
  freeSpace: FreeSpace;
  /** The operating system's "reduce motion": every camera move becomes a short cross-fade. */
  reduceMotion: boolean;
  /**
   * True after the user pressed "Try 3D anyway": draw even if the first flight is slow, and
   * do not report "slow" again.
   */
  ignoreSlow: boolean;
  /** Reports the scene's status. Call it once per mount, or again if it changes. */
  onStatus: (status: SceneStatus) => void;
  /** A click on a pin focuses its site. */
  onFocusSite: (siteId: string) => void;
  /**
   * Moves to another camera view, for example "Show it in the System view" when a site has no
   * terrain data (a sphere-tier site).
   */
  onViewChange: (view: CameraViewId) => void;
};
