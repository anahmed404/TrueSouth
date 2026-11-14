# Project description

Text for the NASA Space Apps 2026 submission form, in three lengths. Every number comes
from a file named in the table at the end. Nothing here is claimed beyond what
[`../validation.md`](../validation.md) and the validation page show.

## Before pasting

State checked against `origin/main` at **69bb26e, 2026-11-14**. Everything described below
is merged there. The only open pull request at that time was #101, the production deploy
files; it is not merged, so no text here mentions a live site.

- CHECK (team lead): does the form allow links, line breaks or headings? The full
  description uses plain headings; flatten them if the form does not.
- CHECK (team lead): add the live demo link, the repository link and the video link
  only after the open items in [`links-checklist.md`](links-checklist.md) are settled.

---

## One sentence

TrueSouth tells mission planners and learners whether a lunar landing date works, by scoring sunlight and Earth contact at 20 catalog sites and 5 best-lit variants, or at coordinates you type.

## Short summary

Near the Moon's south pole the Sun stays within about two degrees of the horizon, Earth
rises and sets, and mountains block both. When a launch slips, planners must choose a new
date. TrueSouth computes a skyline and an hourly record of the Sun and Earth for six years
from NASA's LOLA terrain and JPL Horizons positions, for 20 catalog sites, 5 best-lit
variants and custom coordinates. Mission Control scores any landing date and mission
profile in five linked views and a Compare window. The Academy teaches the same physics in
four lessons. Our Sun and Earth directions match Horizons within 0.0061 degrees.

## Full description

### The problem

NASA's challenge says: "Hardware development challenges, launch delays, or other factors
often force mission planners to reconsider their original landing date and location." At
the Moon's south pole that choice is hard. The Sun stays within about two degrees of the
horizon, Earth moves above and below it as the Moon wobbles, and mountains block both. A
small change in where or when to land can turn a workable mission into a dead one. NASA's
Quickmap, Moon Trek and JPL Horizons hold the information but "are often difficult for
non-specialists to use effectively for rapid scenario comparison."

### Who it is for

Mission planners who must decide quickly, educators and students, and the public.

### What TrueSouth is

TrueSouth answers one question: "Where and when can this mission land?" It has two modes
on the same real data.

**Mission Control** is for planners. You pick a mission profile (five presets named after
real missions, such as IM-2 Athena and the Artemis crewed landing, or your own limits),
select up to eight sites, and set a landing date. The sites come from 20 catalog sites, 5
best-lit variants that TrueSouth chose within 160 m of sunlit peaks, or coordinates you
type. Five camera views share one clock:

- **System view:** the Moon, Earth and Sun in 3D with real stars. It turns freely over
  both poles.
- **Polar map:** a flat map of the south pole for picking and nudging sites. NASA's
  average sunlight and Earth-visibility maps can be shown, labelled as 18.6-year averages.
  The rest of the Moon is drawn around the detailed square, which has a border.
- **Slip Planner:** your sites as status-and-score spots on the Moon, above a strip per
  site showing six years of landing dates. After a slip, a plate gives the before-and-after
  summary. "Next GO" jumps to the next day the focused site works.
- **Local terrain:** the 20 km patch around a site and the terrain beyond it to the
  horizon, with relief, drawn shadows and a ground texture. A small lander, Pip, stands
  at the site, drawn larger than life and labelled "Lander not to scale". A plate gives the
  computed answer and says it is right wherever the drawing differs.
- **Lander's eye:** the 360° view from 2 m above the ground, looking toward Earth or the
  Sun. A horizon chart opens from a "Horizon chart" button, and "Why is it dark?" names the
  terrain that hides the Sun.

A **Compare** window puts the selected sites side by side, marks the row that decides
between them, exports CSV and JSON, and links each site to LROC QuickMap and NASA Moon
Trek. A **Share** button copies a link to the whole scenario.

