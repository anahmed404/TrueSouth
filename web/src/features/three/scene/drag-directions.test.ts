import * as THREE from "three";
import { describe, expect, it } from "vitest";
import type { FreeSpace } from "../../../app/scene";
import { siteFrameScene, siteGroundScene } from "../../../lib/geo";
import { eyePose, followSitePose, homePose, terrainPose, type Pose, type SiteFrame } from "./camera";
import { PointerTracker, type Command } from "./pointers";
import { Rig } from "./rig";
import { slipPose } from "./slip";

/**
 * The contract (docs/features/system-view.md, "Camera"): the picture follows the pointer.
 * A drag of +dx moves what was under the pointer to the right on screen, +dy moves it down,
 * in every view and for every drag input. For an orbit about a point (the Slip Planner,
 * Local terrain) "what was under the pointer" is the ground nearest the viewer, below the
 * point the orbit turns about; for Lander's eye (a look-around) it is the scene far ahead.
 * One deliberate exception, from the team's testing: in Lander's eye a vertical drag looks
 * the way of the drag (drag up, look up), so the scene ahead moves against the pointer.
 * Arrow keys are a 24 px drag the other way (scene-root.tsx): the camera moves the arrow's
 * way, so the picture moves the other way, as on a map.
 */

const space: FreeSpace = { x: 288, y: 131, width: 793, height: 424, viewport: { width: 1440, height: 900 }, windowOpen: false };
const frame: SiteFrame = { ground: siteGroundScene(-89.45, -137.31, 1_900), ...siteFrameScene(-89.45, -137.31) };
const slip = slipPose([{ latDeg: -89.45, lonDeg: -137.31 }, { latDeg: -86, lonDeg: 0 }], space);

type View = {
  name: string;
  mode: Rig["mode"];
  pose: () => Pose;
  probe: "surface-front" | "ground-front" | "far-ahead";
  /** True where a vertical drag looks the way of the drag: Lander's eye only. */
  verticalLooks?: boolean;
};
const views: View[] = [
  { name: "System view", mode: "system", pose: () => homePose({ earth: { centre: [3, 0, 0], radius: 1 }, sun: { dir: [0, 0, 1], centre: [0, 0, 29], radius: 3.5 } }, space), probe: "surface-front" },
  { name: "Follow site", mode: "system", pose: () => followSitePose(frame.up, frame.north, space), probe: "surface-front" },
  { name: "Slip Planner", mode: "slip", pose: () => slip, probe: "ground-front" },
  { name: "Local terrain", mode: "terrain", pose: () => terrainPose(frame, 30, 200), probe: "ground-front" },
  { name: "Lander's eye", mode: "panorama", pose: () => eyePose(frame, 120, 5), probe: "far-ahead", verticalLooks: true },
];

/** The inputs that turn the view, as the pointer tracker turns them into commands. */
type Input = { name: string; drag: (t: PointerTracker, dx: number, dy: number) => Command[] };
const pointerDrag = (kind: "mouse" | "touch", button: number, buttons: number, shift = false) => (t: PointerTracker, dx: number, dy: number) => {
  const out: Command[] = [...t.down(1, 700, 400, kind, button, shift, 0)];
  for (let i = 1; i <= 4; i += 1) out.push(...t.move(1, 700 + (dx * i) / 4, 400 + (dy * i) / 4, buttons, shift));
  out.push(...t.up(1, 700 + dx, 400 + dy, 1_000));
  return out;
};
const inputs: Input[] = [
  { name: "left button", drag: pointerDrag("mouse", 0, 1) },
  { name: "middle button", drag: pointerDrag("mouse", 1, 4) },
  { name: "one finger", drag: pointerDrag("touch", 0, 1) },
  // The right button and Shift slide the System view; in a view with no slide they turn, by the same rule.
  { name: "right button", drag: pointerDrag("mouse", 2, 2) },
  { name: "Shift + left button", drag: pointerDrag("mouse", 0, 1, true) },
];

function rigFor(view: View): Rig {
  const rig = new Rig(new THREE.PerspectiveCamera(30, 1440 / 900, 1e-9, 5000));
  rig.setFreeSpace(space, 0);
  rig.mode = view.mode;
  rig.apply(view.pose());
  rig.site = frame;
  if (view.mode === "slip") rig.slipCentre = { centre: slip.centre, up0: slip.up0 };
  rig.orbit(0, 0); // the orbit views settle their aim on the point they turn about
  return rig;
}

/** Runs commands the way scene-root.tsx does. */
function run(rig: Rig, commands: Command[]): void {
  for (const c of commands) {
    if (c.type === "begin") rig.beginDrag();
    else if (c.type === "orbit") rig.orbit(c.dx, c.dy);
    else if (c.type === "pan") {
      if (!rig.pan(c.dx, c.dy) && c.orFallback) rig.orbit(c.dx, c.dy);
    }
  }
}

