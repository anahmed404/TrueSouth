# Architecture

How TrueSouth is put together and how to run it.
Reasons for the main choices are in [`decisions/`](decisions/).

## The shape

```text
 NASA sources                Python pipeline                 Static files             Browser
┌──────────────────┐      ┌────────────────────┐      ┌────────────────────┐   ┌────────────────────┐
│ JPL Horizons     │ ───► │ global ephemeris   │      │ data/derived/      │   │ loads series       │
│ LOLA polar maps  │ ───► │ skylines           │ ───► │  series, skylines, │──►│ computes metrics   │
│ LOLA close-ups   │ ───► │ per-hour series    │      │  terrain, maps     │   │  and scores        │
│ PGDA sunlight    │ ───► │ slopes, meshes     │      └────────────────────┘   │ draws every view   │
│  maps            │      │ map images         │                               └─────────┬──────────┘
└──────────────────┘      │ validation         │      ┌────────────────────┐             │
                          └────────────────────┘      │ API (same Python)  │◄────────────┘
                                                      │  custom sites      │   only for custom sites
                                                      │  sensitivity grid  │   and sensitivity grids
                                                      └────────────────────┘
```

- **Catalog sites** are computed ahead of time and shipped as static files. Mission Control
  and the Academy work for them with no API at all.
- **The API** handles the two things that cannot be precomputed: custom sites and
  sensitivity grids. It reuses the pipeline's code. It never calls Horizons, because the
  global ephemeris already covers every site
  ([`decisions/0004`](decisions/0004-one-global-ephemeris.md)).
- **The browser** turns series into metrics, vetoes and scores, so sliders respond
  instantly ([`decisions/0002`](decisions/0002-scoring-in-browser.md)).

## Stack

| Layer | Choice |
| :--- | :--- |
| Python | 3.12, managed with `uv` |
| Science | `numpy`, `scipy`, `pyproj`, `pydantic` v2 |
| Raster reading | `rasterio`, used only by the prepare step |
| HTTP client | `httpx` with `truststore` |
| Images | `pillow` |
| API | FastAPI, `uvicorn` |
| Python tests | `pytest` |
| Node | 22, managed with `pnpm` |
| App | React, Vite, TypeScript (strict), React Router |
| Styling | Tailwind CSS |
| State | Zustand |
| Animation | Motion (Framer Motion) |
| 3D | three.js through React Three Fiber and drei |
| Charts and maps | Hand-built SVG and Canvas with `d3-scale`, `d3-shape`, `d3-zoom` |
| Math in lessons | KaTeX through `react-markdown`, `remark-math`, `rehype-katex` |
| Icons | `lucide-react` |
| Web tests | `vitest` |
| Type generation | Pydantic → JSON Schema → `json-schema-to-typescript` |

Use the latest stable release of each at scaffold time and commit the lockfiles.
There is no Recharts and no Playwright.

## Repo layout

```text
TrueSouth/
├── README.md  AGENTS.md  CLAUDE.md  CONTEXT.md  DEVLOG.md
├── docs/
├── pyproject.toml                 # uv workspace: science + api
├── science/
│   ├── pyproject.toml             # package "truesouth"
│   ├── src/truesouth/
│   │   ├── constants.py
│   │   ├── contracts.py           # Pydantic models: the source of truth for formats
│   │   ├── frames.py              # science.md §2
│   │   ├── horizons.py            # Horizons client and parser
│   │   ├── ephemeris.py           # science.md §3
│   │   ├── dem.py                 # prepared-map store, sampling, tiers
│   │   ├── skyline.py             # science.md §4–5
│   │   ├── discs.py               # science.md §6
│   │   ├── series.py              # science.md §7, encoding
│   │   ├── slope.py               # science.md §8
│   │   ├── scoring.py             # reference copy of science.md §9–10
│   │   ├── sensitivity.py         # science.md §12
│   │   ├── terrain_mesh.py        # science.md §13
│   │   ├── maps.py                # map images
│   │   ├── catalog.py             # reads docs-backed site and profile data
│   │   ├── validation.py
│   │   └── cli.py                 # `truesouth` command
│   └── tests/
├── api/
│   ├── pyproject.toml             # package "truesouth_api"
│   └── src/truesouth_api/
│       ├── main.py                # routes, static mounts
│       ├── jobs.py                # custom-site job queue
│       └── settings.py
├── web/
│   ├── package.json  vite.config.ts  index.html
│   ├── public/textures/           # global Moon texture
│   └── src/
│       ├── app/                   # router, shell, start screen
│       ├── contracts/generated.ts # generated, never hand-edited
│       ├── data/                  # loaders and decoders for derived data
│       ├── lib/
│       │   ├── scoring/           # metrics, vetoes, score, sweep worker
│       │   ├── geo/               # angles, scene coordinates, map projection
│       │   ├── time/
│       │   └── explain.ts         # plain-language text for every term
│       ├── state/                 # Zustand stores
│       ├── components/            # shared UI, including Luna
│       └── features/
│           ├── mission-control/
│           ├── panorama/
│           ├── polar-map/
│           ├── three/             # System view, local terrain
│           ├── academy/
│           └── validation/
├── data/
│   ├── catalog/                   # sites.json, profiles.json, features.json (hand-edited inputs)
│   ├── raw/                       # NASA downloads (gitignored)
│   ├── prepared/                  # fast-read copies (gitignored)
│   ├── derived/                   # pipeline output (committed)
│   ├── fixtures/                  # synthetic derived data (committed)
│   └── cache/                     # custom sites computed by the API (gitignored)
├── Dockerfile
└── compose.yaml
```

