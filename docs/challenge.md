# The challenge, and how TrueSouth answers it

TrueSouth is built for the NASA Space Apps 2026 challenge
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).
This page records what the challenge asks for, read from NASA's page on 2026-11-13, and
where each part is answered. Read it before proposing a feature: if the feature is not on
this page, it is probably not what the judges are looking for.

## What it asks for

> Your challenge is to create an intuitive tool or application that lets mission planners,
> educators, and the public compare landing sites and dates quickly, visualizing Sun and
> Earth positions relative to the horizon to assess power generation potential and
> direct-to-Earth communication windows.

**It is about the stay on the surface.** The page says nothing about launch, the trip to
the Moon, the descent or a return. A launch delay matters only because it moves the landing
date: "Hardware development challenges, launch delays, or other factors often force mission
planners to reconsider their original landing date and location."

**Who it is for:** mission planners who need to decide quickly, and educators and the
public who want to understand why the Moon's south pole is hard.

**The gap it names:** NASA's Quickmap, Moon Trek and the JPL Horizons System hold the
information but "are often difficult for non-specialists to use effectively for rapid
scenario comparison."

## Objectives

Every objective on the page is offered as "you may consider". State is as of 2026-11-13;
[`orchestration/status.md`](orchestration/status.md) is the live record.

| Objective | In TrueSouth | State |
| :--- | :--- | :--- |
| A curated list of notable sites: Apollo, CLPS targets, other commercial missions, other countries' programmes | The site catalog: 20 sites in four groups ([`site-catalog.md`](site-catalog.md)) | Built |
| Custom lunar coordinates | A typed latitude and longitude, computed on the server from the real terrain in about 45 seconds | Decided 2026-11-13: a small version is in scope |
| Side-by-side or sequential comparison of sites | The sites rail, and the Compare window ([`features/compare.md`](features/compare.md)) | Rail built; Compare not built |
| Landing dates and times; how conditions change across lunar days and seasons | The landing date and slip controls; six years of landing dates per site; the Slip Planner ([`features/slip-planner.md`](features/slip-planner.md)) | Controls and data built; the Slip Planner: design picked; not built |
| Sun and Earth positions relative to the horizon at a site and date | The per-hour series ([`science.md`](science.md) §3 to §7); the Lander's eye ([`features/panorama.md`](features/panorama.md)) | Data built; Lander's eye not built |
| Time remaining before sunset or Earthset | The countdown cards ([`features/site-detail.md`](features/site-detail.md)) | Built |
| Solar elevation angle, duration of sunlight, Earth visibility windows | The countdown cards, the timeline, the mission-window metrics and the verdict ([`science.md`](science.md) §9 and §10) | Built |
| 2D maps, 3D surface views or other representations | The Polar map; the 3D scene of the Sun, Earth and Moon; Local terrain ([`decisions/0013`](decisions/0013-space-first-mission-control.md)) | In progress |
| Animations or timelines over a lunar day or several days | The timeline, the scrubber and play; the scene follows the time | Timeline built; scene in progress |
| Serving planners, educators and the public | Mission Control for planners; the Academy for learners ([`academy/overview.md`](academy/overview.md)); plain explanations on every term | Mission Control panels and Academy screens built; the real lessons not written |

## Considerations the page lists

| Consideration | In TrueSouth |
| :--- | :--- |
| Ephemeris from the JPL Horizons System, or pre-computed | One global Horizons pull, checked against Horizons' own site tables to 0.006° ([`decisions/0004`](decisions/0004-one-global-ephemeris.md), gate G2) |
| LOLA topography for realistic surfaces and accurate horizons | NASA's 80 m and 240 m LOLA maps; a skyline per site out to 300 km ([`science.md`](science.md) §5) |
| No atmosphere: the horizon is the terrain and the edge of the lunar sphere | Exactly that: terrain blockers, and the curved Moon's horizon dip ([`science.md`](science.md) §4) |
| Show solar elevation prominently | In the Sun's countdown card and the Lander's eye |
| Rapid comparison of many site and date combinations | The sites rail gives every selected site's verdict for the landing date; the slip sweep covers every date |
| Communicate time before sunset or Earthset clearly | The two countdown cards |
| Make the difference from Earth apparent | The Academy's first lessons; the scene, where the Sun circles the horizon |
| Help users see why small location or date changes matter | The nearby range and the best-lit variants ([`decisions/0012`](decisions/0012-sunlit-peaks-keep-their-listed-point.md)); the Slip Planner |
| Account for real topography | Yes; compared with NASA's own average-sunlight and Earth-visibility maps ([`validation.md`](validation.md)) |
| Earth's libration and the Moon's orbital variations | In the Horizons ephemeris, hour by hour for six years |
| Steep slopes and deep craters | Slope from the terrain map with its baseline stated ([`science.md`](science.md) §8); the terrain mesh and the polar relief |
| Help science and engineering teams coordinate; respond to schedule changes | Mission profiles with every limit tagged sourced or assumed; the shareable link; the Slip Planner |
| Serve as an educational tool | The Academy |

## Resources the page lists

- [Quickmap](https://quickmap.lroc.asu.edu/) and [Moon Trek](https://trek.nasa.gov/moon/):
  every site links out to both.
- [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/): the source of every Sun and
  Earth position.
- Canadian Space Agency,
  [Moon Exploration](https://www.asc-csa.gc.ca/eng/astronomy/moon-exploration/).

## What the challenge does not ask for

Launch windows, trajectories, the descent, the ascent or the trip home. TrueSouth models
none of them and should not start.
