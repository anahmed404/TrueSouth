# Glossary

Use these words exactly, in code, docs, UI text and conversations with AI agents.
If you need a new term, add it here first.

## The product

| Term | Meaning |
| :--- | :--- |
| **TrueSouth** | The product. |
| **Mission Control** | The planner mode. |
| **Academy** | The guided-lesson mode. |
| **Luna** | The Academy's mascot: a moon character who guides the learner. |
| **Pip** | The fictional small lander the learner is trying to land in the Academy story. Pip uses the IM-2 Athena mission profile. |

## Places

| Term | Meaning |
| :--- | :--- |
| **Site** | One point on the Moon: latitude, east longitude, and a name. |
| **Catalog site** | A site we ship, with precomputed data. Listed in [`docs/site-catalog.md`](docs/site-catalog.md). |
| **Custom site** | A site the user creates by clicking the map or typing coordinates. Computed by the API on demand. |
| **Latitude** | Degrees north of the lunar equator. South is negative. |
| **East longitude** | Degrees east of the Moon's prime meridian, in the range 0–360. |
| **Local frame** | The site-centred frame every direction is measured in: east, north, up at the site. |
| **Terrain tier** | Which elevation data a site uses: `core80`, `wide240` or `sphere`. See [`docs/decisions/0008-terrain-tiers.md`](docs/decisions/0008-terrain-tiers.md). |
| **Close-up DEM** | A 5 m elevation map that exists for a few sites. Used for slope and the close-up 3D view. |
| **DEM** | Digital elevation model: a grid of terrain heights. |
| **Named feature** | A crater or mountain with an official IAU name, used for labels. |

## Directions and visibility

| Term | Meaning |
| :--- | :--- |
| **Azimuth** | Compass direction in the local frame, in degrees clockwise from north. East is 90. |
| **Elevation** | Angle above the local horizontal plane, in degrees. Negative means below it. |
| **Skyline** | The terrain's outline as seen from a site: for each azimuth, the elevation of the highest terrain in that direction. |
| **Skyline bin** | One of the 1,440 azimuth steps (0.25° each) a skyline is stored in. |
| **Blocker** | The terrain point that sets the skyline in one bin. |
| **Clearance** | Elevation of a body's centre minus the skyline elevation at the body's azimuth. Positive means the centre is above the terrain. |
| **Disc fraction** | The share of the Sun's or Earth's visible disc that is above the skyline, from 0 to 1. |
| **Sub-solar point** | The place on the Moon where the Sun is directly overhead at a given moment. |
| **Sub-Earth point** | The place on the Moon where Earth is directly overhead at a given moment. |
| **Libration** | The Moon's slow wobble as seen from Earth. It makes the sub-Earth point wander, so Earth bobs in the lunar sky. |

## Time

| Term | Meaning |
| :--- | :--- |
| **Time grid** | The fixed hourly UTC timestamps all data uses: 2026-01-01T00:00Z to 2031-12-31T23:00Z. |
| **Series** | One site's per-hour values on the time grid: Sun and Earth azimuth, elevation, disc fraction and clearance. |
| **Global ephemeris** | The per-hour sub-solar point, sub-Earth point and distances, pulled once from JPL Horizons. |
| **Landing date** | The UTC moment a mission touches down. |
| **Mission window** | The span from the landing date to the landing date plus the mission duration. |
| **Slip** | Moving the landing date later (or earlier) by some days. |

## Mission logic

| Term | Meaning |
| :--- | :--- |
| **Mission profile** | The settings that describe a mission: duration, power limits, comms rules, slope limit, landing-light rule and weights. |
| **Preset** | A mission profile named after a real mission. Listed in [`docs/mission-profiles.md`](docs/mission-profiles.md). |
| **Sourced** | A profile value taken from a published document, shown with its link. |
| **Assumed** | A profile value we chose because none is published, shown with an "assumed" tag. |
| **Lit** | The site has enough sunlight at this hour under the profile's rule. |
| **Dark** | Not lit. |
| **Link** | Direct radio contact with Earth is possible at this hour under the profile's rule. |
| **Blackout** | No link. |
| **Antenna mask** | The minimum clearance Earth's centre needs before a link counts. |
| **Relay** | An orbiter that passes signals to Earth. A profile with a relay never has a blackout. |
| **Metric** | A measured fact about a mission window, such as the longest dark stretch in hours. |
| **Veto** | A hard rule a mission window breaks. Any veto makes the status NO-GO. |
| **Utility** | A 0–1 rating of one criterion: slope, power or comms. |
| **Score** | The weighted average of the utilities, from 0 to 100. Ranks windows that pass every veto. |
| **Status** | GO, CAUTION or NO-GO. |
| **Scenario** | One Mission Control state: a mission profile, a set of sites, a landing date and a current time. |
| **Selected sites** | The sites in the current scenario. Up to 8. |
| **Focused site** | The one selected site the detail views are showing. |

## Views

| Term | Meaning |
| :--- | :--- |
| **Slip Planner** | The heatmap of sites against landing dates. |
| **System view** | The 3D bird's-eye view of the Moon, Earth and Sun. |
| **Polar map** | The flat south-pole map used to pick and nudge sites. |
| **Local terrain** | The 3D close-up of the ground around one site. |
| **Skyline wall** | The ring around the local terrain whose top edge follows the skyline of distant terrain. |
| **Lander's eye** | The 360° panorama of the skyline with the Sun and Earth drawn on it. |
| **Countdown** | Time from the current time to the next sunset, sunrise, Earthset or Earthrise. |
| **Scrubber** | The time slider shared by every view. |

## Academy

| Term | Meaning |
| :--- | :--- |
| **Lesson** | One of the eight Academy units. About five steps. |
| **Step** | One screen of a lesson: a question or an interaction. |
| **Under the hood** | The optional card in each lesson with the full formula, a worked example and a link to the code. |
| **Worked example** | Numbers in an Under-the-hood card. Generated by running the real science code. |
| **XP** | Points earned per step. |
| **Mission patch** | The badge earned for finishing a lesson. |

## Data

| Term | Meaning |
| :--- | :--- |
| **Raw data** | Files downloaded from NASA, unchanged. Lives in `data/raw/`. Not committed. |
| **Prepared data** | Raw data converted for fast reading. Lives in `data/prepared/`. Not committed. |
| **Derived data** | What the pipeline produces and the web app reads. Lives in `data/derived/`. Committed. |
| **Fixtures** | A small synthetic dataset in the derived-data formats, for development without downloads. |
| **Horizons** | JPL's ephemeris service. Our source for Sun and Earth positions. |
| **LOLA** | The laser altimeter on NASA's Lunar Reconnaissance Orbiter. Our source for terrain heights. |
| **PGDA** | NASA Goddard's Planetary Geodesy Data Archive, which publishes the LOLA maps we use. |
| **DTE** | Direct to Earth: a radio link with no relay. |
