import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { SERIES_COLUMNS, decodeSeries } from "../../../data/decode/index.ts";
import { localDirectionToScene, siteFrameScene } from "../../../lib/geo";
import { aimLander, createLander, partAxis } from "./lander";

const here = path.dirname(fileURLToPath(import.meta.url));
const raw = readFileSync(path.resolve(here, "../../../../../data/fixtures/sites/fixture_crater/series.bin"));
const series = decodeSeries(
  raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength),
  SERIES_COLUMNS,
  raw.byteLength / (SERIES_COLUMNS.length * 2),
  "series.bin",
);

// fixture_crater sits at 85° S, 20° E (fixtures/sites.json).
const LAT = -85;
const LON = 20;

/**
 * Two hours of the fixture series, worked by hand with science.md §2.1 (the local frame) and
 * §14 (scene axes): d = cos e cos A n̂ + cos e sin A ê + sin e û, then (x, y, z) → (x, z, −y).
 */
const HOURS = [
  {
    hour: 0,
    sun: { az: 57.0, el: 2.43, scene: [0.226275, 0.005188, -0.97405] },
    earth: { az: 67.0, el: 5.24, scene: [0.058206, -0.057068, -0.996672] },
  },
  {
    hour: 19_500,
    sun: { az: 242.46, el: 0.48, scene: [-0.128874, -0.048642, 0.990467] },
    earth: { az: 60.02, el: 2.12, scene: [0.17443, 0.00667, -0.984647] },
  },
] as const;

describe("Pip points its panel at the Sun and its dish at Earth", () => {
  for (const { hour, sun, earth } of HOURS) {
    it(`fixture hour ${hour}`, () => {
      expect(series.sun_az[hour]).toBeCloseTo(sun.az, 6);
      expect(series.sun_el[hour]).toBeCloseTo(sun.el, 6);
      expect(series.earth_az[hour]).toBeCloseTo(earth.az, 6);
      expect(series.earth_el[hour]).toBeCloseTo(earth.el, 6);

      // The sight-lines' directions, from the series.
      const sunDir = localDirectionToScene(sun.az, sun.el, LAT, LON);
      const earthDir = localDirectionToScene(earth.az, earth.el, LAT, LON);
      for (let i = 0; i < 3; i += 1) {
        expect(sunDir[i]).toBeCloseTo(sun.scene[i] as number, 5);
        expect(earthDir[i]).toBeCloseTo(earth.scene[i] as number, 5);
      }

      const material = new THREE.MeshBasicMaterial();
      const lander = createLander(material);
      const frame = siteFrameScene(LAT, LON);
      aimLander(lander, frame.up, frame.north, sunDir, earthDir);
      lander.group.updateMatrixWorld(true);

      const panel = partAxis(lander.panel).axis;
      const dish = partAxis(lander.dish).axis;
      expect(panel.angleTo(new THREE.Vector3(...sunDir))).toBeLessThan(1e-6);
      expect(dish.angleTo(new THREE.Vector3(...earthDir))).toBeLessThan(1e-6);

      // The body stands upright on the site.
      const bodyUp = new THREE.Vector3(0, 1, 0).applyQuaternion(lander.group.quaternion);
      expect(bodyUp.angleTo(new THREE.Vector3(...frame.up))).toBeLessThan(1e-9);
      lander.dispose();
      material.dispose();
    });
  }

  it("stays cheap: a few hundred triangles", () => {
    const lander = createLander(new THREE.MeshBasicMaterial());
    expect(lander.triangles).toBeGreaterThan(100);
    expect(lander.triangles).toBeLessThan(700);
    lander.dispose();
  });
});
