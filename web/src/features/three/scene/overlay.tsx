import { memo, useLayoutEffect, useRef } from "react";
import * as THREE from "three";
import type { CameraViewId, FreeSpace } from "../../../app/scene";
import { BodyIcon } from "../../../components/BodyIcon";
import { Button } from "../../../components/Button";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { StatusLamp, type Status } from "../../../components/StatusLamp";
import type { MissionProfile, Site } from "../../../contracts/generated";
import { surfacePointScene } from "../../../lib/geo";
import { useEvaluation } from "../../../lib/scoring";
import { groupPins, moreSitesLine, type ScreenPin } from "./pins";
import { visiblePlates, type Plate } from "./plates";
import { bodyLabel, sightGood, sightLabel, type SightState } from "./sight";
import type { Anchors, WorldSite } from "./world";

/**
 * Everything drawn over the scene as HTML: pins, the focused site's name, the sight-line
 * and body labels, the Sun's edge marker, the plates and the view's controls. Every word
 * sits on a plate (DESIGN.md, "The scene"); nothing is written on the bare scene. Positions
 * are written straight to the elements after each drawn frame, so moving the camera does
 * not re-render React.
 */

export type Preset = "south_pole" | "from_earth" | "from_sun" | "follow_site";
export type LookToward = "earth" | "sun";

export type OverlayBus = {
  overlay: ((anchors: Anchors, camera: THREE.PerspectiveCamera, size: { width: number; height: number }) => void) | null;
  controls: { beginDrag: () => void; orbit: (dx: number, dy: number) => void; zoom: (factor: number) => void } | null;
};

type SightInfo = {
  state: SightState | null;
  sunEl: number;
  earthEl: number;
  sunFrac: number;
  earthFrac: number;
  sunClear: number;
  earthClear: number;
} | null;

type OverlayProps = {
  bus: { current: OverlayBus };
  view: CameraViewId;
  freeSpace: FreeSpace;
  sites: readonly Site[];
  focusedId: string | null;
  focusedSite: WorldSite | null;
  profile: MissionProfile;
  landingUtc: string;
  sight: SightInfo;
  trueScale: boolean;
  /** The Sun's distance at the current hour, or null when system.bin is not in. */
  sunDistKm: number | null;
  /** The plates at the top of the free space, from `sceneContent` (plates.ts). */
  plates: readonly Plate[];
  preset: Preset;
  onPreset: (preset: Preset) => void;
  onTrueScale: (on: boolean) => void;
  moon8k: boolean;
  onMoon8k: (on: boolean) => void;
  lookToward: LookToward;
  onLookToward: (toward: LookToward) => void;
  onFocusSite: (siteId: string) => void;
  onViewChange: (view: CameraViewId) => void;
};

const PRESETS: { value: Preset; label: string }[] = [
  { value: "south_pole", label: "South pole" },
  { value: "from_earth", label: "From Earth" },
  { value: "from_sun", label: "From the Sun" },
  { value: "follow_site", label: "Follow site" },
];

function tooSmall(space: FreeSpace): boolean {
  return space.width < 220 || space.height < 48;
}

function formatDistance(km: number): string {
  return `${(km / 1e6).toFixed(1)} million km`;
}

/** A pin's lamp: the status for the landing date, from the evaluation hooks. */
const PinLamp = memo(function PinLamp({ siteId, profile, landingUtc }: { siteId: string; profile: MissionProfile; landingUtc: string }) {
  const result = useEvaluation(siteId, profile, landingUtc);
  const status: Status | null = result.status === "ready" && result.data ? result.data.status : null;
  if (!status) return <span className="scene-pin-none" aria-hidden="true" />;
  return <StatusLamp status={status} size="xs" />;
});

function PinStatusWord({ siteId, profile, landingUtc }: { siteId: string; profile: MissionProfile; landingUtc: string }) {
  const result = useEvaluation(siteId, profile, landingUtc);
  if (result.status !== "ready") return null;
  return <>{result.data ? `, ${result.data.status}` : ", no result"}</>;
}

