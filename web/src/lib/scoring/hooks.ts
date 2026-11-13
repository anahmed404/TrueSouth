/**
 * The only door from a loaded series to lit, link, metrics, countdowns and
 * the slip sweep. No other module decides whether an hour is lit or linked.
 *
 * `useSweep` and `useSweeps` run the sweep in one Web Worker. Where `Worker`
 * does not exist they compute on the main thread, through the same cache.
 * A hook that unmounts, or whose inputs change, does not apply a stale reply.
 */

import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type { MissionProfile, Sites, TimeGrid } from "../../contracts/generated.ts";
import { useManifest, useSeries, useSites, type HookResult } from "../../data/hooks.ts";
import { isCustomSiteId } from "../../data/paths.ts";
import { dataStore, seriesKey, type ResourceEntry } from "../../state/data.ts";
import { utcToHourIndex } from "../time/index.ts";
import {
  cachedCountdowns,
  cachedEvaluation,
  cachedHourFlags,
  cachedSlipSweep,
  peekSlipSweep,
  rememberSlipSweep,
  siteSlopeDeg,
  slipSweepCacheKey,
} from "./cache.ts";
import { sharedSweepClient, sweepWorkerAvailable } from "./sweep-client.ts";
import type { Countdowns, Evaluation, HourFlags, Series, SlipSweep } from "./scoring.ts";

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function loadingResult<T>(): HookResult<T> {
  return { status: "loading", data: null, error: null };
}

function slopeOf(sites: Sites, siteId: string): HookResult<number | null> {
  const listed = sites.some((site) => site.id === siteId);
  if (!listed && !isCustomSiteId(siteId)) {
    return { status: "error", data: null, error: `sites.json has no site ${siteId}` };
  }
  return { status: "ready", data: siteSlopeDeg(sites, siteId), error: null };
}

/** Slope from `sites.json`. A custom id that is not listed yet has no slope. */
function useSlope(siteId: string): HookResult<number | null> {
  const sites = useSites();
  if (sites.status === "error") return { status: "error", data: null, error: sites.error };
  if (sites.status !== "ready") return loadingResult();
  return slopeOf(sites.data, siteId);
}

function entryResult<T>(entry: ResourceEntry | undefined): HookResult<T> {
  if (!entry || entry.status === "loading") return loadingResult();
  if (entry.status === "error") {
    return { status: "error", data: null, error: entry.error ?? "unknown error" };
  }
  return { status: "ready", data: entry.data as T, error: null };
}

