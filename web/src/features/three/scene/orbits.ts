import * as THREE from "three";
import type { V3 } from "./vec";

/**
 * The System view's two faint orbit lines (docs/features/system-view.md, "What it shows"):
 * the Moon's orbit, a circle centred on the drawn Earth through the Moon's centre, and Earth's
 * orbit, a circle centred on the drawn Sun through Earth's centre.
 *
 * They draw the idea of an orbit at the schematic distances; they are not computed orbits
 * (the frontend does no ephemeris science). Each circle lies in the plane that contains the
 * line between its two bodies and is nearest the Moon's equatorial plane (scene y is the
 * Moon's axis): Earth and the Sun always lie within about 7° of that plane, so the plane never
 * becomes undefined and turns smoothly as the hour moves. The parts of a circle inside the
 * Moon or Earth are cut away at the sphere, so a line ends on a body's limb rather than
 * crossing it.
 */

/** Steps per circle. */
export const ORBIT_SEGMENTS = 256;
/**
 * Segments each line's fixed buffer holds: one per step, plus room for the few steps a body
 * splits in two when a chord passes through it with neither end inside.
 */
export const ORBIT_CAPACITY = ORBIT_SEGMENTS + 8;

export type Circle = { centre: V3; radius: number; normal: V3; start: V3 };

/** A sphere a line must not enter. */
export type Solid = { centre: V3; radius: number };

// Scratch for the allocation-free path. A circle is [cx, cy, cz, radius, ax, ay, az, nx, ny, nz]
// (centre, radius, unit start, unit normal); the solids are [cx, cy, cz, radius] each.
const CIRCLE = new Float64Array(10);
const SOLIDS = new Float64Array(8);
const CUTS = new Float64Array(4);
const P0 = new Float64Array(3);
const P1 = new Float64Array(3);

/**
 * The circle centred on (cx, cy, cz) through (tx, ty, tz), in the plane that contains the line
 * between them and is nearest the plane perpendicular to the Moon's axis (scene y), into `out`.
 */
export function circleInto(cx: number, cy: number, cz: number, tx: number, ty: number, tz: number, out: Float64Array): void {
  let ax = tx - cx;
  let ay = ty - cy;
  let az = tz - cz;
  const radius = Math.hypot(ax, ay, az);
  out[0] = cx;
  out[1] = cy;
  out[2] = cz;
  if (radius < 1e-9) {
    out[3] = 0;
    out[4] = 1;
    out[5] = 0;
    out[6] = 0;
    out[7] = 0;
    out[8] = 1;
    out[9] = 0;
    return;
  }
  out[3] = radius;
  ax /= radius;
  ay /= radius;
  az /= radius;
  // The Moon's axis, less its part along the line: the normal of the nearest such plane.
  let nx = -ay * ax;
  let ny = 1 - ay * ay;
  let nz = -ay * az;
  if (nx * nx + ny * ny + nz * nz < 1e-12) {
    nx = 1 - ax * ax;
    ny = -ax * ay;
    nz = -ax * az;
  }
  const n = Math.hypot(nx, ny, nz);
  out[4] = ax;
  out[5] = ay;
  out[6] = az;
  out[7] = nx / n;
  out[8] = ny / n;
  out[9] = nz / n;
}

/**
 * The circle centred on `centre` through `through`, in the plane that contains the line between
 * them and is nearest the plane perpendicular to the Moon's axis. `start` is the unit vector from
 * the centre to `through`; `normal` is the plane's normal.
 */
export function orbitCircle(centre: V3, through: V3): Circle {
  const c = new Float64Array(10);
  circleInto(centre[0], centre[1], centre[2], through[0], through[1], through[2], c);
  return { centre, radius: c[3]!, start: [c[4]!, c[5]!, c[6]!], normal: [c[7]!, c[8]!, c[9]!] };
}

/** Point `i` of the circle's ORBIT_SEGMENTS steps, into `out`. */
function pointInto(c: Float64Array, i: number, out: Float64Array): void {
  const t = (i / ORBIT_SEGMENTS) * Math.PI * 2;
  const ax = c[4]!;
  const ay = c[5]!;
  const az = c[6]!;
  const nx = c[7]!;
  const ny = c[8]!;
  const nz = c[9]!;
  // b = n × a, the circle's second axis.
  const bx = ny * az - nz * ay;
  const by = nz * ax - nx * az;
  const bz = nx * ay - ny * ax;
  const u = Math.cos(t) * c[3]!;
  const v = Math.sin(t) * c[3]!;
  out[0] = c[0]! + ax * u + bx * v;
  out[1] = c[1]! + ay * u + by * v;
  out[2] = c[2]! + az * u + bz * v;
}

