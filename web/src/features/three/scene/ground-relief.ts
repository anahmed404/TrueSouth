import { CAP_CORE_HALF_WIDTH_M, CAP_HALF_WIDTH_M, MOON_RADIUS_M } from "../../../lib/geo";
import type { V3 } from "./vec";

/**
 * The pure parts of how the ground is drawn (ground-material.ts), in TypeScript so they can
 * be tested; the shader repeats each formula line for line. Everything here is drawing:
 * nothing decides lit or dark (AGENTS.md).
 */

/** The cap images cover ±304 km around the pole and the cores ±76 km, in Moon radii. */
export const CAP_HALF_WIDTH = CAP_HALF_WIDTH_M / MOON_RADIUS_M;
export const CORE_HALF_WIDTH = CAP_CORE_HALF_WIDTH_M / MOON_RADIUS_M;

/**
 * docs/science.md §2.3, written on the Moon-fixed vector instead of latitude and longitude.
 * With sin φ = m_z / |m| and tan(45° + φ/2) = cos φ / (1 − sin φ), the forward formulas
 * x = ρ sin λ and y = ρ cos λ become x = 2 m_y / (|m| − m_z), y = 2 m_x / (|m| − m_z), with
 * R = 1. Near the pole this keeps float32 precise: no asin of a number close to −1.
 * Returns map (x, y) in Moon radii.
 */
export function capMapXY(m: V3): [number, number] {
  const length = Math.hypot(m[0], m[1], m[2]);
  const den = length - m[2];
  return [(2 * m[1]) / den, (2 * m[0]) / den];
}

/** The map's scale factor k(φ) = 2 / (1 + sin|φ|) (science.md §2.3), south of the equator. */
export function capScaleFactor(m: V3): number {
  const length = Math.hypot(m[0], m[1], m[2]);
  return (2 * length) / (length - m[2]);
}

/** Texture coordinates in a square cap image of half-width `halfWidth` (Moon radii); see placement.ts `capUv`. */
export function capImageUv(xy: [number, number], halfWidth: number): { u: number; v: number } {
  return { u: 0.5 + xy[0] / (2 * halfWidth), v: 0.5 + xy[1] / (2 * halfWidth) };
}

/** GLSL's smoothstep. */
export function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Inside the patch's last band, its own mesh normals hand over to the map's normals. */
export const PATCH_BLEND_KM = { start: 1.6, end: 0.15 };

export type ReliefWeights = {
  /** The patch's own mesh normals (80 m data, 78 m grid). */
  mesh: number;
  /** The map's normals: the cap slope map, or the core's where `core` says. */
  map: number;
  /** Within the map's share, how much comes from the ±76 km core (160 m) instead of the cap (320 m). */
  core: number;
};

/**
 * Where each source of surface normals is used, for a ground point `eastKm`, `northKm` from
 * the site and at cap map position `xy` (Moon radii). The rest, 1 − mesh − map, is the
 * apron's own coarse mesh normal: outside the polar cap, or before the cap images load.
 */
export function reliefWeights(
  eastKm: number,
  northKm: number,
  xy: [number, number],
  patchHalfKm: number,
  capLoaded: boolean,
  southern: boolean,
): ReliefWeights {
  const edge = Math.max(Math.abs(eastKm), Math.abs(northKm));
  const mesh = patchHalfKm > 0 ? 1 - smoothstep(patchHalfKm - PATCH_BLEND_KM.start, patchHalfKm - PATCH_BLEND_KM.end, edge) : 0;
  const rho = Math.hypot(xy[0], xy[1]);
  const cap = capLoaded && southern ? 1 - smoothstep(CAP_HALF_WIDTH * 0.965, CAP_HALF_WIDTH * 0.995, rho) : 0;
  const core = 1 - smoothstep(0.92, 1, Math.max(Math.abs(xy[0]), Math.abs(xy[1])) / CORE_HALF_WIDTH);
  return { mesh, map: cap * (1 - mesh), core };
}

/** A slope map texel (0 to 1, as the GPU reads it) to the slope it stores: round(128 + 160 s). */
export function slopeFromTexel(t: number): number {
  return (t * 255 - 128) / 160;
}

/**
 * The Sun's angular radius as seen from the Moon, in radians: the drawn shadow's edge is
 * as soft as the Sun's disc, no softer.
 */
export const SUN_ANGULAR_RADIUS = (0.2665 * Math.PI) / 180;

/**
 * How much of the Sun's disc the drawing shows above the drawn terrain, from the Sun's and
 * the drawn horizon's elevation (radians). A smooth step across the disc, for drawing only.
 */
export function drawnSunVisible(sunElevation: number, horizonElevation: number): number {
  return smoothstep(-SUN_ANGULAR_RADIUS, SUN_ANGULAR_RADIUS, sunElevation - horizonElevation);
}

/**
 * Earthshine for the drawing: Earth's lit fraction seen from the Moon, (1 − ŝ·ê) / 2, where ŝ
 * and ê are the directions to the Sun and to Earth. Full Earth when the Sun is behind the Moon.
 */
export function earthLitFraction(sun: V3, earth: V3): number {
  const dot = sun[0] * earth[0] + sun[1] * earth[1] + sun[2] * earth[2];
  return (1 - dot) / 2;
}

/**
 * The procedural near-ground texture fades out as each feature size shrinks to a few
 * pixels: weight 1 while a pixel covers less than `lo` of the feature's cell, 0 above `hi`.
 * So it shows only close up, where the 80 m data has no detail, and never at map scale.
 */
export const GRAIN_FADE = { lo: 0.035, hi: 0.14 };
export function grainWeight(pixelFootprintM: number, cellM: number): number {
  return 1 - smoothstep(GRAIN_FADE.lo * cellM, GRAIN_FADE.hi * cellM, pixelFootprintM);
}
