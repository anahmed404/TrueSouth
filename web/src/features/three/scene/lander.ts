import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type { V3 } from "./vec";

/**
 * Pip, the Academy's small solar-powered lander (docs/academy/overview.md), built in code
 * from a few simple shapes: a squat body, four legs with footpads, one solar panel and a
 * small dish. Generic on purpose: it copies no real mission's lander.
 *
 * Units are metres in the lander's own frame: +y is up, −z is north, +x is east. The solar
 * panel's face is its local +z; the dish's axis is its local +z. `aimLander` turns them to
 * the Sun's and Earth's directions. Those directions are the ones the sight-lines use; the
 * model never decides lit or link.
 */

/**
 * Pip's paint: neutral greys, a restrained Sun-cream panel and an Earth-blue dish. The world
 * passes the theme's tones (theme.css `--terrain-rim`, `--sun`, `--earth`); the scene's own
 * light then shades them.
 */
export type LanderPalette = { grey: THREE.Color; sun: THREE.Color; earth: THREE.Color };

const DEFAULT_PALETTE: LanderPalette = {
  grey: new THREE.Color(0xa8a8af),
  sun: new THREE.Color(0xffe2a0),
  earth: new THREE.Color(0x6cc4ff),
};

let BODY = new THREE.Color();
let FOIL = new THREE.Color();
let LEG = new THREE.Color();
let PANEL = new THREE.Color();
let DISH = new THREE.Color();

function setPaint(palette: LanderPalette): void {
  BODY = palette.grey.clone().multiplyScalar(0.8);
  FOIL = palette.grey.clone().lerp(palette.sun, 0.12).multiplyScalar(0.9);
  LEG = palette.grey.clone().multiplyScalar(0.6);
  PANEL = palette.sun.clone().multiplyScalar(0.62);
  DISH = palette.earth.clone().multiplyScalar(0.65);
}

/** Pip's real size: about 2.2 m to the top of its mast. */
export const LANDER_HEIGHT_M = 2.2;
/** Where the panel and dish pivots sit on the body, in metres. */
const PANEL_PIVOT: V3 = [0, 1.9, 0.2];
const DISH_PIVOT: V3 = [0.45, 1.75, -0.35];