/**
 * Writes the circle as line segments (pairs of points) into `out`, leaving out every part of a
 * step that lies inside one of the solids: a step that crosses a sphere is cut where it meets
 * the sphere, so the line ends on the body's limb whatever the step's length, and a step that
 * passes through a sphere with neither end inside is split in two. Returns the number of
 * points written (at most `out.length / 3`). Allocates nothing.
 */
export function segmentsInto(c: Float64Array, solids: Float64Array, solidCount: number, out: Float32Array | Float64Array): number {
  if (c[3]! <= 0) return 0;
  const capacity = Math.floor(out.length / 3);
  let n = 0;
  pointInto(c, 0, P1);
  for (let i = 1; i <= ORBIT_SEGMENTS; i += 1) {
    P0.set(P1);
    pointInto(c, i, P1);
    const dx = P1[0]! - P0[0]!;
    const dy = P1[1]! - P0[1]!;
    const dz = P1[2]! - P0[2]!;
    const dd = dx * dx + dy * dy + dz * dz;
    if (dd <= 0) continue;
    // The parts of this step inside each sphere, as intervals of t along it, within [0, 1]:
    // the roots of |P0 + t·d − centre|² = r².
    let cuts = 0;
    for (let s = 0; s < solidCount; s += 1) {
      const fx = P0[0]! - solids[s * 4]!;
      const fy = P0[1]! - solids[s * 4 + 1]!;
      const fz = P0[2]! - solids[s * 4 + 2]!;
      const r = solids[s * 4 + 3]!;
      const b = fx * dx + fy * dy + fz * dz;
      const disc = b * b - dd * (fx * fx + fy * fy + fz * fz - r * r);
      if (disc <= 0) continue;
      const root = Math.sqrt(disc);
      const t0 = Math.max(0, (-b - root) / dd);
      const t1 = Math.min(1, (-b + root) / dd);
      if (t1 <= t0) continue;
      CUTS[cuts * 2] = t0;
      CUTS[cuts * 2 + 1] = t1;
      cuts += 1;
    }
    if (cuts === 2 && CUTS[2]! < CUTS[0]!) {
      const a0 = CUTS[0]!;
      const a1 = CUTS[1]!;
      CUTS[0] = CUTS[2]!;
      CUTS[1] = CUTS[3]!;
      CUTS[2] = a0;
      CUTS[3] = a1;
    }
    // The kept pieces: [0, 1] less the cuts.
    let from = 0;
    for (let k = 0; k <= cuts; k += 1) {
      const to = k < cuts ? CUTS[k * 2]! : 1;
      if (to - from > 1e-9 && n + 2 <= capacity) {
        out[n * 3] = P0[0]! + dx * from;
        out[n * 3 + 1] = P0[1]! + dy * from;
        out[n * 3 + 2] = P0[2]! + dz * from;
        out[n * 3 + 3] = P0[0]! + dx * to;
        out[n * 3 + 4] = P0[1]! + dy * to;
        out[n * 3 + 5] = P0[2]! + dz * to;
        n += 2;
      }
      if (k < cuts) from = Math.max(from, CUTS[k * 2 + 1]!);
    }
  }
  return n;
}

/**
 * The circle as line segments (pairs of points), with the parts inside `solids` (at most two)
 * cut away at their surfaces, so the line ends on their limbs. At most ORBIT_CAPACITY
 * segments. For tests and callers outside the scene: `OrbitLines` writes the same points
 * straight into its buffers.
 */
export function orbitSegments(circle: Circle, solids: readonly Solid[]): V3[] {
  const c = new Float64Array([...circle.centre, circle.radius, ...circle.start, ...circle.normal]);
  const flat = new Float64Array(8);
  const used = solids.slice(0, 2);
  used.forEach((s, i) => flat.set([...s.centre, s.radius], i * 4));
  const out = new Float64Array(ORBIT_CAPACITY * 2 * 3);
  const count = segmentsInto(c, flat, used.length, out);
  return Array.from({ length: count }, (_, i): V3 => [out[i * 3]!, out[i * 3 + 1]!, out[i * 3 + 2]!]);
}

/** The two lines' colour: the Ridge Line grey (`--terrain-rim`) mixed into Night at low contrast. */
export function orbitColour(rim: THREE.Color, night: THREE.Color, contrast = 0.32): THREE.Color {
  return night.clone().lerp(rim, contrast);
}

