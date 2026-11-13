# NASA Space Apps 2026: Lunar Landing Site Navigator
## Technical Decisions & Implementation Reference

---

## 1. Challenge Scope & Strategic Focus

* **Core Objective:** Build an intuitive decision-support tool for mission planners to rapidly compare candidate landing sites (especially Lunar South Pole) and dates, evaluating:
  1. **Solar Power Generation Potential:** Sun elevation angle, daylight duration, time-to-sunset.
  2. **Direct-to-Earth (DTE) Communication Windows:** Earth elevation angle, line-of-sight continuity, time-to-Earthset.
  3. **Lander Safety:** Terrain slope and obstacle clearance from topography.
* **Scope Decision & Scientific Disclaimer:**
  * **Surface Operations Only:** Earth-to-Moon launch/transit trajectory modeling is excluded to prioritize topocentric lunar surface illumination, DTE visibility, and terrain analysis.
  * **Planning Proxy (Not Flight Certification):** All slope thresholds, MCDA weights, GO/CAUTION/NO-GO bands, and DTE antenna-mask rules are team-configurable decision-support inputs—not universal NASA flight requirements, footpad/boulder hazard certifications, or RF link budgets. Always display raw physical metrics and constraint violations alongside scores.

---

## 2. Frontend Tech Stack & Architectural Decisions

| Component | Selected Technology | Rejected Alternative | Why Selected (Rationale) |
| :--- | :--- | :--- | :--- |
| **App Framework** | **React (Vite)** | Vanilla JS / Next.js | Vite provides instant hot-reload and minimal setup. React provides component modularity and reactive state management. |
| **3D Engine** | **React Three Fiber (`@react-three/fiber`)** | Raw Three.js | Declarative JSX syntax (`<mesh>`, `<sphereGeometry>`). Seamless two-way state binding between 2D UI controls (sliders, site pickers) and 3D objects without manual bridge code. Retains 100% Three.js feature parity + manual control via `useRef`. |
| **3D Helpers** | **`@react-three/drei`** | Manual Three.js boilerplate | One-line implementations of essential 3D features: `OrbitControls` (camera navigation), starfields, and 3D loaders. |
| **Charts & Windows** | **Recharts** | Chart.js (`react-chartjs-2`) | Recharts is SVG-based and designed natively for React (`<LineChart>`, `<XAxis>`, `<Tooltip>`). Much faster to style with Tailwind CSS and responsive out of the box compared to canvas-based Chart.js. |
| **UI Styling** | **Tailwind CSS** | Plain CSS / Bootstrap | Rapid utility-first styling for dark-mode mission control HUDs and metric cards. |
| **Icons** | **`lucide-react`** | FontAwesome / Custom SVGs | Lightweight, modern icon library for space telemetry badges (Sun, Satellite, AlertTriangle, Compass). |
| **Date & Time** | **`dayjs`** (with UTC plugin) | Native JS `Date` | Native Date stores instants reliably but exposes local-time defaults that are easy to misuse in a UTC-first interface. dayjs with its UTC plugin provides explicit UTC parsing, formatting, and arithmetic. |

---

## 3. 3D Surface Visualization & Texture Mapping (React Three Fiber)

