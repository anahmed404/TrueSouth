import type { FreeSpace } from "../../../app/scene";
import { MOON_RADIUS_M, CAP_HALF_WIDTH_M } from "../../../lib/geo";
import { add, clamp, cross, dot, len, mul, norm, perpendicular, slerp, sub, type V3 } from "./vec";
import { DRAWN_EARTH_RADIUS, EARTH_FARTHEST_KM, drawnDistance } from "./proportions";

/**
 * The camera rig's logic, without WebGL (docs/features/system-view.md, "Camera").
 * Scene units are Moon radii (science.md §14). A pose is a position, a look direction, an
 * up vector and a vertical field of view in degrees.
 */
export type Pose = { pos: V3; look: V3; up: V3; fov: number };

/** The System view's lens. */
export const SPACE_FOV = 30;
/** Local terrain's lens. */
export const TERRAIN_FOV = 40;
/** Lander's eye's lens (the prototype's 26°). */
export const EYE_FOV = 26;

/** Flights take 1.3 to 1.5 s (system-view.md, "Camera moves"). */
export const FLIGHT_MS = 1_400;
/** The first load eases in from 1.5 times the distance over 1.4 s. */
export const INTRO_MS = 1_400;
export const INTRO_FACTOR = 1.5;
/** When panels fold, the centre slides to the new free space in 200 ms. */
export const INSET_MS = 200;
/** Reduced motion: a 120 ms dip through Night and a cut. */
export const DIP_MS = 120;

/** The System view's zoom limit: 60 km from the surface. */
export const MIN_SPACE_ALTITUDE = 60_000 / MOON_RADIUS_M;
/** The lowest ground on the Moon is about 9.1 km below the reference sphere; altitudes in a
 *  flight are measured above a sphere 10 km lower still, so they are always positive. */
const FLIGHT_FLOOR = 1 - 20_000 / MOON_RADIUS_M;

/** Local terrain: the camera sits 19 km from the site, 22° up (the approved prototype). */
export const TERRAIN_DISTANCE = 19_000 / MOON_RADIUS_M;
export const TERRAIN_ELEVATION_DEG = 22;
/** Lander's eye: 2 m above the ground (science.md §1, h_obs). */
export const EYE_HEIGHT = 2 / MOON_RADIUS_M;

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

/**
 * Where a flight is at eased time `t`: the direction from the Moon's centre turns on a great
 * circle and the altitude changes logarithmically, so the path never passes through the Moon.
 */
export function lerpPose(a: Pose, b: Pose, t: number): Pose {
  const ra = len(a.pos) - FLIGHT_FLOOR;
  const rb = len(b.pos) - FLIGHT_FLOOR;
  const altitude = Math.exp(Math.log(Math.max(ra, 1e-9)) * (1 - t) + Math.log(Math.max(rb, 1e-9)) * t);
  const direction = slerp(norm(a.pos), norm(b.pos), t);
  const look = slerp(norm(a.look), norm(b.look), t);
  const up = perpendicular(slerp(norm(a.up), norm(b.up), t), look);
  return {
    pos: mul(direction, FLIGHT_FLOOR + altitude),
    look,
    up: len(up) > 0.5 ? up : norm(a.up),
    fov: a.fov + (b.fov - a.fov) * t,
  };
}

// ── The free space ──────────────────────────────────────────────────────────

/**
 * The camera's principal point at the centre of the free space, as three.js's view offset:
 * `camera.setViewOffset(width, height, x, y, width, height)`. The full frustum's centre then
 * lands on the free space's centre, so the subject is never covered by a panel and nothing
 * is cropped. With no free space left, the window's centre.
 */
export function viewOffset(space: FreeSpace): { x: number; y: number; width: number; height: number } {
  const { width, height } = space.viewport;
  if (space.width <= 0 || space.height <= 0) return { x: 0, y: 0, width, height };
  const cx = space.x + space.width / 2;
  const cy = space.y + space.height / 2;
  return { x: width / 2 - cx, y: height / 2 - cy, width, height };
}

/** The free space's centre in CSS pixels, the point the subject lands on. */
export function freeCentre(space: FreeSpace): { x: number; y: number } {
  if (space.width <= 0 || space.height <= 0) return { x: space.viewport.width / 2, y: space.viewport.height / 2 };
  return { x: space.x + space.width / 2, y: space.y + space.height / 2 };
}

/**
 * The distance from the subject's centre at which a subject reaching `halfX` to the sides
 * and `halfY` up and down fits in the free space, with a margin. `fovDeg` is the vertical
 * lens over the whole window's height.
 */
export function fitDistance(halfX: number, halfY: number, fovDeg: number, space: FreeSpace, margin = 1.12): number {
  const viewportH = Math.max(1, space.viewport.height);
  const freeW = Math.max(space.width, 80);
  const freeH = Math.max(space.height, 80);
  const tanHalf = Math.tan((fovDeg * Math.PI) / 360);
  const dx = halfX / (tanHalf * (freeW / viewportH));
  const dy = halfY / (tanHalf * (freeH / viewportH));
  return Math.max(dx, dy) * margin;
}

