import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { describe, expect, it, vi } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import { decodeSystem } from "../../../data/decode/index.ts";
import { parseManifest } from "../../../data/parse.ts";
import { bodyDirections, type SystemHour } from "../../../lib/geo";
import { ORBIT_CAPACITY, ORBIT_SEGMENTS, circleInto, orbitCircle, orbitSegments, segmentsInto, type Solid } from "./orbits";
import { DRAWN_SUN_RADIUS, discInsideSpace, discLeaving, drawnEarth, drawnSun } from "./proportions";
import type { V3 } from "./vec";

/** Every hour of the real series (data/derived/system.bin). */
const derived = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../data/derived");
const hours: SystemHour[] = (() => {
  const manifest = parseManifest(JSON.parse(readFileSync(path.join(derived, "manifest.json"), "utf8")) as unknown);
  const count = manifest.time_grid.count;
  const b = readFileSync(path.join(derived, "system.bin"));
  const copy = new ArrayBuffer(b.byteLength);
  new Uint8Array(copy).set(b);
  const s = decodeSystem(copy, count, "system.bin");
  return Array.from({ length: count }, (_, i) => ({
    subsolarLatDeg: s.subsolar_lat[i] as number,
    subsolarLonDeg: s.subsolar_lon[i] as number,
    subearthLatDeg: s.subearth_lat[i] as number,
    subearthLonDeg: s.subearth_lon[i] as number,
    earthDistKm: s.earth_dist_km[i] as number,
    sunDistKm: s.sun_dist_km[i] as number,
  }));
})();

const dist = (a: readonly number[], b: readonly number[]) => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);
const MOON: Solid = { centre: [0, 0, 0], radius: 1 };
const bodiesAt = (h: SystemHour) => {
  const earth = drawnEarth(h, false);
  const sun = drawnSun(bodyDirections(h).sun, h.sunDistKm);
  return { earth: { centre: earth.centre, radius: earth.radius } as Solid, sun: { centre: sun.centre, radius: DRAWN_SUN_RADIUS } as Solid };
};

