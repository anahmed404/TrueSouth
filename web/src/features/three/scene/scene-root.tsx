import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent, type WheelEvent } from "react";
import * as THREE from "three";
import type { CameraViewId, FreeSpace, SceneProps } from "../../../app/scene";
import type { Site } from "../../../contracts/generated";
import { useApron, useManifest, useSceneMeta, useSeries, useSite, useSites, useSystem, useTerrain } from "../../../data";
import type { DecodedApron, DecodedSeries, DecodedSystem, DecodedTerrain } from "../../../data";
import {
  LOCAL_TERRAIN_HALF_M,
  SQUEEZED_DISTANCE,
  SQUEEZED_SUN_RADIUS,
  bodyDirections,
  earthPlacement,
  localDirectionToScene,
  siteFrameScene,
  siteGroundScene,
  type ApronGrid,
  type SystemHour,
} from "../../../lib/geo";
import { useHourFlags, type HourFlags } from "../../../lib/scoring";
import { utcToHourIndex } from "../../../lib/time";
import {
  DIP_MS,
  FLIGHT_MS,
  INSET_MS,
  INTRO_MS,
  eyePose,
  followSitePose,
  fromDirectionPose,
  homePose,
  introStart,
  polarPose,
  polarScale,
  terrainPose,
  type Pose,
  type SiteFrame,
} from "./camera";
import { Overlay, type OverlayBus, type Preset, type LookToward } from "./overlay";
import { sceneContent, type LoadState } from "./plates";
import { southPolePose } from "./navigate";
import { Rig } from "./rig";
import { sightState, type SightState } from "./sight";
import { PointerTracker, type Command as PointerCommand } from "./pointers";
import { FrameMeter, MOON_SEGMENTS_FULL, QualityGovernor, drawDpr, moonSegments, qualityStages } from "./perf";
import { Stars, starExposure } from "./stars";
import { mul, type V3 } from "./vec";
import { World, type WorldInputs, type WorldSite } from "./world";
import "./scene.css";

/**
 * The 3D scene behind Mission Control (work packages T1 and T2; docs/features/system-view.md).
 * The shell passes `SceneProps` (web/src/app/scene.ts). Positions come from system.bin and
 * lib/geo; lit, dark, link and no link come from the series through the scoring hooks.
 */

/** A double-click's move onto a spot. */
const FOCUS_MS = 700;
/** Frames closer together than this are a moving picture (perf.ts measures them). */
const MOTION_GAP_MS = 250;
/** With no frame for this long, the scene draws one full-quality frame. Longer than MOTION_GAP_MS. */
const REST_AFTER_MS = 300;
/** The space our own plates take at the top and foot of the free space, so the subject clears them. */
const PLATE_TOP = 40;
/** In the System view the bodies' labels hang below them, above the controls. */
const CONTROLS_FOOT = 60;
const SYSTEM_FOOT = 90;

function devForcedStatus(): string | null {
  if (!import.meta.env.DEV) return null;
  try {
    return window.sessionStorage.getItem("truesouth.scene.status");
  } catch {
    return null;
  }
}

/** Dev only: `sessionStorage["truesouth.scene.capture"] = "1"` renders the still picture. */
function captureMode(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return window.sessionStorage.getItem("truesouth.scene.capture") === "1";
  } catch {
    return false;
  }
}

/** Dev only: `?perf` in the address shows frame times over the scene (never shipped). */
function perfHud(): boolean {
  if (!import.meta.env.DEV) return false;
  try {
    return new URLSearchParams(window.location.search).has("perf");
  } catch {
    return false;
  }
}

function probeWebgl(): "ready" | "no-webgl" {
  if (devForcedStatus() === "no-webgl") return "no-webgl";
  try {
    const canvas = document.createElement("canvas");
    const gl = canvas.getContext("webgl2");
    if (!gl) return "no-webgl";
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return "ready";
  } catch {
    return "no-webgl";
  }
}

/** This package draws nothing without WebGL yet: no camera view has a flat form. */
const NO_FLAT_VIEWS = { flatViews: [] } as const;

export default function SceneRoot(props: SceneProps) {
  const [webgl] = useState(probeWebgl);
  const { onStatus } = props;
  useEffect(() => {
    if (webgl === "no-webgl") onStatus("no-webgl", NO_FLAT_VIEWS);
  }, [webgl, onStatus]);
  // Flat mode (WebGL missing, or slow before "Try 3D anyway"): draw nothing in WebGL and let
  // the shell's still picture stand. The Canvas unmounts, which releases the GPU.
  if (webgl === "no-webgl" || props.mode === "flat") return null;
  return <Scene3D {...props} />;
}

// ── Data for the focused site ───────────────────────────────────────────────

type FocusData = {
  siteId: string;
  series: DecodedSeries | null;
  flags: HourFlags | null;
  terrain: { data: DecodedTerrain; size: number; windowKm: number } | null | "loading";
  apron: DecodedApron | null | "loading";
  /** How each file stands, for the plates (plates.ts). */
  states: { series: LoadState; terrain: LoadState; apron: LoadState };
};

function loadState(status: "loading" | "ready" | "error"): LoadState {
  return status;
}

