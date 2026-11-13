# Data contracts

The exact formats of every derived file and API message.

**The source of truth is `science/src/truesouth/contracts.py`.** This page explains those
models; if the two disagree, the code wins and this page gets fixed. TypeScript types are
generated into `web/src/contracts/generated.ts`.

All angles are degrees. All timestamps are UTC ISO-8601 ending in `Z`. Binary files are
little-endian.

## Derived files

Served under `/data/`. The same tree exists in `data/fixtures/` with synthetic content.

```text
data/derived/
├── manifest.json
├── sites.json
├── profiles.json
├── features.json
├── artemis_regions.json
├── system.bin
├── validation.json
├── sites/<site_id>/
│   ├── meta.json
│   ├── series.bin
│   ├── skyline.bin
│   ├── terrain.bin            # terrain tiers core80 and wide240 only
│   └── closeup.bin            # sites with a close-up DEM only
├── maps/
│   ├── meta.json
│   ├── hillshade_4k.webp   hillshade_8k.webp
│   ├── sunlight_4k.webp    earthvis_4k.webp
│   └── sunlight_u8.bin     earthvis_u8.bin
└── academy/worked_examples.json
```

### `manifest.json`

```json
{
  "schema_version": 1,
  "generated_utc": "2026-11-14T09:00:00Z",
  "time_grid": { "start_utc": "2026-01-01T00:00:00Z", "step_s": 3600, "count": 52584 },
  "observer_height_m": 2.0,
  "skyline_bins": 1440,
  "moon_radius_m": 1737400
}
```

The app refuses to load a manifest whose `schema_version` it does not know.

### `sites.json`

An array of catalog sites.

| Field | Type | Meaning |
| :--- | :--- | :--- |
| `id` | string | Stable, lowercase, `snake_case` |
| `name` | string | Display name |
| `group` | `"artemis"` \| `"sunlit_peak"` \| `"polar_lander"` \| `"contrast"` | Catalog group |
| `lat_deg`, `lon_deg` | number | Latitude; east longitude 0–360 |
| `description` | string | One or two plain sentences |
| `source_url` | string | Where the coordinates come from |
| `outcome` | string \| null | For real missions: what happened |
| `terrain_tier` | `"core80"` \| `"wide240"` \| `"sphere"` | Which terrain the skyline used |
| `has_closeup` | boolean | A close-up DEM exists |
| `elevation_m` | number \| null | Ground height above the reference sphere |
| `slope` | `{ deg, baseline_m, source }` \| null | See [`science.md`](science.md) §8 |
| `quickmap_url`, `moontrek_url` | string | Links out to the NASA tools |

### `sites/<site_id>/meta.json`

```json
{
  "site_id": "connecting_ridge",
  "series": {
    "columns": [
      { "name": "sun_az",      "scale": 0.01,   "offset": 180.0 },
      { "name": "sun_el",      "scale": 0.01,   "offset": 0.0 },
      { "name": "sun_frac",    "scale": 0.0001, "offset": 0.0 },
      { "name": "sun_clear",   "scale": 0.01,   "offset": 0.0 },
      { "name": "earth_az",    "scale": 0.01,   "offset": 180.0 },
      { "name": "earth_el",    "scale": 0.01,   "offset": 0.0 },
      { "name": "earth_frac",  "scale": 0.0001, "offset": 0.0 },
      { "name": "earth_clear", "scale": 0.01,   "offset": 0.0 }
    ]
  },
  "sun_radius_deg": 0.266,
  "earth_radius_deg": 0.95,
  "skyline": { "bins": 1440, "missing_samples": 0, "max_range_km": 300 },
  "terrain": { "size": 257, "window_km": 20.0 },
  "closeup": { "size": 257, "window_km": 2.0 }
}
```

`sun_radius_deg` and `earth_radius_deg` are the averages over the time grid, for drawing.
`terrain` and `closeup` are `null` when the file does not exist.

### `sites/<site_id>/series.bin`

`Int16`, column after column in the order of `meta.series.columns`, each `count` values
long. Decode with

```text
value = raw * scale + offset
```

Precision is 0.01° for angles and 0.0001 for fractions. Size is about 0.84 MB per site.

### `sites/<site_id>/skyline.bin`

`Float32`, five arrays of 1,440 values each, in this order:

| Array | Meaning |
| :--- | :--- |
| `el_deg` | Skyline elevation for the bin |
| `dist_km` | Ground distance to the blocker |
| `lat_deg` | Blocker latitude |
| `lon_deg` | Blocker east longitude |
| `height_m` | Blocker height above the reference sphere |

Bin $k$ is centred on azimuth $0.25k$ degrees. For a sphere-tier site, `el_deg` is the
flat-horizon value everywhere and the other four arrays are `NaN`.

