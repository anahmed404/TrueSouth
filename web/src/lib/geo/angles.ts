/** docs/science.md §1. Angles are degrees outside a formula and radians inside it. */
export function degreesToRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/** docs/science.md §1. Angles are degrees outside a formula and radians inside it. */
export function radiansToDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** docs/science.md §1. Folds an angle into [0, 360). */
function wrapFullCircle(degrees: number): number {
  const remainder = degrees % 360;
  const positive = remainder < 0 ? remainder + 360 : remainder;
  return positive === 0 ? 0 : positive;
}

/** docs/science.md §1. Azimuth is clockwise from north, reported in [0, 360). */
export function wrapAzimuth(degrees: number): number {
  return wrapFullCircle(degrees);
}

/** docs/science.md §1. East longitude is in [0, 360). */
export function wrapLongitude(degrees: number): number {
  return wrapFullCircle(degrees);
}

/**
 * docs/science.md §1. Shortest signed turn from `fromDeg` to `toDeg`.
 * Positive is clockwise, matching azimuth. The result is in (−180, 180],
 * and an exact half-turn is +180.
 */
export function signedAzimuthDifference(fromDeg: number, toDeg: number): number {
  const clockwise = wrapAzimuth(toDeg - fromDeg);
  return clockwise > 180 ? clockwise - 360 : clockwise;
}
