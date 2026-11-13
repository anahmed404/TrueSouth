import type { FreeSpace } from "./mission/free-space";
import type { CameraViewId } from "./mission/views";
import type { Scenario } from "./panel";

export type { FreeSpace, Rect } from "./mission/free-space";
export type { CameraViewId } from "./mission/views";

/**
 * How the scene is doing, reported once it knows, and again if that changes:
 *
 * - "ready": it draws (reported when its first camera flight lands).
 * - "slow": it is still too slow on its lowest quality stage: the median of its flight
 *   frames was over the threshold in docs/features/system-view.md ("Performance" and "When
 *   3D does not run"). It may come later than "ready", after the scene has stepped down.
 * - "no-webgl": WebGL could not start.
 *
 * On "no-webgl", or "slow" before "Try 3D anyway", the shell sets `mode` to "flat" and, for
 * a view the scene cannot draw flat, puts the still picture over it with the note.
 */
export type SceneStatus = "ready" | "slow" | "no-webgl";

/**
 * The still picture: one render of the System view at 2028-03-01T00:00Z, from the scene's own
 * textures, with no pins, sight-lines or words baked in. Served from web/public/. How to
 * render it again: DEVLOG.md, 3D and Map, T1 and T2.
 */
export const STILL_PICTURE_URL = "/still/system-view.webp";

/**
 * Reported when a camera flight lands. After the flight to the Polar map it also says where
 * the pole is on screen and at what scale, so the flat map (work package MC6) can take over
 * from the 3D cap without a visible jump: the pole is at (x, y) in CSS pixels from the top
 * left of the window, and one CSS pixel there is `metresPerPixel` metres. North of the map
 * (+y, toward 0° E: docs/science.md §2.3) is up the screen.
 */
export type SceneArrival = {
  view: CameraViewId;
  pole?: { x: number; y: number; metresPerPixel: number };
};

/**
 * What the scene can draw without WebGL, sent with its status. `flatViews` lists the camera
 * views it draws in flat mode (for example the Polar map, a 2D canvas). For any other view
 * in flat mode the shell puts its still picture over the scene. Omitted, it means none.
 */
export type SceneReport = { flatViews: readonly CameraViewId[] };

/**
 * How the scene must draw: "3d" with WebGL, or "flat" without it, when WebGL is missing or
 * slow and the user has not pressed "Try 3D anyway". In flat mode the scene stays mounted
 * and draws only what it can without WebGL (its 2D parts), or nothing.
 */
export type SceneMode = "3d" | "flat";

/**
 * Everything the shell gives the 3D scene (work package T1). The scene fills the window
 * behind the floating interface. It draws no text straight on itself: labels sit on plates
 * (DESIGN.md, "The scene").
 */
export type SceneProps = {
  /** The camera view to fly to. The window (Compare) never moves the camera. */
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
  /**
   * Reports the scene's status, and what it can draw in flat mode. Call it once per mount, or
   * again if either changes.
   */
  onStatus: (status: SceneStatus, report?: SceneReport) => void;
  /** A click on a pin focuses its site. */
  onFocusSite: (siteId: string) => void;
  /**
   * Moves to another camera view, for example "Show it in the System view" when a site has no
   * terrain data (a sphere-tier site).
   */
  onViewChange: (view: CameraViewId) => void;
  /** Adds a catalog site to the selected sites, for example from a pin on the Polar map. */
  onAddSite: (siteId: string) => void;
  /**
   * "3d", or "flat" when WebGL is missing or slow (see `SceneMode`). The scene is never
   * unmounted for this: it is told, and draws its 2D parts or nothing.
   */
  mode: SceneMode;
  /** Optional: a camera flight has landed (see `SceneArrival`). */
  onArrive?: (arrival: SceneArrival) => void;
  /**
   * Optional: the scene hands over its projector while it draws in 3D, and null when it stops.
   * The Slip Planner's spots (docs/features/slip-planner.md, "Spots") use it to sit on their
   * sites, drawn by the shell over the scene, as the pins are.
   */
  onProjector?: (projector: SceneProjector | null) => void;
  /**
   * Optional: in the Slip Planner, shade the polar cap by NASA's average sunlight over 18.6
   * years (slip-planner.md, "Honesty"). Context only: it never decides a result.
   */
  slipShading?: boolean;
};

/** Where a place on the Moon is on screen now, in CSS pixels from the window's top left. */
export type ScreenPoint = {
  x: number;
  y: number;
  /** False when the point is behind the camera or on the Moon's far side. */
  visible: boolean;
};

/**
 * Projects sites onto the screen with the scene's current camera. `subscribe` calls back
 * after every drawn frame, so whatever sits on a site can follow the camera without React.
 */
export type SceneProjector = {
  project: (latDeg: number, lonDeg: number) => ScreenPoint;
  subscribe: (onFrame: () => void) => () => void;
};
