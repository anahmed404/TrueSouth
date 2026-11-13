import type { FreeSpace, ScreenPoint } from "../../../app/scene";
import { polarStereoForward } from "../../../lib/geo";

/**
 * Where sites sit when 3D is off (slip-planner.md, "When 3D is off"): the polar
 * stereographic plane (science.md §2.3), north (+y, toward 0° E) up, fitted so every site
 * with 16 km around it (70 km for one or two sites) fits the free space with 90 px at the
 * sides for labels, as the 3D camera fit does. With no site, the pole and 70 km around it.
 */
export type FlatProjection = {
  project: (latDeg: number, lonDeg: number) => ScreenPoint;
  /** A point of the polar plane, in metres, on screen. */
  toScreen: (xM: number, yM: number) => { x: number; y: number };
  metresToPx: (metres: number) => number;
};

export function flatProjection(sites: readonly { latDeg: number; lonDeg: number }[], space: FreeSpace): FlatProjection {
  const points = sites.map((s) => polarStereoForward(s.latDeg, s.lonDeg));
  const ring = sites.length <= 2 ? 70_000 : 16_000;
  const xs = points.length ? points.map((p) => p.x_m) : [0];
  const ys = points.length ? points.map((p) => p.y_m) : [0];
  const x0 = Math.min(...xs) - ring;
  const x1 = Math.max(...xs) + ring;
  const y0 = Math.min(...ys) - ring;
  const y1 = Math.max(...ys) + ring;
  const usableW = Math.max(40, space.width - 180);
  const usableH = Math.max(40, space.height - 56);
  const k = Math.min(usableW / (x1 - x0), usableH / (y1 - y0));
  const cx = space.x + space.width / 2;
  const cy = space.y + space.height / 2;
  const bx = (x0 + x1) / 2;
  const by = (y0 + y1) / 2;
  const toScreen = (xM: number, yM: number) => ({ x: cx + (xM - bx) * k, y: cy - (yM - by) * k });
  return {
    project: (latDeg, lonDeg) => {
      const p = polarStereoForward(latDeg, lonDeg);
      return { ...toScreen(p.x_m, p.y_m), visible: true };
    },
    toScreen,
    metresToPx: (metres) => metres * k,
  };
}
