import type {
  ColumnEarthAz,
  ColumnEarthClear,
  ColumnEarthEl,
  ColumnEarthFrac,
  ColumnSunAz,
  ColumnSunClear,
  ColumnSunEl,
  ColumnSunFrac,
  MapLookupLayout,
  SkylineLayout,
  SystemLayout,
  TerrainLayout,
} from "../../contracts/generated.ts";

/**
 * Series column order is the generated column types, which match SeriesLayout.
 * json-schema-to-typescript types the layout tuples as `unknown`, so the names
 * for the other files live once here and the tests compare them to schema.json.
 */
export const SERIES_COLUMNS = [
  { name: "sun_az", scale: 0.01, offset: 180 },
  { name: "sun_el", scale: 0.01, offset: 0 },
  { name: "sun_frac", scale: 0.0001, offset: 0 },
  { name: "sun_clear", scale: 0.01, offset: 0 },
  { name: "earth_az", scale: 0.01, offset: 180 },
  { name: "earth_el", scale: 0.01, offset: 0 },
  { name: "earth_frac", scale: 0.0001, offset: 0 },
  { name: "earth_clear", scale: 0.01, offset: 0 },
] as const satisfies readonly [
  ColumnSunAz,
  ColumnSunEl,
  ColumnSunFrac,
  ColumnSunClear,
  ColumnEarthAz,
  ColumnEarthEl,
  ColumnEarthFrac,
  ColumnEarthClear,
];

export const SKYLINE_ARRAYS = ["el_deg", "dist_km", "lat_deg", "lon_deg", "height_m"] as const;

export const TERRAIN_ARRAYS = ["east_km", "north_km", "up_km", "slope_deg"] as const;

export const SYSTEM_ARRAYS = [
  "subsolar_lat",
  "subsolar_lon",
  "subearth_lat",
  "subearth_lon",
  "earth_dist_km",
  "sun_dist_km",
] as const;

type Equal<Left, Right> = [Left] extends [Right] ? ([Right] extends [Left] ? true : false) : false;

/** Fails typecheck when a layout constant drifts from the generated tuple length. */
function layoutLengthsMatch(
  skyline: Equal<(typeof SKYLINE_ARRAYS)["length"], NonNullable<SkylineLayout["arrays"]>["length"]>,
  terrain: Equal<(typeof TERRAIN_ARRAYS)["length"], NonNullable<TerrainLayout["arrays"]>["length"]>,
  system: Equal<(typeof SYSTEM_ARRAYS)["length"], NonNullable<SystemLayout["arrays"]>["length"]>,
): void {
  void skyline;
  void terrain;
  void system;
}

layoutLengthsMatch(true, true, true);

/** 255 means no data. Any other byte v means v/255. */
export const LOOKUP_NO_DATA = 255 satisfies NonNullable<MapLookupLayout["missing"]>;

export type SeriesColumnName = (typeof SERIES_COLUMNS)[number]["name"];

export type SeriesColumnSpec = {
  name: SeriesColumnName;
  scale: number;
  offset: number;
};

export type DecodedSeries = Record<SeriesColumnName, Float64Array>;
export type DecodedSkyline = Record<(typeof SKYLINE_ARRAYS)[number], Float32Array>;
export type DecodedTerrain = Record<(typeof TERRAIN_ARRAYS)[number], Float32Array>;
export type DecodedSystem = Record<(typeof SYSTEM_ARRAYS)[number], Float32Array>;
