import { useCallback, useSyncExternalStore } from "react";
import type { PanelProps } from "../../app/panel";
import { MapCore, type MapCoreProps } from "./map";

export { POLAR_MAP_LAYER, polarMapLayer, type PolarMapLayerOptions } from "./layer";
export type { MapProjector, MapScreenPoint } from "./map";
export type { OverlayId } from "./readout";

/**
 * The flat map's props: the panel props, plus the optional ones another view can use (the
 * Slip Planner's flat mode, the Academy's drop-pin step). See `MapCoreProps` for each.
 */
export type PolarMapProps = PanelProps &
  Pick<MapCoreProps, "onRequestSite" | "sites" | "showFeatureNames" | "overlay" | "overlayOpacity" | "onProjector" | "detailLabel">;

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
export default function PolarMap({ scenario, onScenarioChange, mode, onRequestSite, ...extra }: PolarMapProps) {
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
        sites={extra.sites}
        showFeatureNames={extra.showFeatureNames}
        overlay={extra.overlay}
        overlayOpacity={extra.overlayOpacity}
        onProjector={extra.onProjector}
        detailLabel={extra.detailLabel}
      />
    </div>
  );
}
