import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeSystem } from "../../../data/decode/index.ts";
import { parseManifest } from "../../../data/parse.ts";
import { EARTH_RADIUS_KM, MOON_RADIUS_KM, SUN_RADIUS_KM, bodyDirections, type BodyPlacement, type SystemHour } from "../../../lib/geo";
import {
  DRAWN_EARTH_RADIUS,
  DRAWN_SUN_RADIUS,
  SYSTEM_MAX_ALTITUDE,
  drawnDistance,
  drawnEarth,
  drawnRadius,
  drawnSun,
  earthOpacity,
} from "./proportions";

const fixtures = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../../data/fixtures");

function bytes(name: string): ArrayBuffer {
  const b = readFileSync(path.join(fixtures, name));
  const copy = new ArrayBuffer(b.byteLength);
  new Uint8Array(copy).set(b);
  return copy;
}

/** Every hour of the stored series (data/fixtures/system.bin). */
const hours: SystemHour[] = (() => {
  const manifest = parseManifest(JSON.parse(readFileSync(path.join(fixtures, "manifest.json"), "utf8")) as unknown);
  const count = manifest.time_grid.count;
  const s = decodeSystem(bytes("system.bin"), count, "system.bin");
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

/** The hours where Earth is nearest and furthest (perigee and apogee), and the Sun's extremes. */
const extremes = (() => {
  const by = (key: "earthDistKm" | "sunDistKm", sign: 1 | -1) =>
    hours.reduce((best, h) => (sign * h[key] > sign * best[key] ? h : best), hours[0]!);
  return [by("earthDistKm", -1), by("earthDistKm", 1), by("sunDistKm", -1), by("sunDistKm", 1)];
})();

describe("the System view's schematic sizes and distances", () => {
  it("reads the whole stored series", () => {
    expect(hours.length).toBeGreaterThan(1_000);
    // Earth's distance swings over the series (perigee to apogee).
    expect(extremes[1]!.earthDistKm - extremes[0]!.earthDistKm).toBeGreaterThan(30_000);
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

  it("draws Moon < Earth < Sun, clearly: Earth at least 1.5 Moons across, the Sun at least 4.5 Earths", () => {
    expect(drawnRadius(MOON_RADIUS_KM)).toBeCloseTo(1, 12);
    expect(DRAWN_EARTH_RADIUS).toBeCloseTo(drawnRadius(EARTH_RADIUS_KM), 12);
    expect(DRAWN_SUN_RADIUS).toBeCloseTo(drawnRadius(SUN_RADIUS_KM), 12);
    expect(DRAWN_EARTH_RADIUS).toBeGreaterThan(1.5);
    expect(DRAWN_SUN_RADIUS).toBeGreaterThan(4.5 * DRAWN_EARTH_RADIUS);
  });

  it("draws the Sun at least 7 times further than Earth, at every hour", () => {
    for (const h of hours) {
      expect(drawnDistance(h.sunDistKm)).toBeGreaterThan(7 * drawnDistance(h.earthDistKm));
    }
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
      // The drawn distance follows the true one through the mapping, hour by hour.
      expect(length(drawnEarth(h, false).centre)).toBeCloseTo(drawnDistance(h.earthDistKm), 12);
    }
  });

  it("never lets two bodies touch, at any hour, perigee and apogee included", () => {
    for (const h of hours) {
      const bodies = [MOON, drawnEarth(h, false), sunOf(h)];
      for (let i = 0; i < bodies.length; i += 1) {
        for (let j = i + 1; j < bodies.length; j += 1) {
          const a = bodies[i]!;
          const b = bodies[j]!;
          expect(between(a.centre, b.centre)).toBeGreaterThan(a.radius + b.radius + 0.5);
        }
      }
    }
  });

  it("a sight-line from any site on the Moon, along its true direction, points into the drawn Earth and Sun", () => {
    // A ray from a surface point P along direction d hits a sphere when the sphere's centre
    // lies ahead and within its radius of the ray.
    const hits = (from: V, dir: V, body: BodyPlacement) => {
      const c: V = [body.centre[0] - from[0], body.centre[1] - from[1], body.centre[2] - from[2]];
      const along = c[0] * dir[0] + c[1] * dir[1] + c[2] * dir[2];
      const off = Math.sqrt(Math.max(0, c[0] ** 2 + c[1] ** 2 + c[2] ** 2 - along * along));
      return along > 0 && off < body.radius;
    };
    for (const h of extremes) {
      const { sun, earth } = bodyDirections(h);
      for (let lat = -90; lat <= 90; lat += 15) {
        for (let lon = 0; lon < 360; lon += 30) {
          const la = (lat * Math.PI) / 180;
          const lo = (lon * Math.PI) / 180;
          const site: V = [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)];
          // Only sites that can see the body at all (above their horizon).
          if (site[0] * earth[0] + site[1] * earth[1] + site[2] * earth[2] > 0) expect(hits(site, earth, drawnEarth(h, false))).toBe(true);
          if (site[0] * sun[0] + site[1] * sun[1] + site[2] * sun[2] > 0) expect(hits(site, sun, sunOf(h))).toBe(true);
        }
      }
    }
  });

  it("True scale still draws Earth at its real distance and real size", () => {
    for (const h of extremes) {
      const real = drawnEarth(h, true);
      expect(real.radius).toBeCloseTo(EARTH_RADIUS_KM / MOON_RADIUS_KM, 12);
      expect(length(real.centre)).toBeCloseTo(h.earthDistKm / MOON_RADIUS_KM, 9);
      expect(real.radius / length(real.centre)).toBeCloseTo(EARTH_RADIUS_KM / h.earthDistKm, 12);
    }
  });

  it("lets the camera zoom out far enough to see the Sun's disc and glow beside the Moon", () => {
    const sunReach = drawnDistance(152_100_000) + DRAWN_SUN_RADIUS * 1.8;
    // At the limit, a 30° lens over a free space a third of the window's height still spans it.
    const halfHeight = (1 + SYSTEM_MAX_ALTITUDE) * Math.tan((15 * Math.PI) / 180) * (1 / 3);
    expect(halfHeight).toBeGreaterThan(sunReach);
  });
});

describe("Earth fades while it stands in front of the Moon", () => {
  const earth: BodyPlacement = { centre: [4.5, 0, 0], radius: DRAWN_EARTH_RADIUS };

  it("is fully drawn beside the Moon, behind it, or behind the camera", () => {
    expect(earthOpacity([0, -12, 0], earth)).toBe(1); // home: side by side
    expect(earthOpacity([-9, 0, 0], earth)).toBe(1); // Earth behind the Moon
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