## The pipeline

Every step is a subcommand of `uv run truesouth`. Each is safe to run again; it skips work
whose output is already up to date.

| Command | Does | Reads | Writes |
| :--- | :--- | :--- | :--- |
| `fetch-raw` | Downloads the NASA files below. Checks each URL exists first and stops with a clear error if one does not. | network | `data/raw/` |
| `prepare-dem` | Converts each map to a flat `float32` array plus a JSON sidecar (grid origin, pixel size, projection, missing-data mask). Checks the projection matches [`science.md`](science.md) §2.3. | `data/raw/` | `data/prepared/` |
| `fetch-ephemeris` | Pulls the global ephemeris from Horizons. | network | `data/derived/system.bin` |
| `build-sites` | For each catalog site: skyline, series, slope, terrain meshes. | prepared, catalog | `data/derived/sites/` |
| `build-maps` | Renders hillshade and overlay images and the lookup grids for the polar map. | prepared, raw | `data/derived/maps/` |
| `build-scene-assets` | Makes the scene's Moon, Earth and polar-cap images, the two slope maps, and one apron grid per non-sphere site. | raw textures, prepared DEMs, `maps/`, `sites.json` | `data/derived/scene/` |
| `validate` | Runs the comparisons in [`validation.md`](validation.md). | everything | `data/derived/validation.json` |
| `build-worked-examples` | Computes the numbers shown in Under-the-hood cards. | derived | `data/derived/academy/worked_examples.json` |
| `build-fixtures` | Writes a small synthetic dataset in the same formats. Needs no downloads. | nothing | `data/fixtures/` |
| `export-schema` | Writes JSON Schema for the contracts. | `contracts.py` | `web/src/contracts/schema.json` |
| `build-all` | Runs the steps above in order. | | |

### Raw downloads

| File | Size | Used for |
| :--- | :--- | :--- |
| `LDEM_80S_80MPP_ADJ.TIF` | 189 MB | Core terrain, 80–90°S, 80 m pixels |
| `LDEM_60S_240MPP_ADJ.TIF` | 210 MB | Wide terrain, 60–90°S, 240 m pixels |
| `LDSM_80S_80MPP_ADJ.TIF` | 241 MB | NASA's slope map. Validation only. |
| `<Site>_final_adj_5mpp_surf.tif` | about 41–108 MB each | Close-up DEMs for the sites that have one |
| `<Site>_final_adj_5mpp_slp.tif` | similar | NASA's close-up slope. Validation only. |
| `AVGVISIB_85S_060M_201608.TIF`, `…_EARTH.TIF` | 34 MB, 25 MB | NASA's average sunlight and Earth visibility, 60 m |
| `AVGVISIB_75S_120M_201608.TIF`, `…_EARTH.TIF` | 83 MB, 43 MB | The same, wider area, 120 m |
| `lroc_color_poles_4k.tif` | 13 MB | Moon colour, 4,096 × 2,048. SVS 4720 |
| `lroc_color_poles_8k.tif` | 51 MB | Moon colour, 8,192 × 4,096. SVS 4720. Split into west and east halves |
| `ldem_4.tif` | 4 MB | Global LOLA heights, 1,440 × 720, kilometres. SVS 4720 |
| `world.topo.bathy.200403.3x5400x2700.jpg` | 2.5 MB | Blue Marble Next Generation, March 2004, 5,400 × 2,700 |

Base URLs:

- Polar maps: `https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/`
- Close-up DEMs: `https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/<Site>/`
- Sunlight maps: `https://pgda.gsfc.nasa.gov/data/MoonIllumination/`
- Moon textures and the global height map:
  `https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/`
  (`lroc_color_poles_4k.tif`, `lroc_color_poles_8k.tif`, `ldem_4.tif`). The page is
  `https://svs.gsfc.nasa.gov/4720`. The 2K Moon image is a resize of the 4K file, so the
  2K TIFF is not downloaded.
