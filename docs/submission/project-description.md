# Project description

Text for the NASA Space Apps 2026 submission form. Three lengths of the same content.
The numbers come from `data/derived/validation.json` (which includes the 5 best-lit variants
added in #77), `data/derived/sites.json`, and the files named in the table at the end.

## Before pasting

State checked against `origin/main` at **2026-11-14 (`origin/main` at `5a5fd84`)**. Re-run
`git fetch origin` and `gh pr list --state open`, then confirm whether the deployed live
server runs with prepared NASA terrain maps (custom coordinates enabled) or the catalog-only
Docker image (returns HTTP 501 for custom coordinates).

- Open pull requests at draft time (not described as built here): `#93` (scoring boundary
  fix), `#94` (science doc clarifications), `#95` (Academy `A3` interactive panel steps:
  until it merges, 4 steps in lessons 1, 2 and 4 show Luna's preview and the real answer),
  and `#96` (custom-site queue position and validation fields).

CHECK: does the form allow links, line breaks or headings? The full description uses
plain headings; flatten them if the form does not.

---

## One sentence (29 words)

TrueSouth tells mission planners and learners whether a lunar landing date works: it scores sunlight and Earth contact at 20 catalog sites, 5 best-lit variants and custom coordinates.

## Short summary (about 100 words)

Landing near the Moon's south pole depends on narrow windows: the Sun skims the horizon, Earth rises and sets, and mountains block both. When a launch slips, planners must choose again. TrueSouth turns NASA's LOLA terrain and JPL Horizons positions into a skyline and an hourly record of the Sun and Earth across six years for 20 catalog sites, 5 nearby best-lit variants, and on-demand custom coordinates. Mission Control scores any date in five linked camera views—System view, Polar map, Slip Planner, Local terrain, and Lander's eye—plus Compare and exports; the Academy teaches the same physics in four interactive lessons. Our Sun and Earth directions match Horizons within 0.0061 degrees.

## Full description

### The problem

NASA's challenge says: "Hardware development challenges, launch delays, or other factors
often force mission planners to reconsider their original landing date and location." At the
Moon's south pole that choice is hard. The Sun stays within 1 to 2 degrees of the horizon,
Earth moves above and below it as the Moon wobbles, and mountains block both. A small change
in where or when to land can turn a workable mission into a dead one. NASA's Quickmap,
Moon Trek and JPL Horizons hold the information but "are often difficult for non-specialists
to use effectively for rapid scenario comparison."

### Who it is for

Mission planners who must decide quickly; educators and students; the public.

### What TrueSouth is

TrueSouth answers one question: "Where and when can this mission land?" It has two modes on
the same real data.

**Mission Control** is for planners. The user picks a mission profile (five presets named
after real missions, such as IM-2 Athena and the Artemis crewed landing, or custom limits),
selects up to eight sites from 20 catalog sites, 5 TrueSouth best-lit variants within 160 m of
sunlit peaks, or custom lunar coordinates computed on demand by the server, and sets a landing
date. Five linked camera views share one clock: the **System view** (3D Sun, Earth, Moon and
real stars), the **Polar map** (a flat south-polar map with NASA average overlays and a
pin-nudge readout), the **Slip Planner** (sites as status-and-score spots on the Moon above
six-year landing-date strips, with "Next GO" and before-and-after slip summaries), **Local
terrain** (the 20 km patch and 300 km surrounding terrain with illustrative shadows and a
scaled lander), and **Lander's eye** (2 m view with a collapsible 360-degree horizon chart
and "Why is it dark?" blocker attribution). A **Compare** floating window compares selected
sites side by side, highlights deciding metrics, exports CSV and JSON, and deep-links to
LROC QuickMap and NASA Moon Trek.

**The Academy** is for everyone else. Luna, a moon mascot, guides the learner through four
playable lessons (*Where's the Sun?*, *Mountains steal sunlight*, *The Moon is round*, *Phone
home*) to land Pip, a fictional lander, with KaTeX "Under the hood" formula cards backed by
pipeline-computed worked examples. The story is invented; the sites, terrain and positions
are real. Four steps that embed draggable horizon/skyline panels currently show Luna's
preview and the verified answer while the panel-interaction package is in review (`#95`);
lessons 5 to 8 are outside the hackathon scope.

### How it works

The heavy science runs in Python (`science/`). NASA's LOLA terrain gives each polar site a
skyline out to 300 km: the highest terrain in each of 1,440 compass directions. One pull
from JPL Horizons gives the Sun's and Earth's positions for every hour from 2026-01-01 to
2031-12-31 (52,584 hours). Together they give, for each site and hour, how much of the Sun's
and Earth's disc is above the skyline. The browser then scores any landing date and mission
profile in TypeScript (running a 6-year sweep in a Web Worker for the Slip Planner), with
every profile parameter tagged **sourced** (with a link) or **assumed**. Custom polar
coordinates (`POST /api/sites/custom`) run the same Python builder on the server in under a
minute when prepared terrain maps are mounted, or on a smooth sphere north of 60°S in
seconds.

### NASA data and tools it uses

- **JPL Horizons System:** Sun and Earth positions.
- **LOLA 80 m and 240 m polar terrain (Planetary Geodesy Data Archive):** skylines, slope, 3D ground.
- **LOLA average sunlight and Earth-visibility maps (60 m, 120 m) and 80 m slope map:** NASA's
  own answers, used for Polar map context overlays (labelled as NASA's 18.6-year averages)
  and validation comparisons.
- **NASA SVS 4720 and Blue Marble Next Generation:** Moon and Earth pictures, resized/split
  only and never retouched or AI-generated.
- **Yale Bright Star Catalogue (V/50, NASA/ADC):** 8,404 stars in the System view background.
- **LROC QuickMap and NASA Moon Trek:** confirmed deep links from the Compare window.
- **NASA mission documents:** the sourced values in the mission profiles.

### How we know it is right

We check against NASA's own data and publish every result on a live validation page (`/validation`).

- **Sun and Earth directions** match JPL Horizons' own site tables at all 20 catalog sites
  and every hour: 2,103,360 comparisons, largest sky-direction difference 0.0061 degrees
  (pass mark 0.02). The raw compass bearing differs by up to 0.083 degrees in 28 hours, all
  with the Sun almost overhead or underfoot at Apollo 11. We report it and do not gate it.
- **Terrain geometry and parity:** nine automated pipeline gates (G1 to G9) pass; TypeScript
  vs Python scoring parity across 58 cases (G10, max difference 0) and generated-type parity
  (G11) pass in the web test suite.
- **Sunlight** against NASA's 60 m map (19 polar entries: 14 catalog sites and 5 best-lit
  variants): 16 of 19 are within 8.2 percentage points. **Outside our 10-point mark:** Peak
  near Shackleton reads 24.0 points higher (60.2% against 36.1%), `de_gerlache_rim_best_lit`
  reads 23.2 points higher (69.6% against 46.4%), and `malapert_peak_best_lit` reads 26.0
  points higher (76.7% against 50.8%). On narrow peaks the reading varies strongly by pixel
  (e.g. NASA's neighbours around Peak near Shackleton run 44.7% to 58.0%, and NASA's 120 m map
  gives 60.1%), and NASA models 0 m surface height over 18.6 years against our 2 m height over
  six years.
- **Earth visibility** (19 polar entries): 18 of 19 are within 9.3 percentage points;
  `de_gerlache_rim_best_lit` reads 11.0 points higher (61.0% against 50.0%).
- **Slope** (18 `core80` entries): all 18 are within 1.3 degrees of NASA's 80 m slope map.
- **Skyline convergence (3 sunlit peaks):** 2 of 3 are within 0.05 degrees. **Outside our mark:**
  at Connecting Ridge, 405 of 1,440 skyline directions move by more than 0.05 degrees when
  the method's step is halved, by up to 0.36 degrees, caused by terrain within 0.56 km.

### What it does not do

It models the stay on the surface only: no launch, transit, descent or return. Many mission
limits are not published, so they are our estimates, tagged **assumed** on screen and never
shown as sourced. Best-lit variants are labelled **chosen by TrueSouth** as upper readings
and never win "best" in Compare. The 80 m map cannot see boulders, and our averages cover
six years against NASA's 18.6. Local terrain overlays (`T5`), the 3D ground blocker ring (`T4`),
close-up 5 m DEM meshes, official USGS Artemis region outlines, the sensitivity grid (`S11`),
and Academy lessons 5 to 8 (`A6`) are not in this build. In the catalog-only Docker build without
mounted NASA maps, custom-site computation returns HTTP 501. TrueSouth is a planning aid, not
flight certification.

---

## Sources for every number

| Number | File |
| :--- | :--- |
| 20 catalog sites, 5 best-lit variants (25 total); 52,584 hours; 1,440 bins; 300 km | `docs/site-catalog.md`; `data/derived/sites.json`; `docs/science.md` §1, §3.1, §5 |
| 2,103,360 comparisons; 0.0061 | `data/derived/validation.json`, gate G2 `samples`; G2 `measured` is 0.006007249 deg, full-sky max in `detail` is 0.00602921 deg (both round up to 0.0061) |
| 0.083 and 28 hours | `validation.json` G2 `detail`: raw maximum 0.0823560453 deg, 28 site-body hours |
| G1 to G9 pass; G10/G11 in web tests | `validation.json` G1–G9 `passed: true`, G10/G11 `null`; `web/src/lib/scoring/g10.test.ts` |
| 16 of 19 R1 within 8.2 pts; 3 outside (24.0, 23.2, 26.0 pts) | `validation.json` R1 rows (`shackleton_rim_best_lit` +0.0815; `peak_near_shackleton` +0.2404; `de_gerlache_rim_best_lit` +0.2317; `malapert_peak_best_lit` +0.2599) |
| 18 of 19 R2 within 9.3 pts; 1 outside (11.0 pts) | `validation.json` R2 rows (`malapert_peak_best_lit` +0.0929; `de_gerlache_rim_best_lit` +0.1098) |
| 18 of 18 R3 within 1.3 degrees | `validation.json` R3 rows (`shackleton_rim` −1.2331 deg) |
| 405 of 1,440; 0.36; 0.56 km | `validation.json` R5 row `connecting_ridge`, `explanation` |
| 18.6 years against six | `docs/validation.md`, "Why R1 and R2 are not hard gates" |
| Five presets | `docs/mission-profiles.md` |
| 8,404 stars | `DEVLOG.md` (Scene polish entry); `web/dev/build-stars.mjs` |