Custom coordinates work like catalog sites. Type a latitude and east longitude under
"Enter coordinates" in "Add site", or click the Polar map and press "Compute this site".
The server builds the site from NASA's real terrain at 80 m (south of 80°S) or 240 m (80°S
to 60°S), or on a smooth Moon north of 60°S. The rail shows the job's queue position and
plain error messages. On our development machine one 80 m site took 44 to 49 seconds
to compute. A server without the prepared NASA maps says custom sites are not available.

**The Academy** is for everyone else. Luna, a moon mascot, guides the learner through four
lessons (*Where's the Sun?*, *Mountains steal sunlight*, *The Moon is round*, *Phone
home*) to land Pip, a fictional lander. Steps include dragging the Sun or Earth through a
month, sketching a skyline, filling in a formula, tuning a slider and finding the bug in a
calculation. Each lesson has an "Under the hood" card with the real formula and worked
numbers from the pipeline. The story is invented; the sites, terrain and positions are
real. Lessons 5 to 8 are shown as "Not written yet" and are outside the hackathon scope.

### How it works

The science runs in Python (`science/`). NASA's LOLA terrain gives each polar site a
skyline out to 300 km: the highest terrain in each of 1,440 compass directions. One pull
from JPL Horizons gives the Sun's and Earth's positions for every hour from 2026-01-01 to
2031-12-31 (52,584 hours). Together they give, for each site and hour, how much of the
Sun's and Earth's disc is above the skyline. The browser only scores those stored series
against the mission profile, in TypeScript. A six-year sweep for the Slip Planner runs in a
Web Worker. Every profile value is tagged **sourced** (with a link) or **assumed**. The
3D shadows are decoration: lit or dark always comes from the Python series.

### NASA data and tools it uses

- **JPL Horizons System:** Sun and Earth positions.
- **LOLA 80 m and 240 m polar terrain (Planetary Geodesy Data Archive):** skylines, slope,
  the 3D ground.
- **LOLA average sunlight and Earth-visibility maps (60 m, 120 m) and 80 m slope map:**
  NASA's own answers, used for Polar map overlays and for validation.
- **NASA SVS 4720 and Blue Marble Next Generation:** Moon and Earth pictures, resized or
  split only, never retouched or AI-generated.
- **Yale Bright Star Catalogue (V/50, NASA/ADC):** 8,404 stars in the System view.
- **LROC QuickMap and NASA Moon Trek:** deep links from the Compare window.
- **NASA mission documents:** the sourced values in the mission profiles.

### How we know it is right

We check against NASA's own data and publish every result, good or bad, on the app's
validation page.

- **Sun and Earth directions** match JPL Horizons' own site tables at all 20 catalog sites
  and every hour: 2,103,360 comparisons, largest difference on the sky 0.0061 degrees
  (pass mark 0.02). The raw compass bearing differs by more than 0.02 degrees in 28 hours,
  by up to 0.083 degrees, all for the Sun almost overhead or underfoot at Apollo 11, where
  a bearing means nothing. We report it and do not gate it.
- **Hard gates:** nine pipeline gates (G1 to G9) pass in `validation.json`. Two more are
  checked in the web tests: TypeScript scoring against the Python reference on 76 shared
  cases (G10), and the generated types being up to date (G11).
- **Sunlight** against NASA's 60 m map (19 polar entries: 14 catalog sites and 5 best-lit
  variants): 16 of 19 are within 8.2 percentage points. **Three are outside our 10-point
  mark:** Peak near Shackleton reads 24.0 points higher (60.2% against 36.1%), the best-lit
  variant at de Gerlache rim 23.2 points higher (69.6% against 46.4%), and the best-lit
  variant at Malapert Massif peak 26.0 points higher (76.7% against 50.8%). On narrow
  peaks NASA's own neighbouring pixels differ a lot (around Peak near Shackleton they run
  from 44.7% to 58.0%, and NASA's 120 m map gives 60.1%). NASA also models an observer on
  the surface over 18.6 years, and we use 2 m up over six.
