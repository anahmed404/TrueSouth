import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import { siteFrameScene, siteGroundScene } from "../../../lib/geo";
import { MIN_SPACE_ALTITUDE, eyePose, homePose, terrainPose, type Pose, type SiteFrame, type Subjects } from "./camera";
import { CAP_HALF, FAR_DISTANCE, NEAR_DISTANCE, focusWeight, lookOf, southPolePose, systemPivot, upOf } from "./navigate";
import { ORBIT_STYLE, Rig } from "./rig";

const space: FreeSpace = { x: 336, y: 120, width: 728, height: 560, viewport: { width: 1440, height: 900 }, windowOpen: false };
const subjects: Subjects = {
  earth: { centre: [2.5, 0, 0], radius: 0.4 },
  sun: { dir: [-1, 0, 0], centre: [-2.5, 0, 0], radius: 0.12 },
};

/** Far out under the south pole with the Moon centred, turned as home is: where the trackball tests start. */
function moonCentred(): Pose {
  return { pos: [0, -12, 0], look: [0, 1, 0], up: homePose(subjects, space).up, fov: 30 };
}

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

/** The surface point under a point of the view (normalised device coordinates), or null. */
function surfaceAt(rig: Rig, ndcX: number, ndcY: number): THREE.Vector3 | null {
  const c = rig.camera;
  c.updateMatrixWorld();
  const dir = new THREE.Vector3(ndcX, ndcY, 1).applyMatrix4(c.projectionMatrixInverse).normalize().transformDirection(c.matrixWorld);
  const b = c.position.dot(dir);
  const disc = b * b - (c.position.lengthSq() - 1);
  if (disc < 0) return null;
  return c.position.clone().addScaledVector(dir, -b - Math.sqrt(disc));
}

/** The surface point a quarter of the way from the centre of the view to its foot. */
function frontPoint(rig: Rig): THREE.Vector3 {
  const p = surfaceAt(rig, 0, -0.25) ?? surfaceAt(rig, 0, 0);
  if (!p) throw new Error("no surface in view");
  return p;
}

/** Drags once and reports how a scene point moved on screen. */
function dragMoves(rig: Rig, point: THREE.Vector3, dx: number, dy: number): { x: number; y: number } {
  const before = screen(rig, point);
  rig.beginDrag();
  rig.orbit(dx, dy);
  const after = screen(rig, point);
  return { x: after.x - before.x, y: after.y - before.y };
}

