import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeTerrain } from "../../data/decode/index.ts";
import { destination } from "./frames";
import {
  CAP_CORE_HALF_WIDTH_M,
  CAP_HALF_WIDTH_M,
  EARTH_RADIUS_KM,
  MOON_RADIUS_KM,
  apronCellLocalKm,
  apronCellOffsetM,
  bodyDirections,
  capUv,
  localDirectionToScene,
  localKmToSceneOffset,
  sceneDirectionAtSite,
  siteGroundScene,
  surfacePointScene,
  trueEarthPlacement,
  type SystemHour,
} from "./placement";
import { sceneToLatLon, sunElevationDeg } from "./system";

const here = path.dirname(fileURLToPath(import.meta.url));
const fixtures = path.resolve(here, "../../../../data/fixtures");

function hour(partial: Partial<SystemHour>): SystemHour {
  return {
    subsolarLatDeg: 0,
    subsolarLonDeg: 0,
    subearthLatDeg: 0,
    subearthLonDeg: 0,
    earthDistKm: 384_400,
    sunDistKm: 149_600_000,
    ...partial,
  };
}

function expectVec(actual: readonly number[], expected: readonly number[], digits = 9) {
  expect(actual).toHaveLength(3);
  for (let i = 0; i < 3; i += 1) expect(actual[i]).toBeCloseTo(expected[i] as number, digits);
}

describe("the Sun and Earth in the scene (science.md §14)", () => {
  it("hour 0 of the fixture: both sub-points at (0°, 0°) put both bodies along scene +x", () => {
    // fixtures/system.bin hour 0: subsolar (0, 0), subearth (0, 0).
    const { sun, earth } = bodyDirections(hour({}));
    expectVec(sun, [1, 0, 0]);
    expectVec(earth, [1, 0, 0]);
  });

  it("a sub-solar point at 90° E on the equator puts the Sun along scene −z", () => {
    // Moon-fixed û(0, 90) = (0, 1, 0); scene (x, z, −y) = (0, 0, −1).
    expectVec(bodyDirections(hour({ subsolarLonDeg: 90 })).sun, [0, 0, -1]);
  });

  it("fixture hour 19,500: sub-solar (1.4808° N, 174.5393° E) by hand", () => {
    // û = (cos 1.4808° cos 174.5393°, cos 1.4808° sin 174.5393°, sin 1.4808°)
    //   = (−0.995129, 0.095131, 0.025842); scene (x, z, −y) = (−0.995129, 0.025842, −0.095131).
    const { sun } = bodyDirections(hour({ subsolarLatDeg: 1.4808, subsolarLonDeg: 174.5393 }));
    expectVec(sun, [-0.995129, 0.025842, -0.095131], 5);
  });

  it("fixture hour 19,500: sub-Earth (5.9862° S, 357.0069° E) by hand", () => {
    // û = (cos(−5.9862°) cos 357.0069°, cos(−5.9862°) sin 357.0069°, sin(−5.9862°))
    //   = (0.993190, −0.051931, −0.104289); scene = (0.993190, −0.104289, 0.051931).
    const { earth } = bodyDirections(hour({ subearthLatDeg: -5.9862, subearthLonDeg: 357.0069 }));
    expectVec(earth, [0.99319, -0.104289, 0.051931], 5);
  });

  it("puts Earth at its real distance and size at true scale (the default arrangement is proportions.ts)", () => {
    const h = hour({ subearthLonDeg: 90, earthDistKm: 384_400 });
    const real = trueEarthPlacement(h);
    expect(Math.hypot(...real.centre)).toBeCloseTo(384_400 / MOON_RADIUS_KM, 9);
    expect(real.radius).toBeCloseTo(EARTH_RADIUS_KM / MOON_RADIUS_KM, 12);
    // Seen from the Moon at true scale, Earth is about 2° wide (system-view.md, "Done when").
    const widthDeg = (2 * Math.atan(real.radius / Math.hypot(...real.centre)) * 180) / Math.PI;
    expect(widthDeg).toBeGreaterThan(1.8);
    expect(widthDeg).toBeLessThan(2.0);
  });

  it("the Sun's elevation at a site from the scene direction equals the §14 formula", () => {
    const h = hour({ subsolarLatDeg: 1.4808, subsolarLonDeg: 174.5393 });
    const { sun } = bodyDirections(h);
    const site = { lat: -89.4555, lon: 222.6192 };
    const fromScene = sceneDirectionAtSite(sun, site.lat, site.lon).elevationDeg;
    expect(fromScene).toBeCloseTo(sunElevationDeg(site.lat, site.lon, 1.4808, 174.5393), 9);
  });
});

describe("directions from the series in a site's local frame", () => {
  it("round-trips azimuth and elevation through the scene", () => {
    for (const [az, el] of [
      [0, 0],
      [90, 1.5],
      [222.6, -3.2],
      [359, 45],
    ] as const) {
      const d = localDirectionToScene(az, el, -89.4555, 222.6192);
      const back = sceneDirectionAtSite(d, -89.4555, 222.6192);
      expect(back.elevationDeg).toBeCloseTo(el, 9);
      expect(back.azimuthDeg).toBeCloseTo(az, 9);
    }
  });

  it("straight up at a site is the site's own direction from the Moon's centre", () => {
    const d = localDirectionToScene(0, 90, -84.7906, 29.1957);
    const p = surfacePointScene(-84.7906, 29.1957);
    expectVec(d, p, 9);
  });
});

