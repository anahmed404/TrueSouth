import type { FreeSpace } from "../../../app/scene";
import { MOON_RADIUS_M, polarStereoForward, polarStereoInverse, surfacePointScene } from "../../../lib/geo";
import { freeCentre, type Pose } from "./camera";
import { add, clamp, cross, dot, len, mul, norm, perpendicular, smooth, sub, type V3 } from "./vec";

/**
 * The Slip Planner's camera (docs/features/slip-planner.md, "A camera view"): a stop above
 * the south pole, tilted so the Moon curves away at the top, fitted to the selected polar
 * sites and the free space. Pure, so it is testable without WebGL. Scene units are Moon radii.
 */

export const SLIP_FOV = 30;
/** The camera stands on the pole's side of the sites, this far up. */
export const SLIP_ELEVATION_DEG = 30;
/** Drag orbits around the sites' centre between these elevations. */
export const SLIP_MIN_EL_DEG = 28;
export const SLIP_MAX_EL_DEG = 88;
/** Scroll zooms between these distances from the sites' centre. */
export const SLIP_MIN_DISTANCE = 60_000 / MOON_RADIUS_M;
export const SLIP_MAX_DISTANCE = 2_600_000 / MOON_RADIUS_M;
/** Changing the site set or folding a panel refits the camera in 450 to 600 ms. */
export const SLIP_REFIT_MS = 520;
/** Ground kept around every site in the fit: 16 km, or 70 km for one or two sites. */
export const SLIP_RING_M = 16_000;
export const SLIP_RING_FEW_M = 70_000;
/**
 * Room left in the free space: for labels at the sides, plates at the top, and at the foot
 * the view's controls and the before-and-after plate (the scene already keeps 60 px).
 */
export const SLIP_FIT_INSET = { side: 90, top: 40, bottom: 48 } as const;
/** The camera aims this share of the free space's height above the sites, so the curve shows. */
export const SLIP_AIM_SHARE = 0.2;

/** A site is drawn in the Slip Planner when it is inside the polar cap and has terrain. */
export const SLIP_VIEW_MAX_LAT_DEG = -80;

export function inSlipView(site: { lat_deg: number; terrain_tier: string }): boolean {
  return site.terrain_tier !== "sphere" && site.lat_deg <= SLIP_VIEW_MAX_LAT_DEG;
}

export type SlipSite = { latDeg: number; lonDeg: number };

/** The Slip Planner's pose, the point it orbits about, and its fixed drawing light. */
export type SlipPose = Pose & {
  /** The middle of the sites' bounding box, on the reference sphere. */
  centre: V3;
  /** Up at the centre. */
  up0: V3;
  /** The fixed drawing light: from the view's top left, 55° up. Never the real Sun. */
  light: V3;
};

const SOUTH_POLE: V3 = [0, -1, 0];

/**
 * Where a scene point lands on screen for a pose, in CSS pixels from the window's top left.
 * The principal point is the free space's centre (camera.ts `viewOffset`).
 */
export function projectPose(pose: Pose, space: FreeSpace, point: V3): { x: number; y: number; front: boolean } {
  const look = norm(pose.look);
  const up = perpendicular(pose.up, look);
  const right = norm(cross(look, up));
  const d = sub(point, pose.pos);
  const z = dot(d, look);
  const f = space.viewport.height / 2 / Math.tan((pose.fov * Math.PI) / 360);
  const c = freeCentre(space);
  if (z <= 1e-12) return { x: c.x, y: c.y, front: false };
  return { x: c.x + (dot(d, right) / z) * f, y: c.y - (dot(d, up) / z) * f, front: true };
}

/** The polar stereographic bounding box of the sites, in metres (science.md §2.3). */
function boundingBox(sites: readonly SlipSite[]): { cx: number; cy: number; points: { x: number; y: number }[] } {
  const points = sites.map((s) => {
    const p = polarStereoForward(s.latDeg, s.lonDeg);
    return { x: p.x_m, y: p.y_m };
  });
  if (points.length === 0) return { cx: 0, cy: 0, points: [{ x: 0, y: 0 }] };
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return { cx: (Math.min(...xs) + Math.max(...xs)) / 2, cy: (Math.min(...ys) + Math.max(...ys)) / 2, points };
}

/**
 * The fit (slip-planner.md, "The camera fit"): centre on the middle of the polar sites'
 * bounding box; stand on the pole's side 30° up; aim 0.2 of the free space's height above
 * the sites; then find the distance at which every site, with 16 km of ground around it
 * (70 km for one or two sites), fits the free space with 90 px left and right for labels.
 * With no polar site it frames the pole itself with 70 km around it.
 */
