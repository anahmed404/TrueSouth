# Challenge objectives mapped to TrueSouth

One line for each objective and consideration on NASA's challenge page
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).
The wording of each objective is the challenge's, as recorded in
[`../challenge.md`](../challenge.md) (read from NASA's page on 2026-11-13).

## How to read the state column

States were checked against the code on `origin/main` at **69bb26e, 2026-11-14**. **Built**
means the feature is merged there and its entry in [`../../DEVLOG.md`](../../DEVLOG.md) says
"verified" (its checks passed), or its spec says it is as built. A human has not yet used
most of it line by line (see [`ai-use.md`](ai-use.md)). Where part of an objective is not in
the build, the row says so.

[`../challenge.md`](../challenge.md) still shows older states for some rows (Compare, the
Slip Planner and the Lander's eye are marked "not built" there). It is outside this
package; this file follows the code.

Not in this build, and out of scope for the deadline: the "compute for my dates"
sensitivity grid (`S11`, `T8`), Academy lessons 5 to 8 (`A6`), Luna's final art (`A10`),
a blocker ring and slope or height colour overlays on the 3D ground (`T4`, `T5`), and
official Artemis region outlines on the Polar map (they need a ScienceBase
login; the app holds region names only).

CHECK (team lead): which server the judges will use. Without the prepared NASA terrain
maps, the "Enter coordinates" form says "Not available on this server".

## Objectives

"Every objective on the page is offered as 'you may consider'" ([`../challenge.md`](../challenge.md)).

| # | Objective (the challenge's words) | TrueSouth feature | Where to see it in the app | State |
| :--- | :--- | :--- | :--- | :--- |
| 1 | A curated list of notable sites: Apollo, CLPS targets, other commercial missions, other countries' programmes | The site catalog: 20 sites in four groups (Artemis candidate regions, published high-sunlight points, recent polar landers, contrast sites such as Apollo 11) plus 5 TrueSouth best-lit variants ([`../site-catalog.md`](../site-catalog.md)) | Mission Control, "Selected sites" rail, "Add site" | **Built** |
| 2 | Custom lunar coordinates | A typed latitude and east longitude, or a click on the Polar map, computed on demand by the server from real 80 m or 240 m terrain, or on a smooth Moon north of 60°S. The rail shows queue position and plain errors. The site then works like a catalog site and stays in the shared link | "Add site" → "Enter coordinates"; Polar map, click empty ground → "Compute this site" | **Built**; needs a server with the prepared NASA maps |
| 3 | Side-by-side or sequential comparison of sites | The "Selected sites" rail lists every selected site's verdict. The **Compare** window puts up to 8 sites in one table, marks the best value in each row and the row that decides between them, exports CSV and JSON, and links each site to QuickMap and Moon Trek | Rail; view bar → "Compare" | **Built**. Per-site timeline, skyline and nearby-date strips in Compare were left out |
| 4 | Landing dates and times; how conditions change across lunar days and seasons | The landing date control (day buttons, date and hour picker, "Slip +7 d", "+14 d", "Next GO"); six years of hourly data; the **Slip Planner** view, with a status-and-score spot per site on the Moon and a six-year strip per site | Landing date at the left of the bottom strip; view bar → "Slip Planner" | **Built** |
| 5 | Sun and Earth positions relative to the horizon at a site and date | Hourly Sun and Earth azimuth, elevation, disc fraction and clearance ([`../science.md`](../science.md) §3 to §7), shown in **Lander's eye** (2 m above the ground, "Look toward" Earth or The Sun) and its "Horizon chart" | View bar → "Lander's eye"; "Horizon chart" button | **Built** |
| 6 | Time remaining before sunset or Earthset | Two countdown cards: "Sunset in", "Earthset in" (and "Sunrise in", "Earthrise in") | Bottom strip, the two cards on its right | **Built** |
| 7 | Solar elevation angle, duration of sunlight, Earth visibility windows | Elevation on the cards; lit and link bands on the timeline; window metrics (longest dark stretch, longest blackout) and the GO, CAUTION or NO-GO verdict ([`../science.md`](../science.md) §9, §10) | Bottom strip; the "Focused site" panel | **Built** |
| 8 | 2D maps, 3D surface views or other representations | **System view** (3D Moon, Earth, Sun, real stars; turns freely over the poles), **Polar map** (flat south-pole map with NASA average overlays; the rest of the Moon around the detailed square), **Slip Planner**, **Local terrain** (relief, drawn shadows, texture, Pip), **Lander's eye** (3D horizon plus chart) | View bar: "System view", "Polar map", "Slip Planner", "Local terrain", "Lander's eye" | **Built** (not built: blocker ring and colour overlays on the 3D ground, close-up 5 m terrain) |
| 9 | Animations or timelines over a lunar day or several days | The timeline with a scrubber and Play; the 3D scene and Lander's eye follow the clock | Bottom strip | **Built** |
| 10 | Serving planners, educators and the public | Mission Control for planners; the **Academy** for learners (lessons 1 to 4 with Luna and "Under the hood" cards, [`../academy/overview.md`](../academy/overview.md)); a plain explanation behind every term; the validation page | Start screen ("Mission Control", "Academy", "How we know it's right") | **Built** for lessons 1 to 4. Lessons 5 to 8 show "Not written yet" |

## Considerations

| Consideration (from the challenge) | TrueSouth feature | Where to see it | State |
| :--- | :--- | :--- | :--- |
| Ephemeris from the JPL Horizons System, or pre-computed | One pull from Horizons for the whole Moon and six years, checked against Horizons' own site tables (gate G2: largest difference 0.0061° in 2,103,360 comparisons) ([`../decisions/0004-one-global-ephemeris.md`](../decisions/0004-one-global-ephemeris.md)) | Behind every view; validation page | **Built** |
| LOLA topography for realistic surfaces and accurate horizons | NASA's 80 m and 240 m LOLA maps; a skyline for every polar site out to 300 km ([`../science.md`](../science.md) §5) | "Lander's eye"; "Local terrain"; "Polar map" | **Built** |
| No atmosphere: the horizon is the terrain and the edge of the lunar sphere | Terrain blockers plus the dip of the curved Moon's horizon ([`../science.md`](../science.md) §4) | "Lander's eye"; Academy lesson 3 ("The Moon is round") | **Built** |
| Show solar elevation prominently | The Sun countdown card, the Lander's eye horizon chart, and "Why is it dark?" | Bottom strip; "Lander's eye" | **Built** |
| Rapid comparison of many site and date combinations | "Selected sites" rail; **Compare** (up to 8 sites); the Slip Planner's six-year sweep, run in a Web Worker | Rail; "Compare"; "Slip Planner" | **Built** |
| Communicate time before sunset or Earthset clearly | The two countdown cards | Bottom strip | **Built** |
| Make the difference from Earth apparent | The System view, where the Sun circles the horizon; Academy lesson 1 ("Where's the Sun?") | "System view"; `/academy/l1_sun` | **Built** |
| Help users see why small location or date changes matter | "Slip +7 d", "+14 d", "Next GO"; the Slip Planner's before-and-after plate; the Polar map's pin nudge; the **nearby range** and **best-lit variant** for sunlit peaks ([`../decisions/0012-sunlit-peaks-keep-their-listed-point.md`](../decisions/0012-sunlit-peaks-keep-their-listed-point.md)) | Landing date row; "Slip Planner"; "Polar map"; "Focused site" panel | **Built**. The "compute for my dates" grid is not |
| Account for real topography | Skylines from LOLA terrain; 59 reported comparisons against NASA's average-sunlight, Earth-visibility and slope maps and against ourselves, 5 outside their marks and published ([`../validation.md`](../validation.md)) | `/validation` | **Built** |
| Earth's libration and the Moon's orbital variations | In the Horizons data hour by hour for six years, so Earth bobs on the timeline and in Lander's eye | Timeline; "Lander's eye"; Academy lesson 4 ("Phone home") | **Built** |
| Steep slopes and deep craters | Slope for each polar site from the 80 m map, with its baseline stated ([`../science.md`](../science.md) §8); relief and drawn shadows in Local terrain | "Focused site" panel ("Slope"); "Compare"; "Local terrain" | **Built**. Slope and height colour overlays on the 3D ground are not |
| Help science and engineering teams coordinate; respond to schedule changes | Mission profiles with every limit tagged **sourced** or **assumed**; the **Share** link; CSV and JSON export; slip controls and the Slip Planner | Top bar ("Mission profile", "Share"); "Compare" ("Export CSV", "Export JSON") | **Built** |
| Serve as an educational tool | The Academy (lessons 1 to 4, KaTeX cards, a plain-language entry for every term) | `/academy`; the info icons in Mission Control | **Built** for lessons 1 to 4 |

## Resources the page lists

| Resource | How TrueSouth uses it | State |
| :--- | :--- | :--- |
| [Quickmap](https://quickmap.lroc.asu.edu/) and [Moon Trek](https://trek.nasa.gov/moon/) | Deep links to each site from the Compare window's "Open in NASA’s maps" row (`web/src/features/mission-control/share/nasa-links.ts`) | **Built** |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | The source of every Sun and Earth position | **Built** |
| Canadian Space Agency, [Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Listed by the challenge. TrueSouth does not use it. | Not used |

## What the challenge does not ask for

Launch windows, trajectories, the descent, the ascent and the trip home. TrueSouth models
none of them ([`../challenge.md`](../challenge.md)).
