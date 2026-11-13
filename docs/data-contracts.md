# Data contracts

The exact formats of every derived file and API message.

**The source of truth is `science/src/truesouth/contracts.py`.** This page explains those
models; if the two disagree, the code wins and this page gets fixed. TypeScript types are
generated into `web/src/contracts/generated.ts`.

All angles are degrees. All timestamps are UTC ISO-8601 ending in `Z`. Binary files are
little-endian.

## Catalog input

`data/catalog/sites.json` is an array of `CatalogSite` entries: `id`, `name`, `group`,
`lat_deg`, `lon_deg`, `description`, `source_url`, and `outcome`. The pipeline adds the
terrain tier, close-up availability, elevation, slope, Quickmap URL and Moon Trek URL
when it produces the derived `Site`; those fields are not catalog input guesses.

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
| `variant_of` | string \| null | For a best-lit variant: the id of the catalog site it belongs to. `null` for every other site |
| `offset_m` | number \| null | For a best-lit variant: its distance from that site's listed point, in metres. `null` otherwise |
| `nearby_sun` | `{ radius_m, points, min, max }` \| null | For a `sunlit_peak` site and its variant: the lowest and highest mean `sun_frac` among the map pixels within `radius_m` of the listed point, and how many points that is. `null` for other sites. See [`science.md`](science.md) §7.1 |

A best-lit variant has the id `<id>_best_lit`, the same group as its site, and a
`description` and `source_url` written by the pipeline that say the point was chosen by
TrueSouth. It is never listed in `data/catalog/sites.json`.

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

Named features for labels: `{ name, kind, iau_id, lat_deg, lon_deg, diameter_km }`.
`kind` is `crater` or `mountain`; `iau_id` is the IAU gazetteer id.

### `artemis_regions.json`

`{ name, lat_deg, lon_deg, size_km, source_url }` per region. `lat_deg` and `lon_deg` are
`null` where no centre is published; `size_km` is `null` when no size is published.

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
with +x right, +y up, and row 0 at the top. Lookup grids use the same orientation. A pixel converts to latitude and longitude with the inverse
projection in [`science.md`](science.md) §2.3. Lookup grids are `Uint8`, where a value $v$
means $v/255$, and 255 marks "no data".

- **Writing a lookup value.** A fraction $f$ between 0 and 1 is stored as
  $\min(\operatorname{round}(255 f),\ 254)$. The byte 255 is never a value, so a fraction
  of exactly 1 is stored as 254 and reads back as 0.996. The largest error is 0.002 below
  that cap and 0.004 at it.
- **A lookup cell's value** is the mean of the source map's valid pixels whose centres
  fall inside the cell. A cell with no valid source pixel is "no data", never 0.
- **Sources.** The hillshade comes from the 80 m terrain map by
  [`science.md`](science.md) §2.4. The sunlight and Earth-visibility layers come from
  NASA's 60 m average maps where they have data (to about 85°S) and from the 120 m maps
  beyond that, out to the image edge at 80°S. Each file's own scale, offset and no-data
  value are read from the file.
- **Overlay images** map a fraction of 0 to black and 1 to white in one channel, with
  "no data" fully transparent. The web app tints them.
- **Image sizes.** A `_4k` image is 4,096 pixels on a side and an `_8k` image 8,192.

### Scene image files

The 3D scene ([`features/system-view.md`](features/system-view.md)) reads web-sized images of the Moon, Earth and the south polar cap, and a height grid around each non-sphere site. `build-scene-assets` writes them to `data/derived/scene/`, served under `/data/scene/`. `scene/meta.json` (`SceneMeta`) lists every file with its size in pixels, encoding, orientation, source, operation and credit. `schema_version` is 1.

Every image is NASA data, or made from NASA data by the pipeline, and is only resized, cropped, split or re-encoded. Nothing is retouched or AI-generated. The still picture is a render of the scene and is not a file this step writes.

The cap image `maps/hillshade_4k.webp` is not copied. The scene reads it from `maps/`. Derived crops and resizes go in `scene/`.

