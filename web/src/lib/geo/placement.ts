import { degreesToRadians } from "./angles";
import { MOON_RADIUS_M } from "./constants";
import { azimuthElevation, localBasis, type Vec3 } from "./frames";
import { polarStereoForward } from "./projection";
import { trueLocalPosition } from "./scene";
import { latLonToScene, moonFixedToScene, sceneToMoonFixed } from "./system";

/**
 * Where things sit in the one 3D scene behind Mission Control. Every formula here is the
 * one in docs/science.md; this file only chains them:
 *
 * - §14: a Moon-fixed vector (x, y, z) is scene (x, z, −y), with the Moon's radius as 1.
 * - §2.1: a site's local frame (east, north, up), and a direction's azimuth and elevation.
 * - §13: a terrain grid offset (E, N) with height z is at a true local position.
 * - §2.3: the south polar stereographic map the polar-cap images use.
 */

function scale(v: Vec3, k: number): Vec3 {
  return [v[0] * k, v[1] * k, v[2] * k];
}

function add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function normalise(v: Vec3): Vec3 {
  const length = Math.hypot(v[0], v[1], v[2]);
  return length === 0 ? [0, 0, 0] : [v[0] / length, v[1] / length, v[2] / length];
}

// ── The Sun and Earth ───────────────────────────────────────────────────────

/** One hour of `system.bin`: the sub-solar and sub-Earth points, in degrees, and distances. */
export type SystemHour = {
  subsolarLatDeg: number;
  subsolarLonDeg: number;
  subearthLatDeg: number;
  subearthLonDeg: number;
  earthDistKm: number;
  sunDistKm: number;
};

/**
 * docs/science.md §14. Sunlight comes from û(φS, λS) and Earth sits along û(φE, λE), as
 * unit vectors in scene axes. Directions only: the scene squeezes the distances.
 */
export function bodyDirections(hour: SystemHour): { sun: Vec3; earth: Vec3 } {
  return {
    sun: latLonToScene(hour.subsolarLatDeg, hour.subsolarLonDeg),
    earth: latLonToScene(hour.subearthLatDeg, hour.subearthLonDeg),
  };
}

/** docs/science.md §1. Body radii, in kilometres. */
export const SUN_RADIUS_KM = 695_700;
export const EARTH_RADIUS_KM = 6_378.137;
export const MOON_RADIUS_KM = MOON_RADIUS_M / 1_000;

/**
 * docs/features/system-view.md, "Scale". By default Earth and the Sun are squeezed to 2.5
 * Moon radii from the Moon, so they share the frame with it. Every direction stays true.
 */
export const SQUEEZED_DISTANCE = 2.5;
/** The drawn radii of the squeezed bodies, in Moon radii. Chosen for the frame, not to scale. */
export const SQUEEZED_EARTH_RADIUS = 0.4;
export const SQUEEZED_SUN_RADIUS = 0.12;

export type BodyPlacement = { centre: Vec3; radius: number };

/**
 * Where Earth is drawn, in scene units (Moon radii). Squeezed: 2.5 radii along its true
 * direction. True scale: its real distance and its real size.
 */
export function earthPlacement(hour: SystemHour, trueScale: boolean): BodyPlacement {
  const { earth } = bodyDirections(hour);
  if (!trueScale) return { centre: scale(earth, SQUEEZED_DISTANCE), radius: SQUEEZED_EARTH_RADIUS };
  return { centre: scale(earth, hour.earthDistKm / MOON_RADIUS_KM), radius: EARTH_RADIUS_KM / MOON_RADIUS_KM };
}

/** Where the Sun is drawn when squeezed. At true scale it is only a direction. */
export function sunPlacement(hour: SystemHour): BodyPlacement {
  const { sun } = bodyDirections(hour);
  return { centre: scale(sun, SQUEEZED_DISTANCE), radius: SQUEEZED_SUN_RADIUS };
}

// ── A site on the globe ─────────────────────────────────────────────────────

/** docs/science.md §2.1 and §14. A site's east, north and up, as scene unit vectors. */
export function siteFrameScene(latDeg: number, lonDeg: number): { east: Vec3; north: Vec3; up: Vec3 } {
  const { east, north, up } = localBasis(latDeg, lonDeg);
  return {
    east: moonFixedToScene(...east),
    north: moonFixedToScene(...north),
    up: moonFixedToScene(...up),
  };
}

/**
 * docs/science.md §2.1 and §14. A point at a height above the reference sphere, in scene
 * units (Moon radii).
 */
export function surfacePointScene(latDeg: number, lonDeg: number, heightM = 0): Vec3 {
  return scale(latLonToScene(latDeg, lonDeg), (MOON_RADIUS_M + heightM) / MOON_RADIUS_M);
}

