import { useEffect, useState } from "react";
import { useStore } from "zustand";
import type {
  ArtemisRegions,
  Features,
  Manifest,
  MapMeta,
  Profiles,
  SceneMeta,
  Site,
  SiteMeta,
  Sites,
  Validation,
  WorkedExamples,
} from "../contracts/generated.ts";
import type { DecodedApron } from "./decode/apron.ts";
import type { DecodedSeries, DecodedSkyline, DecodedSystem, DecodedTerrain } from "./decode/layouts.ts";
import { loadApron, loadSceneMeta } from "./load.ts";
import { isCustomSiteId } from "./paths.ts";
import {
  closeupKey,
  dataStore,
  lookupKey,
  metaKey,
  seriesKey,
  skylineKey,
  terrainKey,
  type ResourceEntry,
} from "../state/data.ts";

export type HookResult<T> =
  | { status: "loading"; data: null; error: null }
  | { status: "ready"; data: T; error: null }
  | { status: "error"; data: null; error: string };

export type SiteDetails = {
  site: Site | null;
  meta: SiteMeta;
};

function toResult<T>(entry: ResourceEntry | undefined): HookResult<T> {
  if (!entry || entry.status === "loading") {
    return { status: "loading", data: null, error: null };
  }
  if (entry.status === "error") {
    return { status: "error", data: null, error: entry.error ?? "unknown error" };
  }
  return { status: "ready", data: entry.data as T, error: null };
}

function useResource<T>(key: string): HookResult<T> {
  const entry = useStore(dataStore, (state) => state.entries[key]);
  const ensure = useStore(dataStore, (state) => state.ensure);
  const absent = entry === undefined;
  useEffect(() => {
    if (!absent) return;
    // The store keeps the error on the entry. Swallow the rejection so a missing
    // file does not surface as an unhandled promise from the effect.
    void ensure(key).catch(() => undefined);
  }, [ensure, key, absent]);
  return toResult<T>(entry);
}

export function useManifest(): HookResult<Manifest> {
  return useResource("manifest");
}

export function useSites(): HookResult<Sites> {
  return useResource("sites");
}

export function useProfiles(): HookResult<Profiles> {
  return useResource("profiles");
}

export function useFeatures(): HookResult<Features> {
  return useResource("features");
}

export function useArtemisRegions(): HookResult<ArtemisRegions> {
  return useResource("artemis_regions");
}

export function useMapsMeta(): HookResult<MapMeta> {
  return useResource("maps_meta");
}

export function useValidation(): HookResult<Validation | null> {
  return useResource("validation");
}

export function useWorkedExamples(): HookResult<WorkedExamples> {
  return useResource("worked_examples");
}

export function useSystem(): HookResult<DecodedSystem> {
  return useResource("system");
}

export function useMapLookup(fileName: string): HookResult<Uint8Array> {
  return useResource(lookupKey(fileName));
}

export function useSite(siteId: string): HookResult<SiteDetails> {
  const sites = useSites();
  const meta = useResource<SiteMeta>(metaKey(siteId));
  if (sites.status === "error") return { status: "error", data: null, error: sites.error };
  if (meta.status === "error") return { status: "error", data: null, error: meta.error };
  if (sites.status !== "ready" || meta.status !== "ready") {
    return { status: "loading", data: null, error: null };
  }
  const site = sites.data.find((item) => item.id === siteId) ?? null;
  if (site === null && !isCustomSiteId(siteId)) {
    return { status: "error", data: null, error: `sites.json has no site ${siteId}` };
  }
  return { status: "ready", data: { site, meta: meta.data }, error: null };
}

export function useSeries(siteId: string): HookResult<DecodedSeries> {
  return useResource(seriesKey(siteId));
}

export function useSkyline(siteId: string): HookResult<DecodedSkyline> {
  return useResource(skylineKey(siteId));
}

export function useTerrain(siteId: string): HookResult<DecodedTerrain | null> {
  return useResource(terrainKey(siteId));
}

export function useCloseup(siteId: string): HookResult<DecodedTerrain | null> {
  return useResource(closeupKey(siteId));
}

export function useSceneMeta(): HookResult<SceneMeta> {
  const [state, setState] = useState<HookResult<SceneMeta>>({ status: "loading", data: null, error: null });
  useEffect(() => {
    let live = true;
    loadSceneMeta().then(
      (data) => {
        if (live) setState({ status: "ready", data, error: null });
      },
      (error: unknown) => {
        if (!live) return;
        setState({ status: "error", data: null, error: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

export function useApron(siteId: string): HookResult<DecodedApron | "not available"> {
  const [state, setState] = useState<HookResult<DecodedApron | "not available">>({
    status: "loading",
    data: null,
    error: null,
  });
  useEffect(() => {
    let live = true;
    setState({ status: "loading", data: null, error: null });
    loadApron(siteId).then(
      (data) => {
        if (live) setState({ status: "ready", data, error: null });
      },
      (error: unknown) => {
        if (!live) return;
        setState({ status: "error", data: null, error: error instanceof Error ? error.message : String(error) });
      },
    );
    return () => {
      live = false;
    };
  }, [siteId]);
  return state;
}
