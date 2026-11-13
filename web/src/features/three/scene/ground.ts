import * as THREE from "three";
import type { DecodedApron, DecodedTerrain } from "../../../data";
import {
  apronCellLocalKm,
  apronCellOffsetM,
  localKmToSceneOffset,
  sceneToMoonFixed,
  siteGroundScene,
  type ApronGrid,
} from "../../../lib/geo";
import { smooth } from "./vec";

/**
 * The ground around the focused site, in the same scene as the globe
 * (docs/features/local-terrain.md, docs/decisions/0013): the 20 km patch from terrain.bin
 * inside the 300 km apron from scene/aprons/<id>.bin, both placed with science.md §13 and
 * §14 through lib/geo. Vertices are offsets from the site's ground point, in Moon radii, so
 * float32 stays precise near the camera; the group sits at the ground point.
 *
 * Each vertex also carries its Moon-fixed position (`aM`), so the ground takes the Moon's
 * colour map and the polar cap's slope maps at the same place as the globe, and its local
 * position in kilometres from the site's ground point (`aL`: east, north, up), which the
 * ground's shader uses for the shadow march and the near-ground texture (ground-material.ts).
 */

export type GroundSite = { latDeg: number; lonDeg: number; groundHeightM: number };

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function gridGeometry(
  size: { rows: number; columns: number },
  site: GroundSite,
  localKm: (row: number, column: number) => { eastKm: number; northKm: number; upKm: number },
  keepQuad: (row: number, column: number, step: number) => boolean,
): THREE.BufferGeometry {
  const { rows, columns } = size;
  const count = rows * columns;
  const position = new Float32Array(count * 3);
  const moonFixed = new Float32Array(count * 3);
  const local = new Float32Array(count * 3);
  const ground = siteGroundScene(site.latDeg, site.lonDeg, site.groundHeightM);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const k = row * columns + column;
      const { eastKm, northKm, upKm } = localKm(row, column);
      local[k * 3] = eastKm;
      local[k * 3 + 1] = northKm;
      local[k * 3 + 2] = upKm;
      const offset = localKmToSceneOffset(eastKm, northKm, upKm, site.latDeg, site.lonDeg);
      position[k * 3] = offset[0];
      position[k * 3 + 1] = offset[1];
      position[k * 3 + 2] = offset[2];
      const m = sceneToMoonFixed(ground[0] + offset[0], ground[1] + offset[1], ground[2] + offset[2]);
      moonFixed[k * 3] = m[0];
      moonFixed[k * 3 + 1] = m[1];
      moonFixed[k * 3 + 2] = m[2];
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aM", new THREE.BufferAttribute(moonFixed, 3));
  geometry.setAttribute("aL", new THREE.BufferAttribute(local, 3));
  // Normals from the full mesh only, before the coarser levels join the index.
  const full = gridIndex(rows, columns, 1, keepQuad);
  geometry.setIndex(full);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  // Coarser levels of the same grid, every 2nd and every 4th point, for drawing while the
  // camera moves on a weak GPU. They share one index buffer with the full mesh and are picked
  // with the draw range, so nothing more is uploaded or has to be released.
  const levels: GroundLod = { 1: { start: 0, count: full.length } };
  let all = full;
  for (const step of GROUND_LOD_STEPS) {
    if (step === 1 || (rows - 1) % step !== 0 || (columns - 1) % step !== 0) continue;
    const coarse = gridIndex(rows, columns, step, keepQuad);
    levels[step] = { start: all.length, count: coarse.length };
    // concat, not push(...): a spread of 100,000 arguments can overflow the stack.
    all = all.concat(coarse);
  }
  geometry.setIndex(all);
  geometry.setDrawRange(0, full.length);
  geometry.userData.lod = levels;
  return geometry;
}

/** The ground's mesh levels: 1 is every grid point, 2 every second, 4 every fourth. */
export const GROUND_LOD_STEPS = [1, 2, 4] as const;
export type GroundLodStep = (typeof GROUND_LOD_STEPS)[number];
/** Where each level's triangles are in the geometry's one index buffer. */
export type GroundLod = Partial<Record<GroundLodStep, { start: number; count: number }>>;

/** Two triangles for each kept quad of a grid, on every `step`-th row and column. */
export function gridIndex(
  rows: number,
  columns: number,
  step: number,
  keepQuad: (row: number, column: number, step: number) => boolean,
): number[] {
  const index: number[] = [];
  for (let row = 0; row + step <= rows - 1; row += step) {
    for (let column = 0; column + step <= columns - 1; column += step) {
      if (!keepQuad(row, column, step)) continue;
      const a = row * columns + column;
      const b = a + step;
      const c = a + step * columns;
      const d = c + step;
      index.push(a, c, b, b, c, d);
    }
  }
  return index;
}

/**
 * The patch: terrain.bin's true local positions (science.md §13), already in kilometres
 * relative to the site's ground point. A missing vertex takes its grid offset at the site's
 * height, so the mesh has no holes.
 */
