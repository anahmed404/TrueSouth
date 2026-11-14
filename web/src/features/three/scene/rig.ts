import * as THREE from "three";
import type { CameraViewId, FreeSpace } from "../../../app/scene";
import { MOON_RADIUS_M } from "../../../lib/geo";
import { easeInOutCubic, lerpPose, viewOffset, type Pose, type SiteFrame } from "./camera";
import { focusPose, hitMoon, lookOf, orbitSystem, panSystem, rayThrough, systemPivot, zoomSystem } from "./navigate";
import { SYSTEM_MAX_ALTITUDE, TRUE_SCALE_MAX_ALTITUDE } from "./proportions";
import { slipLightBlend, slipOrbit, slipZoom } from "./slip";
import { clamp, smooth, type V3 } from "./vec";

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
 * - "centre": the Slip Planner turns about the selected sites' centre, 28° to 88° up, and
 *   zooms along the line to that centre, 60 to 2,600 km (slip.ts). It has no pan, and its
 *   zoom keeps the aim rather than moving toward the pointer, so the sites never leave the
 *   view: a pan or a pointer zoom would move the aim off the centre the orbit turns about.
 * - "none": the camera stays still (the Polar map stays a north-up map).
 */
export type OrbitStyle = "free" | "site" | "look" | "centre" | "none";
export const ORBIT_STYLE: Partial<Record<CameraViewId, OrbitStyle>> = {
  system: "free",
  map: "none",
  slip: "centre",
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
  private trueScaleOn = false;
  /**
   * 0 with the schematic arrangement, 1 at true scale, and in between while the flight that
   * the toggle starts is under way: every flight carries it from where it is to the current
   * setting, in step with the camera (and at once with reduced motion). world.ts places Earth
   * and the Sun from it (proportions.ts, earthDuringScale and sunDuringScale).
   */
  scaleBlend = 0;
  /**
   * The glide of `scaleBlend`, on the same clock and curve as the flight that started it but
   * not stopped with it: a drag that stops the flight lets Earth finish its glide instead of
   * snapping.
   */
  private scaleGlide: { from: number; to: number; t0: number; ms: number } | null = null;

  get trueScale(): boolean {
    return this.trueScaleOn;
  }

  set trueScale(on: boolean) {
    this.trueScaleOn = on;
  }
  /** True once the user has turned or zoomed since the last pick. */
  userMoved = false;
  /**
   * How much the polar cap shows the map's fixed lighting instead of the real Sun: 0 or 1 at
   * rest, between only during a flight to or from the Polar map.
   */
  draw = 0;
  /**
   * The Slip Planner (slip.ts): how much the Moon shows the fixed drawing light instead of
   * the real Sun, 0 or 1 at rest; and the point its orbit turns about.
   */
  slip = 0;
  slipCentre: { centre: V3; up0: V3 } | null = null;
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
    const target = this.trueScaleOn ? 1 : 0;
    if (ms <= 0) {
      this.tween = null;
      this.scaleBlend = target;
      this.scaleGlide = null;
      this.apply(to);
      onT?.(1);
      onDone?.();
      return;
    }
    const t0 = options.now ?? performance.now();
    this.tween = { from: this.pose(), to, t0, ms, onT, onDone, locked: options.locked ?? false };
    this.scaleGlide = this.scaleBlend === target ? null : { from: this.scaleBlend, to: target, t0, ms };
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
    const fromSlip = this.slip;
    const intoSlip = view === "slip";
    const onT = (t: number) => {
      this.draw = toDraw >= fromDraw ? fromDraw + (toDraw - fromDraw) * smooth(0.55, 1, t) : fromDraw * (1 - smooth(0, 0.45, t));
      this.slip = slipLightBlend(fromSlip, intoSlip, t);
    };
    this.flyTo(
      to,
      ms,
      () => {
        this.draw = toDraw;
        this.slip = intoSlip ? 1 : 0;
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
    // The arrangement glides with the flight that started it; with no glide under way it is the setting.
    const glide = this.scaleGlide;
    if (glide) {
      const t = clamp((now - glide.t0) / glide.ms, 0, 1);
      this.scaleBlend = glide.from + (glide.to - glide.from) * easeInOutCubic(t);
      if (t >= 1 || glide.to !== (this.trueScaleOn ? 1 : 0)) this.scaleGlide = null;
      else active = true;
    } else {
      this.scaleBlend = this.trueScaleOn ? 1 : 0;
    }
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

  /**
   * A drag of (dx, dy) CSS pixels: turn the view (see the rule above). `fromKey` marks an
   * arrow key, which the scene sends as a 24 px drag the other way; only Lander's eye's
   * vertical axis tells the two apart.
   */
  orbit(dx: number, dy: number, fromKey = false): void {
    const c = this.camera;
    if (!this.turnable) return;
    this.stop();
    this.userMoved = true;
    const style = this.style;
    if (style === "free") {
      orbitSystem(c, dx, dy, this.viewportHeight, this.focus);
      return;
    }
    if (style === "centre") {
      // The same turn as Local terrain's: the ground nearest the viewer follows the pointer.
      // slipOrbit moves the camera's azimuth by −dx, so the rig passes −dx (the team's test:
      // the Slip Planner's horizontal drag was reversed against every other view).
      this.slipMove((pos) => slipOrbit(pos, this.slipCentre!.centre, this.slipCentre!.up0, -dx, dy));
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
    // Lander's eye: look around from where the camera stands. Horizontally the picture follows
    // the pointer, as in every view. Vertically the view follows the drag instead: dragging up
    // looks up. The team's tester called the grab-the-world vertical "inverted" here: from
    // 2 m up there is a horizon, not a globe, in the hand. An arrow key already looks the
    // arrow's way (it arrives as a drag the other way), so its sign is left alone.
    const look = new THREE.Vector3(0, 0, -1).applyQuaternion(c.quaternion);
    let el = THREE.MathUtils.radToDeg(Math.asin(clamp(look.dot(up), -1, 1)));
    let az = THREE.MathUtils.radToDeg(Math.atan2(look.dot(east), look.dot(north)));
    const k = c.fov / 60;
    az -= dx * 0.12 * k;
    el = clamp(el + (fromKey ? dy : -dy) * 0.08 * k, -20, 60);
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
      zoomSystem(c, factor, this.trueScale ? TRUE_SCALE_MAX_ALTITUDE : SYSTEM_MAX_ALTITUDE, ndc, toward);
      return;
    }
    if (this.style === "centre") {
      // Along the line to the sites' centre, keeping the camera's aim (not toward `ndc`).
      if (this.slipCentre) c.position.set(...slipZoom([c.position.x, c.position.y, c.position.z], this.slipCentre.centre, factor));
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

  /** The Slip Planner's drag: about the sites' centre (slip.ts), looking at it. */
  private slipMove(step: (pos: V3) => { pos: V3; up: V3 }): void {
    const centre = this.slipCentre;
    if (!centre) return;
    const c = this.camera;
    const next = step([c.position.x, c.position.y, c.position.z]);
    c.position.set(...next.pos);
    c.up.set(...next.up);
    c.lookAt(...centre.centre);
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
