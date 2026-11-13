/**
 * The flat Polar map (docs/features/polar-map.md): a 2D canvas of the south polar region with
 * pins, labels, overlays, readouts and the nudge. It needs no WebGL. Mission Control mounts it
 * over the scene through `layer.tsx`; the Academy embeds it through the default export of
 * `index.tsx`.
 */

import { select } from "d3-selection";
import { zoom as d3zoom, zoomIdentity, type D3ZoomEvent, type ZoomBehavior } from "d3-zoom";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
  type RefObject,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import type { Scenario } from "../../app/panel";
import { Button, IconButton } from "../../components/Button";
import { SegmentedControl } from "../../components/SegmentedControl";
import { cx } from "../../components/format";
import type { Site } from "../../contracts/generated";
import { useFeatures, useMapLookup, useMapsMeta, useSites } from "../../data";
import { polarStereoForward, polarStereoInverse, polarStereoScale, wrapLongitude } from "../../lib/geo";
import { useEvaluation } from "../../lib/scoring";
import { releaseMapImage, useMapImage } from "./assets";
import { drawMap, readPalette, type Marker, type Palette } from "./draw";
import { onMap, pinAt, placePins, type PinState, type PlacedPin } from "./pins";
import {
  AVERAGE_CAVEAT,
  CHOSEN_TAG,
  NUDGE_CAVEAT,
  OVERLAY_NAME,
  coordinatesText,
  distanceText,
  lookupText,
  nearbyRangeText,
  NUDGE_CAVEAT_SHORT,
  variantLine,
  nudgeLine,
  readLookup,
  type LookupGrid,
  type OverlayId,
} from "./readout";
import { scaleBar } from "./takeover";
import {
  DEFAULT_HALF_WIDTH_M,
  clampView,
  fitView,
  latLonToScreen,
  reliefLevel,
  screenToLatLon,
  zoomExtent,
  type MapView,
  type ScreenPoint,
} from "./view";
import "./polar-map.css";

export type Rect = { x: number; y: number; width: number; height: number };

export type MapCoreProps = {
  scenario: Scenario;
  /** "mission": the full control set, over the scene. "lesson": the small set, in a box. */
  mode: "mission" | "lesson";
  /**
   * Where the map centres and its controls sit, in the box's CSS pixels: the free space in
   * Mission Control, or null for the whole box.
   */
  frame: Rect | null;
  /** The view to open at (the takeover from the globe), or null for the map's own fit. */
  openAt: MapView | null;
  /** False while the map is hidden behind the globe: it takes no input. */
  active: boolean;
  reduceMotion: boolean;
  onFocusSite?: (siteId: string) => void;
  onAddSite?: (siteId: string) => void;
  /** Flies the camera back to the System view for a site off the map, such as Apollo 11. */
  onShowOnMoon?: (siteId: string) => void;
  /**
   * Optional: compute a custom site at a point. When given, the "New site here?" readout and
   * the nudge readout offer a button that calls it; without it there is no button.
   */
  onRequestSite?: (latDeg: number, lonDeg: number) => void;
  /**
   * Optional: the sites to place, in place of the whole catalog (for example only the selected
   * sites). Selection and focus still come from the scenario.
   */
  sites?: readonly Site[];
  /** Name craters and mountains once zoomed in enough. Default true. */
  showFeatureNames?: boolean;
  /**
   * Optional: the overlay, set from outside. When given, the map shows that layer and hides
   * its own overlay choice; NASA's averages stay context, never a result.
   */
  overlay?: OverlayId | "none";
  /** The overlay's opacity when `overlay` is set from outside, 0 to 1. Default 0.65. */
  overlayOpacity?: number;
  /**
   * Optional: receives a projector with the same shape as the 3D scene's (`SceneProjector`
   * on the Slip Planner's branch): where a place is on screen now, and a callback after every
   * drawn frame, so things drawn over the map can follow it without React. Called with null
   * when the map unmounts.
   */
  onProjector?: (projector: MapProjector | null) => void;
};

/** Where a place is on the map's screen now, in CSS pixels from the map box's top left. */
export type MapScreenPoint = { x: number; y: number; visible: boolean };

/** The map's projector: the same shape as the 3D scene's `SceneProjector`. */
export type MapProjector = {
  project: (latDeg: number, lonDeg: number) => MapScreenPoint;
  subscribe: (onFrame: () => void) => () => void;
};

type Point = { latDeg: number; lonDeg: number };

type Readout =
  | { kind: "point"; at: Point }
  | { kind: "nudge"; siteId: string; at: Point; dragging: boolean }
  | { kind: "catalog"; siteId: string };

const OVERLAY_TINT: Record<OverlayId, keyof Palette> = { sunlight: "sun", earthvis: "earth" };
const KEY_PAN_PX = 60;
const KEY_MOVE_PX = 8;
const SHARP_RELIEF = "hillshade_8k.webp";
/** How long the map stays zoomed out before it lets the 8K relief go. */
const SHARP_RELEASE_MS = 20_000;
const KEY_NUDGE_M = 100;
const KEY_NUDGE_BIG_M = 1000;
/** Starting a nudge zooms in to at least 40 m a pixel, so a 100 m step shows. */
const NUDGE_MIN_K = 1000 / 40;
const ZOOM_STEP = 1.6;