- Earth texture:
  `https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/march/world.topo.bathy.200403.3x5400x2700.jpg`
  NASA's `eoimages.gsfc.nasa.gov` host times out from the development machine; this asset
  host is the same Blue Marble file.

The first, third and all five `AVGVISIB` and close-up sizes were confirmed by direct
request. The wide map's exact file name follows the catalogue's naming pattern and has not
been requested yet; `fetch-raw` confirms it. The sunlight maps' `*_COG.TIF` links are
broken; use the plain `.TIF` names.

Prepared maps are read with `numpy.load(..., mmap_mode="r")`, so the API needs about 1 GB
of RAM, not the full size of the maps.

## The API

FastAPI, one process. Formats are in [`data-contracts.md`](data-contracts.md).

| Route | Purpose |
| :--- | :--- |
| `GET /api/health` | Reports which prepared maps and derived files are present. |
| `POST /api/sites/custom` | Starts (or finds) the job for a custom site. Returns its id and status. |
| `GET /api/sites/custom/{id}` | Job status: `queued`, `running`, `ready` or `failed`, with FIFO queue position while queued and null otherwise. |
| `GET /api/custom/{id}/…` | The custom site's files, in the same formats as a catalog site. |
| `POST /api/sensitivity` | Computes a sensitivity grid. |

- A custom site's id is its coordinates rounded to four decimals, written as
  `c_<lat>_<lon>`, for example `c_-89.2000_130.5000`. The same place is computed once and
  then served from `data/cache/`. Because the id holds the coordinates, a shared link can
  always be recomputed.
- Terrain jobs run one at a time in a background worker. The queue holds at most 20 waiting jobs; synchronous sphere builds run independently.
- Each client address may start 6 custom-site jobs and 12 sensitivity grids per hour.
- A custom site outside every terrain map becomes a sphere-tier site and is ready
  immediately.

### This version (catalog and custom sites)