describe("a site on the globe and on the polar cap agree (science.md §2.3)", () => {
  it("80° S on the prime meridian is the middle of the cap image's top edge", () => {
    const { u, v } = capUv(-80, 0, CAP_HALF_WIDTH_M);
    expect(u).toBeCloseTo(0.5, 9);
    // ρ = 2R tan 5° = 304.0 km, which is the half-width to within 0.03 %.
    expect(v).toBeCloseTo(1, 3);
  });

  it("80° S, 90° E is the middle of the right edge", () => {
    const { u, v } = capUv(-80, 90, CAP_HALF_WIDTH_M);
    expect(u).toBeCloseTo(1, 3);
    expect(v).toBeCloseTo(0.5, 9);
  });

  it("Shackleton (89.67° S, 129.2° E) by hand", () => {
    // ρ = 2 × 1737.4 km × tan(0.165°) = 10.007 km; x = ρ sin 129.2° = 7.755 km,
    // y = ρ cos 129.2° = −6.325 km. In the 4K cap: u = 0.5 + 7.755 / 608, v = 0.5 − 6.325 / 608.
    const cap = capUv(-89.67, 129.2, CAP_HALF_WIDTH_M);
    expect(cap.u).toBeCloseTo(0.512755, 5);
    expect(cap.v).toBeCloseTo(0.489597, 5);
    // In the ±76 km core the same point is four times further from the centre.
    const core = capUv(-89.67, 129.2, CAP_CORE_HALF_WIDTH_M);
    expect(core.u - 0.5).toBeCloseTo((cap.u - 0.5) * 4, 9);
    expect(core.v - 0.5).toBeCloseTo((cap.v - 0.5) * 4, 9);
  });

  it("Connecting Ridge's pin on the globe maps to the same cap pixel as its listed coordinates", () => {
    const lat = -89.4555;
    const lon = 222.6192;
    const pin = surfacePointScene(lat, lon);
    const back = sceneToLatLon(pin);
    const fromPin = capUv(back.latDeg, back.lonDeg, CAP_HALF_WIDTH_M);
    const listed = capUv(lat, lon, CAP_HALF_WIDTH_M);
    // Within a hundredth of a 4,096-pixel cap image's pixel.
    expect(Math.abs(fromPin.u - listed.u) * 4096).toBeLessThan(0.01);
    expect(Math.abs(fromPin.v - listed.v) * 4096).toBeLessThan(0.01);
  });
});

describe("the patch and the apron on the Moon (science.md §13)", () => {
  const grid = { rows: 161, columns: 161, windowM: 300_000 };
  const site = { lat: -89.4555, lon: 222.6192, z0: 1950.5 };

  it("the apron's centre cell is the site's ground point", () => {
    expect(apronCellOffsetM(80, 80, grid)).toEqual({ eastM: 0, northM: 0 });
    const local = apronCellLocalKm(80, 80, site.z0, site.z0, grid);
    expect(local.eastKm).toBeCloseTo(0, 12);
    expect(local.northKm).toBeCloseTo(0, 12);
    expect(local.upKm).toBeCloseTo(0, 12);
  });

  it("the patch's centre vertex (from the fixture terrain.bin) sits on the apron's centre cell", () => {
    const buffer = readFileSync(path.join(fixtures, "sites/fixture_ridge/terrain.bin"));
    const terrain = decodeTerrain(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength), 33, "terrain.bin");
    const centre = 16 * 33 + 16;
    const patch = localKmToSceneOffset(
      terrain.east_km[centre] as number,
      terrain.north_km[centre] as number,
      0,
      site.lat,
      site.lon,
    );
    const apron = apronCellLocalKm(80, 80, site.z0, site.z0, grid);
    const apronScene = localKmToSceneOffset(apron.eastKm, apron.northKm, apron.upKm, site.lat, site.lon);
    expectVec(patch, apronScene, 12);
    expectVec(patch, [0, 0, 0], 12);
  });

  it("a cell 150 km north is where §13 and the great-circle walk (§2.2) say", () => {
    // Row 0, column 80: E = 0, N = +150 km.
    expect(apronCellOffsetM(0, 80, grid)).toEqual({ eastM: 0, northM: 150_000 });
    const heightM = 1_000;
    const local = apronCellLocalKm(0, 80, heightM, site.z0, grid);
    const R = 1_737_400;
    const gamma = 150_000 / R;
    // §13 by hand: north = (R + z) sin γ, up = (R + z) cos γ − (R + z0), east = 0.
    expect(local.eastKm).toBeCloseTo(0, 9);
    expect(local.northKm).toBeCloseTo(((R + heightM) * Math.sin(gamma)) / 1_000, 9);
    expect(local.upKm).toBeCloseTo(((R + heightM) * Math.cos(gamma) - (R + site.z0)) / 1_000, 9);
    // The same point placed in the scene is the §2.2 destination at that height.
    const offset = localKmToSceneOffset(local.eastKm, local.northKm, local.upKm, -84.7906, 29.1957);
    const ground = siteGroundScene(-84.7906, 29.1957, site.z0);
    const placed = [ground[0] + offset[0], ground[1] + offset[1], ground[2] + offset[2]];
    const walked = destination(-84.7906, 29.1957, 0, 150_000);
    expectVec(placed, surfacePointScene(walked.latDeg, walked.lonDeg, heightM), 9);
  });
});