/** Reports a selected site's status for the landing date, from the evaluation hooks. */
function PinStatus({ siteId, scenario, onState }: { siteId: string; scenario: Scenario; onState: (id: string, state: PinState) => void }) {
  const result = useEvaluation(siteId, scenario.profile, scenario.landingUtc);
  const state: PinState =
    result.status === "loading"
      ? { kind: "loading" }
      : result.status === "error"
        ? { kind: "error" }
        : result.data === null
          ? { kind: "none" }
          : { kind: "status", status: result.data.status };
  const key = state.kind === "status" ? state.status : state.kind;
  useEffect(() => onState(siteId, state), [siteId, key]);
  return null;
}

/** Loads both lookup grids once the relief is drawn, and hands them up. */
function Lookups({ onGrids }: { onGrids: (grids: Partial<Record<OverlayId, Uint8Array>>) => void }) {
  const sunlight = useMapLookup("sunlight_u8.bin");
  const earthvis = useMapLookup("earthvis_u8.bin");
  useEffect(() => {
    onGrids({
      sunlight: sunlight.status === "ready" ? sunlight.data : undefined,
      earthvis: earthvis.status === "ready" ? earthvis.data : undefined,
    });
  }, [sunlight.status, earthvis.status]);
  return null;
}

function useBoxSize(ref: RefObject<HTMLElement | null>): { width: number; height: number } {
  const [size, setSize] = useState({ width: 0, height: 0 });
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const measure = () => setSize({ width: node.clientWidth, height: node.clientHeight });
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [ref]);
  return size;
}

