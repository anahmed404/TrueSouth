/**
 * Where the Polar map sits on screen. Pure functions, no drawing.
 *
 * The map is the south polar stereographic plane of docs/science.md §2.3, in metres: +x right
 * (toward 90° E), +y up (toward 0° E). Every conversion between that plane and latitude and
 * longitude goes through `web/src/lib/geo/`. This file only places the plane on the screen.
 *
 * The view is a d3-zoom transform over a "world" in kilometres with its origin at the pole and
 * +y down the screen: screen = k · world + (x, y). So `k` is CSS pixels per kilometre and
 * (x, y) is where the pole is, in CSS pixels from the top left of the map's box.
 */

import { latLonToPixel, polarStereoForward, polarStereoInverse, type MapImage } from "../../lib/geo";

/** One world unit, in metres. */
export const WORLD_UNIT_M = 1000;

/** docs/data-contracts.md `maps/meta.json`: the images reach ±304 km from the pole. */
export const DEFAULT_HALF_WIDTH_M = 304_000;

export type MapView = { k: number; x: number; y: number };

export type ScreenPoint = { x: number; y: number };

/** The rectangle the map should centre in, and the box it is drawn in. */
export type Frame = {
  /** The free space (or the whole box in a lesson), in the box's CSS pixels. */
  rect: { x: number; y: number; width: number; height: number };
  /** The box's height. The fit mirrors the 3D camera's, which measures its lens on it. */
  boxHeight: number;
};

/** CSS pixels per metre. */
function pxPerMetre(view: MapView): number {
  return view.k / WORLD_UNIT_M;
}

/** Metres on the map per CSS pixel. */
export function metresPerPixel(view: MapView): number {
  return WORLD_UNIT_M / view.k;
}

/** A point on the map plane (metres) to the screen. */
export function planeToScreen(x_m: number, y_m: number, view: MapView): ScreenPoint {
  const s = pxPerMetre(view);
  return { x: view.x + x_m * s, y: view.y - y_m * s };
}

/** A screen point to the map plane (metres). */
export function screenToPlane(x: number, y: number, view: MapView): { x_m: number; y_m: number } {
  const s = pxPerMetre(view);
  return { x_m: (x - view.x) / s, y_m: (view.y - y) / s };
}

/** Latitude and east longitude to the screen, by the projection in lib/geo. */
export function latLonToScreen(latDeg: number, lonDeg: number, view: MapView): ScreenPoint {
  const { x_m, y_m } = polarStereoForward(latDeg, lonDeg);
  return planeToScreen(x_m, y_m, view);
}

/** A screen point to latitude and east longitude (0 to 360), by the projection in lib/geo. */
export function screenToLatLon(x: number, y: number, view: MapView): { latDeg: number; lonDeg: number } {
  const { x_m, y_m } = screenToPlane(x, y, view);
  return polarStereoInverse(x_m, y_m);
}

/**
 * The view the scene reports when its flight lands (`SceneArrival.pole` in app/scene.ts): the
 * pole at (x, y) and `metresPerPixel` metres in one CSS pixel. `offset` is the map box's top
 * left in the window, since the arrival is measured from the window's corner.
 */
export function viewFromArrival(
  pole: { x: number; y: number; metresPerPixel: number },
  offset: ScreenPoint = { x: 0, y: 0 },
): MapView {
  return { k: WORLD_UNIT_M / pole.metresPerPixel, x: pole.x - offset.x, y: pole.y - offset.y };
}

/**
 * The opening view when there is no arrival to match (reduced motion, no WebGL, a lesson, or
 * a reset): the ±`halfWidthM` square fits the rectangle with a 4 % margin, centred in it. It is
 * the same fit as the 3D camera's Polar map pose (features/three/scene/camera.ts `polarPose`
 * and `polarScale`), so the map opens at the scale the globe would have.
 */
