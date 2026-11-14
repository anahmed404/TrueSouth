import type * as THREE from "three";
import type { DecodedTerrain } from "../../../data";
import { patchGeometry, patchRim, patchUpGrid, type GroundSite } from "./ground";

/**
 * The real close-up ground under the lander (docs/features/local-terrain.md, "The close-up"):
 * NASA's 5 m map of the site, `closeup.bin` (2 km, normally 257 × 257), drawn inside the 20 km
 * patch. Drawing only: nothing reads it back; the series, skyline, slope and every number come
 * from the 80 m map as before.
 *
 * Two adjustments, both stated:
 * - Level. The close-up's heights are moved by one constant so that its centre point sits
 *   where the patch's surface is at the site (the site's ground point). The two maps can
 *   disagree there by a few metres; the lander and the eye then stand on the drawn ground,
 *   2 m up, exactly as without a close-up.
 * - Edge. Across its outer `CLOSEUP_BLEND_KM` the close-up hands over smoothly to the patch's
 *   drawn surface, so at its rim it lies on the patch and the joining strip (ground.ts) has
 *   no step. Inside that margin its own relief is untouched.
 */

/** The width of the hand-over from the close-up to the patch, in kilometres. */
export const CLOSEUP_BLEND_KM = 0.2;

export type MeshData = { data: DecodedTerrain; size: number; windowKm: number };

function finite(value: number | undefined): value is number {
  return value !== undefined && Number.isFinite(value);
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * The patch's drawn surface (its local up, km) at grid offsets (east, north) km, interpolated
 * on the same two triangles per cell the patch draws (ground.ts, gridIndex: a, c, b and b, c,
 * d, with a the north-west corner). Missing heights count as 0, as drawn.
 */
export function patchSurfaceUpKm(patch: MeshData, eastKm: number, northKm: number): number {
  const { data, size, windowKm } = patch;
  const half = windowKm / 2;
  const step = windowKm / (size - 1);
  const x = Math.min(size - 1, Math.max(0, (eastKm + half) / step));
  const y = Math.min(size - 1, Math.max(0, (half - northKm) / step));
  const c0 = Math.min(size - 2, Math.floor(x));
  const r0 = Math.min(size - 2, Math.floor(y));
  const fx = x - c0;
  const fy = y - r0;
  const up = (r: number, c: number) => {
    const v = data.up_km[r * size + c];
    return finite(v) ? v : 0;
  };
  const a = up(r0, c0);
  const b = up(r0, c0 + 1);
  const c = up(r0 + 1, c0);
  const d = up(r0 + 1, c0 + 1);
  if (fx + fy <= 1) return a + (b - a) * fx + (c - a) * fy;
  return d + (c - d) * (1 - fx) + (b - d) * (1 - fy);
}

/** How much of the close-up's height at grid offsets (east, north) km comes from the patch: 0 inside, 1 at its rim. */
export function closeupBlendWeight(eastKm: number, northKm: number, halfKm: number): number {
  return smoothstep(halfKm - CLOSEUP_BLEND_KM, halfKm, Math.max(Math.abs(eastKm), Math.abs(northKm)));
}

/**
 * Whether a close-up is whole: `size` × `size` points, each with a finite east, north and up.
 * The data pipeline writes no missing point, so a single NaN or infinity means a bad file, and
 * the close-up is rejected whole: the scene draws the patch alone and the plate gives the
 * patch's sentence. Its slope column is not drawn and not checked.
 */
export function closeupComplete(closeup: MeshData): boolean {
  const { data, size } = closeup;
  const count = size * size;
  if (!(size >= 2) || data.east_km.length !== count || data.north_km.length !== count || data.up_km.length !== count) return false;
  for (let k = 0; k < count; k += 1) {
    if (!Number.isFinite(data.east_km[k]) || !Number.isFinite(data.north_km[k]) || !Number.isFinite(data.up_km[k])) return false;
  }
  return true;
}

/** Whether the close-up is drawn: whole (closeupComplete) and fitting the patch (closeupFits). */
export function closeupDrawable(patch: MeshData, closeup: MeshData): boolean {
  return closeupFits(patch, closeup) && closeupComplete(closeup);
}

/**
 * How much of the made-up texture (the dimples, and the grain when it is switched off inside
 * the close-up) is drawn at a point `edgeKm` from the site, max(|east|, |north|): none inside
 * the close-up's square, up to its very edge, then fading in over the next `CLOSEUP_BLEND_KM`
 * outside it, over the patch's 80 m ground. The shader's twin is in ground-material.ts.
 */
export function closeupInventedWeight(edgeKm: number, halfKm: number): number {
  return smoothstep(halfKm, halfKm + CLOSEUP_BLEND_KM, edgeKm);
}

/**
 * The close-up as drawn: its own positions, its heights levelled to the site's ground point and
 * handed over to the patch's surface at its edge. Only for a whole close-up (closeupComplete).
 */
export function drawnCloseup(closeup: MeshData, patch: MeshData): DecodedTerrain {
  const { data, size, windowKm } = closeup;
  const half = windowKm / 2;
  const step = windowKm / (size - 1);
  const count = size * size;
  const east = new Float32Array(count);
  const north = new Float32Array(count);
  const up = new Float32Array(count);
  const centre = ((size - 1) / 2) * size + (size - 1) / 2;
  const offset = data.up_km[centre]! - patchSurfaceUpKm(patch, 0, 0);
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const k = r * size + c;
      const gridEast = -half + c * step;
      const gridNorth = half - r * step;
      east[k] = data.east_km[k]!;
      north[k] = data.north_km[k]!;
      const surface = patchSurfaceUpKm(patch, gridEast, gridNorth);
      const levelled = data.up_km[k]! - offset;
      const w = closeupBlendWeight(gridEast, gridNorth, half);
      up[k] = levelled * (1 - w) + surface * w;
    }
  }
  return { east_km: east, north_km: north, up_km: up, slope_deg: data.slope_deg };
}

