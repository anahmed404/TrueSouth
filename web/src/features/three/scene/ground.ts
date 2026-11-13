import * as THREE from "three";
import type { DecodedApron, DecodedTerrain } from "../../../data";
import {
  apronCellLocalKm,
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
 * colour map at the same place as the globe.
 */

export type GroundSite = { latDeg: number; lonDeg: number; groundHeightM: number };

function finite(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}

function gridGeometry(
  size: { rows: number; columns: number },
  site: GroundSite,
  localKm: (row: number, column: number) => { eastKm: number; northKm: number; upKm: number },
  keepQuad: (row: number, column: number) => boolean,
): THREE.BufferGeometry {
  const { rows, columns } = size;
  const count = rows * columns;
  const position = new Float32Array(count * 3);
  const moonFixed = new Float32Array(count * 3);
  const ground = siteGroundScene(site.latDeg, site.lonDeg, site.groundHeightM);
  for (let row = 0; row < rows; row += 1) {
    for (let column = 0; column < columns; column += 1) {
      const k = row * columns + column;
      const { eastKm, northKm, upKm } = localKm(row, column);
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
  const index: number[] = [];
  for (let row = 0; row < rows - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      if (!keepQuad(row, column)) continue;
      const a = row * columns + column;
      const b = a + 1;
      const c = a + columns;
      const d = c + 1;
      index.push(a, c, b, b, c, d);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(position, 3));
  geometry.setAttribute("aM", new THREE.BufferAttribute(moonFixed, 3));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
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
 * The apron, with a hole where the patch is. Cells that overlap the patch's edge sit 30 m
 * lower so the patch covers them, and the outer edge eases down to the reference sphere,
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
      const edge = Math.max(Math.abs(east), Math.abs(north)) / halfKm;
      let height = finite(apron.heights[row * grid.columns + column], site.groundHeightM);
      height *= 1 - smooth(0.8, 0.98, edge);
      if (Math.max(Math.abs(east), Math.abs(north)) < patchHalfKm * 1.15) height -= 30;
      return apronCellLocalKm(row, column, height, site.groundHeightM, grid);
    },
    (row, column) => {
      const a = offsetKm(row, column);
      const b = offsetKm(row + 1, column + 1);
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
