import * as THREE from "three";
import type { FreeSpace } from "../../../app/scene";
import { CAP_HALF_WIDTH_M, MOON_RADIUS_M } from "../../../lib/geo";
import { MIN_SPACE_ALTITUDE, SPACE_FOV, fitDistance, homePose, type Pose, type Subjects } from "./camera";
import { clamp, smooth } from "./vec";

/**
 * The System view's drag, pan and zoom, as pure functions of a three.js camera
 * (docs/features/system-view.md, "Camera"). Scene units are Moon radii; the Moon is the unit
 * sphere at the origin.
 *
 * The rule for every drag is "grab the globe": the surface under the pointer moves with the
 * pointer. Keys move the camera the arrow's way, so the picture moves the other way, as on a
 * map.
 *
 * **The pivot.** Far out, a drag turns the camera about the Moon's centre, around the Moon's
 * axis. Close in, it turns about the point of interest on the surface (the south pole after
 * the "South pole" preset, the site after "Follow site", otherwise the point at the centre of
 * the free space), around that point's local vertical. Between NEAR_DISTANCE and
 * FAR_DISTANCE (the camera's distance from that point) the pivot slides along the line from
 * the Moon's centre to the point, and the axis turns from one to the other, so nothing jumps.
 */

/**
 * The System view's orbit stops short of the axis it turns about: |y| of the camera's
 * direction at most this (about 9.9° from the pole), so the view never flips over a pole.
 */
export const POLE_LIMIT_Y = 0.985;
/** Closer than this to the point of interest (in Moon radii, about 2,800 km), the pivot is on the surface. */
export const NEAR_DISTANCE = 1.6;
/** Further than this (about 7,000 km), the pivot is the Moon's centre. */
export const FAR_DISTANCE = 4;
/** Close in, the camera tilts at most this far from the point's vertical, so it stays above the horizon. */
export const MAX_TILT_DEG = 80;
/** Close in, a drag turns the view 0.005 rad (0.29°) per CSS pixel. */
const NEAR_RATE = 0.005;

const Y = new THREE.Vector3(0, 1, 0);

export function lookOf(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
}

export function rightOf(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
}

export function upOf(camera: THREE.Camera): THREE.Vector3 {
  return new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
}

/** The nearest point where a ray from outside the Moon meets it, or null when it misses. */
export function hitMoon(origin: THREE.Vector3, direction: THREE.Vector3): THREE.Vector3 | null {
  const d = direction.clone().normalize();
  const b = origin.dot(d);
  const c = origin.lengthSq() - 1;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0) return null;
  return origin.clone().addScaledVector(d, t);
}

/**
 * The surface point at the centre of the view: where the look ray meets the Moon, or, when it
 * misses, the point of the limb nearest the ray (the two agree where the ray grazes the limb).
 */
export function centrePoint(position: THREE.Vector3, look: THREE.Vector3): THREE.Vector3 {
  const hit = hitMoon(position, look);
  if (hit) return hit;
  const t = Math.max(0, -position.dot(look));
  const closest = position.clone().addScaledVector(look, t);
  return closest.lengthSq() > 1e-18 ? closest.normalize() : new THREE.Vector3(0, -1, 0);
}

/** How close the camera is: 0 far out (pivot at the Moon's centre), 1 close in (pivot on the surface). */
export function nearness(distance: number): number {
  return 1 - smooth(NEAR_DISTANCE, FAR_DISTANCE, distance);
}

export type Pivot = {
  /** The point the drag turns about. */
  point: THREE.Vector3;
  /** The axis it turns about (unit), pointing out of the surface being looked at. */
  axis: THREE.Vector3;
  /** The surface point of interest. */
  surface: THREE.Vector3;
  /** The camera's distance from it, in Moon radii. */
  distance: number;
  /** 0 far out, 1 close in. */
  w: number;
};

/**
 * Where a drag turns about, for a camera at `position` looking along `look`. `focus` is the
 * preset's point of interest (the pole, or the followed site), if one is set and faces the
 * camera; otherwise the surface point at the centre of the view.
 */