describe("the orbit lines' geometry, over the real series", () => {
  it("the Moon's orbit is centred on the drawn Earth and passes through the Moon's centre; Earth's is centred on the Sun and passes through Earth", () => {
    for (let i = 0; i < hours.length; i += 97) {
      const { earth, sun } = bodiesAt(hours[i]!);
      const moonOrbit = orbitCircle(earth.centre, [0, 0, 0]);
      expect(moonOrbit.centre).toEqual(earth.centre);
      expect(moonOrbit.radius).toBeCloseTo(dist(earth.centre, [0, 0, 0]), 12);
      const earthOrbit = orbitCircle(sun.centre, earth.centre);
      expect(earthOrbit.centre).toEqual(sun.centre);
      expect(earthOrbit.radius).toBeCloseTo(dist(sun.centre, earth.centre), 12);
      // Each circle's start is its body: centre + radius × start.
      for (const [c, through] of [
        [moonOrbit, [0, 0, 0]],
        [earthOrbit, earth.centre],
      ] as const) {
        const p = c.start.map((v, k) => c.centre[k]! + c.radius * v);
        expect(dist(p, through)).toBeLessThan(1e-9);
        // The plane contains the line between the two bodies.
        expect(Math.abs(c.normal[0] * c.start[0] + c.normal[1] * c.start[1] + c.normal[2] * c.start[2])).toBeLessThan(1e-9);
      }
    }
  });

  it("each plane turns smoothly as the hour moves: under 0.2° from one hour to the next, never flipping", () => {
    let worstMoon = 0;
    let worstEarth = 0;
    let previous: { moon: V3; earth: V3 } | null = null;
    for (const h of hours) {
      const { earth, sun } = bodiesAt(h);
      const now = { moon: orbitCircle(earth.centre, [0, 0, 0]).normal, earth: orbitCircle(sun.centre, earth.centre).normal };
      if (previous) {
        const angle = (a: V3, b: V3) => (Math.acos(Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])) * 180) / Math.PI;
        worstMoon = Math.max(worstMoon, angle(now.moon, previous.moon));
        worstEarth = Math.max(worstEarth, angle(now.earth, previous.earth));
      }
      previous = now;
    }
    expect(worstMoon).toBeLessThan(0.2);
    expect(worstEarth).toBeLessThan(0.2);
  });

  /**
   * Every hour, both arrangements, both lines, written as the scene writes them (`segmentsInto`,
   * in doubles here; the scene's buffer is Float32). `check` sees each segment's two ends.
   */
  function sweep(check: (line: "moon" | "earth", trueScale: boolean, h: number, n: number, out: Float64Array, earth: Solid) => void) {
    const circle = new Float64Array(10);
    const solids = new Float64Array(8);
    const out = new Float64Array(ORBIT_CAPACITY * 2 * 3);
    solids.set([0, 0, 0, 1], 0);
    for (let i = 0; i < hours.length; i += 1) {
      const h = hours[i]!;
      const sunAt = drawnSun(bodyDirections(h).sun, h.sunDistKm).centre;
      for (const trueScale of [false, true]) {
        const e = drawnEarth(h, trueScale);
        solids.set([...e.centre, e.radius], 4);
        circleInto(e.centre[0], e.centre[1], e.centre[2], 0, 0, 0, circle);
        check("moon", trueScale, i, segmentsInto(circle, solids, 2, out), out, e);
        if (trueScale) continue; // at true scale Earth's orbit is not drawn
        circleInto(sunAt[0], sunAt[1], sunAt[2], e.centre[0], e.centre[1], e.centre[2], circle);
        check("earth", trueScale, i, segmentsInto(circle, solids, 2, out), out, e);
      }
    }
  }
  /** The squared distance from `c` to the nearest point of segment `k` (points k and k + 1). */
  const segmentDistanceSq = (out: Float64Array, k: number, cx: number, cy: number, cz: number) => {
    const ax = out[k * 3]! - cx;
    const ay = out[k * 3 + 1]! - cy;
    const az = out[k * 3 + 2]! - cz;
    const dx = out[k * 3 + 3]! - out[k * 3]!;
    const dy = out[k * 3 + 4]! - out[k * 3 + 1]!;
    const dz = out[k * 3 + 5]! - out[k * 3 + 2]!;
    const t = Math.min(1, Math.max(0, -(ax * dx + ay * dy + az * dz) / (dx * dx + dy * dy + dz * dz)));
    const x = ax + dx * t;
    const y = ay + dy * t;
    const z = az + dz * t;
    return x * x + y * y + z * z;
  };
  /** Geometry tolerance: 1e-9 Moon radii, or 1e-9 of Earth's radius (the sweep is in doubles). */
  const TOL = 1e-9;

  it(
    "no segment of either line enters the Moon or Earth anywhere along it, and each line ends on the limb it stops at on both sides, whatever the step length (every hour, both arrangements)",
    () => {
      let deepestMoon = Infinity; // the nearest any segment comes to the Moon's centre, in Moon radii
      let deepestEarth = Infinity; // and to Earth's, in Earth radii
      let most = 0;
      const wrong: string[] = [];
      sweep((line, trueScale, h, n, out, earth) => {
        most = Math.max(most, n);
        const [ex, ey, ez] = earth.centre;
        const er2 = earth.radius * earth.radius;
        // The body this line passes through: the Moon for the Moon's orbit, Earth for Earth's.
        const [bx, by, bz, br] = line === "moon" ? [0, 0, 0, 1] : [ex, ey, ez, earth.radius];
        let ends = 0;
        for (let k = 0; k < n; k += 2) {
          deepestMoon = Math.min(deepestMoon, segmentDistanceSq(out, k, 0, 0, 0));
          deepestEarth = Math.min(deepestEarth, segmentDistanceSq(out, k, ex, ey, ez) / er2);
          for (let q = k; q <= k + 1; q += 1) {
            const x = out[q * 3]! - bx;
            const y = out[q * 3 + 1]! - by;
            const z = out[q * 3 + 2]! - bz;
            if (Math.abs(Math.sqrt(x * x + y * y + z * z) - br) < TOL * br) ends += 1;
          }
        }
        if (ends !== 2) wrong.push(`${line} orbit, ${trueScale ? "true scale" : "schematic"}, hour ${h}: ${ends} ends on the limb`);
      });
      expect(Math.sqrt(deepestMoon)).toBeGreaterThan(1 - TOL);
      expect(Math.sqrt(deepestEarth)).toBeGreaterThan(1 - TOL);
      expect(wrong.slice(0, 5)).toEqual([]);
      // The fixed buffer is never full (a full buffer would drop the end of a line).
      expect(most).toBeLessThan(ORBIT_CAPACITY * 2);
    },
    60_000,
  );

  it("at the series' extremes (Earth nearest and farthest), the Moon's orbit ends within 1e-9 Moon radii of the Moon's limb in both arrangements", () => {
    const byDistance = hours.map((h, i) => [h.earthDistKm, i] as const).sort((a, b) => a[0] - b[0]);
    for (const i of [byDistance[0]![1], byDistance[byDistance.length - 1]![1]]) {
      for (const trueScale of [false, true]) {
        const e = drawnEarth(hours[i]!, trueScale);
        const segments = orbitSegments(orbitCircle(e.centre, [0, 0, 0]), [MOON, { centre: e.centre, radius: e.radius }]);
        const nearest = Math.min(...segments.map((p) => dist(p, MOON.centre)));
        expect(Math.abs(nearest - 1)).toBeLessThan(TOL);
        // At true scale one step is several Moon radii long: the end is still on the limb.
        if (trueScale) expect((2 * Math.PI * dist(e.centre, [0, 0, 0])) / ORBIT_SEGMENTS).toBeGreaterThan(4);
      }
    }
  });
});