export function Overlay(props: OverlayProps) {
  const { bus, view, freeSpace, focusedId, focusedSite, sight, trueScale } = props;
  const pinRefs = useRef(new Map<string, HTMLButtonElement>());
  const nameRef = useRef<HTMLDivElement>(null);
  const moreRef = useRef<HTMLSpanElement>(null);
  const sightRefs = { sun: useRef<HTMLDivElement>(null), earth: useRef<HTMLDivElement>(null) };
  const bodyRefs = { sun: useRef<HTMLDivElement>(null), earth: useRef<HTMLDivElement>(null) };
  const markerRef = useRef<HTMLDivElement>(null);
  const arrowRef = useRef<SVGSVGElement>(null);
  const landerRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);

  const latest = useRef(props);
  latest.current = props;

  useLayoutEffect(() => {
    const tmp = new THREE.Vector3();
    const camSpace = new THREE.Vector3();
    const project = (v: THREE.Vector3, camera: THREE.PerspectiveCamera, w: number, h: number) => {
      camSpace.copy(v).applyMatrix4(camera.matrixWorldInverse);
      tmp.copy(v).project(camera);
      return { x: ((tmp.x + 1) / 2) * w, y: ((1 - tmp.y) / 2) * h, front: camSpace.z < 0 };
    };
    const show = (el: HTMLElement | null, on: boolean) => {
      if (el) el.style.visibility = on ? "visible" : "hidden";
    };
    const place = (el: HTMLElement | null, x: number, y: number) => {
      if (el) el.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    };

    bus.current.overlay = (anchors, camera, size) => {
      const p = latest.current;
      const fs = p.freeSpace;
      const W = size.width;
      const H = size.height;
      const small = tooSmall(fs);
      const cam = camera.position;
      const left = fs.x + 8;
      const right = fs.x + fs.width - 8;
      const top = fs.y + 8;
      // Labels stay above the view's controls at the foot of the free space.
      const foot = footRef.current?.firstElementChild?.getBoundingClientRect();
      const bottom = foot && foot.height > 0 ? Math.min(fs.y + fs.height - 8, foot.top - 6) : fs.y + fs.height - 8;
      const placed: { x: number; y: number; w: number; h: number }[] = [];
      /** Keeps a label inside the free space and moves it down past labels already placed. */
      const settle = (el: HTMLElement, x: number, y: number) => {
        const w = el.offsetWidth;
        const h = el.offsetHeight;
        let lx = Math.min(Math.max(x, left), right - w);
        let ly = Math.min(Math.max(y, top), bottom - h);
        for (let pass = 0; pass < 4; pass += 1) {
          const hit = placed.find((r) => lx < r.x + r.w && lx + w > r.x && ly < r.y + r.h && ly + h > r.y);
          if (!hit) break;
          ly = hit.y + hit.h + 4;
        }
        ly = Math.min(ly, bottom - h);
        lx = Math.min(Math.max(lx, left), right - w);
        placed.push({ x: lx, y: ly, w, h });
        place(el, lx, ly);
      };
      const focal = H / 2 / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));

      // Pins: the System view and the Polar map only. On the far side of the Moon, hidden.
      const pinsOn = !small && (p.view === "system" || p.view === "map");
      const screen: ScreenPin[] = [];
      for (const site of p.sites) {
        const point = new THREE.Vector3(...surfacePointScene(site.lat_deg, site.lon_deg));
        const s = project(point, camera, W, H);
        const facing = point.dot(cam.clone().sub(point)) > 0;
        const inside = s.x >= fs.x && s.x <= fs.x + fs.width && s.y >= fs.y && s.y <= fs.y + fs.height;
        screen.push({ id: site.id, x: s.x, y: s.y, visible: pinsOn && s.front && facing && inside });
      }
      const groups = groupPins(screen, p.focusedId);
      const leaders = new Map(groups.map((g) => [g.leader, g]));
      for (const pin of screen) {
        const el = pinRefs.current.get(pin.id);
        if (!el) continue;
        const lead = leaders.get(pin.id);
        show(el, Boolean(lead));
        if (lead) place(el, pin.x - 9, pin.y - 9);
      }
      const focusedPin = screen.find((pin) => pin.id === p.focusedId && leaders.has(pin.id));
      if (nameRef.current) {
        show(nameRef.current, Boolean(focusedPin));
        if (focusedPin) {
          const more = moreSitesLine(leaders.get(focusedPin.id)?.folded.length ?? 0);
          if (moreRef.current) {
            moreRef.current.textContent = more ?? "";
            moreRef.current.hidden = !more;
          }
          placed.push({ x: focusedPin.x - 10, y: focusedPin.y - 10, w: 20, h: 20 });
          settle(nameRef.current, focusedPin.x + 16, focusedPin.y - 12);
        }
      }

      // Sight-line labels at the far end of each line.
      for (const key of ["sun", "earth"] as const) {
        const el = sightRefs[key].current;
        const end = anchors.sightEnds?.[key];
        const on = !small && Boolean(end && p.sight?.state) && (p.view === "system" || p.view === "terrain");
        show(el, on);
        if (on && el && end) {
          const s = project(end, camera, W, H);
          if (!s.front) show(el, false);
          else settle(el, s.x + 8, s.y - 10);
        }
      }

      // Earth and Sun labels: below each body.
      for (const key of ["earth", "sun"] as const) {
        const el = bodyRefs[key].current;
        const centre = key === "earth" ? anchors.earth : anchors.sun;
        const radius = key === "earth" ? anchors.earthRadius : anchors.sunRadius;
        const on = !small && anchors.bodies && Boolean(centre) && (p.view === "system" || p.view === "panorama");
        if (!on || !centre || !el) {
          show(el, false);
          continue;
        }
        const s = project(centre, camera, W, H);
        const distance = centre.distanceTo(cam);
        const r = (radius / Math.max(distance, 1e-9)) * focal;
        const visible = s.front && s.x > fs.x && s.x < fs.x + fs.width && s.y > fs.y && s.y < fs.y + fs.height;
        show(el, visible);
        if (visible) settle(el, s.x - el.offsetWidth / 2, s.y + r + 8);
      }

      // The Sun's edge marker, in the System view, when the Sun is off screen (or only a
      // direction, at true scale).
      const marker = markerRef.current;
      if (marker) {
        let on = false;
        if (!small && anchors.bodies && p.view === "system") {
          const sunPoint = anchors.sun ?? cam.clone().add(anchors.sunDirection.clone().multiplyScalar(1_000));
          const s = project(sunPoint, camera, W, H);
          const inside = s.front && s.x > fs.x && s.x < fs.x + fs.width && s.y > fs.y && s.y < fs.y + fs.height;
          const asDirection = !anchors.sun;
          if (!inside || asDirection) {
            on = true;
            const cx = fs.x + fs.width / 2;
            const cy = fs.y + fs.height / 2;
            let dx = s.x - cx;
            let dy = s.y - cy;
            if (!s.front) {
              dx = -dx;
              dy = -dy;
            }
            let mx = s.x;
            let my = s.y;
            if (!inside) {
              const k = Math.min((fs.width / 2 - 40) / Math.max(Math.abs(dx), 1e-6), (fs.height / 2 - 24) / Math.max(Math.abs(dy), 1e-6));
              mx = cx + dx * k;
              my = cy + dy * k;
            }
            if (arrowRef.current) arrowRef.current.style.transform = `rotate(${Math.atan2(dy, dx)}rad)`;
            settle(marker, mx - marker.offsetWidth / 2, my - marker.offsetHeight / 2);
          }
        }
        show(marker, on);
      }

      // "Lander not to scale", beside Pip in Local terrain.
      const lander = landerRef.current;
      if (lander) {
        const on = !small && p.view === "terrain" && Boolean(anchors.lander);
        show(lander, on);
        if (on && anchors.lander && anchors.site) {
          // Beside Pip: right of its legs, at half its drawn height.
          const top = project(anchors.lander, camera, W, H);
          const base = project(anchors.site, camera, W, H);
          const height = Math.hypot(top.x - base.x, top.y - base.y);
          if (top.front && base.front) settle(lander, base.x + height * 0.75 + 10, (top.y + base.y) / 2 - lander.offsetHeight / 2);
          else show(lander, false);
        }
      }
    };
    return () => {
      bus.current.overlay = null;
    };
  }, [bus]);

  // Plates and controls stay inside the free space; the anchor's limit passes to its child.
  const room = Math.max(0, freeSpace.width - 16);
  const fit = { maxWidth: Math.min(room, 760) };
  const fsStyleTop = { left: freeSpace.x + freeSpace.width / 2, top: freeSpace.y + 8, maxWidth: Math.min(room, 640) };
  const fsStyleFoot = { left: freeSpace.x + freeSpace.width / 2, top: freeSpace.y + freeSpace.height - 8, ...fit };
  const small = tooSmall(freeSpace) || freeSpace.windowOpen;
  // A plate placed at the foot sits above the view's controls, so it never covers the sky,
  // where Lander's eye centres Earth and the Sun.
  const plateStack = (plates: readonly Plate[]) =>
    plates.length > 0 ? (
      <div className="scene-plate-stack">
        {plates.map((plate) => (
          <div
            key={plate.id}
            className={plate.action ? "plate scene-plate scene-plate-top scene-plate-interactive" : "plate scene-plate scene-plate-top"}
            role={plate.status ? "status" : undefined}
          >
            <p>{plate.text}</p>
            {plate.note ? <p className="scene-plate-note">{plate.note}</p> : null}
            {plate.action === "show-system" ? <Button onClick={() => props.onViewChange("system")}>Show it in the System view</Button> : null}
          </div>
        ))}
      </div>
    ) : null;
  // The decoration plate is never hidden with the rest (plates.ts, visiblePlates): in a tight
  // space or beside an open window it shortens to one line, and where not even that fits, the
  // scene draws the ground without shadows or texture instead (scene-root.tsx, setDisclosed).
  const shown = visiblePlates(props.plates, freeSpace, small);
  const topPlates = plateStack(shown.top);
  const footPlates = plateStack(shown.foot);

  const state = sight?.state ?? null;
  const focusedName = props.sites.find((s) => s.id === focusedId)?.name ?? focusedId ?? "";

  return (
    <div className="scene-overlay" data-view={view}>
      {props.sites.map((site) => (
        <button
          key={site.id}
          ref={(el) => {
            if (el) pinRefs.current.set(site.id, el);
            else pinRefs.current.delete(site.id);
          }}
          type="button"
          tabIndex={-1}
          className="scene-pin"
          data-focused={site.id === focusedId}
          onClick={() => props.onFocusSite(site.id)}
          title={site.name}
        >
          <PinLamp siteId={site.id} profile={props.profile} landingUtc={props.landingUtc} />
          {/* The accessible name is the name and the status word: "Connecting Ridge, NO-GO". */}
          <span className="sr-only">
            {site.name}
            <PinStatusWord siteId={site.id} profile={props.profile} landingUtc={props.landingUtc} />
          </span>
        </button>
      ))}
      <div ref={nameRef} className="plate scene-label" aria-hidden="true">
        <span className="scene-label-main">{focusedName}</span>
        <span ref={moreRef} className="scene-label-sub" hidden />
      </div>
      {(["sun", "earth"] as const).map((key) => (
        <div key={key} ref={sightRefs[key]} className="plate scene-label scene-label-row" aria-hidden="true">
          {state ? (
            <>
              <StatusLamp status={sightGood(key, state) ? "GO" : "NO-GO"} size="xs" />
              <span className="scene-label-main">{sightLabel(key, state)}</span>
            </>
          ) : null}
        </div>
      ))}
      <div ref={bodyRefs.earth} className="plate scene-label scene-label-row" aria-hidden="true">
        <BodyIcon body="earth" size={14} />
        <span className="scene-label-main">
          {view === "panorama" && sight ? bodyLabel("earth", sight.earthEl, sight.earthFrac, sight.earthClear) : "Earth"}
        </span>
      </div>
      <div ref={bodyRefs.sun} className="plate scene-label scene-label-row" aria-hidden="true">
        <BodyIcon body="sun" size={14} />
        <span className="scene-label-main">
          {view === "panorama" && sight ? bodyLabel("sun", sight.sunEl, sight.sunFrac, sight.sunClear) : "Sun"}
        </span>
      </div>
      <div ref={markerRef} className="plate scene-label scene-label-row scene-marker" aria-hidden="true">
        <BodyIcon body="sun" size={14} />
        <span className="scene-label-main">{trueScale && props.sunDistKm !== null ? `Sun, ${formatDistance(props.sunDistKm)} away` : "Sun"}</span>
        <svg ref={arrowRef} className="scene-marker-arrow" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 8h9M9 4.5 12.5 8 9 11.5" />
        </svg>
      </div>
      <div ref={landerRef} className="plate scene-label" aria-hidden="true">
        <span className="scene-label-main">Lander not to scale</span>
      </div>

      {small && footPlates ? (
        <div ref={footRef} className="scene-anchor scene-anchor-foot" style={fsStyleFoot}>
          {footPlates}
        </div>
      ) : null}
      {small ? null : (
        <>
          {topPlates ? (
            <div className="scene-anchor scene-anchor-top" style={fsStyleTop}>
              {topPlates}
            </div>
          ) : null}
          <div ref={footRef} className="scene-anchor scene-anchor-foot" style={fsStyleFoot}>
            {footPlates}
            {view === "system" ? (
              <div className="plate scene-controls scene-plate-interactive" style={fit}>
                <SegmentedControl label="Camera" options={PRESETS.map((p) => ({ ...p, disabled: p.value === "follow_site" && !focusedId }))} value={props.preset} onChange={props.onPreset} />
                <Button aria-pressed={trueScale} className="scene-toggle" onClick={() => props.onTrueScale(!trueScale)}>
                  True scale
                </Button>
                <Button aria-pressed={props.moon8k} className="scene-toggle" onClick={() => props.onMoon8k(!props.moon8k)} title="Loads two more images, 3 MB">
                  Sharper Moon
                </Button>
              </div>
            ) : null}
            {view === "panorama" && focusedSite ? (
              <div className="plate scene-controls scene-plate-interactive" style={fit}>
                <SegmentedControl
                  label="Look toward"
                  options={[
                    { value: "earth", label: "Earth" },
                    { value: "sun", label: "The Sun" },
                  ]}
                  value={props.lookToward}
                  onChange={props.onLookToward}
                />
              </div>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