S10b implements POST /api/sites/custom, GET /api/sites/custom/{id}, and
GET /api/custom/{id}/... as specified in [data-contracts.md](data-contracts.md#api-messages).
Sensitivity grids remain unavailable. The file route serves only meta, series, skyline
and terrain, with the catalog's path refusals, no-cache policy and conditional 304s.
Unknown or unfinished ids return a JSON 404 directing callers to POST.

`jobs.py` runs one terrain worker thread, FIFO, with at most 20 waiting jobs.
Sphere builds run independently; shared locks cover initialization and atomic publication,
never the long computation.
Each client address may start six new jobs per rolling hour. Cached, queued and running
duplicates cost nothing. Queue/rate exhaustion returns 429; rate exhaustion includes
Retry-After. A failed job exposes a plain error and can be retried; the worker survives.
There is no job database. Shutdown cancels queued work and prevents interrupted
running work from publishing; staging is cleaned before the worker joins. Restarts
forget waiting jobs. Compose allows 90 seconds for graceful shutdown. Complete atomic directories under data/cache/<id>/ survive. Internal site.json
preserves the Site entry and is not served. Names never enter paths. Coordinates are
normalised and rounded before computing.

The API and catalog command share build_sites.build_site. The committed global
ephemeris supplies all hours, without network access. Prepared arrays are read-only,
memory-mapped once per process, lazily on first custom use. The catalog rule site_tier selects
core80 for latitude <= -80 degrees, wide240 for -80 < latitude <= -60 degrees,
and sphere for latitude > -60 degrees. Square raster corners do not extend these
site-tier bounds. Sphere sites complete synchronously without opening terrain maps.
Terrain sample points along rays still use the prepared map coverage, as in the catalog.
With maps absent, terrain-tier points return 503. Points within 0.001 degrees of either
pole are rejected with 422 before admission. No close-up or apron is built.

/api/health always returns 200. `status` is ok when manifest, readable sites.json and
every listed site's meta, series and skyline exist; empty when no derived files exist;
incomplete otherwise. Optional assets do not change it. `custom_sites` is available
when both prepared arrays, sidecars and derived/system.bin exist, otherwise
not_available with the missing maps or global ephemeris reason. Sphere sites still work without maps. `sensitivity_grid` is not_available.
The report includes top-level derived-file booleans, map files, each site's files,
scene files and prepared-map file booleans. Health does not open arrays.

## Running it

### Development (no Docker)

```bash
uv sync
uv run truesouth build-fixtures                 # or build-all for real data
uv run uvicorn truesouth_api.main:app --reload --port 8000 --no-proxy-headers
pnpm --dir web install
pnpm --dir web dev
```

- Vite serves the app on `:5173`.
- Vite serves `/data/` straight from `data/derived/`, or from `data/fixtures/` when
  `VITE_DATA=fixtures`. Frontend work needs no Python.
- Vite proxies `/api/` to `:8000`. If the API is not running, custom sites and sensitivity
  grids show an "API offline" message and everything else works.

### Production (Docker)

Build and run without startup downloads:

```bash
docker compose -p truesouth-s10b up -d --build
docker compose -p truesouth-s10b down
```

Node 22 builds with pnpm 11.10.0, the frozen lockfile and unchanged release-age policy.
Python 3.12 installs the API and science runtime from uv.lock. Rasterio belongs to the
science prepare extra (and development dependencies); only prepare_map imports it.
The final image therefore needs no rasterio or GDAL. The non-root process serves port
8080 with committed derived data. There is no init service or startup network request.

Compose mounts ./data/prepared read-only and a named custom-cache volume at
/app/data/cache. TRUESOUTH_PREPARED_HOST selects an existing map directory;
TRUESOUTH_IMAGE can name an isolated test image. Without the prepared mount the
container starts, serves the catalog, and explains missing polar maps with HTTP 503.
API overrides TRUESOUTH_PREPARED, TRUESOUTH_DERIVED, TRUESOUTH_CACHE and
TRUESOUTH_WEB_DIST are supported. Otherwise prepared and cache follow
TRUESOUTH_DATA_ROOT, while committed derived data stays in the checkout.

/api/health is the health check: HTTP 200 means the process answered, and its status
field describes catalog completeness. Client routes return index.html; missing data
and unknown API URLs remain real 404s.

Development does not use this image. The commands in the previous section are unchanged.

## Frontend structure

**Routes**

| Path | Screen |
| :--- | :--- |
| `/` | Start screen: two equal doors, Mission Control and Academy |
| `/mission` | Mission Control |
| `/academy` | Lesson path |
| `/academy/:lessonId` | One lesson |
| `/validation` | "How we know it's right" |

**State.** Three Zustand stores:

- `scenario`: mission profile, selected site ids, landing date, current time, active view.
  It is mirrored to the URL so any scenario is a shareable link.
- `data`: loaded sites, series, skylines and meshes, each cached by site id.
- `academy`: XP, stars and patches. Saved to the browser's local storage.

**One clock.** `scenario.currentTime` drives every view. No view keeps its own time.

**Loading.** `web/src/data/` is the only code that fetches or decodes derived files. It
treats catalog sites and custom sites the same way; only the base URL differs.

**Shared panels.** Mission Control's panels take a scenario as props and hold no hidden
state. The Academy renders the same panels inside lessons.

## Design language

- One dark "space" theme for both modes.
- Mission Control is dense and calm: small type, tables, exact numbers.
- The Academy is roomy and playful: large rounded cards, big buttons, Luna on screen.
- Status colours are the same everywhere: GO green, CAUTION amber, NO-GO red. Colour is
  never the only signal; every status also has a label or icon.
- Desktop-first. The Academy must also work on a phone. Mission Control may ask for a
  wider screen.
- English only.

### Custom-site storage and memory bounds

`TRUESOUTH_CACHE_MAX_BYTES` sets the custom cache limit in bytes (default 2147483648,
2 GiB). Admission reserves each site's fixed binary sizes plus 32 KiB for metadata;
publication checks actual disk bytes under a shared lock. A full cache refuses work
with 507 and never evicts completed sites. A concurrent external disk change can
instead fail an already accepted job with storage_full. Health includes
`custom_cache: { size_bytes, limit_bytes }`, including staging bytes in the size. The catalog's reserved `cache/placement/`
directory is neither traversed nor counted by the custom-site API.

Only queued/running jobs and 128 recent finished states remain in memory; completed
sites are recovered from disk. Address histories expire after the rolling hour. At
most 4096 active address histories are kept; a new address at capacity receives 503
and Retry-After, rather than evicting an active rate limit. Rejected jobs allocate no
address history or storage reservation.

### Client addresses and reverse proxies

The client address is the socket peer address exposed in the ASGI scope, never an
X-Forwarded-For value read by the application. Production starts uvicorn with
`--no-proxy-headers`; use that flag in development and other deployments too. The
application provides no trusted-proxy configuration. All people behind one reverse
proxy therefore share that proxy's six-per-hour limit. Changing X-Forwarded-For or
Forwarded headers cannot reset it. Do not enable uvicorn proxy-header processing for
this service without separately implementing and reviewing trusted-proxy support.
