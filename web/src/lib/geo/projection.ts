import { degreesToRadians, radiansToDegrees, wrapLongitude } from "./angles";
import { MOON_RADIUS_M } from "./constants";

export type MapImage = {
  /** docs/data-contracts.md `maps/meta.json`. Metres from the pole to the mid-side of the image. */
  half_width_m: number;
  /** Pixel width and height. The meta file does not store this; 4k and 8k share one half-width. */
  size_px: number;
};

/**
 * docs/science.md §2.3. South polar stereographic projection, true scale at the pole,
 * central meridian 0°. ρ = 2R tan(45° + φ/2), x = ρ sin λ, y = ρ cos λ.
 */
export function polarStereoForward(
  latDeg: number,
  lonDeg: number,
  radiusM: number = MOON_RADIUS_M,
): { x_m: number; y_m: number } {
  const lat = degreesToRadians(latDeg);
  const lon = degreesToRadians(lonDeg);
  const rho = 2 * radiusM * Math.tan(Math.PI / 4 + lat / 2);
  return { x_m: rho * Math.sin(lon), y_m: rho * Math.cos(lon) };
}

/**
 * docs/science.md §2.3. Inverse of the south polar stereographic projection.
 * λ = atan2(x, y), folded into [0, 360). At the origin, atan2(0, 0) is 0°.
 */
export function polarStereoInverse(
  x_m: number,
  y_m: number,
  radiusM: number = MOON_RADIUS_M,
): { latDeg: number; lonDeg: number } {
  const rho = Math.hypot(x_m, y_m);
  const lat = 2 * Math.atan(rho / (2 * radiusM)) - Math.PI / 2;
  return {
    latDeg: radiansToDegrees(lat),
    lonDeg: wrapLongitude(radiansToDegrees(Math.atan2(x_m, y_m))),
  };
}

/** docs/science.md §2.3. Map scale k(φ) = 2 / (1 + sin|φ|). */
export function polarStereoScale(latDeg: number): number {
  return 2 / (1 + Math.sin(degreesToRadians(Math.abs(latDeg))));
}

/**
 * docs/science.md §2.3 and docs/data-contracts.md `maps/meta.json`.
 * Column 0 is the left edge, row 0 is the top. +x is right and +y is up.
 * (col, row) is the centre of that pixel.
 */
function pixelCentreMetres(col: number, row: number, image: MapImage): { x_m: number; y_m: number } {
  const metresPerPixel = (2 * image.half_width_m) / image.size_px;
  return {
    x_m: (col + 0.5 - image.size_px / 2) * metresPerPixel,
    y_m: (image.size_px / 2 - (row + 0.5)) * metresPerPixel,
  };
}

function metresToPixelCentre(x_m: number, y_m: number, image: MapImage): { col: number; row: number } {
  const metresPerPixel = (2 * image.half_width_m) / image.size_px;
  return {
    col: x_m / metresPerPixel + image.size_px / 2 - 0.5,
    row: image.size_px / 2 - 0.5 - y_m / metresPerPixel,
  };
}

/** docs/science.md §2.3. Map pixel centre to latitude and east longitude. */
export function pixelToLatLon(
  col: number,
  row: number,
  image: MapImage,
  radiusM: number = MOON_RADIUS_M,
): { latDeg: number; lonDeg: number } {
  const { x_m, y_m } = pixelCentreMetres(col, row, image);
  return polarStereoInverse(x_m, y_m, radiusM);
}

/** docs/science.md §2.3. Latitude and east longitude to a map pixel centre. */
export function latLonToPixel(
  latDeg: number,
  lonDeg: number,
  image: MapImage,
  radiusM: number = MOON_RADIUS_M,
): { col: number; row: number } {
  const { x_m, y_m } = polarStereoForward(latDeg, lonDeg, radiusM);
  return metresToPixelCentre(x_m, y_m, image);
}
