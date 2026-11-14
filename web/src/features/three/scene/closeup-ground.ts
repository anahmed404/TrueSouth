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
 * The close-up as drawn: its own positions, its heights levelled to the site's ground point and
 * handed over to the patch's surface at its edge. A missing close-up height takes the patch's.
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
  const centreUp = data.up_km[centre];
  const offset = finite(centreUp) ? centreUp - patchSurfaceUpKm(patch, 0, 0) : 0;
  for (let r = 0; r < size; r += 1) {
    for (let c = 0; c < size; c += 1) {
      const k = r * size + c;
      const gridEast = -half + c * step;
      const gridNorth = half - r * step;
      const e = data.east_km[k];
      const n = data.north_km[k];
      east[k] = finite(e) ? e : gridEast;
      north[k] = finite(n) ? n : gridNorth;
      const surface = patchSurfaceUpKm(patch, gridEast, gridNorth);
      const own = data.up_km[k];
      const levelled = finite(own) ? own - offset : surface;
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
  if (!(closeup.windowKm < patch.windowKm) || patch.size % 2 !== 1) return false;
  if ((closeup.size - 1) % 4 !== 0 || (patch.size - 1) % 4 !== 0) return false;
  const centre = (patch.size - 1) / 2;
  const stepKm = patch.windowKm / (patch.size - 1);
  let k = 1;
  while (k * stepKm <= closeup.windowKm / 2 + 1e-6 || (centre - k) % 4 !== 0) k += 1;
  return k <= centre;
}

/**
 * The patch and, where the site has one that fits, its close-up: the patch with a hole and
 * joining strips, the close-up as drawn, and the close-up's heights for the shadow march.
 * Without a close-up (none, failed, or not fitting) the patch alone, as before.
 */
export function patchWithCloseup(
  terrain: MeshData & { closeup?: MeshData | null },
  site: GroundSite,
): { patch: THREE.BufferGeometry; closeup: THREE.BufferGeometry | null; closeHeights: HeightGridSpec | null } {
  const plain = () => ({ patch: patchGeometry(terrain.data, terrain.size, terrain.windowKm, site), closeup: null, closeHeights: null });
  const close = terrain.closeup;
  if (!close || !closeupFits(terrain, close)) return plain();
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

export type HeightGridSpec = { heights: Float32Array; columns: number; rows: number; halfKm: number };
