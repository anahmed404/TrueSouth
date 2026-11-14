import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeSystem } from "../../../data/decode/index.ts";
import { parseManifest } from "../../../data/parse.ts";
import { EARTH_RADIUS_KM, MOON_RADIUS_KM, SUN_RADIUS_KM, bodyDirections, type BodyPlacement, type SystemHour } from "../../../lib/geo";
import {
  DISTANCE_EXPONENT,
  DISTANCE_SCALE,
  DRAWN_EARTH_RADIUS,
  DRAWN_SUN_RADIUS,
  SIZE_EXPONENT,
  SYSTEM_MAX_ALTITUDE,
  drawnDistance,
  drawnEarth,
  drawnRadius,
  drawnSun,
  earthOpacity,
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

describe("the rule: drawn size and distance are the cube root of the true value relative to the Moon", () => {
  it("names its constants: size exponent 1/3, distance exponent 1/3, distance scale 0.75", () => {
    expect(SIZE_EXPONENT).toBe(1 / 3);
    expect(DISTANCE_EXPONENT).toBe(1 / 3);
    expect(DISTANCE_SCALE).toBe(0.75);
  });

  it("draws every size as the cube root of its ratio to the Moon, to 1e-12 relative", () => {
    for (let km = 1; km < 1e7; km *= 1.37) {
      const expected = Math.cbrt(km / MOON_RADIUS_KM);
      expect(Math.abs(drawnRadius(km) - expected) / expected).toBeLessThan(1e-12);
    }
  });

  it("draws every distance as 0.75 times the cube root of its ratio to the Moon's radius, to 1e-12 relative", () => {
    for (let km = 1; km < 1e10; km *= 1.37) {
      const expected = 0.75 * Math.cbrt(km / MOON_RADIUS_KM);
      expect(Math.abs(drawnDistance(km) - expected) / expected).toBeLessThan(1e-12);
    }
  });

  it("gives Moon 1, Earth 1.54264 and the Sun 7.37068 Moon radii (a size exponent of 0.4 would give 1.68 and 11.0)", () => {
    expect(drawnRadius(MOON_RADIUS_KM)).toBe(1);
    expect(DRAWN_EARTH_RADIUS).toBeCloseTo(1.54264, 5);
    expect(DRAWN_SUN_RADIUS).toBeCloseTo(7.37068, 5);
    expect(DRAWN_EARTH_RADIUS).toBe(drawnRadius(EARTH_RADIUS_KM));
    expect(DRAWN_SUN_RADIUS).toBe(drawnRadius(SUN_RADIUS_KM));
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

  it("at the extremes: Earth 4.42 to 4.63 Moon radii out, the Sun 32.9 to 33.4", () => {
    expect(drawnDistance(extremes.perigee.earthDistKm)).toBeGreaterThan(4.42);
    expect(drawnDistance(extremes.apogee.earthDistKm)).toBeLessThan(4.63);
    expect(drawnDistance(extremes.sunNear.sunDistKm)).toBeGreaterThan(32.9);
    expect(drawnDistance(extremes.sunFar.sunDistKm)).toBeLessThan(33.4);
  });

  it("keeps the order Moon < Earth < Sun in size, and Earth < Sun in distance, at every hour", () => {
    for (const h of hours) {
      expect(1).toBeLessThan(drawnEarth(h, false).radius);
      expect(drawnEarth(h, false).radius).toBeLessThan(sunOf(h).radius);
      expect(length(drawnEarth(h, false).centre)).toBeLessThan(length(sunOf(h).centre));
    }
  });

  it("draws the Sun 7.1 to 7.6 times further than Earth at every hour (389 true, its cube root 7.3)", () => {
    let low = Infinity;
    let high = 0;
    for (const h of hours) {
      const ratio = drawnDistance(h.sunDistKm) / drawnDistance(h.earthDistKm);
      low = Math.min(low, ratio);
      high = Math.max(high, ratio);
    }
    expect(low).toBeGreaterThan(7.1);
    expect(high).toBeLessThan(7.6);
  });

  it("keeps clear gaps between the surfaces at every hour: Moon to Earth over 1.85, Moon to Sun over 24, Earth to Sun over 19", () => {
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
    expect(moonEarth).toBeGreaterThan(1.85);
    expect(moonSun).toBeGreaterThan(24);
    expect(earthSun).toBeGreaterThan(19);
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
    expect(worst.off).toBeGreaterThan(7);
    expect(worst.off).toBeLessThan(8.5);
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
    expect(angleDeg(l, worst.drawnDir)).toBeGreaterThan(7);
  });
});

describe("the zoom-out limit", () => {
  it("reaches far enough to see the Sun's disc and glow beside the Moon in a small free space", () => {
    const sunReach = drawnDistance(152_100_000) + DRAWN_SUN_RADIUS * 1.8;
    const halfHeight = (1 + SYSTEM_MAX_ALTITUDE) * Math.tan((15 * Math.PI) / 180) * (1 / 3);
    expect(halfHeight).toBeGreaterThan(sunReach);
  });
});

describe("Earth fades while it stands in front of the Moon", () => {
  const earth: BodyPlacement = { centre: [4.5, 0, 0], radius: DRAWN_EARTH_RADIUS };

  it("is fully drawn beside the Moon or behind it", () => {
    expect(earthOpacity([0, -12, 0], earth)).toBe(1);
    expect(earthOpacity([-9, 0, 0], earth)).toBe(1);
  });

  it("is a faint ghost when it covers the Moon (From Earth), and hidden from inside it", () => {
    expect(earthOpacity([9.3, 0, 0], earth)).toBeLessThan(0.2);
    expect(earthOpacity([4.6, 0.2, 0], earth)).toBe(0);
  });

  it("fades smoothly as the camera swings round, never jumping", () => {
    let previous = earthOpacity([9.3, 0, 0], earth);
    for (let a = 0; a <= Math.PI; a += 0.002) {
      const now = earthOpacity([9.3 * Math.cos(a), 9.3 * Math.sin(a), 0], earth);
      expect(Math.abs(now - previous)).toBeLessThan(0.05);
      previous = now;
    }
    expect(previous).toBe(1);
  });
});