export function systemPivot(position: THREE.Vector3, look: THREE.Vector3, focus: THREE.Vector3 | null = null): Pivot {
  const facing = focus && focus.clone().normalize().dot(position.clone().sub(focus)) > 0;
  const surface = facing && focus ? focus.clone() : centrePoint(position, look);
  const distance = surface.distanceTo(position);
  const w = nearness(distance);
  const vertical = surface.clone().normalize();
  // The Moon's axis, pointed into the hemisphere being looked at, so it never cancels the
  // vertical it blends into.
  const far = Y.clone().multiplyScalar(vertical.y >= 0 ? 1 : -1);
  const axis = far.multiplyScalar(1 - w).addScaledVector(vertical, w);
  if (axis.lengthSq() < 1e-12) axis.copy(vertical);
  axis.normalize();
  return { point: surface.clone().multiplyScalar(w), axis, surface, distance, w };
}

/** World size of one CSS pixel at `distance` from the camera, for a vertical lens `fovDeg` over `viewportHeight`. */
export function pixelSize(distance: number, fovDeg: number, viewportHeight: number): number {
  return (2 * distance * Math.tan(THREE.MathUtils.degToRad(fovDeg) / 2)) / Math.max(1, viewportHeight);
}

/**
 * Radians per pixel for a drag: far out, the rate at which the surface at the centre of the
 * view follows the pointer exactly; close in, a steady 0.29° per pixel.
 */
export function orbitRate(pivot: Pivot, fovDeg: number, viewportHeight: number): number {
  const grab = clamp(pixelSize(pivot.distance, fovDeg, viewportHeight), 0.0004, 0.01);
  return grab * (1 - pivot.w) + NEAR_RATE * pivot.w;
}

export type DragFrame = {
  /** The turning axis, fixed for the whole drag. */
  axis: THREE.Vector3;
  /** +1 or −1: which way a rightward drag turns the camera about `axis`. */
  sense: number;
  focus: THREE.Vector3 | null;
};

/**
 * Fixes a drag's axis and direction when it starts. The direction is set so that the surface
 * just below the centre of the view (a quarter of the way to the foot of the screen, the
 * part nearest the viewer when the view is tilted) follows a sideways drag. Far out that is
 * the surface at the centre; looking straight at a pole it is the turn's front edge.
 */
export function beginDragFrame(camera: THREE.PerspectiveCamera, focus: THREE.Vector3 | null): DragFrame {
  const look = lookOf(camera);
  const pivot = systemPivot(camera.position, look, focus);
  const up = upOf(camera);
  const right = rightOf(camera);
  const below = pixelSize(pivot.distance, camera.fov, 2) * 0.25; // a quarter of the half-height
  const front = pivot.surface.clone().addScaledVector(up, -below).sub(pivot.point);
  // A camera turn by +a moves the world by −a about the axis.
  const motion = -new THREE.Vector3().crossVectors(pivot.axis, front).dot(right);
  return { axis: pivot.axis.clone(), sense: motion >= 0 ? -1 : 1, focus };
}

/** Turns the camera rigidly (position, orientation and up) by `q` about `point`. */
export function turnCamera(camera: THREE.Camera, point: THREE.Vector3, q: THREE.Quaternion): void {
  camera.position.sub(point).applyQuaternion(q).add(point);
  camera.quaternion.premultiply(q);
  camera.up.applyQuaternion(q);
}

type Limits = { axis: THREE.Vector3; point: THREE.Vector3; w: number };

/**
 * Whether a camera position is allowed, given where the step started: not within the pole
 * limit of the turning axis, not across it to the other side, not tilted past the horizon
 * close in, not below the zoom limit, and close in not upside down. A step that does not make
 * a broken limit worse is always allowed (the home pose starts straight below the pole).
 */
