import { useCallback, useSyncExternalStore } from "react";
import type { PanelProps } from "../../app/panel";
import { MapCore } from "./map";

export { POLAR_MAP_LAYER, polarMapLayer, type PolarMapLayerOptions } from "./layer";

export type PolarMapProps = PanelProps & {
  /**
   * Optional: compute a custom site at a point. When given, the "New site here?" readout shows
   * "Compute this site" (and the nudge readout "Compute this point"); without it, no button.
   */
  onRequestSite?: (latDeg: number, lonDeg: number) => void;
};

const REDUCE_MOTION = "(prefers-reduced-motion: reduce)";

function useReduceMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const query = window.matchMedia(REDUCE_MOTION);
      query.addEventListener("change", onChange);
      return () => query.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCE_MOTION).matches,
    () => false,
  );
}

/**
 * The Polar map in a box of its own, for the Academy's lessons and any panel slot: the same
 * flat map as Mission Control's, filling its parent. In `mode: "lesson"` it shows the small
 * control set (zoom and reset, and the scale bar). Focusing and adding sites go through
 * `onScenarioChange`.
 */
export default function PolarMap({ scenario, onScenarioChange, mode, onRequestSite }: PolarMapProps) {
  const reduceMotion = useReduceMotion();
  const focus = useCallback(
    (siteId: string) => {
      if (scenario.siteIds.includes(siteId)) onScenarioChange?.({ focusedSiteId: siteId });
    },
    [scenario.siteIds, onScenarioChange],
  );
  const add = useCallback(
    (siteId: string) => {
      if (scenario.siteIds.includes(siteId)) return;
      onScenarioChange?.({ siteIds: [...scenario.siteIds, siteId], focusedSiteId: siteId });
    },
    [scenario.siteIds, onScenarioChange],
  );
  return (
    <div className="pm-embed">
      <MapCore
        scenario={scenario}
        mode={mode}
        frame={null}
        openAt={null}
        active
        reduceMotion={reduceMotion}
        onFocusSite={onScenarioChange ? focus : undefined}
        onAddSite={onScenarioChange ? add : undefined}
        onRequestSite={onRequestSite}
      />
    </div>
  );
}
