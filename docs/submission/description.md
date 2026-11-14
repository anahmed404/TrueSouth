# Project description

Three lengths, ready to paste into the NASA Space Apps project form. Checked against `origin/main` (`5a5fd84`, 2026-11-14).

CHECK: before submitting, add your team's names and roles if the form asks for them, and remove any `CHECK` note once confirmed against the deployed build.

---

## Short (about 100 words)

TrueSouth is a lunar landing site navigator for the Moon's south pole, where the Sun skims the horizon and Earth rises and sets each month. Mission planners and students use two modes built on the same NASA JPL Horizons ephemeris and LOLA terrain data. **Mission Control** evaluates 20 catalog sites, 5 nearby best-lit variants, and custom lunar coordinates across six years in five linked views—System view, Polar map, Slip Planner, Local terrain, and Lander's eye—plus a Compare table and exports. **The Academy** teaches the orbital and terrain geometry step by step through four interactive lessons. Every assumption is tagged; validation results sit beside the tool.

---

## Medium (about 300 words)

Landing at the lunar south pole is a race against low angles. The Sun never rises high above the horizon; nearby crater rims cast long shadows across landing zones, and Earth dips below the horizon for days at a time, cutting direct radio links. Shifting a landing date by a week—or a landing point by 150 metres—can turn a working mission into a failure.

TrueSouth answers **"where and when can this mission land?"** across two linked modes built on real NASA data:

- **Mission Control** helps mission planners pick a preset profile (such as IM-2 Athena or Artemis), select up to eight catalog sites, TrueSouth best-lit variants, or custom coordinates computed on demand by our Python API, and test landing dates from 2026 to 2031. Five camera views—System view, Polar map, Slip Planner, Local terrain, and Lander's eye—share one clock with a timeline, countdown cards, and a "Why is it dark?" blocker readout. A Compare window scores sites side by side, highlights deciding metrics, exports CSV and JSON, and links straight to LROC QuickMap and NASA Moon Trek.
- **The Academy** turns the same physics into four guided, hands-on lessons with Luna, our moon mascot, and KaTeX "Under the hood" cards whose worked examples come straight from the science pipeline. (Lessons 5–8 and the sensitivity grid are outside our hackathon scope.)

Every profile rule is tagged **sourced** (with citation) or **assumed**. A live validation page (`/validation`) publishes all checks against JPL Horizons (2,103,360 sky-direction checks agreeing within 0.0061°) and 59 comparisons against NASA's own illumination and slope maps—showing disagreements openly alongside explanations.

---

## Long (full project page)

### The problem

Near the lunar south pole, the Moon's axis tilts only 1.54° to the ecliptic. The Sun circles the horizon below roughly 2–3°, so ridges and crater walls throw kilometre-long shadows. At the same time, lunar libration causes Earth to bob up and down near the horizon every month, interrupting direct-to-Earth radio contact. A site that works on 1 January can fail three weeks later with days of darkness and radio blackout.

### Who benefits

- **Mission planners and engineers** comparing candidate landing regions, tuning mission constraints (landing sun angle, dark-stretch limits, antenna elevation mask, slope), and checking how launch slips change go/no-go windows.
- **Educators, students, and the public** who want to understand *why* lunar south-pole sites are scarce rather than reading a static table.

### How it works

TrueSouth separates exact science computation from browser display:

