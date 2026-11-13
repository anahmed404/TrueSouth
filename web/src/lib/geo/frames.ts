import { degreesToRadians, radiansToDegrees, wrapAzimuth, wrapLongitude } from "./angles";
import { MOON_RADIUS_M } from "./constants";

export type Vec3 = readonly [number, number, number];

/** docs/science.md §2.1. East and north are undefined closer to a pole than this. */
const POLE_LIMIT_DEG = 89.999;

function clampAsin(value: number): number {
  return Math.min(1, Math.max(-1, value));
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function assertSiteHasEastAndNorth(latDeg: number): void {
  if (Math.abs(latDeg) > POLE_LIMIT_DEG) {
    throw new RangeError("East and north are undefined when |latitude| > 89.999°. See docs/science.md §2.1.");
  }
}

/** docs/science.md §2.1. û(φ, λ) = (cos φ cos λ, cos φ sin λ, sin φ). */
export function unitVector(latDeg: number, lonDeg: number): Vec3 {
  const lat = degreesToRadians(latDeg);
  const lon = degreesToRadians(lonDeg);
  const cosLat = Math.cos(lat);
  return [cosLat * Math.cos(lon), cosLat * Math.sin(lon), Math.sin(lat)];
}

/**
 * docs/science.md §2.1. Local frame at a site: east, north, up.
 * Rejects |φ| > 89.999°, where east and north are undefined.
 */
export function localBasis(latDeg: number, lonDeg: number): { east: Vec3; north: Vec3; up: Vec3 } {
  assertSiteHasEastAndNorth(latDeg);
  const lat = degreesToRadians(latDeg);
  const lon = degreesToRadians(lonDeg);
  const sinLat = Math.sin(lat);
  const cosLat = Math.cos(lat);
  const sinLon = Math.sin(lon);
  const cosLon = Math.cos(lon);
  return {
    east: [-sinLon, cosLon, 0],
    north: [-sinLat * cosLon, -sinLat * sinLon, cosLat],
    up: [cosLat * cosLon, cosLat * sinLon, sinLat],
  };
}

/**
 * docs/science.md §2.1. Elevation and azimuth of a Moon-fixed unit direction.
 * e = arcsin(d̂ · û), A = atan2(d̂ · ê, d̂ · n̂) mod 360°.
 * Straight up or down has no azimuth; that case returns 0°.
 */
export function azimuthElevation(
  direction: Vec3,
  latDeg: number,
  lonDeg: number,
): { azimuthDeg: number; elevationDeg: number } {
  const { east, north, up } = localBasis(latDeg, lonDeg);
  const elevationDeg = radiansToDegrees(Math.asin(clampAsin(dot(direction, up))));
  const eastComponent = dot(direction, east);
  const northComponent = dot(direction, north);
  // Straight up or down: both dots vanish, and float noise makes atan2 wander.
  const azimuthDeg =
    Math.hypot(eastComponent, northComponent) <= 1e-12
      ? 0
      : wrapAzimuth(radiansToDegrees(Math.atan2(eastComponent, northComponent)));
  return { azimuthDeg, elevationDeg };
}

/**
 * docs/science.md §2.2. Walk `distanceM` metres from a site along azimuth `azimuthDeg`.
 * γ = s / R.
 */
export function destination(
  latDeg: number,
  lonDeg: number,
  azimuthDeg: number,
  distanceM: number,
  radiusM: number = MOON_RADIUS_M,
): { latDeg: number; lonDeg: number } {
  assertSiteHasEastAndNorth(latDeg);
  const lat = degreesToRadians(latDeg);
  const azimuth = degreesToRadians(azimuthDeg);
  const gamma = distanceM / radiusM;
  const sinLat2 = Math.sin(lat) * Math.cos(gamma) + Math.cos(lat) * Math.sin(gamma) * Math.cos(azimuth);
  const lat2 = Math.asin(clampAsin(sinLat2));
  const deltaLon = Math.atan2(
    Math.sin(azimuth) * Math.sin(gamma) * Math.cos(lat),
    Math.cos(gamma) - Math.sin(lat) * Math.sin(lat2),
  );
  return {
    latDeg: radiansToDegrees(lat2),
    lonDeg: wrapLongitude(lonDeg + radiansToDegrees(deltaLon)),
  };
}
