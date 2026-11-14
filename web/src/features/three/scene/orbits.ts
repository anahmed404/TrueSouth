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
 * Moon or Earth are left out, so a line stops at a body's limb rather than crossing its face.
 */

/** Points per circle. */
export const ORBIT_SEGMENTS = 256;

const AXIS = new THREE.Vector3(0, 1, 0);

export type Circle = { centre: V3; radius: number; normal: V3; start: V3 };

/**
 * The circle centred on `centre` through `through`, in the plane that contains the line between
 * them and is nearest the plane perpendicular to the Moon's axis. `start` is the unit vector from
 * the centre to `through`; `normal` is the plane's normal.
 */
export function orbitCircle(centre: V3, through: V3): Circle {
  const c = new THREE.Vector3(...centre);
  const a = new THREE.Vector3(...through).sub(c);
  const radius = a.length();
  if (radius < 1e-9) return { centre, radius: 0, normal: [0, 1, 0], start: [1, 0, 0] };
  a.divideScalar(radius);
  // The Moon's axis, less its part along the line: the normal of the nearest such plane.
  const n = AXIS.clone().addScaledVector(a, -AXIS.dot(a));
  if (n.lengthSq() < 1e-12) n.set(1, 0, 0).addScaledVector(a, -a.x);
  n.normalize();
  return { centre, radius, normal: [n.x, n.y, n.z], start: [a.x, a.y, a.z] };
}

/** A sphere a line must not enter. */
export type Solid = { centre: V3; radius: number };

/**
 * The circle as line segments (pairs of points), leaving out every step with an end inside one
 * of `solids`, so the line stops at their limbs. At most ORBIT_SEGMENTS segments.
 */
export function orbitSegments(circle: Circle, solids: readonly Solid[]): V3[] {
  const out: V3[] = [];
  if (circle.radius <= 0) return out;
  const c = new THREE.Vector3(...circle.centre);
  const a = new THREE.Vector3(...circle.start);
  const n = new THREE.Vector3(...circle.normal);
  const b = n.clone().cross(a);
  const point = (i: number): V3 => {
    const t = (i / ORBIT_SEGMENTS) * Math.PI * 2;
    const p = c.clone().addScaledVector(a, Math.cos(t) * circle.radius).addScaledVector(b, Math.sin(t) * circle.radius);
    return [p.x, p.y, p.z];
  };
  const outside = (p: V3) =>
    solids.every((s) => Math.hypot(p[0] - s.centre[0], p[1] - s.centre[1], p[2] - s.centre[2]) >= s.radius * 1.002);
  let previous = point(0);
  let previousOut = outside(previous);
  for (let i = 1; i <= ORBIT_SEGMENTS; i += 1) {
    const p = point(i);
    const pOut = outside(p);
    if (previousOut && pOut) out.push(previous, p);
    previous = p;
    previousOut = pOut;
  }
  return out;
}

/** The two lines' colour: the Ridge Line grey (`--terrain-rim`) mixed into Night at low contrast. */
export function orbitColour(rim: THREE.Color, night: THREE.Color, contrast = 0.32): THREE.Color {
  return night.clone().lerp(rim, contrast);
}

/**
 * The two lines, drawn first and without writing depth, so every body (and the Moon's face)
 * covers them; their colour is pre-mixed into Night (opaque), so fading is a mix toward Night.
 * `update` rewrites a fixed buffer only when the bodies' drawn places change.
 */
export class OrbitLines {
  readonly group = new THREE.Group();
  readonly moonOrbit: THREE.LineSegments;
  readonly earthOrbit: THREE.LineSegments;
  private readonly materials: THREE.LineBasicMaterial[];
  private readonly full: THREE.Color;
  private readonly night: THREE.Color;
  private key = "";
  /** How many times the buffers were rewritten (for tests: none at rest). */
  writes = 0;

  constructor(rim: THREE.Color, night: THREE.Color) {
    this.full = orbitColour(rim, night);
    this.night = night.clone();
    const make = () => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(new Float32Array(ORBIT_SEGMENTS * 2 * 3), 3));
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
   * Places the lines for the bodies as drawn now. `sun` null: Earth's orbit is hidden (true
   * scale, where the Sun is only a direction).
   */
  update(earth: Solid, sun: Solid | null): void {
    const key = `${earth.centre.join(",")}|${earth.radius}|${sun ? `${sun.centre.join(",")}|${sun.radius}` : "-"}`;
    if (key === this.key) return;
    this.key = key;
    this.writes += 1;
    const moon: Solid = { centre: [0, 0, 0], radius: 1 };
    this.fill(this.moonOrbit, orbitSegments(orbitCircle(earth.centre, [0, 0, 0]), [moon, earth]));
    this.fill(this.earthOrbit, sun ? orbitSegments(orbitCircle(sun.centre, earth.centre), [moon, earth]) : []);
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

  private fill(line: THREE.LineSegments, points: V3[]): void {
    const attribute = line.geometry.getAttribute("position") as THREE.BufferAttribute;
    const array = attribute.array as Float32Array;
    const count = Math.min(points.length, ORBIT_SEGMENTS * 2);
    for (let i = 0; i < count; i += 1) array.set(points[i]!, i * 3);
    attribute.needsUpdate = true;
    line.geometry.setDrawRange(0, count);
  }
}
