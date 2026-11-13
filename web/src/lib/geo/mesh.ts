import { wrapAzimuth } from "./angles";
import { SKYLINE_BINS } from "./constants";

/**
 * docs/data-contracts.md `terrain.bin`. Row-major index.
 * Row 0 is the northern edge and column 0 is the western edge.
 */
export function terrainIndex(row: number, col: number, size: number): number {
  return row * size + col;
}

/** docs/data-contracts.md `terrain.bin`. Inverse of the row-major index. */
export function terrainRowCol(index: number, size: number): { row: number; col: number } {
  return { row: Math.floor(index / size), col: index % size };
}

/**
 * docs/science.md §13 and docs/data-contracts.md `terrain.bin`.
 * Evenly spaced offsets of a square grid centred on the site, in metres.
 * Row 0 is north (+north) and column 0 is west (−east).
 */
export function terrainOffsetM(
  row: number,
  col: number,
  size: number,
  halfExtentM: number,
): { eastM: number; northM: number } {
  const span = size - 1;
  return {
    eastM: halfExtentM * (-1 + (2 * col) / span),
    northM: halfExtentM * (1 - (2 * row) / span),
  };
}

/**
 * docs/data-contracts.md `skyline.bin` and docs/science.md §1.
 * Bin k is centred on azimuth 0.25k degrees. Pass `bins` from the manifest's
 * `skyline_bins` or a site's `meta.skyline.bins`; the default is the 1,440 of §1.
 */
export function skylineBinCentreDeg(bin: number, bins: number = SKYLINE_BINS): number {
  return (bin * 360) / bins;
}

/**
 * docs/data-contracts.md `skyline.bin`. Nearest skyline bin to an azimuth.
 * A tie rounds toward the higher bin, and 359.875° lands on bin 0.
 */
export function skylineBinForAzimuth(azimuthDeg: number, bins: number = SKYLINE_BINS): number {
  return Math.round((wrapAzimuth(azimuthDeg) * bins) / 360) % bins;
}
