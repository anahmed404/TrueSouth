import type {
  ArtemisRegions,
  Features,
  Manifest,
  MapMeta,
  MeshMeta,
  Profiles,
  SiteMeta,
  Sites,
  Validation,
  WorkedExamples,
} from "../contracts/generated.ts";
import { SERIES_COLUMNS, type SeriesColumnSpec } from "./decode/layouts.ts";

export const KNOWN_SCHEMA_VERSION = 1 satisfies Manifest["schema_version"];

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function expectObject(value: unknown, fileName: string): Record<string, unknown> {
  if (!isRecord(value)) throw new Error(`${fileName} is not an object`);
  return value;
}

function expectArray(value: unknown, fileName: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${fileName} is not an array`);
  return value;
}

function expectString(value: unknown, fileName: string, field: string): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${fileName} is missing ${field}`);
  }
  return value;
}

function expectNumber(value: unknown, fileName: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${fileName} is missing ${field}`);
  }
  return value;
}

export function parseManifest(value: unknown): Manifest {
  const fileName = "manifest.json";
  const record = expectObject(value, fileName);
  if (record.schema_version !== KNOWN_SCHEMA_VERSION) {
    throw new Error(
      `${fileName} has schema_version ${String(record.schema_version)}; this app knows schema_version ${KNOWN_SCHEMA_VERSION}`,
    );
  }
  const timeGrid = expectObject(record.time_grid, `${fileName} time_grid`);
  const start = expectString(timeGrid.start_utc, fileName, "time_grid.start_utc");
  if (!start.endsWith("Z")) {
    throw new Error(`${fileName} time_grid.start_utc must end in Z`);
  }
  const step = expectNumber(timeGrid.step_s, fileName, "time_grid.step_s");
  const count = timeGrid.count;
  if (typeof count !== "number" || !Number.isInteger(count) || count < 0) {
    throw new Error(`${fileName} time_grid.count must be a non-negative integer`);
  }
  expectString(record.generated_utc, fileName, "generated_utc");
  expectNumber(record.moon_radius_m, fileName, "moon_radius_m");
  expectNumber(record.observer_height_m, fileName, "observer_height_m");
  const bins = record.skyline_bins;
  if (typeof bins !== "number" || !Number.isInteger(bins) || bins <= 0) {
    throw new Error(`${fileName} skyline_bins must be a positive integer`);
  }
  if (step <= 0) throw new Error(`${fileName} time_grid.step_s must be positive`);
  return record as unknown as Manifest;
}

export function parseSeriesColumns(series: unknown, fileName: string): SeriesColumnSpec[] {
  const record = expectObject(series, `${fileName} series`);
  const columns = expectArray(record.columns, `${fileName} series.columns`);
  if (columns.length !== SERIES_COLUMNS.length) {
    throw new Error(
      `${fileName} has ${columns.length} series columns; expected ${SERIES_COLUMNS.length}`,
    );
  }
  return columns.map((column, index) => {
    const expected = SERIES_COLUMNS[index];
    const item = expectObject(column, `${fileName} series column ${index}`);
    if (!expected || item.name !== expected.name) {
      throw new Error(
        `${fileName} series column ${index} is ${String(item.name)}; expected ${expected?.name ?? "a column"}`,
      );
    }
    const scale = expectNumber(item.scale, fileName, `${expected.name} scale`);
    const offset = expectNumber(item.offset, fileName, `${expected.name} offset`);
    if (scale !== expected.scale) {
      throw new Error(
        `${fileName} series column ${expected.name} scale is ${scale}; expected ${expected.scale}`,
      );
    }
    if (offset !== expected.offset) {
      throw new Error(
        `${fileName} series column ${expected.name} offset is ${offset}; expected ${expected.offset}`,
      );
    }
    return { name: expected.name, scale, offset };
  });
}

function parseMesh(value: unknown, fileName: string, field: string): MeshMeta | null {
  if (value === null) return null;
  const record = expectObject(value, `${fileName} ${field}`);
  const size = record.size;
  if (typeof size !== "number" || !Number.isInteger(size) || size <= 0) {
    throw new Error(`${fileName} ${field}.size must be a positive integer`);
  }
  return {
    size,
    window_km: expectNumber(record.window_km, fileName, `${field}.window_km`),
  };
}

export function parseSiteMeta(value: unknown, fileName = "meta.json"): SiteMeta {
  const record = expectObject(value, fileName);
  const columns = parseSeriesColumns(record.series, fileName);
  const skyline = expectObject(record.skyline, `${fileName} skyline`);
  const bins = skyline.bins;
  if (typeof bins !== "number" || !Number.isInteger(bins) || bins <= 0) {
    throw new Error(`${fileName} skyline.bins must be a positive integer`);
  }
  return {
    site_id: expectString(record.site_id, fileName, "site_id"),
    series: { columns },
    sun_radius_deg: expectNumber(record.sun_radius_deg, fileName, "sun_radius_deg"),
    earth_radius_deg: expectNumber(record.earth_radius_deg, fileName, "earth_radius_deg"),
    skyline: {
      bins,
      missing_samples: expectNumber(skyline.missing_samples, fileName, "skyline.missing_samples"),
      max_range_km: expectNumber(skyline.max_range_km, fileName, "skyline.max_range_km"),
    },
    terrain: parseMesh(record.terrain, fileName, "terrain"),
    closeup: parseMesh(record.closeup, fileName, "closeup"),
  } as SiteMeta;
}

export function parseSites(value: unknown): Sites {
  const sites = expectArray(value, "sites.json");
  return sites.map((site, index) => {
    const record = expectObject(site, `sites.json item ${index}`);
    expectString(record.id, "sites.json", `item ${index} id`);
    expectString(record.terrain_tier, "sites.json", `item ${index} terrain_tier`);
    const label = `sites.json item ${index}`;
    const variantOf = record.variant_of ?? null;
    const offset = record.offset_m ?? null;
    if (variantOf !== null) {
      const id = expectString(variantOf, label, "variant_of");
      if (!/^(?:[a-z][a-z0-9]*(?:_[a-z0-9]+)*|c_-?\d+\.\d{4}_\d+\.\d{4})$/.test(id)) {
        throw new Error(`${label} variant_of must be a site id`);
      }
      if (record.id !== `${id}_best_lit`) {
        throw new Error(`${label} id must equal <variant_of>_best_lit`);
      }
    }
    if (offset !== null && expectNumber(offset, label, "offset_m") < 0) {
      throw new Error(`${label} offset_m must not be negative`);
    }
    if ((variantOf === null) !== (offset === null)) {
      throw new Error(`${label} variant_of and offset_m must both be null or both set`);
    }
    if (record.nearby_sun !== undefined && record.nearby_sun !== null) {
      const nearby = expectObject(record.nearby_sun, `${label} nearby_sun`);
      if (Object.keys(nearby).some((key) => !["radius_m", "points", "min", "max"].includes(key))) {
        throw new Error(`${label} nearby_sun has an unknown field`);
      }
      const radius = expectNumber(nearby.radius_m, label, "nearby_sun.radius_m");
      const points = expectNumber(nearby.points, label, "nearby_sun.points");
      const min = expectNumber(nearby.min, label, "nearby_sun.min");
      const max = expectNumber(nearby.max, label, "nearby_sun.max");
      if (radius <= 0 || !Number.isInteger(points) || points < 1 || min < 0 || max > 1 || min > max) {
        throw new Error(`${label} nearby_sun requires a positive radius, positive integer points and 0 <= min <= max <= 1`);
      }
    }
    return record as unknown as Sites[number];
  });
}

type ProfileFieldKind = "string" | "number" | "boolean" | "number-or-null" | "object";

/** MissionProfile.required from web/src/contracts/schema.json, in that order. */
const PROFILE_FIELDS: readonly { name: string; kind: ProfileFieldKind }[] = [
  { name: "id", kind: "string" },
  { name: "name", kind: "string" },
  { name: "based_on", kind: "string" },
  { name: "duration_days", kind: "number" },
  { name: "min_sun_fraction", kind: "number" },
  { name: "ops_sun_el_min_deg", kind: "number-or-null" },
  { name: "max_dark_h", kind: "number" },
  { name: "relay_available", kind: "boolean" },
  { name: "antenna_mask_deg", kind: "number" },
  { name: "max_blackout_h", kind: "number" },
  { name: "max_slope_deg", kind: "number" },
  { name: "slope_ideal_deg", kind: "number" },
  { name: "landing_sun_el_min_deg", kind: "number-or-null" },
  { name: "landing_sun_el_max_deg", kind: "number-or-null" },
  { name: "weights", kind: "object" },
  { name: "provenance", kind: "object" },
];

function expectProfileField(
  record: Record<string, unknown>,
  index: number,
  field: string,
  kind: ProfileFieldKind,
): void {
  const label = `profiles.json item ${index}`;
  if (!(field in record)) throw new Error(`${label} is missing ${field}`);
  const value = record[field];
  if (kind === "number-or-null") {
    if (value === null) return;
    expectNumber(value, label, field);
    return;
  }
  if (kind === "string") {
    expectString(value, label, field);
    return;
  }
  if (kind === "number") {
    expectNumber(value, label, field);
    return;
  }
  if (kind === "boolean") {
    if (typeof value !== "boolean") throw new Error(`${label} ${field} must be a boolean`);
    return;
  }
  if (!isRecord(value)) throw new Error(`${label} ${field} must be an object`);
}

export function parseProfiles(value: unknown): Profiles {
  const profiles = expectArray(value, "profiles.json");
  return profiles.map((profile, index) => {
    const record = expectObject(profile, `profiles.json item ${index}`);
    for (const field of PROFILE_FIELDS) {
      expectProfileField(record, index, field.name, field.kind);
    }
    return record as unknown as Profiles[number];
  });
}

export function parseFeatures(value: unknown): Features {
  const features = expectArray(value, "features.json");
  return features.map((feature, index) => {
    const record = expectObject(feature, `features.json item ${index}`);
    expectString(record.name, "features.json", `item ${index} name`);
    return record as unknown as Features[number];
  });
}

export function parseArtemisRegions(value: unknown): ArtemisRegions {
  const regions = expectArray(value, "artemis_regions.json");
  return regions.map((region, index) => {
    const record = expectObject(region, `artemis_regions.json item ${index}`);
    expectString(record.name, "artemis_regions.json", `item ${index} name`);
    return record as unknown as ArtemisRegions[number];
  });
}

export function parseMapsMeta(value: unknown): MapMeta {
  const record = expectObject(value, "maps/meta.json");
  if (record.projection !== "south_polar_stereographic") {
    throw new Error("maps/meta.json projection is not south_polar_stereographic");
  }
  expectObject(record.layers, "maps/meta.json layers");
  expectNumber(record.half_width_m, "maps/meta.json", "half_width_m");
  return record as unknown as MapMeta;
}

function isMeasuredGate(passed: unknown, measured: unknown): boolean {
  return typeof passed === "boolean" && typeof measured === "number" && Number.isFinite(measured);
}

export function parseValidation(value: unknown): Validation {
  const fileName = "validation.json";
  const record = expectObject(value, fileName);
  const gates = expectArray(record.gates, `${fileName} gates`);
  expectArray(record.comparisons, `${fileName} comparisons`);
  expectString(record.generated_utc, fileName, "generated_utc");
  gates.forEach((gate, index) => {
    const item = expectObject(gate, `${fileName} gates[${index}]`);
    const where = `gates[${index}]`;
    const unmeasured = item.passed === null && item.measured === null;
    if (!unmeasured && !isMeasuredGate(item.passed, item.measured)) {
      throw new Error(`${fileName} ${where} passed and measured must be a result or both null`);
    }
    if (unmeasured) {
      if (item.samples !== 0) {
        throw new Error(`${fileName} ${where} was not measured here, so samples must be 0`);
      }
      expectString(item.detail, fileName, `${where} detail`);
    }
  });
  return record as unknown as Validation;
}

export function parseWorkedExamples(value: unknown): WorkedExamples {
  const record = expectObject(value, "academy/worked_examples.json");
  expectString(record["l1.example_utc"], "academy/worked_examples.json", "l1.example_utc");
  return record as unknown as WorkedExamples;
}