describe("the orbit lines in the scene", () => {
  async function makeWorld() {
    const { World } = await import("./world");
    let frames = 0;
    const world = new World(() => {
      frames += 1;
    }, 1);
    return { world, frames: () => frames };
  }
  const h = hours[19_000]!;
  const { sun, earth } = bodyDirections(h);
  const placed = drawnEarth(h, false);
  const inputs = (view: "system" | "map" | "slip" | "terrain" | "panorama", trueScale = false) => ({
    bodies: true,
    sunDir: sun,
    earthDir: earth,
    earthCentre: placed.centre,
    earthRadius: placed.radius,
    trueScale,
    earthDistKm: h.earthDistKm,
    sunDistKm: h.sunDistKm,
    hourIndex: 19_000,
    site: null,
    sight: null,
    view,
  });
  const camera = () => {
    const c = new THREE.PerspectiveCamera(30, 1.6, 1e-7, 5000);
    c.position.set(-4, -18, 0);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    return c;
  };

  it("are present in the System view and fade out in every other view", async () => {
    const { world } = await makeWorld();
    let now = 1_000;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => now);
    world.setInputs(inputs("system"));
    world.layout(camera());
    expect(world.orbits.group.visible).toBe(true);
    expect(world.orbits.moonOrbit.geometry.drawRange.count).toBeGreaterThan(100);
    expect(world.orbits.earthOrbit.geometry.drawRange.count).toBeGreaterThan(100);
    for (const view of ["map", "slip", "terrain", "panorama"] as const) {
      world.setInputs(inputs("system"));
      for (let k = 0; k < 6; k += 1) {
        now += 50;
        world.layout(camera());
      }
      expect(world.orbits.group.visible).toBe(true);
      world.setInputs(inputs(view));
      for (let k = 0; k < 6; k += 1) {
        now += 50;
        world.layout(camera());
      }
      expect(world.orbits.group.visible).toBe(false);
    }
    spy.mockRestore();
  });

  it("add nothing per frame at rest: no buffer rewrite and no frame requested once still", async () => {
    const { world, frames } = await makeWorld();
    let now = 1_000;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => now);
    world.setInputs(inputs("system"));
    world.layout(camera());
    const writes = world.orbits.writes;
    const asked = frames();
    for (let k = 0; k < 20; k += 1) {
      now += 50;
      world.layout(camera());
    }
    expect(world.orbits.writes).toBe(writes);
    expect(frames()).toBe(asked);
    spy.mockRestore();
  });

  it("at true scale keep the Moon's orbit (a large circle about Earth) and hide Earth's (the Sun is only a direction)", async () => {
    const { world } = await makeWorld();
    world.setInputs(inputs("system", true));
    world.scaleBlend = 1;
    const c = new THREE.PerspectiveCamera(30, 1.6, 1e-7, 5000);
    c.position.set(-200, -1_000, 0);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    world.layout(c);
    expect(world.orbits.moonOrbit.geometry.drawRange.count).toBeGreaterThan(100);
    expect(world.orbits.earthOrbit.geometry.drawRange.count).toBe(0);
  });
});

