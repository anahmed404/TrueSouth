import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import type { MissionProfile, Sites } from "../../../contracts/generated";
import { useManifest, useSites } from "../../../data";
import { isCustomSiteId } from "../../../data/paths";
import { cachedEvaluation, siteSlopeDeg, type Series } from "../../../lib/scoring";
import { dataStore, seriesKey, type ResourceEntry } from "../../../state/data";
import type { SiteResult } from "./model";

/**
 * A site's result for a landing hour, as the user reads it: the spot, its label and hover,
 * a strip's hover readout and `aria-valuetext`, the row lamps, the header, the slider's words
 * and the before-and-after line.
 */
export type Evaluate = (siteId: string, hour: number) => SiteResult;

/**
 * The one source of every status, rule and score the Slip Planner shows for a site and a
 * landing hour: `cachedEvaluation`, the same single-date evaluation, inputs and cache as the
 * sites rail and the focused-site panel (`useEvaluation`, lib/scoring/hooks.ts). So a spot
 * always equals the rail, for the current profile and site list, even while a new slip sweep
 * is still running.
 *
 * The sweep (use-slip-days.ts) only draws the strips and finds "next GO". Its packed score
 * (Float32) is never shown: it can floor to a different whole number.
 */
export function evaluateLanding(
  siteId: string,
  hour: number,
  profile: MissionProfile,
  sites: Sites | null,
  sitesFailed: boolean,
  entry: ResourceEntry | undefined,
): SiteResult {
  if (sitesFailed) return { kind: "failed" };
  if (!sites || !entry || entry.status === "loading") return { kind: "pending" };
  if (entry.status === "error") return { kind: "failed" };
  if (!sites.some((s) => s.id === siteId) && !isCustomSiteId(siteId)) return { kind: "failed" };
  const series = entry.data as Series;
  if (!Number.isInteger(hour) || hour < 0 || hour >= series.sun_frac.length) return { kind: "none" };
  try {
    const evaluation = cachedEvaluation(siteId, series, profile, hour, siteSlopeDeg(sites, siteId));
    return evaluation ? { kind: "ready", evaluation } : { kind: "none" };
  } catch {
    return { kind: "failed" };
  }
}

/**
 * `evaluateLanding` for the selected sites, as a hook: it loads their series (as the rail
 * does) and gives a new function whenever a series, the catalog or the profile changes.
 */
export function useEvaluate(siteIds: readonly string[], profile: MissionProfile): Evaluate {
  const sites = useSites();
  const manifest = useManifest();
  const entries = useStore(dataStore, (state) => state.entries);
  const ensure = useStore(dataStore, (state) => state.ensure);
  const siteKey = siteIds.join("\0");

  useEffect(() => {
    for (const siteId of siteKey.split("\0")) {
      if (siteId.length === 0) continue;
      const key = seriesKey(siteId);
      if (dataStore.getState().entries[key] === undefined) void ensure(key).catch(() => undefined);
    }
  }, [ensure, siteKey]);

  const catalog = sites.status === "ready" ? sites.data : null;
  const failed = sites.status === "error" || manifest.status === "error";
  return useCallback(
    (siteId: string, hour: number) => evaluateLanding(siteId, hour, profile, catalog, failed, entries[seriesKey(siteId)]),
    [profile, catalog, failed, entries],
  );
}
