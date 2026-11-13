import * as THREE from "three";
import type { CameraViewId, FreeSpace } from "../../../app/scene";
import { MOON_RADIUS_M } from "../../../lib/geo";
import { easeInOutCubic, lerpPose, MIN_SPACE_ALTITUDE, viewOffset, type Pose, type SiteFrame } from "./camera";
import { clamp, smooth } from "./vec";

/** The rig turns about the Moon in any view but Local terrain and Lander's eye. */
type Mode = CameraViewId;

type Tween = {
  from: Pose;
  to: Pose;
  t0: number;
  ms: number;
  onT?: (eased: number) => void;
  onDone?: () => void;
  /** A locked flight ignores drags, scrolls and keys; only another flight replaces it. */
  locked: boolean;
};

type Offset = { x: number; y: number; width: number; height: number };

/**
 * The System view's orbit stops short of the Moon's axis: |y| of the camera's direction at
 * most this (about 9.9° from the pole), so the view never flips over a pole.
 */
export const POLE_LIMIT_Y = 0.985;

function horizontal(v: THREE.Vector3): THREE.Vector2 {
  return new THREE.Vector2(v.x, v.z);
}

/**
 * Pitches `p` about `axis` by `angle`, within the pole limit. A step that moves away from
 * the pole is always taken, even from inside the limit (the home pose is straight below the
 * south pole). A step toward the pole stops at the limit, and no step crosses a pole.
 */
function limitPitch(p: THREE.Vector3, axis: THREE.Vector3, angle: number): THREE.Vector3 {
  const startY = Math.abs(p.clone().normalize().y);
  const startSide = horizontal(p);
  const acceptable = (v: THREE.Vector3) => {
    const side = horizontal(v);
    const crossed = startSide.lengthSq() > 1e-18 && side.lengthSq() > 1e-18 && startSide.dot(side) < 0;
    if (crossed) return false;
    const y = Math.abs(v.clone().normalize().y);
    return y <= POLE_LIMIT_Y || y < startY - 1e-12;
  };
  const full = p.clone().applyAxisAngle(axis, angle);
  if (acceptable(full)) return full;
  // Clamp: the largest part of the step that is still acceptable.
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 40; i += 1) {
    const mid = (lo + hi) / 2;
    if (acceptable(p.clone().applyAxisAngle(axis, angle * mid))) lo = mid;
    else hi = mid;
  }
  return p.clone().applyAxisAngle(axis, angle * lo);
}

/**
 * Moves the camera: eased flights between poses, the free-space offset, and the drag,
 * scroll and key controls of each camera view (docs/features/system-view.md, "Camera").
 *
 * The rule for interrupting a flight:
 * - A flight that changes the camera view (`flyToView`) cannot be interrupted by a drag, a
 *   scroll or a key: those are ignored until it lands. So the camera never rests between two
 *   views, and the Polar map's lighting blend always ends at 0 or 1.
 * - Another view pick can interrupt it: the new flight starts from where the camera is and
 *   blends on from where the lighting is. Only the last flight reports its arrival, once.
 * - A move inside a view (a preset, re-framing after panels fold) is not locked: a drag stops
 *   it where it is, which is still the same view.
 */
export class Rig {
  mode: Mode = "system";
  /** The site the Local terrain and Lander's eye controls turn about. */
  site: SiteFrame | null = null;
  trueScale = false;
  /** True once the user has turned or zoomed since the last pick. */
  userMoved = false;
  /**
   * How much the polar cap shows the map's fixed lighting instead of the real Sun: 0 or 1 at
   * rest, between only during a flight to or from the Polar map.
   */
  draw = 0;
  private tween: Tween | null = null;
  private offset: Offset | null = null;
  private offsetTween: { from: Offset; to: Offset; t0: number; ms: number } | null = null;
  private upHint: THREE.Vector3 | null = null;

  constructor(readonly camera: THREE.PerspectiveCamera) {}

  get flying(): boolean {
    return this.tween !== null;
  }