/** A System view camera at `distance` above the surface in direction `dir`, looking at the Moon's centre, rolled by `rollDeg`. */
function systemAt(dir: THREE.Vector3, distance: number, rollDeg: number): Rig {
  const d = dir.clone().normalize();
  const look = d.clone().negate();
  const ref = Math.abs(d.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const up = ref.addScaledVector(look, -ref.dot(look)).normalize().applyAxisAngle(look, THREE.MathUtils.degToRad(rollDeg));
  const pos = d.multiplyScalar(1 + distance);
  return makeRig("system", { pos: [pos.x, pos.y, pos.z], look: [look.x, look.y, look.z], up: [up.x, up.y, up.z], fov: 30 });
}

function cosToDrag(moved: { x: number; y: number }, dx: number, dy: number): number {
  return (moved.x * dx + moved.y * dy) / (Math.hypot(moved.x, moved.y) * Math.hypot(dx, dy));
}

const frame: SiteFrame = { ground: siteGroundScene(-89.45, -137.31, 1_900), ...siteFrameScene(-89.45, -137.31) };

const directions = [
  [20, 0],
  [-20, 0],
  [0, 20],
  [0, -20],
] as const;

describe("each view's drag is a per-view setting", () => {
  it("the System view turns freely, the ground views keep their limits, the Polar map stays put", () => {
    expect(ORBIT_STYLE.system).toBe("free");
    expect(ORBIT_STYLE.terrain).toBe("site");
    expect(ORBIT_STYLE.panorama).toBe("look");
    expect(ORBIT_STYLE.map).toBe("none");
  });
});

describe("the System view's drag is a free trackball: the surface moves the way the pointer moves", () => {
  const places = [
    new THREE.Vector3(0, -1, 0), // straight below the south pole: the pole in the middle
    new THREE.Vector3(0, 1, 0), // over the north pole
    new THREE.Vector3(1, 0, 0), // the equator
    new THREE.Vector3(0.3, -0.8, 0.5),
    new THREE.Vector3(-0.6, 0.4, -0.7),
  ];
  // Distances where the pivot lies behind the centred surface point, and every roll, so the
  // pole sits up, down, sideways and in the middle of the screen.
  for (const distance of [1, 3, 11]) {
    for (const roll of [0, 90, 180, 270, 37]) {
      it(`at ${distance} Moon radii, rolled ${roll}°: within 20° of the drag, never reversed`, () => {
        for (const place of places) {
          for (const [dx, dy] of directions) {
            const rig = systemAt(place, distance, roll);
            const moved = dragMoves(rig, surfaceAt(rig, 0, 0)!, dx, dy);
            expect(Math.hypot(moved.x, moved.y)).toBeGreaterThan(0.5);
            expect(cosToDrag(moved, dx, dy)).toBeGreaterThan(Math.cos(THREE.MathUtils.degToRad(20)));
          }
        }
      });
    }
  }

  it("after pans that put the pole to the side, a sideways drag still moves the surface sideways", () => {
    const rig = makeRig("system", moonCentred());
    for (let i = 0; i < 40; i += 1) rig.pan(25, 0);
    for (let i = 0; i < 25; i += 1) rig.pan(0, 25);
    for (const [dx, dy] of directions) {
      const moved = dragMoves(rig, surfaceAt(rig, 0, 0) ?? frontPoint(rig), dx, dy);
      expect(cosToDrag(moved, dx, dy)).toBeGreaterThan(Math.cos(THREE.MathUtils.degToRad(20)));
    }
  });

  it("after zooming in close, the surface in front of the pivot follows the drag", () => {
    const rig = systemAt(new THREE.Vector3(0.2, -1, 0.1), 0.2, 30);
    rig.beginDrag();
    rig.orbit(0, -40); // tilt first, so there is a front
    for (const [dx, dy] of directions) {
      const moved = dragMoves(rig, frontPoint(rig), dx, dy);
      expect(moved.x * dx + moved.y * dy).toBeGreaterThan(0);
    }
  });

  for (const [name, dx, dy] of [
    ["upward", 0, -24],
    ["sideways", 24, 0],
    ["diagonally", 17, -17],
  ] as const) {
    it(`a steady drag ${name} goes right round the Moon and back to the start, with no step held back`, () => {
      const rig = makeRig("system", moonCentred());
      const start = rig.camera.position.clone();
      const radius = start.length();
      let previous = start.clone();
      let lastStep = 0;
      let turned = 0;
      let steps = 0;
      let north = false;
      let south = false;
      while (turned < 2 * Math.PI && steps < 5_000) {
        rig.beginDrag();
        rig.orbit(dx, dy);
        const now = rig.camera.position.clone();
        const step = now.angleTo(previous);
        expect(Number.isFinite(now.x + now.y + now.z)).toBe(true);
        expect(step).toBeGreaterThan(1e-4); // never held back
        expect(step).toBeLessThan(0.25); // at most 24 px at the far rate (0.01 rad a pixel)
        if (lastStep > 0) expect(Math.abs(step - lastStep)).toBeLessThan(lastStep * 0.05); // steady: no jump
        lastStep = step;
        expect(now.length()).toBeCloseTo(radius, 6); // far out: the turn is about the centre
        turned += step;
        previous = now;
        steps += 1;
        const y = now.clone().normalize().y;
        if (y > 0.99) north = true;
        if (y < -0.99) south = true;
      }
      expect(turned).toBeGreaterThanOrEqual(2 * Math.PI);
      // Home starts straight below the south pole; a vertical turn passes over the north pole too.
      expect(south).toBe(true);
      if (name === "upward") expect(north).toBe(true);
      // Back where it started, within the one step that passed a full turn.
      expect(rig.camera.position.angleTo(start)).toBeLessThan(lastStep + 1e-6);
    });
  }

  it("is fine exactly over a pole: no NaN, and every direction turns", () => {
    for (const pole of [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0)]) {
      for (const [dx, dy] of directions) {
        const rig = systemAt(pole, 2.5, 0);
        const before = rig.camera.position.clone();
        rig.beginDrag();
        rig.orbit(dx, dy);
        const p = rig.camera.position;
        expect(Number.isFinite(p.x + p.y + p.z)).toBe(true);
        expect(rig.camera.quaternion.toArray().every(Number.isFinite)).toBe(true);
        expect(p.distanceTo(before)).toBeGreaterThan(1e-3);
      }
    }
  });

  it("close in, a turn never takes the camera below the 60 km floor: it slides along it", () => {
    const rig = systemAt(new THREE.Vector3(0, -1, 0), 0.05, 0);
    for (let i = 0; i < 400; i += 1) {
      rig.beginDrag();
      rig.orbit(i % 2 ? 30 : 0, -30);
      expect(rig.camera.position.length() - 1).toBeGreaterThanOrEqual(MIN_SPACE_ALTITUDE - 1e-12);
      expect(Number.isFinite(rig.camera.position.x)).toBe(true);
    }
  });
});

