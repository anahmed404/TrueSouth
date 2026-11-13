import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import { siteFrameScene, siteGroundScene } from "../../../lib/geo";
import { MIN_SPACE_ALTITUDE, eyePose, homePose, terrainPose, type Pose, type SiteFrame, type Subjects } from "./camera";
import { CAP_HALF, FAR_DISTANCE, NEAR_DISTANCE, POLE_LIMIT_Y, lookOf, southPolePose, systemPivot } from "./navigate";
import { Rig } from "./rig";

const space: FreeSpace = { x: 336, y: 120, width: 728, height: 560, viewport: { width: 1440, height: 900 }, windowOpen: false };
const subjects: Subjects = {
  earth: { centre: [2.5, 0, 0], radius: 0.4 },
  sun: { dir: [-1, 0, 0], centre: [-2.5, 0, 0], radius: 0.12 },
};

function makeRig(mode: Rig["mode"], pose: Pose): Rig {
  const rig = new Rig(new THREE.PerspectiveCamera(30, 1440 / 900, 1e-7, 5000));
  rig.setFreeSpace(space, 0);
  rig.mode = mode;
  rig.apply(pose);
  return rig;
}

/** Where a scene point is on screen, in CSS pixels from the top left. */
function screen(rig: Rig, point: THREE.Vector3): { x: number; y: number } {
  const c = rig.camera;
  c.updateMatrixWorld();
  const p = point.clone().project(c);
  return { x: ((p.x + 1) / 2) * 1440, y: ((1 - p.y) / 2) * 900 };
}

/** The surface point a quarter of the way from the centre of the view to its foot. */
function frontPoint(rig: Rig): THREE.Vector3 {
  const c = rig.camera;
  c.updateMatrixWorld();
  const ray = new THREE.Vector3(0, -0.25, 1).applyMatrix4(c.projectionMatrixInverse).normalize().transformDirection(c.matrixWorld);
  const centre = new THREE.Vector3(0, 0, 1).applyMatrix4(c.projectionMatrixInverse).normalize().transformDirection(c.matrixWorld);
  for (const dir of [ray, centre]) {
    const b = c.position.dot(dir);
    const disc = b * b - (c.position.lengthSq() - 1);
    if (disc >= 0) return c.position.clone().addScaledVector(dir, -b - Math.sqrt(disc));
  }
  throw new Error("no surface in view");
}

/** Moves along a drag and reports how a point of the scene moved on screen. */
function dragMoves(rig: Rig, point: THREE.Vector3, dx: number, dy: number): { x: number; y: number } {
  const before = screen(rig, point);
  rig.beginDrag();
  rig.orbit(dx, dy);
  const after = screen(rig, point);
  return { x: after.x - before.x, y: after.y - before.y };
}

/** The System view tilted off the pole, with the pole above or below the centre. */
function tiltedSystem(pitch: number, distance = 6): Rig {
  const rig = makeRig("system", { ...homePose(subjects, space), pos: [0, -(1 + distance), 0] });
  rig.beginDrag();
  for (let i = 0; i < 8; i += 1) rig.orbit(0, pitch);
  return rig;
}

const frame: SiteFrame = { ground: siteGroundScene(-89.45, -137.31, 1_900), ...siteFrameScene(-89.45, -137.31) };