  pose(): Pose {
    const c = this.camera;
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    return { pos: [c.position.x, c.position.y, c.position.z], look: [look.x, look.y, look.z], up: [c.up.x, c.up.y, c.up.z], fov: c.fov };
  }

  apply(pose: Pose): void {
    const c = this.camera;
    c.position.set(...pose.pos);
    c.up.set(...pose.up);
    c.fov = pose.fov;
    c.lookAt(pose.pos[0] + pose.look[0], pose.pos[1] + pose.look[1], pose.pos[2] + pose.look[2]);
    c.updateProjectionMatrix();
  }

  flyTo(
    to: Pose,
    ms: number,
    onDone?: () => void,
    onT?: (eased: number) => void,
    options: { locked?: boolean; now?: number } = {},
  ): void {
    this.userMoved = false;
    if (ms <= 0) {
      this.tween = null;
      this.apply(to);
      onT?.(1);
      onDone?.();
      return;
    }
    const t0 = options.now ?? performance.now();
    this.tween = { from: this.pose(), to, t0, ms, onT, onDone, locked: options.locked ?? false };
  }

  /**
   * Flies to a camera view and reports `onArrive(view)` once it lands. Locked against drags,
   * scrolls and keys (see the rule above). The Polar map's lighting blends in over the last
   * 45 % of a flight to it, and out over the first 45 % of a flight away
   * (docs/features/system-view.md, "The polar cap overlay").
   */
  flyToView(
    view: CameraViewId,
    to: Pose,
    ms: number,
    onArrive?: (view: CameraViewId) => void,
    options: { locked?: boolean; now?: number } = {},
  ): void {
    this.mode = view;
    const fromDraw = this.draw;
    const toDraw = view === "map" ? 1 : 0;
    const onT = (t: number) => {
      this.draw = toDraw >= fromDraw ? fromDraw + (toDraw - fromDraw) * smooth(0.55, 1, t) : fromDraw * (1 - smooth(0, 0.45, t));
    };
    this.flyTo(
      to,
      ms,
      () => {
        this.draw = toDraw;
        onArrive?.(view);
      },
      onT,
      { locked: options.locked ?? true, now: options.now },
    );
  }

  /** True while a locked flight runs: drags, scrolls and keys are ignored. */
  get locked(): boolean {
    return this.tween?.locked ?? false;
  }

  /** Stops an unlocked move where it is. A locked flight carries on. */
  stop(): void {
    if (this.tween && !this.tween.locked) this.tween = null;
  }

  /** The principal point at the free space's centre, sliding there over `ms`. */
  setFreeSpace(space: FreeSpace, ms: number): void {
    const to = viewOffset(space);
    if (!this.offset || ms <= 0) {
      this.offset = to;
      this.offsetTween = null;
      this.applyOffset();
      return;
    }
    this.offsetTween = { from: { ...this.offset }, to, t0: performance.now(), ms };
  }

  private applyOffset(): void {
    const o = this.offset;
    if (!o || o.width <= 0 || o.height <= 0) return;
    this.camera.setViewOffset(o.width, o.height, o.x, o.y, o.width, o.height);
  }

  /** Advances a flight and the offset slide. Returns true while something still moves. */
  update(now: number): boolean {
    let active = false;
    if (this.offsetTween) {
      const t = clamp((now - this.offsetTween.t0) / this.offsetTween.ms, 0, 1);
      const e = 1 - (1 - t) ** 3;
      const { from, to } = this.offsetTween;
      this.offset = {
        x: from.x + (to.x - from.x) * e,
        y: from.y + (to.y - from.y) * e,
        width: to.width,
        height: to.height,
      };
      this.applyOffset();
      if (t >= 1) this.offsetTween = null;
      else active = true;
    }
    if (this.tween) {
      const tween = this.tween;
      const t = clamp((now - tween.t0) / tween.ms, 0, 1);
      const eased = easeInOutCubic(t);
      this.apply(lerpPose(tween.from, tween.to, eased));
      tween.onT?.(eased);
      if (t >= 1) {
        this.tween = null;
        tween.onDone?.();
      } else {
        active = true;
      }
    }
    return active;
  }