function FocusedSiteData({
  siteId,
  profile,
  onData,
}: {
  siteId: string;
  profile: SceneProps["scenario"]["profile"];
  onData: (data: FocusData) => void;
}) {
  const series = useSeries(siteId);
  const flags = useHourFlags(siteId, profile);
  const terrain = useTerrain(siteId);
  const site = useSite(siteId);
  const apron = useApron(siteId);
  // useSite builds a fresh object each render: read the one number it gives here.
  const windowKm = site.status === "ready" ? (site.data.meta.terrain?.window_km ?? (2 * LOCAL_TERRAIN_HALF_M) / 1000) : null;
  const terrainValue = useMemo(() => {
    if (terrain.status === "loading" || (site.status === "loading" && terrain.status === "ready" && terrain.data)) return "loading" as const;
    if (terrain.status !== "ready" || !terrain.data) return null;
    const size = Math.round(Math.sqrt(terrain.data.up_km.length));
    return { data: terrain.data, size, windowKm: windowKm ?? 20 };
  }, [terrain.status, terrain.data, site.status, windowKm]);
  const apronValue = apron.status === "loading" ? "loading" : apron.status === "ready" && apron.data !== "not available" ? apron.data : null;
  const seriesValue = series.status === "ready" ? series.data : null;
  const flagsValue = flags.status === "ready" ? flags.data : null;
  // The series counts as failed when either it or its hour flags failed: no state without data.
  const seriesState: LoadState =
    series.status === "error" || flags.status === "error" ? "error" : series.status === "ready" && flags.status === "ready" ? "ready" : "loading";
  const terrainState = terrainValue === "loading" ? "loading" : loadState(terrain.status);
  // A missing apron file ("not available") is a load that failed for this purpose.
  const apronState: LoadState =
    apron.status === "ready" ? (apron.data === "not available" ? "error" : "ready") : loadState(apron.status);
  useEffect(() => {
    onData({
      siteId,
      series: seriesValue,
      flags: flagsValue,
      terrain: terrainValue,
      apron: apronValue,
      states: { series: seriesState, terrain: terrainState, apron: apronState },
    });
  }, [siteId, seriesValue, flagsValue, terrainValue, apronValue, seriesState, terrainState, apronState, onData]);
  return null;
}

function systemHour(system: DecodedSystem, hour: number): SystemHour | null {
  if (hour < 0 || hour >= system.subsolar_lat.length) return null;
  return {
    subsolarLatDeg: system.subsolar_lat[hour] as number,
    subsolarLonDeg: system.subsolar_lon[hour] as number,
    subearthLatDeg: system.subearth_lat[hour] as number,
    subearthLonDeg: system.subearth_lon[hour] as number,
    earthDistKm: system.earth_dist_km[hour] as number,
    sunDistKm: system.sun_dist_km[hour] as number,
  };
}

/**
 * Geometry only, while system.bin is not in (loading or failed): the Sun and Earth are then
 * not drawn and the Moon gets an even light, so none of these numbers is ever shown.
 */
const NO_HOUR: SystemHour = {
  subsolarLatDeg: 0,
  subsolarLonDeg: 0,
  subearthLatDeg: 0,
  subearthLonDeg: 0,
  earthDistKm: 1,
  sunDistKm: 1,
};

function shrink(space: FreeSpace, top: number, bottom: number): FreeSpace {
  if (space.height <= top + bottom + 80) return space;
  return { ...space, y: space.y + top, height: space.height - top - bottom };
}

