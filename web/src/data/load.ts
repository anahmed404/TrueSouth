import type {
  ArtemisRegions,
  Features,
  Manifest,
  MapMeta,
  Profiles,
  SiteMeta,
  Sites,
  Validation,
  WorkedExamples,
} from "../contracts/generated.ts";
import { decodeLookup, decodeSeries, decodeSkyline, decodeSystem, decodeTerrain } from "./decode/index.ts";
import type { DecodedSeries, DecodedSkyline, DecodedSystem, DecodedTerrain, SeriesColumnSpec } from "./decode/layouts.ts";
import {
  parseArtemisRegions,
  parseFeatures,
  parseManifest,
  parseMapsMeta,
  parseProfiles,
  parseSeriesColumns,
  parseSiteMeta,
  parseSites,
  parseValidation,
  parseWorkedExamples,
} from "./parse.ts";
import { dataPaths, fileLabel, mapFile, siteFile } from "./paths.ts";

export type FetchLike = (url: string) => Promise<Response>;

export function defaultFetch(url: string): Promise<Response> {
  return fetch(url);
}

export class MissingFileError extends Error {
  readonly url: string;

  constructor(url: string) {
    super(`${fileLabel(url)} is missing`);
    this.name = "MissingFileError";
    this.url = url;
  }
}

async function fetchResponse(url: string, fetchImpl: FetchLike): Promise<Response> {
  const response = await fetchImpl(url);
  if (response.status === 404) throw new MissingFileError(url);
  if (!response.ok) {
    throw new Error(`${fileLabel(url)} returned HTTP ${response.status}`);
  }
  return response;
}

export async function fetchJson(url: string, fetchImpl: FetchLike): Promise<unknown> {
  const response = await fetchResponse(url, fetchImpl);
  try {
    return await response.json();
  } catch {
    throw new Error(`${fileLabel(url)} is not valid JSON`);
  }
}

export async function fetchBytes(url: string, fetchImpl: FetchLike): Promise<ArrayBuffer> {
  const response = await fetchResponse(url, fetchImpl);
  return response.arrayBuffer();
}

export async function fetchOptionalBytes(url: string, fetchImpl: FetchLike): Promise<ArrayBuffer | null> {
  try {
    return await fetchBytes(url, fetchImpl);
  } catch (error) {
    if (error instanceof MissingFileError) return null;
    throw error;
  }
}

async function loadJson<T>(url: string, fetchImpl: FetchLike, parse: (value: unknown) => T): Promise<T> {
  return parse(await fetchJson(url, fetchImpl));
}

export function loadManifest(fetchImpl: FetchLike = defaultFetch): Promise<Manifest> {
  return loadJson(dataPaths.manifest, fetchImpl, parseManifest);
}

export function loadSites(fetchImpl: FetchLike = defaultFetch): Promise<Sites> {
  return loadJson(dataPaths.sites, fetchImpl, parseSites);
}

export function loadProfiles(fetchImpl: FetchLike = defaultFetch): Promise<Profiles> {
  return loadJson(dataPaths.profiles, fetchImpl, parseProfiles);
}

export function loadFeatures(fetchImpl: FetchLike = defaultFetch): Promise<Features> {
  return loadJson(dataPaths.features, fetchImpl, parseFeatures);
}

export function loadArtemisRegions(fetchImpl: FetchLike = defaultFetch): Promise<ArtemisRegions> {
  return loadJson(dataPaths.artemisRegions, fetchImpl, parseArtemisRegions);
}

export function loadMapsMeta(fetchImpl: FetchLike = defaultFetch): Promise<MapMeta> {
  return loadJson(dataPaths.mapsMeta, fetchImpl, parseMapsMeta);
}

export async function loadValidation(fetchImpl: FetchLike = defaultFetch): Promise<Validation | null> {
  try {
    return await loadJson(dataPaths.validation, fetchImpl, parseValidation);
  } catch (error) {
    if (error instanceof MissingFileError) return null;
    throw error;
  }
}

export function loadWorkedExamples(fetchImpl: FetchLike = defaultFetch): Promise<WorkedExamples> {
  return loadJson(dataPaths.workedExamples, fetchImpl, parseWorkedExamples);
}

export async function loadSiteMeta(siteId: string, fetchImpl: FetchLike = defaultFetch): Promise<SiteMeta> {
  const url = siteFile(siteId, "meta.json");
  const meta = parseSiteMeta(await fetchJson(url, fetchImpl));
  if (meta.site_id !== siteId) {
    throw new Error(`meta.json site_id is ${meta.site_id}; expected ${siteId}`);
  }
  return meta;
}

export function columnsFromMeta(meta: SiteMeta, fileName = "meta.json"): SeriesColumnSpec[] {
  return parseSeriesColumns(meta.series, fileName);
}

export async function loadSeries(
  siteId: string,
  count: number,
  columns: readonly SeriesColumnSpec[],
  fetchImpl: FetchLike = defaultFetch,
): Promise<DecodedSeries> {
  const bytes = await fetchBytes(siteFile(siteId, "series.bin"), fetchImpl);
  return decodeSeries(bytes, columns, count, "series.bin");
}

export async function loadSkyline(
  siteId: string,
  bins: number,
  fetchImpl: FetchLike = defaultFetch,
): Promise<DecodedSkyline> {
  const bytes = await fetchBytes(siteFile(siteId, "skyline.bin"), fetchImpl);
  return decodeSkyline(bytes, bins, "skyline.bin");
}

export async function loadTerrain(
  siteId: string,
  size: number | null,
  fetchImpl: FetchLike = defaultFetch,
): Promise<DecodedTerrain | null> {
  return loadMesh(siteId, "terrain.bin", size, fetchImpl);
}

export async function loadCloseup(
  siteId: string,
  size: number | null,
  fetchImpl: FetchLike = defaultFetch,
): Promise<DecodedTerrain | null> {
  return loadMesh(siteId, "closeup.bin", size, fetchImpl);
}

async function loadMesh(
  siteId: string,
  fileName: "terrain.bin" | "closeup.bin",
  size: number | null,
  fetchImpl: FetchLike,
): Promise<DecodedTerrain | null> {
  const bytes = await fetchOptionalBytes(siteFile(siteId, fileName), fetchImpl);
  if (bytes === null) return null;
  if (size === null) {
    throw new Error(`${fileName} exists but ${siteId} meta.json has no ${fileName === "terrain.bin" ? "terrain" : "close-up"}`);
  }
  return decodeTerrain(bytes, size, fileName);
}

export async function loadSystem(count: number, fetchImpl: FetchLike = defaultFetch): Promise<DecodedSystem> {
  const bytes = await fetchBytes(dataPaths.system, fetchImpl);
  return decodeSystem(bytes, count, "system.bin");
}

export async function loadMapLookup(
  fileName: string,
  size: number,
  fetchImpl: FetchLike = defaultFetch,
): Promise<Uint8Array> {
  const bytes = await fetchBytes(mapFile(fileName), fetchImpl);
  return decodeLookup(bytes, size, fileName);
}

export function mapImageUrl(fileName: string): string {
  return mapFile(fileName);
}