describe("Earth during the True-scale glide (Cursor's note on #111)", () => {
  const space: FreeSpace = { x: 288, y: 131, width: 793, height: 424, viewport: { width: 1440, height: 900 }, windowOpen: false };
  const cameraAt = (x: number, y: number, z: number) => {
    const c = new THREE.PerspectiveCamera(30, 1440 / 900, 1e-7, 5000);
    c.up.set(1, 0, 0); // not along the line of sight
    c.position.set(x, y, z);
    c.lookAt(0, 0, 0);
    c.updateMatrixWorld();
    return c;
  };

  it("knows when a disc is wholly inside the free space", () => {
    const c = cameraAt(0, -20, 0);
    expect(discInsideSpace(c, { centre: [0, 0, 0], radius: 1 }, space)).toBe(true);
    expect(discInsideSpace(c, { centre: [0, 0, 6], radius: 1 }, space)).toBe(false); // off the side of the free space
    expect(discInsideSpace(c, { centre: [0, 0, 0], radius: 1 }, null)).toBe(true);
  });

  it("looks ahead: a disc heading for the edge fast enough to cross it within the fade counts as leaving, so the fade ends first", () => {
    const inside = { x: 684, y: 480, r: 40 }; // bottom at 520, the free space's at 555
    expect(discLeaving(null, inside, 0, space, 180)).toBe(false);
    // 0.66 px/ms downward (as measured): 120 px in 180 ms, past the edge: leaving now.
    expect(discLeaving({ x: 684, y: 469, r: 40 }, inside, 16.7, space, 180)).toBe(true);
    // Slow (0.05 px/ms): not yet.
    expect(discLeaving({ x: 684, y: 479.2, r: 40 }, inside, 16.7, space, 180)).toBe(false);
    // Outside, or behind the camera: leaving.
    expect(discLeaving(inside, { x: 684, y: 540, r: 40 }, 16.7, space, 180)).toBe(true);
    expect(discLeaving(inside, null, 16.7, space, 180)).toBe(true);
  });

  it("fades Earth out while its disc is outside the free space mid-glide, and not otherwise", async () => {
    const { World } = await import("./world");
    const world = new World(() => undefined, 1);
    let now = 1_000;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => now);
    world.freeSpace = space;
    world.setInputs({
      bodies: true,
      sunDir: [0, 0, 1],
      earthDir: [0, 0, -1],
      earthCentre: [0, 0, -4.5],
      earthRadius: 1,
      trueScale: true,
      earthDistKm: 384_400,
      sunDistKm: 149_600_000,
      hourIndex: 0,
      site: null,
      sight: null,
      view: "system",
    });
    const alpha = () => (world as unknown as { earth: { uniforms: { uAlpha: { value: number } } } }).earth.uniforms.uAlpha.value;
    // Mid-glide, a camera from which Earth's disc falls outside the free space.
    world.scaleBlend = 0.5;
    const outside = cameraAt(0, -60, 0);
    world.layout(outside);
    for (let k = 0; k < 6; k += 1) {
      now += 50;
      world.layout(outside);
    }
    expect(alpha()).toBe(0);
    // The glide over (schematic, Earth back inside the free space): Earth fades back in.
    world.scaleBlend = 0;
    const inside = cameraAt(0, -40, 0);
    for (let k = 0; k < 6; k += 1) {
      now += 50;
      world.layout(inside);
    }
    expect(alpha()).toBe(1);
    spy.mockRestore();
  });
});
