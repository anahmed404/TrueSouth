/* generated from schema.json by `pnpm gen:types`, do not edit */

/**
 * Array of Artemis regions.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ArtemisRegions".
 */
export type ArtemisRegions = ArtemisRegion[];
/**
 * Array of hand-entered catalog sites.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "CatalogSites".
 */
export type CatalogSites = CatalogSite[];
/**
 * Array of named features.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Features".
 */
export type Features = Feature[];
/**
 * Array of mission profiles.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Profiles".
 */
export type Profiles = MissionProfile[];
/**
 * Array of catalog sites.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Sites".
 */
export type Sites = Site[];

export interface TrueSouthContracts {
  [k: string]: unknown;
}
/**
 * Artemis candidate region.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ArtemisRegion".
 */
export interface ArtemisRegion {
  /**
   * Centre latitude in degrees, or null if unpublished.
   */
  lat_deg: number | null;
  /**
   * Centre east longitude in degrees, or null if unpublished.
   */
  lon_deg: number | null;
  /**
   * Region name.
   */
  name: string;
  /**
   * Region size in kilometres, or null if unpublished.
   */
  size_km: number | null;
  /**
   * Source URL.
   */
  source_url: string;
}
/**
 * A value chosen because no source is published.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Assumed".
 */
export interface Assumed {
  /**
   * Value is an assumption rather than a sourced claim.
   */
  kind: "assumed";
  /**
   * Reason for the assumption.
   */
  reason: string;
}
/**
 * Binary formats, with ordered arrays and orientation.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "BinaryLayouts".
 */
export interface BinaryLayouts {
  closeup?: TerrainLayout;
  map_lookup?: MapLookupLayout;
  series?: SeriesLayout;
  skyline?: SkylineLayout;
  system?: SystemLayout;
  terrain?: TerrainLayout1;
}
/**
 * Close-up mesh encoding.
 */