/** What the System view frames: the Moon and the bodies drawn beside it, in scene units. */
export type Subjects = {
  sun: { dir: V3; centre: V3; radius: number } | null;
  earth: { centre: V3; radius: number };
};

/** The Sun's drawn glow ends by 1.8 disc radii (system-view.md, "What it shows"). */
const SUN_EXTENT = 1.8;

function extents(subjects: Subjects, right: V3, up: V3): { halfX: number; halfY: number } {
  let halfX = 1;
  let halfY = 1;
  const bodies = [subjects.earth, ...(subjects.sun ? [{ ...subjects.sun, radius: subjects.sun.radius * SUN_EXTENT }] : [])];
  for (const body of bodies) {
    halfX = Math.max(halfX, Math.abs(dot(body.centre, right)) + body.radius);
    halfY = Math.max(halfY, Math.abs(dot(body.centre, up)) + body.radius);
  }
  return { halfX, halfY };
}

/**
 * The opening view (the team lead, 2026-11-14): the Moon in the middle of the free space as
 * the subject, Earth whole beside it, the Sun far outside. Scene units are Moon radii.
 *
 * - The camera looks up the Moon's axis from under the south pole, turned so that the
 *   Moon's 0° meridian, the direction Earth always lies in to within libration (about 8°),
 *   points along the free space's longer side: Earth sits to the left of the Moon on a
 *   laptop, above it on a phone. Left, because the sight-line labels sit to the right of the
 *   short "To Earth" mark, so they never reach Earth.
 * - It leans `tiltDeg` away from Earth's side, so Earth is always a little further from the
 *   camera than the Moon (it reads as behind, and is never "in front" by proportions.ts,
 *   bodyInFront); the south pole stays near the middle of the Moon's disc.
 * - It does not depend on the hour, so scrubbing time never moves it.
 * - `earthReach` (Earth's centre at its farthest, plus its drawn radius) must fit along the
 *   long side; `across` is the room needed across it: Earth's swing with libration, its
 *   radius and its label below it.
 * - Earth is whole inside the free space in every layout, never a slice behind or between
 *   panels: at 1440 × 900 with the panels open that puts the Moon at about 80 px, and at
 *   1024 × 768 at about 38 px (Earth needs about 4.8 Moon radii of the half-width: 396 px and
 *   188 px). `minMoonPx` only guards free spaces smaller than any of the four layouts tested.
 */
/** How far the opening view leans away from Earth's side, in degrees. */
const OPENING_TILT_DEG = 15;

export const OPENING = {
  // Seen with the lean, Earth's centre is cos(tilt) as far to the side.
  earthReach: drawnDistance(EARTH_FARTHEST_KM) * Math.cos((OPENING_TILT_DEG * Math.PI) / 180) + DRAWN_EARTH_RADIUS,
  across: 2.1,
  margin: 1.03,
  tiltDeg: OPENING_TILT_DEG,
  minMoonPx: 30,
} as const;

/** The camera distance at which the Moon's radius is `px` pixels in a window `viewportHeight` tall. */
export function distanceForMoonPx(px: number, viewportHeight: number, fovDeg = SPACE_FOV): number {
  const k = viewportHeight / (2 * Math.tan((fovDeg * Math.PI) / 360) * Math.max(px, 1e-6));
  return Math.sqrt(1 + k * k);
}

/**
 * Home: the opening view described at OPENING. At true scale (no Sun drawn) it frames the
 * Moon and Earth at its real distance, as it always has.
 */
export function homePose(drawn: Subjects, space: FreeSpace): Pose {
  const look: V3 = [0, 1, 0];
  if (!drawn.sun) {
    // True scale: Earth across the free space's longer side, the camera backed off to fit it.
    const e = drawn.earth.centre;
    const across: V3 = len([e[0], 0, e[2]]) > 1e-6 ? [e[0], 0, e[2]] : [1, 0, 0];
    const a = norm(across);
    const b = norm(cross(a, look));
    let best: Pose | null = null;
    let bestDistance = Infinity;
    for (const right of [a, b]) {
      const up = norm(cross(right, look));
      const { halfX, halfY } = extents(drawn, right, up);
      const distance = fitDistance(halfX, halfY, SPACE_FOV, space);
      if (distance < bestDistance - 1e-9) {
        bestDistance = distance;
        best = { pos: mul(look, -distance), look, up, fov: SPACE_FOV };
      }
    }
    return best as Pose;
  }
  // Earth to the left (screen up is −z, so screen right is −x) or, on a tall screen, at the top
  // (screen up is +x, Earth's side).
  const left = { up: [0, 0, -1] as V3, distance: fitDistance(OPENING.earthReach, OPENING.across, SPACE_FOV, space, OPENING.margin) };
  const top = { up: [1, 0, 0] as V3, distance: fitDistance(OPENING.across, OPENING.earthReach, SPACE_FOV, space, OPENING.margin) };
  const pick = top.distance < left.distance - 1e-9 ? top : left;
  const distance = Math.min(pick.distance, distanceForMoonPx(OPENING.minMoonPx, space.viewport.height));
  // Lean away from Earth's side (scene −x) by tiltDeg, still looking at the Moon's centre.
  const t = (OPENING.tiltDeg * Math.PI) / 180;
  const pos: V3 = [-distance * Math.sin(t), -distance * Math.cos(t), 0];
  const tilted: V3 = [Math.sin(t), Math.cos(t), 0];
  return { pos, look: tilted, up: perpendicular(pick.up, tilted), fov: SPACE_FOV };
}