describe("the ground views keep their limits and follow the same grab rule", () => {
  it("Local terrain: the ground nearest the viewer follows the pointer both ways", () => {
    const rig = makeRig("terrain", terrainPose(frame, 30, 200));
    rig.site = frame;
    expect(dragMoves(rig, frontPoint(rig), 20, 0).x).toBeGreaterThan(1);
    expect(dragMoves(rig, frontPoint(rig), -20, 0).x).toBeLessThan(-1);
    expect(dragMoves(rig, frontPoint(rig), 0, 20).y).toBeGreaterThan(0.5);
  });

  it("Local terrain cannot look from under the ground", () => {
    const rig = makeRig("terrain", terrainPose(frame, 30, 200));
    rig.site = frame;
    const up = new THREE.Vector3(...frame.up);
    const ground = new THREE.Vector3(...frame.ground);
    for (let i = 0; i < 50; i += 1) rig.orbit(0, -40);
    const elevation = Math.asin(rig.camera.position.clone().sub(ground).normalize().dot(up));
    expect(THREE.MathUtils.radToDeg(elevation)).toBeGreaterThanOrEqual(6 - 1e-6);
  });

  it("Lander's eye: the scene ahead follows the pointer, and the horizon stays level", () => {
    const rig = makeRig("panorama", eyePose(frame, 120, 10));
    rig.site = frame;
    const ahead = () => rig.camera.position.clone().addScaledVector(lookOf(rig.camera), 1e-3);
    expect(dragMoves(rig, ahead(), 20, 0).x).toBeGreaterThan(1);
    expect(dragMoves(rig, ahead(), -20, 0).x).toBeLessThan(-1);
    expect(dragMoves(rig, ahead(), 0, 20).y).toBeGreaterThan(1);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(rig.camera.quaternion);
    expect(Math.abs(right.dot(new THREE.Vector3(...frame.up)))).toBeLessThan(1e-9);
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

describe("the System view's pivot never jumps", () => {
  const look = new THREE.Vector3(0, 1, 0);

  it("far out it is the Moon's centre; close in, the point at the centre of the view", () => {
    expect(systemPivot(new THREE.Vector3(0, -12, 0), look).point.length()).toBeLessThan(1e-12);
    const position = new THREE.Vector3(0.05, -1.3, 0.02);
    const toward = new THREE.Vector3(0, -1, 0).sub(position).normalize();
    const pivot = systemPivot(position, toward);
    expect(pivot.w).toBe(1);
    expect(pivot.point.length()).toBeCloseTo(1, 9);
    expect(pivot.point.clone().sub(position).normalize().dot(toward)).toBeCloseTo(1, 9);
  });

  it("the preset's point counts while centred and facing the camera, and is gone past its horizon", () => {
    const pole = new THREE.Vector3(0, -1, 0);
    expect(focusWeight(pole, new THREE.Vector3(0, -2, 0), look)).toBe(1);
    expect(focusWeight(pole, new THREE.Vector3(3, 0, 0), new THREE.Vector3(-1, 0, 0))).toBe(0);
  });

  /** Walks the camera along a path in small steps; returns the largest step of the pivot point. */
  function worstStep(path: (t: number) => { position: THREE.Vector3; look: THREE.Vector3 }, focus: THREE.Vector3 | null): number {
    let previous: THREE.Vector3 | null = null;
    let worst = 0;
    for (let t = 0; t <= 1 + 1e-9; t += 0.0005) {
      const { position, look: l } = path(t);
      const point = systemPivot(position, l, focus).point;
      if (previous) worst = Math.max(worst, point.distanceTo(previous));
      previous = point;
    }
    return worst;
  }

  it("coming in through the blend zone", () => {
    const step = worstStep((t) => {
      const d = FAR_DISTANCE + 1 - t * (FAR_DISTANCE + 1 - NEAR_DISTANCE / 4);
      return { position: new THREE.Vector3(0.01, -(1 + d), 0), look };
    }, null);
    expect(step).toBeLessThan(0.01);
  });

  it("crossing the equator inside the blend zone (where the old axis flipped)", () => {
    const step = worstStep((t) => {
      const a = -0.5 + t;
      const position = new THREE.Vector3(Math.cos(a), Math.sin(a), 0).multiplyScalar(1 + 1.2);
      return { position, look: position.clone().negate().normalize() };
    }, null);
    expect(step).toBeLessThan(0.01);
  });

  it("zooming out from a followed site, and turning past its horizon (where the old focus snapped)", () => {
    const site = new THREE.Vector3(...frame.up);
    const out = worstStep((t) => ({ position: site.clone().multiplyScalar(1 + 0.2 + t * 3), look: site.clone().negate() }), site);
    expect(out).toBeLessThan(0.01);
    const around = worstStep((t) => {
      const position = site.clone().applyAxisAngle(new THREE.Vector3(1, 0, 0), t * 2.4).multiplyScalar(1 + 2.8);
      return { position, look: position.clone().negate().normalize() };
    }, site);
    expect(around).toBeLessThan(0.01);
  });

  it("panning the preset's point off the centre of the view", () => {
    const pole = new THREE.Vector3(0, -1, 0);
    const step = worstStep((t) => {
      // Stops short of where the look ray grazes the limb (tested on its own below).
      const position = new THREE.Vector3(0, -(1 + 0.4), 0).applyAxisAngle(new THREE.Vector3(1, 0, 0), t * 0.6);
      return { position, look };
    }, pole);
    expect(step).toBeLessThan(0.01);
  });

  it("the look ray sliding off the limb", () => {
    const position = new THREE.Vector3(0, 0, 3);
    const limb = Math.asin(1 / 3);
    const step = worstStep((t) => {
      const a = limb - 0.002 + t * 0.004;
      return { position, look: new THREE.Vector3(Math.sin(a), 0, -Math.cos(a)) };
    }, null);
    expect(step).toBeLessThan(0.05);
  });
});

describe("pan", () => {
  it("keeps the camera's height, and never flips the view", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const height = rig.camera.position.length();
    for (let i = 0; i < 200; i += 1) {
      const upBefore = upOf(rig.camera);
      const lookBefore = lookOf(rig.camera);
      expect(rig.pan(i < 100 ? 37 : -11, i % 3 === 0 ? 23 : -9)).toBe(true);
      expect(rig.camera.position.length()).toBeCloseTo(height, 9);
      expect(upOf(rig.camera).angleTo(upBefore)).toBeLessThan(0.2);
      expect(lookOf(rig.camera).angleTo(lookBefore)).toBeLessThan(0.2);
    }
  });

  it("slides the surface with the pointer", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const pole = new THREE.Vector3(0, -1, 0);
    const before = screen(rig, pole);
    rig.pan(30, 0);
    const mid = screen(rig, pole);
    expect(mid.x - before.x).toBeGreaterThan(20);
    expect(Math.abs(mid.y - before.y)).toBeLessThan(3);
    rig.pan(0, 30);
    expect(screen(rig, pole).y - mid.y).toBeGreaterThan(20);
  });
});

describe("zoom toward the pointer", () => {
  it("keeps the surface point under the pointer fixed on screen, down to the 60 km limit", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    const ndc = { x: 0.18, y: -0.12 };
    const hit = surfaceAt(rig, ndc.x, ndc.y)!;
    const before = screen(rig, hit);
    for (let i = 0; i < 60; i += 1) {
      rig.zoom(0.8, ndc);
      const now = screen(rig, hit);
      expect(Math.hypot(now.x - before.x, now.y - before.y)).toBeLessThan(0.01);
      expect(rig.camera.position.length() - 1).toBeGreaterThanOrEqual(MIN_SPACE_ALTITUDE - 1e-12);
    }
    expect(rig.camera.position.distanceTo(hit)).toBeLessThan(MIN_SPACE_ALTITUDE * 1.5);
    for (let i = 0; i < 60; i += 1) rig.zoom(1.25, ndc);
    const out = screen(rig, hit);
    expect(Math.hypot(out.x - before.x, out.y - before.y)).toBeLessThan(0.01);
  });

  it("zooming out with the minus key from a followed site, then dragging, moves smoothly", () => {
    const site = new THREE.Vector3(...frame.up);
    const pos = site.clone().multiplyScalar(1.3);
    const lk = site.clone().negate();
    const rig = makeRig("system", { pos: [pos.x, pos.y, pos.z], look: [lk.x, lk.y, lk.z], up: [1, 0, 0], fov: 30 });
    rig.focus = site.clone();
    let previous = rig.camera.position.clone();
    for (let i = 0; i < 30; i += 1) {
      rig.zoom(1.25);
      rig.beginDrag();
      rig.orbit(12, 0);
      const now = rig.camera.position.clone();
      // A zoom step moves 25 % of the distance at most, plus a small turn: never a jump.
      expect(now.distanceTo(previous)).toBeLessThan(previous.length() * 0.45);
      previous = now;
    }
  });

  it("a double-click centres the spot and moves in on it; empty space is not a spot", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
    expect(rig.focusOn({ x: 0.2, y: 0.1 }, 0)).toBe(true);
    const centre = systemPivot(rig.camera.position, lookOf(rig.camera), null).surface;
    expect(centre.distanceTo(rig.focus!)).toBeLessThan(1e-6);
    expect(rig.camera.position.length() - 1).toBeLessThan(CAP_HALF * 6);
    const far = makeRig("system", homePose(subjects, space));
    expect(far.focusOn({ x: 0.99, y: 0.99 }, 0)).toBe(false);
  });
});

describe("the South pole preset", () => {
  it("frames the cap poleward of about 80°S inside the free space, straight below the pole, level", () => {
    const rig = makeRig("system", southPolePose(subjects, space));
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
    expect(upOf(rig.camera).angleTo(new THREE.Vector3(...homePose(subjects, space).up))).toBeLessThan(1e-9);
  });
});
