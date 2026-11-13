/** Catalog ids stay on `/data/sites/`. Custom ids are `c_<lat>_<lon>` from the contract. */
const CUSTOM_SITE_ID = /^c_-?\d+\.\d{4}_\d+\.\d{4}$/;

export const dataPaths = {
  manifest: "/data/manifest.json",
  sites: "/data/sites.json",
  profiles: "/data/profiles.json",
  features: "/data/features.json",
  artemisRegions: "/data/artemis_regions.json",
  mapsMeta: "/data/maps/meta.json",
  validation: "/data/validation.json",
  workedExamples: "/data/academy/worked_examples.json",
  system: "/data/system.bin",
  sceneMeta: "/data/scene/meta.json",
} as const;

/** A scene or maps image path as listed in scene/meta.json, served under /data/. */
export function sceneFile(file: string): string {
  const clean = file.replace(/^\/+/, "");
  return `/data/${clean}`;
}

export function isCustomSiteId(siteId: string): boolean {
  return CUSTOM_SITE_ID.test(siteId);
}

export function siteBase(siteId: string): string {
  return isCustomSiteId(siteId) ? `/api/custom/${siteId}` : `/data/sites/${siteId}`;
}

export function siteFile(siteId: string, fileName: string): string {
  return `${siteBase(siteId)}/${fileName}`;
}

export function mapFile(fileName: string): string {
  return `/data/maps/${fileName}`;
}

export function fileLabel(url: string): string {
  const path = url.split("?")[0] ?? url;
  const slash = path.lastIndexOf("/");
  return slash === -1 ? path : path.slice(slash + 1);
}