/**
 * docs/science.md §2.1 and §14. A direction given in a site's local frame by azimuth and
 * elevation (the series' `sun_az`, `sun_el`, `earth_az`, `earth_el`), as a scene unit vector.
 */
export function localDirectionToScene(azimuthDeg: number, elevationDeg: number, latDeg: number, lonDeg: number): Vec3 {
  const { east, north, up } = siteFrameScene(latDeg, lonDeg);
  const a = degreesToRadians(azimuthDeg);
  const e = degreesToRadians(elevationDeg);
  const horizontal = Math.cos(e);
  return normalise(
    add(add(scale(north, horizontal * Math.cos(a)), scale(east, horizontal * Math.sin(a))), scale(up, Math.sin(e))),
  );
}

/** docs/science.md §2.1 and §14. Azimuth and elevation, at a site, of a scene direction. */
export function sceneDirectionAtSite(
  direction: Vec3,
  latDeg: number,
  lonDeg: number,
): { azimuthDeg: number; elevationDeg: number } {
  return azimuthElevation(normalise(sceneToMoonFixed(...direction)), latDeg, lonDeg);
}

// ── Terrain around a site: the patch and the apron ──────────────────────────

/**
 * docs/science.md §13 and §14. A point given in a site's local frame, in kilometres from
 * the site's ground point (east, north, up), as an offset in scene units (Moon radii) from
 * that ground point. Meshes are built in these small offsets and placed at
 * `siteGroundScene`, so float32 vertices stay precise near the camera.
 */
export function localKmToSceneOffset(eastKm: number, northKm: number, upKm: number, latDeg: number, lonDeg: number): Vec3 {
  const { east, north, up } = siteFrameScene(latDeg, lonDeg);
  const k = 1 / MOON_RADIUS_KM;
  return add(add(scale(east, eastKm * k), scale(north, northKm * k)), scale(up, upKm * k));
}

/** docs/science.md §13 and §14. The site's ground point (R + z0 from the centre), in scene units. */
export function siteGroundScene(latDeg: number, lonDeg: number, groundHeightM: number): Vec3 {
  return surfacePointScene(latDeg, lonDeg, groundHeightM);
}

export type ApronGrid = { rows: number; columns: number; windowM: number };

/**
 * docs/data-contracts.md, "Aprons". The grid offset (E, N) in metres of an apron cell: row 0
 * is the northern edge and column 0 the western edge, over a square `windowM` wide centred
 * on the site.
 */
export function apronCellOffsetM(row: number, column: number, grid: ApronGrid): { eastM: number; northM: number } {
  const half = grid.windowM / 2;
  const eastStep = grid.windowM / (grid.columns - 1);
  const northStep = grid.windowM / (grid.rows - 1);
  return { eastM: -half + column * eastStep, northM: half - row * northStep };
}

/**
 * docs/science.md §13. An apron cell's true local position in kilometres (east, north, up),
 * relative to the site's ground point of height `siteHeightM`. The same formula as the patch,
 * so the two meet.
 */
export function apronCellLocalKm(
  row: number,
  column: number,
  heightM: number,
  siteHeightM: number,
  grid: ApronGrid,
): { eastKm: number; northKm: number; upKm: number } {
  const { eastM, northM } = apronCellOffsetM(row, column, grid);
  const p = trueLocalPosition(eastM, northM, heightM, siteHeightM);
  return { eastKm: p.eastM / 1_000, northKm: p.northM / 1_000, upKm: p.upM / 1_000 };
}

// ── The polar cap images ────────────────────────────────────────────────────

/** docs/features/system-view.md, "Orientation". The cap images cover ±304 km around the pole. */
export const CAP_HALF_WIDTH_M = 304_000;
/** docs/data-contracts.md, "The south polar cap". The cores cover ±76 km. */
export const CAP_CORE_HALF_WIDTH_M = 76_000;

/**
 * docs/science.md §2.3. Texture coordinates (u right, v up, both 0 to 1) of a point in a
 * square south polar stereographic image of half-width `halfWidthM`, centred on the pole,
 * +x right and +y up. With three.js's default `flipY`, v = 1 is the image's top row. A point
 * outside the image gives a value outside 0 to 1. The Moon's shader computes the same thing
 * per pixel (moon-material.ts); the tests check both against known places.
 */
export function capUv(latDeg: number, lonDeg: number, halfWidthM: number): { u: number; v: number } {
  const { x_m, y_m } = polarStereoForward(latDeg, lonDeg);
  return { u: 0.5 + x_m / (2 * halfWidthM), v: 0.5 + y_m / (2 * halfWidthM) };
}
