import { dataStore as sharedDataStore } from "../state/data.ts";
import { DataCheck } from "./DataCheck.tsx";

export { DataCheck };
export {
  LOOKUP_NO_DATA,
  SERIES_COLUMNS,
  SKYLINE_ARRAYS,
  SYSTEM_ARRAYS,
  TERRAIN_ARRAYS,
  decodeLookup,
  decodeSeries,
  decodeSkyline,
  decodeSystem,
  decodeTerrain,
  lookupFraction,
  type DecodedSeries,
  type DecodedSkyline,
  type DecodedSystem,
  type DecodedTerrain,
  type SeriesColumnName,
  type SeriesColumnSpec,
} from "./decode/index.ts";
export {
  useArtemisRegions,
  useCloseup,
  useFeatures,
  useManifest,
  useMapLookup,
  useMapsMeta,
  useProfiles,
  useSeries,
  useSite,
  useSites,
  useSkyline,
  useSystem,
  useTerrain,
  useValidation,
  useWorkedExamples,
  type HookResult,
  type SiteDetails,
} from "./hooks.ts";
export {
  MissingFileError,
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
  mapImageUrl,
  type FetchLike,
} from "./load.ts";
export { KNOWN_SCHEMA_VERSION, parseManifest, parseSiteMeta } from "./parse.ts";
export { isCustomSiteId, mapFile, siteBase, siteFile } from "./paths.ts";
export { createDataStore, dataStore } from "../state/data.ts";

/** Drop one site's series, skyline, terrain and close-up. The next mount loads them again. */
export function dropSite(siteId: string): void {
  sharedDataStore.getState().dropSite(siteId);
}