**Moon and Earth.** Equirectangular, longitude 0° at the centre, north up (`equirectangular_lon0_center_north_up`). The SVS TIFFs and the Blue Marble JPEG have no CRS and no geotransform; each is a 2:1 degree grid. Keeping the file's own pixel order is the only axis-aligned arrangement that puts Tycho on bright rays, Mare Crisium on dark mare, Shackleton in a depression on the height map, and the Sahara on tan land. A roll or a flip fails that check and the build stops.

| File | Pixels | Encoding | Source and operation |
| :--- | :--- | :--- | :--- |
| `scene/moon_2k.webp` | 2,048 × 1,024 | WebP quality 82, method 6 | SVS 4720 `lroc_color_poles_4k.tif`, Lanczos resize |
| `scene/moon_4k.webp` | 4,096 × 2,048 | WebP quality 82, method 6 | The same map, re-encoded at its own size. The default |
| `scene/moon_8k_w.webp`, `scene/moon_8k_e.webp` | 4,096 × 4,096 each | WebP quality 80, method 6 | `lroc_color_poles_8k.tif` split on the centre column. West is 180°W to 0°, east is 0° to 180°E. Optional. The halves join with no overlap and no dropped column |
| `scene/moon_height_1440.png` | 1,440 × 720 | 8-bit greyscale PNG | `ldem_4.tif`, heights in kilometres. −9.0 km is 0 and +10.6 km is 255 |
| `scene/earth_2k.jpg` | 2,048 × 1,024 | JPEG quality 84, progressive, 4:2:0 | Blue Marble Next Generation, March 2004, Lanczos resize from 5,400 × 2,700 |

**The south polar cap.** Squares centred on the south pole, +x right, +y up, row 0 at the top (`south_polar_stereographic_x_right_y_up`), the projection in [`science.md`](science.md) §2.3.

| File | Pixels | Encoding | Source and operation |
| :--- | :--- | :--- | :--- |
| `maps/hillshade_4k.webp` | 4,096 × 4,096 | WebP quality 80, method 4 | The pipeline's shaded relief ([`science.md`](science.md) §2.4). Not copied |
| `scene/hillshade_core_2048.webp` | 2,048 × 2,048 | WebP quality 85, method 6 | Centre of `maps/hillshade_8k.webp`. The 8,192-pixel image covers ±304 km, so the centre 2,048 pixels are ±76 km, centred on the pole to the pixel |
| `scene/sunlight_2k.webp`, `scene/earthvis_2k.webp` | 2,048 × 2,048 each | 8-bit greyscale WebP, quality 85, method 6 | The 4K overlay images in `maps/`, Lanczos resize. 0 is black and 1 is white |
| `scene/cap_slope.webp` | 1,900 × 1,900 | WebP quality 92, method 6 | The 80 m terrain map averaged in exact 4 × 4 blocks (320 m a pixel), then central differences |
| `scene/cap_slope_core.webp` | 950 × 950 | Lossless WebP, method 6 | The centre ±76 km, in exact 2 × 2 blocks (160 m a pixel), the same encoding |

Slope channels: red is ∂z/∂x with +x east, green is ∂z/∂y with +y north (up the image, so the row derivative is negated), blue is 128. A slope *s* is stored as round(128 + 160 *s*), clamped to 0–255. A missing slope is stored as 128.

**Aprons.** One file per non-sphere site in `sites.json`: `scene/aprons/<site_id>.bin`. A sphere-tier site has none. The 20 km patch is not repeated here; it is `sites/<id>/terrain.bin`.

The catalog grid is 161 × 161 over a 300 km square centred on the site. Points are walked from the site ([`science.md`](science.md) §2.2) on the same axes as the patch ([`science.md`](science.md) §13): row 0 is the northern edge, column 0 the western edge. Heights are `DemStore.sample` at those points (the 80 m map where it covers, otherwise the 240 m map), not a resampled block mean.

`ApronLayout`, shared by every file and also listed on `BinaryLayouts`:

- Little-endian `uint16`, value = (height in metres + 12,000) × 2. The step is 0.5 m.
- 65535 means no height. It is never a real elevation. A finite height outside −12,000 m to 20,767 m stops the build.
- Byte length is `rows × columns × 2`.

