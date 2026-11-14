# Challenge objectives mapped to TrueSouth

One line for each objective and consideration on NASA's challenge page
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).
The wording of each objective is the challenge's, as recorded in
[`../challenge.md`](../challenge.md) (read from NASA's page on 2026-11-13).

## Update before submitting

States below were checked against `origin/main` and the open pull requests at
**2026-11-14 (`origin/main` at `5a5fd84`)**. A state is **built** only if its code is merged on `origin/main`. It is
**in review** if the work is open in a pull request. It is **not built** if neither is true.

Run `git fetch origin`, `git log --oneline -20 origin/main` and `gh pr list --state open`,
then update these lines if any open PR merges before submission:

| Pull request | Title | Effect if merged |
| :--- | :--- | :--- |
| `#93` | S2b: stable scoring at exact boundaries | Numerical boundary refinement; no visible UI wording change |
| `#94` | Clarify science conventions and implementation limits | Documentation only |
| `#95` | Academy A3: drag-body and draw-skyline steps (lessons 1, 2 and 4 complete) | Replaces Luna's preview holding form on 4 interactive panel steps in lessons 1, 2 and 4 |
| `#96` | Expose custom-site queue status and G2 diagnostics | Exposes queue position and raw-azimuth G2 diagnostic fields |

Out of scope for the deadline (remains **not built**): `S11` / `T8` sensitivity grid ("compute for my dates"), `A6` Academy lessons 5 to 8, `A10` Luna's final art, `T4` 3D ground blocker ring, `T5` Local terrain slope/height overlays and 5 m close-up mesh, and official USGS Artemis region outlines (login-gated).

CHECK: open the deployed app once and confirm whether custom coordinates are enabled on the live server (requires prepared NASA terrain maps mounted) or return the catalog-only `501` notice.

## Objectives

"Every objective on the page is offered as 'you may consider'" ([`../challenge.md`](../challenge.md)).

| # | Objective (the challenge's words) | TrueSouth feature | Where to see it in the app | State |
| :--- | :--- | :--- | :--- | :--- |
| 1 | A curated list of notable sites: Apollo, CLPS targets, other commercial missions, other countries' programmes | The site catalog: 20 sites in four groups (Artemis candidate regions, published high-sunlight points, recent landers, contrast sites such as Apollo 11) plus 5 TrueSouth best-lit variants ([`../site-catalog.md`](../site-catalog.md)) | Mission Control, "Selected sites" rail, "+ Add site" | **Built** (`#77` variants merged) |
| 2 | Custom lunar coordinates | Typed latitude and east longitude computed on demand by the Python/FastAPI server from real polar terrain (`core80`/`wide240`) or on the smooth Moon (`sphere`) | Mission Control, "+ Add site" → "Your own coordinates"; Polar map, click empty ground → "Compute this site" | **Built** (`#80` server, `#92` web; catalog-only Docker answers `501`) |
| 3 | Side-by-side or sequential comparison of sites | The "Selected sites" rail lists every selected site's verdict; the **Compare** floating window compares up to 8 sites row by row with deciding-row highlighting, generated summary, CSV/JSON export, and confirmed NASA links | Mission Control, "Selected sites" rail; view bar → "Compare" | **Built** (`#90` merged; optional per-column timeline/skyline/nearby-date strips deferred) |
| 4 | Landing dates and times; how conditions change across lunar days and seasons | The landing-date control (`<` / `>`, date picker, "Slip +7 d", "+14 d", "Next GO"); six years of hourly data; the **Slip Planner** view with status-and-score spots on the Moon and 6-year landing-date strips ("Any site" + per-site strips) | Mission Control, bottom "Timeline" header; view bar → "Slip Planner" | **Built** (`#83`, `#87` merged) |
| 5 | Sun and Earth positions relative to the horizon at a site and date | Hourly series of Sun and Earth azimuth, elevation, disc fraction and clearance ([`../science.md`](../science.md) §3 to §7), shown in the 3D **Lander's eye** view (2 m height, "Look toward" Earth/Sun) and the collapsible SVG horizon chart | Mission Control, view bar → "Lander's eye", foot row → "Horizon chart" | **Built** (`#75`, `#78`, `#86` merged; close-up 5 m mesh not built) |
| 6 | Time remaining before sunset or Earthset | The Sun and Earth countdown cards: "Sunset in", "Earthset in" (and "Sunrise in", "Earthrise in") | Mission Control, "Timeline" panel, the two cards at its right | **Built** |
| 7 | Solar elevation angle, duration of sunlight, Earth visibility windows | Elevation and clearance on the countdown cards; lit and link bands on the timeline; mission-window metrics (longest dark stretch, longest blackout) and GO, CAUTION or NO-GO verdict ([`../science.md`](../science.md) §9, §10) | "Timeline"; the focused-site panel at the right | **Built** |
| 8 | 2D maps, 3D surface views or other representations | **System view** (3D Sun, Earth, Moon, Yale stars), **Polar map** (2D south-polar relief canvas with NASA average overlays and pin nudge), **Slip Planner** (camera view on the south pole with 2D map fallback when 3D is off), **Local terrain** (20 km 80 m patch + 300 km curved-horizon apron with illustrative relief, cast shadows, and Pip lander), **Lander's eye** (3D horizon + collapsible chart) | View bar: "System view", "Polar map", "Slip Planner", "Local terrain", "Lander's eye" | **Built** (`#75`, `#88`, `#89`, `#87`, `#91` merged; `T4` blocker ring on 3D ground and `T5` slope/height overlays & close-up 5 m mesh not built) |
| 9 | Animations or timelines over a lunar day or several days | The timeline with scrubber and Play (`6 h/s`); the 3D scene and Lander's eye update with the clock | "Timeline" at the bottom; Play button | **Built** |
| 10 | Serving planners, educators and the public | Mission Control for planners; the **Academy** lessons 1 to 4 playable with Luna and KaTeX "Under the hood" cards ([`../academy/overview.md`](../academy/overview.md)); plain explanations behind every term; the validation page (`/validation`) | Start screen ("Mission Control" and "Academy"); info icons beside terms; `/validation` | **Built** for Mission Control, Validation (`#79`), and Academy lessons 1–4 (`#81`, `#74`, `#76`); 4 panel steps in preview until `#95` merges; lessons 5–8 out of scope |

## Considerations

| Consideration (from the challenge) | TrueSouth feature | Where to see it | State |
| :--- | :--- | :--- | :--- |
| Ephemeris from the JPL Horizons System, or pre-computed | One pull from Horizons for the whole Moon and six years, checked against Horizons' own site tables (gate G2, within 0.0061° across 2,103,360 checks) ([`../decisions/0004-one-global-ephemeris.md`](../decisions/0004-one-global-ephemeris.md)) | Behind every view; validation numbers in `data/derived/validation.json` and `/validation` | **Built** |
| LOLA topography for realistic surfaces and accurate horizons | NASA's 80 m and 240 m LOLA maps; a skyline for every site out to 300 km ([`../science.md`](../science.md) §5) | "Lander's eye"; "Local terrain"; "Polar map" | **Built** |
| No atmosphere: the horizon is the terrain and the edge of the lunar sphere | Terrain blockers plus the curve of the Moon's horizon ([`../science.md`](../science.md) §4) | "Lander's eye"; Academy Lesson 3 ("The Moon is round") | **Built** |
| Show solar elevation prominently | The Sun countdown card, Lander's eye horizon readout, and the "Why is it dark?" card | "Timeline"; "Lander's eye" | **Built** |
| Rapid comparison of many site and date combinations | "Selected sites" rail; **Compare** window (up to 8 sites); **Slip Planner** 6-year sweep in a Web Worker (`useSweeps`) | "Selected sites" rail; "Compare"; "Slip Planner" | **Built** |
| Communicate time before sunset or Earthset clearly | The two countdown cards | "Timeline" | **Built** |
| Make the difference from Earth apparent | 3D System view where the Sun circles the horizon; Academy Lesson 1 ("Where's the Sun?") | "System view"; `/academy/l1_sun` | **Built** |
| Help users see why small location or date changes matter | "Slip +7 d", "+14 d", "Next GO", Slip Planner before/after summary; **Polar map** pin-nudge readout on NASA maps; **nearby range** and **best-lit variant** (`#77`, `#92`) for sunlit peaks ([`../decisions/0012-sunlit-peaks-keep-their-listed-point.md`](../decisions/0012-sunlit-peaks-keep-their-listed-point.md)) | Timeline header; "Slip Planner"; "Polar map" (drag focused pin); focused-site panel; "Compare" | **Built** (`S11`/`T8` "compute for my dates" sensitivity grid out of scope for deadline) |
| Account for real topography | Skylines from LOLA terrain; 59 comparisons against NASA's average-sunlight, Earth-visibility, and slope maps plus self-convergence ([`../validation.md`](../validation.md)) | Validation page, `/validation` | **Built** |
| Earth's libration and the Moon's orbital variations | In the Horizons data, hour by hour for six years, so Earth bobs on the timeline and in Lander's eye | "Timeline", Earth band; "Lander's eye"; Academy Lesson 4 | **Built** |
| Steep slopes and deep craters | Slope for each polar site from the 80 m map with baseline stated ([`../science.md`](../science.md) §8); 20 km terrain mesh + 300 km apron with relief shading | Focused-site panel ("Slope" rule); "Compare"; "Local terrain" | **Built** (`T5` slope/height colour overlays and 5 m close-up mesh not built) |
| Help science and engineering teams coordinate; respond to schedule changes | Mission profiles with every limit tagged **sourced** or **assumed**; URL-synced **Share** link; CSV & JSON export; landing-date slip controls & Slip Planner | Top bar ("Mission profile", "Share"); "Compare" ("Export CSV", "Export JSON"); "Slip Planner" | **Built** (`#90` merged) |
| Serve as an educational tool | The Academy (lessons 1–4 playable, KaTeX cards, `explain.ts` glossary on every term) | `/academy`; info icons across Mission Control | **Built** for lessons 1–4 (4 panel steps in preview until `#95` merges; lessons 5–8 out of scope) |

## Resources the page lists

| Resource | How TrueSouth uses it | State |
| :--- | :--- | :--- |
| [Quickmap](https://quickmap.lroc.asu.edu/) and [Moon Trek](https://trek.nasa.gov/moon/) | Confirmed coordinate deep links from the Compare window's "Open in NASA's maps" row (`web/src/features/mission-control/share/nasa-links.ts`) | **Built** (`#90` merged) |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | The source of every Sun and Earth position | **Built** |
| Canadian Space Agency, [Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Listed by the challenge. TrueSouth does not use it. | Not used |

## What the challenge does not ask for

Launch windows, trajectories, the descent, the ascent and the trip home. TrueSouth models
none of them ([`../challenge.md`](../challenge.md)).
