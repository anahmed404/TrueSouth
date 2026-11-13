/**
 * How the flat map takes over from the 3D scene (docs/features/polar-map.md, "How it is
 * entered and left"), and the scale bar. Pure.
 */

import type { SceneArrival, SceneMode } from "../../app/scene";
import { formatNumber } from "../../components/format";
import { NNBSP } from "./readout";
import { MOON_RADIUS_M, polarStereoForward } from "../../lib/geo";
import { metresPerPixel, viewFromArrival, type MapView, type ScreenPoint } from "./view";

/** The swap from globe to map, when the camera has flown there. */
export const TAKEOVER_FADE_MS = 260;
/** With "reduce motion": no camera move, only this cross-fade. */
export const REDUCED_FADE_MS = 400;
/** If no arrival is reported this long after entering, the map opens anyway at its own fit. */
export const ARRIVAL_TIMEOUT_MS = 2400;

export type Entry =
  /** Wait for the scene's flight to land, then fade in at its scale. */
  | { wait: true; fadeMs: number }
  /** Open at once, at the map's own fit, with a cross-fade. */
  | { wait: false; fadeMs: number };

/**
 * How the map opens. In 3D it waits for the flight; with "reduce motion" or no 3D it opens at
 * once with a cross-fade and no flight.
 */
export function entryFor(mode: SceneMode, reduceMotion: boolean): Entry {
  if (reduceMotion) return { wait: false, fadeMs: REDUCED_FADE_MS };
  if (mode === "flat") return { wait: false, fadeMs: TAKEOVER_FADE_MS };
  return { wait: true, fadeMs: TAKEOVER_FADE_MS };
}

/**
 * The view to open at, from the scene's arrival report when it is the Polar map's and was
 * reported after the map was entered; otherwise null (use the map's own fit).
 */
export function arrivalView(arrival: SceneArrival | null, offset: ScreenPoint = { x: 0, y: 0 }): MapView | null {
  if (!arrival || arrival.view !== "map" || !arrival.pole) return null;
  const { metresPerPixel: mpp, x, y } = arrival.pole;
  if (!(mpp > 0) || !Number.isFinite(x) || !Number.isFinite(y)) return null;
  return viewFromArrival(arrival.pole, offset);
}

/**
 * The 3D camera's vertical lens over the window's height, in degrees
 * (features/three/scene/camera.ts `SPACE_FOV`; a test keeps the two equal).
 */
export const GLOBE_LENS_DEG = 30;

/**
 * The view the flat map opens at when it takes over from the globe.
 *
 * The scene reports the scale at the pole. A pinhole camera draws the curved cap a little
 * smaller toward its edge than the flat stereographic map does: about 2 % of the radius at
 * 80°S. Matching the pole exactly would leave every pin there up to about 1.1 % of the map's
 * width off. So the map takes the scale halfway between the pole's and 80°S's: the pole stays
 * put and no pin from the pole out to 80°S moves by more than about 0.6 % of that width.
 * `viewportHeight` is the window's height, which the camera's lens is measured over.
 */
export function takeoverView(arrival: SceneArrival | null, offset: ScreenPoint, viewportHeight: number): MapView | null {
  const view = arrivalView(arrival, offset);
  if (!view || !arrival?.pole || !(viewportHeight > 0)) return view;
  const tanHalf = Math.tan((GLOBE_LENS_DEG * Math.PI) / 360);
  // The camera's distance from the pole, in Moon radii, from the scale it reports there.
  const distance = (arrival.pole.metresPerPixel * (viewportHeight / 2)) / (tanHalf * MOON_RADIUS_M);
  const lat = (-80 * Math.PI) / 180;
  const globe = (Math.cos(lat) * distance) / (distance + 1 + Math.sin(lat));
  const { x_m, y_m } = polarStereoForward(-80, 0);
  const flat = Math.hypot(x_m, y_m) / MOON_RADIUS_M;
  const ratio = globe / flat;
  return { ...view, k: (view.k * (1 + ratio)) / 2 };
}

/** Nice scale-bar lengths, in metres. */
const STEPS_M = [100, 200, 500, 1_000, 2_000, 5_000, 10_000, 20_000, 50_000, 100_000, 200_000];

/**
 * The scale bar: the longest nice length that fits in `maxPx` CSS pixels at the pole, where
 * the map is true to scale (docs/science.md §2.3). Returns its length on screen and its text,
 * for example "50 km · north is outward from the pole".
 */
export function scaleBar(view: MapView, maxPx = 120): { px: number; metres: number; text: string } {
  const mpp = metresPerPixel(view);
  let metres = STEPS_M[0] as number;
  for (const step of STEPS_M) if (step / mpp <= maxPx) metres = step;
  const length = metres >= 1000 ? `${formatNumber(metres / 1000, 0)}${NNBSP}km` : `${formatNumber(metres, 0)}${NNBSP}m`;
  return { px: metres / mpp, metres, text: `${length} · north is outward from the pole` };
}