function Scene3D(props: SceneProps) {
  const { view, scenario, reduceMotion, ignoreSlow, onStatus, onFocusSite, onViewChange } = props;
  const capture = useMemo(captureMode, []);
  // The still picture fills the window behind the panels: frame it on the whole window.
  const freeSpace = useMemo(
    (): FreeSpace =>
      capture
        ? { x: 0, y: 0, width: props.freeSpace.viewport.width, height: props.freeSpace.viewport.height, viewport: props.freeSpace.viewport, windowOpen: false }
        : props.freeSpace,
    [capture, props.freeSpace],
  );
  const sites = useSites();
  const system = useSystem();
  const manifest = useManifest();
  const sceneMeta = useSceneMeta();

  const [preset, setPreset] = useState<Preset>("south_pole");
  // Counts preset clicks: a click flies even to the preset already chosen (after a drag, the
  // "South pole" click brings the whole cap back). Before the first click, "South pole" is home.
  const [presetPulse, setPresetPulse] = useState(0);
  const pickPreset = useCallback((next: Preset) => {
    setPreset(next);
    setPresetPulse((n) => n + 1);
  }, []);
  const [trueScale, setTrueScale] = useState(false);
  const [moon8k, setMoon8k] = useState(false);
  const [lookToward, setLookToward] = useState<LookToward>("earth");
  const [focus, setFocus] = useState<FocusData | null>(null);
  const focusedId = scenario.focusedSiteId;
  const onData = useCallback((data: FocusData) => setFocus(data), []);

  const hourIndex = useMemo(() => {
    if (manifest.status !== "ready") return null;
    try {
      return utcToHourIndex(manifest.data.time_grid, scenario.currentUtc);
    } catch {
      return null;
    }
  }, [manifest.status, manifest.data, scenario.currentUtc]);

  const hour = useMemo(() => {
    if (system.status !== "ready" || hourIndex === null) return null;
    return systemHour(system.data, hourIndex);
  }, [system.status, system.data, hourIndex]);

  const siteList: readonly Site[] = sites.status === "ready" ? sites.data : [];
  const selected = useMemo(
    () => scenario.siteIds.map((id) => siteList.find((site) => site.id === id)).filter((site): site is Site => Boolean(site)),
    [scenario.siteIds, siteList],
  );
  const focusedSite = focusedId ? (siteList.find((site) => site.id === focusedId) ?? null) : null;
  const focusReady = focus && focus.siteId === focusedId ? focus : null;

  const apronEntry = useMemo(() => {
    if (!focusedId || sceneMeta.status !== "ready") return null;
    const entry = sceneMeta.data.aprons.find((item) => item.site_id === focusedId);
    return entry ? ({ rows: entry.rows, columns: entry.columns, windowM: entry.window_m } satisfies ApronGrid) : null;
  }, [focusedId, sceneMeta.status, sceneMeta.data]);

  const worldSite = useMemo((): WorldSite | null => {
    if (!focusedSite) return null;
    const sphere = focusedSite.terrain_tier === "sphere";
    let groundHeightM = 0;
    const apron = focusReady?.apron;
    if (!sphere && apron && apron !== "loading" && apronEntry) {
      // The apron's centre cell is the site's own ground point; its height is the patch's z0.
      const centre = apron.heights[Math.floor(apron.rows / 2) * apron.columns + Math.floor(apron.columns / 2)];
      if (centre !== undefined && Number.isFinite(centre)) groundHeightM = centre;
      else groundHeightM = focusedSite.elevation_m ?? 0;
    } else if (!sphere) {
      groundHeightM = focusedSite.elevation_m ?? 0;
    }
    const lat = focusedSite.lat_deg;
    const lon = focusedSite.lon_deg;
    const frame: SiteFrame = { ground: siteGroundScene(lat, lon, groundHeightM), ...siteFrameScene(lat, lon) };
    return { id: focusedSite.id, name: focusedSite.name, latDeg: lat, lonDeg: lon, groundHeightM, frame, sphere };
  }, [focusedSite, focusReady?.apron, apronEntry]);

  const sight = useMemo((): {
    state: SightState | null;
    sunDir: V3;
    earthDir: V3;
    sunEl: number;
    earthEl: number;
    sunAz: number;
    earthAz: number;
    sunFrac: number;
    earthFrac: number;
    sunClear: number;
    earthClear: number;
  } | null => {
    if (!worldSite || !focusReady?.series || hourIndex === null) return null;
    const s = focusReady.series;
    const sunAz = s.sun_az[hourIndex];
    const sunEl = s.sun_el[hourIndex];
    const earthAz = s.earth_az[hourIndex];
    const earthEl = s.earth_el[hourIndex];
    if (sunAz === undefined || sunEl === undefined || earthAz === undefined || earthEl === undefined) return null;
    return {
      state: focusReady.flags ? sightState(focusReady.flags, hourIndex) : null,
      sunDir: localDirectionToScene(sunAz, sunEl, worldSite.latDeg, worldSite.lonDeg),
      earthDir: localDirectionToScene(earthAz, earthEl, worldSite.latDeg, worldSite.lonDeg),
      sunAz,
      sunEl,
      earthAz,
      earthEl,
      sunFrac: s.sun_frac[hourIndex] ?? Number.NaN,
      earthFrac: s.earth_frac[hourIndex] ?? Number.NaN,
      sunClear: s.sun_clear[hourIndex] ?? Number.NaN,
      earthClear: s.earth_clear[hourIndex] ?? Number.NaN,
    };
  }, [worldSite, focusReady?.series, focusReady?.flags, hourIndex]);

  // What may be drawn, and the plates that say what is missing (plates.ts).
  const systemState: LoadState =
    system.status === "error" || manifest.status === "error"
      ? "error"
      : system.status === "ready" && manifest.status === "ready"
        ? hour
          ? "ready"
          : "error"
        : "loading";
  const content = useMemo(
    () =>
      sceneContent({
        view,
        trueScale,
        system: systemState,
        site: worldSite ? { name: worldSite.name, sphere: worldSite.sphere } : null,
        series: focusReady?.states.series ?? "loading",
        terrain: focusReady?.states.terrain ?? "loading",
        apron: focusReady?.states.apron ?? "loading",
      }),
    [view, trueScale, systemState, worldSite, focusReady?.states.series, focusReady?.states.terrain, focusReady?.states.apron],
  );

  const inputs = useMemo((): WorldInputs => {
    const bodies = hour !== null;
    const h = hour ?? NO_HOUR;
    const { sun, earth } = bodyDirections(h);
    const placement = bodies ? earthPlacement(h, trueScale) : { centre: [0, 0, 0] as const, radius: 0 };
    return {
      bodies,
      sunDir: sun,
      earthDir: earth,
      earthCentre: placement.centre,
      earthRadius: placement.radius,
      trueScale,
      earthDistKm: h.earthDistKm,
      sunDistKm: h.sunDistKm,
      hourIndex: hourIndex ?? 0,
      // The still picture has no pins, sight-lines or ground: only the bodies.
      site: capture ? null : worldSite,
      sight: sight && !capture
        ? {
            sunDir: sight.sunDir,
            earthDir: sight.earthDir,
            sunGood: sight.state ? sight.state.sun === "lit" : null,
            earthGood: sight.state ? sight.state.earth === "link" : null,
          }
        : null,
      view,
    };
  }, [hour, trueScale, hourIndex, worldSite, sight, view, capture]);

  const terrainReady = focusReady && focusReady.terrain !== "loading" ? focusReady.terrain : null;
  const apronReady = focusReady && focusReady.apron !== "loading" ? focusReady.apron : null;

  const bus = useRef<OverlayBus>({ overlay: null, controls: null });
  // The System view keeps room at the top only while a plate is there (a load failure, for example).
  const topPlates = view === "system" && content.plates.length > 0;
  const sceneSpace = useMemo(
    () => (capture ? freeSpace : shrink(freeSpace, topPlates ? PLATE_TOP : 0, view === "system" ? SYSTEM_FOOT : CONTROLS_FOOT)),
    [freeSpace, view, capture, topPlates],
  );

  // Reduced motion: dip through Night, cut at the darkest point, rise again. A second pick
  // during a dip replaces the pending cut, so only the last view is cut to.
  const dipRef = useRef<HTMLDivElement>(null);
  const dipTimer = useRef<number | null>(null);
  const dip = useCallback((ms: number, cut: () => void) => {
    if (dipTimer.current !== null) window.clearTimeout(dipTimer.current);
    dipTimer.current = null;
    const el = dipRef.current;
    if (!el) {
      cut();
      return;
    }
    el.style.transitionDuration = `${ms / 2}ms`;
    el.style.opacity = "1";
    dipTimer.current = window.setTimeout(() => {
      dipTimer.current = null;
      cut();
      el.style.opacity = "0";
    }, ms / 2);
  }, []);
  useEffect(
    () => () => {
      if (dipTimer.current !== null) window.clearTimeout(dipTimer.current);
    },
    [],
  );

  // ── Pointer, wheel and keys ──
  // One finger or the left button turns; the right button, Shift or two fingers slide; the
  // wheel or a pinch zooms toward the pointer; a double-click or double-tap centres a spot.
  // The bookkeeping (and every way a gesture can end) is in pointers.ts.
  const tracker = useMemo(() => new PointerTracker(), []);
  const sceneRef = useRef<HTMLDivElement>(null);
  const ndcAt = (element: HTMLElement, x: number, y: number) => {
    const rect = element.getBoundingClientRect();
    return { x: ((x - rect.left) / Math.max(1, rect.width)) * 2 - 1, y: -(((y - rect.top) / Math.max(1, rect.height)) * 2 - 1) };
  };
  const run = (element: HTMLElement, commands: PointerCommand[]) => {
    const controls = bus.current.controls;
    if (!controls) return;
    for (const c of commands) {
      if (c.type === "begin") controls.beginDrag();
      else if (c.type === "orbit") controls.orbit(c.dx, c.dy);
      else if (c.type === "pan") {
        if (!controls.pan(c.dx, c.dy) && c.orFallback) controls.orbit(c.dx, c.dy);
      } else if (c.type === "zoom") controls.zoom(c.factor, ndcAt(element, c.x, c.y));
      else if (c.type === "focus") controls.focusOn(ndcAt(element, c.x, c.y));
    }
  };
  const release = (element: HTMLElement, id: number) => {
    try {
      if (element.hasPointerCapture(id)) element.releasePointerCapture(id);
    } catch {
      // The pointer is already gone.
    }
  };
  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("button, [role='radiogroup'], .scene-plate-interactive")) return;
    if (!bus.current.controls) return;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    const kind = event.pointerType === "touch" || event.pointerType === "pen" ? event.pointerType : "mouse";
    run(event.currentTarget, tracker.down(event.pointerId, event.clientX, event.clientY, kind, event.button, event.shiftKey, performance.now()));
  };
  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const element = event.currentTarget;
    const commands = tracker.move(event.pointerId, event.clientX, event.clientY, event.buttons, event.shiftKey);
    run(element, commands);
    // A mouse moving with no button held has ended its drag: let go of it.
    if (event.pointerType === "mouse" && event.buttons === 0) release(element, event.pointerId);
  };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    release(event.currentTarget, event.pointerId);
    run(event.currentTarget, tracker.up(event.pointerId, event.clientX, event.clientY, performance.now()));
  };
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    release(event.currentTarget, event.pointerId);
    run(event.currentTarget, tracker.cancel(event.pointerId));
  };
  // The window losing focus or the tab hiding ends every gesture (pointers.ts).
  useEffect(() => {
    const clear = () => {
      const element = sceneRef.current;
      if (element) for (const id of tracker.ids()) release(element, id);
      tracker.clear();
    };
    const onVisibility = () => {
      if (document.hidden) clear();
    };
    window.addEventListener("blur", clear);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("blur", clear);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tracker]);
  const onWheel = (event: WheelEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest(".scene-controls")) return;
    bus.current.controls?.zoom(Math.exp(event.deltaY * 0.0012), ndcAt(event.currentTarget, event.clientX, event.clientY));
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget) return;
    const controls = bus.current.controls;
    if (!controls) return;
    // An arrow moves the camera the arrow's way, so the picture moves the other way, as on a
    // map: the same as a drag the opposite way. With Shift it slides instead of turning.
    const step = 24;
    const move = (dx: number, dy: number) => () => {
      controls.beginDrag();
      if (!event.shiftKey || !controls.pan(dx, dy)) controls.orbit(dx, dy);
    };
    const keys: Record<string, () => void> = {
      ArrowLeft: move(step, 0),
      ArrowRight: move(-step, 0),
      ArrowUp: move(0, step),
      ArrowDown: move(0, -step),
      "+": () => controls.zoom(0.8),
      "=": () => controls.zoom(0.8),
      "-": () => controls.zoom(1.25),
      "−": () => controls.zoom(1.25),
    };
    const action = keys[event.key];
    if (!action) return;
    event.preventDefault();
    action();
  };

  return (
    <div
      ref={sceneRef}
      className="scene-3d"
      tabIndex={0}
      role="application"
      aria-roledescription="3D scene"
      aria-label="The Sun, Earth and Moon. Drag to turn, right-drag, Shift-drag or drag with two fingers to slide, scroll or pinch to zoom, double-click to centre a spot. With the scene focused, arrow keys turn, Shift and the arrow keys slide, and plus and minus zoom."
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onLostPointerCapture={onPointerCancel}
      onWheel={onWheel}
      onKeyDown={onKeyDown}
      onContextMenu={(event) => {
        if (!(event.target as HTMLElement).closest("button, a, input, .scene-plate-interactive")) event.preventDefault();
      }}
    >
      {focusedId ? <FocusedSiteData key={focusedId} siteId={focusedId} profile={scenario.profile} onData={onData} /> : null}
      <Canvas
        className="scene-canvas"
        frameloop="demand"
        dpr={capture ? 1 : [1, 2]}
        flat
        gl={{ antialias: true, logarithmicDepthBuffer: true, powerPreference: "high-performance", preserveDrawingBuffer: capture }}
        camera={{ fov: 30, near: 1e-7, far: 5_000, position: [0, -12, 0] }}
        onCreated={({ gl }) => gl.setClearColor(new THREE.Color(cssVar("--space", "#0b0b0c")), 1)}
      >
        <Director
          view={view}
          inputs={inputs}
          sceneSpace={sceneSpace}
          freeSpace={freeSpace}
          reduceMotion={reduceMotion}
          ignoreSlow={ignoreSlow}
          preset={preset}
          presetPulse={presetPulse}
          lookToward={lookToward}
          trueScale={trueScale}
          moon8k={moon8k}
          sight={sight}
          terrain={terrainReady}
          apron={apronReady && apronEntry ? { data: apronReady, grid: apronEntry } : null}
          bus={bus}
          dip={dip}
          capture={capture}
          dataReady={systemState !== "loading"}
          smoothGround={content.ground === "smooth"}
          onStatus={onStatus}
          onArrive={props.onArrive}
        />
      </Canvas>
      {capture ? null : (
        <Overlay
          bus={bus}
          view={view}
          freeSpace={freeSpace}
          sites={selected}
          focusedId={focusedId}
          focusedSite={worldSite}
          profile={scenario.profile}
          landingUtc={scenario.landingUtc}
          sight={sight}
          trueScale={trueScale}
          sunDistKm={hour ? hour.sunDistKm : null}
          plates={content.plates}
          preset={preset}
          onPreset={pickPreset}
          onTrueScale={setTrueScale}
          moon8k={moon8k}
          onMoon8k={setMoon8k}
          lookToward={lookToward}
          onLookToward={setLookToward}
          onFocusSite={onFocusSite}
          onViewChange={onViewChange}
        />
      )}
      <div ref={dipRef} className="scene-dip" aria-hidden="true" />
    </div>
  );
}

