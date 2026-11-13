/**
 * The only door from a loaded series to lit, link, metrics, countdowns and
 * the slip sweep. No other module decides whether an hour is lit or linked.
 *
 * `useSweep` runs on the main thread for now. Its `data` is a `SlipSweep`,
 * the value a Web Worker can post back in a later work package.
 */

import type { MissionProfile } from "../../contracts/generated.ts";
import { useManifest, useSeries, useSites, type HookResult } from "../../data/hooks.ts";
import { isCustomSiteId } from "../../data/paths.ts";
import { utcToHourIndex } from "../time/index.ts";
import {
  cachedCountdowns,
  cachedEvaluation,
  cachedHourFlags,
  cachedSlipSweep,
  siteSlopeDeg,
} from "./cache.ts";
import type { Countdowns, Evaluation, HourFlags, SlipSweep } from "./scoring.ts";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Slope from `sites.json`. A custom id that is not listed yet has no slope. */
function useSlope(siteId: string): HookResult<number | null> {
  const sites = useSites();
  if (sites.status === "error") return { status: "error", data: null, error: sites.error };
  if (sites.status !== "ready") return { status: "loading", data: null, error: null };
  const listed = sites.data.some((site) => site.id === siteId);
  if (!listed && !isCustomSiteId(siteId)) {
    return { status: "error", data: null, error: `sites.json has no site ${siteId}` };
  }
  return { status: "ready", data: siteSlopeDeg(sites.data, siteId), error: null };
}

export function useHourFlags(siteId: string, profile: MissionProfile): HookResult<HourFlags> {
  const series = useSeries(siteId);
  const slope = useSlope(siteId);
  if (series.status === "error") return { status: "error", data: null, error: series.error };
  if (slope.status === "error") return { status: "error", data: null, error: slope.error };
  if (series.status !== "ready" || slope.status !== "ready") {
    return { status: "loading", data: null, error: null };
  }
  try {
    // Flags do not read slope. The lookup still runs so a sphere-tier site
    // (null slope) and a sloped site share this one door.
    void slope.data;
    return { status: "ready", data: cachedHourFlags(siteId, series.data, profile), error: null };
  } catch (error) {
    return { status: "error", data: null, error: message(error) };
  }
}

export function useEvaluation(
  siteId: string,
  profile: MissionProfile,
  landingUtc: string,
): HookResult<Evaluation | null> {
  const series = useSeries(siteId);
  const slope = useSlope(siteId);
  const manifest = useManifest();
  if (series.status === "error") return { status: "error", data: null, error: series.error };
  if (slope.status === "error") return { status: "error", data: null, error: slope.error };
  if (manifest.status === "error") return { status: "error", data: null, error: manifest.error };
  if (series.status !== "ready" || slope.status !== "ready" || manifest.status !== "ready") {
    return { status: "loading", data: null, error: null };
  }
  try {
    const landingHour = utcToHourIndex(manifest.data.time_grid, landingUtc);
    return {
      status: "ready",
      data: cachedEvaluation(siteId, series.data, profile, landingHour, slope.data),
      error: null,
    };
  } catch (error) {
    return { status: "error", data: null, error: message(error) };
  }
}

export function useCountdowns(
  siteId: string,
  profile: MissionProfile,
  currentUtc: string,
): HookResult<Countdowns> {
  const series = useSeries(siteId);
  const slope = useSlope(siteId);
  const manifest = useManifest();
  if (series.status === "error") return { status: "error", data: null, error: series.error };
  if (slope.status === "error") return { status: "error", data: null, error: slope.error };
  if (manifest.status === "error") return { status: "error", data: null, error: manifest.error };
  if (series.status !== "ready" || slope.status !== "ready" || manifest.status !== "ready") {
    return { status: "loading", data: null, error: null };
  }
  try {
    void slope.data;
    const currentHour = utcToHourIndex(manifest.data.time_grid, currentUtc);
    return {
      status: "ready",
      data: cachedCountdowns(siteId, series.data, profile, currentHour),
      error: null,
    };
  } catch (error) {
    return { status: "error", data: null, error: message(error) };
  }
}

export function useSweep(siteId: string, profile: MissionProfile): HookResult<SlipSweep> {
  const series = useSeries(siteId);
  const slope = useSlope(siteId);
  if (series.status === "error") return { status: "error", data: null, error: series.error };
  if (slope.status === "error") return { status: "error", data: null, error: slope.error };
  if (series.status !== "ready" || slope.status !== "ready") {
    return { status: "loading", data: null, error: null };
  }
  try {
    return {
      status: "ready",
      data: cachedSlipSweep(siteId, series.data, profile, slope.data),
      error: null,
    };
  } catch (error) {
    return { status: "error", data: null, error: message(error) };
  }
}
