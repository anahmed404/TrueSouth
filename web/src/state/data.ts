import { createStore, type StoreApi } from "zustand/vanilla";
import type { Manifest, MapMeta, SiteMeta } from "../contracts/generated.ts";
import {
  columnsFromMeta,
  defaultFetch,
  loadArtemisRegions,
  loadCloseup,
  loadFeatures,
  loadManifest,
  loadMapLookup,
  loadMapsMeta,
  loadProfiles,
  loadSeries,
  loadSiteMeta,
  loadSites,
  loadSkyline,
  loadSystem,
  loadTerrain,
  loadValidation,
  loadWorkedExamples,
  type FetchLike,
} from "../data/load.ts";
import { isRecord } from "../data/parse.ts";
import { isCustomSiteId } from "../data/paths.ts";
import { customSitesStore } from "./custom-sites.ts";

export type ResourceStatus = "loading" | "ready" | "error";

export type ResourceEntry = {
  status: ResourceStatus;
  data: unknown;
  error: string | null;
};

export type DataState = {
  entries: Record<string, ResourceEntry>;
  ensure: (key: string) => Promise<unknown>;
  dropSite: (siteId: string) => void;
};

export type DataStore = StoreApi<DataState>;

const LARGE_KINDS = ["series", "skyline", "terrain", "closeup"] as const;

export function metaKey(siteId: string): string {
  return `meta:${siteId}`;
}

export function seriesKey(siteId: string): string {
  return `series:${siteId}`;
}

export function skylineKey(siteId: string): string {
  return `skyline:${siteId}`;
}

export function terrainKey(siteId: string): string {
  return `terrain:${siteId}`;
}

export function closeupKey(siteId: string): string {
  return `closeup:${siteId}`;
}

export function lookupKey(fileName: string): string {
  return `lookup:${fileName}`;
}

function splitKey(key: string): { kind: string; rest: string } | null {
  const index = key.indexOf(":");
  if (index <= 0) return null;
  return { kind: key.slice(0, index), rest: key.slice(index + 1) };
}

function asManifest(value: unknown): Manifest {
  if (!isRecord(value) || !isRecord(value.time_grid)) {
    throw new Error("manifest.json did not load");
  }
  return value as unknown as Manifest;
}

function asSiteMeta(value: unknown): SiteMeta {
  if (!isRecord(value) || typeof value.site_id !== "string") {
    throw new Error("meta.json did not load");
  }
  return value as unknown as SiteMeta;
}

function asMapsMeta(value: unknown): MapMeta {
  if (!isRecord(value) || !isRecord(value.layers)) {
    throw new Error("maps/meta.json did not load");
  }
  return value as unknown as MapMeta;
}

