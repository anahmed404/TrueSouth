# Lunar Landing Site Navigator — Team Responsibilities & Implementation Blueprint

> **Source of Truth:** This document translates the finalized architectural and scientific decisions in [`lunar_navigator_tech_decisions.md`](./lunar_navigator_tech_decisions.md) into concrete, actionable implementation walkthroughs for a 4-person engineering team (2 Backend, 2 Frontend). Do not introduce alternative libraries, coordinate conventions, or scoring rules that contradict `lunar_navigator_tech_decisions.md`. Where a specific implementation detail is not specified in `lunar_navigator_tech_decisions.md`, it is explicitly flagged as **Unresolved** rather than silently assumed.

---

## A. Project Architecture Overview

### System Boundary & Component Map
Per `lunar_navigator_tech_decisions.md` (Section 10.1), the **Python FastAPI backend is the sole scientific source of truth**. The **React + React Three Fiber (R3F) frontend** is strictly a visualization and decision-support interface; WebGL/GPU shadows must never be used to compute scientific illumination or visibility metrics.

| Role | Member | Core Modules / Responsibilities | Primary Interface |
| :--- | :--- | :--- | :--- |
| **Backend 1** | **Astronomy & Ephemeris** | JPL Horizons client (`COMMAND='10'` Sun & `COMMAND='399'` Earth), deterministic file + LRU caching, offline cache pre-population, topocentric-to-DEM-grid azimuth normalization, FastAPI app shell & shared Pydantic schemas (proposed workload balance—see Section D). | Internal Python `EphemerisService` consumed by Member 2; `GET /api/health`, `GET /api/sites`, `POST /api/analyze` |
| **Backend 2** | **Terrain & Mission Analysis** | LOLA COG/windowed DEM ingestion (`rasterio` + `pyproj`), CRS verification, 2D central-difference slope + 100 m footprint aggregation, 2-tier 720-bin curvature-corrected horizon raycasting, Sun/Earth visibility timeline, 2-stage MCDA scoring engine, decimated terrain mesh generator. | `AnalysisPipeline` & `TerrainService` powering `POST /api/analyze` and `GET /api/sites/{site_id}/terrain-mesh` |
| **Frontend 3** | **3D Visualization** | R3F `<Canvas>` scene, Global Moon sphere (NASA SVS Entry 4720 CGI Moon Kit), Local Site `<planeGeometry>` displaced by LOLA DEM, slope color-mapping, Sun/Earth 3D vector conversion, `<directionalLight castShadow />`, explainable blocked-ray/obstacle marker, LOD switching & camera bounds. | React `<LunarViewport />` component consuming site selection, `timeline[t]`, `horizon_profile`, and `terrain-mesh` payload |
| **Frontend 4** | **Dashboard & Application Logic** | React + Vite + Tailwind CSS shell, UTC date/duration/step controls (`dayjs` UTC), site picker, MCDA config/weights/thresholds panel, API client (`sites`, `analyze`, `terrain-mesh`, `health`), Recharts elevation/horizon timelines, GO/CAUTION/NO-GO & hard-veto badges, multi-site comparison, explainable blocked-time readout. | Root App state, API hooks, and dashboard panels feeding props/callbacks to Member 3 |

### End-to-End Data Flow
```text
[JPL Horizons REST API]                 [LOLA GeoTIFFs: Tier 1 80m + Tier 2 20m/5m]
         │                                               │
         ▼ (Member 1)                                    ▼ (Member 2)
  Ephemeris Cache                               CRS Verify + Windowed Read
  (Sun & Earth az/el in UTC)                    (X0, Y0, z0, validity mask)
         │                                               │
         │                                      ┌────────┴────────┐
         │                                      ▼                 ▼
         │                             Slope Grid + 100m    720-bin Horizon
         │                             p90/mean/center      Mask (Curvature)
         │                                      │                 │
         └──────────────┬───────────────────────┴────────┬────────┘
                        ▼ (Member 2)                     ▼ (Member 2)
               Timeline Visibility &             Decimated Mesh + Slopes
               2-Stage MCDA Scoring              (/terrain-mesh)
                        │                                │
                        ▼ (POST /api/analyze)            ▼ (GET /terrain-mesh)
         ┌──────────────┴──────────────┐                 │
         ▼ (Member 4)                  ▼ (Member 3) ◄────┘
  Dashboard State, Charts,      R3F 3D Scene: Global Moon,
  MCDA & Explainability UI      Local DEM Mesh, Sun Light & Ray
```

### Technologies & Protocols
* **Backend:** Python, FastAPI, Pydantic, `astroquery` or REST (`httpx`/`requests`) for JPL Horizons, `rasterio`, `pyproj`, `numpy`.
* **Frontend:** React (Vite), `@react-three/fiber`, `@react-three/drei`, Three.js, Recharts, Tailwind CSS, `lucide-react`, `dayjs` (with UTC plugin).
* **API Transport:** JSON over HTTP under `/api` (`GET /api/sites`, `POST /api/analyze`, `GET /api/sites/{site_id}/terrain-mesh`, `GET /api/health`).

---

## B. Individual Implementation Guides

---

### Member 1 – Astronomy & Ephemeris (Backend)

