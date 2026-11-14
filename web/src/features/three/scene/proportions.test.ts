import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import { decodeSystem } from "../../../data/decode/index.ts";
import { fromDirectionPose, type Pose } from "./camera";
import { parseManifest } from "../../../data/parse.ts";
import { EARTH_RADIUS_KM, MOON_RADIUS_KM, SUN_RADIUS_KM, bodyDirections, type BodyPlacement, type SystemHour } from "../../../lib/geo";
import {
  DISTANCE_EXPONENT,
  DISTANCE_SCALE,
  DRAWN_EARTH_RADIUS,
  DRAWN_SUN_RADIUS,
  EARTH_FARTHEST_KM,
  SYSTEM_MAX_ALTITUDE,
  drawnDistance,
  drawnEarth,
  drawnRadius,
  drawnSun,
  bodyInFront,
  earthDuringScale,
  sunDuringScale,
} from "./proportions";

/**
 * The real series: every hour of data/derived/system.bin (52,584 hours, 2026 to 2032), read
 * the way app/mission/timeline/why-dark.test.ts reads data/derived.
 */
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

type V = readonly [number, number, number];
const length = (v: V) => Math.hypot(v[0], v[1], v[2]);
const between = (a: V, b: V) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const unit = (v: V): V => [v[0] / length(v), v[1] / length(v), v[2] / length(v)];
const sunOf = (h: SystemHour) => drawnSun(bodyDirections(h).sun, h.sunDistKm);
const MOON: BodyPlacement = { centre: [0, 0, 0], radius: 1 };
const angleDeg = (a: V, b: V) => (Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2]))) * 180) / Math.PI;

/** The extremes of the real series: Earth nearest and furthest (perigee, apogee), the Sun nearest and furthest. */
const extremes = (() => {
  const by = (key: "earthDistKm" | "sunDistKm", sign: 1 | -1) =>
    hours.reduce((best, h) => (sign * h[key] > sign * best[key] ? h : best), hours[0]!);
  return { perigee: by("earthDistKm", -1), apogee: by("earthDistKm", 1), sunNear: by("sunDistKm", -1), sunFar: by("sunDistKm", 1) };
})();

describe("the mapping: drawn sizes through named radii, drawn distances a power below 1", () => {
  it("names its constants: Earth 1.005 and the Sun 3.5 Moon radii, distance exponent 0.385, distance scale 0.372", () => {
    expect(DRAWN_EARTH_RADIUS).toBe(1.005);
    expect(DRAWN_SUN_RADIUS).toBe(3.5);
    expect(DISTANCE_EXPONENT).toBe(0.385);
    expect(DISTANCE_SCALE).toBe(0.372);
    expect(EARTH_FARTHEST_KM).toBe(407_000);
  });

  it("draws the Moon 1, Earth 1.005 and the Sun 3.5, on a straight log-log line between them, to 1e-12", () => {
    expect(drawnRadius(MOON_RADIUS_KM)).toBeCloseTo(1, 12);
    expect(drawnRadius(EARTH_RADIUS_KM)).toBeCloseTo(1.005, 12);
    expect(drawnRadius(SUN_RADIUS_KM)).toBeCloseTo(3.5, 12);
    // Half way (geometrically) between two bodies, the drawn radius is half way (geometrically) too.
    expect(drawnRadius(Math.sqrt(MOON_RADIUS_KM * EARTH_RADIUS_KM))).toBeCloseTo(Math.sqrt(1.005), 12);
    expect(drawnRadius(Math.sqrt(EARTH_RADIUS_KM * SUN_RADIUS_KM))).toBeCloseTo(Math.sqrt(1.005 * 3.5), 12);
  });

  it("draws every distance as 0.372 times its ratio to the Moon's radius to the power 0.385, to 1e-12 relative", () => {
    for (let km = 1; km < 1e10; km *= 1.37) {
      const expected = 0.372 * Math.pow(km / MOON_RADIUS_KM, 0.385);
      expect(Math.abs(drawnDistance(km) - expected) / expected).toBeLessThan(1e-12);
    }
  });

  it("is monotonic: a larger body is drawn larger, a further body further", () => {
    let previousRadius = 0;
    let previousDistance = 0;
    for (let km = 100; km < 1e9; km *= 1.07) {
      expect(drawnRadius(km)).toBeGreaterThan(previousRadius);
      expect(drawnDistance(km)).toBeGreaterThan(previousDistance);
      previousRadius = drawnRadius(km);
      previousDistance = drawnDistance(km);
    }
  });

  it("maps zero to zero, and a negative or non-finite input to zero rather than NaN or Infinity", () => {
    expect(drawnRadius(0)).toBe(0);
    expect(drawnDistance(0)).toBe(0);
    for (const bad of [-1, -384_400, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY]) {
      expect(drawnRadius(bad)).toBe(0);
      expect(drawnDistance(bad)).toBe(0);
      const sun = drawnSun([1, 0, 0], bad);
      expect(sun.centre.every(Number.isFinite)).toBe(true);
      const earth = drawnEarth({ ...extremes.perigee, earthDistKm: bad }, false);
      expect(earth.centre.every(Number.isFinite)).toBe(true);
    }
  });
});