function painted(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.BufferGeometry {
  const g = geometry.index ? geometry.toNonIndexed() : geometry;
  geometry.dispose();
  g.deleteAttribute("uv");
  const count = g.getAttribute("position").count;
  const colors = new Float32Array(count * 3);
  for (let i = 0; i < count; i += 1) {
    colors[i * 3] = color.r;
    colors[i * 3 + 1] = color.g;
    colors[i * 3 + 2] = color.b;
  }
  g.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return g;
}

function placed(geometry: THREE.BufferGeometry, x: number, y: number, z: number, rotate?: THREE.Euler) {
  if (rotate) geometry.applyMatrix4(new THREE.Matrix4().makeRotationFromEuler(rotate));
  geometry.translate(x, y, z);
  return geometry;
}

function bodyGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  // The squat body: a low octagonal drum on its legs, with a foil-coloured deck.
  parts.push(painted(placed(new THREE.CylinderGeometry(0.62, 0.68, 0.62, 8), 0, 0.95, 0), BODY));
  parts.push(painted(placed(new THREE.CylinderGeometry(0.5, 0.62, 0.12, 8), 0, 1.32, 0), FOIL));
  // Four splayed legs with round footpads.
  for (let i = 0; i < 4; i += 1) {
    const a = Math.PI / 4 + (i * Math.PI) / 2;
    const top = new THREE.Vector3(Math.cos(a) * 0.55, 0.85, Math.sin(a) * 0.55);
    const foot = new THREE.Vector3(Math.cos(a) * 1.05, 0.08, Math.sin(a) * 1.05);
    const mid = top.clone().add(foot).multiplyScalar(0.5);
    const length = top.distanceTo(foot);
    const leg = new THREE.CylinderGeometry(0.035, 0.035, length, 5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), top.clone().sub(foot).normalize());
    leg.applyQuaternion(q);
    leg.translate(mid.x, mid.y, mid.z);
    parts.push(painted(leg, LEG));
    parts.push(painted(placed(new THREE.CylinderGeometry(0.16, 0.18, 0.05, 8), foot.x, 0.03, foot.z), LEG));
  }
  // The masts for the panel and the dish.
  parts.push(painted(placed(new THREE.CylinderGeometry(0.03, 0.03, PANEL_PIVOT[1] - 1.3, 5), PANEL_PIVOT[0], (PANEL_PIVOT[1] + 1.3) / 2, PANEL_PIVOT[2]), LEG));
  parts.push(painted(placed(new THREE.CylinderGeometry(0.025, 0.025, DISH_PIVOT[1] - 1.3, 5), DISH_PIVOT[0], (DISH_PIVOT[1] + 1.3) / 2, DISH_PIVOT[2]), LEG));
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/** The solar panel, facing its local +z, centred on its pivot. */
function panelGeometry(): THREE.BufferGeometry {
  const parts = [
    painted(new THREE.BoxGeometry(1.5, 0.9, 0.035), PANEL),
    painted(placed(new THREE.BoxGeometry(0.05, 0.05, 0.18), 0, 0, -0.1), LEG),
  ];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

/** The dish, its axis along local +z, centred on its pivot. */
function dishGeometry(): THREE.BufferGeometry {
  // An open shallow cone (the bowl), a feed rod and a back strut.
  const bowl = new THREE.ConeGeometry(0.28, 0.12, 12, 1, true);
  bowl.rotateX(-Math.PI / 2);
  bowl.translate(0, 0, 0.06);
  const parts = [
    painted(bowl, DISH),
    painted(placed(new THREE.CylinderGeometry(0.012, 0.012, 0.26, 4), 0, 0, 0.13, new THREE.Euler(Math.PI / 2, 0, 0)), LEG),
    painted(placed(new THREE.CylinderGeometry(0.03, 0.03, 0.12, 5), 0, 0, -0.04, new THREE.Euler(Math.PI / 2, 0, 0)), LEG),
  ];
  const merged = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  return merged;
}

export type Lander = {
  group: THREE.Group;
  panel: THREE.Mesh;
  dish: THREE.Mesh;
  triangles: number;
  dispose: () => void;
};

/** Builds Pip with one shared material. */
export function createLander(material: THREE.Material, palette: LanderPalette = DEFAULT_PALETTE): Lander {
  setPaint(palette);
  const group = new THREE.Group();
  group.name = "pip";
  const body = new THREE.Mesh(bodyGeometry(), material);
  const panel = new THREE.Mesh(panelGeometry(), material);
  const dish = new THREE.Mesh(dishGeometry(), material);
  panel.position.set(...PANEL_PIVOT);
  dish.position.set(...DISH_PIVOT);
  for (const mesh of [body, panel, dish]) {
    mesh.frustumCulled = false;
    group.add(mesh);
  }
  const triangles = [body, panel, dish].reduce((n, mesh) => n + mesh.geometry.getAttribute("position").count / 3, 0);
  return {
    group,
    panel,
    dish,
    triangles,
    dispose: () => {
      for (const mesh of [body, panel, dish]) mesh.geometry.dispose();
    },
  };
}

const Z = new THREE.Vector3(0, 0, 1);

/**
 * Stands Pip at a site and points it: the body upright along the site's up with its −z to
 * the north, the panel's face along the Sun's direction and the dish's axis along Earth's.
 * All three directions are scene unit vectors. Call `group.updateMatrixWorld()` after.
 */
export function aimLander(lander: Lander, up: V3, north: V3, sunDir: V3, earthDir: V3): void {
  const u = new THREE.Vector3(...up).normalize();
  const n = new THREE.Vector3(...north).normalize();
  const e = new THREE.Vector3().crossVectors(n, u).normalize();
  // Columns: local +x = east, +y = up, +z = south.
  const basis = new THREE.Matrix4().makeBasis(e, u, n.clone().negate());
  lander.group.quaternion.setFromRotationMatrix(basis);
  const inverse = lander.group.quaternion.clone().invert();
  for (const [mesh, dir] of [
    [lander.panel, sunDir],
    [lander.dish, earthDir],
  ] as const) {
    const local = new THREE.Vector3(...dir).normalize().applyQuaternion(inverse);
    mesh.quaternion.setFromUnitVectors(Z, local);
  }
}

/** The world direction a part faces (its local +z) and its world centre. */
export function partAxis(mesh: THREE.Object3D): { axis: THREE.Vector3; centre: THREE.Vector3 } {
  mesh.updateWorldMatrix(true, false);
  const q = new THREE.Quaternion();
  mesh.getWorldQuaternion(q);
  return { axis: Z.clone().applyQuaternion(q).normalize(), centre: mesh.getWorldPosition(new THREE.Vector3()) };
}