#### 1. Scope and Ownership
* **Responsible For:**
  * Querying JPL Horizons (`https://ssd.jpl.nasa.gov/api/horizons.api`) for **both Sun (`COMMAND='10'`) and Earth (`COMMAND='399'`)** topocentric observer ephemerides (`CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'`). *(Note: Although the initial team split mentions solar position calculations, `lunar_navigator_tech_decisions.md` Sections 5, 8, and 10.3 require the exact same Horizons pipeline for Earth DTE visibility; Member 1 owns both targets.)*
  * Validating Horizons response headers, longitude sign convention (East-positive), altitude units (`km` above `1737.4 km` sphere), and UTC timestamps.
  * Implementing the two-level ephemeris cache: deterministic JSON files in `backend/data/cache/horizons/` and in-memory `functools.lru_cache`.
  * Creating an offline cache pre-population CLI/script for the 4 seed candidate sites (`connecting_ridge_cr1`, `peak_near_shackleton_007`, `malapert_massif`, `mons_mouton`).
  * Normalizing Horizons topocentric azimuth ($\phi$) into **DEM Grid Azimuth** ($\phi_{\text{grid}}$) using site East longitude ($\lambda$) and verified DEM central meridian ($\lambda_0$).
  * Providing uniform UTC timestamp generation and time-step validation (`step_hours` default `1.0`, supporting `0.5` and `0.25`).
  * **Workload-Balance Assignment (see Section D):** Owning the FastAPI application entrypoint (`backend/app/main.py`), shared Pydantic API schemas (`backend/app/schemas.py`), `GET /api/health`, and `GET /api/sites` (reading `elevation_m` dynamically via Member 2's DEM helper).
* **Explicitly Outside Scope:**
  * Reading GeoTIFF files, computing `pyproj` coordinate transforms, raycasting terrain horizons, calculating slope, or computing MCDA scores (Member 2).
  * Converting `(phi_grid, el)` into Three.js `(X, Y, Z)` coordinates (Member 3).
  * Any UI or chart rendering (Member 4).

#### 2. Implementation Walkthrough

##### Stage 1.1: Uniform UTC Time Grid & Input Validation
1. **Input:** `start_utc` (ISO-8601 UTC string, e.g. `"2026-11-12T00:00:00Z"`), `duration_days` (float, default `6.0`), `step_hours` (float, default `1.0`, allowed uniform presets e.g. `1.0`, `0.5`, `0.25`).
2. **Processing:**
   * Parse `start_utc` strictly as timezone-aware UTC (`datetime.timezone.utc`). Reject naive or non-UTC offsets unless normalized to UTC.
   * Compute `stop_utc = start_utc + timedelta(days=duration_days)`.
   * Map `step_hours` to Horizons `STEP_SIZE`: `1.0 -> "1h"`, `0.5 -> "30m"`, `0.25 -> "15m"` (or integer minutes `f"{int(round(step_hours * 60))}m"`).
   * Format `START_TIME` and `STOP_TIME` for Horizons as `'YYYY-MM-DD HH:MM'`.
3. **Output:** Validated `(start_dt, stop_dt, horizons_step_str, expected_timestamps_utc)` passed to Stage 1.2.

##### Stage 1.2: JPL Horizons Query Client & Parser
1. **Input:** `site` (`site_id`, `lat_deg`, `lon_deg`, `elevation_m`, `observer_height_m`), `target` (`"sun"` -> `'10'` or `"earth"` -> `'399'`), `start_dt`, `stop_dt`, `horizons_step_str`.
2. **Processing:**
   * Compute observer altitude in km relative to the `1737.4 km` reference sphere (`lunar_navigator_tech_decisions.md` Section 10.3):
     $$\text{altitude\_km} = \frac{z_0 + h_{\text{obs}}}{1000.0}$$
     where $z_0 = \text{elevation\_m}$ (from Tier 2 DEM) and $h_{\text{obs}} = \text{observer\_height\_m}$ (default `2.0`).
   * Build `SITE_COORD = f"{lon_deg:.6f},{lat_deg:.6f},{altitude_km:.6f}"` (East-positive longitude first, then latitude, then altitude in km).
   * Send `GET` request to `https://ssd.jpl.nasa.gov/api/horizons.api` with:
     * `format='json'`, `MAKE_EPHEM='YES'`, `EPHEM_TYPE='OBSERVER'`, `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD=...`, `COMMAND='10'` (or `'399'`), `START_TIME=...`, `STOP_TIME=...`, `STEP_SIZE=...`, `QUANTITIES='4'`, `CSV_FORMAT='YES'`, `ANG_FORMAT='DEG'`.
   * Parse the JSON response `result` text block:
     * Locate `$$SOE` (Start of Ephemeris) and `$$EOE` (End of Ephemeris) markers.
     * Verify the table header line immediately preceding `$$SOE` confirms UTC date/time and `Azi_(a-app)` / `Elev_(a-app)` (airless apparent azimuth and elevation in degrees).
     * Parse each CSV row between `$$SOE` and `$$EOE`, extracting `timestamp_utc` (normalized to `YYYY-MM-DDTHH:MM:SSZ`), `az_true_north_deg` ($\phi \in [0, 360)$), and `el_deg` ($\theta \in [-90, 90]$).
   * Handle network timeouts, HTTP errors, and Horizons error strings (`Cannot find central body`, `No ephemeris for target`, etc.) with explicit exceptions and fallback to cached data when available.
3. **Output:** List of `EphemerisPoint(timestamp_utc, az_true_north_deg, el_deg)`.

##### Stage 1.3: Deterministic Disk + Memory Caching & Offline Pre-Population
1. **Input:** Query key `(site_id, target, start_utc_iso, stop_utc_iso, step_hours, altitude_km_rounded)`.
2. **Processing:**
   * Construct deterministic filename in `backend/data/cache/horizons/`, e.g.:
     `{site_id}_{target}_{start_compact}_{stop_compact}_{step_str}_{alt_km:.4f}.json`
   * On lookup:
     1. Check in-memory `@lru_cache` (or bounded dict cache).
     2. On miss, check disk JSON file in `backend/data/cache/horizons/`. Validate schema and row count.
     3. On miss, call Stage 1.2 (Horizons API), write JSON atomically (write temp file then rename) to disk, populate memory cache.
   * Implement `backend/scripts/prepopulate_horizons.py` to pre-fetch and save Sun + Earth ephemerides for all 4 seed sites over the team's agreed reference mission window so demos run 100% offline.
3. **Output:** Cached `EphemerisSeries` object returned with sub-millisecond latency on cache hit.

##### Stage 1.4: DEM Grid Azimuth Normalization
1. **Input:** `az_true_north_deg` ($\phi$), site East longitude (`lon_deg`, $\lambda$), and DEM `central_meridian_deg` ($\lambda_0$, expected `0.0` from Member 2's CRS metadata).
2. **Processing:**
   * Apply the normalization equation (`lunar_navigator_tech_decisions.md` Sections 3, 6, 8, 10.2):
     $$\phi_{\text{grid}} = (\phi + (\lambda - \lambda_0)) \pmod{360^\circ}$$
     *(Under the expected $\lambda_0 = 0.0^\circ$ configuration, this simplifies to $\phi_{\text{grid}} = (\phi + \lambda) \pmod{360^\circ}$.)*
   * Ensure result is in `[0.0, 360.0)` and handle floating-point wrap-around (e.g. `360.0` -> `0.0`).
3. **Output:** `sun_grid_az_deg` and `earth_grid_az_deg` alongside `sun_el_deg` and `earth_el_deg` for every timestamp, consumed by Member 2's horizon visibility evaluator and forwarded in `POST /api/analyze` to Member 3 and Member 4.

##### Stage 1.5: FastAPI Application Shell, Shared Schemas & Health/Sites Endpoints
1. **Input:** Candidate site catalog, Member 2's DEM elevation lookup (`get_site_surface_elevation`), and Member 2's `AnalysisPipeline`.
2. **Processing:**
   * Define all Pydantic v2 request/response models in `backend/app/schemas.py` matching `lunar_navigator_tech_decisions.md` Section 10.13.
   * Wire `GET /api/health` (check DEM files on disk + `backend/data/cache/horizons/` directory status).
   * Wire `GET /api/sites` (load the 4 seed sites, populate `elevation_m` dynamically from Member 2's Tier 2 DEM reader at startup/load time).
   * Wire `POST /api/analyze` (validate `AnalyzeRequest`, invoke Member 2's pipeline which calls Member 1's `EphemerisService`, return `AnalyzeResponse`).

#### 3. Mathematical and Technical Specifications
* **Reference Sphere:** $R_{\text{Moon}} = 1737.4\text{ km}$ (`lunar_navigator_tech_decisions.md` Section 10.3).
* **Horizons Parameters:** `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `QUANTITIES='4'`, `ANG_FORMAT='DEG'`, `CSV_FORMAT='YES'`, `format='json'`.
* **Grid Azimuth Equation:** $\phi_{\text{grid}} = (\phi + (\lambda - \lambda_0)) \pmod{360^\circ}$ (Sections 3, 6, 8).
* **Time System:** Strictly UTC (`YYYY-MM-DDTHH:MM:SSZ`).
* **Edge Cases:**
  * **Lon Wrap-around:** Seed site `malapert_massif` has `lon_deg = 357.07`. Ensure `mod 360.0` handles values $\ge 360^\circ$ cleanly.
  * **Horizons Rate Limiting / Downtime:** If Horizons is unreachable and a cache file exists (even for a slightly superset window or exact match), fail gracefully with a clear error message if uncached, and never silently return empty arrays.
  * **Step-Size Alignment:** Verify `len(timeline) == int(round((duration_days * 24) / step_hours)) + 1` (or confirm whether Horizons `STOP_TIME` is inclusive—Horizons includes both `START_TIME` and `STOP_TIME` when divisible by `STEP_SIZE`).
* **Unresolved Specifications (Flagged):**
  1. **Reference Mission Window for Offline Cache:** `lunar_navigator_tech_decisions.md` Section 10.4 states to pre-populate Horizons JSON caches for all 4 seed sites over a "reference mission window," but does not specify the exact `start_utc` and `duration_days` (e.g., `2026-11-15T00:00:00Z` for `6.0` days or `30` days). **Team must lock this before running `prepopulate_horizons.py`.**
  2. **Horizons Client Library:** Section 5 allows `astroquery` or REST. Direct REST via `httpx`/`requests` avoids `astroquery` dependency weight and maps 1:1 to Section 10.3's `format='json'` parameters; confirm choice with Member 2.

#### 4. Interfaces and Integration
* **Exposed Internal Python Interface (to Member 2):**
  ```python
  class EphemerisPoint(BaseModel):
      timestamp_utc: str          # "YYYY-MM-DDTHH:MM:SSZ"
      az_true_north_deg: float    # [0, 360)
      grid_az_deg: float          # [0, 360)
      el_deg: float               # [-90, 90]

  class EphemerisService:
      def get_ephemeris(
          self,
          site_id: str,
          lat_deg: float,
          lon_deg: float,
          altitude_km: float,
          target: Literal["sun", "earth"],
          start_utc: str,
          duration_days: float,
          step_hours: float,
          central_meridian_deg: float = 0.0,
      ) -> list[EphemerisPoint]: ...
  ```
* **Exposed HTTP Endpoints:** `GET /api/health`, `GET /api/sites`, `POST /api/analyze` (delegating core computation to Member 2).
* **Consumed from Member 2:** `z_0` (`elevation_m`) for `altitude_km` calculation and `central_meridian_deg` ($\lambda_0$) from GeoTIFF CRS metadata.

#### 5. Expected Deliverables
1. `backend/app/services/ephemeris.py` — Horizons REST/astroquery client, parser, and grid azimuth normalizer.
2. `backend/app/services/cache.py` — Deterministic disk JSON + in-memory `lru_cache` manager.
3. `backend/scripts/prepopulate_horizons.py` — Offline cache builder for all 4 seed sites (Sun + Earth).
4. `backend/app/schemas.py` & `backend/app/main.py` — FastAPI app, Pydantic contracts, `/api/health`, `/api/sites`, `/api/analyze` wiring.
5. **Acceptance Criteria:**
   * Automated test verifies `SITE_COORD` East-positive longitude, `altitude_km` in km, UTC header parsing, and `phi_grid` normalization.
   * Cache hit returns in `< 5 ms` without network access.
   * `GET /api/health` and `GET /api/sites` return valid HTTP 200 JSON matching Section 10.13.

---

### Member 2 – Terrain & Mission Analysis (Backend)

#### 1. Scope and Ownership
* **Responsible For:**
  * LOLA DEM ingestion and preparation: Tier 1 (`LDEM_80S_80MPP_ADJ.TIF`), Tier 2 (`LDEM_80S_20MPP_ADJ.TIF`, plus optional 5 m overrides where covered), and pre-cropped derived terrain packs in `backend/data/derived/`.
  * Dynamic CRS verification (`dataset.crs`, `MOON_ME` reference frame, `Central_Meridian`, `Standard_Parallel_1`) and `pyproj` / `rasterio.warp` coordinate transforms $(\lambda, \varphi) \to (X_0, Y_0)$ and $(X, Y) \to (\text{row}, \text{col})$.
  * Windowed GeoTIFF reading (`rasterio.windows.from_bounds`), NoData/NaN/uncertainty/validity mask preservation, and `terrain_quality` metadata reporting.
  * 2D terrain slope calculation (central difference in projected metres) and 100 m footprint aggregation (`slope_p90_100m_deg`, `slope_center_deg`, `slope_mean_100m_deg`).
  * Two-tier curvature-corrected horizon raycasting (720 bins at `0.5°` spacing, $r \in [40\text{ m}, 100\text{ km}]$) with linear bin interpolation.
  * Terrain-aware Sun visibility (`use_upper_limb` false/true) and Earth DTE visibility + antenna mask proxy (`antenna_mask_deg`), computing `timeline` and aggregate `metrics`.
  * Two-stage MCDA scoring engine (Stage 1 hard knockouts + Stage 2 utility functions + weight validation + GO/CAUTION/NO-GO status).
  * Local terrain mesh decimation and `GET /api/sites/{site_id}/terrain-mesh` endpoint logic.
* **Explicitly Outside Scope:**
  * Querying JPL Horizons or managing Horizons JSON caches (Member 1).
  * Rendering 3D meshes, Three.js lighting, or Recharts UI (Members 3 & 4).

#### 2. Implementation Walkthrough

##### Stage 2.1: DEM Asset Preparation, CRS Verification & Windowed Reading
1. **Input:** Site `(lat_deg, lon_deg)`, Tier 1 & Tier 2 GeoTIFF paths (or pre-cropped `backend/data/derived/` tiles).
2. **Processing:**
   * Open GeoTIFF with `rasterio.open()`. Inspect and validate `dataset.crs` (verify South Polar Stereographic `MOON_ME`, extract `Central_Meridian` $\lambda_0$ and `Standard_Parallel_1` rather than hardcoding).
   * Transform `(lon_deg, lat_deg)` to projected `(X_0, Y_0)` in metres using `pyproj.Transformer` from geographic lunar lon/lat to `dataset.crs`.
   * Map `(X_0, Y_0)` to pixel `(row, col)` using `dataset.index(X_0, Y_0)`.
   * Read local window (`window_km`, e.g. `10.0 km × 10.0 km` centered on `(X_0, Y_0)`) using `rasterio.windows.from_bounds(X_0 - half, Y_0 - half, X_0 + half, Y_0 + half, dataset.transform)`.
   * Read `dataset.nodata`, apply scale/offset if present (`dataset.scales`, `dataset.offsets`), and build a boolean `valid_mask` (`~np.isnan(z) & (z != nodata)`). Never hardcode `-32768` or `-15000`.
   * Sample `z_0` at `(X_0, Y_0)` (bilinear or nearest valid pixel; raise/flag if center is NoData).
   * Write a pre-crop script `backend/scripts/prepare_dem_tiles.py` to extract bounded tiles around the 4 seed sites into `backend/data/derived/` for fast demo startup.
3. **Output:** `(X_0, Y_0, z_0, central_meridian_deg, local_dem_array, local_valid_mask, local_transform, terrain_quality)`.

##### Stage 2.2: 2D Terrain Slope & 100 m Footprint Aggregation
1. **Input:** Tier 2 local DEM elevation array `z[row, col]` (`float64`), `valid_mask`, pixel spacing `d` (e.g. `20.0 m` for `LDEM_80S_20MPP_ADJ.TIF`, `5.0 m` if 5 m override), site `(X_0, Y_0)`.
2. **Processing:**
   * Compute central-difference gradients on interior pixels (where `[row±1, col±1]` are all valid):
     $$\frac{\partial z}{\partial x} = \frac{z[\text{row}, \text{col}+1] - z[\text{row}, \text{col}-1]}{2d}, \qquad \frac{\partial z}{\partial y} = \frac{z[\text{row}-1, \text{col}] - z[\text{row}+1, \text{col}]}{2d}$$
   * Compute per-pixel slope in degrees:
     $$\theta_{\text{slope}}[\text{row}, \text{col}] = \arctan\left(\sqrt{\left(\frac{\partial z}{\partial x}\right)^2 + \left(\frac{\partial z}{\partial y}\right)^2}\right) \times \frac{180}{\pi}$$
   * Identify all valid slope pixels within Euclidean distance $\sqrt{(X - X_0)^2 + (Y - Y_0)^2} \le 100.0\text{ m}$.
   * Compute `slope_p90_100m_deg = np.percentile(footprint_slopes, 90)` as primary `slope_deg`, plus `slope_center_deg` and `slope_mean_100m_deg`.
3. **Output:** `slope_deg` (`slope_p90_100m_deg`), supplementary slope metrics, and full 2D `slope_grid` (reused in Stage 2.6 for mesh vertex colors).

##### Stage 2.3: Two-Tier Curvature-Corrected Horizon Mask (720 Bins)
1. **Input:** Site `(X_0, Y_0, z_0)`, `observer_height_m` ($h_{\text{obs}}$, default `2.0`), Tier 2 DEM (near-field) and Tier 1 DEM (far-field).
2. **Processing:**
   * Generate 720 azimuth bins: $\phi_{\text{grid}} \in \{0.0^\circ, 0.5^\circ, \dots, 359.5^\circ\}$.
   * For each bin $\phi_{\text{grid}}$ (vectorized across all 720 bins with NumPy):
     * **Near-field:** $r \in [40\text{ m}, 5{,}000\text{ m}]$ with $\Delta r = 20\text{ m}$ (249 steps), sampled from Tier 2 DEM.
     * **Far-field:** $r \in [5{,}080\text{ m}, 100{,}000\text{ m}]$ with $\Delta r = 80\text{ m}$ (1,187 steps), sampled from Tier 1 DEM.
     * Sample coordinates:
       $$X(r, \phi_{\text{grid}}) = X_0 + r \cdot \sin(\phi_{\text{grid}}), \qquad Y(r, \phi_{\text{grid}}) = Y_0 + r \cdot \cos(\phi_{\text{grid}})$$
     * Convert $(X, Y)$ to raster `(row, col)` (bilinear interpolation or nearest-pixel; skip any `NoData`/`NaN`/out-of-bounds samples and increment `invalid_sample_count` in `terrain_quality`).
     * Apply lunar curvature correction ($R_{\text{Moon}} = 1{,}737{,}400\text{ m}$):
       $$z_{\text{eff}}(r, \phi_{\text{grid}}) = z(r, \phi_{\text{grid}}) - \frac{r^2}{2 \cdot R_{\text{Moon}}}$$
       $$\theta_{\text{obstacle}}(r, \phi_{\text{grid}}) = \arctan\left(\frac{z_{\text{eff}}(r, \phi_{\text{grid}}) - (z_0 + h_{\text{obs}})}{r}\right) \times \frac{180}{\pi}$$
     * Find `idx_max = argmax(theta_obstacle)` along the ray. Record:
       * `elevation_deg = theta_obstacle[idx_max]`
       * `distance_km = r[idx_max] / 1000.0` (horizontal ground distance)
       * `obstacle_height_m = z[idx_max]` (raw DEM surface elevation above lunar reference sphere)
3. **Output:** `horizon_profile` (list of 720 `HorizonBin` objects) and `invalid_sample_count` for `terrain_quality`.

##### Stage 2.4: Timeline Visibility Evaluation (Sun & Earth DTE)
1. **Input:** `horizon_profile` (720 bins), Sun `EphemerisPoint` list and Earth `EphemerisPoint` list from Member 1, `step_hours`, `use_upper_limb`, `antenna_mask_deg`.
2. **Processing:**
   * Define circular linear interpolation helper `interp_horizon(az_grid_deg)`:
     * `bin_idx = (az_grid_deg % 360.0) / 0.5`
     * `i0 = int(floor(bin_idx)) % 720`, `i1 = (i0 + 1) % 720`, `frac = bin_idx - floor(bin_idx)`
     * `return (1 - frac) * h[i0] + frac * h[i1]`
   * For each timestamp `t`:
     * **Sun:**
       * `sun_horizon_el_deg = interp_horizon(sun_grid_az_deg)`
       * `effective_sun_el = sun_el_deg + (0.265 if use_upper_limb else 0.0)`
       * `sun_margin_deg = effective_sun_el - sun_horizon_el_deg`
       * `is_sunlit = sun_margin_deg > 0.0`
     * **Earth DTE (Phase 1):**
       * `earth_horizon_el_deg = interp_horizon(earth_grid_az_deg)`
       * `effective_mask = max(earth_horizon_el_deg, antenna_mask_deg)`
       * `earth_margin_deg = earth_el_deg - effective_mask` (and `m_earth_clamped = max(0.0, earth_margin_deg)` for MCDA)
       * `is_dte_available = earth_el_deg >= effective_mask`
       * Set `blockage_reason` when `!is_dte_available` (e.g. `"below_horizon"` if `earth_el_deg < 0`, `"terrain_blocked"` if `earth_el_deg < earth_horizon_el_deg`, `"antenna_mask_blocked"` otherwise).
   * Compute aggregate metrics over the uniform time series:
     * `illumination_fraction = sum(is_sunlit) / N`
     * `max_continuous_dark_hours = max_consecutive_false(is_sunlit) * step_hours`
     * `dte_fraction = sum(is_dte_available) / N`
     * `max_continuous_blackout_hours = max_consecutive_false(is_dte_available) * step_hours`
     * `mean_earth_margin_deg = mean(max(0.0, earth_el_deg - max(earth_horizon_el_deg, antenna_mask_deg)))`
3. **Output:** `timeline` and `metrics` objects for `POST /api/analyze`.

##### Stage 2.5: Two-Stage MCDA Scoring Engine
1. **Input:** `metrics` (`slope_deg`, `illumination_fraction`, `max_continuous_dark_hours`, `dte_fraction`, `max_continuous_blackout_hours`, `mean_earth_margin_deg`) and `config` (`AnalyzeConfig`).
2. **Processing:**
   * Validate weights: `w_slope, w_solar, w_dte >= 0` and `abs((w_slope + w_solar + w_dte) - 1.0) <= 1e-6` (raise HTTP 422 if violated).
   * **Stage 1 (Hard Veto Flags):**
     * `slope_exceeded = slope_deg > config.slope_limit_deg`
     * `darkness_exceeded = max_continuous_dark_hours > config.max_dark_hours`
     * `dte_fraction_too_low = dte_fraction < config.min_dte_fraction`
     * `blackout_exceeded = max_continuous_blackout_hours > config.max_blackout_hours`
     * `any_veto = slope_exceeded or darkness_exceeded or dte_fraction_too_low or blackout_exceeded`
   * **Stage 2 (Normalized Utilities $\in [0.0, 1.0]$):**
     * `s_slope`: piecewise linear using `slope_ideal_deg` (5.0), `slope_safe_deg` (10.0), `slope_limit_deg` (15.0) per `lunar_navigator_tech_decisions.md` Section 9.
     * `s_solar = illumination_fraction * max(0.0, 1.0 - max_continuous_dark_hours / config.max_dark_hours)`
     * `s_dte = dte_fraction * min(1.0, mean_earth_margin_deg / config.margin_reference_deg)`
   * **Composite & Status:**
     * If `any_veto`: `composite_score = 0.0`, `status = "NO-GO"`.
     * Else: `composite_score = 100.0 * (w_slope * s_slope + w_solar * s_solar + w_dte * s_dte)` and `status = "GO"` if `>= 80.0`, `"CAUTION"` if `>= 50.0`, else `"NO-GO"`.
3. **Output:** `mcda` object for `POST /api/analyze`.

##### Stage 2.6: Local Terrain Mesh Decimation (`GET /api/sites/{site_id}/terrain-mesh`)
1. **Input:** `site_id`, `window_km` (default `10.0`), `grid_size` (default `250`).
2. **Processing:**
   * Read Tier 2 DEM window of `window_km × window_km` centered on `(X_0, Y_0)`.
   * Compute full-resolution `slope_grid` first (Stage 2.2) so slope values are not artificially smoothed before decimation, OR downsample elevation and compute/resample slopes consistently (document which in `terrain_quality`).
   * Resample elevation and slope arrays to `(grid_size, grid_size)` (row-major, top-to-bottom `+Y` to `-Y`, left-to-right `-X` to `+X`).
   * Subtract `center_elevation_m` (`z_0`) from every elevation sample so `elevations_m` are relative to `center_elevation_m`.
   * Flatten `elevations_m` and `slopes_deg` into 1D lists of length `grid_size * grid_size`.
3. **Output:** `TerrainMeshResponse` JSON consumed by Member 3.

#### 3. Mathematical and Technical Specifications
* **Slope Equations:** Section 7 (`central difference` + `arctan` + `p90` in `R_footprint = 100 m`).
* **Raycasting Equations:** Section 8 (`R_Moon = 1737.4 km`, near-field `40..5000 m @ 20 m`, far-field `5080..100000 m @ 80 m`, `720` bins at `0.5°`).
* **MCDA Equations:** Section 9 (Stage 1 vetoes, Stage 2 utilities, `100 * weighted_sum`, `GO/CAUTION/NO-GO` bands).
* **Edge Cases:**
  * `r = 0` avoided by starting near-field at `r_min = 40 m`.
  * `NoData` pixels inside the 100 m slope footprint or along a ray must be masked out and counted, never treated as `0 m` elevation.
  * Sites outside `87°S` (`malapert_massif` at `-85.99°`, `mons_mouton` at `-84.60°`) must fall back to `LDEM_80S_20MPP_ADJ.TIF` without error.
* **Unresolved Specifications (Flagged):**
  1. **Exact `terrain_quality` Sub-fields:** Section 10.13 lists "DEM product identifier, effective resolution, and data-validity summary" without exact JSON key names. Member 2 and Member 4 must agree on exact keys (e.g., `dem_product`, `effective_resolution_m`, `valid_pixel_fraction`, `invalid_ray_samples`).
  2. **Supplementary Slope Fields in `metrics`:** Section 7 specifies reporting `slope_center_deg` and `slope_mean_100m_deg` alongside `slope_p90_100m_deg` (`slope_deg`), while Section 10.13 lists only `slope_deg`. Confirm adding the two supplementary fields to `metrics`.
  3. **`mean_earth_margin_deg` Denominator:** Clarify whether $\overline{m_{\text{Earth}}}$ in Section 9 is averaged over **all** mission timesteps (recommended, consistent with $m_{\text{Earth}}(t) = \max(0, \dots)$) or only DTE-available timesteps.
  4. **`timeline.earth_margin_deg` Sign & `blockage_reason` Strings:** Clarify whether `timeline.earth_margin_deg` is signed (`earth_el_deg - effective_mask`, matching `sun_margin_deg`) while MCDA clamps `max(0, ...)`, and lock the exact `blockage_reason` enum strings.

#### 4. Interfaces and Integration
* **Exposed Internal Python Interface (to Member 1's FastAPI routes):**
  * `get_site_context(site_id) -> SiteContext` (`X_0, Y_0, elevation_m, central_meridian_deg, default_dem`)
  * `analyze_site(site_id, ephemeris_sun, ephemeris_earth, config) -> SiteAnalysisResult`
  * `get_terrain_mesh(site_id, window_km, grid_size) -> TerrainMeshResponse`
* **Exposed HTTP Endpoint:** `GET /api/sites/{site_id}/terrain-mesh` (plus core computation for `POST /api/analyze`).

#### 5. Expected Deliverables
1. `backend/app/services/dem.py` — CRS verification, `pyproj` transforms, windowed COG reading, validity masking, `z_0` lookup.
2. `backend/app/services/slope.py` — Central-difference slope grid & 100 m footprint aggregation.
3. `backend/app/services/horizon.py` — Two-tier 720-bin curvature-corrected raycaster & linear interpolator.
4. `backend/app/services/visibility.py` — Sun/Earth timeline evaluation & aggregate metrics.
5. `backend/app/services/mcda.py` — Two-stage MCDA veto + utility + composite scorer.
6. `backend/app/services/mesh.py` — Decimated terrain mesh & slope array generator.
7. `backend/scripts/prepare_dem_tiles.py` — Pre-crop derived GeoTIFF packs for the 4 seed sites.
8. **Acceptance Criteria:**
   * Convergence test comparing `0.5°` / `20 m` / `80 m` / `100 km` against a finer reference (`0.25°` / `10 m` / `40 m` / `120 km`) passes within agreed angular tolerance.
   * Known-geometry unit tests (flat plane, synthetic crater rim at known `r` and `h`) match analytical curvature-corrected horizon angles to `< 0.001°`.
   * `POST /api/analyze` for 1 site over 6 days (`1h` step) completes within benchmarked latency target.

---

### Member 3 – 3D Visualization (Frontend)

#### 1. Scope and Ownership
* **Responsible For:**
  * Building the React Three Fiber (`@react-three/fiber` + `@react-three/drei`) 3D viewport component.
  * **Global Moon View:** Moderate-detail sphere textured with NASA SVS Entry 4720 CGI Moon Kit (color + displacement map), starfield, and interactive 3D site markers (`instancedMesh` or clickable markers) at the 4 seed site `(lat_deg, lon_deg)`.
  * **Local Site View:** Bounded local terrain mesh (`<planeGeometry>`) displaced by `elevations_m` from `GET /api/sites/{site_id}/terrain-mesh`, vertex-colored or shaded by `slopes_deg` (GO `< 10°`, CAUTION `10°–15°`, NO-GO `> 15°` overlay toggle).
  * **Solar Lighting & GPU Shadow Visualization:** Converting backend-provided `(sun_grid_az_deg, sun_el_deg)` at the active timeline index into Three.js `(X, Y, Z)` for `<directionalLight castShadow />` + shadow camera configuration.
  * **Explainable 3D Overlays (Section 10.16):** Rendering the active Sun/Earth direction ray, the terrain-horizon ray toward the blocking azimuth, and a highlight marker on the highest blocking terrain point (`distance_km`, `obstacle_height_m`, `az_grid_deg`) when a timestamp is blocked.
  * Performance practices (Section 10.15): LOD switching (Global Sphere vs. Local Mesh), frustum culling, `OrbitControls` with exploration bounds so cameras cannot pan off the `10 km × 10 km` mesh, and GPU resource disposal on unmount.
* **Explicitly Outside Scope:**
  * Computing scientific illumination, shadow fractions, or horizon angles in JS/WebGL (Member 2).
  * Fetching `POST /api/analyze` or managing global application state, forms, sliders, or Recharts graphs (Member 4).

#### 2. Implementation Walkthrough

##### Stage 3.1: R3F Canvas, Camera Controls & LOD State Switching
1. **Input:** `viewMode` (`"global"` | `"local"`), `selectedSite`, `window_km` (from Member 4).
2. **Processing:**
   * Set up `<Canvas shadows camera={{ fov: 45, near: 0.1, far: 10000 }}>` with `<OrbitControls />` from `@react-three/drei`.
   * Define a consistent scene scale for Local View (e.g., `1 Three.js unit = 100 m` or `1 km`—must be agreed with shadow-camera bounds; `1 unit = 1 km` keeps a `10 km × 10 km` mesh at `10 × 10` units, ideal for floating-point precision).
   * In `"local"` mode, clamp `OrbitControls` `maxDistance`, `minDistance`, `maxPolarAngle` (just above horizon), and pan target bounds to `[-window_km/2, +window_km/2]` so the user cannot fly off the bounded DEM slice (`lunar_navigator_tech_decisions.md` Section 3).
   * Cleanly dispose geometries/materials/textures on site switch or unmount.
3. **Output:** Responsive 3D `<LunarViewport />` container.

##### Stage 3.2: Global Moon Sphere & Candidate Site Markers
1. **Input:** `sites` array from `GET /api/sites`, `selectedSiteId`, `onSelectSite(siteId)` callback from Member 4.
2. **Processing:**
   * Load NASA SVS Entry 4720 CGI Moon Kit color and displacement maps (`useTexture` from `@react-three/drei`).
   * Render `<sphereGeometry args={[MOON_DISPLAY_RADIUS, 128, 128]} />` with `<meshStandardMaterial map={colorMap} displacementMap={dispMap} displacementScale={...} />`.
   * Convert each site's `(lat_deg, lon_deg)` to spherical 3D coordinates on the Moon sphere and render clickable site pins (using `instancedMesh` or lightweight marker components) that trigger `onSelectSite(site.id)`.
3. **Output:** Interactive Global Moon context view.

##### Stage 3.3: Local DEM Terrain Mesh & Slope Overlay
1. **Input:** `TerrainMeshResponse` (`window_km`, `grid_width`, `grid_height`, `center_elevation_m`, `elevations_m`, `slopes_deg`), `showSlopeOverlay` boolean, `slopeThresholds` (`safe`, `limit` from Member 4's MCDA config).
2. **Processing:**
   * Create `<planeGeometry args={[window_km, window_km, grid_width - 1, grid_height - 1]} />` rotated `-Math.PI / 2` around the X-axis so the plane lies in the `X-Z` plane (`+X = DEM Grid +X`, `-Z = DEM Grid +Y`, `+Y = Zenith/Up`).
   * **Verify Row/Col Alignment:** In a standard GeoTIFF raster, `row = 0` is the northernmost/top row (`+Y` in DEM grid -> `-Z` in Three.js) and `col = 0` is the westernmost/left column (`-X` in DEM grid -> `-X` in Three.js). Displace each vertex `i` by setting its local `z` (before `-90°` X-rotation, or world `Y` after rotation) to `elevations_m[i] / 1000.0` (if `1 unit = 1 km`), then call `geometry.computeVertexNormals()`.
   * Build a vertex `color` attribute from `slopes_deg[i]`:
     * `< slope_safe_deg` -> Green (GO)
     * `slope_safe_deg .. slope_limit_deg` -> Yellow (CAUTION)
     * `> slope_limit_deg` -> Red (NO-GO)
   * Toggle `vertexColors={showSlopeOverlay}` on `<meshStandardMaterial castShadow receiveShadow />` (combining with tileable lunar regolith base texture when `showSlopeOverlay` is false).
4. **Output:** Physically accurate local 3D crater/ridge terrain mesh with optional slope hazard overlay.

##### Stage 3.4: Sun/Earth Direction Vector & GPU Shadow Casting
1. **Input:** Active `TimelinePoint` (`sun_grid_az_deg`, `sun_el_deg`, `earth_grid_az_deg`, `earth_el_deg`, `is_sunlit`, `is_dte_available`) from Member 4's timeline scrubber.
2. **Processing:**
   * Convert `sun_grid_az_deg` ($\phi_{\text{grid}}$) and `sun_el_deg` ($\theta$) to radians and compute Three.js Cartesian coordinates (`lunar_navigator_tech_decisions.md` Section 3):
     $$X = R \cdot \cos(\theta) \cdot \sin(\phi_{\text{grid}})$$
     $$Y = R \cdot \sin(\theta)$$
     $$Z = -R \cdot \cos(\theta) \cdot \cos(\phi_{\text{grid}})$$
   * Position `<directionalLight castShadow position={[X, Y, Z]} shadow-mapSize={[2048, 2048]} />` with an orthographic shadow camera frustum tightly fitted to `[-window_km/2, +window_km/2]` (`shadow-camera-left/right/top/bottom`, `near`, `far`, `shadow-bias`) to prevent shadow acne at polar grazing angles ($1^\circ - 2^\circ$).
   * Optionally render a subtle Earth direction indicator vector using the same formula with `(earth_grid_az_deg, earth_el_deg)`.
3. **Output:** Live dynamic shadows across the local DEM mesh as the user drags the UTC time slider.

##### Stage 3.5: Explainable Horizon Ray & Blocking Terrain Point (Section 10.16)
1. **Input:** Active `TimelinePoint` and `horizon_profile` (720 bins) from Member 4.
2. **Processing:**
   * When `!is_sunlit` or `!is_dte_available` (or when "Show Horizon Ray" is enabled), look up the blocking `HorizonBin` at `sun_grid_az_deg` (or `earth_grid_az_deg`).
   * Compute the 3D ray from the lander `(0, observer_height_m / 1000, 0)` along `az_grid_deg` and `elevation_deg`.
   * If `distance_km <= window_km / 2`, place a 3D highlight pin/ring on the blocking terrain point at `(X_block, (obstacle_height_m - center_elevation_m)/1000, Z_block)`; if `distance_km > window_km / 2` (distant Tier 1 massif like Malapert), draw a clipped ray pointing toward the horizon edge with a 3D directional arrow/label.
3. **Output:** Visual 3D explanation matching Member 4's textual explanation (`Sun elevation: 0.8°. Terrain horizon: 1.1° at 12.4 km.`).

#### 3. Mathematical and Technical Specifications
* **Angle-to-Cartesian Formula (Three.js):** Section 3 (`+Y = Zenith`, `+X = DEM +X`, `-Z = DEM +Y`).
* **Mesh Decimation:** Default `250 × 250` (`62,500` vertices) per Section 10.13.
* **Shadow Map Quality:** Polar grazing angles ($1^\circ - 7^\circ$) require high shadow-map resolution (`2048×2048`) and careful `shadow-bias` / `shadow-normalBias` tuning so flat crater floors don't self-shadow erroneously.
* **Unresolved Specifications (Flagged):**
  1. **NASA SVS Entry 4720 Asset Packaging:** `lunar_navigator_tech_decisions.md` Section 3 specifies the NASA SVS Entry 4720 CGI Moon Kit (2K/4K JPEG), but does not specify whether assets are bundled in `frontend/public/assets/` or fetched from a URL. **Team should download and bundle 2K JPEGs locally in `frontend/public/textures/` for offline demo reliability.**
  2. **3D Scene Unit Scale:** Whether `1 Three.js unit = 1 km` or `1 m` is not specified. `1 unit = 1 km` is recommended for numerical stability and shadow frustum setup; Member 3 should document this constant.

#### 4. Interfaces and Integration
* **React Component Interface (Props from Member 4):**
  ```typescript
  interface LunarViewportProps {
    viewMode: 'global' | 'local';
    sites: SiteSummary[];
    selectedSiteId: string | null;
    onSelectSite: (siteId: string) => void;
    terrainMesh: TerrainMeshResponse | null;
    activeTimelinePoint: TimelinePoint | null;
    horizonProfile: HorizonBin[] | null;
    slopeThresholds: { safe: number; limit: number };
    showSlopeOverlay: boolean;
    showHorizonRay: boolean;
    isLoadingMesh: boolean;
  }
  ```

#### 5. Expected Deliverables
1. `frontend/src/components/three/LunarViewport.tsx` — Root R3F `<Canvas>`, lighting, LOD switcher, `OrbitControls`.
2. `frontend/src/components/three/GlobalMoon.tsx` — SVS 4720 sphere + clickable site markers.
3. `frontend/src/components/three/LocalTerrainMesh.tsx` — Displaced `<planeGeometry>`, slope vertex-color overlay, shadow receiver/caster.
4. `frontend/src/components/three/SolarLightingAndRays.tsx` — `(phi_grid, el)` to `(X, Y, Z)` directional light + explainable horizon/obstacle ray.
5. `frontend/src/utils/coordinates.ts` — Pure unit-testable math helpers for Three.js `(X, Y, Z)` conversion and lat/lon-to-sphere mapping.
6. **Acceptance Criteria:**
   * Moving the time slider updates `<directionalLight>` smoothly at interactive frame rates (benchmark FPS on target device).
   * Pure math test confirms `phi_grid = 0°, el = 0°` maps to `(0, 0, -R)` (`DEM +Y`), `phi_grid = 90°, el = 0°` maps to `(R, 0, 0)` (`DEM +X`), and `el = 90°` maps to `(0, R, 0)` (`Zenith`).
   * Camera cannot pan outside the `window_km` local mesh bounds.

---

### Member 4 – Dashboard & Application Logic (Frontend)

#### 1. Scope and Ownership
* **Responsible For:**
  * Scaffolding the React + Vite + Tailwind CSS + `lucide-react` + `dayjs` (UTC plugin) application.
  * Implementing the typed API client (`src/api/client.ts`) and TypeScript interfaces (`src/types/api.ts`) matching `POST /api/analyze`, `GET /api/sites`, `GET /api/sites/{site_id}/terrain-mesh`, and `GET /api/health`.
  * Managing application state: selected site(s), `viewMode` (`global` vs `local`), UTC `start_utc` / `duration_days` / `step_hours`, active timeline scrubber index, `use_upper_limb` toggle, `showSlopeOverlay`, and MCDA `config` (weights + thresholds + antenna mask).
  * Enforcing the MCDA weight-normalization constraint ($w_{\text{slope}} + w_{\text{solar}} + w_{\text{dte}} = 1.0$) in the UI before calling `POST /api/analyze`.
  * Building the Recharts `<LineChart>` telemetry timelines (Sun elevation vs. Sun terrain horizon; Earth elevation vs. Earth terrain horizon + antenna mask line; shaded dark/blackout bands).
  * Displaying MCDA scores (`0–100`), `GO` / `CAUTION` / `NO-GO` badges, **prominent separate hard-veto badges** (`slope_exceeded`, `darkness_exceeded`, `dte_fraction_too_low`, `blackout_exceeded`), and raw physical metrics alongside scores.
  * Building the **Multi-Site Comparison** view (side-by-side ranking and raw metric table across multiple `site_ids`).
  * Building the **Explainable Blocked-Time Inspector** (Section 10.16) and the **Planning Proxy Disclaimer** (Section 1: not NASA flight certification).
* **Explicitly Outside Scope:**
  * Writing Three.js/R3F geometry, shaders, or directional light math (Member 3).
  * Recomputing MCDA scores, slopes, or visibility states on the frontend (Member 2 computes all scientific values; Member 4 only displays them and validates UI input bounds).

#### 2. Implementation Walkthrough

##### Stage 4.1: Project Scaffold, UTC Utilities & API Client
1. **Input:** Backend OpenAPI schema (`/docs`) and Section 10.13 API contract.
2. **Processing:**
   * Initialize React + Vite + Tailwind CSS + `dayjs` (`dayjs.extend(utc)`). Configure all date/time pickers and formatters to use `dayjs.utc(...)` exclusively—never local browser timezone (`lunar_navigator_tech_decisions.md` Section 4).
   * Create `src/types/api.ts` defining `SiteSummary`, `AnalyzeRequest`, `AnalyzeResponse`, `TerrainMeshResponse`, and `HealthResponse`.
   * Create `src/api/client.ts` with typed `fetch` wrappers, error handling, and request cancellation (`AbortController`) when users rapidly scrub parameters.
3. **Output:** Typed API layer and UTC formatting utilities.

##### Stage 4.2: Application State & Lazy Mesh Loading
1. **Input:** User interactions (site selection, mission epoch, MCDA sliders, timeline scrubber).
2. **Processing:**
   * On app mount, call `GET /api/health` and `GET /api/sites`.
   * When the user clicks "Analyze" (or changes site/config), call `POST /api/analyze` with selected `site_ids` and `config`.
   * **Lazy Mesh Loading (Section 10.13):** Only call `GET /api/sites/{site_id}/terrain-mesh` when the user enters `"local"` 3D inspection view for a site (cache in frontend state per `(site_id, window_km, grid_size)` to avoid redundant fetches when toggling back and forth).
   * Maintain `activeStepIndex` (`0 .. timeline.length - 1`) synced between the timeline scrubber, Recharts cursor, Explainable Inspector, and Member 3's `<LunarViewport />`.
3. **Output:** Centralized state/hooks driving both the dashboard panels and Member 3's 3D viewport.

##### Stage 4.3: Telemetry Charts (Recharts) & Explainable Inspector
1. **Input:** `results[selectedSiteId].timeline`, `horizon_profile`, and `activeStepIndex`.
2. **Processing:**
   * Render a Recharts `<ResponsiveContainer><LineChart>` plotting:
     * `sun_el_deg` vs `sun_horizon_el_deg` over `timestamp_utc` (formatted via `dayjs.utc(ts).format('MMM DD HH:mm') + ' UTC'`).
     * `earth_el_deg` vs `earth_horizon_el_deg` and a constant `<ReferenceLine y={config.antenna_mask_deg} />`.
   * Clicking any point on the Recharts chart updates `activeStepIndex`, immediately moving Member 3's 3D Sun light and horizon ray.
   * For `activeStepIndex`, compute the explainable summary from `timeline[activeStepIndex]` and the nearest `horizon_profile` bin (`az_grid_deg`):
     > e.g. `Sun elevation: 0.8°. Terrain horizon: 1.1° at 12.4 km. Result: terrain-blocked.`
3. **Output:** Interactive, synchronized telemetry charts and explainability card.

##### Stage 4.4: MCDA Configuration, Veto Badges & Multi-Site Comparison
1. **Input:** `results` map from `POST /api/analyze` (one entry per compared `site_id`).
2. **Processing:**
   * Build the MCDA Configuration drawer/panel exposing `slope_ideal_deg`, `slope_safe_deg`, `slope_limit_deg`, `max_dark_hours`, `min_dte_fraction`, `max_blackout_hours`, `antenna_mask_deg`, `margin_reference_deg`, `observer_height_m`, `use_upper_limb`, and `weights` (`slope`, `solar`, `dte`).
   * Enforce `w_slope + w_solar + w_dte === 1.0` (e.g., auto-normalize or display validation error and disable Submit until sum = `1.00`).
   * Display `composite_score` (`0–100`) and `status` (`GO` Green / `CAUTION` Yellow / `NO-GO` Red) alongside raw physical metrics (`slope_deg`, `illumination_fraction`, `max_continuous_dark_hours`, `dte_fraction`, `max_continuous_blackout_hours`, `mean_earth_margin_deg`) and `terrain_quality`.
   * **Transparency Rule (Section 9):** Render any `true` flag in `veto_flags` as a prominent, unmissable red badge—never hidden behind the composite score.
   * Render a **Multi-Site Comparison Table** sorting/comparing all analyzed `site_ids` side by side.
   * Display a persistent **Planning Proxy Disclaimer** banner/footer (`lunar_navigator_tech_decisions.md` Section 1).

#### 3. Mathematical and Technical Specifications
* **Time Formatting:** Strict UTC (`YYYY-MM-DDTHH:MM:SSZ` in API payloads; explicit `UTC` label in UI).
* **MCDA Defaults:** `slope_ideal=5.0`, `slope_safe=10.0`, `slope_limit=15.0`, `max_dark_hours=50.0`, `min_dte_fraction=0.5`, `max_blackout_hours=12.0`, `antenna_mask=5.0`, `margin_reference=5.0`, `observer_height=2.0`, `use_upper_limb=false`, `weights={slope: 0.40, solar: 0.35, dte: 0.25}`.
* **Status Bands:** `80–100` GO, `50–<80` CAUTION, `<50` or Veto NO-GO.
* **Unresolved Specifications (Flagged):**
  1. **Vite Dev Proxy / CORS:** `lunar_navigator_tech_decisions.md` does not specify the dev ports or CORS setup. Agree on FastAPI on `:8000` and Vite on `:5173` with a Vite `/api` proxy (`vite.config.ts`) plus FastAPI `CORSMiddleware`.
  2. **Mock Data Fixture:** Member 4 needs a static JSON fixture matching `POST /api/analyze` and `GET /api/sites` to build all UI/charts before Backend is live.

#### 4. Interfaces and Integration
* **Consumed HTTP Endpoints:** `GET /api/health`, `GET /api/sites`, `POST /api/analyze`, `GET /api/sites/{site_id}/terrain-mesh`.
* **Provided Props to Member 3:** `LunarViewportProps` (defined in Member 3 Section 4).

#### 5. Expected Deliverables
1. `frontend/src/types/api.ts` & `frontend/src/api/client.ts` — Typed API contract & fetch client.
2. `frontend/src/utils/time.ts` — `dayjs` UTC parsing/formatting helpers.
3. `frontend/src/components/dashboard/SiteSelector.tsx` & `MissionConfigPanel.tsx` — Site picker, UTC window, step size, MCDA weights/thresholds with sum=1.0 validation.
4. `frontend/src/components/dashboard/TelemetryCharts.tsx` & `ExplainabilityCard.tsx` — Recharts Sun/Earth vs. horizon charts + blocked-time readout.
5. `frontend/src/components/dashboard/SiteComparisonTable.tsx` & `McdaScoreCard.tsx` — Scorecards, raw metrics, hard-veto badges, `terrain_quality` indicator, and disclaimer.
6. `frontend/src/App.tsx` — Main layout integrating Dashboard + Member 3's `<LunarViewport />`.
7. **Acceptance Criteria:**
   * Zero local-timezone leakage in displayed timestamps or API requests.
   * Weight sum validation prevents invalid `POST /api/analyze` submissions.
   * Hard-veto badges visibly render even if a site has high individual utilities.
   * Clicking a Recharts timestamp updates `activeStepIndex` and Member 3's 3D Sun light synchronously.

---

## C. Inter-Team Dependencies

| Producer | Consumer | Data / Functionality Exchanged | Format & Interface | Can Mock Independently? | Integration Prerequisite |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Member 2** | **Member 1** | Site `(X_0, Y_0, z_0)` and GeoTIFF `central_meridian_deg` ($\lambda_0$) | Python `SiteContext` dataclass / function call | **Yes** (use `z_0 = 0.0`, $\lambda_0 = 0.0$ in unit tests) | Tier 2 DEM tile readable on disk |
| **Member 1** | **Member 2** | Time-series `EphemerisPoint[]` (Sun & Earth `grid_az_deg`, `el_deg`) | Python `EphemerisService.get_ephemeris(...)` | **Yes** (synthetic sine/cosine Sun & Earth curves) | Horizons parser & cache working for 1 site |
| **Member 1 & 2** | **Member 4** | Site list, analysis metrics, MCDA, horizon profile, timeline, health | `GET /api/sites`, `POST /api/analyze`, `GET /api/health` (JSON) | **Yes** (static JSON mock matching Section 10.13) | FastAPI `/docs` live with Pydantic schemas |
| **Member 2** | **Member 3** | Decimated local elevation & slope grids | `GET /api/sites/{site_id}/terrain-mesh` (JSON) | **Yes** (synthetic Gaussian crater `250×250` array) | Tier 2 DEM windowing + `terrain-mesh` endpoint live |
| **Member 4** | **Member 3** | Active site, view mode, timeline point, horizon bins, UI toggles | React `LunarViewportProps` | **Yes** (Storybook/harness wrapper with mock props) | `LunarViewportProps` TypeScript interface locked |

> **Critical Integration Rule:** Lock `backend/app/schemas.py` and `frontend/src/types/api.ts` (plus the 4 unresolved schema details flagged in Member 2 Section 3) in **Milestone 1** before parallel implementation begins.

---

## D. Implementation Order & Milestones

### Workload Balance Assessment
Reviewing the agreed split reveals a **moderate backend workload imbalance**:
* **Member 2** owns DEM ingestion, CRS/projection math, slope + footprint aggregation, 2-tier 720-bin curvature-corrected raycasting, visibility/timeline evaluation, MCDA scoring, *and* terrain mesh decimation.
* **Member 1** owns Horizons querying, JSON/LRU caching, and azimuth normalization.
* **Proposed Adjustment (Without Changing Core Ownership):**
  1. **Member 1** owns the **FastAPI application shell (`main.py`), all shared Pydantic schemas (`schemas.py`), `GET /api/health`, `GET /api/sites`, and `POST /api/analyze` route orchestration**, plus the uniform UTC time-grid utility.
  2. **Member 2** focuses purely on the **geospatial/scientific Python services** (`dem.py`, `slope.py`, `horizon.py`, `visibility.py`, `mcda.py`, `mesh.py`) and `GET /api/sites/{site_id}/terrain-mesh`.
  3. On the frontend, **Member 3** and **Member 4** are well balanced (3D R3F scene + LOD + shadows/rays vs. React state + API + Recharts + MCDA/comparison UI).

### Milestone Sequence (Aligned with `lunar_navigator_tech_decisions.md` Section 10.17)

```text
M1: Contracts & Scaffolding (Parallel)
 ├── M1 (All): Lock Pydantic/TS schemas, unresolved details, & mock JSON fixtures
 ├── M1 (M1): Horizons client + cache for 1 site; FastAPI /health & /sites stub
 ├── M1 (M2): Verify GeoTIFF CRS, pyproj transform, read 1 local window (z_0)
 ├── M1 (M3): R3F Canvas + Global Moon (SVS 4720) + coordinate math helpers
 └── M1 (M4): Vite+Tailwind+dayjs(UTC) shell + API client against mock JSON

M2: Core Scientific Pipeline & Local 3D (Critical Path)
 ├── M2 (M1): Complete Earth + Sun caching & prepopulate 4 seed sites
 ├── M2 (M2): 720-bin horizon raycaster + Sun/Earth visibility + slope + MCDA
 ├── M2 (M2): GET /api/sites/{site_id}/terrain-mesh endpoint
 └── M2 (M3): Local <planeGeometry> mesh + directionalLight shadows on mock mesh

M3: End-to-End Integration Checkpoint
 ├── Wire M4 Dashboard -> live FastAPI /api/sites & POST /api/analyze
 ├── Wire M3 <LunarViewport> -> live /terrain-mesh & M4 activeTimelinePoint
 └── Verify Recharts click -> 3D Sun shadow & explainable blocked-ray update

M4: Multi-Site Comparison, Configurable MCDA & Polish
 ├── M4 (M4): Multi-site comparison table, MCDA sliders, hard-veto badges
 ├── M4 (M3): Slope color overlay toggle, LOD transitions, camera bounds
 └── M4 (All): Convergence tests, offline demo test (network disabled), FPS check
```

* **Critical Path:** `M2 DEM Windowing & CRS (M2) -> M1 Ephemeris + M2 Horizon Raycasting (M1+M2) -> POST /api/analyze (M1/M2) -> Live Dashboard & 3D Integration (M3/M4)`.
* **Unblocking Priority:** Member 2 must deliver `SiteContext` (`X_0, Y_0, z_0, central_meridian_deg`) and `terrain-mesh` early; Member 1 must deliver `schemas.py` and `/api/sites` + `/api/analyze` stubs early so Members 3 and 4 never block on live backend availability.

---

## E. Testing and Validation

### Member 1 – Astronomy & Ephemeris
* **Unit Tests:**
  * Verify `SITE_COORD` formatting (`east_lon, lat, alt_km`), `altitude_km = (z_0 + h_obs) / 1000.0`, and `$$SOE` / `$$EOE` CSV parser against a saved JPL Horizons response fixture.
  * Verify `phi_grid = (phi + (lon - lambda_0)) % 360.0` across boundary angles (`lon = 357.07°`, `phi = 359.9°`).
  * Verify cache hit/miss behavior and deterministic filename generation.
* **Reference Validation:** Cross-check parsed Sun/Earth `az_true_north_deg` and `el_deg` for `connecting_ridge_cr1` against the JPL Horizons web interface for 3 sample UTC epochs.

### Member 2 – Terrain & Mission Analysis
* **Unit Tests:**
  * **Slope:** Synthetic tilted plane of known $10^\circ$ slope -> central difference returns `10.000° ± 0.001°`; `NoData` pixels inside `100 m` footprint are excluded without corrupting `p90`.
  * **Horizon Raycasting:** Flat sphere ($z = 0$) at $r = 100\text{ km}$ -> curvature term $-r^2/(2 R_{\text{Moon}})$ yields negative horizon angle matching $-\arctan(r / (2 R_{\text{Moon}}))$; synthetic wall of height $H$ at distance $D$ yields exact expected $\theta_{\text{obstacle}}$.
  * **MCDA:** Verify weight sum validation (`!= 1.0` rejected), piecewise `s_slope` at `5°`, `10°`, `15°`, `20°`, and Stage 1 hard-veto forcing `composite_score == 0.0` and `status == "NO-GO"`.
* **Mathematical / Convergence Validation:**
  * Run convergence test comparing default raycasting (`0.5°` azimuth, `20 m` near / `80 m` far, `R_max = 100 km`) against a finer reference (`0.25°`, `10 m` / `40 m`, `R_max = 120 km`) on `connecting_ridge_cr1` and report max/RMS horizon difference.

### Member 3 – 3D Visualization
* **Unit Tests:**
  * Pure TypeScript tests for `gridAzElToThreeCartesian(phi_grid, el, R)`: verify cardinal axes (`0° -> -Z`, `90° -> +X`, `180° -> +Z`, `270° -> -X`, `el=90° -> +Y`).
  * Verify DEM row/col vertex-index mapping does not mirror North/South or East/West.
* **Visual & Performance Validation:**
  * Verify `OrbitControls` cannot pan outside `window_km` bounds.
  * Benchmark WebGL frame rate (`FPS`) on target presentation hardware with `250 × 250` mesh + `2048×2048` shadow map.
  * Confirm GPU shadows visually match backend `is_sunlit` transitions at sunrise/sunset timestamps.

### Member 4 – Dashboard & Application Logic
* **Unit Tests:**
  * UTC date formatting (`dayjs.utc`) produces identical `YYYY-MM-DDTHH:mm:ssZ` strings regardless of host OS timezone.
  * MCDA weight validator blocks submission when `w_slope + w_solar + w_dte != 1.0`.
  * Explainable readout formatter renders exact degrees, km, and blockage status from mock `timeline` + `horizon_profile`.
* **End-to-End Integration Tests:**
  * With backend running **completely offline** (using pre-populated Horizons cache + `backend/data/derived/` DEM tiles), load app -> `GET /api/health` (`200`) -> `GET /api/sites` (`4` sites) -> run `POST /api/analyze` for 2+ sites -> inspect Recharts timeline -> click a blocked timestamp -> open Local 3D view (`GET /api/sites/{id}/terrain-mesh`) -> verify 3D Sun shadow and horizon ray update without console errors.