`scene/meta.json` records each apron's site id, file, row count, column count and window in metres. Fixture aprons use the same encoding on a 5 × 5 grid so the web app can load them without the NASA maps.

**Inputs.** `inputs` in `scene/meta.json` is the byte size and SHA-256 of each file the build read, including `scene_assets.py`. A second run whose fingerprints match, and whose output files are all present, does nothing. The same inputs written again are byte-identical: WebP method and quality are pinned, PNG ancillary chunks that carry the clock are dropped, and JPEG uses quality 84, progressive, 4:2:0.

**Credits**, stored on each image: NASA Scientific Visualization Studio and the LRO LROC and LOLA teams for the Moon; NASA Earth Observatory, Reto Stöckli, for Blue Marble; NASA LOLA / PGDA for the cap, the slopes and the aprons.

### `validation.json` and `academy/worked_examples.json`

Described in [`validation.md`](validation.md) and
[`academy/lessons.md`](academy/lessons.md). A gate leaves `passed` and `measured` null
together when `validate` did not measure it. `samples` is then 0, and `detail` says
where that gate is checked. G10 and G11 are written that way.

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

`name` is optional, trimmed, and at most 120 characters. Longitude is finite and normalised
to [0, 360); coordinates are rounded before computing, with negative zero removed.

`status` is `queued`, `running`, `ready` or `failed`. A known site returns `ready` at once.

The id is the coordinates rounded to four decimals, as `c_<lat>_<lon>`. Anyone holding the
id can ask for the site again.

### `GET /api/sites/custom/{id}`

```json
{ "site_id": "c_-89.2000_130.5000", "status": "ready", "site": { "…one sites.json entry…" }, "error": null }
```

`error` is either null or an error detail `{ code, message }`.

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

Sensitivity arrays are row-major, row 0 is north, and each contains `size * size` values.

### Errors

Custom-site success messages and status values above are unchanged. Errors never echo
submitted values, unknown field names, validator types or internal exception details.

| HTTP | Body | Header |
| :--- | :--- | :--- |
| 413 | `{ "message": "Custom-site requests must be at most 4096 bytes." }` | None |
| 422 | `{ "message": "Please check the request fields.", "fields": [{ "field": "lat_deg", "message": "Latitude must be a number from −90 to 90." }] }` | None |
| 429 | `{ "message": "You may start 6 custom sites per hour. Please try again later." }` | `Retry-After`: integer seconds until a slot becomes available |
| 429 | `{ "message": "The custom-site queue is full. Please try again later." }` | `Retry-After: 1` |
| 503 | `{ "message": "Custom sites need the terrain maps, which are not installed on this server." }` | None |
| 503 | `{ "message": "Custom sites need the global ephemeris, which is not installed on this server." }` | None |
| 503 | `{ "message": "This server is handling too many client addresses. Please try again later." }` | `Retry-After: 3600` |
| 503 | `{ "message": "This server is shutting down. Please try again later." }` | None |
| 507 | `{ "message": "This server's storage for custom sites is full." }` | None |

The 422 `fields` array contains one or more `{ field, message }` objects. `field` is
only `lat_deg`, `lon_deg`, `name` or `body`. Latitude advice is the message above, or
`Latitude must be at least 0.001° away from a pole.` for a point the science rejects.
Longitude advice is `Longitude must be a finite number.` Name advice is
`Name must be text of at most 120 characters.` Malformed JSON, a missing/invalid body,
or extra fields use `body` with `Send a JSON object with latitude, longitude and an
optional name. Only these fields are allowed.` Latitude and longitude must be finite
JSON numbers (booleans and strings are rejected); name must be a string.

Names have control and non-printable characters removed, are trimmed, and are limited
to 120 characters after cleaning. The body limit applies before parsing, including
streamed requests without Content-Length. A 507 at admission creates no job and uses
no rate slot. If storage fills during an accepted job, status becomes `failed` with
`error: { "code": "storage_full", "message": "This server's storage for custom sites is full." }`.
Other job failures use `computation_failed` and a plain message; the status envelope
always retains `site_id`, `status`, `site` and `error`.