describe("every drag follows the grab rule: the surface under the pointer moves with it", () => {
  for (const [name, pitch] of [
    ["pole below the centre", 30],
    ["pole above the centre", -30],
  ] as const) {
    it(`System view far out, ${name}: right moves it right, down moves it down`, () => {
      const rig = tiltedSystem(pitch);
      const point = frontPoint(rig);
      expect(dragMoves(rig, point, 20, 0).x).toBeGreaterThan(1);
      const p2 = frontPoint(rig);
      expect(dragMoves(rig, p2, -20, 0).x).toBeLessThan(-1);
      const p3 = frontPoint(rig);
      expect(dragMoves(rig, p3, 0, 20).y).toBeGreaterThan(1);
      const p4 = frontPoint(rig);
      expect(dragMoves(rig, p4, 0, -20).y).toBeLessThan(-1);
    });

  }

  it("System view close in, tilted with the sky at the top: the near surface follows both ways", () => {
    const rig = tiltedSystem(-30, 0.3);
    const up = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.camera.quaternion);
    expect(up.dot(new THREE.Vector3(0, -1, 0))).toBeGreaterThan(0.3); // the sky is up
    expect(dragMoves(rig, frontPoint(rig), 20, 0).x).toBeGreaterThan(1);
    expect(dragMoves(rig, frontPoint(rig), -20, 0).x).toBeLessThan(-1);
    expect(dragMoves(rig, frontPoint(rig), 0, 20).y).toBeGreaterThan(1);
    expect(dragMoves(rig, frontPoint(rig), 0, -20).y).toBeLessThan(-1);
  });

  it("System view close in, straight overhead: a drag up tilts the view, a drag down does not turn it upside down", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const before = rig.camera.position.clone();
    rig.beginDrag();
    rig.orbit(0, 30);
    expect(rig.camera.position.distanceTo(before)).toBeLessThan(1e-6);
    // From straight overhead the first move is along the view axis: check the tilt instead.
    rig.beginDrag();
    rig.orbit(0, -30);
    expect(rig.camera.position.distanceTo(before)).toBeGreaterThan(1e-3);
    const sky = new THREE.Vector3(0, 1, 0).applyQuaternion(rig.camera.quaternion).dot(new THREE.Vector3(0, -1, 0));
    expect(sky).toBeGreaterThan(0.1);
    expect(dragMoves(rig, frontPoint(rig), 0, -30).y).toBeLessThan(-1);
  });

  it("System view, the South pole preset (straight below the pole): the front edge follows a sideways drag", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const point = frontPoint(rig);
    expect(dragMoves(rig, point, 20, 0).x).toBeGreaterThan(1);
  });

  it("Local terrain: the ground nearest the viewer follows the pointer both ways", () => {
    const rig = makeRig("terrain", terrainPose(frame, 30, 200));
    rig.site = frame;
    const near = frontPoint(rig);
    expect(dragMoves(rig, near, 20, 0).x).toBeGreaterThan(1);
    const near2 = frontPoint(rig);
    expect(dragMoves(rig, near2, -20, 0).x).toBeLessThan(-1);
    const near3 = frontPoint(rig);
    expect(dragMoves(rig, near3, 0, 20).y).toBeGreaterThan(0.5);
  });

  it("Lander's eye: the scene ahead follows the pointer both ways", () => {
    const rig = makeRig("panorama", eyePose(frame, 120, 10));
    rig.site = frame;
    const ahead = () => rig.camera.position.clone().addScaledVector(lookOf(rig.camera), 1e-3);
    expect(dragMoves(rig, ahead(), 20, 0).x).toBeGreaterThan(1);
    expect(dragMoves(rig, ahead(), -20, 0).x).toBeLessThan(-1);
    expect(dragMoves(rig, ahead(), 0, 20).y).toBeGreaterThan(1);
  });

  it("the Polar map does not turn: it stays a north-up map", () => {
    const rig = makeRig("map", southPolePose(subjects, space));
    const before = rig.pose();
    rig.beginDrag();
    rig.orbit(40, 30);
    rig.pan(40, 30);
    rig.zoom(0.5, { x: 0.2, y: 0.1 });
    expect(rig.pose()).toEqual(before);
  });
});