function acceptable(
  start: THREE.Vector3,
  next: THREE.Vector3,
  limits: Limits,
  upBefore: THREE.Vector3 | null = null,
  upAfter: THREE.Vector3 | null = null,
): boolean {
  const { axis, point, w } = limits;
  const a = start.clone().sub(point);
  const b = next.clone().sub(point);
  const ay = a.clone().normalize().dot(axis);
  const by = b.clone().normalize().dot(axis);
  const sideA = a.clone().addScaledVector(axis, -a.dot(axis));
  const sideB = b.clone().addScaledVector(axis, -b.dot(axis));
  // Straight on the axis (the home pose, the South pole preset) any side may be taken.
  const onAxis = 1e-6 * a.length();
  if (sideA.length() > onAxis && sideB.length() > onAxis && sideA.dot(sideB) < 0) return false;
  if (Math.abs(by) > POLE_LIMIT_Y && Math.abs(by) > Math.abs(ay) + 1e-12) return false;
  // Close in, the camera stays above the point's horizon: the tilt limit eases from none far
  // out to MAX_TILT_DEG close in.
  const maxTilt = THREE.MathUtils.degToRad(180 * (1 - w) + MAX_TILT_DEG * w);
  const tiltA = Math.acos(clamp(ay, -1, 1));
  const tiltB = Math.acos(clamp(by, -1, 1));
  if (tiltB > maxTilt && tiltB > tiltA + 1e-12) return false;
  const altA = start.length() - 1;
  const altB = next.length() - 1;
  if (altB < MIN_SPACE_ALTITUDE && altB < altA - 1e-15) return false;
  // Close in, the sky stays at the top of the screen: the camera's up never points into the
  // ground. From straight overhead a drag up tilts the view; a drag down does nothing.
  if (w > 0.5 && upAfter && upBefore) {
    const before = upBefore.dot(axis);
    const after = upAfter.dot(axis);
    if (after < -1e-9 && after < before - 1e-12) return false;
  }
  return true;
}

/** Turns about `point` and `axis` by `angle`, cut short to the largest part of the step that is allowed. */
function limitedTurn(camera: THREE.Camera, point: THREE.Vector3, axis: THREE.Vector3, angle: number, limits: Limits): void {
  const start = camera.position.clone();
  const up = upOf(camera);
  const at = (k: number) => start.clone().sub(point).applyAxisAngle(axis, angle * k).add(point);
  const ok = (k: number) => acceptable(start, at(k), limits, up, up.clone().applyAxisAngle(axis, angle * k));
  let k = 1;
  if (!ok(1)) {
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 40; i += 1) {
      const mid = (lo + hi) / 2;
      if (ok(mid)) lo = mid;
      else hi = mid;
    }
    k = lo;
  }
  // A step cut to almost nothing is no step (it would leave the camera a hair off the axis).
  if (k < 1e-6) return;
  turnCamera(camera, point, new THREE.Quaternion().setFromAxisAngle(axis, angle * k));
}

/**
 * A drag of (dx, dy) CSS pixels in the System view: sideways turns about the drag's axis,
 * up and down tilts about the camera's right, both about the pivot.
 */
export function orbitSystem(camera: THREE.PerspectiveCamera, frame: DragFrame, dx: number, dy: number, viewportHeight: number): void {
  const pivot = systemPivot(camera.position, lookOf(camera), frame.focus);
  const rate = orbitRate(pivot, camera.fov, viewportHeight);
  const limits = { axis: frame.axis, point: pivot.point, w: pivot.w };
  if (dx !== 0) limitedTurn(camera, pivot.point, frame.axis, -dx * rate * frame.sense, limits);
  if (dy !== 0) {
    const after = systemPivot(camera.position, lookOf(camera), frame.focus);
    limitedTurn(camera, after.point, rightOf(camera), -dy * rate, { ...limits, point: after.point });
  }
}

/**
 * A pan of (dx, dy) CSS pixels: the globe slides under the camera, so the surface at the
 * centre of the view follows the pointer. It turns the camera about the Moon's centre, so
 * its height above the surface never changes and nothing flips over a pole.
 */
export function panSystem(camera: THREE.PerspectiveCamera, dx: number, dy: number, viewportHeight: number): void {
  const look = lookOf(camera);
  const surface = centrePoint(camera.position, look);
  const vertical = surface.clone().normalize();
  const right = rightOf(camera);
  const up = upOf(camera);
  const step = pixelSize(surface.distanceTo(camera.position), camera.fov, viewportHeight);
  // Axes that move the centre point along the screen's right and down.
  let across = new THREE.Vector3().crossVectors(vertical, right);
  if (across.lengthSq() < 1e-6) across = up.clone();
  let along = new THREE.Vector3().crossVectors(up, vertical);
  if (along.lengthSq() < 1e-6) along = right.clone();
  across.normalize();
  along.normalize();
  // The world turns by +angle; the camera turns the other way.
  const q = new THREE.Quaternion();
  const angleX = clamp(dx * step, -0.5, 0.5);
  const angleY = clamp(dy * step, -0.5, 0.5);
  if (angleX !== 0) q.premultiply(new THREE.Quaternion().setFromAxisAngle(across, -angleX));
  if (angleY !== 0) q.premultiply(new THREE.Quaternion().setFromAxisAngle(along, -angleY));
  turnCamera(camera, new THREE.Vector3(), q);
}

