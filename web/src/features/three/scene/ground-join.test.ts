import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type * as THREE from "three";
import { describe, expect, it } from "vitest";
import { decodeTerrain } from "../../../data/decode";
import { CONTINUATION_GRID, continuationApron, type GlobalHeights } from "./custom-apron";
import { apronGeometry, GROUND_LOD_STEPS, patchGeometry, patchRim, type GroundLod, type GroundLodStep, type GroundSite } from "./ground";
import { MOTION_DETAIL } from "./ground-material";
import { trueLocalPosition } from "../../../lib/geo";

/**
 * The drawn join between the patch and the apron: the triangles themselves are sampled, not
 * the height function, on both sides of the patch's rim. Tolerance: 0.25 m between points
 * 10 cm either side of the rim (the rim is a shared edge, so only the ground's own slope over
 * those 20 cm separates them).
 */

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..");
const bytes = readFileSync(path.join(repoRoot, "data", "fixtures", "sites", "fixture_ridge", "terrain.bin"));
const terrain = decodeTerrain(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), 33, "terrain.bin");
const SIZE = 33;
const WINDOW_KM = 20;

function flatMap(metres: number): GlobalHeights {
  const values = new Uint8Array(1440 * 720).fill(Math.round(((metres + 9_000) / 19_600) * 255));
  return { width: 1440, height: 720, values };
}

/** The drawn surface's local up (km) at (east, north) km, from the triangles of detail level `step`. */
function drawnUpAt(geometry: THREE.BufferGeometry, east: number, north: number, step: GroundLodStep = 1): number | null {
  const local = geometry.getAttribute("aL");
  const index = geometry.index!.array;
  const lod = geometry.userData.lod as GroundLod | undefined;
  const start = lod?.[step]?.start ?? 0;
  const count = lod?.[step]?.count ?? index.length;
  for (let t = start; t < start + count; t += 3) {
    const [a, b, c] = [index[t]!, index[t + 1]!, index[t + 2]!];
    const ax = local.getX(a), ay = local.getY(a);
    const bx = local.getX(b), by = local.getY(b);
    const cx = local.getX(c), cy = local.getY(c);
    const d = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (d === 0) continue;
    const wa = ((by - cy) * (east - cx) + (cx - bx) * (north - cy)) / d;
    const wb = ((cy - ay) * (east - cx) + (ax - cx) * (north - cy)) / d;
    const wc = 1 - wa - wb;
    if (wa < -1e-7 || wb < -1e-7 || wc < -1e-7) continue;
    return wa * local.getZ(a) + wb * local.getZ(b) + wc * local.getZ(c);
  }
  return null;
}

/**
 * The largest drawn height difference (m) across the rim at detail level `step`, sampled along
 * every segment of the patch's edge as that level draws it (every `step`-th rim point).
 */
function largestGapM(
  patch: THREE.BufferGeometry,
  apron: THREE.BufferGeometry,
  offsetKm: number,
  step: GroundLodStep = 1,
  source = terrain,
): { gap: number; missing: number } {
  const rim = patchRim(source, SIZE, WINDOW_KM).points.filter((_, i) => i % step === 0);
  let gap = 0;
  let missing = 0;
  for (let i = 0; i < rim.length; i += 1) {
    const p = rim[i]!;
    const q = rim[(i + 1) % rim.length]!;
    for (const f of [0.25, 0.5, 0.75]) {
      const e = p.eastKm + (q.eastKm - p.eastKm) * f;
      const n = p.northKm + (q.northKm - p.northKm) * f;
      // Outward: away from the centre along the side's own axis.
      const [ox, oy] = Math.abs(e) > Math.abs(n) ? [Math.sign(e), 0] : [0, Math.sign(n)];
      const inside = drawnUpAt(patch, e - ox * offsetKm, n - oy * offsetKm, step);
      const outside = drawnUpAt(apron, e + ox * offsetKm, n + oy * offsetKm, step);
      if (inside === null || outside === null) {
        missing += 1;
        continue;
      }
      gap = Math.max(gap, Math.abs(outside - inside) * 1_000);
    }
  }
  return { gap, missing };
}

const flatCatalogApron = { heights: new Float64Array(161 * 161).fill(1_000), rows: 161, columns: 161 };

