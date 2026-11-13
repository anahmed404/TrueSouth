import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import { homePose, polarPose, type Pose, type Subjects } from "./camera";
import { POLE_LIMIT_Y, Rig } from "./rig";

const space: FreeSpace = { x: 336, y: 120, width: 728, height: 560, viewport: { width: 1440, height: 900 }, windowOpen: false };
const subjects: Subjects = {
  earth: { centre: [2.5, 0, 0], radius: 0.4 },
  sun: { dir: [-1, 0, 0], centre: [-2.5, 0, 0], radius: 0.12 },
};

/** The scene's keys: ArrowUp is orbit(0, −24), ArrowDown is orbit(0, 24). */
const KEY_STEP = 24;

function systemRig(): Rig {
  const rig = new Rig(new THREE.PerspectiveCamera(30, 1440 / 900, 1e-7, 5000));
  rig.mode = "system";
  rig.apply(homePose(subjects, space));
  return rig;
}

function unitY(rig: Rig): number {
  return rig.camera.position.clone().normalize().y;
}

describe("orbiting the System view", () => {
  it("one ArrowUp step from the home pose (straight below the pole) tilts the camera", () => {
    const rig = systemRig();
    const before = rig.camera.position.clone();
    rig.beginDrag();
    rig.orbit(0, -KEY_STEP);
    expect(rig.camera.position.distanceTo(before)).toBeGreaterThan(1e-3);
    expect(Math.abs(unitY(rig))).toBeLessThan(1);
  });

  it("one ArrowDown step from the home pose tilts the camera too", () => {
    const rig = systemRig();
    const before = rig.camera.position.clone();
    rig.beginDrag();
    rig.orbit(0, KEY_STEP);
    expect(rig.camera.position.distanceTo(before)).toBeGreaterThan(1e-3);
  });

  it("repeated steps back toward the pole stop at the limit and never flip over it", () => {
    const rig = systemRig();
    rig.beginDrag();
    for (let i = 0; i < 6; i += 1) rig.orbit(0, -KEY_STEP);
    const away = rig.camera.position.clone().normalize();
    expect(Math.abs(away.y)).toBeLessThan(POLE_LIMIT_Y);
    const side = new THREE.Vector2(away.x, away.z).normalize();
    for (let i = 0; i < 40; i += 1) {
      rig.orbit(0, KEY_STEP);
      const now = rig.camera.position.clone().normalize();
      // Never past the limit, and never across the pole to the other side.
      expect(Math.abs(now.y)).toBeLessThanOrEqual(POLE_LIMIT_Y + 1e-9);
      expect(new THREE.Vector2(now.x, now.z).normalize().dot(side)).toBeGreaterThan(0);
    }
    expect(Math.abs(unitY(rig))).toBeCloseTo(POLE_LIMIT_Y, 6);
  });

  it("a fast drag past the pole does not flip the camera to the other side", () => {
    const rig = systemRig();
    rig.beginDrag();
    for (let i = 0; i < 6; i += 1) rig.orbit(0, -KEY_STEP);
    const side = new THREE.Vector2(rig.camera.position.x, rig.camera.position.z).normalize();
    rig.orbit(0, 400);
    const now = rig.camera.position.clone().normalize();
    expect(Math.abs(now.y)).toBeLessThanOrEqual(POLE_LIMIT_Y + 1e-9);
    expect(new THREE.Vector2(now.x, now.z).normalize().dot(side)).toBeGreaterThan(0);
  });

  it("keeps the camera's distance from the Moon", () => {
    const rig = systemRig();
    const r = rig.camera.position.length();
    rig.beginDrag();
    rig.orbit(37, -51);
    expect(rig.camera.position.length()).toBeCloseTo(r, 9);
  });
});

describe("flights between camera views", () => {
  const T0 = 1_000;
  const MS = 1_400;
  const home = homePose(subjects, space);
  const pole = polarPose(space);

  function arrivals(): { views: string[]; spy: (view: string) => void } {
    const views: string[] = [];
    return { views, spy: (view) => views.push(view) };
  }

  function expectAt(rig: Rig, pose: Pose) {
    const p = rig.camera.position;
    expect(p.x).toBeCloseTo(pose.pos[0], 9);
    expect(p.y).toBeCloseTo(pose.pos[1], 9);
    expect(p.z).toBeCloseTo(pose.pos[2], 9);
  }

  /** Everything a pointer down, a drag, a scroll and the keys do in the scene. */
  function poke(rig: Rig) {
    rig.beginDrag();
    rig.orbit(40, -30);
    rig.zoom(0.5);
    rig.stop();
  }

  it("a pointer down during the flight to the Polar map does not stop it: it lands, reports once and ends on the map's lighting", () => {
    const rig = systemRig();
    const { views, spy } = arrivals();
    rig.flyToView("map", pole, MS, spy, { now: T0 });
    rig.update(T0 + MS * 0.5);
    poke(rig);
    expect(rig.flying).toBe(true);
    rig.update(T0 + MS * 0.8);
    expect(rig.draw).toBeGreaterThan(0);
    expect(rig.draw).toBeLessThan(1);
    rig.update(T0 + MS);
    expect(views).toEqual(["map"]);
    expect(rig.draw).toBe(1);
    expectAt(rig, pole);
    rig.update(T0 + MS * 3);
    expect(views).toEqual(["map"]);
  });

  it("a pointer down during the flight away from the Polar map does not stop it either", () => {
    const rig = systemRig();
    rig.mode = "map";
    rig.apply(pole);
    rig.draw = 1;
    const { views, spy } = arrivals();
    rig.flyToView("system", home, MS, spy, { now: T0 });
    rig.update(T0 + MS * 0.2);
    poke(rig);
    rig.update(T0 + MS * 0.3);
    poke(rig);
    rig.update(T0 + MS);
    expect(views).toEqual(["system"]);
    expect(rig.draw).toBe(0);
    expectAt(rig, home);
  });

  it("a second view pick during a flight takes over from where the camera is; only it reports", () => {
    const rig = systemRig();
    const { views, spy } = arrivals();
    rig.flyToView("map", pole, MS, spy, { now: T0 });
    rig.update(T0 + MS * 0.9);
    const partial = rig.draw;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(1);
    const midway = rig.camera.position.clone();
    rig.flyToView("system", home, MS, spy, { now: T0 + MS * 0.9 });
    // It starts where the first flight was, with the lighting where it was.
    rig.update(T0 + MS * 0.9);
    expect(rig.camera.position.distanceTo(midway)).toBeLessThan(1e-9);
    expect(rig.draw).toBeCloseTo(partial, 12);
    rig.update(T0 + MS * 0.9 + MS);
    expect(views).toEqual(["system"]);
    expect(rig.draw).toBe(0);
    expectAt(rig, home);
  });

  it("drags work again once the flight has landed", () => {
    const rig = systemRig();
    rig.flyToView("system", home, MS, undefined, { now: T0 });
    rig.update(T0 + MS);
    const before = rig.camera.position.clone();
    rig.beginDrag();
    rig.orbit(0, -KEY_STEP);
    expect(rig.camera.position.distanceTo(before)).toBeGreaterThan(1e-3);
  });

  it("a move inside a view (a preset) is still stopped by a drag", () => {
    const rig = systemRig();
    rig.flyTo(pole, MS, undefined, undefined, { now: T0 });
    rig.update(T0 + MS * 0.5);
    rig.beginDrag();
    expect(rig.flying).toBe(false);
  });
});
