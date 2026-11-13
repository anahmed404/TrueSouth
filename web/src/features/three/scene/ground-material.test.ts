import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { GroundLook, groundRuntime, heightMips, MOTION_DETAIL, motionDetail } from "./ground-material";
import { qualityStages } from "./perf";
import { GROUND_QUALITY, groundDefines, groundQualityFromQuery, SHADOW_STEPS } from "./ground-quality";
import { CAP_HALF_WIDTH, CORE_HALF_WIDTH } from "./ground-relief";

function look(quality = GROUND_QUALITY.full) {
  const light = { light: { value: new THREE.Vector3(0, 1, 0) }, noLight: { value: 0 } };
  const blank = new THREE.Texture();
  const maps = {
    map: { value: blank },
    loaded: { value: 0 },
    capSlope: { value: blank },
    coreSlope: { value: blank },
    capLoaded: { value: 0 },
  };
  let invalidated = 0;
  const ground = new GroundLook(light, maps, () => (invalidated += 1), quality);
  return { ground, light, maps, invalidated: () => invalidated };
}

describe("the ground's quality levels", () => {
  it("compiles each effect in or out", () => {
    expect(groundDefines(GROUND_QUALITY.full)).toEqual({ GROUND_RELIEF: 2, GROUND_SHADOW_STEPS: 64, GROUND_GRAIN: 2 });
    expect(groundDefines(GROUND_QUALITY.reduced)).toEqual({ GROUND_RELIEF: 1, GROUND_SHADOW_STEPS: 24, GROUND_GRAIN: 1 });
    expect(groundDefines(GROUND_QUALITY.off)).toEqual({ GROUND_RELIEF: 0, GROUND_SHADOW_STEPS: 0, GROUND_GRAIN: 0 });
  });

  it("reads a level from the address, for measuring, and ignores what it does not know", () => {
    expect(groundQualityFromQuery("?view=terrain")).toBeNull();
    expect(groundQualityFromQuery("?ground=reduced")).toEqual(GROUND_QUALITY.reduced);
    expect(groundQualityFromQuery("?ground-shadows=off")).toEqual({ relief: "full", shadows: "off", grain: "full" });
    expect(groundQualityFromQuery("?ground=off&ground-grain=full")).toEqual({ relief: "off", shadows: "off", grain: "full" });
    expect(groundQualityFromQuery("?ground=ultra")).toBeNull();
  });

  it("defaults to full, and a change recompiles once and asks for one frame", () => {
    const { ground, invalidated } = look();
    expect(ground.material.defines).toEqual(groundDefines(GROUND_QUALITY.full));
    expect(ground.uniforms.uSteps.value).toBe(SHADOW_STEPS.full);
    const version = ground.material.version;
    ground.setQuality(GROUND_QUALITY.reduced);
    expect(ground.material.defines).toEqual(groundDefines(GROUND_QUALITY.reduced));
    expect(ground.uniforms.uSteps.value).toBe(SHADOW_STEPS.reduced);
    expect(ground.material.version).toBe(version + 1);
    expect(invalidated()).toBe(1);
    ground.setQuality({ ...GROUND_QUALITY.reduced });
    expect(ground.material.version).toBe(version + 1);
    ground.dispose();
  });
});

describe("the ground's material", () => {
  it("takes its light as an input, so a view with its own drawing light can share it", () => {
    const { ground, light } = look();
    expect(ground.uniforms.uLight).toBe(light.light);
    expect(ground.uniforms.uNoLight).toBe(light.noLight);
    ground.dispose();
  });

  it("places the cap images with the same half-widths as the tested projection", () => {
    const { ground } = look();
    expect(ground.material.fragmentShader).toContain(`HW = ${CAP_HALF_WIDTH.toFixed(8)}`);
    expect(ground.material.fragmentShader).toContain(`HWC = ${CORE_HALF_WIDTH.toFixed(8)}`);
    ground.dispose();
  });

  it("draws earthshine only when the Sun and Earth are known", () => {
    const { ground } = look();
    ground.setBodies([1, 0, 0], [-1, 0, 0], true);
    expect(ground.uniforms.uEarthLight.value).toBeGreaterThan(0);
    ground.setBodies([1, 0, 0], [-1, 0, 0], false);
    expect(ground.uniforms.uEarthLight.value).toBe(0);
    ground.dispose();
  });

  it("gives every ground mesh one shared draw hook, made once", () => {
    const { ground } = look();
    const a = new THREE.Object3D();
    const b = new THREE.Object3D();
    ground.attach(a);
    ground.attach(b);
    expect(a.onBeforeRender).toBe(b.onBeforeRender);
    ground.dispose();
  });

  it("forgets a site's heights when the ground is cleared", () => {
    const { ground } = look();
    const grid = { heights: new Float32Array(9), columns: 3, rows: 3, halfKm: 10 };
    ground.setHeights(grid, grid);
    ground.clearHeights();
    expect(ground.uniforms.uPatch.value.w).toBe(0);
    expect(ground.uniforms.uApron.value.w).toBe(0);
    ground.dispose();
  });
});