/** "From Earth" and "From the Sun": looking back at the Moon along that body's direction. */
export function fromDirectionPose(direction: V3, space: FreeSpace): Pose {
  const d = norm(direction);
  const look = mul(d, -1);
  let up = perpendicular([0, 1, 0], look);
  if (len(up) < 0.5) up = perpendicular([1, 0, 0], look);
  return { pos: mul(d, fitDistance(1, 1, SPACE_FOV, space, 1.35)), look, up, fov: SPACE_FOV };
}

/** "Follow site": the focused site faces the camera, north up. */
export function followSitePose(siteUp: V3, siteNorth: V3, space: FreeSpace): Pose {
  const look = mul(norm(siteUp), -1);
  return {
    pos: mul(norm(siteUp), fitDistance(1, 1, SPACE_FOV, space, 1.35)),
    look,
    up: perpendicular(siteNorth, look),
    fov: SPACE_FOV,
  };
}

/**
 * The Polar map: straight below the south pole, looking up the axis, with the map's north
 * (+y, toward 0° E: science.md §2.3) at the top. Scene +x is Moon-fixed +x, the 0° meridian.
 * The camera backs off until the ±304 km cap fits the free space.
 */
export function polarPose(space: FreeSpace): Pose {
  const half = CAP_HALF_WIDTH_M / MOON_RADIUS_M;
  const distance = fitDistance(half, half, SPACE_FOV, space, 1.04);
  return { pos: [0, -(1 + distance), 0], look: [0, 1, 0], up: [1, 0, 0], fov: SPACE_FOV };
}

/**
 * How the Polar map's end pose maps the pole plane to the screen: the pole lands on the free
 * space's centre, and one CSS pixel there is this many metres. The flat map can take over at
 * exactly this scale.
 */
export function polarScale(pose: Pose, space: FreeSpace): { x: number; y: number; metresPerPixel: number } {
  const distance = -pose.pos[1] - 1;
  const halfHeight = distance * Math.tan((pose.fov * Math.PI) / 360);
  const centre = freeCentre(space);
  return { ...centre, metresPerPixel: (halfHeight * MOON_RADIUS_M) / (space.viewport.height / 2) };
}

export type SiteFrame = { ground: V3; east: V3; north: V3; up: V3 };

/** A direction in the site's local frame, from azimuth and elevation in degrees. */
export function siteDirection(frame: SiteFrame, azimuthDeg: number, elevationDeg: number): V3 {
  const a = (azimuthDeg * Math.PI) / 180;
  const e = (elevationDeg * Math.PI) / 180;
  return norm(
    add(add(mul(frame.north, Math.cos(e) * Math.cos(a)), mul(frame.east, Math.cos(e) * Math.sin(a))), mul(frame.up, Math.sin(e))),
  );
}

/** The mean of two azimuths, in degrees. */
export function meanAzimuth(a: number, b: number): number {
  const ra = (a * Math.PI) / 180;
  const rb = (b * Math.PI) / 180;
  return (Math.atan2(Math.sin(ra) + Math.sin(rb), Math.cos(ra) + Math.cos(rb)) * 180) / Math.PI;
}

/**
 * Local terrain: 19 km from the site and 22° up, turned so both sight-lines run away from
 * the viewer (the approved prototype).
 */
export function terrainPose(frame: SiteFrame, sunAzDeg: number, earthAzDeg: number): Pose {
  const az = meanAzimuth(sunAzDeg, earthAzDeg) + 180 + 25;
  const offset = mul(siteDirection(frame, az, TERRAIN_ELEVATION_DEG), TERRAIN_DISTANCE);
  const pos = add(frame.ground, offset);
  return { pos, look: norm(mul(offset, -1)), up: frame.up, fov: TERRAIN_FOV };
}

/**
 * Lander's eye: 2 m above the ground at the site, looking along the horizon toward a body's
 * azimuth, tipped up by half its elevation so the horizon and the body are both in frame.
 */
export function eyePose(frame: SiteFrame, azimuthDeg: number, elevationDeg: number): Pose {
  const pos = add(frame.ground, mul(frame.up, EYE_HEIGHT));
  const tilt = clamp(elevationDeg / 2, 0, 20);
  return { pos, look: siteDirection(frame, azimuthDeg, tilt), up: frame.up, fov: EYE_FOV };
}

/** The intro: the same look, from 1.5 times as far. */
export function introStart(pose: Pose): Pose {
  return { ...pose, pos: mul(pose.pos, INTRO_FACTOR) };
}

/** Altitude above the reference sphere, in Moon radii. */
export function altitudeOf(pos: V3): number {
  return len(pos) - 1;
}

/** Distance between two points, in metres. */
export function metresBetween(a: V3, b: V3): number {
  return len(sub(a, b)) * MOON_RADIUS_M;
}