export function patchGeometry(terrain: DecodedTerrain, size: number, windowKm: number, site: GroundSite): THREE.BufferGeometry {
  const half = windowKm / 2;
  const step = windowKm / (size - 1);
  return gridGeometry(
    { rows: size, columns: size },
    site,
    (row, column) => {
      const k = row * size + column;
      return {
        eastKm: finite(terrain.east_km[k], -half + column * step),
        northKm: finite(terrain.north_km[k], half - row * step),
        upKm: finite(terrain.up_km[k], 0),
      };
    },
    () => true,
  );
}

/**
 * An apron cell's drawn height in metres: its height from the file (the site's own where it
 * has none), eased down to the reference sphere toward the outer edge, where the globe takes
 * over. Drawing only.
 */
function apronDrawnHeightM(apron: DecodedApron, grid: ApronGrid, row: number, column: number, site: GroundSite): number {
  const halfM = grid.windowM / 2;
  const { eastM, northM } = apronCellOffsetM(row, column, grid);
  const edge = Math.max(Math.abs(eastM), Math.abs(northM)) / halfM;
  return finite(apron.heights[row * grid.columns + column], site.groundHeightM) * (1 - smooth(0.8, 0.98, edge));
}

/**
 * The heights the shadow march reads (ground-material.ts), as drawn: each grid point's local
 * "up" in kilometres (science.md §13, so the Moon's curvature is in it), row 0 north and
 * column 0 west. The patch's missing points are at the site's height, as in `patchGeometry`.
 * The apron's are not lowered under the patch: the march reads the patch there.
 */
export function patchUpGrid(terrain: DecodedTerrain, size: number): Float32Array {
  const out = new Float32Array(size * size);
  for (let k = 0; k < size * size; k += 1) out[k] = finite(terrain.up_km[k], 0);
  return out;
}

export function apronUpGrid(apron: DecodedApron, grid: ApronGrid, site: GroundSite): Float32Array {
  const out = new Float32Array(grid.rows * grid.columns);
  for (let row = 0; row < grid.rows; row += 1) {
    for (let column = 0; column < grid.columns; column += 1) {
      const height = apronDrawnHeightM(apron, grid, row, column, site);
      out[row * grid.columns + column] = apronCellLocalKm(row, column, height, site.groundHeightM, grid).upKm;
    }
  }
  return out;
}

/**
 * The apron, with a hole where the patch is. Apron vertices under the patch sit 30 m lower so
 * the patch covers the cells across its edge, and the outer edge eases down to the reference sphere,
 * where the globe takes over. Both changes are drawing only.
 */
export function apronGeometry(apron: DecodedApron, grid: ApronGrid, patchHalfKm: number, site: GroundSite): THREE.BufferGeometry {
  const halfKm = grid.windowM / 2_000;
  const offsetKm = (row: number, column: number) => ({
    east: -halfKm + (column * 2 * halfKm) / (grid.columns - 1),
    north: halfKm - (row * 2 * halfKm) / (grid.rows - 1),
  });
  return gridGeometry(
    { rows: grid.rows, columns: grid.columns },
    site,
    (row, column) => {
      const { east, north } = offsetKm(row, column);
      let height = apronDrawnHeightM(apron, grid, row, column, site);
      // Only vertices strictly under the patch: the patch hides them, and nothing outside it moves.
      if (Math.max(Math.abs(east), Math.abs(north)) < patchHalfKm) height -= 30;
      return apronCellLocalKm(row, column, height, site.groundHeightM, grid);
    },
    (row, column, step) => {
      const a = offsetKm(row, column);
      const b = offsetKm(row + step, column + step);
      const inside =
        Math.max(Math.abs(a.east), Math.abs(b.east)) < patchHalfKm - 1e-6 &&
        Math.max(Math.abs(a.north), Math.abs(b.north)) < patchHalfKm - 1e-6;
      return !inside;
    },
  );
}

/** A sphere-tier site has no terrain: the smooth Moon, as a flat-height apron. */
export function smoothGroundGeometry(site: GroundSite): THREE.BufferGeometry {
  const grid: ApronGrid = { rows: 121, columns: 121, windowM: 300_000 };
  return gridGeometry(
    { rows: grid.rows, columns: grid.columns },
    site,
    (row, column) => apronCellLocalKm(row, column, 0, site.groundHeightM, grid),
    () => true,
  );
}

/** The patch's outline, in Ridge Line grey: its rim vertices, slightly raised. */
export function patchOutline(patch: THREE.BufferGeometry, size: number, lift: THREE.Vector3): THREE.BufferGeometry {
  const position = patch.getAttribute("position");
  const ring: number[] = [];
  for (let c = 0; c < size; c += 1) ring.push(c);
  for (let r = 1; r < size; r += 1) ring.push(r * size + size - 1);
  for (let c = size - 2; c >= 0; c -= 1) ring.push((size - 1) * size + c);
  for (let r = size - 2; r > 0; r -= 1) ring.push(r * size);
  const points = ring.map((k) => new THREE.Vector3(position.getX(k), position.getY(k), position.getZ(k)).add(lift));
  return new THREE.BufferGeometry().setFromPoints(points);
}