| Component | Selected Technology | Rejected Alternative | Why Selected (Rationale) |
| :--- | :--- | :--- | :--- |
| **Global 3D Textures** | **[NASA SVS Entry 4720 CGI Moon Kit](https://svs.gsfc.nasa.gov/4720) (Color + Displacement Map)** | Raw Procedural Shaders / Custom stitching | Pre-packaged 2K/4K JPEG assets from NASA Scientific Visualization Studio (SVS Entry 4720 by Ernie Wright). Includes global color and elevation assets designed for 3D rendering; performance depends on asset resolution, mesh density, device, and renderer settings. |
| **Local Site 3D Mesh** | **`<planeGeometry>` with LOLA DEM height displacement** | Generic flat plane / static sphere | When zooming into a landing site (e.g. Shackleton Crater), swaps from global sphere to a localized 3D terrain mesh showing real crater walls and slopes. |

### Technical Mechanics: Lighting & Real-Time Shadow Mapping (R3F)
1. **Angle to Cartesian Transformation (Three.js Convention & DEM Grid Alignment):**  
   In a South Polar Stereographic DEM grid (expected configuration: `Central_Meridian = 0.0`, `Standard_Parallel_1 = -90.0` — treat as an expected configuration and verify dynamically against the downloaded GeoTIFF's `dataset.crs` metadata rather than hardcoding), the DEM grid axes are aligned to the projection's central meridian $\lambda_0$ rather than a candidate site's local geographic meridian $\lambda$, whereas JPL Horizons reports topocentric azimuth ($\phi$) clockwise from local geographic True North. To keep the unrotated DEM mesh, backend raycaster, and Three.js scene in a single unified frame, the backend normalizes Horizons azimuth into **Grid Azimuth** (under the expected $\lambda_0 = 0^\circ$ configuration, subject to metadata verification):
   $$\phi_{\text{grid}} = (\phi + \lambda) \pmod{360^\circ}$$
   The frontend converts $\phi_{\text{grid}}$ and Elevation ($\theta$) to 3D Cartesian coordinates $(X, Y, Z)$ for `<directionalLight />` matching Three.js conventions ($+Y = \text{Zenith/Up}$, $+X = \text{DEM Grid }+X$, $-Z = \text{DEM Grid }+Y$):
   $$X = R \cdot \cos(\theta) \cdot \sin(\phi_{\text{grid}}) \quad (\text{DEM Grid }+X\text{ axis})$$
   $$Y = R \cdot \sin(\theta) \quad (\text{Local vertical / Zenith})$$
   $$Z = -R \cdot \cos(\theta) \cdot \cos(\phi_{\text{grid}}) \quad (\text{DEM Grid }+Y\text{ axis, Three.js camera view aligns to } -Z)$$
2. **GPU Shadow Casting (Visualization Only):**  
   R3F `<directionalLight castShadow position={[sunX, sunY, sunZ]} />` casts parallel light rays. Vertices with high elevation (crater rims) physically occlude rays from hitting lower ground behind them, allowing the GPU depth-buffer to render real-time dynamic shadows as the time slider is moved. Use GPU shadows for visualization only; scientific sunlight/line-of-sight results come from the backend terrain-visibility model.

### Surface Texture Decisions: Albedo-Normalized Tiles vs. Raw Satellite Photos
* **Decision:** **Drop raw LROC WAC satellite photo crops**; adopt **NASA SVS Albedo-Normalized textures** and tileable high-resolution lunar surface textures.
* **Scientific Rationale:**
  * **Base Color Map Characteristics:** The color map is adapted from the Hapke-normalized LROC WAC mosaic, intended as a base color before lighting. The CGI kit is optimized for aesthetics rather than science; polar gaps include lower-resolution/inpainted content. Do not use it for quantitative illumination analysis.
  * **Dynamic R3F Lighting:** Because the base texture approximates diffuse reflectance without baked directional shadows, React Three Fiber `<meshStandardMaterial />` computes live visual lighting based on the Sun position vector.
  * **Local High-Resolution Display:** High-resolution local visualization requires separate, validated local texture/terrain assets; a bounded DEM window limits the local mesh extent.
* **Exploration Bounds:** Local meshes are constrained to a defined Landing Zone (e.g., $10\text{ km} \times 10\text{ km}$) to prevent cameras from traversing off the edge of the bounded DEM slice.

### Core Data Architecture & Pipeline Inputs:
* **Core inputs:** Horizons supplies target apparent azimuth/elevation for an ideal local horizon; LOLA supplies terrain heights. Terrain-aware results additionally require documented coordinate/reference-frame handling, DEM validity and uncertainty masks, observer height, target angular extent, time sampling, and mission-defined communications assumptions.

---

## 4. Astronomical & Lunar Physics Reference

* **Synodic Period ($29.53$ Earth days):** Useful as the upper bound for multi-week timeline presets; polar illumination is terrain- and season-dependent and must never be approximated as 14.75 days of continuous light/darkness.
* **Polar Grazing Illumination ($1.54^\circ$ Spin-Axis Tilt):** The Moon's $\approx 1.54^\circ$ axial tilt relative to the ecliptic normal (Archinal et al. 2018; NASA [South Pole Illumination Map](https://science.nasa.gov/photojournal/south-pole-illumination-map/)) produces grazing polar sunlight, making terrain-horizon raycasting mandatory for South Pole illumination and Permanently Shadowed Regions (PSRs).
* **Time System:** All calculations, Horizons queries, API payloads, and UI controls operate strictly in **Earth UTC** (`YYYY-MM-DDTHH:mm:ssZ`). No calendar-to-lunar conversions are required in UI code.

---

## 5. Backend Tech Stack & Decisions

| Component | Selected Technology | Rejected Alternative | Why Selected (Rationale) |
| :--- | :--- | :--- | :--- |
| **Server Framework** | **FastAPI (Python)** | Flask | Automatic interactive Swagger UI at `/docs` (allows instant testing for frontend dev), native Pydantic data validation, and native async support. |
| **Ephemeris Engine** | **JPL Horizons API (`astroquery` or REST) + Backend Caching** | Pure `skyfield` or NASA SPICE (`spiceypy`) | Horizons can provide observer-table azimuth/elevation for a user-defined lunar topocentric site (see [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html)). The choice over Skyfield/SPICE is a team implementation trade-off, not a NASA limitation of those tools. |
| **Performance Strategy** | **Local Cache (JSON / SQLite / Memory)** | Live uncached API calls | Avoids repeated API calls during interaction; benchmark cache-hit latency and handle failed or stale initial fetches. |
| **Coordinate System** | **Topocentric Frame (`coord@301`)** | Geocentric / Barycentric | Observer frame is pinned directly to the landing site surface: $(\text{Latitude}, \text{Longitude}, \text{Elevation})$. Horizons elevations are relative to the modelled local horizon/ellipsoid, not a terrain horizon; apply the DEM horizon mask separately. |

### Ephemeris Query Mechanics:
* **JPL Horizons Query Mapping:**
  * Observer: `CENTER='coord@301'`, `COORD_TYPE='GEODETIC'`, `SITE_COORD='east_longitude_deg, latitude_deg, altitude_km'`.
  * Targets: `COMMAND='10'` (Sun) or `COMMAND='399'` (Earth).
  * Output: `QUANTITIES='4'` (airless apparent azimuth and elevation directly relative to the modelled local horizon/ellipsoid).
  * *Implementation Note:* Validate longitude convention (East positive), altitude in km, timescale, and returned table headers in an automated test. Horizons elevations are relative to the reference ellipsoid, not terrain; the DEM horizon mask must be applied separately.

---

## 6. Topography & Elevation Processing (LOLA DEM)

| Component | Selected Technology | Rejected Alternative | Why Selected (Rationale) |
| :--- | :--- | :--- | :--- |
| **Topography Dataset** | **LOLA / LOLA-Enhanced Polar Products** | SLDEM2015 / Monolithic Global DEM | Use LOLA/LOLA-enhanced products selected from the [NASA GSFC LOLA South Pole DEM catalogue](https://pgda.gsfc.nasa.gov/products/90) and [LOLA polar illumination/visibility products](https://pgda.gsfc.nasa.gov/products/69) by coverage, pixel scale, effective resolution, vertical/slope uncertainty, and required baseline. The catalogue provides height, effective-resolution, error, slope, and roughness products. |
| **File Handling Library** | **`rasterio` + `numpy`** | Live Web GIS APIs (Moon Trek) & OpenCV | `rasterio` natively parses embedded geospatial metadata (GeoTIFF). Use the product CRS with `rasterio.warp` / `pyproj` to transform longitude–latitude coordinates into the DEM's south-polar stereographic coordinates, then map those coordinates to pixel indices. Windowed local reads should be benchmarked on the deployment machine and reported as measured performance. |

### Dual-Scale Topography Architecture (Regional vs. Local Window)

To evaluate regional horizon effects and local terrain metrics without loading full multi-gigabyte products into memory, the pipeline uses two terrain tiers:

1. **Tier 1: Regional Cloud-Optimized GeoTIFF (COG):**
   * **Product Selection:** Start with `LDEM_80S_80MPP_ADJ.TIF` (80 m/pixel; listed at 181 MB in the [catalogue](https://pgda.gsfc.nasa.gov/products/90)) or select another published COG after validating coverage and memory use.
   * **Purpose:** Precomputes the skyline obstacle mask to capture shadows from distant massifs and crater rims (e.g. Malapert Mountain). Treat maximum ray distance ($R_{\text{max}}$) and azimuth sampling as team parameters.

2. **Tier 2: Local Assessment Window:**
   * **Coverage:** Bounded local window (e.g., $10\text{ km} \times 10\text{ km}$) around candidate landing coordinates.
   * **Product Selection:** Use `LDEM_80S_20MPP_ADJ.TIF` ($80^\circ\text{S}\text{--}90^\circ\text{S}$, 20 m/pixel) as the universal Tier 2 baseline covering all candidate sites. Optional 5 m overrides—either the `ldem_87s_5mpp` mosaic ($87^\circ\text{S}\text{--}90^\circ\text{S}$) or site-specific 5 m LOLA / SfS DEM products (which also exist for individual locations north of $87^\circ\text{S}$, such as Malapert Massif / Site 23; see [NTRS 20260004665](https://ntrs.nasa.gov/citations/20260004665))—may be used wherever a suitable product covers the candidate site.
   * **Resolution Caution:** 5-metre pixels evaluate macro-terrain but do not establish footpad- or rock-scale safety.
   * **Render Mesh:** Decimate or tile the render mesh independently from the analysis grid (e.g., decimating a $2,000 \times 2,000$ 5 m sample grid to $500 \times 500$ vertices for WebGL display); benchmark frame rate on target hardware.

### Dynamic Windowed Reading (`rasterio.windows.from_bounds`)

To allow users to evaluate localized sites efficiently without loading gigabytes into RAM:
* **Mechanism:** Tiled GeoTIFFs organize data into internal byte blocks; inspect each product's block layout. Using `rasterio.windows.from_bounds()`, the backend requests the bounded spatial window; actual reads occur in the product’s internal block units and may include adjacent pixels.
* **Performance Benchmark:** Measure read/decode time, cache behaviour, and memory against representative COGs and deployment hardware rather than assuming static latency guarantees.
* **Fallback / Pre-cropped Pack:** Pre-crop bounded GeoTIFF tiles for primary candidate regions (Shackleton Rim, Connecting Ridge, Malapert Mountain) to reduce network and repeated-window overhead.

### Critical Implementation Catches & Solutions:
1. **Polar Stereographic Projection, Reference Frame & Grid Azimuth Normalization:** Longitude lines converge at the South Pole; standard Cartesian flat $(x,y)$ mapping causes severe distortions. Furthermore, in a South Polar Stereographic projection, the DEM grid axes align with the projection's central meridian rather than a candidate site's local geographic meridian $\lambda$, whereas JPL Horizons reports azimuth $\phi$ clockwise from local geographic True North.
   * *Fix:* Do not hardcode CRS parameters. Always read and verify the downloaded GeoTIFF's embedded `dataset.crs` metadata (`MOON_ME` reference frame) and use `pyproj` / `rasterio.warp` to transform $(\lambda, \varphi) \to (X_0, Y_0)$. Under the expected South Polar Stereographic configuration (`Central_Meridian = 0.0`, `Standard_Parallel_1 = -90.0`, subject to verification against the downloaded GeoTIFF metadata), normalize Horizons topocentric azimuth $\phi$ into DEM Grid Azimuth via $\phi_{\text{grid}} = (\phi + \lambda) \pmod{360^\circ}$ so raycasting and 3D rendering operate directly in the unrotated DEM grid frame.
2. **Resolution & File Size Handling:** Published full products range from hundreds of MB to several GB—for example, the 80–90°S 20 m DEM is listed at 2.6 GB and the 87–90°S 5 m elevation mosaic at 3.3 GB.
   * *Fix:* Use COG windowing or pre-cropped derived tiles instead of loading monolithic grids into RAM.
3. **No-Data & Metadata Filtering:** NoData, interpolation, count, and uncertainty behaviour are product-specific; inspect each product’s metadata and companion layers. Preserve a validity mask and do not assume a universal sentinel such as `-32768` or apply an arbitrary `-15000 m` cutoff.

---

## 7. Terrain Slope & Lander Hazard Calculation

* **Team-Configured Safety Display Thresholds (Not Universal NASA Requirements):**
  * **$< 10^\circ$ (GO / Green):** Default team nominal slope band; vehicle-specific requirements must be independently verified before being presented as mission constraints.
  * **$10^\circ - 15^\circ$ (CAUTION / Yellow):** Team-configured advisory warning band indicating increased slope risk.
  * **$> 15^\circ$ (NO-GO / Red):** Team-configured exclusion threshold.
* **Context & Literature References:**
  * Document IDs and vehicle-specific claims (such as Apollo, Nova-C, or Starship geometry/limits) require source-level rechecking against primary design documents before being asserted as requirements.
  * Historical reference: Apollo Lunar Module Landing Gear Subsystem documentation (NTRS `19720018253` / `19730010151`) examined operational limits for LM landing gear.

* **Mathematical Formula (Central Difference Gradient & Landing-Footprint Aggregation):**
  * On the projected DEM raster array $z[\text{row}, \text{col}]$ (where `col` increases along $+X$ and `row` increases along $-Y$ with pixel spacing $d$ in projected metres):
    $$\frac{\partial z}{\partial x} = \frac{z[\text{row}, \text{col}+1] - z[\text{row}, \text{col}-1]}{2 \cdot d}, \qquad \frac{\partial z}{\partial y} = \frac{z[\text{row}-1, \text{col}] - z[\text{row}+1, \text{col}]}{2 \cdot d}$$
  * $\text{Slope}(\theta) = \arctan\left(\sqrt{(\partial z / \partial x)^2 + (\partial z / \partial y)^2}\right) \times \frac{180}{\pi}$.
  * **MCDA Site Slope Aggregation (`slope_deg`):** Evaluate all valid (non-`NoData`) slope pixels within a configurable landing-zone footprint radius $R_{\text{footprint}} = 100\text{ m}$ centered on $(X_0, Y_0)$. Use the **90th-percentile slope (`slope_p90_100m_deg`)** as the primary scalar `slope_deg` input to Stage 1 veto and Stage 2 MCDA scoring, and report `slope_center_deg` and `slope_mean_100m_deg` as supplementary metrics.
  * *Scale Note:* This reports slope at the DEM’s stated effective resolution and chosen baseline. It is not a footpad-, boulder-, or full landing-ellipse hazard certification.

* **Algorithmic Decision Rule (Team Configurable):**
  Default team values: $\theta_{\text{ideal}} = 5^\circ$, $\theta_{\text{safe}} = 10^\circ$, and $\theta_{\text{limit}} = 15^\circ$.
  $$\text{Safety Status}(\theta) = \begin{cases} 
  \text{GO (Green)} & \text{if } \theta < \theta_{\text{safe}} \\
  \text{CAUTION (Yellow)} & \text{if } \theta_{\text{safe}} \le \theta \le \theta_{\text{limit}} \\
  \text{NO-GO (Red)} & \text{if } \theta > \theta_{\text{limit}} 
  \end{cases}$$

---

## 8. Horizon Masking & Line-of-Sight (LoS) Raycasting

* **The South Pole Problem:**
  * At Artemis south-polar target regions, the Sun is commonly very low; NASA reports it never exceeds about $7^\circ$ and is often $1^\circ - 2^\circ$. Earth elevation must be computed for each site and epoch; lunar libration and site geometry affect geometric elevation, while topography affects visibility.
  * Nearby crater rims or ridges easily block lines of sight, creating extended periods of shadow (power loss) and communication blackouts even when ephemeris reports targets are above the idealized local horizon.

* **Data Sources (Self-Contained Pipeline):**
  * **Target Directions:** Azimuth ($\phi$) and Elevation ($\theta_{\text{target}}$) from [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html) (`astroquery`).
  * **Obstacle Heights:** Regional and local LOLA/LOLA-enhanced DEM windows, chosen according to the analysis scale.

* **Mathematical Formula (Curvature-Corrected Horizon Raycasting in DEM Grid Frame):**
  * Expected South Polar Stereographic grid ray stepping (treating `Central_Meridian = 0.0`, `Standard_Parallel_1 = -90.0` as an expected configuration, subject to verification against the downloaded GeoTIFF metadata rather than hardcoding): for a site at stereographic coordinates $(X_0, Y_0)$ and east longitude $\lambda$, convert topocentric azimuth $\phi$ (clockwise from local True North) to DEM Grid Azimuth $\phi_{\text{grid}} = (\phi + \lambda) \pmod{360^\circ}$. A sample along that ray at radial distance $r$ lies at:
    $$X(r, \phi_{\text{grid}}) = X_0 + r \cdot \sin(\phi_{\text{grid}}), \qquad Y(r, \phi_{\text{grid}}) = Y_0 + r \cdot \cos(\phi_{\text{grid}})$$
  * Small-distance spherical approximation ($R_{\text{Moon}} = 1737.4\text{ km}$ matching LOLA polar products); use the exact spherical expression or an ellipsoidal/body-fixed ray-intersection method if extending range or requiring higher fidelity. For obstacle elevation $z(r, \phi_{\text{grid}})$ at radial distance $r$ along grid azimuth $\phi_{\text{grid}}$ and observer/antenna height $h_{\text{obs}}$ above local surface elevation $z_0$:
    $$z_{\text{eff}}(r, \phi_{\text{grid}}) = z(r, \phi_{\text{grid}}) - \frac{r^2}{2 \cdot R_{\text{Moon}}}$$
    $$\theta_{\text{obstacle}}(r, \phi_{\text{grid}}) = \arctan\left(\frac{z_{\text{eff}}(r, \phi_{\text{grid}}) - (z_0 + h_{\text{obs}})}{r}\right) \times \frac{180}{\pi}$$
  * *Curvature Impact:* At $r = 20\text{ km}$, spherical drop $h_{\text{drop}} \approx 115\text{ m}$ ($\approx 0.33^\circ$). Because South Pole solar elevation is frequently $1^\circ - 2^\circ$, accounting for curvature is critical for solar and Earth line-of-sight analysis.
  * *Target Visibility Condition:* A point-source target at grid azimuth $\phi_{\text{grid}}$ is terrain-visible if $\theta_{\text{target}} > \max_{r_{\text{min}} \le r \le R_{\text{max}}}\left(\theta_{\text{obstacle}}(r, \phi_{\text{grid}})\right)$.
  * *Default Two-Tier Ray Marching & NoData Handling:* Sample near-field terrain on the Tier 2 DEM from $r_{\text{min}} = 40\text{ m}$ to $5{,}000\text{ m}$ at step $\Delta r = 20\text{ m}$ (avoiding $r=0$ division by zero and self-sampling the origin pixel), and far-field terrain on the Tier 1 DEM from $5{,}080\text{ m}$ to $R_{\text{max}} = 100{,}000\text{ m}$ ($100\text{ km}$) at step $\Delta r = 80\text{ m}$. Skip any `NoData` / `NaN` or out-of-bounds samples along a ray and record the invalid sample count in `terrain_quality` metadata.

* **Optimization Strategy & Finite-Disc Treatment:**
  * **Horizon Skyline Sampling:** Precompute a terrain horizon sampled at **$0.5^\circ$ angular resolution ($720$ azimuth bins across $360^\circ$)**—chosen so the azimuthal bin spacing matches the $\approx 0.53^\circ$ angular diameter of the solar disc—and linearly interpolate between adjacent azimuth bins. Validate ray range and sampling resolution through convergence testing against a finer reference.
  * **Finite Solar Disc (Phase 1 Solar Visibility Rule):** At polar grazing angles, treating the Sun as a point source shifts sunrise/sunset transitions (the solar disc subtends $\approx 0.53^\circ$, radius $\approx 0.265^\circ$). For Phase 1, use **target-center visibility by default** (`use_upper_limb = False`): a solar direction is considered visible only when the Sun's center elevation exceeds the terrain horizon elevation. Optionally support upper-limb visibility (`use_upper_limb = True`) using the apparent solar angular radius of $\approx 0.265^\circ$ ($\theta_{\text{sun}} + 0.265^\circ > \theta_{\text{horizon}}$). Do not implement fractional solar-disc visibility in Phase 1.
  * **Finite Earth Disc & Link Availability:** $\text{EarthVisible}(t)$ is based on terrain-obscured Earth-disc visibility (Earth subtends $\approx 1.8^\circ - 2.0^\circ$); $\text{LinkAvailable}(t)$ additionally requires a team-specified antenna elevation mask and link-budget rule. (NASA [LOLA polar illumination and visibility studies](https://pgda.gsfc.nasa.gov/products/69) treat both Sun and Earth as finite discs and note that 'any visible part' can be optimistic for communications).

---

## 9. Multi-Criteria Decision Analysis (MCDA) Scoring Engine

### Team-Configurable Mission Assumptions and Score Inputs

*NASA literature supports considering slope, illumination, terrain safety, and Earth visibility; however, specific numerical cutoff thresholds (e.g. 5°, 15°, 85%, 75%) are mission- and vehicle-specific design choices, not universal NASA requirements. The table below outlines team-configurable evaluation inputs:*

| Criterion | Team Nominal Setting | Team Warning Threshold | Team Hard Cutoff (Veto) | Context & Mission Literature |
| :--- | :--- | :--- | :--- | :--- |
| **Surface Slope ($\theta$)** | $< 5.0^\circ$ | $10.0^\circ$ | $> 15.0^\circ$ | Landing-slope threshold: team configuration; cite vehicle-specific requirements only after verifying original specifications and DEM baseline/scale. |
| **Mission Duration** | Configurable input (default: $6.0\text{ days}$) | — | — | For 2022 candidate-region analysis, NASA described a planned ~6.5-day surface mission. The [2025 NASA site-selection update](https://ntrs.nasa.gov/citations/20250011660) (NTRS 20250011660) reports approximately 5.75–6.25 days depending on mission epoch. Make duration an input parameter. |
| **Solar Illumination ($f_{\text{sun}}$)** | High cumulative fraction | Team-defined caution band | Continuous dark $> T_{\text{dark,max}}$ (default: $50.0\text{ h}$) | Solar performance is reported as illumination fraction and maximum continuous darkness over a selected mission window (see [LOLA illumination studies](https://pgda.gsfc.nasa.gov/products/69)). Minimum fraction and battery/thermal blackout limits are team- or mission-specific inputs. Default hard cutoff $T_{\text{dark,max}} = 50.0\text{ h}$. |
| **Earth DTE Visibility ($f_{\text{dte}}$)** | High continuous coverage (default $\text{min\_dte\_fraction} = 0.5$) | Low elevation margin ($\theta_{\text{antenna\_mask}}$ default: $5.0^\circ$) | Blackout $> T_{\text{blackout,max}}$ (default: $12.0\text{ h}$) OR $f_{\text{dte}} < 0.5$ | Report Earth-disc visibility, longest blackout, and elevation margin. Default antenna elevation mask $\theta_{\text{antenna\_mask}} = 5.0^\circ$, minimum visibility fraction $\text{min\_dte\_fraction} = 0.5$, and max blackout $T_{\text{blackout,max}} = 12.0\text{ h}$. |

---

### Two-Stage Decision Pipeline (Team-Defined Decision-Support Model — Not NASA Flight Criteria)

1. **Stage 1: Configurable Hard Knockout Constraints (Veto)**  
   A site triggers a **NO-GO (Score = 0)** if a team-configured operational boundary is violated:
   * **Slope Constraint:** $\theta_{\text{slope}} > \theta_{\text{limit}}$ (default: $15^\circ$).
   * **Power/Thermal Constraint:** Longest unbroken shadow $T_{\text{dark}} > T_{\text{dark,max}}$ (default: $50.0\text{ h}$).
   * **Communications Constraint:** Cumulative Earth visibility $f_{\text{dte}} < \text{min\_dte\_fraction}$ (default: $0.5$) OR continuous DTE blackout $T_{\text{blackout}} > T_{\text{blackout,max}}$ (default: $12.0\text{ h}$).
   * *Transparency Rule:* Raw physical metrics (measured slope, hours of darkness, hours of blackout) must always be reported alongside any veto flag.

2. **Stage 2: Normalized Utility Functions ($S_i \in [0.0, 1.0]$)**  
   * **Slope Utility ($S_{\text{slope}}$):** Defined by team-configurable slope thresholds ($\theta_{\text{ideal}}$, $\theta_{\text{safe}}$, $\theta_{\text{limit}}$), with default values $\theta_{\text{ideal}} = 5.0^\circ$, $\theta_{\text{safe}} = 10.0^\circ$, $\theta_{\text{limit}} = 15.0^\circ$:
     $$S_{\text{slope}} = \begin{cases} 
     1.0 & \text{if } \theta \le \theta_{\text{ideal}} \\
     1.0 - 0.5 \left(\frac{\theta - \theta_{\text{ideal}}}{\theta_{\text{safe}} - \theta_{\text{ideal}}}\right) & \text{if } \theta_{\text{ideal}} < \theta \le \theta_{\text{safe}} \\
     0.5 - 0.5 \left(\frac{\theta - \theta_{\text{safe}}}{\theta_{\text{limit}} - \theta_{\text{safe}}}\right) & \text{if } \theta_{\text{safe}} < \theta \le \theta_{\text{limit}} \\
     0.0 & \text{if } \theta > \theta_{\text{limit}}
     \end{cases}$$
   * **Solar Utility ($S_{\text{solar}}$):** Illumination fraction penalized by longest continuous shadow duration $T_{\text{dark}}$ relative to operational limit $T_{\text{dark,max}}$ (default: $50.0\text{ h}$):
     $$S_{\text{solar}} = f_{\text{sun}} \times \max\left(0.0, \; 1.0 - \frac{T_{\text{dark}}}{T_{\text{dark,max}}}\right)$$
   * **DTE Communication Utility ($S_{\text{dte}}$):** Line-of-sight fraction ($\theta_{\text{Earth}} \ge \max(\theta_{\text{mask}}, \theta_{\text{antenna\_mask}})$, default $\theta_{\text{antenna\_mask}} = 5.0^\circ$) scaled by mean clearance above the terrain and antenna threshold $m_{\text{Earth}}(t) = \max\left(0, \; \theta_{\text{Earth}}(t) - \max(\theta_{\text{mask}}(t), \theta_{\text{antenna\_mask}})\right)$ relative to a reference elevation margin $\theta_{\text{margin\_reference}}$ (default: $5.0^\circ$):
     $$S_{\text{dte}} = f_{\text{dte}} \times \min\left(1.0, \; \frac{\overline{m_{\text{Earth}}}}{\theta_{\text{margin\_reference}}}\right)$$
     *(Rewarding actual clearance above the terrain/antenna threshold, rather than merely rewarding high raw Earth elevation).*

---

### Composite Viability Index ($S_{\text{composite}}$) & Status Classification

$$S_{\text{composite}} = 100 \times \left( w_{\text{slope}} \cdot S_{\text{slope}} + w_{\text{solar}} \cdot S_{\text{solar}} + w_{\text{dte}} \cdot S_{\text{dte}} \right)$$
*(Default team weights: $w_{\text{slope}} = 0.40, \; w_{\text{solar}} = 0.35, \; w_{\text{dte}} = 0.25$)*

* **Weight Normalization Constraint:** Validate that non-negative weights sum to 1.0 ($w_{\text{slope}} + w_{\text{solar}} + w_{\text{dte}} = 1.0$); otherwise the composite score loses its predictable 0–100 scale.
* **$S_{\text{composite}}$ weights and GO/CAUTION/NO-GO bands are team-defined ranking settings, not NASA compliance.**
* **Hard Constraints Shown Separately:** Any hard safety or communications constraint violation must be surfaced directly in the UI as a prominent veto badge and must not be masked or averaged out by the composite score.
* **Status Bands (Team Reference):**
  * **$80 \le S \le 100 \implies$ GO (Nominal Green):** Favorable alignment with team-selected baseline criteria.
  * **$50 \le S < 80 \implies$ CAUTION (Marginal Yellow):** Requires operational mitigation (e.g. moderate slopes or managed battery cycling).
  * **$S < 50$ or Hard Veto $\implies$ NO-GO (Critical Red):** Exceeds user-configured slope, prolonged shadow, or comms blackout thresholds.


## 10. Technical Implementation Blueprint

### 10.1 Architecture Boundary

The backend is the scientific source of truth. It computes ephemerides, terrain metrics, terrain-aware visibility, and team-configured decision metrics. The frontend visualizes those results and must not use WebGL shadows as the source of scientific visibility decisions.

```text
JPL Horizons + LOLA terrain products
        ↓
Backend: geometry, terrain, visibility, scoring
        ↓
Compact API responses
        ↓
Frontend: maps, terrain view, timeline, comparison UI
```

### 10.2 Candidate Site Model

Each candidate site stores a stable ID, display name, latitude, east-positive longitude, surface elevation reference (sampled from the Tier 2 DEM at load time), observer/antenna height above local terrain (default `2.0 m`), DEM product metadata, and DEM reference-frame information. Geographic coordinates are transformed into the DEM’s south-polar stereographic X/Y coordinates before terrain analysis.

**Seed Candidate Sites (Baseline Catalog):**

*(Distinguishes specific published LOLA illumination study points from broader Artemis candidate region / IAU feature centers; they are not interchangeable.)*

| Site ID (`id`) | Display Name (`name`) | Latitude (`lat_deg`) | Longitude (`lon_deg`, East+) | Reference Basis |
| :--- | :--- | :--- | :--- | :--- |
| `connecting_ridge_cr1` | Connecting Ridge (CR1) | `-89.4555` | `222.6192` | De Rosa et al. CR1 high-resolution LOLA illumination study point (distinct from Mazarico et al. 2011 Site SP-1 at `-89.45°`, `222.69°E`). |
| `peak_near_shackleton_007` | Peak Near Shackleton (Site 007) | `-88.811` | `123.64` | Published candidate site 007 in the Peak Near Shackleton region (Artemis illumination literature). |
| `malapert_massif` | Malapert Massif (Region Ref) | `-85.99` | `357.07` | Malapert Massif Artemis candidate region reference point; outside `87°S` 5 m mosaic (uses `80°S` 20 m DEM). |
| `mons_mouton` | Mons Mouton (IAU Center) | `-84.60` | `31.00` | IAU feature center for Mons Mouton plateau; outside `87°S` 5 m mosaic (uses `80°S` 20 m DEM). |

*(All 4 seed coordinates lie within $80^\circ\text{S}\text{--}90^\circ\text{S}$ and are covered by `LDEM_80S_80MPP_ADJ.TIF` and `LDEM_80S_20MPP_ADJ.TIF`; surface elevation `elevation_m` is read dynamically from the Tier 2 DEM rather than hardcoded.)*

**Coordinate roles:** Candidate sites are stored and exchanged as latitude/longitude. The backend transforms them into south-polar stereographic X/Y metres using the downloaded GeoTIFF's embedded CRS for distance, slope, terrain-window, and horizon-ray calculations, and normalizes Horizons topocentric azimuths ($\phi$) into DEM Grid Azimuths ($\phi_{\text{grid}} = (\phi + \lambda) \pmod{360^\circ}$ under the expected `Central_Meridian = 0.0`, `Standard_Parallel_1 = -90.0` configuration, subject to verification against the downloaded GeoTIFF metadata rather than hardcoding). X/Y coordinates are then mapped to DEM row/column indices only when reading raster values. The frontend normally receives local X/Y mesh positions and grid-normalized lighting azimuths for display, and does not require DEM row/column indices.

### 10.3 Ephemeris Pipeline

The backend requests Sun and Earth observer-table ephemerides via the JPL Horizons REST API (`https://ssd.jpl.nasa.gov/api/horizons.api`) for the selected site and time window using the following parameters:

- Sun target: `COMMAND='10'`
- Earth target: `COMMAND='399'`
- Ephemeris type & format: `MAKE_EPHEM='YES'`, `EPHEM_TYPE='OBSERVER'`, `format='json'`, `CSV_FORMAT='YES'`, `ANG_FORMAT='DEG'`
- Lunar topocentric observer: `CENTER='coord@301'`
- Coordinate type: `COORD_TYPE='GEODETIC'`
- Site coordinates: `SITE_COORD='east_longitude_deg, latitude_deg, altitude_km'` (where `altitude_km = (z_0 + h_obs) / 1000.0` relative to the $1737.4\text{ km}$ reference sphere)
- Azimuth/elevation output: `QUANTITIES='4'`
- Time bounds & uniform step: `START_TIME`, `STOP_TIME` in UTC (`YYYY-MM-DD HH:MM`), and `STEP_SIZE` (default `'1h'`, or `'30m'` / `'15m'`).

Horizons values represent an ideal geometric local horizon. Terrain-aware visibility is computed separately from the DEM.

### 10.4 Time Sampling and Caching

The backend uses a **fixed uniform time step** per analysis request (`step_hours = 1.0` default, with finer uniform presets such as `0.5` (`30m`) or `0.25` (`15m`) supported via `POST /api/analyze`), avoiding variable-step adaptive sampling so continuous darkness/blackout durations equal `consecutive_steps * step_hours` and timeline charts remain evenly spaced.

**Cache layout:** Store derived ephemeris time-series JSON files on disk in `backend/data/cache/horizons/` using deterministic filenames keyed by `site_id`, `target`, `start_utc`, `stop_utc`, `step`, and `altitude_km` (plus in-memory `lru_cache`), and store pre-cropped terrain packages in `backend/data/derived/`. Pre-populate Horizons JSON caches for all 4 seed candidate sites over a reference mission window so the application runs reliably offline during demos. The frontend does not own the scientific cache.

### 10.5 Terrain Data Strategy

Use two terrain scales:

- **Regional DEM:** Distant terrain, skyline, and horizon masking.
- **Local DEM:** Local slope, roughness, uncertainty, and rendered terrain.

Use published LOLA or LOLA-enhanced products selected for appropriate coverage, pixel scale, effective resolution, uncertainty, and baseline. Do not use the global CGI Moon displacement map for quantitative terrain analysis.

### 10.6 Efficient DEM Access

Read only bounded DEM windows around active candidate sites using the product’s CRS and COG/windowed access. For presentation reliability, prepare validated, pre-cropped terrain packages for shortlisted sites. Preserve NoData, count, uncertainty, scale/offset, and validity information from the source product.

### 10.7 Slope and Terrain-Hazard Metrics

Calculate the 2D terrain slope grid from elevation gradients in projected metres (`[row, col]` raster axes). Aggregate valid slope pixels within a $100\text{ m}$-radius landing-zone footprint around the site center, using the 90th-percentile slope (`slope_p90_100m_deg`) as the primary `slope_deg` MCDA input alongside supplementary center and mean values. Every slope result must report its analysis scale, effective DEM resolution, validity, and uncertainty. Slope is a regional/local terrain indicator, not a footpad-, boulder-, or landing-certification result.

### 10.8 Horizon Mask Construction

For each site, precompute a terrain skyline profile across $720$ azimuth bins at $0.5^\circ$ angular resolution. Each bin stores the greatest apparent terrain elevation angle found along that ray (`elevation_deg`), together with the horizontal ground distance along the lunar surface to the blocking terrain point (`distance_km`, not straight-line 3D slant range) and the raw DEM surface elevation at that blocking point (`obstacle_height_m`, in metres above the lunar reference sphere—not relative to the observer). Linearly interpolate between adjacent $0.5^\circ$ bins when evaluating target visibility, and validate ray range and sampling resolution through convergence testing.

Curvature correction is applied when calculating distant-terrain apparent elevation. The selected observer height, terrain product, maximum range, and azimuth resolution are retained as analysis metadata.

### 10.9 Terrain-Aware Sun Visibility

The required scientific calculation is site-level sunlight visibility over the selected mission window. For every timestamp, compare Sun elevation from Horizons with the selected site's DEM-derived terrain horizon at the Sun azimuth.

```text
Phase 1 default (use_upper_limb = False):
Site sunlit when: Sun center elevation > terrain horizon elevation

Optional upper-limb mode (use_upper_limb = True):
Site sunlit when: (Sun center elevation + 0.265°) > terrain horizon elevation
```

The backend returns a compact time series containing timestamp, Sun azimuth/elevation, terrain-horizon elevation, visibility state, and elevation margin. This time series drives illumination fraction, longest-darkness metrics, comparisons, and current-status UI.

Phase 1 uses solar-center visibility by default (`use_upper_limb = False`) and optionally supports upper-limb visibility (`+0.265°`), clearly labelled in the output; fractional solar-disc visibility is not implemented in Phase 1.

### 10.10 Local Lighting Visualization

R3F uses the backend-provided Sun direction (`sun_grid_az_deg`, `sun_el_deg`) to cast visual shadows across the decimated local terrain mesh for the selected site and slider time. These GPU shadows are strictly a visual explanation layer—scientific sunlight state comes exclusively from the backend site-level horizon model, and the backend does not compute per-pixel shadow mask textures.

### 10.11 Earth Visibility and Communications Proxy

Earth visibility is evaluated separately from communication availability.

```text
Earth geometric elevation
        ↓
Terrain-obscured Earth-disc visibility
        ↓
Team-defined antenna elevation mask
        ↓
Team-defined communications-availability proxy
```

Report Earth centre elevation, terrain margin, Earth-disc visibility state, antenna-mask margin, and blackout duration. This is a communications planning proxy, not a complete radio-frequency link budget.

**Implementation phases:** Phase 1 treats Earth-centre clearance above terrain and antenna mask as the DTE visibility proxy. Phase 2 optionally samples points across Earth’s apparent disc and reports the unobscured fraction. A visible Earth disc remains a planning proxy, not proof of an operational radio link or visibility of a specific ground station.

### 10.12 Decision Model

Implements the two-stage MCDA pipeline and default parameters defined in **Section 9** (exposed via the `config` object in `POST /api/analyze`, Section 10.13). Hard constraints (veto flags) and weighted ranking remain separate, and raw physical metrics are always returned alongside every score and violation.

### 10.13 API Data Contract

The frontend receives compact analysis results rather than full source DEMs by default. All endpoints are served under `/api` via FastAPI with Pydantic validation:

1. **`GET /api/sites`** — Returns the list of pre-configured candidate landing sites for the UI site picker:
   * **Response Fields (per site):** `id` (string), `name` (string), `lat_deg` (float), `lon_deg` (float, East-positive), `elevation_m` (float), `default_dem` (string), and `description` (string).

2. **`POST /api/analyze`** — Executes the scientific pipeline (Horizons ephemeris, DEM horizon masking, timeline evaluation, and MCDA scoring) for one or more candidate sites:
   * **Request Fields:**
     * `site_ids` (list of site ID strings)
     * `start_utc` (ISO-8601 UTC timestamp string)
     * `duration_days` (float, default `6.0`)
     * `step_hours` (float, default `1.0`)
     * `config`: `slope_ideal_deg` (`5.0`), `slope_safe_deg` (`10.0`), `slope_limit_deg` (`15.0`), `max_dark_hours` (`50.0`), `min_dte_fraction` (`0.5`), `max_blackout_hours` (`12.0`), `antenna_mask_deg` (`5.0`), `margin_reference_deg` (`5.0`), `observer_height_m` (`2.0`), `use_upper_limb` (`false`), and `weights` (`slope`: `0.40`, `solar`: `0.35`, `dte`: `0.25`).
   * **Response Fields (keyed by `site_id` under `results`):**
     * `site_id` (string)
     * `terrain_quality`: DEM product identifier, effective resolution, and data-validity summary.
     * `metrics`: `slope_deg`, `illumination_fraction`, `max_continuous_dark_hours`, `dte_fraction`, `max_continuous_blackout_hours`, and `mean_earth_margin_deg`.
     * `mcda`: `s_slope`, `s_solar`, `s_dte`, `composite_score` (0–100), `status` (`GO` / `CAUTION` / `NO-GO`), and `veto_flags` (`slope_exceeded`, `darkness_exceeded`, `dte_fraction_too_low`, `blackout_exceeded`).
     * `horizon_profile` (720 bins at `0.5°` spacing): `az_grid_deg`, `elevation_deg`, `distance_km` (horizontal ground distance along the lunar surface to the blocking terrain point), and `obstacle_height_m` (raw DEM elevation in metres at the blocking terrain point, not relative to the observer).
     * `timeline` (one record per timestamp): `timestamp_utc`, `sun_grid_az_deg`, `sun_el_deg`, `sun_horizon_el_deg`, `sun_margin_deg`, `is_sunlit`, `earth_grid_az_deg`, `earth_el_deg`, `earth_horizon_el_deg`, `earth_margin_deg`, `is_dte_available`, and `blockage_reason` (nullable string).

3. **`GET /api/sites/{site_id}/terrain-mesh`** — Requested only after opening a site’s 3D view:
   * **Query Parameters:** `window_km` (float, default `10.0`), `grid_size` (int, default `250`, producing a $250 \times 250$ vertex grid).
   * **Response Fields:** `site_id`, `window_km`, `grid_width`, `grid_height`, `center_elevation_m`, `elevations_m` (flat list of `grid_width * grid_height` floats relative to `center_elevation_m`), and `slopes_deg` (flat list of per-vertex slope floats for color mapping).

4. **`GET /api/health`** — Reports GeoTIFF DEM file availability on disk and JPL Horizons cache directory status.

### 10.14 Frontend Resolution Strategy

Use three visual fidelity levels:

- **Global Moon:** Moderate-detail sphere and NASA SVS CGI Moon assets for context and site selection.
- **Regional terrain:** Decimated mesh plus slope and terrain-quality overlays; R3F renders visual shadows from the current Sun direction.
- **Local inspection:** Bounded high-resolution terrain tiles loaded only for the selected site.

Scientific analysis can use a denser grid than the rendered mesh. For example, a 2,000 × 2,000 analysis grid may be decimated to a 250 × 250 or 500 × 500 WebGL mesh.

### 10.15 Frontend Performance Practices

Use level-of-detail switching, mesh decimation, bounded terrain tiles, frustum culling, instanced markers, and texture overlays. Rendered geometry is optimized independently from the analysis grid. Measure frame rate on the presentation device.

### 10.16 Explainable Results

The UI should make visibility decisions inspectable. For a selected blocked time, show the Sun or Earth direction, the relevant terrain-horizon ray, the highest blocking terrain point, and an explanation of the elevation comparison.

Example:

> Sun elevation: 0.8°. Terrain horizon: 1.1° at 12.4 km. Result: terrain-blocked.

### 10.17 Implementation Priority

Build in this order:

1. One candidate site and one verified Horizons query.
2. One local terrain window.
3. Horizon-profile generation.
4. Terrain-aware sunlight timeline.
5. Earth visibility and antenna-mask proxy.
6. Slope, uncertainty, and terrain-quality indicators.
7. Multi-site comparison.
8. Configurable decision model.
9. Global and local 3D visualization polish.

The project’s primary deliverable is an explainable terrain-aware planning tool; visual rendering communicates the analysis but does not replace it.