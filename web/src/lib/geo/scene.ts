import { degreesToRadians, radiansToDegrees, wrapAzimuth } from "./angles";
import { MOON_RADIUS_M, SKYLINE_WALL_RADIUS_KM } from "./constants";
import type { Vec3 } from "./frames";

/** docs/science.md §13. x = east, y = up, z = −north. Units are unchanged. */
export function enuToScene(east: number, north: number, up: number): Vec3 {
  return [east, up, -north];
}

/** docs/science.md §13. Inverse of the local-terrain axis map. */
export function sceneToEnu(scene: Vec3): { east: number; north: number; up: number } {
  return { east: scene[0], up: scene[1], north: -scene[2] };
}

/**
 * docs/science.md §13. A direction of azimuth A and elevation e is
 * (x, y, z) = (cos e sin A, sin e, −cos e cos A).
 */
export function azimuthElevationToScene(azimuthDeg: number, elevationDeg: number): Vec3 {
  const azimuth = degreesToRadians(azimuthDeg);
  const elevation = degreesToRadians(elevationDeg);
  const cosElevation = Math.cos(elevation);
  return [cosElevation * Math.sin(azimuth), Math.sin(elevation), -cosElevation * Math.cos(azimuth)];
}

/**
 * docs/science.md §13. Inverse of the scene direction.
 * Straight up or down has no azimuth; that case returns 0°.
 */
export function sceneToAzimuthElevation(direction: Vec3): { azimuthDeg: number; elevationDeg: number } {
  const [x, y, z] = direction;
  const horizontal = Math.hypot(x, z);
  if (horizontal <= 1e-12) {
    return { azimuthDeg: 0, elevationDeg: y >= 0 ? 90 : -90 };
  }
  return {
    azimuthDeg: wrapAzimuth(radiansToDegrees(Math.atan2(x, -z))),
    elevationDeg: radiansToDegrees(Math.atan2(y, horizontal)),
  };
}

/**
 * docs/science.md §13. True local position of a grid offset, in metres.
 * east = (R+z) sin γ sin A, north = (R+z) sin γ cos A, up = (R+z) cos γ − (R+z0),
 * with s = √(E²+N²), A = atan2(E, N) and γ = s/R.
 */
export function trueLocalPosition(
  eastOffsetM: number,
  northOffsetM: number,
  heightM: number,
  siteHeightM: number,
  radiusM: number = MOON_RADIUS_M,
): { eastM: number; northM: number; upM: number } {
  const distanceM = Math.hypot(eastOffsetM, northOffsetM);
  const gamma = distanceM / radiusM;
  const azimuth = Math.atan2(eastOffsetM, northOffsetM);
  const radialM = radiusM + heightM;
  return {
    eastM: radialM * Math.sin(gamma) * Math.sin(azimuth),
    northM: radialM * Math.sin(gamma) * Math.cos(azimuth),
    upM: radialM * Math.cos(gamma) - (radiusM + siteHeightM),
  };
}

/** docs/science.md §13. True local position in scene kilometres. */
export function trueLocalToSceneKm(
  eastOffsetM: number,
  northOffsetM: number,
  heightM: number,
  siteHeightM: number,
  radiusM: number = MOON_RADIUS_M,
): Vec3 {
  const { eastM, northM, upM } = trueLocalPosition(eastOffsetM, northOffsetM, heightM, siteHeightM, radiusM);
  return enuToScene(eastM / 1_000, northM / 1_000, upM / 1_000);
}

/**
 * docs/science.md §13. Height of the skyline wall above the site, in kilometres.
 * The wall's top at azimuth A is radiusKm × tan H(A). The default radius is 10 km.
 */
export function skylineWallHeightKm(elevationDeg: number, radiusKm: number = SKYLINE_WALL_RADIUS_KM): number {
  return radiusKm * Math.tan(degreesToRadians(elevationDeg));
}
