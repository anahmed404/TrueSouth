import type { Vec3 } from "../../../lib/geo";

/** Small vector helpers on plain tuples, so the camera logic is testable without WebGL. */
export type V3 = Vec3;

export const add = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const mul = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: V3, b: V3): V3 => [
  a[1] * b[2] - a[2] * b[1],
  a[2] * b[0] - a[0] * b[2],
  a[0] * b[1] - a[1] * b[0],
];
export const len = (a: V3): number => Math.hypot(a[0], a[1], a[2]);
export const norm = (a: V3): V3 => {
  const l = len(a);
  return l < 1e-15 ? [0, 0, 0] : [a[0] / l, a[1] / l, a[2] / l];
};

/** The part of `v` perpendicular to the unit vector `axis`, normalised. */
export function perpendicular(v: V3, axis: V3): V3 {
  return norm(sub(v, mul(axis, dot(v, axis))));
}

/** Any unit vector perpendicular to the unit vector `a`. */
export function anyPerpendicular(a: V3): V3 {
  const ref: V3 = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  return norm(cross(ref, a));
}

/** Spherical interpolation between two unit vectors; opposite vectors turn through a perpendicular. */
export function slerp(a: V3, b: V3, t: number): V3 {
  const d = Math.min(1, Math.max(-1, dot(a, b)));
  const theta = Math.acos(d);
  if (theta < 1e-9) return norm(add(mul(a, 1 - t), mul(b, t)));
  if (Math.PI - theta < 1e-3) {
    const mid = anyPerpendicular(a);
    return t < 0.5 ? slerp(a, mid, t * 2) : slerp(mid, b, t * 2 - 1);
  }
  const s = Math.sin(theta);
  return norm(add(mul(a, Math.sin((1 - t) * theta) / s), mul(b, Math.sin(t * theta) / s)));
}

export const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x));

/** Smoothstep from `a` to `b` (either order). */
export function smooth(a: number, b: number, x: number): number {
  const t = clamp((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
}
