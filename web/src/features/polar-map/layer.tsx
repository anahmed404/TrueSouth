/**
 * The Polar map in Mission Control: a flat layer over the scene (`FlatLayer` in
 * app/scene.ts). When the camera view is the Polar map, the flat map takes over from the globe
 * once the flight lands, at the same scale and position; leaving hands the scene back
 * (docs/features/polar-map.md, "How it is entered and left").
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FlatLayer, FlatLayerProps, SceneArrival } from "../../app/scene";
import { prefetchContext } from "./context";
import { MapCore } from "./map";
import { ARRIVAL_TIMEOUT_MS, entryFor, takeoverView } from "./takeover";
import { CONTROLS_FOOT_PX, type MapView } from "./view";

export type PolarMapLayerOptions = {
  /** Compute a custom site at a point (the custom-site API). Without it, no button shows. */
  onRequestSite?: (latDeg: number, lonDeg: number) => void;
};

type Phase =
  /** Not the Polar map: nothing mounted. */
  | { kind: "off" }
  /** The camera is flying there: the map waits behind the globe. */
  | { kind: "waiting"; since: SceneArrival | null }
  /** On screen, fading in, at this view. */
  | { kind: "shown"; openAt: MapView | null; fadeMs: number }
  /** Another view was picked: fading out, then off. */
  | { kind: "leaving"; openAt: MapView | null; fadeMs: number };

function makeLayer(options: PolarMapLayerOptions) {
  return function PolarMapLayer(props: FlatLayerProps) {
    const { view, mode, reduceMotion, arrival, freeSpace } = props;
    const isMap = view === "map";
    const [phase, setPhase] = useState<Phase>({ kind: "off" });
    const arrivalRef = useRef(arrival);
    arrivalRef.current = arrival;

    // Entering and leaving. The Moon around the square starts building during the flight.
    useEffect(() => {
      if (isMap) {
        prefetchContext();
        const entry = entryFor(mode, reduceMotion);
        setPhase((current) => {
          if (current.kind === "shown") return current;
          if (current.kind === "leaving") return { kind: "shown", openAt: current.openAt, fadeMs: current.fadeMs };
          if (!entry.wait) return { kind: "shown", openAt: null, fadeMs: entry.fadeMs };
          // An arrival already in hand is from an earlier flight; wait for a new one.
          return { kind: "waiting", since: arrivalRef.current };
        });
        return;
      }
      setPhase((current) => (current.kind === "shown" ? { kind: "leaving", openAt: current.openAt, fadeMs: current.fadeMs } : { kind: "off" }));
    }, [isMap, mode, reduceMotion]);

    // The flight lands: take over at its scale.
    useEffect(() => {
      if (phase.kind !== "waiting") return;
      if (arrival && arrival !== phase.since && arrival.view === "map") {
        setPhase({ kind: "shown", openAt: takeoverView(arrival, { x: 0, y: 0 }, window.innerHeight), fadeMs: entryFor(mode, reduceMotion).fadeMs });
      }
    }, [arrival, phase, mode, reduceMotion]);

    // No arrival in time (the scene snapped, or its first flight is still loading): open anyway.
    useEffect(() => {
      if (phase.kind !== "waiting") return;
      const timer = window.setTimeout(() => setPhase({ kind: "shown", openAt: null, fadeMs: entryFor(mode, reduceMotion).fadeMs }), ARRIVAL_TIMEOUT_MS);
      return () => window.clearTimeout(timer);
    }, [phase.kind, mode, reduceMotion]);

    // The fade out ends: unmount.
    useEffect(() => {
      if (phase.kind !== "leaving") return;
      const timer = window.setTimeout(() => setPhase({ kind: "off" }), phase.fadeMs);
      return () => window.clearTimeout(timer);
    }, [phase]);

    // Fade in on the frame after mounting, so the transition runs.
    const [shown, setShown] = useState(false);
    useEffect(() => {
      if (phase.kind !== "shown") {
        setShown(false);
        return;
      }
      const raf = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(raf);
    }, [phase.kind]);

    const frame = useMemo(
      () => ({ x: freeSpace.x, y: freeSpace.y, width: freeSpace.width, height: freeSpace.height }),
      [freeSpace.x, freeSpace.y, freeSpace.width, freeSpace.height],
    );
    const { onFocusSite, onViewChange, onAddSite } = props;
    const showOnMoon = useCallback(
      (siteId: string) => {
        onFocusSite(siteId);
        onViewChange("system");
      },
      [onFocusSite, onViewChange],
    );

    if (phase.kind === "off" || phase.kind === "waiting") return null;
    const fadeMs = phase.fadeMs;
    return (
      <div
        className="pm-layer"
        data-shown={shown && phase.kind === "shown"}
        data-open={phase.openAt ? "arrival" : "fit"}
        style={{ transitionDuration: `${fadeMs}ms` }}
        aria-hidden={phase.kind !== "shown"}
      >
        <MapCore
          scenario={props.scenario}
          mode="mission"
          frame={frame}
          fitFootPx={CONTROLS_FOOT_PX}
          openAt={phase.openAt}
          active={phase.kind === "shown" && !freeSpace.windowOpen}
          reduceMotion={reduceMotion}
          onFocusSite={onFocusSite}
          onAddSite={onAddSite}
          onShowOnMoon={showOnMoon}
          onRequestSite={options.onRequestSite}
        />
      </div>
    );
  };
}

/**
 * The Polar map as a flat layer for the scene slot. Pass `onRequestSite` once the custom-site
 * API is wired; keep the returned object stable (make it once, or in a `useMemo`), since a
 * new one remounts the map.
 */
export function polarMapLayer(options: PolarMapLayerOptions = {}): PolarMapFlatLayer {
  return { views: ["map"], Layer: makeLayer(options), onRequestSite: options.onRequestSite };
}

/** A flat layer for the scene slot, with the callback its map was made with. */
export type PolarMapFlatLayer = FlatLayer & PolarMapLayerOptions;

/** The Polar map layer with no custom-site button. */
export const POLAR_MAP_LAYER: PolarMapFlatLayer = polarMapLayer();
