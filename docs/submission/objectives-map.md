# Challenge objectives mapped to TrueSouth

One line for each objective and consideration on NASA's challenge page
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).
The wording of each objective is the challenge's, as recorded in
[`../challenge.md`](../challenge.md) (read from NASA's page on 2026-11-13).

## Update before submitting

States below were checked against `origin/main` and the open pull requests at
**@@CHECKED@@**. A state is **built** only if its code is merged on `origin/main`. It is
**in review** if the work is open in a pull request. It is **not built** if neither is true.

Run `git fetch origin`, `git log --oneline -20 origin/main` and `gh pr list --state open`,
then change these lines if a pull request has merged:

| Pull request | Title | Lines that depend on it |
| :--- | :--- | :--- |
| #81 | Academy A5: lessons 1 to 4 playable, with their cards | Objective 10; considerations "Make the difference from Earth apparent" and "Serve as an educational tool" |
| #79 | A8: validation page, "How we know it's right" | Consideration "Account for real topography"; the "Validation" line in objective 10 |
| #77 | Science: nearby range and best-lit variants (decision 0012, part B) | Consideration "Help users see why small location or date changes matter" |
| #80 | S10b: compute and cache custom lunar sites through the API | Objective 2 |

These have no pull request open. They are **not built**, and no line may say otherwise
unless one merges first: the Slip Planner (MC7), the Compare window and export (MC9), the
flat Polar map (T7), the Local terrain overlays (T4, T5) and the custom-coordinates form.

CHECK: the "where to see it" column uses the names in `CONTEXT.md` and the view bar. Open
the app once and confirm each name is on screen before you say it in the demo.

## Objectives

"Every objective on the page is offered as 'you may consider'" ([`../challenge.md`](../challenge.md)).

| # | Objective (the challenge's words) | TrueSouth feature | Where to see it in the app | State |
| :--- | :--- | :--- | :--- | :--- |
| 1 | A curated list of notable sites: Apollo, CLPS targets, other commercial missions, other countries' programmes | The site catalog: 20 sites in four groups (Artemis candidate regions, published high-sunlight points, recent landers, contrast sites such as Apollo 11) with coordinates and a source for each ([`../site-catalog.md`](../site-catalog.md)) | Mission Control, "Selected sites" rail, "Add site" | **Built** |
| 2 | Custom lunar coordinates | A typed latitude and longitude, computed on the server from the real terrain. The server part is in a pull request. The form in the app is not written. | Not in the app yet | **Not built** (server part **in review**, #80) |
| 3 | Side-by-side or sequential comparison of sites | The "Selected sites" rail shows every selected site's verdict for the landing date, one under the other. The Compare window is a placeholder. | Mission Control, "Selected sites" rail (built); "Compare" in the view bar (placeholder) | **Partly built**: rail built; Compare window **not built** |
| 4 | Landing dates and times; how conditions change across lunar days and seasons | The landing-date control (date picker, one day earlier or later, "Slip +7 d", "+14 d"); six years of hourly data for every site; the timeline over the mission window. The Slip Planner, the view of every landing date, is not written. | Mission Control, top bar "Landing date"; "Timeline" at the bottom. "Slip Planner" in the view bar is a placeholder | **Partly built**: controls, data, timeline built; Slip Planner **not built** |
| 5 | Sun and Earth positions relative to the horizon at a site and date | The hourly series of Sun and Earth azimuth, elevation, disc fraction and clearance ([`../science.md`](../science.md) §3 to §7), drawn as the Lander's eye: the skyline with the Sun and Earth on it | Mission Control, view bar, "Lander's eye" | **Built** |
| 6 | Time remaining before sunset or Earthset | The Sun and Earth countdown cards: "Sunset in", "Earthset in" | Mission Control, "Timeline" panel, the two cards at its right | **Built** |
| 7 | Solar elevation angle, duration of sunlight, Earth visibility windows | Elevation and clearance on the countdown cards; lit and link bands on the timeline; the mission-window metrics (longest dark stretch, longest blackout) and the GO, CAUTION or NO-GO verdict ([`../science.md`](../science.md) §9, §10) | "Timeline"; the focused-site panel at the right | **Built** |
| 8 | 2D maps, 3D surface views or other representations | The 3D System view of the Sun, Earth and Moon; the 3D ground around a site with a code-built lander ("Local terrain"); the Lander's eye chart. The flat Polar map with pins and overlays is not written; the camera still flies to the pole. | View bar: "System view", "Local terrain", "Lander's eye", "Polar map" | **Partly built**: System view, Lander's eye, the ground in Local terrain built; flat Polar map and Local terrain overlays **not built**. CHECK: open "Polar map" and "Local terrain" and say what you see. |
| 9 | Animations or timelines over a lunar day or several days | The timeline with a scrubber and Play ("6 h per second"); the scene follows the time | "Timeline" at the bottom; the play button | **Built** |
| 10 | Serving planners, educators and the public | Mission Control for planners; the Academy for learners ([`../academy/overview.md`](../academy/overview.md)); a plain explanation behind every term; the validation page for anyone who asks "can I trust it?" | Start screen, "Mission Control" and "Academy"; the info icon beside any term | Mission Control **built**. Academy lessons 1 to 4 **in review** (#81); lessons 5 to 8 **not built**. Validation page **in review** (#79). |

## Considerations

| Consideration (from the challenge) | TrueSouth feature | Where to see it | State |
| :--- | :--- | :--- | :--- |
| Ephemeris from the JPL Horizons System, or pre-computed | One pull from Horizons for the whole Moon and six years, checked against Horizons' own site tables (gate G2, 0.0061° largest difference) ([`../decisions/0004-one-global-ephemeris.md`](../decisions/0004-one-global-ephemeris.md)) | Behind every view; the validation numbers are in `data/derived/validation.json` | **Built** (the page that shows it is **in review**, #79) |
| LOLA topography for realistic surfaces and accurate horizons | NASA's 80 m and 240 m LOLA maps; a skyline for every site out to 300 km ([`../science.md`](../science.md) §5) | "Lander's eye"; "Local terrain" | **Built** |
| No atmosphere: the horizon is the terrain and the edge of the lunar sphere | Terrain blockers plus the curve of the Moon's horizon ([`../science.md`](../science.md) §4) | "Lander's eye" | **Built** |
| Show solar elevation prominently | The Sun countdown card and the Sun's reading in the Lander's eye | "Timeline"; "Lander's eye" | **Built** |
| Rapid comparison of many site and date combinations | The "Selected sites" rail gives each site's verdict for the landing date at once. The sweep over every date is built (a Web Worker) and has no screen yet. | "Selected sites" rail | **Partly built**: rail built; Slip Planner and Compare **not built** |
| Communicate time before sunset or Earthset clearly | The two countdown cards | "Timeline" | **Built** |
| Make the difference from Earth apparent | The 3D scene, where the Sun circles the horizon; Academy lesson 1 | "System view"; Academy lesson 1 | Scene **built**; lesson **in review** (#81) |
| Help users see why small location or date changes matter | The landing-date controls change a verdict in one click; "nearby range" and "best-lit variant" for sunlit-peak sites ([`../decisions/0012-sunlit-peaks-keep-their-listed-point.md`](../decisions/0012-sunlit-peaks-keep-their-listed-point.md)) | Top bar "Slip +7 d"; focused-site panel | Date controls **built**; nearby range and best-lit variants **in review** (#77); Slip Planner **not built** |
| Account for real topography | The skyline comes from LOLA terrain, and is compared with NASA's average-sunlight and Earth-visibility maps ([`../validation.md`](../validation.md)) | Validation page, `/validation` | Comparison data **built**; the page **in review** (#79) |
| Earth's libration and the Moon's orbital variations | In the Horizons data, hour by hour for six years, so Earth bobs on the timeline and in the Lander's eye | "Timeline", Earth band; "Lander's eye" | **Built** |
| Steep slopes and deep craters | Slope for each polar site from the 80 m map, with its baseline stated ([`../science.md`](../science.md) §8); a terrain mesh for each site | Focused-site panel, "Slope" rule; "Local terrain" | Slope **built**; slope colours on the ground **not built** |
| Help science and engineering teams coordinate; respond to schedule changes | Mission profiles with every limit tagged sourced or assumed; a shareable link that holds the whole scenario; the landing-date slip buttons | Top bar: "Mission profile", "Share", "Slip +7 d" | **Built**. Export of results is **not built** (MC9). CHECK: confirm "Share" copies a working link on the live site. |
| Serve as an educational tool | The Academy | `/academy` | Lessons 1 to 4 **in review** (#81); 5 to 8 **not built** |

## Resources the page lists

| Resource | How TrueSouth uses it | State |
| :--- | :--- | :--- |
| [Quickmap](https://quickmap.lroc.asu.edu/) and [Moon Trek](https://trek.nasa.gov/moon/) | Each site carries both links, to the tools' home pages. Links that open the site itself are not written (MC9). | Data **built**; deep links **not built**. CHECK: say "home pages", not "deep links". |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | The source of every Sun and Earth position | **Built** |
| Canadian Space Agency, [Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/) | Listed by the challenge. TrueSouth does not use it. | Not used |

## What the challenge does not ask for

Launch windows, trajectories, the descent, the ascent and the trip home. TrueSouth models
none of them ([`../challenge.md`](../challenge.md)).