export function fitView(frame: Frame, halfWidthM = DEFAULT_HALF_WIDTH_M, margin = 1.04): MapView {
  const { rect } = frame;
  const width = Math.max(rect.width, 80);
  const height = Math.max(rect.height, 80);
  const mpp = Math.max((2 * halfWidthM) / width, (2 * halfWidthM) / height) * margin;
  const empty = rect.width <= 0 || rect.height <= 0;
  const centre = empty
    ? { x: rect.x, y: frame.boxHeight / 2 }
    : { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  return { k: WORLD_UNIT_M / mpp, x: centre.x, y: centre.y };
}

/**
 * How far the map may zoom: out to 70 % of the fit, in to 25 m a pixel. The sharpest relief
 * pixel is 74 m (the 8K image); closer than this only blurs it.
 */
export function zoomExtent(fit: MapView): [number, number] {
  return [fit.k * 0.7, WORLD_UNIT_M / 25];
}

/**
 * The relief image to draw at this zoom: the 4K image until one of its pixels would cover
 * more than one device pixel, then the 8K one (docs/features/polar-map.md, "Pan and zoom").
 */
export function reliefLevel(view: MapView, devicePixelRatio: number, halfWidthM = DEFAULT_HALF_WIDTH_M): "4k" | "8k" {
  const imageMetresPerPixel4k = (2 * halfWidthM) / 4096;
  const screenMetresPerDevicePixel = metresPerPixel(view) / Math.max(1, devicePixelRatio);
  return screenMetresPerDevicePixel < imageMetresPerPixel4k ? "8k" : "4k";
}

/**
 * The lookup cell under a latitude and longitude, by the map projection in lib/geo, or null
 * when the point is outside the grid. The grid is square, centred on the pole, row 0 at the
 * top (docs/data-contracts.md `maps/meta.json`).
 */
export function lookupCell(latDeg: number, lonDeg: number, grid: MapImage): { col: number; row: number } | null {
  const { col, row } = latLonToPixel(latDeg, lonDeg, grid);
  const c = Math.round(col);
  const r = Math.round(row);
  if (c < 0 || r < 0 || c >= grid.size_px || r >= grid.size_px) return null;
  return { col: c, row: r };
}

/** The radius, in CSS pixels, of a latitude circle. */
export function latitudeRadiusPx(latDeg: number, view: MapView): number {
  const { x_m, y_m } = polarStereoForward(latDeg, 0);
  return Math.hypot(x_m, y_m) * pxPerMetre(view);
}

/** Zoom by `factor` about a screen point, keeping that point still. */
export function zoomAbout(view: MapView, factor: number, at: ScreenPoint, extent: [number, number]): MapView {
  const k = Math.min(extent[1], Math.max(extent[0], view.k * factor));
  const f = k / view.k;
  return { k, x: at.x - (at.x - view.x) * f, y: at.y - (at.y - view.y) * f };
}

/**
 * Keeps part of the map inside the free space: at least a third of the map's width (or half
 * the free space, when the map is zoomed in wider than that) stays inside it on each axis, at
 * every zoom. Only the position moves; the zoom is left alone.
 */
export function clampView(view: MapView, rect: Frame["rect"], halfWidthM = DEFAULT_HALF_WIDTH_M, keep = 1 / 3): MapView {
  if (rect.width <= 0 || rect.height <= 0) return view;
  const side = (2 * halfWidthM * view.k) / WORLD_UNIT_M;
  const clampAxis = (centre: number, start: number, length: number) => {
    const margin = Math.min(side * keep, length / 2);
    const low = start + margin - side / 2;
    const high = start + length - margin + side / 2;
    return Math.min(high, Math.max(low, centre));
  };
  return { k: view.k, x: clampAxis(view.x, rect.x, rect.width), y: clampAxis(view.y, rect.y, rect.height) };
}

/** Move the map by (dx, dy) CSS pixels. */
export function panBy(view: MapView, dx: number, dy: number): MapView {
  return { k: view.k, x: view.x + dx, y: view.y + dy };
}

/** Two views are the same to within a hundredth of a pixel. */
export function sameView(a: MapView, b: MapView): boolean {
  return Math.abs(a.k - b.k) < 1e-9 * Math.max(1, a.k) && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01;
}