describe("on the real series (data/derived/system.bin)", () => {
  it("reads every hour, with Earth's perigee and apogee and the Sun's range", () => {
    expect(hours.length).toBe(52_584);
    expect(extremes.perigee.earthDistKm).toBeLessThan(360_000);
    expect(extremes.apogee.earthDistKm).toBeGreaterThan(404_000);
    expect(extremes.sunNear.sunDistKm).toBeLessThan(147_200_000);
    expect(extremes.sunFar.sunDistKm).toBeGreaterThan(152_000_000);
  });

  it("at the extremes: Earth 2.88 to 3.04 Moon radii out (2.5 before), the Sun 29.3 to 29.8", () => {
    expect(drawnDistance(extremes.perigee.earthDistKm)).toBeGreaterThan(2.88);
    expect(drawnDistance(extremes.apogee.earthDistKm)).toBeLessThan(3.04);
    expect(drawnDistance(extremes.sunNear.sunDistKm)).toBeGreaterThan(29.3);
    expect(drawnDistance(extremes.sunFar.sunDistKm)).toBeLessThan(29.8);
  });

  it("keeps the orbit picture true at every hour: the circle the Moon traces around the drawn Earth never comes near the Sun", () => {
    // The Sun's nearest surface is more than twice the drawn Earth-to-Moon distance from
    // Earth, with a margin of three times that (3.76 at the closest hour).
    for (const h of hours) {
      const earth = drawnEarth(h, false);
      const sun = sunOf(h);
      expect(between(earth.centre, sun.centre) - sun.radius).toBeGreaterThan(3 * 2 * length(earth.centre));
    }
  });

  it("stays inside what the opening view allows for: Earth never beyond EARTH_FARTHEST_KM, libration within ±7° by ±8.5°", () => {
    for (const h of hours) {
      expect(h.earthDistKm).toBeLessThanOrEqual(EARTH_FARTHEST_KM);
      expect(Math.abs(h.subearthLatDeg)).toBeLessThan(7);
      expect(Math.abs(((h.subearthLonDeg + 540) % 360) - 180)).toBeLessThan(8.5);
    }
  });

  it("keeps the order Moon < Earth < Sun in size, and Earth < Sun in distance, at every hour", () => {
    for (const h of hours) {
      expect(1).toBeLessThan(drawnEarth(h, false).radius);
      expect(drawnEarth(h, false).radius).toBeLessThan(sunOf(h).radius);
      expect(length(drawnEarth(h, false).centre)).toBeLessThan(length(sunOf(h).centre));
    }
  });

  it("draws the Sun 9.6 to 10.3 times further than Earth at every hour, never under 8 (389 true; 389^0.385 = 9.9)", () => {
    let low = Infinity;
    let high = 0;
    for (const h of hours) {
      const ratio = drawnDistance(h.sunDistKm) / drawnDistance(h.earthDistKm);
      low = Math.min(low, ratio);
      high = Math.max(high, ratio);
    }
    expect(low).toBeGreaterThan(9.6);
    expect(low).toBeGreaterThan(8);
    expect(high).toBeLessThan(10.35);
  });

  it("keeps clear gaps between the surfaces at every hour: Moon to Earth over 0.85, Moon to Sun over 24, Earth to Sun over 21", () => {
    let moonEarth = Infinity;
    let moonSun = Infinity;
    let earthSun = Infinity;
    for (const h of hours) {
      const earth = drawnEarth(h, false);
      const sun = sunOf(h);
      moonEarth = Math.min(moonEarth, between(MOON.centre, earth.centre) - 1 - earth.radius);
      moonSun = Math.min(moonSun, between(MOON.centre, sun.centre) - 1 - sun.radius);
      earthSun = Math.min(earthSun, between(earth.centre, sun.centre) - earth.radius - sun.radius);
    }
    expect(moonEarth).toBeGreaterThan(0.85);
    expect(moonSun).toBeGreaterThan(24);
    expect(earthSun).toBeGreaterThan(21);
  });

  it("keeps every direction exactly as the series gives it", () => {
    for (const h of hours) {
      const { sun, earth } = bodyDirections(h);
      const e = unit(drawnEarth(h, false).centre);
      const s = unit(sunOf(h).centre);
      for (let i = 0; i < 3; i += 1) {
        expect(e[i]).toBeCloseTo(earth[i]!, 12);
        expect(s[i]).toBeCloseTo(sun[i]!, 12);
      }
    }
  });

  it("a direction mark from any site on the Moon points into the drawn Earth and Sun", () => {
    const hits = (from: V, dir: V, body: BodyPlacement) => {
      const c: V = [body.centre[0] - from[0], body.centre[1] - from[1], body.centre[2] - from[2]];
      const along = c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2];
      const off = Math.sqrt(Math.max(0, c[0] ** 2 + c[1] ** 2 + c[2] ** 2 - along * along));
      return along > 0 && off < body.radius;
    };
    for (const h of Object.values(extremes)) {
      const { sun, earth } = bodyDirections(h);
      for (let lat = -90; lat <= 90; lat += 15) {
        for (let lon = 0; lon < 360; lon += 30) {
          const la = (lat * Math.PI) / 180;
          const lo = (lon * Math.PI) / 180;
          const site: V = [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
          if (site[0] * earth[0] + site[1] * earth[1] + site[2] * earth[2] > 0) expect(hits(site, earth, drawnEarth(h, false))).toBe(true);
          if (site[0] * sun[0] + site[1] * sun[1] + site[2] * sun[2] > 0) expect(hits(site, sun, sunOf(h))).toBe(true);
        }
      }
    }
  });

  it("True scale draws Earth at its real distance and real size", () => {
    for (const h of Object.values(extremes)) {
      const real = drawnEarth(h, true);
      expect(real.radius).toBeCloseTo(EARTH_RADIUS_KM / MOON_RADIUS_KM, 12);
      expect(length(real.centre)).toBeCloseTo(h.earthDistKm / MOON_RADIUS_KM, 9);
    }
  });
});