export function useHourFlags(siteId: string, profile: MissionProfile): HookResult<HourFlags> {
  const series = useSeries(siteId);
  const slope = useSlope(siteId);
  if (series.status === "error") return { status: "error", data: null, error: series.error };
  if (slope.status === "error") return { status: "error", data: null, error: slope.error };
  if (series.status !== "ready" || slope.status !== "ready") return loadingResult();
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
    return loadingResult();
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
    return loadingResult();
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

type SweepPlan =
  | { kind: "result"; result: HookResult<SlipSweep> }
  | {
      kind: "job";
      siteId: string;
      series: Series;
      slopeDeg: number | null;
      timeGrid: TimeGrid;
      cacheKey: string;
    };

/**
 * Call only from a component that is showing the slip sweep.
 * One site. `useSweeps` is the same door for the Slip Planner's rows.
 */
export function useSweep(siteId: string, profile: MissionProfile): HookResult<SlipSweep> {
  const [result] = useSweeps([siteId], profile);
  return result ?? loadingResult();
}

/**
 * One sweep per selected site, in `siteIds` order, filled as each reply arrives.
 * A site whose sweep is already cached is not requested again.
 */
export function useSweeps(siteIds: readonly string[], profile: MissionProfile): HookResult<SlipSweep>[] {
  const sites = useSites();
  const manifest = useManifest();
  const entries = useStore(dataStore, (state) => state.entries);
  const ensure = useStore(dataStore, (state) => state.ensure);
  const workerOn = sweepWorkerAvailable();
  const siteKey = siteIds.join("\0");
  const [epoch, setEpoch] = useState(0);
  const [failures, setFailures] = useState<Record<string, string>>({});

  useEffect(() => {
    for (const siteId of siteKey.split("\0")) {
      if (siteId.length === 0) continue;
      const key = seriesKey(siteId);
      if (dataStore.getState().entries[key] === undefined) {
        void ensure(key).catch(() => undefined);
      }
    }
  }, [ensure, siteKey]);

  const plans = siteIds.map((siteId) =>
    planSweep(siteId, profile, sites, manifest, entries, failures, workerOn),
  );
  const readyKey = `${workerOn ? "worker" : "main"}\n${plans
    .map((plan, index) => describePlan(siteIds[index] ?? "", plan))
    .join("\n")}`;

  useEffect(() => {
    if (!workerOn) return;
    let active = true;
    const unsubscribe = plans.flatMap((plan) => {
      if (plan.kind !== "job") return [];
      return [
        sharedSweepClient().request(
          {
            siteId: plan.siteId,
            series: plan.series,
            slopeDeg: plan.slopeDeg,
            profile,
            timeGrid: plan.timeGrid,
          },
          (delivery) => {
            if (!active) return;
            if (delivery.ok) {
              rememberSlipSweep(
                plan.siteId,
                plan.series,
                profile,
                plan.slopeDeg,
                delivery.sweep,
                plan.timeGrid,
              );
            }
            if (!delivery.ok) {
              setFailures((current) => ({ ...current, [plan.cacheKey]: delivery.error }));
              return;
            }
            setFailures((current) => {
              if (!(plan.cacheKey in current)) return current;
              const next = { ...current };
              delete next[plan.cacheKey];
              return next;
            });
            setEpoch((value) => value + 1);
          },
        ),
      ];
    });
    return () => {
      active = false;
      for (const stop of unsubscribe) stop();
    };
    // `plans` and `profile` are closed over from the render that built `readyKey`.
  }, [readyKey, workerOn]);

  void epoch;
  return plans.map((plan) => (plan.kind === "result" ? plan.result : loadingResult()));
}

function planSweep(
  siteId: string,
  profile: MissionProfile,
  sites: HookResult<Sites>,
  manifest: HookResult<{ time_grid: TimeGrid }>,
  entries: Record<string, ResourceEntry>,
  failures: Record<string, string>,
  workerOn: boolean,
): SweepPlan {
  if (sites.status === "error") {
    return { kind: "result", result: { status: "error", data: null, error: sites.error } };
  }
  if (sites.status !== "ready") return { kind: "result", result: loadingResult() };

  const seriesEntry = entryResult<Series>(entries[seriesKey(siteId)]);
  if (seriesEntry.status === "error") {
    return { kind: "result", result: { status: "error", data: null, error: seriesEntry.error } };
  }
  if (seriesEntry.status !== "ready") return { kind: "result", result: loadingResult() };

  const slope = slopeOf(sites.data, siteId);
  if (slope.status === "error") {
    return { kind: "result", result: { status: "error", data: null, error: slope.error } };
  }
  if (slope.status !== "ready") return { kind: "result", result: loadingResult() };

  if (manifest.status === "error") {
    return { kind: "result", result: { status: "error", data: null, error: manifest.error } };
  }
  if (manifest.status !== "ready") return { kind: "result", result: loadingResult() };
  const timeGrid = manifest.data.time_grid;

  if (!workerOn) {
    try {
      return {
        kind: "result",
        result: {
          status: "ready",
          data: cachedSlipSweep(siteId, seriesEntry.data, profile, slope.data, timeGrid),
          error: null,
        },
      };
    } catch (error) {
      return { kind: "result", result: { status: "error", data: null, error: message(error) } };
    }
  }

  const hit = peekSlipSweep(siteId, seriesEntry.data, profile, slope.data, timeGrid);
  if (hit) return { kind: "result", result: { status: "ready", data: hit, error: null } };

  const cacheKey = slipSweepCacheKey(siteId, seriesEntry.data, profile, slope.data, timeGrid);
  const failed = failures[cacheKey];
  if (failed) return { kind: "result", result: { status: "error", data: null, error: failed } };

  return {
    kind: "job",
    siteId,
    series: seriesEntry.data,
    slopeDeg: slope.data,
    timeGrid: manifest.data.time_grid,
    cacheKey,
  };
}

function describePlan(siteId: string, plan: SweepPlan): string {
  if (plan.kind === "job") return `${siteId}:job:${plan.cacheKey}`;
  if (plan.result.status === "error") return `${siteId}:error:${plan.result.error}`;
  return `${siteId}:${plan.result.status}`;
}