/**
 * The two lines, drawn first and without writing depth, so every body (and the Moon's face)
 * covers them; their colour is pre-mixed into Night (opaque), so fading is a mix toward Night.
 * `update` rewrites the fixed buffers only when the bodies' drawn places change, and allocates
 * nothing when it does (it runs on every frame of the True-scale glide).
 */
export class OrbitLines {
  readonly group = new THREE.Group();
  readonly moonOrbit: THREE.LineSegments;
  readonly earthOrbit: THREE.LineSegments;
  private readonly materials: THREE.LineBasicMaterial[];
  private readonly full: THREE.Color;
  private readonly night: THREE.Color;
  /** The inputs of the last write: Earth's centre and radius, then the Sun's (NaN for none). */
  private readonly last = new Float64Array(8).fill(Number.NaN);
  /** How many times the buffers were rewritten (for tests: none at rest). */
  writes = 0;

  constructor(rim: THREE.Color, night: THREE.Color) {
    this.full = orbitColour(rim, night);
    this.night = night.clone();
    const make = () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ORBIT_CAPACITY * 2 * 3), 3));
      geometry.setDrawRange(0, 0);
      const material = new THREE.LineBasicMaterial({ color: this.full.clone(), depthWrite: false });
      const line = new THREE.LineSegments(geometry, material);
      line.frustumCulled = false;
      // Before everything else: the bodies, the guides and the sight-lines all draw over it.
      line.renderOrder = -10;
      return line;
    };
    this.moonOrbit = make();
    this.earthOrbit = make();
    this.moonOrbit.name = "moon-orbit";
    this.earthOrbit.name = "earth-orbit";
    this.materials = [this.moonOrbit.material as THREE.LineBasicMaterial, this.earthOrbit.material as THREE.LineBasicMaterial];
    this.group.add(this.moonOrbit, this.earthOrbit);
  }

  /**
   * Places the lines for the bodies as drawn now. `sunCentre` null: Earth's orbit is hidden
   * (true scale, where the Sun is only a direction).
   */
  update(earthCentre: V3, earthRadius: number, sunCentre: V3 | null, sunRadius: number): void {
    const last = this.last;
    const sx = sunCentre ? sunCentre[0] : Number.NaN;
    const sy = sunCentre ? sunCentre[1] : Number.NaN;
    const sz = sunCentre ? sunCentre[2] : Number.NaN;
    const sr = sunCentre ? sunRadius : Number.NaN;
    if (
      last[0] === earthCentre[0] &&
      last[1] === earthCentre[1] &&
      last[2] === earthCentre[2] &&
      last[3] === earthRadius &&
      Object.is(last[4], sx) &&
      Object.is(last[5], sy) &&
      Object.is(last[6], sz) &&
      Object.is(last[7], sr)
    )
      return;
    last[0] = earthCentre[0];
    last[1] = earthCentre[1];
    last[2] = earthCentre[2];
    last[3] = earthRadius;
    last[4] = sx;
    last[5] = sy;
    last[6] = sz;
    last[7] = sr;
    this.writes += 1;
    // The solids: the Moon (radius 1 at the origin) and Earth.
    SOLIDS[0] = 0;
    SOLIDS[1] = 0;
    SOLIDS[2] = 0;
    SOLIDS[3] = 1;
    SOLIDS[4] = earthCentre[0];
    SOLIDS[5] = earthCentre[1];
    SOLIDS[6] = earthCentre[2];
    SOLIDS[7] = earthRadius;
    circleInto(earthCentre[0], earthCentre[1], earthCentre[2], 0, 0, 0, CIRCLE);
    this.fill(this.moonOrbit, CIRCLE);
    if (sunCentre) {
      circleInto(sx, sy, sz, earthCentre[0], earthCentre[1], earthCentre[2], CIRCLE);
      this.fill(this.earthOrbit, CIRCLE);
    } else this.earthOrbit.geometry.setDrawRange(0, 0);
  }

  /** 0 hidden, 1 full: a mix toward Night, since the lines are opaque. */
  setOpacity(alpha: number): void {
    this.group.visible = alpha > 0.001;
    for (const m of this.materials) m.color.copy(this.night).lerp(this.full, alpha);
  }

  dispose(): void {
    this.moonOrbit.geometry.dispose();
    this.earthOrbit.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }

  private fill(line: THREE.LineSegments, circle: Float64Array): void {
    const attribute = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const count = segmentsInto(circle, SOLIDS, 2, attribute.array as Float32Array);
    attribute.needsUpdate = true;
    line.geometry.setDrawRange(0, count);
  }
}