  // ── Controls ──────────────────────────────────────────────────────────────

  beginDrag(): void {
    if (this.locked) return;
    this.stop();
    this.upHint = this.camera.up.clone();
  }

  orbit(dx: number, dy: number): void {
    const c = this.camera;
    if (this.mode === "map" || this.locked) return;
    this.stop();
    this.userMoved = true;
    if (this.mode === "system") {
      const p = c.position.clone();
      const r = p.length();
      const yaw = -dx * 0.005;
      const pitch = -dy * 0.005;
      p.applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const right = new THREE.Vector3().crossVectors(c.up, p).normalize();
      p.copy(limitPitch(p, right, pitch));
      c.position.copy(p.setLength(r));
      const look = p.clone().negate().normalize();
      const hint = (this.upHint ?? c.up.clone()).applyAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
      const up = hint.clone().sub(look.clone().multiplyScalar(hint.dot(look)));
      if (up.lengthSq() < 1e-9) up.set(0, 0, 1);
      up.normalize();
      this.upHint = up.clone();
      c.up.copy(up);
      c.lookAt(0, 0, 0);
      return;
    }
    // Only the two ground views turn about the site; any other view keeps the camera still.
    if (this.mode !== "terrain" && this.mode !== "panorama") return;
    const site = this.site;
    if (!site) return;
    const ground = new THREE.Vector3(...site.ground);
    const up = new THREE.Vector3(...site.up);
    const north = new THREE.Vector3(...site.north);
    const east = new THREE.Vector3(...site.east);
    const along = (azDeg: number, elDeg: number) => {
      const a = THREE.MathUtils.degToRad(azDeg);
      const e = THREE.MathUtils.degToRad(elDeg);
      return north
        .clone()
        .multiplyScalar(Math.cos(e) * Math.cos(a))
        .add(east.clone().multiplyScalar(Math.cos(e) * Math.sin(a)))
        .add(up.clone().multiplyScalar(Math.sin(e)));
    };
    if (this.mode === "terrain") {
      const rel = c.position.clone().sub(ground);
      const r = rel.length();
      let el = THREE.MathUtils.radToDeg(Math.asin(clamp(rel.clone().normalize().dot(up), -1, 1)));
      let az = THREE.MathUtils.radToDeg(Math.atan2(rel.dot(east), rel.dot(north)));
      az -= dx * 0.3;
      el = clamp(el + dy * 0.2, 6, 85);
      c.position.copy(ground).add(along(az, el).multiplyScalar(r));
      c.up.copy(up);
      c.lookAt(ground);
      return;
    }
    // Lander's eye: look around from where the camera stands.
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    let el = THREE.MathUtils.radToDeg(Math.asin(clamp(look.dot(up), -1, 1)));
    let az = THREE.MathUtils.radToDeg(Math.atan2(look.dot(east), look.dot(north)));
    const k = c.fov / 60;
    az -= dx * 0.12 * k;
    el = clamp(el + dy * 0.08 * k, -20, 60);
    c.up.copy(up);
    c.lookAt(c.position.clone().add(along(az, el)));
  }

  /** `factor` above 1 zooms out. */
  zoom(factor: number): void {
    const c = this.camera;
    if (this.mode === "map" || this.locked) return;
    this.stop();
    this.userMoved = true;
    if (this.mode === "system") {
      const alt = c.position.length() - 1;
      const maxAlt = this.trueScale ? 900 : 40;
      c.position.setLength(1 + clamp(alt * factor, MIN_SPACE_ALTITUDE, maxAlt));
      return;
    }
    if (this.mode === "terrain" && this.site) {
      const ground = new THREE.Vector3(...this.site.ground);
      const rel = c.position.clone().sub(ground);
      const r = clamp(rel.length() * factor, 1_800 / MOON_RADIUS_M, 90_000 / MOON_RADIUS_M);
      c.position.copy(ground).add(rel.setLength(r));
      return;
    }
    if (this.mode === "panorama") {
      c.fov = clamp(c.fov * factor, 8, 75);
      c.updateProjectionMatrix();
    }
  }
}