Unknown or unfinished custom ids use HTTP 404 with
`{ "message": "Custom site is not ready. Start it with POST /api/sites/custom." }`.

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
| `focus` | Optional site id. Written only when that site is not the first in `sites`. If it is absent, or names a site that is not selected, the first selected site is focused |

A preset is written as its id, for example `im2_athena`. A custom profile is the
base preset plus only the fields that differ from it:

```text
custom:<preset>;<field>=<value>;<field>=<value>
```

```text
custom:im2_athena;duration_days=12;max_dark_h=8;weights=0.5:0.3:0.2
```

- Field names are the value fields in [`mission-profiles.md`](mission-profiles.md):
  `duration_days`, `min_sun_fraction`, `ops_sun_el_min_deg`, `max_dark_h`,
  `relay_available`, `antenna_mask_deg`, `max_blackout_h`, `max_slope_deg`,
  `slope_ideal_deg`, `landing_sun_el_min_deg`, `landing_sun_el_max_deg`, `weights`.
- A number is a plain decimal. Booleans are `true` or `false`. An optional
  elevation with no limit is `null`.
- `weights` is `slope:power:comms`, three numbers, for example `0.4:0.35:0.25`.
- An unknown field is skipped. A value that cannot be read, or that is out of
  range, is skipped. The rest of the profile is kept.
- The whole `profile` parameter is ignored when the base preset is unknown or a
  piece is not `field=value`. That is a malformed custom profile.

`t` is a whole number of hours after `land`, and may be negative when the
scrubber sits in the three days before landing. `focus` names the focused site
when it is not the first in `sites`. Opening a link with no `focus`, or a
`focus` that is not one of the selected sites, focuses the first site in `sites`.

## Changing a contract

1. Edit `contracts.py`.
2. Run `uv run truesouth export-schema` and `pnpm --dir web gen:types`.
3. Raise `schema_version` if old files can no longer be read.
4. Update this page and rebuild fixtures.
5. Open a pull request. The Science track and every consuming track review it.

### S0 serialization choices

Profile `provenance` maps each profile value field (including optional null values and
`weights`) to either `{ "kind": "sourced", "source_url": "...", "quote": "..." }`
or `{ "kind": "assumed", "reason": "..." }`. Identity fields are not mission values.
Worked examples are a flat object keyed by full dotted lesson keys as described in
`academy/lessons.md`; every contract key is required. Wildcard examples are expanded
into individual dotted keys. Candidates and vetoes are arrays of identifiers; overlap
uses `site_id`, `region_name` and `overlaps`.
The JSON Schema includes `BinaryLayouts`, describing the binary files' array order,
data types and series scaling for decoders.

### S2 fixture choices

Fixture map images and lookup grids are 64 × 64 pixels, despite their production file
names; map metadata gives the actual lookup size. The scoring cases refer to a fixture
`series.bin` and a half-open range of global hour indices. Landing and current hours are
global indices; subtract the range start before scoring the referenced slice. The cases
file has `format`, `generated_by`, and `cases` keys; a case's `expected` is null when
its window does not fit. Each run of `build-fixtures` rewrites the files. Fixture
validation results and worked examples are synthetic demonstrations, not measurements
from NASA data.

### Shared scoring cases

`web/src/lib/scoring/__fixtures__/scoring_cases.json` is an object with `format` (a
reader description), `generated_by` (the build command), and `cases` (an array).
Each case has:

- `labels`: coverage labels; `site_id`: the fixture site; `profile`: the full mission profile.
- `series_file`: path relative to `data/fixtures/`; `hour_range`: `[start, end)` on the
  full time grid. Read that slice of every decoded column from the file.
- `landing_hour` and `current_hour`: full-grid indices. Subtract `start` to index the
  slice. `landing_utc` is the landing timestamp; `slope_deg` is the slope or null.
- `countdowns`: all four countdowns at `current_hour`, including null values when no
  transition remains in the slice.
- `expected`: null when the mission window does not fit. Otherwise it contains
  `window_length`, `lit`, `link`, `evaluation`, and `countdowns`. Both flag arrays
  contain exactly `window_length` booleans starting at the landing hour; `evaluation`
  contains metrics, vetoes, utilities, score, status and slope assessment.