export function slipPose(sites: readonly SlipSite[], space: FreeSpace): SlipPose {
  const box = boundingBox(sites);
  const centreLL = polarStereoInverse(box.cx, box.cy);
  const centre = surfacePointScene(centreLL.latDeg, centreLL.lonDeg);
  const up0 = norm(centre);

  // Toward the pole along the ground. At the pole itself, toward map south.
  let toPole = perpendicular(SOUTH_POLE, up0);
  if (len(toPole) < 0.5 || Math.hypot(box.cx, box.cy) < 2_000) {
    // Map south: away from the 0° meridian, which is scene +x (camera.ts `polarPose`).
    toPole = perpendicular([-1, 0, 0], up0);
  }
  const el = (SLIP_ELEVATION_DEG * Math.PI) / 180;
  const dir = norm(add(mul(up0, Math.sin(el)), mul(toPole, Math.cos(el))));
  const look0 = mul(dir, -1);
  const right = norm(cross(look0, up0));
  const screenUp0 = norm(cross(right, look0));

  const viewportH = Math.max(1, space.viewport.height);
  const freeH = space.height > 0 ? space.height : viewportH;
  const pitch = SLIP_AIM_SHARE * (freeH / viewportH) * ((SLIP_FOV * Math.PI) / 180);
  const look = norm(add(mul(look0, Math.cos(pitch)), mul(screenUp0, Math.sin(pitch))));
  const up = norm(sub(mul(screenUp0, Math.cos(pitch)), mul(look0, Math.sin(pitch))));

  const ringM = sites.length <= 2 ? SLIP_RING_FEW_M : SLIP_RING_M;
  const ring: V3[] = [];
  for (const p of box.points) {
    for (let a = 0; a < 8; a += 1) {
      const q = polarStereoInverse(p.x + ringM * Math.cos((a * Math.PI) / 4), p.y + ringM * Math.sin((a * Math.PI) / 4));
      ring.push(surfacePointScene(q.latDeg, q.lonDeg));
    }
  }

  // With too little free space to fit into (not measured yet, or covered), fit the window.
  const roomy = space.width > 2 * SLIP_FIT_INSET.side + 40 && space.height > SLIP_FIT_INSET.top + SLIP_FIT_INSET.bottom + 40;
  const box2 = roomy ? space : { ...space, x: 0, y: 0, width: space.viewport.width, height: space.viewport.height };
  const left = box2.x + SLIP_FIT_INSET.side;
  const rightEdge = box2.x + box2.width - SLIP_FIT_INSET.side;
  const top = box2.y + SLIP_FIT_INSET.top;
  const bottom = box2.y + box2.height - SLIP_FIT_INSET.bottom;
  const fits = (distance: number) => {
    const pose: Pose = { pos: add(centre, mul(dir, distance)), look, up, fov: SLIP_FOV };
    return ring.every((point) => {
      const s = projectPose(pose, space, point);
      return s.front && s.x > left && s.x < rightEdge && s.y > top && s.y < bottom;
    });
  };
  let lo = SLIP_MIN_DISTANCE;
  let hi = SLIP_MAX_DISTANCE * 0.92;
  if (fits(lo)) hi = lo;
  else {
    for (let i = 0; i < 24; i += 1) {
      const mid = Math.sqrt(lo * hi);
      if (fits(mid)) hi = mid;
      else lo = mid;
    }
  }

  // From the view's top left, 55° up: −right is the view's left, −toPole is up the screen.
  const light = norm(add(add(up0, mul(right, -0.55)), mul(toPole, -0.45)));
  return { pos: add(centre, mul(dir, hi)), look, up, fov: SLIP_FOV, centre, up0, light };
}

/**
 * How much the Moon shows the fixed drawing light instead of the real Sun, during a flight
 * at eased time `t` (slip-planner.md, "Leaving"; c2-slip-on-moon.md, "Motion"): into the
 * Slip Planner it blends in over the flight's last 70 %; out of it, over the first 60 %.
 */
export function slipLightBlend(from: number, entering: boolean, t: number): number {
  if (entering) return from + (1 - from) * smooth(0.3, 1, t);
  return from * (1 - smooth(0, 0.6, t));
}

/**
 * One drag step of the Slip Planner's orbit about the sites' centre: azimuth turns with the
 * horizontal drag and elevation follows the vertical one, between 28° and 88°.
 */
export function slipOrbit(
  pos: V3,
  centre: V3,
  up0: V3,
  dx: number,
  dy: number,
): { pos: V3; up: V3; look: V3 } {
  const { north, east } = frameAt(up0);
  const rel = sub(pos, centre);
  const r = len(rel);
  const relN = norm(rel);
  let el = (Math.asin(clamp(dot(relN, up0), -1, 1)) * 180) / Math.PI;
  let az = (Math.atan2(dot(rel, east), dot(rel, north)) * 180) / Math.PI;
  az -= dx * 0.2;
  el = clamp(el + dy * 0.2, SLIP_MIN_EL_DEG, SLIP_MAX_EL_DEG);
  const a = (az * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const d = add(add(mul(north, Math.cos(e) * Math.cos(a)), mul(east, Math.cos(e) * Math.sin(a))), mul(up0, Math.sin(e)));
  const next = add(centre, mul(d, r));
  return { pos: next, up: up0, look: norm(sub(centre, next)) };
}

/** One zoom step: the distance from the sites' centre, between 60 km and 2,600 km. */
export function slipZoom(pos: V3, centre: V3, factor: number): V3 {
  const rel = sub(pos, centre);
  const r = clamp(len(rel) * factor, SLIP_MIN_DISTANCE, SLIP_MAX_DISTANCE);
  return add(centre, mul(norm(rel), r));
}

/** Any north and east at a point with up `up0`, for the orbit's azimuth. */
function frameAt(up0: V3): { north: V3; east: V3 } {
  let north = perpendicular([0, 1, 0], up0);
  if (len(north) < 0.5) north = perpendicular([0, 0, 1], up0);
  const east = norm(cross(north, up0));
  return { north, east };
}

/**
 * The site's close-up ground in and out of the Slip Planner: its usual fade by altitude, times
 * how much the Moon still shows the real Sun. At slip = 1 no ground is drawn, so no drawn
 * shadow can follow the date there.
 */
export function slipGroundFade(fade: number, slip: number): number {
  return fade * (1 - Math.min(1, Math.max(0, slip)));
}