/** The constant the close-up's heights were moved by, in metres (reported, never used as a result). */
export function closeupLevelOffsetM(closeup: MeshData, patch: MeshData): number {
  const { data, size } = closeup;
  const centreUp = data.up_km[((size - 1) / 2) * size + (size - 1) / 2];
  return finite(centreUp) ? (centreUp - patchSurfaceUpKm(patch, 0, 0)) * 1_000 : 0;
}

/**
 * Whether a close-up of `closeup` fits the patch: inside it, and its edge joinable at every
 * detail level (ground.ts, joinedGridGeometry). The same answer World gets from building it.
 */
export function closeupFits(patch: { size: number; windowKm: number }, closeup: { size: number; windowKm: number }): boolean {
  return closeupRing(patch, closeup) !== null;
}

/**
 * The patch's hole for the close-up: the ring of patch points, `k` points from the centre,
 * that the joining strips meet (the first one outside the close-up on every detail level).
 * Null when the close-up does not fit.
 */
function closeupRing(patch: { size: number; windowKm: number }, closeup: { size: number; windowKm: number }): number | null {
  if (!(closeup.windowKm < patch.windowKm) || patch.size % 2 !== 1) return null;
  if ((closeup.size - 1) % 4 !== 0 || (patch.size - 1) % 4 !== 0) return null;
  const centre = (patch.size - 1) / 2;
  const stepKm = patch.windowKm / (patch.size - 1);
  let k = 1;
  while (k * stepKm <= closeup.windowKm / 2 + 1e-6 || (centre - k) % 4 !== 0) k += 1;
  return k <= centre ? k : null;
}

/**
 * The patch and, where the site has one that fits, its close-up: the patch with a hole and
 * joining strips, the close-up as drawn, and the close-up's heights for the shadow march.
 *
 * The march reads those heights inside the close-up's square and the patch's own 80 m heights
 * outside it, including across the joining strips. Because the close-up's rim lies on the
 * patch's surface (the hand-over), that field differs from the drawn strips no more than it
 * does anywhere else on the patch: measured on 257 × 257 grids, at most 0.04 m at step 1,
 * 0.4 m at step 2 and 2 m at step 4 next to the join, against 0.04, 0.4 and 1.5 m 3 km away.
 * The larger numbers are the coarser drawing while moving, which the field does not follow
 * anywhere (that would take a height texture per level). Filling the patch's hole with the
 * close-up's heights was tried and made the field worse (12 m), so it is not done.
 * Without a close-up (none, failed, incomplete or not fitting) the patch alone, as before.
 */
export function patchWithCloseup(
  terrain: MeshData & { closeup?: MeshData | null },
  site: GroundSite,
): { patch: THREE.BufferGeometry; closeup: THREE.BufferGeometry | null; closeHeights: HeightGridSpec | null } {
  const plain = () => ({ patch: patchGeometry(terrain.data, terrain.size, terrain.windowKm, site), closeup: null, closeHeights: null });
  const close = terrain.closeup;
  if (!close || !closeupDrawable(terrain, close)) return plain();
  const drawn = drawnCloseup(close, terrain);
  const closeup = patchGeometry(drawn, close.size, close.windowKm, site);
  const patch = patchGeometry(terrain.data, terrain.size, terrain.windowKm, site, patchRim(drawn, close.size, close.windowKm, closeup));
  if (!patch.userData.joined) {
    patch.dispose();
    closeup.dispose();
    return plain();
  }
  return {
    patch,
    closeup,
    closeHeights: { heights: patchUpGrid(drawn, close.size), columns: close.size, rows: close.size, halfKm: close.windowKm / 2 },
  };
}

/**
 * The close-up's state for the plate (plates.ts, groundSourcePlate): "ready" only when it is
 * drawn. A file that loaded but is rejected (incomplete, or not fitting) is "none", so the
 * plate says what is drawn: the patch's sentence.
 */
export function closeupPlateState(status: "loading" | "ready" | "error", drawn: boolean): "loading" | "ready" | "error" | "none" {
  if (status !== "ready") return status;
  return drawn ? "ready" : "none";
}

export type HeightGridSpec = { heights: Float32Array; columns: number; rows: number; halfKm: number };
