import type { DecodedApron, DecodedTerrain } from "../../../data";
import { sceneImageUrl } from "../../../data";
import { apronCellOffsetM, destination, MOON_RADIUS_M, type ApronGrid } from "../../../lib/geo";
import type { GroundSite } from "./ground";

/**
 * The terrain around a custom site's patch (docs/features/local-terrain.md, "A custom site").
 *
 * A catalog site's apron comes from the pipeline. A custom site has none: the API does not
 * make one. Without it the patch sat alone at the site's true height, often kilometres above
 * or below the globe's reference sphere, inside the 140 km hole the globe leaves for an apron.
 *
 * So the browser builds one from data it already holds, and invents nothing:
 * - over the patch, the patch's own heights (terrain.bin);
 * - farther out, NASA's global height map the scene already loads for the globe
 *   (`scene/moon_height_1440.png`, LOLA, 4 pixels a degree, heights −9.0 to +10.6 km in 256
 *   steps), sampled at each cell's true position (science.md §2.2);
 * - between them, a smooth hand-over over `CONTINUATION_BLEND_KM` from the patch's edge.
 * The result has the catalog apron's layout, so it is drawn, shaded and shadowed the same
 * way, and it eases down to the reference sphere at its outer edge like every apron.
 */

/** The catalog apron's layout (docs/data-contracts.md, "Aprons"). */
export const CONTINUATION_GRID: ApronGrid = { rows: 161, columns: 161, windowM: 300_000 };

/** The hand-over from the patch's edge to the global map, in kilometres. */
export const CONTINUATION_BLEND_KM = 25;

/** The global height map, red channel only: row 0 is 90° N, column 0 is 180° W (data-contracts.md). */
export type GlobalHeights = { width: number; height: number; values: Uint8Array };

const HEIGHT_MIN_M = -9_000;
const HEIGHT_SPAN_M = 19_600;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Height above the reference sphere in metres at a latitude and east longitude, bilinear
 * between pixel centres. Longitude wraps; latitude stops at the first and last rows.
 */
export function globalHeightM(map: GlobalHeights, latDeg: number, lonDeg: number): number {
  const { width, height, values } = map;
  const lon = ((((lonDeg + 180) % 360) + 360) % 360) - 180;
  const x = ((lon + 180) / 360) * width - 0.5;
  const y = Math.min(height - 1, Math.max(0, ((90 - latDeg) / 180) * height - 0.5));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const col = (c: number) => ((c % width) + width) % width;
  const row = (r: number) => Math.min(height - 1, Math.max(0, r));
  const at = (r: number, c: number) => values[row(r) * width + col(c)]!;
  const top = at(y0, x0) * (1 - fx) + at(y0, x0 + 1) * fx;
  const bottom = at(y0 + 1, x0) * (1 - fx) + at(y0 + 1, x0 + 1) * fx;
  return HEIGHT_MIN_M + ((top * (1 - fy) + bottom * fy) / 255) * HEIGHT_SPAN_M;
}

/**
 * The patch's true height above the reference sphere, in metres, at local offsets (E, N) in
 * metres, clamped to the patch: terrain.bin's `up` is relative to the site's ground point and
 * includes the Moon's curvature (science.md §13), so z = (R + z0 + up) / cos γ − R with
 * γ = s / R. Bilinear between grid points; a missing point counts as up = 0, as drawn.
 */
export function patchHeightM(terrain: DecodedTerrain, size: number, windowKm: number, site: GroundSite, eastM: number, northM: number): number {
  const halfM = (windowKm * 1_000) / 2;
  const stepM = (windowKm * 1_000) / (size - 1);
  const e = Math.min(halfM, Math.max(-halfM, eastM));
  const n = Math.min(halfM, Math.max(-halfM, northM));
  const cx = (e + halfM) / stepM;
  const ry = (halfM - n) / stepM;
  const c0 = Math.min(size - 2, Math.floor(cx));
  const r0 = Math.min(size - 2, Math.floor(ry));
  const fx = cx - c0;
  const fy = ry - r0;
  const up = (r: number, c: number) => {
    const v = terrain.up_km[r * size + c];
    return v !== undefined && Number.isFinite(v) ? v * 1_000 : 0;
  };
  const upM = (up(r0, c0) * (1 - fx) + up(r0, c0 + 1) * fx) * (1 - fy) + (up(r0 + 1, c0) * (1 - fx) + up(r0 + 1, c0 + 1) * fx) * fy;
  const gamma = Math.hypot(e, n) / MOON_RADIUS_M;
  return (MOON_RADIUS_M + site.groundHeightM + upM) / Math.cos(gamma) - MOON_RADIUS_M;
}

/** How much of a cell's height comes from the global map: 0 on the patch, 1 from `CONTINUATION_BLEND_KM` beyond its edge. */
export function continuationWeight(eastM: number, northM: number, patchHalfKm: number): number {
  const beyondKm = Math.max(Math.abs(eastM), Math.abs(northM)) / 1_000 - patchHalfKm;
  return smoothstep(0, CONTINUATION_BLEND_KM, beyondKm);
}

/**
 * The custom site's ground height in metres at local offsets (E, N) in metres: the patch's
 * own height on it, its edge's height carried outward and handed over to the global map.
 */
export function continuationHeightM(
  terrain: DecodedTerrain,
  size: number,
  windowKm: number,
  site: GroundSite,
  map: GlobalHeights,
  eastM: number,
  northM: number,
): number {
  const local = patchHeightM(terrain, size, windowKm, site, eastM, northM);
  const w = continuationWeight(eastM, northM, windowKm / 2);
  if (w === 0) return local;
  const azimuth = (Math.atan2(eastM, northM) * 180) / Math.PI;
  const point = destination(site.latDeg, site.lonDeg, azimuth, Math.hypot(eastM, northM));
  return local * (1 - w) + globalHeightM(map, point.latDeg, point.lonDeg) * w;
}

/** The apron for a custom site, in the catalog apron's layout and units (heights in metres). */
export function continuationApron(
  terrain: DecodedTerrain,
  size: number,
  windowKm: number,
  site: GroundSite,
  map: GlobalHeights,
  grid: ApronGrid = CONTINUATION_GRID,
): DecodedApron {
  const heights = new Float64Array(grid.rows * grid.columns);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const { eastM, northM } = apronCellOffsetM(row, column, grid);
      heights[row * grid.columns + column] = continuationHeightM(terrain, size, windowKm, site, map, eastM, northM);
    }
  }
  return { heights, rows: grid.rows, columns: grid.columns };
}

let heightsOnce: Promise<GlobalHeights | null> | null = null;

/**
 * The global height map's pixels, read once for the session (the globe's own copy is a GPU
 * texture). Null when it cannot be read: the custom site then shows its patch alone.
 */
export function loadGlobalHeights(): Promise<GlobalHeights | null> {
  heightsOnce ??= (async () => {
    try {
      const response = await fetch(sceneImageUrl("scene/moon_height_1440.png"));
      if (!response.ok) return null;
      const bitmap = await createImageBitmap(await response.blob(), { colorSpaceConversion: "none", premultiplyAlpha: "none" });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const context = canvas.getContext("2d");
      if (!context) return null;
      context.drawImage(bitmap, 0, 0);
      const rgba = context.getImageData(0, 0, bitmap.width, bitmap.height).data;
      const values = new Uint8Array(bitmap.width * bitmap.height);
      for (let k = 0; k < values.length; k += 1) values[k] = rgba[k * 4]!;
      bitmap.close();
      return { width: canvas.width, height: canvas.height, values };
    } catch {
      return null;
    }
  })();
  return heightsOnce;
}