/** The ray through a point of the window in normalised device coordinates (−1 to 1, y up). */
export function rayThrough(camera: THREE.PerspectiveCamera, ndc: { x: number; y: number }): THREE.Vector3 {
  camera.updateMatrixWorld();
  const far = new THREE.Vector3(ndc.x, ndc.y, 1).applyMatrix4(camera.projectionMatrixInverse);
  return far.normalize().transformDirection(camera.matrixWorld);
}

/**
 * Zooms the System view by `factor` (above 1 zooms out). With a pointer, the camera moves
 * along the ray through it, so the surface point under the pointer stays where it is on
 * screen; without one, toward `toward` (the point of interest) or the centre of the view.
 * The height stays between the 60 km limit and `maxAltitude`.
 */
export function zoomSystem(
  camera: THREE.PerspectiveCamera,
  factor: number,
  maxAltitude: number,
  ndc: { x: number; y: number } | null = null,
  toward: THREE.Vector3 | null = null,
): void {
  const position = camera.position;
  let target: THREE.Vector3 | null = null;
  if (ndc) target = hitMoon(position, rayThrough(camera, ndc));
  if (!target && toward && toward.clone().normalize().dot(position.clone().sub(toward)) > 0) target = toward.clone();
  if (!target) target = hitMoon(position, lookOf(camera));
  if (!target) {
    const alt = position.length() - 1;
    position.setLength(1 + clamp(alt * factor, MIN_SPACE_ALTITUDE, maxAltitude));
    return;
  }
  const rel = position.clone().sub(target);
  const at = (s: number) => target!.clone().addScaledVector(rel, s);
  const altitude = (s: number) => at(s).length() - 1;
  const start = position.length() - 1;
  let s = factor;
  // Along the ray out of a visible surface point, height grows with distance: bisect onto a limit.
  if (altitude(s) < MIN_SPACE_ALTITUDE) {
    if (start <= MIN_SPACE_ALTITUDE) return;
    let lo = s;
    let hi = 1;
    for (let i = 0; i < 50; i += 1) {
      const mid = (lo + hi) / 2;
      if (altitude(mid) < MIN_SPACE_ALTITUDE) lo = mid;
      else hi = mid;
    }
    s = hi;
  } else if (altitude(s) > maxAltitude) {
    if (start >= maxAltitude) return;
    let lo = 1;
    let hi = s;
    for (let i = 0; i < 50; i += 1) {
      const mid = (lo + hi) / 2;
      if (altitude(mid) > maxAltitude) hi = mid;
      else lo = mid;
    }
    s = lo;
  }
  position.copy(at(s));
}

/**
 * Double-click: the pose that centres a surface point and moves in on it, looking straight
 * down, about half as far as now (no closer than twice the zoom limit, no further than the
 * cap's framing distance).
 */
export function focusPose(camera: THREE.PerspectiveCamera, point: THREE.Vector3): Pose {
  const vertical = point.clone().normalize();
  const distance = clamp(point.distanceTo(camera.position) * 0.5, MIN_SPACE_ALTITUDE * 2, 1.2);
  const look = vertical.clone().negate();
  const up = upOf(camera).addScaledVector(look, -upOf(camera).dot(look));
  if (up.lengthSq() < 1e-9) up.copy(rightOf(camera));
  up.normalize();
  const pos = vertical.clone().multiplyScalar(1 + distance);
  return { pos: [pos.x, pos.y, pos.z], look: [look.x, look.y, look.z], up: [up.x, up.y, up.z], fov: camera.fov };
}

/** The south polar cap's half-width in Moon radii (±304 km, about 80°S). */
export const CAP_HALF = CAP_HALF_WIDTH_M / MOON_RADIUS_M;

/**
 * The "South pole" preset: straight below the pole, turned as home is (Earth and the Sun to
 * either side), close enough that the whole cap poleward of about 80°S, where the sites
 * are, fills the free space.
 */
export function southPolePose(subjects: Subjects, space: FreeSpace): Pose {
  const home = homePose(subjects, space);
  const distance = fitDistance(CAP_HALF, CAP_HALF, SPACE_FOV, space, 1.08);
  return { pos: [0, -(1 + distance), 0], look: [0, 1, 0], up: home.up, fov: SPACE_FOV };
}