function lookupSize(meta: MapMeta, fileName: string): number | null {
  const layers = [meta.layers.sunlight, meta.layers.earthvis, meta.layers.hillshade];
  for (const layer of layers) {
    if (layer.lookup === fileName && typeof layer.lookup_size === "number") {
      return layer.lookup_size;
    }
  }
  return null;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Waits until a custom site's files exist on the server. Without it, a custom id's files are
 * asked for at once (and a site still computing would read as missing).
 */
export type CustomSiteGate = (siteId: string) => Promise<void>;

export function createDataStore(fetchImpl: FetchLike = defaultFetch, customGate?: CustomSiteGate): DataStore {
  const inflight = new Map<string, Promise<unknown>>();
  const generations = new Map<string, number>();

  return createStore<DataState>((set, get) => {
    function write(key: string, entry: ResourceEntry): void {
      set((state) => ({
        entries: { ...state.entries, [key]: entry },
      }));
    }

    function ensure(key: string): Promise<unknown> {
      const current = get().entries[key];
      if (current?.status === "ready") return Promise.resolve(current.data);
      if (current?.status === "error") {
        return Promise.reject(new Error(current.error ?? `${key} failed`));
      }
      const pending = inflight.get(key);
      if (pending) return pending;

      const generation = generations.get(key) ?? 0;
      let resolvePromise: (value: unknown) => void = () => undefined;
      let rejectPromise: (error: Error) => void = () => undefined;
      const promise = new Promise<unknown>((resolve, reject) => {
        resolvePromise = resolve;
        rejectPromise = reject;
      });
      inflight.set(key, promise);
      write(key, { status: "loading", data: null, error: null });

      void (async () => {
        try {
          const data = await resolveKey(key);
          if ((generations.get(key) ?? 0) !== generation) {
            resolvePromise(data);
            return;
          }
          write(key, { status: "ready", data, error: null });
          resolvePromise(data);
        } catch (error) {
          const message = errorMessage(error);
          if ((generations.get(key) ?? 0) === generation) {
            write(key, { status: "error", data: null, error: message });
          }
          rejectPromise(new Error(message));
        } finally {
          if (inflight.get(key) === promise) inflight.delete(key);
        }
      })();

      return promise;
    }

    async function resolveKey(key: string): Promise<unknown> {
      switch (key) {
        case "manifest":
          return loadManifest(fetchImpl);
        case "sites":
          return loadSites(fetchImpl);
        case "profiles":
          return loadProfiles(fetchImpl);
        case "features":
          return loadFeatures(fetchImpl);
        case "artemis_regions":
          return loadArtemisRegions(fetchImpl);
        case "maps_meta":
          return loadMapsMeta(fetchImpl);
        case "validation":
          return loadValidation(fetchImpl);
        case "worked_examples":
          return loadWorkedExamples(fetchImpl);
        case "system": {
          const manifest = asManifest(await ensure("manifest"));
          return loadSystem(manifest.time_grid.count, fetchImpl);
        }
        default:
          break;
      }

      const parts = splitKey(key);
      if (!parts) throw new Error(`unknown data key ${key}`);
      if (parts.kind === "lookup") {
        const maps = asMapsMeta(await ensure("maps_meta"));
        const size = lookupSize(maps, parts.rest);
        if (size === null) throw new Error(`maps/meta.json has no lookup ${parts.rest}`);
        return loadMapLookup(parts.rest, size, fetchImpl);
      }
      return resolveSite(parts.kind, parts.rest);
    }

    async function resolveSite(kind: string, siteId: string): Promise<unknown> {
      // A custom site's files exist only once its job is ready: wait for it, never 404.
      if (customGate && isCustomSiteId(siteId)) await customGate(siteId);
      if (kind === "meta") return loadSiteMeta(siteId, fetchImpl);
      if (kind === "terrain") {
        const meta = asSiteMeta(await ensure(metaKey(siteId)));
        return loadTerrain(siteId, meta.terrain?.size ?? null, fetchImpl);
      }
      if (kind === "closeup") {
        const meta = asSiteMeta(await ensure(metaKey(siteId)));
        return loadCloseup(siteId, meta.closeup?.size ?? null, fetchImpl);
      }
      const manifest = asManifest(await ensure("manifest"));
      const meta = asSiteMeta(await ensure(metaKey(siteId)));
      if (kind === "series") {
        return loadSeries(
          siteId,
          manifest.time_grid.count,
          columnsFromMeta(meta, `${siteId}/meta.json`),
          fetchImpl,
        );
      }
      if (kind === "skyline") return loadSkyline(siteId, meta.skyline.bins, fetchImpl);
      throw new Error(`unknown data key ${kind}:${siteId}`);
    }

    function dropSite(siteId: string): void {
      const keys = LARGE_KINDS.map((kind) => `${kind}:${siteId}`);
      for (const key of keys) {
        generations.set(key, (generations.get(key) ?? 0) + 1);
        inflight.delete(key);
      }
      set((state) => {
        const entries = { ...state.entries };
        for (const key of keys) delete entries[key];
        return { entries };
      });
    }

    return { entries: {}, ensure, dropSite };
  });
}

export const dataStore = createDataStore(defaultFetch, (siteId) => customSitesStore.getState().whenReady(siteId));
