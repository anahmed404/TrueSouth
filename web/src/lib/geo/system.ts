import { degreesToRadians, radiansToDegrees, wrapLongitude } from "./angles";
import type { Vec3 } from "./frames";
import { unitVector } from "./frames";

function clampAsin(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

/** docs/science.md §14. A Moon-fixed (x, y, z) becomes scene (x, z, −y). */
export function moonFixedToScene(x: number, y: number, z: number): Vec3 {
  return [x, z, -y];
}

/** docs/science.md §14. Inverse of the System view axis map: scene (x, y, z) is Moon-fixed (x, −z, y). */
export function sceneToMoonFixed(x: number, y: number, z: number): Vec3 {
  return [x, -z, y];
}

/**
 * docs/science.md §2.1 and §14. Latitude and east longitude on the unit sphere
 * in System view coordinates. The Moon's radius in the scene is 1.
 */
export function latLonToScene(latDeg: number, lonDeg: number): Vec3 {
  const [x, y, z] = unitVector(latDeg, lonDeg);
  return moonFixedToScene(x, y, z);
}

/**
 * docs/science.md §2.1 and §14. Inverse of a System view point back to latitude
 * and east longitude. The point is normalised, so scale does not matter.
 */
export function sceneToLatLon(scene: Vec3): { latDeg: number; lonDeg: number } {
  const [x, y, z] = sceneToMoonFixed(scene[0], scene[1], scene[2]);
  const length = Math.hypot(x, y, z);
  const latDeg = radiansToDegrees(Math.asin(clampAsin(z / length)));
  const lonDeg = wrapLongitude(radiansToDegrees(Math.atan2(y / length, x / length)));
  return { latDeg, lonDeg };
}

/**
 * docs/science.md §14. Sun elevation from the sub-solar point alone.
 * sin e = sin φ sin φs + cos φ cos φs cos(λ − λs).
 */
export function sunElevationDeg(
  latDeg: number,
  lonDeg: number,
  subsolarLatDeg: number,
  subsolarLonDeg: number,
): number {
  const lat = degreesToRadians(latDeg);
  const subsolarLat = degreesToRadians(subsolarLatDeg);
  const deltaLon = degreesToRadians(lonDeg - subsolarLonDeg);
  const sine =
    Math.sin(lat) * Math.sin(subsolarLat) + Math.cos(lat) * Math.cos(subsolarLat) * Math.cos(deltaLon);
  return radiansToDegrees(Math.asin(clampAsin(sine)));
}