describe("Earth's light is the series' Sun direction, not the drawn offset", () => {
  /** The hour where the drawn Earth-to-Sun direction strays furthest from the true Sun direction. */
  const worst = hours.reduce(
    (best, h) => {
      const e = drawnEarth(h, false).centre;
      const s = sunOf(h).centre;
      const drawnDir = unit([s[0] - e[0], s[1] - e[1], s[2] - e[2]]);
      const off = angleDeg(drawnDir, bodyDirections(h).sun);
      return off > best.off ? { h, off, drawnDir } : best;
    },
    { h: hours[0]!, off: 0, drawnDir: [1, 0, 0] as V },
  );

  it("the drawn offset is real (several degrees at the worst hour), so the test can tell the two apart", () => {
    expect(worst.off).toBeGreaterThan(5);
    expect(worst.off).toBeLessThan(6.5);
  });

  it("the scene hands Earth's shader the series' direction at that hour", async () => {
    const THREE = await import("three");
    const { World } = await import("./world");
    const world = new World(() => undefined, 1);
    const h = worst.h;
    const { sun, earth } = bodyDirections(h);
    const placed = drawnEarth(h, false);
    world.setInputs({
      bodies: true,
      sunDir: sun,
      earthDir: earth,
      earthCentre: placed.centre,
      earthRadius: placed.radius,
      trueScale: false,
      earthDistKm: h.earthDistKm,
      sunDistKm: h.sunDistKm,
      hourIndex: 0,
      site: null,
      sight: null,
      view: "system",
    });
    const camera = new THREE.PerspectiveCamera(30, 1.6, 1e-7, 5000);
    camera.position.set(0, -14, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    world.layout(camera);
    const light = (world as unknown as { earth: { uniforms: { uSun: { value: { x: number; y: number; z: number } } } } }).earth.uniforms.uSun.value;
    const l: V = unit([light.x, light.y, light.z]);
    expect(angleDeg(l, sun)).toBeLessThan(1e-6);
    expect(angleDeg(l, worst.drawnDir)).toBeGreaterThan(5);
  });
});

describe("Earth and the Sun while True scale turns on or off", () => {
  const h = extremes.perigee;
  const { sun, earth } = bodyDirections(h);

  it("starts at the schematic and ends at true scale, along the true direction throughout", () => {
    const start = earthDuringScale(earth, h.earthDistKm, 0);
    const end = earthDuringScale(earth, h.earthDistKm, 1);
    expect(start.centre.map((v, i) => v - drawnEarth(h, false).centre[i]!).every((d) => Math.abs(d) < 1e-12)).toBe(true);
    expect(start.radius).toBeCloseTo(DRAWN_EARTH_RADIUS, 12);
    expect(length(end.centre)).toBeCloseTo(length(drawnEarth(h, true).centre), 9);
    expect(end.radius).toBeCloseTo(drawnEarth(h, true).radius, 12);
    for (let t = 0; t <= 1; t += 0.1) {
      const u = unit(earthDuringScale(earth, h.earthDistKm, t).centre);
      for (let i = 0; i < 3; i += 1) expect(u[i]).toBeCloseTo(earth[i]!, 12);
    }
  });

  it("moves Earth smoothly: no step of a 100-step flight moves it more than 5 % of its distance", () => {
    let previous = earthDuringScale(earth, h.earthDistKm, 0);
    for (let k = 1; k <= 100; k += 1) {
      const now = earthDuringScale(earth, h.earthDistKm, k / 100);
      expect(between(now.centre, previous.centre)).toBeLessThan(0.05 * length(previous.centre));
      expect(Math.abs(now.radius - previous.radius)).toBeLessThan(0.05 * previous.radius);
      previous = now;
    }
  });

  it("carries the Sun out and hides it only at the end; bad blends give no NaN", () => {
    expect(sunDuringScale(sun, h.sunDistKm, 0).visible).toBe(true);
    expect(length(sunDuringScale(sun, h.sunDistKm, 0).centre)).toBeCloseTo(drawnDistance(h.sunDistKm), 12);
    expect(sunDuringScale(sun, h.sunDistKm, 0.99).visible).toBe(true);
    expect(sunDuringScale(sun, h.sunDistKm, 1).visible).toBe(false);
    for (const bad of [Number.NaN, -1, 2, Number.POSITIVE_INFINITY]) {
      expect(earthDuringScale(earth, h.earthDistKm, bad).centre.every(Number.isFinite)).toBe(true);
      expect(sunDuringScale(sun, h.sunDistKm, bad).centre.every(Number.isFinite)).toBe(true);
    }
  });
});

describe("the zoom-out limit", () => {
  it("reaches far enough to see the Sun's disc and glow beside the Moon in a small free space", () => {
    const sunReach = drawnDistance(152_100_000) + DRAWN_SUN_RADIUS * 1.8;
    // ... and no more than needed: a fifth less would not reach.
    expect((1 + SYSTEM_MAX_ALTITUDE * 0.8) * Math.tan((15 * Math.PI) / 180) * (1 / 3)).toBeLessThan(sunReach);
    const halfHeight = (1 + SYSTEM_MAX_ALTITUDE) * Math.tan((15 * Math.PI) / 180) * (1 / 3);
    expect(halfHeight).toBeGreaterThan(sunReach);
  });
});

describe("a body between the camera and the Moon is not drawn (judged on screen)", () => {
  const earth: BodyPlacement = { centre: [3, 0, 0], radius: DRAWN_EARTH_RADIUS };
  /** Angular separation, as seen from `camera`, between a body's centre and the Moon's. */
  const apart = (camera: V, body: BodyPlacement) => {
    const toBody: V = [body.centre[0] - camera[0], body.centre[1] - camera[1], body.centre[2] - camera[2]];
    const toMoon: V = [-camera[0], -camera[1], -camera[2]];
    return Math.acos(Math.max(-1, Math.min(1, (toBody[0] * toMoon[0] + toBody[1] * toMoon[1] + toBody[2] * toMoon[2]) / (length(toBody) * length(toMoon)))));
  };
  /** True when a body is nearer than the Moon and its disc overlaps the Moon's disc on screen. */
  const covers = (camera: V, body: BodyPlacement) =>
    between(camera, body.centre) < length(camera) &&
    apart(camera, body) < Math.asin(Math.min(1, body.radius / between(camera, body.centre))) + Math.asin(1 / length(camera));

  it("is drawn beside the Moon in the opening view (which leans 12° away from Earth), whatever the libration, and behind it", () => {
    const t = (12 * Math.PI) / 180;
    for (const lat of [-7, 0, 7]) {
      const r = (lat * Math.PI) / 180;
      const e: BodyPlacement = { centre: [3 * Math.cos(r), 3 * Math.sin(r), 0], radius: DRAWN_EARTH_RADIUS };
      for (const d of [16, 23, 30]) expect(bodyInFront([-d * Math.sin(t), -d * Math.cos(t), 0], e, true)).toBe(false);
    }
    expect(bodyInFront([-10, 0, 0], earth, true)).toBe(false);
  });

  it("is not drawn in front of the Moon (From Earth), with the camera inside it, or nearer, larger and in view (From the Sun, beside)", () => {
    expect(bodyInFront([10.3, 0, 0], earth, true)).toBe(true);
    expect(bodyInFront([3.1, 0.2, 0], earth, false)).toBe(true);
    expect(bodyInFront([10.3 * Math.cos(0.9), 10.3 * Math.sin(0.9), 0], earth, true)).toBe(true);
    // The same, out of view: drawn (it cannot be seen anyway).
    expect(bodyInFront([10.3 * Math.cos(0.9), 10.3 * Math.sin(0.9), 0], earth, false)).toBe(false);
  });

  it("stays hidden along Earth's line of sight at any distance out to the zoom-out limit (the review's case past 80 Moon radii)", () => {
    for (const d of [10, 50, 81, 101, 151, 251, 381, SYSTEM_MAX_ALTITUDE + 1]) {
      expect(bodyInFront([d, 0, 0], earth, true)).toBe(true);
      expect(bodyInFront([d, 0.3, 0.2], earth, true)).toBe(true);
    }
  });

  it("keeps the Sun drawn when zoomed out far enough to see it, and Earth at true scale, when they are not over the Moon", () => {
    const t = (12 * Math.PI) / 180;
    for (const d of [150, 250, SYSTEM_MAX_ALTITUDE]) {
      for (let deg = 0; deg < 360; deg += 15) {
        const sun = drawnSun([Math.cos((deg * Math.PI) / 180), 0.03, Math.sin((deg * Math.PI) / 180)], 147_000_000);
        const camera: V = [-d * Math.sin(t), -d * Math.cos(t), 0];
        expect(bodyInFront(camera, sun, true)).toBe(covers(camera, sun));
        expect(covers(camera, sun)).toBe(false);
      }
    }
    const lat = (-7 * Math.PI) / 180;
    expect(bodyInFront([0, -1_096, 0], { centre: [229 * Math.cos(lat), 229 * Math.sin(lat), 0], radius: 3.67 }, true)).toBe(false);
  });

  it("does not flicker: once hidden, a body stays hidden until it is clearly out", () => {
    // Find the distance along a line where Earth just stops covering the Moon, then step around it.
    const camera = (a: number): V => [20 * Math.cos(a), 20 * Math.sin(a), 0];
    let edge = 0;
    for (let a = 0; a < 1.5; a += 0.0005) {
      if (!bodyInFront(camera(a), earth, false)) {
        edge = a;
        break;
      }
    }
    expect(edge).toBeGreaterThan(0);
    expect(bodyInFront(camera(edge + 0.002), earth, false, true)).toBe(true); // just past the edge, still hidden
    expect(bodyInFront(camera(edge + 0.2), earth, false, true)).toBe(false); // clearly out
  });

  it("holds for the Sun too, by the same geometry", () => {
    const sun = drawnSun([1, 0, 0], 149_600_000);
    expect(bodyInFront([10.3, 0, 0], sun, true)).toBe(false); // the Sun behind the camera
    expect(bodyInFront([40, 0, 0], sun, true)).toBe(true); // a camera beyond the Sun, looking back through it
  });

  it("over the real series, a few thousand cameras across the whole zoom range, both scale modes: no drawn body nearer than the Moon overlaps its disc", () => {
    let seed = 12_345;
    const random = () => {
      seed = (seed * 1_103_515_245 + 12_345) % 2_147_483_648;
      return seed / 2_147_483_648;
    };
    let checked = 0;
    for (let k = 0; k < 4_000; k += 1) {
      const h = hours[Math.floor(random() * hours.length)]!;
      const { sun, earth: earthDir } = bodyDirections(h);
      const trueScale = k % 4 === 3;
      const limit = trueScale ? 900 : SYSTEM_MAX_ALTITUDE;
      const distance = 1.05 + Math.pow(random(), 2) * limit;
      // Half the cameras look along or near Earth's or the Sun's line of sight; the rest anywhere.
      let dir: V;
      if (k % 2 === 0) {
        const base = k % 4 === 0 ? earthDir : sun;
        const wobble = 0.15 * random();
        dir = unit([base[0] + wobble * (random() - 0.5), base[1] + wobble * (random() - 0.5), base[2] + wobble * (random() - 0.5)]);
      } else {
        const z = 2 * random() - 1;
        const phi = 2 * Math.PI * random();
        dir = [Math.sqrt(1 - z * z) * Math.cos(phi), z, Math.sqrt(1 - z * z) * Math.sin(phi)];
      }
      const camera: V = [dir[0] * distance, dir[1] * distance, dir[2] * distance];
      const bodies = [drawnEarth(h, trueScale), ...(trueScale ? [] : [sunOf(h)])];
      for (const body of bodies) {
        if (bodyInFront(camera, body, true)) continue;
        expect(covers(camera, body)).toBe(false);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(3_000);
  });
});

describe("From Earth and From the Sun keep the Moon as the subject at every hour (real series)", () => {
  const layouts: FreeSpace[] = [
    { x: 288, y: 131, width: 793, height: 424, viewport: { width: 1440, height: 900 }, windowOpen: false },
    { x: 80, y: 131, width: 1280, height: 424, viewport: { width: 1440, height: 900 }, windowOpen: false },
    { x: 288, y: 131, width: 376, height: 244, viewport: { width: 1024, height: 768 }, windowOpen: false },
    { x: 80, y: 131, width: 864, height: 244, viewport: { width: 1024, height: 768 }, windowOpen: false },
  ];
  /** A sphere's screen disc from a pose (principal point at the free space's centre), or null when behind the camera. */
  function screenDisc(pose: Pose, centre: V, radius: number, fs: FreeSpace) {
    const f = unit(pose.look);
    const u0 = pose.up;
    const k = u0[0] * f[0] + u0[1] * f[1] + u0[2] * f[2];
    const up = unit([u0[0] - k * f[0], u0[1] - k * f[1], u0[2] - k * f[2]]);
    const right: V = [f[1] * up[2] - f[2] * up[1], f[2] * up[0] - f[0] * up[2], f[0] * up[1] - f[1] * up[0]];
    const rel: V = [centre[0] - pose.pos[0], centre[1] - pose.pos[1], centre[2] - pose.pos[2]];
    const depth = rel[0] * f[0] + rel[1] * f[1] + rel[2] * f[2];
    if (depth <= radius) return null;
    const focal = fs.viewport.height / 2 / Math.tan((pose.fov * Math.PI) / 360);
    const cx = fs.x + fs.width / 2;
    const cy = fs.y + fs.height / 2;
    const dist = length(rel);
    return {
      x: cx + ((rel[0] * right[0] + rel[1] * right[1] + rel[2] * right[2]) / depth) * focal,
      y: cy - ((rel[0] * up[0] + rel[1] * up[1] + rel[2] * up[2]) / depth) * focal,
      r: (Math.tan(Math.asin(Math.min(1, radius / dist))) * focal * dist) / depth,
    };
  }
  const reachesInto = (d: { x: number; y: number; r: number }, fs: FreeSpace) => {
    const nx = Math.max(fs.x, Math.min(d.x, fs.x + fs.width));
    const ny = Math.max(fs.y, Math.min(d.y, fs.y + fs.height));
    return Math.hypot(d.x - nx, d.y - ny) < d.r;
  };

  it("at the hour the review found (2030-12-10 00:00Z), Earth in front of the Moon is not drawn", () => {
    const h = hours[43_296]!;
    const { sun } = bodyDirections(h);
    for (const fs of layouts) {
      const pose = fromDirectionPose(sun, fs);
      expect(bodyInFront(pose.pos, drawnEarth(h, false), true)).toBe(true);
    }
  });

  it("no drawn body covers the Moon, and any opaque disc reaching into the free space is at most 1.5 times the Moon (every third hour, four layouts)", () => {
    let hidden = 0;
    let beside = 0;
    for (let i = 0; i < hours.length; i += 3) {
      const h = hours[i]!;
      const { sun, earth } = bodyDirections(h);
      const bodies = [drawnEarth(h, false), sunOf(h)];
      for (const fs of layouts) {
        for (const dir of [sun, earth]) {
          const pose = fromDirectionPose(dir, fs);
          const moon = screenDisc(pose, [0, 0, 0], 1, fs)!;
          for (const [k, body] of bodies.entries()) {
            const reach = screenDisc(pose, body.centre, body.radius, fs);
            // In view: any part of its disc inside the window.
            const seen = Boolean(reach) && Math.abs(reach!.x - fs.viewport.width / 2) < fs.viewport.width / 2 + reach!.r && Math.abs(reach!.y - fs.viewport.height / 2) < fs.viewport.height / 2 + reach!.r;
            if (bodyInFront(pose.pos, body, seen)) {
              if (k === 0) hidden += 1;
              continue;
            }
            // The opaque disc (the Sun's faint glow, out to 1.8 radii, can reach the edge of a wide free space from far off screen).
            const d = screenDisc(pose, body.centre, body.radius, fs);
            if (!d) continue;
            // Nothing nearer than the Moon covers it (a body behind it, as in an eclipse, is covered by it instead).
            const nearer = between(body.centre, pose.pos) < length(pose.pos);
            if (nearer) expect(Math.hypot(d.x - moon.x, d.y - moon.y)).toBeGreaterThan(d.r + moon.r);
            if (reachesInto(d, fs)) {
              if (k === 0) beside += 1;
              // Nearer to the camera than the Moon: at most the opening's 1.5 times on screen.
              if (nearer) expect(d.r / moon.r).toBeLessThanOrEqual(1.5);
              // Behind the Moon (the Sun near new moon in From Earth): at most 1.5 times the Moon's
              // angular size, as in the opening (measured as angles, so the lens's stretch at the
              // edge of a wide view does not count).
              else expect(Math.asin(body.radius / between(body.centre, pose.pos)) / Math.asin(1 / length(pose.pos))).toBeLessThanOrEqual(1.5);
            }
          }
        }
      }
    }
    // Both cases occur: Earth hidden in front of the Moon, and Earth shown beside it.
    expect(hidden).toBeGreaterThan(1_000);
    expect(beside).toBeGreaterThan(0);
  });
});

describe("a body moving in front of the Moon fades out, then lets the scene rest", () => {
  async function layoutAt(reduceMotion: boolean) {
    const THREE = await import("three");
    const { World } = await import("./world");
    let frames = 0;
    const world = new World(() => {
      frames += 1;
    }, 1);
    world.reduceMotion = reduceMotion;
    world.setInputs({
      bodies: true,
      sunDir: [0, 0, 1],
      earthDir: [1, 0, 0],
      earthCentre: [3, 0, 0],
      earthRadius: DRAWN_EARTH_RADIUS,
      trueScale: false,
      earthDistKm: 384_400,
      sunDistKm: 149_600_000,
      hourIndex: 0,
      site: null,
      sight: null,
      view: "system",
    });
    // "From Earth": the camera beyond Earth, looking back at the Moon through it.
    const camera = new THREE.PerspectiveCamera(30, 1.6, 1e-7, 5000);
    camera.position.set(10.3, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const earthMesh = (world as unknown as { earthMesh: { visible: boolean } }).earthMesh;
    const alpha = () => (world as unknown as { earth: { uniforms: { uAlpha: { value: number } } } }).earth.uniforms.uAlpha.value;
    let now = 1_000;
    const spy = vi.spyOn(performance, "now").mockImplementation(() => now);
    // A first frame with Earth behind the Moon, drawn; then the camera moves to "From Earth".
    camera.position.set(-10.3, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    world.layout(camera);
    now += 50;
    camera.position.set(10.3, 0, 0);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();
    const trace: { alpha: number; frames: number; visible: boolean }[] = [];
    for (let k = 0; k < 8; k += 1) {
      world.layout(camera);
      trace.push({ alpha: alpha(), frames, visible: earthMesh.visible });
      now += 50;
    }
    spy.mockRestore();
    return trace;
  }

  it("fades over about 180 ms, asking for frames only while it fades", async () => {
    const trace = await layoutAt(false);
    expect(trace[0]!.alpha).toBeLessThan(1);
    expect(trace[0]!.alpha).toBeGreaterThan(0);
    const done = trace.findIndex((t) => t.alpha === 0);
    expect(done).toBeGreaterThanOrEqual(3); // 150 ms in, still fading
    expect(done).toBeLessThanOrEqual(5);
    expect(trace[done]!.visible).toBe(false);
    // Once faded, no more frames are requested: the scene goes idle.
    expect(trace[trace.length - 1]!.frames).toBe(trace[done]!.frames);
  });

  it("disappears at once with reduced motion", async () => {
    const trace = await layoutAt(true);
    expect(trace[0]!.alpha).toBe(0);
    expect(trace[0]!.visible).toBe(false);
  });
});
