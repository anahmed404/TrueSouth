import * as THREE from "three";
import type { CameraViewId, FreeSpace } from "../../../app/scene";
import { MOON_RADIUS_M } from "../../../lib/geo";
import { easeInOutCubic, lerpPose, viewOffset, type Pose, type SiteFrame } from "./camera";
import { focusPose, hitMoon, lookOf, orbitSystem, panSystem, rayThrough, systemPivot, zoomSystem } from "./navigate";
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

export { POLE_LIMIT_Y } from "./navigate";

/**
 * How a drag turns a camera view, set per view (a view not listed does not turn):
 * - "free": the System view's free trackball about the pivot, with no pole limit (navigate.ts).
 * - "site": Local terrain's turntable about the site, kept above the ground (6° to 85° up).
 * - "look": Lander's eye looks around from where it stands, with a level horizon.
 * - "none": the camera stays still (the Polar map stays a north-up map).
 */
export type OrbitStyle = "free" | "site" | "look" | "none";
export const ORBIT_STYLE: Partial<Record<CameraViewId, OrbitStyle>> = {
  system: "free",
  map: "none",
  terrain: "site",
  panorama: "look",
};

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
  /**
   * The System view's point of interest, on the unit sphere: the south pole after the "South
   * pole" preset, the site after "Follow site", a double-clicked spot. Close in, drags turn
   * about it. Cleared by a pan or a zoom toward another point.
   */
  focus: THREE.Vector3 | null = null;

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
  //
  // Every drag follows one rule, "grab the globe": the surface under the pointer moves with
  // the pointer (drag right, the surface moves right). Keys move the camera the arrow's way,
  // so the picture moves the other way. How each view turns is a per-view setting
  // (ORBIT_STYLE). The System view's free trackball, pivot, pan and zoom toward the pointer
  // are in navigate.ts.

  /** Starts a drag (or a key press): stops an unlocked move. */
  beginDrag(): void {
    if (this.locked) return;
    this.stop();
  }

  /** The window's height in CSS pixels, from the free space. */
  private get viewportHeight(): number {
    return this.offset?.height ?? 900;
  }

  /** How the current view turns. */
  private get style(): OrbitStyle {
    return ORBIT_STYLE[this.mode] ?? "none";
  }

  /** True in the views a drag or a zoom can move: every view but the Polar map, which stays a north-up map. */
  private get turnable(): boolean {
    return this.style !== "none" && !this.locked;
  }

  /** A drag of (dx, dy) CSS pixels: turn the view (see the rule above). */
  orbit(dx: number, dy: number): void {
    const c = this.camera;
    if (!this.turnable) return;
    this.stop();
    this.userMoved = true;
    const style = this.style;
    if (style === "free") {
      orbitSystem(c, dx, dy, this.viewportHeight, this.focus);
      return;
    }
    // The two ground views turn about the site, within their limits.
    if (style !== "site" && style !== "look") return;
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
    if (style === "site") {
      // A turntable about the site: the camera goes the other way round from the drag, so the
      // ground nearest the viewer follows the pointer.
      const rel = c.position.clone().sub(ground);
      const r = rel.length();
      let el = THREE.MathUtils.radToDeg(Math.asin(clamp(rel.clone().normalize().dot(up), -1, 1)));
      let az = THREE.MathUtils.radToDeg(Math.atan2(rel.dot(east), rel.dot(north)));
      az += dx * 0.3;
      el = clamp(el + dy * 0.2, 6, 85);
      c.position.copy(ground).add(along(az, el).multiplyScalar(r));
      c.up.copy(up);
      c.lookAt(ground);
      return;
    }
    // Lander's eye: look around from where the camera stands; the view turns against the drag.
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    let el = THREE.MathUtils.radToDeg(Math.asin(clamp(look.dot(up), -1, 1)));
    let az = THREE.MathUtils.radToDeg(Math.atan2(look.dot(east), look.dot(north)));
    const k = c.fov / 60;
    az -= dx * 0.12 * k;
    el = clamp(el + dy * 0.08 * k, -20, 60);
    c.up.copy(up);
    c.lookAt(c.position.clone().add(along(az, el)));
  }

  /**
   * Slides the System view across the surface by (dx, dy) CSS pixels. Returns false in a view
   * that has no pan, so the caller can turn instead.
   */
  pan(dx: number, dy: number): boolean {
    if (this.mode !== "system") return false;
    if (this.locked) return true;
    this.stop();
    this.userMoved = true;
    // The preset's point slides off the centre; its weight fades (navigate.ts, focusWeight).
    panSystem(this.camera, dx, dy, this.viewportHeight);
    return true;
  }

  /**
   * `factor` above 1 zooms out. In the System view, `ndc` (the pointer in normalised device
   * coordinates) keeps the surface point under the pointer fixed on screen.
   */
  zoom(factor: number, ndc: { x: number; y: number } | null = null): void {
    const c = this.camera;
    if (!this.turnable) return;
    this.stop();
    this.userMoved = true;
    if (this.mode === "system") {
      // Without a pointer, toward the pivot's point of interest, which moves continuously.
      const toward = systemPivot(c.position, lookOf(c), this.focus).surface.normalize();
      zoomSystem(c, factor, this.trueScale ? 900 : 40, ndc, toward);
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

  /**
   * Double-click in the System view: centre the surface point under `ndc` and move in on it,
   * over `ms`. Returns false when the point is off the Moon.
   */
  focusOn(ndc: { x: number; y: number }, ms: number): boolean {
    if (this.mode !== "system" || this.locked) return false;
    const hit = hitMoon(this.camera.position, rayThrough(this.camera, ndc));
    if (!hit) return false;
    this.flyTo(focusPose(this.camera, hit), ms);
    this.focus = hit.normalize();
    this.userMoved = true;
    return true;
  }
}
