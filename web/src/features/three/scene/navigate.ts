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
 * **The turn is a free trackball.** A horizontal drag turns the camera about its own up axis,
 * a vertical drag about its own right axis, both through the pivot; so the surface in front
 * of the pivot always moves the way the pointer moves, whatever the camera's orientation,
 * with no limit at the poles and no world "up" (the team lead's request, 2026-11-14: the Moon
 * turns freely in every direction). Over a pole the Moon may end up upside down; the presets
 * fly back to a level view. Keys move the camera the arrow's way, so the picture moves the
 * other way, as on a map.
 *
 * **The pivot.** Far out, the camera turns about the Moon's centre. Close in, it turns about
 * the point of interest: the preset's point (the south pole, the followed site, a
 * double-clicked spot) while it faces the camera, fading to the point at the centre of the
 * free space as it turns away; otherwise that centre point. Between NEAR_DISTANCE and
 * FAR_DISTANCE (the camera's distance from that point) the pivot slides along the line from
 * the Moon's centre to the point. Every part of this is a continuous function of the camera's
 * pose, so the pivot never jumps.
 *
 * **The floor.** A turn never takes the camera below the 60 km zoom limit: it slides along it.
 */

/**
 * The old System view turntable stopped |y| of the camera's direction at this (about 9.9°
 * from the pole). The System view no longer has a pole limit; kept for other views' rigs.
 */
export const POLE_LIMIT_Y = 0.985;
/** Closer than this to the point of interest (in Moon radii, about 870 km), the pivot is on the surface. */
export const NEAR_DISTANCE = 0.5;
/** Further than this (about 3,500 km), the pivot is the Moon's centre. */
export const FAR_DISTANCE = 2;
/** Close in, a drag turns the view 0.005 rad (0.29°) per CSS pixel. */
const NEAR_RATE = 0.005;

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

/**
 * How much a preset's point of interest still counts, 0 to 1, never switching: it fades out
 * as it nears its own horizon seen from the camera (gone at the horizon, full from about 17°
 * above it), and as it leaves the centre of the view (full within 4° of the look direction,
 * gone beyond 12°), for example after a pan or a zoom toward another spot.
 */
export function focusWeight(focus: THREE.Vector3, position: THREE.Vector3, look: THREE.Vector3): number {
  const toCamera = position.clone().sub(focus);
  const distance = toCamera.length();
  if (distance < 1e-12) return 1;
  toCamera.divideScalar(distance);
  const facing = smooth(0, 0.3, focus.clone().normalize().dot(toCamera));
  const centred = smooth(Math.cos(THREE.MathUtils.degToRad(12)), Math.cos(THREE.MathUtils.degToRad(4)), -toCamera.dot(look.clone().normalize()));
  return facing * centred;
}

export type Pivot = {
  /** The point the drag turns about. */
  point: THREE.Vector3;
  /** The point of interest (on or just inside the surface). */
  surface: THREE.Vector3;
  /** The camera's distance from it, in Moon radii. */
  distance: number;
  /** 0 far out, 1 close in. */
  w: number;
};

/**
 * Where a drag turns about, for a camera at `position` looking along `look`. `focus` is the
 * preset's point of interest, or null.
 */
export function systemPivot(position: THREE.Vector3, look: THREE.Vector3, focus: THREE.Vector3 | null = null): Pivot {
  const centre = centrePoint(position, look);
  const surface = focus ? centre.clone().lerp(focus, focusWeight(focus, position, look)) : centre;
  const distance = surface.distanceTo(position);
  const w = nearness(distance);
  return { point: surface.clone().multiplyScalar(w), surface, distance, w };
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

/** Turns the camera rigidly (position, orientation and up) by `q` about `point`. */
export function turnCamera(camera: THREE.Camera, point: THREE.Vector3, q: THREE.Quaternion): void {
  camera.position.sub(point).applyQuaternion(q).add(point);
  camera.quaternion.premultiply(q);
  camera.up.applyQuaternion(q);
}

/** Keeps the camera at least the zoom limit above the surface: it slides out along its radius. */
function keepAboveFloor(camera: THREE.Camera): void {
  if (camera.position.length() < 1 + MIN_SPACE_ALTITUDE) camera.position.setLength(1 + MIN_SPACE_ALTITUDE);
}

/**
 * A drag of (dx, dy) CSS pixels in the System view: the free trackball described above, as
 * one rotation per step about the screen axis perpendicular to the drag (so a diagonal drag
 * turns diagonally). A rightward drag turns the camera by −a about its up axis, so the world
 * in front of the pivot turns rightward; a downward drag by −a about its right axis.
 */
export function orbitSystem(
  camera: THREE.PerspectiveCamera,
  dx: number,
  dy: number,
  viewportHeight: number,
  focus: THREE.Vector3 | null = null,
): void {
  const pixels = Math.hypot(dx, dy);
  if (!(pixels > 0)) return;
  const pivot = systemPivot(camera.position, lookOf(camera), focus);
  const rate = orbitRate(pivot, camera.fov, viewportHeight);
  const axis = upOf(camera).multiplyScalar(dx).add(rightOf(camera).multiplyScalar(dy));
  if (axis.lengthSq() < 1e-24) return;
  axis.normalize();
  turnCamera(camera, pivot.point, new THREE.Quaternion().setFromAxisAngle(axis, -pixels * rate));
  keepAboveFloor(camera);
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