describe("the height grids' mip levels", () => {
  it("halve each time, and average what they cover", () => {
    const grid = Float32Array.from({ length: 5 * 5 }, (_, k) => k % 5);
    const levels = heightMips(grid, 5, 5, 7);
    expect(levels.map((l) => [l.width, l.height])).toEqual([
      [5, 5],
      [2, 2],
      [1, 1],
    ]);
    const flat = heightMips(new Float32Array(257 * 257).fill(1.25), 257, 257, 7);
    expect(flat).toHaveLength(7);
    for (const level of flat) for (const v of level.data) expect(v).toBeCloseTo(1.25, 6);
    // A ramp from 0 to 4 averages to its middle at the coarsest level.
    expect(levels[2]!.data[0]).toBeCloseTo(2, 6);
  });
});

describe("what the ground draws at run time (no recompiling)", () => {
  it("at rest, or moving on stage 0: the quality's own levels and the full mesh", () => {
    expect(motionDetail(0)).toBeNull();
    expect(groundRuntime(GROUND_QUALITY.full, true, null)).toEqual({ steps: 64, grain: true, meshStep: 1 });
  });

  it("moving on a slow machine: coarser and lighter with each of the governor's stages", () => {
    expect(groundRuntime(GROUND_QUALITY.full, true, motionDetail(1))).toEqual({ steps: 24, grain: true, meshStep: 2 });
    expect(groundRuntime(GROUND_QUALITY.full, true, motionDetail(2))).toEqual({ steps: 24, grain: false, meshStep: 2 });
    expect(groundRuntime(GROUND_QUALITY.full, true, motionDetail(3))).toEqual({ steps: 0, grain: false, meshStep: 4 });
    expect(motionDetail(9)).toEqual(motionDetail(3));
    // Moving never raises a level the quality lowered.
    expect(groundRuntime(GROUND_QUALITY.off, true, motionDetail(1))).toEqual({ steps: 0, grain: false, meshStep: 2 });
  });

  it("the governor's stages each have a row", () => {
    expect(MOTION_DETAIL.length).toBe(qualityStages(1).length);
  });

  it("where the disclosure cannot be shown: no drawn shadows and no texture, moving or not", () => {
    expect(groundRuntime(GROUND_QUALITY.full, false, null)).toMatchObject({ steps: 0, grain: false });
    expect(groundRuntime(GROUND_QUALITY.full, false, motionDetail(1))).toMatchObject({ steps: 0, grain: false });
  });

  it("setMotion drives the uniforms and the mesh's draw range, and back at rest", () => {
    const { ground } = look();
    const geometry = new THREE.BufferGeometry();
    geometry.setIndex(Array.from({ length: 30 }, (_, i) => i % 3));
    geometry.userData.lod = { 1: { start: 0, count: 24 }, 2: { start: 24, count: 6 } };
    const mesh = new THREE.Mesh(geometry);
    ground.attach(mesh);
    expect(geometry.drawRange).toMatchObject({ start: 0, count: 24 });
    ground.setMotion(true, 2);
    expect(geometry.drawRange).toMatchObject({ start: 24, count: 6 });
    expect(ground.uniforms.uSteps.value).toBe(24);
    expect(ground.uniforms.uGrainOn.value).toBe(0);
    ground.setMotion(false, 2);
    expect(geometry.drawRange).toMatchObject({ start: 0, count: 24 });
    expect(ground.uniforms.uSteps.value).toBe(64);
    ground.setMotion(true, 0);
    expect(geometry.drawRange).toMatchObject({ start: 0, count: 24 });
    ground.dispose();
  });

  it("the material follows: setDisclosed(false) turns the uniforms off, and back", () => {
    const { ground, invalidated } = look();
    ground.setDisclosed(false);
    expect(ground.uniforms.uSteps.value).toBe(0);
    expect(ground.uniforms.uGrainOn.value).toBe(0);
    expect(invalidated()).toBe(1);
    ground.setDisclosed(true);
    expect(ground.uniforms.uSteps.value).toBe(64);
    expect(ground.uniforms.uGrainOn.value).toBe(1);
    ground.dispose();
  });
});