### `sites/<site_id>/terrain.bin` and `closeup.bin`

`Float32`, four arrays of `size × size` values: `east_km`, `north_km`, `up_km`,
`slope_deg`. Row 0 is the northern edge, column 0 the western edge. Positions are local
coordinates as in [`science.md`](science.md) §13. Missing terrain is `NaN`.

### `system.bin`

`Float32`, six arrays of `count` values: `subsolar_lat`, `subsolar_lon`, `subearth_lat`,
`subearth_lon`, `earth_dist_km`, `sun_dist_km`.

### `profiles.json`

An array of mission profiles. Fields and presets are in
[`mission-profiles.md`](mission-profiles.md).

### `features.json`

Named features for labels: `{ name, kind, lat_deg, lon_deg, diameter_km }`.

### `artemis_regions.json`

`{ name, lat_deg, lon_deg, size_km, source_url }` per region. `lat_deg` and `lon_deg` are
`null` where no centre is published.

### `maps/meta.json`

```json
{
  "projection": "south_polar_stereographic",
  "half_width_m": 304000,
  "layers": {
    "hillshade": { "files": ["hillshade_4k.webp", "hillshade_8k.webp"] },
    "sunlight":  { "files": ["sunlight_4k.webp"], "lookup": "sunlight_u8.bin", "lookup_size": 2048 },
    "earthvis":  { "files": ["earthvis_4k.webp"], "lookup": "earthvis_u8.bin", "lookup_size": 2048 }
  }
}
```

Every image is a square centred on the pole, covering `half_width_m` in each direction,
with +x right and +y up. A pixel converts to latitude and longitude with the inverse
projection in [`science.md`](science.md) §2.3. Lookup grids are `Uint8`, where a value $v$
means $v/255$, and 255 marks "no data".

### `validation.json` and `academy/worked_examples.json`

Described in [`validation.md`](validation.md) and
[`academy/lessons.md`](academy/lessons.md).

## API messages

### `POST /api/sites/custom`

Request:

```json
{ "lat_deg": -89.2, "lon_deg": 130.5, "name": "My site" }
```

Response:

```json
{ "site_id": "c_-89.2000_130.5000", "status": "queued", "position_in_queue": 1 }
```

`status` is `queued`, `running`, `ready` or `failed`. A known site returns `ready` at once.

The id is the coordinates rounded to four decimals, as `c_<lat>_<lon>`. Anyone holding the
id can ask for the site again.

### `GET /api/sites/custom/{id}`

```json
{ "site_id": "c_-89.2000_130.5000", "status": "ready", "site": { "…one sites.json entry…" }, "error": null }
```

When ready, the site's files are at `/api/custom/{id}/meta.json`, `series.bin`,
`skyline.bin` and, with terrain, `terrain.bin`.

### `POST /api/sensitivity`

Request:

```json
{
  "lat_deg": -89.45, "lon_deg": 222.6,
  "landing_utc": "2028-03-14T00:00:00Z", "duration_days": 10,
  "min_sun_fraction": 0.5, "antenna_mask_deg": 1.0
}
```

Response:

```json
{
  "size": 9, "spacing_m": 250,
  "sun_fraction_mean": [0.81, 0.79, "…81 values, row 0 = north…"],
  "link_fraction": [0.44, 0.44, "…"],
  "centre_full_method": { "sun_fraction_mean": 0.80, "link_fraction": 0.43 },
  "centre_fast_method": { "sun_fraction_mean": 0.81, "link_fraction": 0.44 }
}
```

### Errors

Every error is `{ "error": { "code": "...", "message": "plain sentence" } }` with a
matching HTTP status. Codes: `invalid_coordinates`, `date_outside_time_grid`,
`rate_limited`, `queue_full`, `terrain_unavailable`, `not_found`.

## Shareable scenario link

Mission Control mirrors its scenario into the URL:

```text
/mission?profile=im2_athena&sites=connecting_ridge,mons_mouton&land=2028-03-14T00:00Z&t=36&view=panorama
```

| Parameter | Meaning |
| :--- | :--- |
| `profile` | Preset id, or `custom:` followed by a compact encoding of the changed fields |
| `sites` | Comma-separated site ids; custom sites use their `c_<lat>_<lon>` id |
| `land` | Landing date |
| `t` | Current time, in hours after the landing date |
| `view` | `slip`, `system`, `map`, `terrain`, `panorama` or `compare` |

## Changing a contract

1. Edit `contracts.py`.
2. Run `uv run truesouth export-schema` and `pnpm --dir web gen:types`.
3. Raise `schema_version` if old files can no longer be read.
4. Update this page and rebuild fixtures.
5. Open a pull request. The Science track and every consuming track review it.