export const MapCore = memo(function MapCore(props: MapCoreProps) {
  const { scenario, mode, active, reduceMotion } = props;
  const lesson = mode === "lesson";
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  const box = useBoxSize(boxRef);

  // ── Data ──
  const sitesResult = useSites();
  const featuresResult = useFeatures();
  const metaResult = useMapsMeta();
  const catalog = sitesResult.status === "ready" ? sitesResult.data : null;
  const sites = props.sites ?? catalog;
  const features = featuresResult.status === "ready" ? featuresResult.data : null;
  const halfWidthM = metaResult.status === "ready" ? metaResult.data.half_width_m : DEFAULT_HALF_WIDTH_M;
  const lookupSize = (layer: OverlayId) => {
    const meta = metaResult.status === "ready" ? metaResult.data.layers[layer] : undefined;
    return meta && typeof meta.lookup_size === "number" ? meta.lookup_size : null;
  };
  const siteById = useCallback((id: string) => sites?.find((site) => site.id === id) ?? null, [sites]);

  const [pinStates, setPinStates] = useState<ReadonlyMap<string, PinState>>(new Map());
  const onPinState = useCallback((id: string, state: PinState) => {
    setPinStates((current) => {
      const next = new Map(current);
      next.set(id, state);
      return next;
    });
  }, []);

  // ── The view ──
  const frame = useMemo<Rect>(
    () => props.frame ?? { x: 0, y: 0, width: box.width, height: box.height },
    [props.frame?.x, props.frame?.y, props.frame?.width, props.frame?.height, box.width, box.height],
  );
  const fit = useMemo(() => fitView({ rect: frame, boxHeight: box.height }, halfWidthM), [frame, box.height, halfWidthM]);
  const viewRef = useRef<MapView>(props.openAt ?? fit);
  const [view, setView] = useState<MapView>(viewRef.current);
  const userMoved = useRef(false);
  const zoomRef = useRef<ZoomBehavior<HTMLCanvasElement, unknown> | null>(null);
  const animation = useRef<number | null>(null);
  const viewFrame = useRef<number | null>(null);

  const dpr = typeof window === "undefined" ? 1 : Math.min(window.devicePixelRatio || 1, 2);

  // ── Images: the 4K relief first, the 8K once zoomed in, overlays after the first paint ──
  const relief4k = useMapImage("hillshade_4k.webp");
  const [wantSharp, setWantSharp] = useState(false);
  const relief8k = useMapImage(wantSharp ? SHARP_RELIEF : null);
  const firstPaint = relief4k.status === "ready" || relief4k.status === "error";
  const [ownOverlay, setOverlay] = useState<OverlayId | "none">("none");
  const [ownOpacity, setOpacity] = useState(0.65);
  const outsideOverlay = props.overlay !== undefined;
  const overlay = props.overlay ?? ownOverlay;
  const opacity = outsideOverlay ? (props.overlayOpacity ?? 0.65) : ownOpacity;
  const wantOverlays = firstPaint && (!lesson || outsideOverlay);
  const sunImage = useMapImage(wantOverlays ? "sunlight_4k.webp" : null);
  const earthImage = useMapImage(wantOverlays ? "earthvis_4k.webp" : null);
  const [grids, setGrids] = useState<Partial<Record<OverlayId, Uint8Array>>>({});
  const gridFor = useCallback(
    (layer: OverlayId): LookupGrid | null => {
      const values = grids[layer];
      const size = lookupSize(layer);
      return values && size ? { values, size, halfWidthM } : null;
    },
    [grids, halfWidthM, metaResult.status],
  );

  // ── Readouts ──
  const [readout, setReadout] = useState<Readout | null>(null);
  const [hover, setHover] = useState<{ at: ScreenPoint; point: Point } | null>(null);
  const [keyHint, setKeyHint] = useState(false);
  const readoutRef = useRef(readout);
  readoutRef.current = readout;

  const focusedId = scenario.focusedSiteId;
  const focusedSite = focusedId ? siteById(focusedId) : null;

  // ── Pins ──
  const pins = useMemo(
    () =>
      sites
        ? placePins({
            sites,
            selectedIds: scenario.siteIds,
            focusedId,
            states: pinStates,
            view,
            halfWidthM,
          })
        : [],
    [sites, scenario.siteIds, focusedId, pinStates, view, halfWidthM],
  );
  const pinsRef = useRef<PlacedPin[]>(pins);
  pinsRef.current = pins;
  const offMap = useMemo(
    () => (sites ? scenario.siteIds.map((id) => siteById(id)).filter((s): s is Site => Boolean(s) && !onMap(s as Site, halfWidthM)) : []),
    [sites, scenario.siteIds, siteById, halfWidthM],
  );

  // ── Applying a view, through d3-zoom so its state stays in step ──
  const frameRef = useRef(frame);
  frameRef.current = frame;
  const halfWidthRef = useRef(halfWidthM);
  halfWidthRef.current = halfWidthM;
  const apply = useCallback((wanted: MapView) => {
    const next = clampView(wanted, frameRef.current, halfWidthRef.current);
    const canvas = canvasRef.current;
    const behaviour = zoomRef.current;
    if (!canvas || !behaviour) {
      viewRef.current = next;
      setView(next);
      return;
    }
    behaviour.transform(select(canvas), zoomIdentity.translate(next.x, next.y).scale(next.k));
  }, []);

  const animateTo = useCallback(
    (target: MapView) => {
      if (animation.current !== null) cancelAnimationFrame(animation.current);
      const from = viewRef.current;
      if (reduceMotion) {
        apply(target);
        return;
      }
      const start = performance.now();
      const ms = 220;
      const step = (now: number) => {
        const t = Math.min(1, (now - start) / ms);
        const e = 1 - Math.pow(1 - t, 3);
        // Zoom in log space so the motion reads evenly at every scale.
        const k = Math.exp(Math.log(from.k) + (Math.log(target.k) - Math.log(from.k)) * e);
        apply({ k, x: from.x + (target.x - from.x) * e, y: from.y + (target.y - from.y) * e });
        animation.current = t < 1 ? requestAnimationFrame(step) : null;
      };
      animation.current = requestAnimationFrame(step);
    },
    [apply, reduceMotion],
  );

  // d3-zoom on the canvas: drag to pan, wheel or pinch to zoom. A press on the focused pin
  // is a nudge, not a pan.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const behaviour = d3zoom<HTMLCanvasElement, unknown>()
      .scaleExtent(zoomExtent(fit))
      .clickDistance(4)
      // Pan stops before the map leaves the free space.
      .constrain((transform) => {
        const c = clampView({ k: transform.k, x: transform.x, y: transform.y }, frameRef.current, halfWidthRef.current);
        return c.x === transform.x && c.y === transform.y ? transform : zoomIdentity.translate(c.x, c.y).scale(c.k);
      })
      .filter((event: MouseEvent | TouchEvent | WheelEvent) => {
        if (!activeRef.current) return false;
        if (event.type === "wheel") return true;
        if ("button" in event && event.button !== 0) return false;
        if (event.type === "mousedown" || event.type === "touchstart") {
          const point = eventPoint(canvas, event);
          if (point && onFocusedPin(point)) return false;
        }
        return !event.ctrlKey;
      })
      .on("zoom", (event: D3ZoomEvent<HTMLCanvasElement, unknown>) => {
        const t = event.transform;
        viewRef.current = { k: t.k, x: t.x, y: t.y };
        if (event.sourceEvent) {
          userMoved.current = true;
          setHover(null);
        }
        if (viewFrame.current === null) {
          viewFrame.current = requestAnimationFrame(() => {
            viewFrame.current = null;
            setView(viewRef.current);
          });
        }
      });
    zoomRef.current = behaviour;
    const selection = select(canvas);
    selection.call(behaviour).on("dblclick.zoom", null);
    behaviour.transform(selection, zoomIdentity.translate(viewRef.current.x, viewRef.current.y).scale(viewRef.current.k));
    return () => {
      selection.on(".zoom", null);
      zoomRef.current = null;
    };
    // The behaviour is made once; its extent follows the fit below.
  }, []);

  useEffect(() => {
    zoomRef.current?.scaleExtent(zoomExtent(fit));
  }, [fit]);

  // Until the user moves the map, it follows the free space: centred in it, at its fit.
  const opened = useRef(false);
  useEffect(() => {
    if (box.width === 0 || box.height === 0) return;
    if (!opened.current) {
      opened.current = true;
      apply(props.openAt ?? fit);
      return;
    }
    if (!userMoved.current) apply(fit);
  }, [fit, box.width, box.height]);

  // A point that is outside the free space slides into its middle, zooming in to `minK` if
  // the map is further out than that.
  const bringIntoView = useCallback(
    (latDeg: number, lonDeg: number, minK = 0) => {
      const v = viewRef.current;
      const at = latLonToScreen(latDeg, lonDeg, v);
      const inside = at.x > frame.x + 24 && at.x < frame.x + frame.width - 24 && at.y > frame.y + 24 && at.y < frame.y + frame.height - 24;
      if (inside && v.k >= minK) return;
      const k = Math.max(v.k, minK);
      const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      // Put the point at the centre, at scale k: the pole moves with the zoom about the point.
      const f = k / v.k;
      animateTo({ k, x: centre.x - (at.x - v.x) * f, y: centre.y - (at.y - v.y) * f });
    },
    [frame, animateTo],
  );

  // A newly focused site that is off screen slides into view.
  const lastFocused = useRef(focusedId);
  useEffect(() => {
    if (lastFocused.current === focusedId) return;
    lastFocused.current = focusedId;
    if (!focusedSite || !onMap(focusedSite, halfWidthM)) return;
    bringIntoView(focusedSite.lat_deg, focusedSite.lon_deg);
  }, [focusedId]);

  // The 8K relief loads once zoomed in, and is let go after 20 s zoomed back out, so the
  // tab's memory falls back (DEVLOG, T7 review).
  const sharpLevel = reliefLevel(view, dpr, halfWidthM);
  useEffect(() => {
    if (sharpLevel === "8k") {
      setWantSharp(true);
      return;
    }
    if (!wantSharp) return;
    const timer = window.setTimeout(() => {
      setWantSharp(false);
      releaseMapImage(SHARP_RELIEF);
    }, SHARP_RELEASE_MS);
    return () => window.clearTimeout(timer);
  }, [sharpLevel, wantSharp]);

  // Leaving the view lets the 8K relief and the overlay images go. The 4K relief stays, so
  // coming back draws at once.
  useEffect(
    () => () => {
      releaseMapImage(SHARP_RELIEF);
      releaseMapImage("sunlight_4k.webp");
      releaseMapImage("earthvis_4k.webp");
    },
    [],
  );

  // ── Drawing ──
  const palette = useRef<Palette | null>(null);
  const [fontsReady, setFontsReady] = useState(0);
  useEffect(() => {
    let live = true;
    document.fonts?.ready.then(() => live && setFontsReady((n) => n + 1));
    return () => {
      live = false;
    };
  }, []);

  const marker = useMemo<Marker | null>(() => {
    if (!readout || readout.kind === "catalog") return null;
    const at = latLonToScreen(readout.at.latDeg, readout.at.lonDeg, view);
    if (readout.kind === "point") return { kind: "point", at };
    const site = siteById(readout.siteId);
    if (!site) return null;
    return { kind: "nudge", at, from: latLonToScreen(site.lat_deg, site.lon_deg, view), dragging: readout.dragging };
  }, [readout, view, siteById]);

  const overlayImage = overlay === "sunlight" ? sunImage : overlay === "earthvis" ? earthImage : null;
  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || box.width === 0) return;
    const w = Math.round(box.width * dpr);
    const h = Math.round(box.height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    palette.current ??= readPalette(canvas);
    if (!scratchRef.current) scratchRef.current = document.createElement("canvas");
    const relief = relief8k.status === "ready" ? relief8k.image : relief4k.status === "ready" ? relief4k.image : null;
    drawMap({
      ctx,
      width: box.width,
      height: box.height,
      dpr,
      view,
      halfWidthM,
      palette: palette.current,
      relief,
      overlay:
        overlay !== "none" && overlayImage?.status === "ready"
          ? { image: overlayImage.image, tint: palette.current[OVERLAY_TINT[overlay]], opacity }
          : null,
      scratch: scratchRef.current,
      pins,
      features: props.showFeatureNames === false ? [] : (features ?? []),
      compact: lesson,
      marker,
    });
    for (const listener of frameListeners.current) listener();
  }, [view, box.width, box.height, dpr, pins, features, props.showFeatureNames, marker, relief4k.status, relief8k.status, overlay, overlayImage?.status, opacity, fontsReady, halfWidthM, lesson]);

  // The projector for things drawn over the map (`onProjector`).
  const frameListeners = useRef(new Set<() => void>());
  const { onProjector } = props;
  useEffect(() => {
    if (!onProjector) return;
    const projector: MapProjector = {
      project: (latDeg, lonDeg) => {
        const at = latLonToScreen(latDeg, lonDeg, viewRef.current);
        const node = boxRef.current;
        const visible = Boolean(node) && at.x >= 0 && at.y >= 0 && at.x <= (node?.clientWidth ?? 0) && at.y <= (node?.clientHeight ?? 0);
        return { x: at.x, y: at.y, visible };
      },
      subscribe: (onFrame) => {
        frameListeners.current.add(onFrame);
        return () => frameListeners.current.delete(onFrame);
      },
    };
    onProjector(projector);
    return () => onProjector(null);
  }, [onProjector]);

  // ── Input ──
  const activeRef = useRef(active);
  activeRef.current = active;

  const onFocusedPin = useCallback(
    (point: ScreenPoint) => {
      const pin = pinAt(pinsRef.current, point);
      return Boolean(pin && pin.focused && pin.drawAt.x === pin.at.x && pin.drawAt.y === pin.at.y);
    },
    [],
  );

  const drag = useRef<{ id: number; start: ScreenPoint; moved: boolean } | null>(null);
  // A nudge drag ends in a click on the canvas; that click must not mark a new point.
  const suppressClick = useRef(false);

  const startNudge = useCallback(
    (siteId: string) => {
      const site = siteById(siteId);
      if (!site) return;
      setReadout({ kind: "nudge", siteId, at: { latDeg: site.lat_deg, lonDeg: site.lon_deg }, dragging: false });
      // Close enough that a 100 m step shows (40 m a pixel).
      bringIntoView(site.lat_deg, site.lon_deg, NUDGE_MIN_K);
      userMoved.current = true;
    },
    [siteById, bringIntoView],
  );

  const onPointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!active || event.button !== 0 || !focusedId) return;
    const point = localPoint(event);
    if (!onFocusedPin(point)) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id: event.pointerId, start: point, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!active) return;
    const point = localPoint(event);
    const d = drag.current;
    if (d && d.id === event.pointerId && focusedId) {
      if (!d.moved && Math.hypot(point.x - d.start.x, point.y - d.start.y) < 4) return;
      d.moved = true;
      const at = screenToLatLon(point.x, point.y, viewRef.current);
      setReadout({ kind: "nudge", siteId: focusedId, at, dragging: true });
      setHover(null);
      return;
    }
    if (event.pointerType !== "mouse" || event.buttons !== 0) {
      setHover(null);
      return;
    }
    const pin = pinAt(pinsRef.current, point);
    event.currentTarget.style.cursor = pin ? (pin.focused ? "grab" : "pointer") : "";
    setHover({ at: point, point: screenToLatLon(point.x, point.y, viewRef.current) });
  };

  const onPointerUp = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const d = drag.current;
    if (!d || d.id !== event.pointerId) return;
    drag.current = null;
    if (!d.moved) return;
    suppressClick.current = true;
    // The catalog site does not move: the pin returns, the readout stays.
    setReadout((current) => (current?.kind === "nudge" ? { ...current, dragging: false } : current));
  };

  const onClick = (event: ReactMouseEvent<HTMLCanvasElement>) => {
    if (!active) return;
    if (suppressClick.current) {
      suppressClick.current = false;
      return;
    }
    const point = localPoint(event);
    const pin = pinAt(pinsRef.current, point);
    if (pin) {
      if (pin.selected) props.onFocusSite?.(pin.site.id);
      else setReadout({ kind: "catalog", siteId: pin.site.id });
      if (pin.folded.length > 0) {
        animateTo(zoomTowards(viewRef.current, 3, pin.drawAt, zoomExtent(fit)));
      }
      return;
    }
    const current = readoutRef.current;
    if (current?.kind === "nudge" && current.dragging) return;
    setReadout({ kind: "point", at: screenToLatLon(point.x, point.y, viewRef.current) });
  };

  const zoomBy = useCallback(
    (factor: number) => {
      userMoved.current = true;
      const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      animateTo(zoomTowards(viewRef.current, factor, centre, zoomExtent(fit)));
    },
    [animateTo, frame, fit],
  );
  const reset = useCallback(() => {
    userMoved.current = false;
    animateTo(fit);
  }, [animateTo, fit]);

  /**
   * Arrow keys move the open point: the "New site here?" point by screen pixels, the nudged
   * pin by a fixed distance on the ground (100 m, or 1 km with Shift), so a keyboard nudge is
   * as small as a drag when zoomed in, at any zoom.
   */
  const moveReadoutBy = (dirX: number, dirY: number, big: boolean) => {
    const current = readoutRef.current;
    if (!current || current.kind === "catalog") return false;
    let next: Point;
    if (current.kind === "nudge") {
      const step = big ? KEY_NUDGE_BIG_M : KEY_NUDGE_M;
      const { x_m, y_m } = polarStereoForward(current.at.latDeg, current.at.lonDeg);
      next = polarStereoInverse(x_m + dirX * step, y_m - dirY * step);
      setReadout({ ...current, at: next, dragging: false });
    } else {
      const at = latLonToScreen(current.at.latDeg, current.at.lonDeg, viewRef.current);
      const px = KEY_MOVE_PX * (big ? 5 : 1);
      next = screenToLatLon(at.x + dirX * px, at.y + dirY * px, viewRef.current);
      setReadout({ ...current, at: next });
    }
    return true;
  };

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (!active || event.target !== event.currentTarget) return;
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    const big = event.shiftKey ? 5 : 1;
    const arrows: Record<string, [number, number]> = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    };
    const arrow = arrows[event.key];
    if (arrow) {
      event.preventDefault();
      if (moveReadoutBy(arrow[0], arrow[1], event.shiftKey)) return;
      userMoved.current = true;
      const v = viewRef.current;
      // Arrows move the view: the map slides the other way.
      animateTo({ k: v.k, x: v.x - arrow[0] * KEY_PAN_PX * big, y: v.y - arrow[1] * KEY_PAN_PX * big });
      return;
    }
    if (event.key === "+" || event.key === "=") {
      event.preventDefault();
      zoomBy(ZOOM_STEP);
    } else if (event.key === "-" || event.key === "_" || event.key === "−") {
      event.preventDefault();
      zoomBy(1 / ZOOM_STEP);
    } else if (event.key === "0") {
      event.preventDefault();
      reset();
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (readoutRef.current?.kind === "point" || readoutRef.current?.kind === "nudge") return;
      const centre = { x: frame.x + frame.width / 2, y: frame.y + frame.height / 2 };
      setReadout({ kind: "point", at: screenToLatLon(centre.x, centre.y, viewRef.current) });
    } else if ((event.key === "n" || event.key === "N") && focusedSite && onMap(focusedSite, halfWidthM)) {
      event.preventDefault();
      startNudge(focusedSite.id);
    } else if (event.key === "Escape" && readoutRef.current) {
      event.preventDefault();
      event.stopPropagation();
      setReadout(null);
    }
  };

  // Leaving the view or losing input closes the readouts.
  useEffect(() => {
    if (!active) {
      setReadout(null);
      setHover(null);
    }
  }, [active]);

  // ── What the readouts say ──
  const valueAt = (layer: OverlayId, at: Point) => {
    const grid = gridFor(layer);
    return grid ? readLookup(grid, at.latDeg, at.lonDeg) : null;
  };
  const overlaysReady = sunImage.status === "ready" && earthImage.status === "ready";
  const narrow = box.width > 0 && box.width < 640;
  const scale = scaleBar(view, lesson || narrow ? 72 : 110);

  const centreOfFrame = { left: frame.x + frame.width / 2 };

  return (
    <div
      ref={boxRef}
      className={cx("pm", lesson && "pm-lesson")}
      data-frame={`${Math.round(frame.x)},${Math.round(frame.y)},${Math.round(frame.width)},${Math.round(frame.height)}`}
      data-active={active}
      role="application"
      aria-roledescription="map"
      aria-label="Polar map of the south pole, 80°S to the pole"
      aria-describedby="pm-keys"
      tabIndex={active ? 0 : -1}
      onKeyDown={onKeyDown}
      onFocus={(event) => event.target === event.currentTarget && setKeyHint(event.currentTarget.matches(":focus-visible"))}
      onBlur={() => setKeyHint(false)}
    >
      {scenario.siteIds.map((id) => (
        <PinStatus key={id} siteId={id} scenario={scenario} onState={onPinState} />
      ))}
      {firstPaint ? <Lookups onGrids={setGrids} /> : null}

      <canvas
        ref={canvasRef}
        className="pm-canvas"
        aria-hidden="true"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => setHover(null)}
        onClick={onClick}
      />

      <p id="pm-keys" className={cx("plate pm-keys", !keyHint && "sr-only")} style={keyHint ? { left: centreOfFrame.left, top: frame.y + 8 } : undefined}>
        Arrows pan · + and − zoom · 0 resets · Enter marks a point · N nudges the focused pin · Esc clears
      </p>

      {relief4k.status === "error" ? (
        <p className="plate pm-note" style={{ left: centreOfFrame.left, top: frame.y + frame.height / 2 }}>
          The relief image could not load. Pins and rings still show.
        </p>
      ) : null}

      {hover && !readout ? (
        <HoverReadout hover={hover} overlay={overlay} value={overlay === "none" ? null : valueAt(overlay, hover.point)} box={box} />
      ) : null}

      {readout ? (
        <ReadoutCard
          readout={readout}
          view={view}
          frame={frame}
          siteById={siteById}
          valueAt={valueAt}
          gridsReady={Boolean(gridFor("sunlight") && gridFor("earthvis"))}
          onClose={() => {
            setReadout(null);
            boxRef.current?.focus({ preventScroll: true });
          }}
          onRequestSite={props.onRequestSite}
          onFocusSite={props.onFocusSite}
          onAddSite={props.onAddSite}
          selectedIds={scenario.siteIds}
        />
      ) : null}

      <div
        className="pm-foot"
        style={{ left: frame.x, width: frame.width, top: frame.y + frame.height }}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <div className="pm-controls panel">
          <div className="pm-zoom" role="group" aria-label="Zoom">
            <IconButton label="Zoom out" hint="(−)" icon={<Minus size={16} strokeWidth={1.8} />} onClick={() => zoomBy(1 / ZOOM_STEP)} />
            <IconButton label="Zoom in" hint="(+)" icon={<Plus size={16} strokeWidth={1.8} />} onClick={() => zoomBy(ZOOM_STEP)} />
            <IconButton label="Reset the map" hint="(0)" icon={<RotateCcw size={15} strokeWidth={1.8} />} onClick={reset} />
          </div>
          {lesson || outsideOverlay ? null : (
            <div className="pm-overlay">
              {narrow ? (
                <label className="pm-select">
                  <span className="sr-only">Overlay</span>
                  <select value={overlay} onChange={(event) => setOverlay(event.target.value as OverlayId | "none")}>
                    <option value="none">No overlay</option>
                    <option value="sunlight" disabled={!overlaysReady}>
                      {overlaysReady ? "Sunlight" : "Sunlight (loading)"}
                    </option>
                    <option value="earthvis" disabled={!overlaysReady}>
                      {overlaysReady ? "Earth visibility" : "Earth visibility (loading)"}
                    </option>
                  </select>
                </label>
              ) : (
              <SegmentedControl<OverlayId | "none">
                label="Overlay"
                value={overlay}
                onChange={setOverlay}
                options={[
                  { value: "none", label: "No overlay" },
                  { value: "sunlight", label: overlaysReady ? "Sunlight" : "Loading", disabled: !overlaysReady },
                  { value: "earthvis", label: overlaysReady ? "Earth visibility" : "Loading", disabled: !overlaysReady },
                ]}
              />
              )}
              {overlay !== "none" ? (
                <label className="pm-opacity">
                  <span className="sr-only">Overlay opacity</span>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={opacity}
                    onChange={(event) => setOpacity(Number(event.target.value))}
                    aria-valuetext={`${Math.round(opacity * 100)} percent`}
                  />
                </label>
              ) : null}
            </div>
          )}
          <div className="pm-scale" aria-label={`Scale: ${scale.text}`}>
            <span className="pm-scale-bar" style={{ width: scale.px }} aria-hidden="true" />
            <span className="pm-scale-text">{scale.text}</span>
          </div>
          {overlay !== "none" ? (
            <p className="pm-caveat">
              <span className={cx("pm-swatch", overlay === "sunlight" ? "pm-swatch-sun" : "pm-swatch-earth")} aria-hidden="true" />
              {OVERLAY_NAME[overlay]}, dark to bright: an 18.6-year average, not for your date.
            </p>
          ) : null}
        </div>
        {!lesson && offMap.length > 0 ? (
          <div className="pm-off panel" aria-label="Selected sites outside the map">
            <p className="pm-off-title">Outside the map</p>
            <ul>
              {offMap.map((site) => (
                <li key={site.id}>
                  <span>{site.name}</span>
                  <Button onClick={() => props.onShowOnMoon?.(site.id)}>Show on Moon</Button>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <p className="sr-only" role="status">
        {readout ? liveText(readout, siteById, valueAt) : ""}
      </p>
    </div>
  );
});

function localPoint(event: { clientX: number; clientY: number; currentTarget: Element }): ScreenPoint {
  const rect = event.currentTarget.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function eventPoint(canvas: HTMLCanvasElement, event: MouseEvent | TouchEvent): ScreenPoint | null {
  const rect = canvas.getBoundingClientRect();
  if ("touches" in event) {
    const touch = event.touches[0];
    return touch ? { x: touch.clientX - rect.left, y: touch.clientY - rect.top } : null;
  }
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function zoomTowards(view: MapView, factor: number, at: ScreenPoint, extent: [number, number]): MapView {
  const k = Math.min(extent[1], Math.max(extent[0], view.k * factor));
  const f = k / view.k;
  return { k, x: at.x - (at.x - view.x) * f, y: at.y - (at.y - view.y) * f };
}

type ValueAt = (layer: OverlayId, at: Point) => ReturnType<typeof readLookup> | null;

function liveText(readout: Readout, siteById: (id: string) => Site | null, valueAt: ValueAt): string {
  if (readout.kind === "catalog") return `${siteById(readout.siteId)?.name ?? readout.siteId}: not in your sites.`;
  const where = coordinatesText(readout.at.latDeg, readout.at.lonDeg);
  const sun = valueAt("sunlight", readout.at);
  const earth = valueAt("earthvis", readout.at);
  const values = sun && earth ? `Average sunlight ${lookupText(sun)}, average Earth visibility ${lookupText(earth)}.` : "";
  return readout.kind === "point" ? `New site here? ${where}. ${values}` : `Nudged pin at ${where}. ${values}`;
}

function HoverReadout({
  hover,
  overlay,
  value,
  box,
}: {
  hover: { at: ScreenPoint; point: Point };
  overlay: OverlayId | "none";
  value: ReturnType<typeof readLookup> | null;
  box: { width: number; height: number };
}) {
  const right = hover.at.x > box.width - 260;
  const style: CSSProperties = {
    top: Math.min(box.height - 60, hover.at.y + 16),
    ...(right ? { right: box.width - hover.at.x + 12 } : { left: hover.at.x + 16 }),
  };
  return (
    <div className="plate pm-hover" style={style} aria-hidden="true">
      <span className="tabular">{coordinatesText(hover.point.latDeg, hover.point.lonDeg)}</span>
      {overlay !== "none" ? (
        <span className="tabular">
          {OVERLAY_NAME[overlay]} {value ? lookupText(value) : "loading"}
        </span>
      ) : null}
    </div>
  );
}

type ReadoutCardProps = {
  readout: Readout;
  view: MapView;
  frame: Rect;
  siteById: (id: string) => Site | null;
  valueAt: ValueAt;
  gridsReady: boolean;
  onClose: () => void;
  onRequestSite?: (latDeg: number, lonDeg: number) => void;
  onFocusSite?: (siteId: string) => void;
  onAddSite?: (siteId: string) => void;
  selectedIds: readonly string[];
};

/** The readout card beside its point: "New site here?", the nudge, or a catalog pin. */
/**
 * Calls `onRequestSite` for a point: latitude in degrees, east longitude folded into 0 to 360
 * (the custom-site API's convention, docs/data-contracts.md).
 */
export function requestSiteAt(at: Point, onRequestSite: ((latDeg: number, lonDeg: number) => void) | undefined): void {
  if (!onRequestSite) return;
  onRequestSite(at.latDeg, wrapLongitude(at.lonDeg));
}

export function ReadoutCard(props: ReadoutCardProps) {
  const { readout, view, frame, siteById, valueAt, gridsReady } = props;
  const ref = useRef<HTMLElement>(null);
  const anchor = useMemo(() => {
    if (readout.kind === "catalog") {
      const site = siteById(readout.siteId);
      return site ? latLonToScreen(site.lat_deg, site.lon_deg, view) : { x: frame.x, y: frame.y };
    }
    return latLonToScreen(readout.at.latDeg, readout.at.lonDeg, view);
  }, [readout, view, frame, siteById]);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    const w = node.offsetWidth;
    const h = node.offsetHeight;
    const gap = 18;
    const roomRight = frame.x + frame.width - (anchor.x + gap);
    const roomLeft = anchor.x - gap - frame.x;
    // A nudge card opens to the left: a best-lit variant's callout sits up and to the right.
    const preferLeft = readout.kind === "nudge" && roomLeft >= w;
    let left = !preferLeft && roomRight >= w ? anchor.x + gap : anchor.x - gap - w;
    left = Math.max(frame.x + 8, Math.min(left, frame.x + frame.width - w - 8));
    let top = anchor.y - h / 2;
    top = Math.max(frame.y + 8, Math.min(top, frame.y + frame.height - h - 8));
    setPosition((current) => (current && Math.abs(current.left - left) < 0.5 && Math.abs(current.top - top) < 0.5 ? current : { left, top }));
  });

  let body: ReactNode;
  if (readout.kind === "catalog") {
    const site = siteById(readout.siteId);
    const selected = props.selectedIds.includes(readout.siteId);
    body = (
      <>
        <h2 className="pm-card-title">{site?.name ?? readout.siteId}</h2>
        <p className="pm-card-line">{selected ? "In your sites." : "Not in your sites yet. Add it to see its status for your date."}</p>
        {!selected && props.onAddSite ? (
          <div className="pm-card-actions">
            <Button
              onClick={() => {
                props.onAddSite?.(readout.siteId);
                props.onFocusSite?.(readout.siteId);
                props.onClose();
              }}
            >
              Add to sites
            </Button>
          </div>
        ) : null}
      </>
    );
  } else {
    const at = readout.at;
    const sun = valueAt("sunlight", at);
    const earth = valueAt("earthvis", at);
    if (readout.kind === "point") {
      body = (
        <>
          <h2 className="pm-card-title">New site here?</h2>
          <p className="pm-card-line tabular">{coordinatesText(at.latDeg, at.lonDeg)}</p>
          {gridsReady && sun && earth ? (
            <dl className="pm-values">
              <div>
                <dt>NASA's average sunlight</dt>
                <dd className="tabular">{lookupText(sun)}</dd>
              </div>
              <div>
                <dt>NASA's average Earth visibility</dt>
                <dd className="tabular">{lookupText(earth)}</dd>
              </div>
            </dl>
          ) : (
            <p className="pm-card-line">Loading NASA's average maps…</p>
          )}
          <p className="pm-card-note">{AVERAGE_CAVEAT}</p>
          {props.onRequestSite ? (
            <div className="pm-card-actions">
              <Button onClick={() => requestSiteAt(at, props.onRequestSite)}>Compute this site</Button>
            </div>
          ) : null}
        </>
      );
    } else {
      const site = siteById(readout.siteId);
      const from = site ? { latDeg: site.lat_deg, lonDeg: site.lon_deg } : at;
      const sun0 = valueAt("sunlight", from);
      const earth0 = valueAt("earthvis", from);
      const moved = groundDistance(from, at);
      const variant = site ? variantOf(site, siteById, props.selectedIds) : null;
      body = (
        <>
          <h2 className="pm-card-title">
            {moved < 1 ? `Nudge ${site?.name ?? "the pin"}` : `${distanceText(moved)} from ${site?.name ?? "the site"}`}
          </h2>
          {gridsReady && sun && earth && sun0 && earth0 ? (
            <ul className="pm-nudge">
              <li className="tabular">{nudgeLine("sunlight", sun0, sun)}</li>
              <li className="tabular">{nudgeLine("earthvis", earth0, earth)}</li>
            </ul>
          ) : (
            <p className="pm-card-line">Loading NASA's average maps…</p>
          )}
          {/* Whose number this is, for the whole gesture: short while dragging. */}
          <p className="pm-card-note">{readout.dragging ? NUDGE_CAVEAT_SHORT : NUDGE_CAVEAT}</p>
          {readout.dragging ? null : (
            <>
              {moved < 1 ? <p className="pm-card-line">Drag the pin, or use the arrow keys, to see how the averages change.</p> : null}
              {site?.group === "sunlit_peak" && nearbyRangeText(site.nearby_sun) ? (
                <dl className="pm-range">
                  <dt>Nearby range, TrueSouth's six-year average sunlight</dt>
                  <dd className="tabular">{nearbyRangeText(site.nearby_sun)}</dd>
                </dl>
              ) : null}
              {variant ? (
                <p className="pm-card-line">
                  {variantLine(variant.site, site?.name ?? null)}, {CHOSEN_TAG}.{" "}
                  {variant.selected ? (
                    <Button variant="quiet" onClick={() => props.onFocusSite?.(variant.site.id)}>
                      Focus it
                    </Button>
                  ) : props.onAddSite ? (
                    <Button
                      variant="quiet"
                      onClick={() => {
                        props.onAddSite?.(variant.site.id);
                        props.onFocusSite?.(variant.site.id);
                      }}
                    >
                      Add it
                    </Button>
                  ) : null}
                </p>
              ) : null}
              {props.onRequestSite && moved >= 1 ? (
                <div className="pm-card-actions">
                  <Button onClick={() => requestSiteAt(at, props.onRequestSite)}>Compute this point</Button>
                </div>
              ) : null}
            </>
          )}
        </>
      );
    }
  }

  return (
    <section
      ref={ref}
      className="pm-card"
      data-kind={readout.kind}
      data-dragging={readout.kind === "nudge" && readout.dragging}
      aria-label={readout.kind === "point" ? "New site here?" : readout.kind === "nudge" ? "Nudge readout" : "Catalog site"}
      style={position ?? { left: -9999, top: -9999 }}
    >
      {readout.kind === "nudge" && readout.dragging ? null : (
        <IconButton className="pm-card-close" label="Close" hint="(Esc)" icon={<X size={15} strokeWidth={1.8} />} onClick={props.onClose} />
      )}
      {body}
    </section>
  );
}

/**
 * Ground distance between two nearby points: their distance on the map plane, divided by the
 * map's scale factor there (docs/science.md §2.3). For a readout only.
 */
function groundDistance(a: Point, b: Point): number {
  const pa = polarStereoForward(a.latDeg, a.lonDeg);
  const pb = polarStereoForward(b.latDeg, b.lonDeg);
  return Math.hypot(pa.x_m - pb.x_m, pa.y_m - pb.y_m) / polarStereoScale((a.latDeg + b.latDeg) / 2);
}

/** A site's best-lit variant, if the catalog has one (decision 0012). */
function variantOf(site: Site, siteById: (id: string) => Site | null, selectedIds: readonly string[]) {
  const id = `${site.id}_best_lit`;
  const variant = siteById(id);
  if (!variant || variant.variant_of !== site.id) return null;
  return { site: variant, selected: selectedIds.includes(id) };
}