1. **Science pipeline (`science/`) and API (`api/`):** Python computes site-centred local frames, terrain skylines out to 300 km from NASA LOLA elevation rasters, Sun and Earth angular disc fractions over 52,584 hourly steps (2026–2031), and 160 m/480 m slopes. Precomputed data covers 20 catalog sites (Artemis regions, published sunlit peaks, recent landers, and equatorial/far-side contrast sites) plus 5 TrueSouth `best_lit` variants within 160 m of sunlit peaks. The FastAPI backend (`POST /api/sites/custom`) computes new polar coordinates on real terrain in under a minute, or smooth-Moon sites north of 60°S in seconds (disabled with HTTP 501 in the catalog-only Docker build when terrain maps are not mounted).
2. **Mission Control (`/mission`):** A space-first interface floating over a WebGL scene (with a 2D map and still-picture fallback):
   - **System view:** 3D Moon, Earth, Sun, Yale Bright Star Catalogue starfield, sight-lines, and a true-scale distance toggle.
   - **Polar map:** Seamless transition from the 3D pole to a 2D south-polar stereographic map with NASA's 18.6-year average sunlight and Earth-visibility overlays, pin-nudge readouts across NASA's maps, and custom coordinate creation.
   - **Slip Planner:** A camera view over the south pole showing go/caution/no-go spots with score rings, optional NASA average-sunlight shading (explicitly labelled not for the user's date), and 6-year landing-date strips computed in a Web Worker (`useSweeps`).
   - **Local terrain:** A 20 km 80 m patch inside a 300 km curved-horizon apron with illustrative relief, cast shadows, and a scaled lander marker, always paired with a disclosure plate stating that the precomputed series is authoritative.
   - **Lander's eye:** A 2 m observer view looking toward the Sun or Earth, paired with a collapsible 360° horizon chart (`skyline.bin`), body tracks, and blocker attribution.
   - **Compare window, Share & Export:** Side-by-side comparison for up to 8 sites with deciding-row highlighting, plain-English summary, CSV/JSON downloads, shareable URLs, and confirmed links to LROC QuickMap and NASA Moon Trek.
3. **The Academy (`/academy`):** Lessons 1–4 (*Where's the Sun?*, *Mountains steal sunlight*, *The Moon is round*, *Phone home*) let learners predict, fill formulas, and tune sliders with live data. Four steps that embed draggable horizon/skyline panels currently show Luna's preview and the verified answer while the panel-interaction package finishes in review; lessons 5–8 remain outside the deadline scope.
4. **Validation (`/validation`):** Nine pipeline hard gates run automatically in `truesouth validate` and pass; the remaining two (TypeScript/Python scoring parity across 58 cases and generated-type parity) pass in the web test suite. Against JPL Horizons across 20 catalog sites, two bodies, and 52,584 hours (2,103,360 checks), sky-direction error never exceeds 0.0060° (shown on `/validation` rounded up to within 0.0061°; raw compass azimuth exceeds 0.02° at 28 near-zenith/nadir hours at Apollo 11 and is disclosed on the page). Across 59 comparisons against NASA PGDA average maps, NASA's LDSM slope map, and self-convergence checks, 54 fall within their mark and 5 outside-mark rows are published with full method explanations.

### NASA data we use and how

- **JPL Horizons** (`MOON_ME` / `MEAN_ME` DE421): hourly sub-solar and sub-Earth coordinates and distances (2026–2031), plus per-site ephemeris verification.
- **NASA LOLA / PGDA** (`LDEM_80S_80MPP_ADJ.TIF`, `LDEM_60S_240MPP_ADJ.TIF`): 80 m and 240 m south-polar digital elevation models for skylines, slopes, and 3D terrain meshes.
- **NASA LOLA / PGDA** 60 m and 120 m average solar illumination and Earth-visibility maps, plus the 80 m LDSM slope map: validation targets and Polar map context overlays.
- **NASA Scientific Visualization Studio (SVS 4720)** LROC 4K/8K colour and `ldem_4` height maps, and **NASA Earth Observatory** Blue Marble Next Generation: 3D globe textures (resized/split only; no NASA imagery is AI-generated or altered).
- **LROC QuickMap & NASA Moon Trek**: confirmed coordinate deep-links from Compare.
- **NASA / ADC Yale Bright Star Catalogue (V/50)**: 8,404 stars to magnitude 6.5 in the System view background.

### Honesty and known limits

- TrueSouth is a planning aid, not flight certification. Every profile parameter is tagged **sourced** or **assumed**, and best-lit variants are tagged **chosen by TrueSouth** as upper readings never marked "best" in Compare.
- At Connecting Ridge's published coordinate (CR1), TrueSouth's 6-year 80 m calculation gives 60.0% lit hours (65.7% any Sun), below Gläser et al. (2014)'s 19-year 92.27% any-Sun figure; our `connecting_ridge_best_lit` pixel 149 m away reaches 87.0% mean Sun (91.5% any Sun). Local 80 m pixel topography explains much of the difference, and both figures are published openly.
- Close-up 5 m DEM comparisons (`R4`), sensitivity grid checks (`R6`), Local terrain 3D blocker/slope overlays (`T4`/`T5`), official USGS Artemis region outlines (login-gated), and Academy lessons 5–8 (`A6`) are not included in this build.
- CHECK: confirm whether the live deployment mounts NASA terrain maps for live custom coordinates or runs the catalog-only Docker image (`501` on custom requests).

### AI tool usage (short statement)

AI coding assistants (Claude Code, Codex, Cursor, and Antigravity) wrote most of the code, tests, and documentation under human direction, with cross-provider numerical verification on science calculations and automated test suites. Human end-to-end review of several later packages remains recorded as pending in `DEVLOG.md`. No NASA data or NASA imagery is AI-generated; placeholder mascot SVGs (`web/src/components/luna/art/`), two start-screen portholes, and Lesson 3's curved-Moon schematic SVG were generated as code by Claude Code. Full details are in `docs/submission/ai-use.md` and `DEVLOG.md`.