function screen(rig: Rig, p: THREE.Vector3): { x: number; y: number } {
  rig.camera.updateMatrixWorld();
  const q = p.clone().project(rig.camera);
  return { x: ((q.x + 1) / 2) * 1440, y: ((1 - q.y) / 2) * 900 };
}

/** The point the user grabbed: see the contract above. */
function grabbed(rig: Rig, probe: View["probe"]): THREE.Vector3 {
  const c = rig.camera;
  c.updateMatrixWorld();
  const ray = (y: number) => new THREE.Vector3(0, y, 1).applyMatrix4(c.projectionMatrixInverse).normalize().transformDirection(c.matrixWorld);
  if (probe === "far-ahead") return c.position.clone().addScaledVector(ray(-0.2), 1e-3);
  if (probe === "surface-front") {
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(c.quaternion);
    return c.position.clone().normalize().applyAxisAngle(right, 0.35);
  }
  const dir = ray(-0.45);
  const b = c.position.dot(dir);
  return c.position.clone().addScaledVector(dir, -b - Math.sqrt(b * b - (c.position.lengthSq() - 1)));
}

describe("the picture follows the pointer in every view, for every drag input", () => {
  for (const view of views) {
    for (const input of inputs) {
      for (const [label, dx, dy] of [
        ["right", 24, 0],
        ["left", -24, 0],
        ["down", 0, 24],
        ["up", 0, -24],
      ] as const) {
        const looks = dy !== 0 && view.verticalLooks === true;
        it(`${view.name}, ${input.name}, drag ${label}: ${looks ? `the view looks ${label}` : `what was under the pointer moves ${label}`}`, () => {
          const rig = rigFor(view);
          const point = grabbed(rig, view.probe);
          const before = screen(rig, point);
          run(rig, input.drag(new PointerTracker(), dx, dy));
          const after = screen(rig, point);
          // Looking up moves the scene ahead down the screen, so the sign is the other way.
          const along = (dx !== 0 ? (after.x - before.x) * Math.sign(dx) : (after.y - before.y) * Math.sign(dy)) * (looks ? -1 : 1);
          const across = dx !== 0 ? after.y - before.y : after.x - before.x;
          expect(along).toBeGreaterThan(0.5);
          expect(along).toBeLessThan(500);
          expect(Math.abs(across)).toBeLessThan(along);
        });
      }
    }
  }

  it("arrow keys (a 24 px drag the other way) move the camera the arrow's way in every view", () => {
    // scene-root.tsx: ArrowLeft is orbit(24, 0), ArrowRight orbit(−24, 0), ArrowUp orbit(0, 24), ArrowDown orbit(0, −24).
    for (const view of views) {
      const rig = rigFor(view);
      const point = grabbed(rig, view.probe);
      const before = screen(rig, point);
      rig.beginDrag();
      rig.orbit(24, 0); // ArrowLeft
      const after = screen(rig, point);
      expect(after.x - before.x).toBeGreaterThan(0.5); // the picture moves right, so the camera moved left
    }
  });

  it("in Lander's eye the up arrow looks up and the down arrow looks down", () => {
    // scene-root.tsx sends ArrowUp as orbit(0, 24, true) and ArrowDown as orbit(0, -24, true).
    const view = views.find((v) => v.name === "Lander's eye")!;
    const elevation = (rig: Rig) => new THREE.Vector3(0, 0, -1).applyQuaternion(rig.camera.quaternion).dot(new THREE.Vector3(...frame.up));
    const up = rigFor(view);
    const start = elevation(up);
    up.beginDrag();
    up.orbit(0, 24, true);
    expect(elevation(up)).toBeGreaterThan(start);
    const down = rigFor(view);
    down.beginDrag();
    down.orbit(0, -24, true);
    expect(elevation(down)).toBeLessThan(start);
  });

  it("the Polar map's camera does not turn: it stays a north-up map, and its flat map pans by its own drag", () => {
    const rig = new Rig(new THREE.PerspectiveCamera(30, 1440 / 900, 1e-9, 5000));
    rig.setFreeSpace(space, 0);
    rig.mode = "map";
    rig.apply(homePose({ earth: { centre: [3, 0, 0], radius: 1 }, sun: { dir: [0, 0, 1], centre: [0, 0, 29], radius: 3.5 } }, space));
    const before = rig.pose();
    run(rig, pointerDrag("mouse", 0, 1)(new PointerTracker(), 40, 30));
    expect(rig.pose()).toEqual(before);
  });
});