function cssVar(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value || fallback;
}

// ── The director: owns the world and the rig inside the Canvas ─────────────

type DirectorProps = {
  view: CameraViewId;
  inputs: WorldInputs;
  sceneSpace: FreeSpace;
  freeSpace: FreeSpace;
  reduceMotion: boolean;
  ignoreSlow: boolean;
  preset: Preset;
  /** Preset clicks so far; 0 means the camera is still on home. */
  presetPulse: number;
  lookToward: LookToward;
  trueScale: boolean;
  moon8k: boolean;
  sight: { sunAz: number; sunEl: number; earthAz: number; earthEl: number } | null;
  terrain: { data: DecodedTerrain; size: number; windowKm: number } | null;
  apron: { data: DecodedApron; grid: ApronGrid } | null;
  bus: { current: OverlayBus };
  dip: (ms: number, cut: () => void) => void;
  capture: boolean;
  dataReady: boolean;
  /** Draw the smooth Moon at the site: a sphere-tier site, or its terrain file failed. */
  smoothGround: boolean;
  onStatus: SceneProps["onStatus"];
  onArrive?: SceneProps["onArrive"];
};

function Director(props: DirectorProps) {
  const { gl, camera, scene, invalidate } = useThree();
  const setDpr = useThree((state) => state.setDpr);
  const perspective = camera as THREE.PerspectiveCamera;
  const world = useMemo(() => new World(invalidate, gl.capabilities.getMaxAnisotropy()), [invalidate, gl]);
  const rig = useMemo(() => new Rig(perspective), [perspective]);
  const latest = useRef(props);
  latest.current = props;

  // Load the textures on mount; release everything on unmount.
  useEffect(() => {
    world.revive();
    scene.add(world.root);
    void world.loadTextures(latest.current.moon8k, () => invalidate());
    return () => {
      scene.remove(world.root);
      world.dispose();
    };
  }, [scene, world, invalidate]);

  // The star background: one draw of points behind everything (stars.ts).
  const stars = useMemo(() => new Stars(), []);
  useEffect(() => {
    scene.add(stars.points);
    void stars.load(() => invalidate());
    return () => {
      scene.remove(stars.points);
      stars.dispose();
    };
  }, [scene, stars, invalidate]);

  // The optional 8K Moon, when the setting asks for it.
  const firstRes = useRef(true);
  useEffect(() => {
    if (firstRes.current) {
      firstRes.current = false;
      return;
    }
    void world.setMoonResolution(props.moon8k ? "8k" : "4k", () => invalidate());
  }, [world, props.moon8k, invalidate]);

  useEffect(() => {
    world.setInputs(props.inputs);
    rig.site = props.inputs.site?.frame ?? null;
    rig.trueScale = props.trueScale;
  }, [world, rig, props.inputs, props.trueScale]);

  useEffect(() => {
    world.setGround(props.inputs.site, props.smoothGround ? null : props.terrain, props.smoothGround ? null : props.apron, props.smoothGround);
  }, [world, props.inputs.site, props.terrain, props.apron, props.smoothGround]);

  // The controls the overlay's pointer and key handlers call.
  useEffect(() => {
    props.bus.current.controls = {
      beginDrag: () => rig.beginDrag(),
      orbit: (dx, dy) => {
        rig.orbit(dx, dy);
        invalidate();
      },
      pan: (dx, dy) => {
        const handled = rig.pan(dx, dy);
        invalidate();
        return handled;
      },
      zoom: (f, ndc) => {
        rig.zoom(f, ndc ?? null);
        invalidate();
      },
      focusOn: (ndc) => {
        const handled = rig.focusOn(ndc, latest.current.reduceMotion ? 0 : FOCUS_MS);
        // A double-click on empty space levels the view: back to the preset's framing.
        if (!handled) levelView.current();
        invalidate();
        return handled;
      },
    };
    return () => {
      props.bus.current.controls = null;
    };
  }, [rig, invalidate, props.bus]);

  /** The pose for a camera view now. */
  const targetFor = useCallback(
    (view: CameraViewId): Pose => {
      const p = latest.current;
      const space = p.sceneSpace;
      const i = p.inputs;
      const subjects = {
        earth: { centre: i.earthCentre, radius: i.earthRadius },
        sun: i.trueScale || !i.bodies ? null : { dir: i.sunDir, centre: mul(i.sunDir, SQUEEZED_DISTANCE), radius: SQUEEZED_SUN_RADIUS },
      };
      const site = i.site;
      if (view === "map") return polarPose(space);
      if ((view === "terrain" || view === "panorama") && site) {
        const sunAz = p.sight?.sunAz ?? 0;
        const earthAz = p.sight?.earthAz ?? 180;
        if (view === "terrain") return terrainPose(site.frame, sunAz, earthAz);
        const toward = p.lookToward === "sun" ? { az: sunAz, el: p.sight?.sunEl ?? 0 } : { az: earthAz, el: p.sight?.earthEl ?? 0 };
        return eyePose(site.frame, toward.az, toward.el);
      }
      if (p.preset === "from_earth") return fromDirectionPose(i.earthDir, space);
      if (p.preset === "from_sun") return fromDirectionPose(i.sunDir, space);
      if (p.preset === "follow_site" && site) return followSitePose(site.frame.up, site.frame.north, space);
      if (p.preset === "south_pole" && p.presetPulse > 0) return southPolePose(subjects, space);
      return homePose(subjects, space);
    },
    [],
  );

  /** The System view's point of interest for the current preset: drags close in turn about it. */
  const focusFor = useCallback((view: CameraViewId): THREE.Vector3 | null => {
    const p = latest.current;
    if (view !== "system") return null;
    if (p.preset === "follow_site" && p.inputs.site) return new THREE.Vector3(...p.inputs.site.frame.up);
    if (p.preset === "south_pole") return new THREE.Vector3(0, -1, 0);
    return null;
  }, []);

  // ── Quality: step down on a slow machine, in stages (perf.ts) ──
  // Stage 0 is the full picture. Frames measured while something moves can step it down; the
  // scene says "slow" (and the shell offers the still picture) only when the last stage is
  // still slow. Stages 1 and up draw fewer pixels while moving and the full stage resolution
  // as soon as the scene rests.
  const quality = useMemo(
    () => ({
      stages: qualityStages(typeof window === "undefined" ? 1 : window.devicePixelRatio || 1),
      stage: 0,
      governor: new QualityGovernor(qualityStages(1).length - 1),
      restTimer: 0,
      lastFrame: 0,
      resting: false,
    }),
    [],
  );
  const applyStage = useCallback(
    (stage: number) => {
      if (stage === quality.stage) return;
      quality.stage = stage;
      const rest = drawDpr(quality.stages[stage]!, false);
      setDpr(rest);
      gl.setPixelRatio(rest);
      invalidate();
    },
    [quality, setDpr, gl, invalidate],
  );
  useEffect(() => {
    // A hidden tab draws nothing: whatever was measured around it is not a frame time.
    const onVisibility = () => {
      quality.governor.reset();
      quality.lastFrame = 0;
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.clearTimeout(quality.restTimer);
    };
  }, [quality]);

  // ── Status: report once the first flight lands ──
  // The quality governor (perf.ts) judges the first flight's frames like any other flight's;
  // the scene says "slow" only from its last quality stage.
  const reported = useRef(false);
  const finishMeasure = useCallback(() => {
    if (reported.current) return;
    reported.current = true;
    const p = latest.current;
    if (devForcedStatus() === "slow") {
      p.onStatus(p.ignoreSlow ? "ready" : "slow", NO_FLAT_VIEWS);
      return;
    }
    p.onStatus("ready", NO_FLAT_VIEWS);
  }, []);

  // ── Flights ──
  const arrive = useCallback((view: CameraViewId) => {
    const p = latest.current;
    if (!p.onArrive) return;
    if (view === "map") {
      const pose = polarPose(p.sceneSpace);
      p.onArrive({ view, pole: polarScale(pose, p.sceneSpace) });
    } else {
      p.onArrive({ view });
    }
  }, []);

  /**
   * Flies to a camera view (the rig's `flyToView`: locked against drags, scrolls and keys;
   * another pick re-targets it). A re-frame inside the System view (a preset, true scale)
   * stays interruptible by a drag.
   */
  const flyToView = useCallback(
    (view: CameraViewId, ms: number, locked = true) => {
      const p = latest.current;
      const target = targetFor(view);
      rig.focus = focusFor(view);
      if (p.reduceMotion) {
        rig.mode = view;
        p.dip(view === "map" ? 400 : DIP_MS, () => {
          rig.flyToView(view, target, 0, arrive);
          invalidate();
        });
        return;
      }
      rig.flyToView(view, target, ms, arrive, { locked });
      invalidate();
    },
    [rig, targetFor, focusFor, arrive, invalidate],
  );

  // Levels the System view after free turning: flies back to the current preset's framing.
  const levelView = useRef<() => void>(() => undefined);
  levelView.current = () => {
    if (latest.current.view === "system" && !rig.locked) flyToView("system", FLIGHT_MS, false);
  };

  // The intro: once the data for the current time is in, ease in from 1.5 times the distance.
  // It is locked too, so the frame times it measures always reach a verdict.
  const introDone = useRef(false);
  useEffect(() => {
    if (introDone.current || !props.dataReady) return;
    introDone.current = true;
    rig.setFreeSpace(props.sceneSpace, 0);
    const target = targetFor(props.view);
    const start = props.view === "system" ? introStart(target) : introStart(targetFor("system"));
    rig.apply(start);
    rig.focus = focusFor(props.view);
    if (props.reduceMotion) {
      rig.flyToView(props.view, target, 0, arrive);
      finishMeasure();
    } else {
      rig.flyToView(props.view, target, INTRO_MS, (view) => {
        finishMeasure();
        arrive(view);
      });
    }
    invalidate();
  }, [props.dataReady]);

  // A new camera view: fly there.
  const lastView = useRef(props.view);
  useEffect(() => {
    if (!introDone.current || lastView.current === props.view) {
      lastView.current = props.view;
      return;
    }
    lastView.current = props.view;
    flyToView(props.view, FLIGHT_MS);
  }, [props.view, flyToView]);

  // A preset, true scale, the focused site or the eye's direction changed: fly again, if it moves the camera.
  const siteId = props.inputs.site?.id ?? null;
  const groundKey = `${siteId}|${props.inputs.site?.groundHeightM ?? 0}`;
  const lastKey = useRef<string | null>(null);
  useEffect(() => {
    const key =
      props.view === "system"
        ? `system|${props.preset}|${props.presetPulse}|${props.trueScale}|${props.preset === "follow_site" ? siteId : ""}`
        : props.view === "map"
          ? "map"
          : `${props.view}|${groundKey}|${props.view === "panorama" ? props.lookToward : ""}|${props.sight ? "s" : ""}`;
    const previous = lastKey.current;
    lastKey.current = key;
    if (!introDone.current || previous === null || previous === key) return;
    if (previous.split("|")[0] !== key.split("|")[0]) return; // a view change flies by itself
    flyToView(props.view, FLIGHT_MS, props.view !== "system");
  }, [props.view, props.preset, props.presetPulse, props.trueScale, siteId, groundKey, props.lookToward, props.sight !== null, flyToView]);

  // The free space: the centre slides there; a camera the user has not moved re-frames.
  const firstSpace = useRef(true);
  useEffect(() => {
    if (props.freeSpace.windowOpen) return; // the camera stays still while a window is open
    if (firstSpace.current) {
      firstSpace.current = false;
      rig.setFreeSpace(props.sceneSpace, 0);
      invalidate();
      return;
    }
    rig.setFreeSpace(props.sceneSpace, latest.current.reduceMotion ? 0 : INSET_MS);
    if (introDone.current && !rig.userMoved && !rig.flying) {
      rig.flyTo(targetFor(latest.current.view), latest.current.reduceMotion ? 0 : INSET_MS);
    }
    invalidate();
  }, [props.sceneSpace, rig, targetFor, invalidate]);

  // Render on demand: a frame is drawn only when something changed, and only while visible.
  useFrame(({ camera: frameCamera, size }) => {
    const now = performance.now();
    // A frame within 250 ms of the one before is a moving frame; the one frame drawn after a
    // rest, to put back the full picture, is not.
    const resting = quality.resting;
    quality.resting = false;
    const sinceLast = quality.lastFrame > 0 ? now - quality.lastFrame : 0;
    quality.lastFrame = now;
    const inMotion = !latest.current.capture && !resting && quality.lastFrame > 0 && sinceLast > 0 && sinceLast <= MOTION_GAP_MS;
    if (!latest.current.capture) {
      // Only flight frames judge the stage: they are drawn back to back, so the time between
      // them is the frame's cost. A drag's frames follow the pointer, and a pause in a drag
      // must not look like a slow frame. Hidden-tab frames and stalls never count (perf.ts).
      const verdict = quality.governor.frame({ gapMs: resting ? 0 : sinceLast, moving: rig.flying, hidden: document.hidden });
      if (verdict.changed) applyStage(verdict.stage);
      if (verdict.slow && !latest.current.ignoreSlow) latest.current.onStatus("slow", NO_FLAT_VIEWS);
      // Dynamic resolution (stages 1 and up): fewer pixels while moving, the full stage
      // resolution at rest. The canvas is resized inside the frame, so a cleared canvas is
      // never shown.
      const want = drawDpr(quality.stages[quality.stage]!, inMotion);
      if (Math.abs(gl.getPixelRatio() - want) > 1e-3) gl.setPixelRatio(want);
    }
    // When nothing has moved for longer than the motion cutoff, draw one more frame with the
    // full picture: full resolution and the full Moon mesh. Then nothing is drawn until
    // something changes. (Longer than the cutoff, so a slow flight's frames never trigger it.)
    window.clearTimeout(quality.restTimer);
    if (inMotion || rig.flying) {
      quality.restTimer = window.setTimeout(() => {
        quality.resting = true;
        invalidate();
      }, REST_AFTER_MS);
    }
    const moving = rig.update(now);
    world.draw = rig.draw;
    // three updates the camera's matrices during render; the overlay projects before that.
    frameCamera.updateMatrixWorld();
    const anchors = world.layout(frameCamera);
    // Stars dim as the lit Moon fills the view, and on the sunlit ground.
    const cam = frameCamera as THREE.PerspectiveCamera;
    const inputs = latest.current.inputs;
    let exposure = 0.45;
    if (inputs.view !== "terrain" && inputs.view !== "panorama") {
      const moonRadius = Math.asin(Math.min(1, 1 / Math.max(1, cam.position.length())));
      const fovY = THREE.MathUtils.degToRad(cam.fov);
      exposure = starExposure((Math.PI * moonRadius * moonRadius) / (fovY * fovY * cam.aspect));
    }
    stars.update(gl.getPixelRatio(), exposure, inputs.bodies ? inputs.sunDir : null);
    // The Moon's level of detail from its radius on screen, in device pixels (perf.ts),
    const moonDistance = cam.position.length();
    const moonPixels =
      moonDistance > 1.0001
        ? (Math.tan(Math.asin(1 / moonDistance)) / Math.tan(THREE.MathUtils.degToRad(cam.fov) / 2)) * (size.height / 2) * gl.getPixelRatio()
        : Number.POSITIVE_INFINITY;
    // Only while moving: at rest the full mesh, so a still picture is exactly today's.
    world.setMoonSegments(inMotion ? moonSegments(moonPixels) : MOON_SEGMENTS_FULL);
    const overlayStart = devMeter ? performance.now() : 0;
    latest.current.bus.current.overlay?.(anchors, frameCamera as THREE.PerspectiveCamera, size);
    if (devMeter) devMeter.parts.overlay += performance.now() - overlayStart;
    if (devMeter) {
      devMeter.meter.tick(now);
      devMeter.frames += 1;
      if (devMeter.hud && devMeter.frames % 15 === 0) {
        const m = devMeter.meter;
        const info = gl.info.render;
        devMeter.hud.textContent = `${m.median().toFixed(1)} ms median · ${m.p95().toFixed(1)} p95 · ${m.count} frames · dpr ${gl.getPixelRatio().toFixed(2)} · ${size.width}×${size.height} · ${info.calls} calls · ${Math.round(info.triangles / 1000)}k tris`;
      }
    }
    if (moving) invalidate();
  });

  // Dev only: the still picture, rendered once the intro has landed.
  useEffect(() => {
    if (!props.capture) return;
    const timer = window.setInterval(() => {
      if (!introDone.current || rig.flying || world.textureState.moon !== "4k" || !world.textureState.cap) return;
      window.clearInterval(timer);
      gl.render(scene, camera);
      (window as unknown as { __truesouthStill?: string }).__truesouthStill = gl.domElement.toDataURL("image/webp", 0.8);
    }, 250);
    return () => window.clearInterval(timer);
  }, [props.capture, gl, scene, camera, rig, world]);

  // Dev only: frame times for measuring (window.__truesouthPerf), and the `?perf` readout.
  const devMeter = useMemo(() => {
    if (!import.meta.env.DEV) return null;
    const meter = new FrameMeter(2_000, 1_000);
    let hud: HTMLDivElement | null = null;
    if (perfHud()) {
      hud = document.createElement("div");
      hud.style.cssText =
        "position:fixed;left:8px;bottom:8px;z-index:9999;padding:4px 8px;font:12px/1.4 monospace;color:#f4f4f5;background:rgba(20,20,21,.92);border-radius:4px;pointer-events:none";
      document.body.appendChild(hud);
    }
    return { meter, hud, frames: 0, parts: { overlay: 0, render: 0 } };
  }, []);
  // Dev only: time the renderer's own work on the main thread.
  useEffect(() => {
    if (!import.meta.env.DEV || !devMeter) return;
    const original = gl.render.bind(gl);
    gl.render = (s: THREE.Object3D, c: THREE.Camera) => {
      const t = performance.now();
      original(s, c);
      devMeter.parts.render += performance.now() - t;
    };
    return () => {
      gl.render = original;
    };
  }, [devMeter, gl]);
  useEffect(() => {
    if (!import.meta.env.DEV || !devMeter) return;
    (window as unknown as { __truesouthPerf?: unknown }).__truesouthPerf = {
      reset: () => {
        devMeter.meter.reset();
        devMeter.parts = { overlay: 0, render: 0 };
        devMeter.frames = 0;
      },
      read: () => ({
        median: devMeter.meter.median(),
        p95: devMeter.meter.p95(),
        frames: devMeter.meter.count,
        dpr: gl.getPixelRatio(),
        stage: quality.stage,
        overlayMs: devMeter.parts.overlay / Math.max(1, devMeter.frames),
        renderMs: devMeter.parts.render / Math.max(1, devMeter.frames),
      }),
    };
    return () => devMeter.hud?.remove();
  }, [devMeter, gl, quality]);

  // Exposed for checking by the numbers in the browser (dev only).
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    (window as unknown as { __truesouthScene?: unknown }).__truesouthScene = { world, rig, camera, gl, invalidate, inputs: () => latest.current.inputs };
  }, [world, rig, camera, gl, invalidate]);

  // Pause when the tab is hidden: draw one fresh frame on return.
  useEffect(() => {
    const onVisible = () => {
      if (!document.hidden) invalidate();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [invalidate]);

  return null;
}