describe("the drawn join between the patch and the apron", () => {
  for (const groundHeightM of [-2_600, 0, 1_400]) {
    for (const latDeg of [-85.3, -72]) {
      const site: GroundSite = { latDeg, lonDeg: 31.2, groundHeightM };
      it(`a custom site at ${latDeg}°, ground ${groundHeightM} m: no gap and no step (within 0.25 m), no hole`, () => {
        const patch = patchGeometry(terrain, SIZE, WINDOW_KM, site);
        const data = continuationApron(terrain, SIZE, WINDOW_KM, site, flatMap(groundHeightM - 400));
        const joined = apronGeometry(data, CONTINUATION_GRID, WINDOW_KM / 2, site, patchRim(terrain, SIZE, WINDOW_KM));
        const result = largestGapM(patch, joined, 0.0001);
        expect(result.missing).toBe(0);
        expect(result.gap).toBeLessThan(0.25);
        // The older join, measured the same way, left the apron metres below the patch.
        const old = apronGeometry(data, CONTINUATION_GRID, WINDOW_KM / 2, site);
        expect(largestGapM(patch, old, 0.0001).gap).toBeGreaterThan(5);
      });
    }
  }

  it("a catalog-style apron (161 × 161 over 300 km) joins the same way", () => {
    const site: GroundSite = { latDeg: -89.4555, lonDeg: 222.6192, groundHeightM: 1_000 };
    const patch = patchGeometry(terrain, SIZE, WINDOW_KM, site);
    const joined = apronGeometry(flatCatalogApron, { rows: 161, columns: 161, windowM: 300_000 }, WINDOW_KM / 2, site, patchRim(terrain, SIZE, WINDOW_KM));
    const result = largestGapM(patch, joined, 0.0001);
    expect(result.missing).toBe(0);
    expect(result.gap).toBeLessThan(0.25);
  });

  it("covers the ground between the rim and the apron's first ring with no hole", () => {
    const site: GroundSite = { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 };
    const data = continuationApron(terrain, SIZE, WINDOW_KM, site, flatMap(-200));
    const joined = apronGeometry(data, CONTINUATION_GRID, WINDOW_KM / 2, site, patchRim(terrain, SIZE, WINDOW_KM));
    // A ring of points between 10.05 km and 11.2 km from the centre, all round.
    for (let a = 0; a < 360; a += 7.5) {
      for (const r of [10.05, 10.6, 11.2]) {
        const t = (a * Math.PI) / 180;
        const scale = r / Math.max(Math.abs(Math.cos(t)), Math.abs(Math.sin(t)));
        expect(drawnUpAt(joined, Math.cos(t) * scale, Math.sin(t) * scale)).not.toBeNull();
      }
    }
  });
});

/** The fixture's patch made flat at a true height of `metres`: up from §13 at every point. */
function flatTerrain(metres: number, siteHeightM: number) {
  const up = new Float32Array(SIZE * SIZE);
  for (let r = 0; r < SIZE; r += 1) {
    for (let c = 0; c < SIZE; c += 1) {
      up[r * SIZE + c] = trueLocalPosition(-10_000 + c * 625, 10_000 - r * 625, metres, siteHeightM).upM / 1_000;
    }
  }
  return { ...terrain, up_km: up };
}

describe("the drawn join at every detail level the scene can show (patch and apron at the governor's one step)", () => {
  it("the levels: full detail at rest, and every step the moving levels use, for both meshes", () => {
    const steps = new Set<number>([1, ...MOTION_DETAIL.filter((d) => d !== null).map((d) => d!.meshStep)]);
    for (const step of steps) expect(GROUND_LOD_STEPS as readonly number[]).toContain(step);
    const site: GroundSite = { latDeg: -85.3, lonDeg: 31.2, groundHeightM: 0 };
    const patch = patchGeometry(terrain, SIZE, WINDOW_KM, site);
    const data = continuationApron(terrain, SIZE, WINDOW_KM, site, flatMap(0));
    const apron = apronGeometry(data, CONTINUATION_GRID, WINDOW_KM / 2, site, patchRim(terrain, SIZE, WINDOW_KM));
    for (const step of steps) {
      expect((patch.userData.lod as GroundLod)[step as GroundLodStep]).toBeDefined();
      expect((apron.userData.lod as GroundLod)[step as GroundLodStep]).toBeDefined();
    }
  });

  for (const step of GROUND_LOD_STEPS) {
    for (const groundHeightM of [-2_600, 0, 1_400]) {
      for (const latDeg of [-85.3, -72]) {
        for (const shape of ["ridge", "flat"] as const) {
          it(`step ${step}, ${latDeg}°, ground ${groundHeightM} m, ${shape} patch: no gap, no step (within 0.25 m), no hole`, () => {
            const site: GroundSite = { latDeg, lonDeg: 31.2, groundHeightM };
            const source = shape === "ridge" ? terrain : flatTerrain(groundHeightM + 300, groundHeightM);
            const patch = patchGeometry(source, SIZE, WINDOW_KM, site);
            const data = continuationApron(source, SIZE, WINDOW_KM, site, flatMap(groundHeightM - 400));
            const apron = apronGeometry(data, CONTINUATION_GRID, WINDOW_KM / 2, site, patchRim(source, SIZE, WINDOW_KM, patch));
            const result = largestGapM(patch, apron, 0.0001, step, source);
            expect(result.missing).toBe(0);
            expect(result.gap).toBeLessThan(0.25);
          });
        }
      }
    }
  }

  it("a catalog-style apron joins the same way at every level", () => {
    const site: GroundSite = { latDeg: -89.4555, lonDeg: 222.6192, groundHeightM: 1_000 };
    const patch = patchGeometry(terrain, SIZE, WINDOW_KM, site);
    const apron = apronGeometry(flatCatalogApron, { rows: 161, columns: 161, windowM: 300_000 }, WINDOW_KM / 2, site, patchRim(terrain, SIZE, WINDOW_KM));
    for (const step of GROUND_LOD_STEPS) {
      const result = largestGapM(patch, apron, 0.0001, step);
      expect(result.missing).toBe(0);
      expect(result.gap).toBeLessThan(0.25);
    }
  });
});