- **Earth visibility** (19 polar entries): 18 are within 9.3 points. The best-lit variant at
  de Gerlache rim reads 11.0 points higher (61.0% against 50.0%).
- **Slope** (18 entries on the 80 m map): all within 1.3 degrees of NASA's slope map.
- **Skyline convergence** (three sunlit peaks): two are within 0.05 degrees. At Connecting
  Ridge, 405 of 1,440 directions move by more than 0.05 degrees when the method's step is
  halved, by up to 0.36 degrees, because of terrain within 0.56 km.

### What it does not do

It models the stay on the surface only: no launch, transit, descent or return. Many mission
limits are not published, so they are our estimates, tagged **assumed** on screen and never
shown as sourced. Best-lit variants are labelled "chosen by TrueSouth", are upper readings
and never win "best" in Compare. The 80 m map cannot see boulders, and our averages cover
six years against NASA's 18.6. Not in this build: a blocker ring and slope or height colour
overlays on the 3D ground, close-up 5 m terrain, official Artemis region outlines on the
Polar map, the "compute for my dates" sensitivity grid, final art for Luna (her drawings
are placeholders), and Academy lessons 5 to 8. TrueSouth is a planning aid, not flight
certification.

---

## Sources for every number

| Number | File |
| :--- | :--- |
| 20 catalog sites, 5 best-lit variants within 71 to 149 m (25 total); 52,584 hours; 1,440 bins; 300 km | `data/derived/sites.json` (`variant_of`, `offset_m`); `data/derived/manifest.json`; `docs/site-catalog.md`; `docs/science.md` §1, §3.1, §5 |
| Five presets; only duration is sourced for IM-2 Athena | `docs/mission-profiles.md`; `data/derived/profiles.json` |
| 2,103,360 comparisons (20 sites × 2 bodies × 52,584 hours); 0.0061 | `data/derived/validation.json`, gate G2 `samples`. G2 `measured` is 0.00600725; the largest full-sky difference in `g2_diagnostics` is 0.00602921. The page rounds a largest difference up, so it reads 0.0061 |
| 0.083 degrees and 28 hours | `validation.json` `g2_diagnostics`: `raw_azimuth_max_deg` 0.0823560, `raw_azimuth_hours_over_limit` 28, at Apollo 11. The page rounds up; `docs/validation.md` says 0.082 |
| G1 to G9 pass; G10 and G11 `null` in the file | `validation.json` `gates` |
| 76 shared cases | `web/src/lib/scoring/__fixtures__/scoring_cases.json` (`cases`) |
| 16 of 19 within 8.2 points; 3 outside (24.0, 23.2, 26.0) | `validation.json` comparisons `R1` (19 rows, 5 of them `_best_lit`); largest inside is `shackleton_rim_best_lit` at 8.15 |
| 18 of 19 within 9.3 points; 1 outside (11.0) | `validation.json` `R2`; largest inside is `malapert_peak_best_lit` at 9.29 |
| 18 of 18 within 1.3 degrees | `validation.json` `R3`; largest is `shackleton_rim` at 1.233 |
| 2 of 3 within 0.05; 405 of 1,440; 0.36; 0.56 km | `validation.json` `R5`; the Connecting Ridge `explanation` |
| 18.6 years against six; 2 m up | `docs/validation.md`, "Why R1 and R2 are not hard gates"; `validation.json` explanations |
| 44 to 49 seconds for an 80 m custom site | `DEVLOG.md`, S10b entry: 48.987 s and 43.445 s at Connecting Ridge on the development machine |
| Highest Sun about two degrees | `docs/science.md` §3.4: 2.08° estimated, 2.10° the highest in the stored series at Connecting Ridge |
| 8,404 stars | `DEVLOG.md`, Scene polish entry; `web/dev/build-stars.mjs` |