export interface TerrainLayout {
  /**
   * Ordered position in kilometres and slope in degrees.
   *
   * @minItems 4
   * @maxItems 4
   */
  arrays?: [unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * Column 0 is the western edge.
   */
  column_order?: "west_to_east";
  /**
   * 32-bit floating point.
   */
  dtype?: "float32";
  /**
   * Row 0 is the northern edge.
   */
  row_order?: "north_to_south";
}
/**
 * Map lookup encoding.
 */
export interface MapLookupLayout {
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * Column 0 is left; +x is right.
   */
  column_order?: "left_to_right";
  /**
   * Unsigned 8-bit integers.
   */
  dtype?: "uint8";
  /**
   * 255 means no data.
   */
  missing?: 255;
  /**
   * Row 0 is the top; +y is up.
   */
  row_order?: "top_to_bottom";
  /**
   * Decode valid values as raw / 255.
   */
  scale?: 0.00392156862745098;
}
/**
 * Per-site series encoding.
 */
export interface SeriesLayout {
  /**
   * Column arrays in documented order; decode raw * scale + offset.
   *
   * @minItems 8
   * @maxItems 8
   */
  arrays?: [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * Signed 16-bit integers.
   */
  dtype?: "int16";
}
/**
 * Skyline encoding.
 */
export interface SkylineLayout {
  /**
   * Ordered skyline arrays: degrees, kilometres, degrees, degrees, metres.
   *
   * @minItems 5
   * @maxItems 5
   */
  arrays?: [unknown, unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * 32-bit floating point.
   */
  dtype?: "float32";
}
/**
 * Global ephemeris encoding.
 */
export interface SystemLayout {
  /**
   * Ordered sub-point latitudes and longitudes in degrees and distances in kilometres.
   *
   * @minItems 6
   * @maxItems 6
   */
  arrays?: [unknown, unknown, unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * 32-bit floating point.
   */
  dtype?: "float32";
}
/**
 * Terrain mesh encoding.
 */
export interface TerrainLayout1 {
  /**
   * Ordered position in kilometres and slope in degrees.
   *
   * @minItems 4
   * @maxItems 4
   */
  arrays?: [unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * Column 0 is the western edge.
   */
  column_order?: "west_to_east";
  /**
   * 32-bit floating point.
   */
  dtype?: "float32";
  /**
   * Row 0 is the northern edge.
   */
  row_order?: "north_to_south";
}
/**
 * Hand-entered site information, before pipeline processing.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "CatalogSite".
 */
export interface CatalogSite {
  /**
   * Plain-language site description.
   */
  description: string;
  /**
   * Catalog group.
   */
  group: "artemis" | "sunlit_peak" | "polar_lander" | "contrast";
  /**
   * Stable site identifier.
   */
  id: string;
  /**
   * Latitude in degrees north.
   */
  lat_deg: number;
  /**
   * East longitude in degrees.
   */
  lon_deg: number;
  /**
   * Display name.
   */
  name: string;
  /**
   * Mission outcome, or null.
   */
  outcome: string | null;
  /**
   * Source of site coordinates.
   */
  source_url: string;
}
/**
 * Documented earth_az column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnEarthAz".
 */
export interface ColumnEarthAz {
  /**
   * Column name.
   */
  name: "earth_az";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 180;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.01;
}
/**
 * Documented earth_clear column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnEarthClear".
 */
export interface ColumnEarthClear {
  /**
   * Column name.
   */
  name: "earth_clear";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 0;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.01;
}
/**
 * Documented earth_el column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnEarthEl".
 */
export interface ColumnEarthEl {
  /**
   * Column name.
   */
  name: "earth_el";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 0;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.01;
}
/**
 * Documented earth_frac column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnEarthFrac".
 */
export interface ColumnEarthFrac {
  /**
   * Column name.
   */
  name: "earth_frac";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 0;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.0001;
}
/**
 * Documented sun_az column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnSunAz".
 */
export interface ColumnSunAz {
  /**
   * Column name.
   */
  name: "sun_az";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 180;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.01;
}
/**
 * Documented sun_clear column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnSunClear".
 */
export interface ColumnSunClear {
  /**
   * Column name.
   */
  name: "sun_clear";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 0;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.01;
}
/**
 * Documented sun_el column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnSunEl".
 */
export interface ColumnSunEl {
  /**
   * Column name.
   */
  name: "sun_el";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 0;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.01;
}
/**
 * Documented sun_frac column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ColumnSunFrac".
 */
export interface ColumnSunFrac {
  /**
   * Column name.
   */
  name: "sun_frac";
  /**
   * Decode as raw * scale + offset.
   */
  offset: 0;
  /**
   * Decode as raw * scale + offset.
   */
  scale: 0.0001;
}
/**
 * Reported validation comparison. See docs/validation.md, "Reported comparisons".
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Comparison".
 */
export interface Comparison {
  /**
   * Our best plain-language explanation. Required when outside_mark is true; null otherwise or when none is needed.
   */
  explanation: string | null;
  /**
   * Comparison identifier, R1 to R6.
   */
  id: string;
  /**
   * The "investigate when" mark from docs/validation.md, in unit: the largest difference between ours and reference that needs no explanation.
   */
  investigate_above: number;
  /**
   * Our measured value in unit.
   */
  ours: number;
  /**
   * True when the difference between ours and reference is above investigate_above.
   */
  outside_mark: boolean;
  /**
   * Reference value in unit.
   */
  reference: number;
  /**
   * Reference source URL.
   */
  reference_source: string;
  /**
   * Site identifier.
   */
  site_id: string;
  /**
   * Unit of both values and of investigate_above.
   */
  unit: string;
}
/**
 * Custom site job submission response.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "CustomSiteQueued".
 */
export interface CustomSiteQueued {
  /**
   * Position in queue.
   */
  position_in_queue: number;
  /**
   * Custom id c_<lat>_<lon>, coordinates rounded to four decimal places.
   */
  site_id: string;
  /**
   * Job status.
   */
  status: "queued" | "running" | "ready" | "failed";
}
/**
 * Request to compute a custom site.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "CustomSiteRequest".
 */
export interface CustomSiteRequest {
  /**
   * Latitude in degrees north.
   */
  lat_deg: number;
  /**
   * East longitude in degrees.
   */
  lon_deg: number;
  /**
   * Custom site display name.
   */
  name: string;
}
/**
 * Custom site job status.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "CustomSiteStatus".
 */
export interface CustomSiteStatus {
  /**
   * Error code and message, or null.
   */
  error: ErrorDetail | null;
  /**
   * Completed site, or null.
   */
  site: Site | null;
  /**
   * Custom id c_<lat>_<lon>, with four decimal places.
   */
  site_id: string;
  /**
   * Job status.
   */
  status: "queued" | "running" | "ready" | "failed";
}
/**
 * Structured API error.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ErrorDetail".
 */
export interface ErrorDetail {
  /**
   * Stable error code.
   */
  code:
    | "invalid_coordinates"
    | "date_outside_time_grid"
    | "rate_limited"
    | "queue_full"
    | "terrain_unavailable"
    | "not_found";
  /**
   * Plain-language error message.
   */
  message: string;
}
/**
 * Catalog or custom site.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Site".
 */
export interface Site {
  /**
   * Plain-language site description.
   */
  description: string;
  /**
   * Ground elevation in metres above reference sphere, or null.
   */
  elevation_m: number | null;
  /**
   * Catalog group.
   */
  group: "artemis" | "sunlit_peak" | "polar_lander" | "contrast";
  /**
   * Whether a close-up DEM exists.
   */
  has_closeup: boolean;
  /**
   * Stable lowercase snake_case catalog id or custom c_<lat>_<lon> id with four decimal places.
   */
  id: string;
  /**
   * Latitude in degrees north.
   */
  lat_deg: number;
  /**
   * East longitude in degrees, from 0 inclusive to 360 exclusive.
   */
  lon_deg: number;
  /**
   * NASA Moon Trek link.
   */
  moontrek_url: string;
  /**
   * Display name.
   */
  name: string;
  /**
   * Mission outcome, or null.
   */
  outcome: string | null;
  /**
   * NASA Quickmap link.
   */
  quickmap_url: string;
  /**
   * Slope and measurement baseline, or null.
   */
  slope: Slope | null;
  /**
   * Source of site coordinates.
   */
  source_url: string;
  /**
   * Terrain tier.
   */
  terrain_tier: "core80" | "wide240" | "sphere";
}
/**
 * Site slope and measurement baseline.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Slope".
 */
export interface Slope {
  /**
   * Measurement baseline in metres.
   */
  baseline_m: number;
  /**
   * Slope in degrees.
   */
  deg: number;
  /**
   * Slope data source.
   */
  source: string;
}
/**
 * One NASA product the results rest on.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "DataSource".
 */
export interface DataSource {
  /**
   * Product name.
   */
  name: string;
  /**
   * Link to the product.
   */
  url: string;
  /**
   * What TrueSouth uses it for, in a plain phrase.
   */
  used_for: string;
}
/**
 * Gate G2 at one site for one body: the largest difference in each step of the time grid.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "DifferenceOverTime".
 */
export interface DifferenceOverTime {
  /**
   * The body whose direction was compared with JPL Horizons.
   */
  body: "sun" | "earth";
  /**
   * Largest difference on the sky in degrees within each step, in time order.
   */
  max_difference_deg: number[];
  /**
   * Site identifier.
   */
  site_id: string;
  /**
   * UTC time of the first step.
   */
  start_utc: string;
  /**
   * Length of one step in hours; 24 gives one value per day.
   */
  step_h: number;
}
/**
 * API error envelope.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ErrorResponse".
 */
export interface ErrorResponse {
  error: ErrorDetail1;
}
/**
 * Structured API error.
 */
export interface ErrorDetail1 {
  /**
   * Stable error code.
   */
  code:
    | "invalid_coordinates"
    | "date_outside_time_grid"
    | "rate_limited"
    | "queue_full"
    | "terrain_unavailable"
    | "not_found";
  /**
   * Plain-language error message.
   */
  message: string;
}
/**
 * IAU named feature for map labels.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Feature".
 */
export interface Feature {
  /**
   * Diameter in kilometres.
   */
  diameter_km: number;
  /**
   * IAU gazetteer feature id.
   */
  iau_id: number;
  /**
   * Feature kind: crater or mountain.
   */
  kind: "crater" | "mountain";
  /**
   * Latitude in degrees north.
   */
  lat_deg: number;
  /**
   * East longitude in degrees.
   */
  lon_deg: number;
  /**
   * IAU feature name.
   */
  name: string;
}
/**
 * Validation hard gate result. See docs/validation.md, "Hard gates".
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Gate".
 */
export interface Gate {
  /**
   * Optional plain sentence with the expected and measured values of a synthetic test, written by the pipeline from its own numbers. Null when there is nothing to add.
   */
  detail?: string | null;
  /**
   * Gate identifier, G1 to G11.
   */
  id: string;
  /**
   * Passing limit in unit.
   */
  limit: number;
  /**
   * Measured value in unit: for most gates the largest difference found.
   */
  measured: number;
  /**
   * Gate name, a plain sentence.
   */
  name: string;
  /**
   * Whether the gate passed.
   */
  passed: boolean;
  /**
   * Number of samples compared.
   */
  samples: number;
  /**
   * Unit of measured value and limit.
   */
  unit: string;
}
/**
 * Version and shared time grid for derived data.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Manifest".
 */
export interface Manifest {
  /**
   * Generation timestamp in UTC.
   */
  generated_utc: string;
  /**
   * Moon reference radius in metres.
   */
  moon_radius_m: number;
  /**
   * Observer height in metres.
   */
  observer_height_m: number;
  /**
   * Contract version.
   */
  schema_version: 1;
  /**
   * Number of skyline azimuth bins.
   */
  skyline_bins: number;
  time_grid: TimeGrid;
}
/**
 * Shared UTC time grid.
 */
export interface TimeGrid {
  /**
   * Number of hourly samples.
   */
  count: number;
  /**
   * First time grid timestamp in UTC.
   */
  start_utc: string;
  /**
   * Time step in seconds.
   */
  step_s: number;
}
/**
 * Map image and optional lookup grid.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "MapLayer".
 */
export interface MapLayer {
  /**
   * Image file names.
   */
  files: string[];
  /**
   * Lookup grid filename, or null.
   */
  lookup?: string | null;
  /**
   * Lookup grid pixels per side, or null.
   */
  lookup_size?: number | null;
}
/**
 * Named map layers.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "MapLayers".
 */
export interface MapLayers {
  earthvis: MapLayer1;
  hillshade: MapLayer2;
  sunlight: MapLayer3;
}
/**
 * earthvis map layer.
 */
export interface MapLayer1 {
  /**
   * Image file names.
   */
  files: string[];
  /**
   * Lookup grid filename, or null.
   */
  lookup?: string | null;
  /**
   * Lookup grid pixels per side, or null.
   */
  lookup_size?: number | null;
}
/**
 * hillshade map layer.
 */
export interface MapLayer2 {
  /**
   * Image file names.
   */
  files: string[];
  /**
   * Lookup grid filename, or null.
   */
  lookup?: string | null;
  /**
   * Lookup grid pixels per side, or null.
   */
  lookup_size?: number | null;
}
/**
 * sunlight map layer.
 */
export interface MapLayer3 {
  /**
   * Image file names.
   */
  files: string[];
  /**
   * Lookup grid filename, or null.
   */
  lookup?: string | null;
  /**
   * Lookup grid pixels per side, or null.
   */
  lookup_size?: number | null;
}
/**
 * Uint8 map lookup grid with the same orientation as the images.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "MapLookupLayout".
 */
export interface MapLookupLayout1 {
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * Column 0 is left; +x is right.
   */
  column_order?: "left_to_right";
  /**
   * Unsigned 8-bit integers.
   */
  dtype?: "uint8";
  /**
   * 255 means no data.
   */
  missing?: 255;
  /**
   * Row 0 is the top; +y is up.
   */
  row_order?: "top_to_bottom";
  /**
   * Decode valid values as raw / 255.
   */
  scale?: 0.00392156862745098;
}
/**
 * South-polar map metadata.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "MapMeta".
 */
export interface MapMeta {
  /**
   * Distance from centre to edge in metres.
   */
  half_width_m: number;
  layers: MapLayers1;
  /**
   * South polar stereographic projection.
   */
  projection: "south_polar_stereographic";
}
/**
 * Image and lookup layers.
 */
export interface MapLayers1 {
  earthvis: MapLayer1;
  hillshade: MapLayer2;
  sunlight: MapLayer3;
}
/**
 * Terrain mesh dimensions.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "MeshMeta".
 */
export interface MeshMeta {
  /**
   * Vertices per side.
   */
  size: number;
  /**
   * Window width in kilometres.
   */
  window_km: number;
}
/**
 * Mission limits, preferences and provenance.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "MissionProfile".
 */
export interface MissionProfile {
  /**
   * Minimum Earth clearance in degrees.
   */
  antenna_mask_deg: number;
  /**
   * Mission on which the profile is based.
   */
  based_on: string;
  /**
   * Mission duration in days.
   */
  duration_days: number;
  /**
   * Stable preset id.
   */
  id: string;
  /**
   * Optional maximum landing Sun elevation in degrees.
   */
  landing_sun_el_max_deg: number | null;
  /**
   * Optional minimum landing Sun elevation in degrees.
   */
  landing_sun_el_min_deg: number | null;
  /**
   * Maximum continuous blackout in hours.
   */
  max_blackout_h: number;
  /**
   * Maximum continuous darkness in hours.
   */
  max_dark_h: number;
  /**
   * Maximum site slope in degrees.
   */
  max_slope_deg: number;
  /**
   * Minimum visible Sun disc fraction, dimensionless.
   */
  min_sun_fraction: number;
  /**
   * Profile display name.
   */
  name: string;
  /**
   * Optional minimum operational Sun elevation in degrees.
   */
  ops_sun_el_min_deg: number | null;
  provenance: ProfileProvenance;
  /**
   * Whether a communications relay is available.
   */
  relay_available: boolean;
  /**
   * Ideal site slope in degrees.
   */
  slope_ideal_deg: number;
  weights: Weights;
}
/**
 * Source or assumption for each profile value.
 */
export interface ProfileProvenance {
  /**
   * Source or assumption for antenna_mask_deg.
   */
  antenna_mask_deg: Sourced | Assumed;
  /**
   * Source or assumption for duration_days.
   */
  duration_days: Sourced | Assumed;
  /**
   * Source or assumption for landing_sun_el_max_deg.
   */
  landing_sun_el_max_deg: Sourced | Assumed;
  /**
   * Source or assumption for landing_sun_el_min_deg.
   */
  landing_sun_el_min_deg: Sourced | Assumed;
  /**
   * Source or assumption for max_blackout_h.
   */
  max_blackout_h: Sourced | Assumed;
  /**
   * Source or assumption for max_dark_h.
   */
  max_dark_h: Sourced | Assumed;
  /**
   * Source or assumption for max_slope_deg.
   */
  max_slope_deg: Sourced | Assumed;
  /**
   * Source or assumption for min_sun_fraction.
   */
  min_sun_fraction: Sourced | Assumed;
  /**
   * Source or assumption for ops_sun_el_min_deg.
   */
  ops_sun_el_min_deg: Sourced | Assumed;
  /**
   * Source or assumption for relay_available.
   */
  relay_available: Sourced | Assumed;
  /**
   * Source or assumption for slope_ideal_deg.
   */
  slope_ideal_deg: Sourced | Assumed;
  /**
   * Source or assumption for weights.
   */
  weights: Sourced | Assumed;
}
/**
 * A value supported by a published source.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Sourced".
 */
export interface Sourced {
  /**
   * Value is taken from a published source.
   */
  kind: "sourced";
  /**
   * Supporting quotation.
   */
  quote: string;
  /**
   * URL of published source.
   */
  source_url: string;
}
/**
 * Relative scoring weights.
 */
export interface Weights {
  /**
   * Relative comms weight, dimensionless.
   */
  comms: number;
  /**
   * Relative power weight, dimensionless.
   */
  power: number;
  /**
   * Relative slope weight, dimensionless.
   */
  slope: number;
}
/**
 * Provenance for every mission profile value, including null values.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "ProfileProvenance".
 */
export interface ProfileProvenance1 {
  /**
   * Source or assumption for antenna_mask_deg.
   */
  antenna_mask_deg: Sourced | Assumed;
  /**
   * Source or assumption for duration_days.
   */
  duration_days: Sourced | Assumed;
  /**
   * Source or assumption for landing_sun_el_max_deg.
   */
  landing_sun_el_max_deg: Sourced | Assumed;
  /**
   * Source or assumption for landing_sun_el_min_deg.
   */
  landing_sun_el_min_deg: Sourced | Assumed;
  /**
   * Source or assumption for max_blackout_h.
   */
  max_blackout_h: Sourced | Assumed;
  /**
   * Source or assumption for max_dark_h.
   */
  max_dark_h: Sourced | Assumed;
  /**
   * Source or assumption for max_slope_deg.
   */
  max_slope_deg: Sourced | Assumed;
  /**
   * Source or assumption for min_sun_fraction.
   */
  min_sun_fraction: Sourced | Assumed;
  /**
   * Source or assumption for ops_sun_el_min_deg.
   */
  ops_sun_el_min_deg: Sourced | Assumed;
  /**
   * Source or assumption for relay_available.
   */
  relay_available: Sourced | Assumed;
  /**
   * Source or assumption for slope_ideal_deg.
   */
  slope_ideal_deg: Sourced | Assumed;
  /**
   * Source or assumption for weights.
   */
  weights: Sourced | Assumed;
}
/**
 * Centre point results.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SensitivityCentre".
 */
export interface SensitivityCentre {
  /**
   * Share of hours with a link, dimensionless.
   */
  link_fraction: number;
  /**
   * Mean Sun disc fraction, dimensionless.
   */
  sun_fraction_mean: number;
}
/**
 * Request for a local sensitivity grid.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SensitivityRequest".
 */
export interface SensitivityRequest {
  /**
   * Antenna mask clearance in degrees.
   */
  antenna_mask_deg: number;
  /**
   * Mission duration in days.
   */
  duration_days: number;
  /**
   * Landing time in UTC.
   */
  landing_utc: string;
  /**
   * Latitude in degrees north.
   */
  lat_deg: number;
  /**
   * East longitude in degrees.
   */
  lon_deg: number;
  /**
   * Minimum Sun fraction, dimensionless.
   */
  min_sun_fraction: number;
}
/**
 * Sensitivity grid, row-major with row 0 north.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SensitivityResponse".
 */
export interface SensitivityResponse {
  centre_fast_method: SensitivityCentre1;
  centre_full_method: SensitivityCentre2;
  /**
   * Link fraction, row-major, row 0 north; size × size values.
   */
  link_fraction: number[];
  /**
   * Grid width and height in points.
   */
  size: number;
  /**
   * Grid spacing in metres.
   */
  spacing_m: number;
  /**
   * Mean Sun fraction, row-major, row 0 north; size × size values.
   */
  sun_fraction_mean: number[];
}
/**
 * Centre evaluated using fast skyline.
 */
export interface SensitivityCentre1 {
  /**
   * Share of hours with a link, dimensionless.
   */
  link_fraction: number;
  /**
   * Mean Sun disc fraction, dimensionless.
   */
  sun_fraction_mean: number;
}
/**
 * Centre evaluated using full skyline.
 */
export interface SensitivityCentre2 {
  /**
   * Share of hours with a link, dimensionless.
   */
  link_fraction: number;
  /**
   * Mean Sun disc fraction, dimensionless.
   */
  sun_fraction_mean: number;
}
/**
 * One scaled Int16 series column.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SeriesColumn".
 */
export interface SeriesColumn {
  /**
   * Series column name.
   */
  name: "sun_az" | "sun_el" | "sun_frac" | "sun_clear" | "earth_az" | "earth_el" | "earth_frac" | "earth_clear";
  /**
   * Decode as raw * scale + offset; angle units are degrees.
   */
  offset: number;
  /**
   * Decode as raw * scale + offset; angle units are degrees.
   */
  scale: number;
}
/**
 * Series file: column-major Int16 arrays.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SeriesLayout".
 */
export interface SeriesLayout1 {
  /**
   * Column arrays in documented order; decode raw * scale + offset.
   *
   * @minItems 8
   * @maxItems 8
   */
  arrays?: [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * Signed 16-bit integers.
   */
  dtype?: "int16";
}
/**
 * Ordered series column encodings.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SeriesMeta".
 */
export interface SeriesMeta {
  /**
   * Eight Int16 columns in documented order; value = raw * scale + offset.
   *
   * @minItems 8
   * @maxItems 8
   */
  columns: [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown];
}
/**
 * Per-site derived file metadata.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SiteMeta".
 */
export interface SiteMeta {
  /**
   * Close-up mesh metadata, null if closeup.bin is absent.
   */
  closeup: MeshMeta | null;
  /**
   * Average Earth angular radius in degrees.
   */
  earth_radius_deg: number;
  series: SeriesMeta1;
  /**
   * Catalog id or c_<lat>_<lon> custom id.
   */
  site_id: string;
  skyline: SkylineMeta;
  /**
   * Average Sun angular radius in degrees.
   */
  sun_radius_deg: number;
  /**
   * Terrain mesh metadata, null if terrain.bin is absent.
   */
  terrain: MeshMeta | null;
}
/**
 * Column encodings for series.bin.
 */
export interface SeriesMeta1 {
  /**
   * Eight Int16 columns in documented order; value = raw * scale + offset.
   *
   * @minItems 8
   * @maxItems 8
   */
  columns: [unknown, unknown, unknown, unknown, unknown, unknown, unknown, unknown];
}
/**
 * Skyline dimensions.
 */
export interface SkylineMeta {
  /**
   * Number of skyline bins.
   */
  bins: number;
  /**
   * Maximum skyline distance in kilometres.
   */
  max_range_km: number;
  /**
   * Number of missing terrain samples.
   */
  missing_samples: number;
}
/**
 * Skyline file: five Float32 arrays.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SkylineLayout".
 */
export interface SkylineLayout1 {
  /**
   * Ordered skyline arrays: degrees, kilometres, degrees, degrees, metres.
   *
   * @minItems 5
   * @maxItems 5
   */
  arrays?: [unknown, unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * 32-bit floating point.
   */
  dtype?: "float32";
}
/**
 * Skyline metadata.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SkylineMeta".
 */
export interface SkylineMeta1 {
  /**
   * Number of skyline bins.
   */
  bins: number;
  /**
   * Maximum skyline distance in kilometres.
   */
  max_range_km: number;
  /**
   * Number of missing terrain samples.
   */
  missing_samples: number;
}
/**
 * Global ephemeris file: six Float32 arrays.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "SystemLayout".
 */
export interface SystemLayout1 {
  /**
   * Ordered sub-point latitudes and longitudes in degrees and distances in kilometres.
   *
   * @minItems 6
   * @maxItems 6
   */
  arrays?: [unknown, unknown, unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * 32-bit floating point.
   */
  dtype?: "float32";
}
/**
 * Terrain or close-up file: four Float32 arrays.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "TerrainLayout".
 */
export interface TerrainLayout2 {
  /**
   * Ordered position in kilometres and slope in degrees.
   *
   * @minItems 4
   * @maxItems 4
   */
  arrays?: [unknown, unknown, unknown, unknown];
  /**
   * Little-endian byte order.
   */
  byte_order?: "little";
  /**
   * Column 0 is the western edge.
   */
  column_order?: "west_to_east";
  /**
   * 32-bit floating point.
   */
  dtype?: "float32";
  /**
   * Row 0 is the northern edge.
   */
  row_order?: "north_to_south";
}
/**
 * UTC grid shared by all series.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "TimeGrid".
 */
export interface TimeGrid1 {
  /**
   * Number of hourly samples.
   */
  count: number;
  /**
   * First time grid timestamp in UTC.
   */
  start_utc: string;
  /**
   * Time step in seconds.
   */
  step_s: number;
}
/**
 * Hard gates and reported comparisons: everything the validation page shows.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Validation".
 */
export interface Validation {
  /**
   * Reported comparisons.
   */
  comparisons: Comparison[];
  /**
   * Gate G2 over time, for the chart on the validation page. Empty until the check has been run.
   */
  g2_over_time: DifferenceOverTime[];
  /**
   * Hard gate results.
   */
  gates: Gate[];
  /**
   * When the validation was last run, in UTC.
   */
  generated_utc: string;
  /**
   * Every NASA product used, with its link.
   */
  sources: DataSource[];
}
/**
 * Non-negative relative scoring weights.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "Weights".
 */
export interface Weights1 {
  /**
   * Relative comms weight, dimensionless.
   */
  comms: number;
  /**
   * Relative power weight, dimensionless.
   */
  power: number;
  /**
   * Relative slope weight, dimensionless.
   */
  slope: number;
}
/**
 * Flat worked-example values keyed by full dotted lesson key; every key is required.
 *
 * This interface was referenced by `TrueSouthContracts`'s JSON-Schema
 * via the `definition` "WorkedExamples".
 */
export interface WorkedExamples {
  /**
   * l1.example_subsolar_lat: degrees.
   */
  "l1.example_subsolar_lat": number;
  /**
   * l1.example_subsolar_lon: degrees.
   */
  "l1.example_subsolar_lon": number;
  /**
   * l1.example_sun_az: degrees.
   */
  "l1.example_sun_az": number;
  /**
   * l1.example_sun_el: degrees.
   */
  "l1.example_sun_el": number;
  /**
   * l1.example_utc: UTC timestamp.
   */
  "l1.example_utc": string;
  /**
   * l1.site_lat_deg: degrees.
   */
  "l1.site_lat_deg": number;
  /**
   * l1.sun_el_max_deg: degrees.
   */
  "l1.sun_el_max_deg": number;
  /**
   * l1.sun_el_min_deg: degrees.
   */
  "l1.sun_el_min_deg": number;
  /**
   * l2.example_utc: UTC timestamp.
   */
  "l2.example_utc": string;
  /**
   * l2.ridge_dist_km: kilometres.
   */
  "l2.ridge_dist_km": number;
  /**
   * l2.ridge_el_deg: degrees.
   */
  "l2.ridge_el_deg": number;
  /**
   * l2.ridge_feature: text.
   */
  "l2.ridge_feature": string;
  /**
   * l2.ridge_rise_m: metres.
   */
  "l2.ridge_rise_m": number;
  /**
   * l2.sun_az_deg: degrees.
   */
  "l2.sun_az_deg": number;
  /**
   * l2.sun_el_deg: degrees.
   */
  "l2.sun_el_deg": number;
  /**
   * l2.sun_frac: dimensionless.
   */
  "l2.sun_frac": number;
  /**
   * l3.drop_at_130km_m: metres.
   */
  "l3.drop_at_130km_m": number;
  /**
   * l3.drop_at_20km_m: metres.
   */
  "l3.drop_at_20km_m": number;
  /**
   * l3.drop_at_60km_m: metres.
   */
  "l3.drop_at_60km_m": number;
  /**
   * l3.example_bin_az: degrees.
   */
  "l3.example_bin_az": number;
  /**
   * l3.example_dist_km: kilometres.
   */
  "l3.example_dist_km": number;
  /**
   * l3.example_el_flat_deg: degrees.
   */
  "l3.example_el_flat_deg": number;
  /**
   * l3.example_el_true_deg: degrees.
   */
  "l3.example_el_true_deg": number;
  /**
   * l3.example_height_m: metres.
   */
  "l3.example_height_m": number;
  /**
   * l4.earth_el_max_deg: degrees.
   */
  "l4.earth_el_max_deg": number;
  /**
   * l4.earth_el_min_deg: degrees.
   */
  "l4.earth_el_min_deg": number;
  /**
   * l4.earth_up_pct: percent.
   */
  "l4.earth_up_pct": number;
  /**
   * l4.example_earth_az: degrees.
   */
  "l4.example_earth_az": number;
  /**
   * l4.example_earth_clear: degrees.
   */
  "l4.example_earth_clear": number;
  /**
   * l4.example_earth_el: degrees.
   */
  "l4.example_earth_el": number;
  /**
   * l4.example_utc: UTC timestamp.
   */
  "l4.example_utc": string;
  /**
   * l4.link_pct_mask0: percent.
   */
  "l4.link_pct_mask0": number;
  /**
   * l4.link_pct_mask1: percent.
   */
  "l4.link_pct_mask1": number;
  /**
   * l4.link_pct_mask5: percent.
   */
  "l4.link_pct_mask5": number;
  /**
   * l5.example_site: text.
   */
  "l5.example_site": string;
  /**
   * l5.plane_a: dimensionless.
   */
  "l5.plane_a": number;
  /**
   * l5.plane_b: dimensionless.
   */
  "l5.plane_b": number;
  /**
   * l5.slope_100m_deg: degrees.
   */
  "l5.slope_100m_deg": number;
  /**
   * l5.slope_10m_deg: degrees.
   */
  "l5.slope_10m_deg": number;
  /**
   * l5.slope_160m_deg: degrees.
   */
  "l5.slope_160m_deg": number;
  /**
   * l6.a_score: dimensionless.
   */
  "l6.a_score": number;
  /**
   * l6.b_score: dimensionless.
   */
  "l6.b_score": number;
  /**
   * l6.example_metrics.landing_lit: boolean.
   */
  "l6.example_metrics.landing_lit": boolean;
  /**
   * l6.example_metrics.landing_sun_el_deg: degrees.
   */
  "l6.example_metrics.landing_sun_el_deg": number;
  /**
   * l6.example_metrics.link_fraction: dimensionless.
   */
  "l6.example_metrics.link_fraction": number;
  /**
   * l6.example_metrics.lit_fraction: dimensionless.
   */
  "l6.example_metrics.lit_fraction": number;
  /**
   * l6.example_metrics.longest_blackout_h: hours.
   */
  "l6.example_metrics.longest_blackout_h": number;
  /**
   * l6.example_metrics.longest_dark_h: hours.
   */
  "l6.example_metrics.longest_dark_h": number;
  /**
   * l6.example_metrics.sun_fraction_mean: dimensionless.
   */
  "l6.example_metrics.sun_fraction_mean": number;
  /**
   * l6.example_score: dimensionless.
   */
  "l6.example_score": number;
  /**
   * l6.example_utilities.comms: dimensionless.
   */
  "l6.example_utilities.comms": number;
  /**
   * l6.example_utilities.power: dimensionless.
   */
  "l6.example_utilities.power": number;
  /**
   * l6.example_utilities.slope: dimensionless.
   */
  "l6.example_utilities.slope": number;
  /**
   * l6.site_a: text.
   */
  "l6.site_a": string;
  /**
   * l6.site_b: text.
   */
  "l6.site_b": string;
  /**
   * l7.alt_site: text.
   */
  "l7.alt_site": string;
  /**
   * l7.go_date: UTC timestamp.
   */
  "l7.go_date": string;
  /**
   * l7.next_go_date: UTC timestamp.
   */
  "l7.next_go_date": string;
  /**
   * l7.slip_blackout_h: hours.
   */
  "l7.slip_blackout_h": number;
  /**
   * l7.slip_date: UTC timestamp.
   */
  "l7.slip_date": string;
  /**
   * l7.slip_vetoes: list of text identifiers.
   */
  "l7.slip_vetoes": string[];
  /**
   * l8.candidates: list of text identifiers.
   */
  "l8.candidates": string[];
  /**
   * l8.region_overlap.overlaps: boolean.
   */
  "l8.region_overlap.overlaps": boolean;
  /**
   * l8.region_overlap.region_name: text.
   */
  "l8.region_overlap.region_name": string;
  /**
   * l8.region_overlap.site_id: text.
   */
  "l8.region_overlap.site_id": string;
}
