import type { TimeGrid } from "../../../contracts/generated.ts";
import type { DecodedSeries, DecodedSkyline } from "../../../data";
import { useManifest, useSeries, useSite, useSkyline } from "../../../data/hooks";
import { isSphere } from "../../../app/mission/site-status";
import { resolveValue, type WorkedExamples } from "../placeholders";
import type { SceneSpec } from "../types";

/** A lesson scene's site id, with its placeholder filled, or null while it has no value. */
export function sceneSiteId(scene: SceneSpec, examples: WorkedExamples): string | null {
  const raw = scene.scenario.focusedSiteId ?? scene.scenario.siteIds[0] ?? null;
  if (raw === null) return null;
  const resolved = resolveValue(raw, examples);
  return typeof resolved.value === "string" && resolved.value ? resolved.value : null;
}

export type SceneData = {
  grid: TimeGrid;
  name: string;
  /** No terrain is stored for the site: its stored skyline is the smooth Moon's. */
  sphere: boolean;
  series: DecodedSeries;
  skyline: DecodedSkyline;
  radii: { sun: number; earth: number };
};

export type SceneLoad =
  | { status: "loading"; name: string }
  | { status: "error"; name: string }
  | { status: "ready"; data: SceneData };

/** The stored data a drag-body or draw-skyline step draws from: the site's series, skyline and meta. */
export function useSceneData(siteId: string): SceneLoad {
  const manifest = useManifest();
  const site = useSite(siteId);
  const series = useSeries(siteId);
  const skyline = useSkyline(siteId);
  const name = site.status === "ready" ? (site.data.site?.name ?? siteId) : siteId;
  if ([manifest, site, series, skyline].some((r) => r.status === "error")) return { status: "error", name };
  if (manifest.status !== "ready" || site.status !== "ready" || series.status !== "ready" || skyline.status !== "ready") {
    return { status: "loading", name };
  }
  return {
    status: "ready",
    data: {
      grid: manifest.data.time_grid,
      name,
      sphere: isSphere(site.data.site),
      series: series.data,
      skyline: skyline.data,
      radii: { sun: site.data.meta.sun_radius_deg, earth: site.data.meta.earth_radius_deg },
    },
  };
}