describe("the System view's pivot", () => {
  const look = new THREE.Vector3(0, 1, 0);

  it("far out it is the Moon's centre, about the Moon's axis", () => {
    const pivot = systemPivot(new THREE.Vector3(0, -12, 0), look);
    expect(pivot.w).toBe(0);
    expect(pivot.point.length()).toBeLessThan(1e-12);
    expect(Math.abs(pivot.axis.y)).toBeCloseTo(1, 12);
  });

  it("close in it is the point at the centre of the view, about its vertical", () => {
    const position = new THREE.Vector3(0.3, -1.4, 0.2);
    const toward = new THREE.Vector3(0, -1, 0).sub(position).normalize();
    const pivot = systemPivot(position, toward);
    expect(pivot.w).toBe(1);
    expect(pivot.point.length()).toBeCloseTo(1, 9);
    // On the look ray.
    const rel = pivot.point.clone().sub(position).normalize();
    expect(rel.dot(toward)).toBeCloseTo(1, 9);
    expect(pivot.axis.dot(pivot.point.clone().normalize())).toBeCloseTo(1, 9);
  });

  it("close in after the South pole preset, the pole, and after Follow site, the site", () => {
    const pole = new THREE.Vector3(0, -1, 0);
    const fromPole = systemPivot(new THREE.Vector3(0.2, -1.6, 0), lookOf(makeRig("system", southPolePose(subjects, space)).camera), pole);
    expect(fromPole.point.distanceTo(pole)).toBeLessThan(1e-9);
    const siteUp = new THREE.Vector3(...frame.up);
    const fromSite = systemPivot(siteUp.clone().multiplyScalar(1.5), siteUp.clone().negate(), siteUp);
    expect(fromSite.point.distanceTo(siteUp)).toBeLessThan(1e-9);
  });

  it("slides from the centre to the surface with no jump as the camera comes in", () => {
    let previous = systemPivot(new THREE.Vector3(0, -(1 + FAR_DISTANCE + 1), 0), look);
    let worst = 0;
    for (let d = FAR_DISTANCE + 1; d >= 0.05; d -= 0.002) {
      const now = systemPivot(new THREE.Vector3(0.01, -(1 + d), 0), look);
      worst = Math.max(worst, now.point.distanceTo(previous.point), now.axis.distanceTo(previous.axis));
      previous = now;
    }
    expect(worst).toBeLessThan(0.01);
    expect(systemPivot(new THREE.Vector3(0, -(1 + NEAR_DISTANCE), 0), look).w).toBe(1);
  });

  it("does not jump when the look ray slides off the limb", () => {
    // The ray grazes the limb at asin(1/3); the hit point moves fast there, but does not jump.
    const position = new THREE.Vector3(0, 0, 3);
    const limb = Math.asin(1 / 3);
    let previous = systemPivot(position, new THREE.Vector3(Math.sin(limb - 0.002), 0, -Math.cos(limb - 0.002)));
    let worst = 0;
    for (let a = limb - 0.002; a < limb + 0.002; a += 1e-6) {
      const now = systemPivot(position, new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)));
      worst = Math.max(worst, now.point.distanceTo(previous.point));
      previous = now;
    }
    expect(worst).toBeLessThan(0.01);
  });

  it("close in, turning about the pole keeps the pole where it is on screen", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    rig.focus = new THREE.Vector3(0, -1, 0);
    const pole = new THREE.Vector3(0, -1, 0);
    const before = screen(rig, pole);
    rig.beginDrag();
    rig.orbit(60, 0);
    rig.orbit(0, 40);
    rig.orbit(-25, 10);
    const after = screen(rig, pole);
    expect(Math.hypot(after.x - before.x, after.y - before.y)).toBeLessThan(0.5);
  });
});

describe("no step crosses a pole, and the camera stays above the surface", () => {
  it("tilting toward the pole stops at the limit, from far and from close", () => {
    for (const [distance, toward] of [
      [8, -24],
      [0.4, 24],
    ] as const) {
      const rig = tiltedSystem(-Math.sign(toward) * 30, distance);
      const pivot = () => systemPivot(rig.camera.position, lookOf(rig.camera), null);
      for (let i = 0; i < 60; i += 1) {
        rig.beginDrag();
        rig.orbit(0, toward);
        const p = pivot();
        const dir = rig.camera.position.clone().sub(p.point).normalize();
        expect(Math.abs(dir.dot(p.axis))).toBeLessThanOrEqual(POLE_LIMIT_Y + 1e-6);
      }
    }
  });

  it("a fast drag at the pole does not flip the view over it", () => {
    const rig = tiltedSystem(30);
    const side = new THREE.Vector2(rig.camera.position.x, rig.camera.position.z).normalize();
    rig.beginDrag();
    rig.orbit(0, -900);
    const now = rig.camera.position.clone();
    expect(new THREE.Vector2(now.x, now.z).normalize().dot(side)).toBeGreaterThan(0);
  });

  it("close in, tilting toward the horizon stops above the zoom limit", () => {
    const rig = tiltedSystem(-30, 0.05);
    for (let i = 0; i < 80; i += 1) {
      rig.beginDrag();
      rig.orbit(0, -30);
      expect(rig.camera.position.length() - 1).toBeGreaterThanOrEqual(MIN_SPACE_ALTITUDE - 1e-9);
    }
  });

  it("a pan keeps the camera's height, and never flips the view", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const height = rig.camera.position.length();
    for (let i = 0; i < 200; i += 1) {
      const upBefore = rig.camera.up.clone();
      const lookBefore = lookOf(rig.camera);
      expect(rig.pan(i < 100 ? 37 : -11, i % 3 === 0 ? 23 : -9)).toBe(true);
      expect(rig.camera.position.length()).toBeCloseTo(height, 9);
      expect(rig.camera.up.angleTo(upBefore)).toBeLessThan(0.2);
      expect(lookOf(rig.camera).angleTo(lookBefore)).toBeLessThan(0.2);
    }
  });

  it("a pan slides the surface with the pointer", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const pole = new THREE.Vector3(0, -1, 0);
    const before = screen(rig, pole);
    rig.pan(30, 0);
    const mid = screen(rig, pole);
    expect(mid.x - before.x).toBeGreaterThan(20);
    expect(Math.abs(mid.y - before.y)).toBeLessThan(3);
    rig.pan(0, 30);
    const after = screen(rig, pole);
    expect(after.y - mid.y).toBeGreaterThan(20);
  });
});

describe("zoom toward the pointer", () => {
  it("keeps the surface point under the pointer fixed on screen, down to the 60 km limit", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const ndc = { x: 0.18, y: -0.12 };
    const c = rig.camera;
    c.updateMatrixWorld();
    const ray = new THREE.Vector3(ndc.x, ndc.y, 1).applyMatrix4(c.projectionMatrixInverse).normalize().transformDirection(c.matrixWorld);
    const b = c.position.dot(ray);
    const hit = c.position.clone().addScaledVector(ray, -b - Math.sqrt(b * b - (c.position.lengthSq() - 1)));
    const before = screen(rig, hit);
    for (let i = 0; i < 60; i += 1) {
      rig.zoom(0.8, ndc);
      const now = screen(rig, hit);
      expect(Math.hypot(now.x - before.x, now.y - before.y)).toBeLessThan(0.01);
      expect(c.position.length() - 1).toBeGreaterThanOrEqual(MIN_SPACE_ALTITUDE - 1e-12);
    }
    expect(c.position.distanceTo(hit)).toBeLessThan(MIN_SPACE_ALTITUDE * 1.5);
    for (let i = 0; i < 60; i += 1) rig.zoom(1.25, ndc);
    const out = screen(rig, hit);
    expect(Math.hypot(out.x - before.x, out.y - before.y)).toBeLessThan(0.01);
  });

  it("zooming toward another spot lets go of the preset's point", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    rig.focus = new THREE.Vector3(0, -1, 0);
    rig.zoom(0.8, { x: 0.3, y: 0.2 });
    expect(rig.focus).toBeNull();
  });

  it("a double-click centres the spot and moves in on it", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    expect(rig.focusOn({ x: 0.2, y: 0.1 }, 0)).toBe(true);
    const look = lookOf(rig.camera);
    const centre = systemPivot(rig.camera.position, look, null).surface;
    expect(centre.distanceTo(rig.focus!)).toBeLessThan(1e-6);
    expect(rig.camera.position.length() - 1).toBeLessThan(CAP_HALF * 6);
    const far = makeRig("system", homePose(subjects, space));
    expect(far.focusOn({ x: 0.99, y: 0.99 }, 0)).toBe(false);
  });
});

describe("the South pole preset", () => {
  it("frames the cap poleward of about 80°S inside the free space, straight below the pole", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    rig.camera.updateMatrixWorld();
    for (const angle of [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2]) {
      const edge = new THREE.Vector3(Math.cos(angle) * Math.sin(CAP_HALF), -Math.cos(CAP_HALF), Math.sin(angle) * Math.sin(CAP_HALF));
      const s = screen(rig, edge);
      expect(s.x).toBeGreaterThan(space.x);
      expect(s.x).toBeLessThan(space.x + space.width);
      expect(s.y).toBeGreaterThan(space.y);
      expect(s.y).toBeLessThan(space.y + space.height);
    }
    const pole = screen(rig, new THREE.Vector3(0, -1, 0));
    expect(pole.x).toBeCloseTo(space.x + space.width / 2, 6);
    expect(pole.y).toBeCloseTo(space.y + space.height / 2, 6);
  });
});
