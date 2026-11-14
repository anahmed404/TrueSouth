<!--
TO FILL IN before sending: nothing is required. The Role of Team Members section is finished.
Optional: if the team wants a line on each member's background in that section, add it at the end of the member's entry:
  [optional: one line on Abdallah's background]
  [optional: one line on Omar's background]
  [optional: one line on Tawfic's background]
  [optional: one line on Ahmed's background]
Word counts for the limited sections are in the comments under their headings. They were counted by script from the text under each heading. Re-count after any edit.
Delete this comment before pasting into the organisers' form.
-->

# TrueSouth

NASA Space Apps Cairo 2026 — Team Proposal

Team: Landing Went South

## Executive Summary (300 words max)
<!-- 296 words -->

We chose NASA's challenge "Lunar Landing Site Navigator". It asks for an intuitive tool that lets mission planners, educators and the public compare landing sites and dates quickly, showing the Sun and Earth against the horizon. We chose it because the question is concrete, the public data is good, and a wrong answer can cost a mission.

At the Moon's south pole the Sun stays within about two degrees of the horizon: the highest it climbs at Connecting Ridge in our data is 2.10°. Earth hangs low, and rises and sets as the Moon wobbles. Mountains block both, so terrain decides whether a lander has power and a radio link. When a launch slips, the answer changes.

TrueSouth answers one question: where and when can this mission land? Our Python pipeline takes NASA's LOLA terrain and JPL Horizons positions and computes, for 25 sites (20 catalog sites and 5 best-lit variants), a skyline and an hourly record of the Sun and Earth for six years.

In the browser, Mission Control scores any landing date against a mission profile and gives a GO, CAUTION or NO-GO status with the rule that broke. A planner can slip the date, see every site re-scored at once, and jump to the next GO date. The Academy teaches the same physics in four lessons with a moon mascot, Luna.

This covers the challenge's objectives, from a curated site list and custom coordinates to six years of landing dates, countdowns, 2D and 3D views and a timeline.

Our Sun and Earth directions match JPL Horizons' own site tables within 0.0061° in 2,103,360 comparisons. We publish every comparison with NASA's maps, including the ones where we disagree. TrueSouth models the stay on the surface only. It is a planning aid, not flight certification.

## Problem Definition (150 words max)
<!-- 147 words -->

A mission planner must choose where and when a lander touches down. Near the Moon's south pole that choice is fragile. The Sun skims the horizon: in our six years of hourly data it never rises above 2.10° at Connecting Ridge. Earth sits low and moves above and below the horizon as the Moon wobbles. Terrain blocks both. A solar-powered lander needs light, and a lander without a relay needs a direct view of Earth. NASA says its VIPER rover "cannot endure more than 50 hours of continuous darkness" and relies on a direct-to-Earth radio link.

When hardware or launch delays move the landing date, the planner must start again. NASA's challenge says the existing tools hold the information but "are often difficult for non-specialists to use effectively for rapid scenario comparison". Planners need a fast answer for each site and date. Learners need to see why.

## Background & Literature Review (200 words max)
<!-- 199 words -->

NASA already offers good tools. LROC QuickMap and Moon Trek are browser portals to lunar map layers. JPL Horizons gives the Sun's and Earth's positions for a chosen place and time, without terrain. NASA's Scientific Visualization Studio publishes Moon colour and elevation maps for rendering. The Planetary Geodesy Data Archive publishes LOLA terrain maps and maps of average sunlight and Earth visibility.

Each does its job well. None of them, as far as we found, answers "is this landing date GO for this mission at this site, and what if it slips?" The sunlight maps are averages over 18.6 years, so they say where, not when.

The research is solid. Mazarico et al. (2011) modelled polar illumination from LOLA topography over a full nutation cycle of about 18.6 years, at one-hour steps. Gläser et al. (2014) studied south-pole illumination with higher-resolution LOLA terrain models. Barker et al. (2021) estimated the errors in LOLA south-pole maps and their effect on illumination. Barker et al. (2023) published the newer maps we use.

These studies give averages and a few named points. We add time: an hourly series for six years, scored against a mission's own rules, and checked against NASA's maps.

## Methodology

We built the method as a pipeline that runs once, and a browser that scores.

1. **Read the challenge.** We mapped every objective on NASA's page to a feature, and wrote a glossary and a written spec for each feature.
2. **Get NASA data.** NASA's LOLA terrain maps at 80 m and 240 m. One pull from JPL Horizons gives the Sun's and Earth's positions over the Moon for every hour from 2026-01-01 to 2031-12-31 (52,584 hours).
3. **Build a skyline per site.** For an observer 2 m above the ground, the highest terrain in each of 1,440 compass directions, out to 300 km, with the dip of the curved Moon's horizon (science.md §4–5).
4. **Build the hourly series.** For each site and hour: the Sun's and Earth's azimuth, elevation, share of the disc above the skyline, and clearance (§6–7). A site uses 80 m terrain south of 80°S, 240 m terrain from 80°S to 60°S, and a smooth Moon north of 60°S.
5. **Write mission profiles.** Five presets named after real missions, and a custom one. Every value is tagged sourced (with a link) or assumed.
6. **Score in the browser.** Window metrics, vetoes, utilities, a weighted score and a status (§9–10). A six-year sweep runs in a Web Worker (§11).
7. **Validate.** Eleven gates, and 59 comparisons with NASA's maps and with ourselves.

**Tools.** Python (numpy, scipy, pyproj, pydantic, FastAPI) for the science and the server. TypeScript with React and three.js for the app. pytest and vitest for tests.

**Why the split.** Skylines, Sun and Earth positions and disc visibility are computed only in Python. The browser computes only mission metrics and scores from the stored series, so sliders answer instantly and there is one source of truth. A shared fixture of 76 cases checks the TypeScript scoring against the Python reference. Drawn 3D shadows are decoration, never a result.

**Fit to the challenge.** Horizons and LOLA are the two sources the challenge names. With no atmosphere, the horizon is the terrain and the edge of the lunar sphere, which is what the skyline holds.

## Solution

**How it tackles the challenge.** TrueSouth has two modes on the same data.

*Mission Control* is for planners. The planner picks a mission profile, selects up to eight sites and sets a landing date. Five camera views share one clock: the System view (the Moon, Earth and Sun in 3D), the Polar map, the Slip Planner, Local terrain and Lander's eye (the 360° view from 2 m above the ground). Countdowns to sunset and Earthset sit in a strip along the bottom. A Compare window sets sites side by side, marks the row that decides between them, and exports CSV and JSON. A Share button copies a link to the whole scenario.

The Slip Planner shows each site's status and score across six years of landing dates. "Slip +7 d" and "Next GO" answer the question a delay raises.

*Custom coordinates:* type a latitude and east longitude, or click the Polar map. The server computes the site from real terrain. On our development machine an 80 m site took 44 to 49 seconds.

*The Academy* teaches the same physics in four lessons, guided by Luna, to land a fictional lander called Pip. Each lesson has an "Under the hood" card with the real formula and numbers from the pipeline.

**Steps to implement.** Contracts and fixtures first. Then the pipeline, the scoring, the views and the lessons, in milestones M0 to M4 (see Workflow Strategy). Planned next: close-up ground from NASA's 5 m maps. Not yet built: Academy lessons 5 to 8, final art for Luna, official Artemis region outlines and a sensitivity grid.

**Against the challenge's objectives.**

- A curated site list: 20 catalog sites, in four groups (Artemis candidate regions, published high-sunlight points, recent polar landers, contrast sites such as Apollo 11).
- Custom coordinates, comparison and landing dates: as above.
- Sun and Earth positions, sunset and Earthset countdowns, elevation and visibility windows: Lander's eye, the countdown cards and the timeline.
- 2D and 3D views, animation over time: the five camera views, the scrubber and Play.
- Planners, educators and the public: Mission Control and the Academy.

## Value Proposition

TrueSouth serves two groups. Mission planners must decide fast after a slip. Educators, students and the public want to see why the south pole is hard.

Map portals show layers. Ephemeris services give positions without terrain. TrueSouth joins them into a decision for a chosen mission, site and date:

- **A status with its reason.** GO, CAUTION or NO-GO, and the rule that broke: a dark stretch that is too long, a blackout, a slope or a landing-light rule.
- **Slip and re-score.** Move the date and every selected site is re-scored at once. "Next GO" jumps to the next day a site works.
- **Honest numbers.** Every mission-profile value is tagged sourced, with its link, or assumed. An assumed number is never shown as sourced.
- **Published validation.** Our Sun and Earth directions match Horizons within 0.0061°. Five of the 59 comparisons are outside their marks, and each is published with an explanation.
- **Teams can coordinate.** A shared link, a Compare table that marks the deciding row, and CSV and JSON export.
- **One engine that teaches.** The Academy lessons use the same numbers, so a learner sees what a planner sees.

TrueSouth models the surface stay only. It is a planning aid, not flight certification.

## Role of Team Members

All four members test the running app and choose between design variants at checkpoints. Coding agents wrote and reviewed the code under the team's direction; large parts have had no line-by-line human review.

**Abdallah Mostafa: team lead; architecture and delivery.** Owns the design and final decisions: science computed once in Python, stored as compact series, scored in the browser; the data contracts; the build process, with review and tests before each merge; integration; the production deployment. It keeps the parts fitting.

**Omar Khaled: lunar science and validation.** Owns the numbers: NASA's LOLA terrain and JPL Horizons positions, skylines to 300 km, the six-year hourly record of Sun and Earth, custom coordinates, and the validation gates against NASA's products, with differences published. Every answer rests on it.

**Tawfic Kobtan: Mission Control and the scoring engine.** Owns the planner's answer: mission profiles tagged sourced or assumed; scoring that gives GO, CAUTION or NO-GO with the deciding rule, identical in Python and the browser; the timeline, Slip Planner, "Next GO" and Compare. A planner acts on it.

**Ahmed Salah: visualisation and the Academy.** Owns how people see and learn it: the System view, Polar map, Local terrain and Lander's eye, fast on ordinary laptops; and the Academy, the second mode, with interactive lessons on the same engine and data. It shows why a site is lit or dark.

## Workflow Strategy

**Steps.**

1. *Problem analysis.* We mapped each objective to a feature, and wrote a glossary, the science once, and a spec per feature before any code.
2. *Contracts.* File and API formats are defined once in Python, and TypeScript types are generated from them. A small synthetic dataset let web work start before real data.
3. *Work packages.* Four tracks (Science, Mission Control, 3D and Map, Academy) own separate folders. An orchestrating agent hands each package, with its "done when" checks, to a coding agent on its own branch, which opens a pull request. 
4. *Review and merge.* Nearly every pull request was reviewed by an agent from a different provider, asked to run and mutate the code. Both test suites run before merging. Validation gates are never loosened.
5. *Human steering.* The four members test the running app, choose between design variants at checkpoints, and decide scope.

**Collaboration.** Pull requests into one main branch. Every package gets a development-log entry with an AI-use line.

**Milestones, as of 14 November 2026.**

- M0 Foundations: complete.
- M1 Thin slice and M2 Mission Control on catalog data: complete.
- M3 Everything for the deadline: done within scope. Custom coordinates, Docker, the validation page and Academy lessons 1 to 4 are in. The deploy files are written but not yet run on a server.
- M4 Tuned and submitted: in progress. The submission texts are current. The live demo, repository access and the video are open.

## Resources

**Software.**

- Python 3.12 with uv: numpy, scipy, pyproj, pydantic v2, httpx with truststore, pillow, rasterio (map preparation only), FastAPI and uvicorn, pytest.
- Node 22 with pnpm: React 19, Vite, TypeScript, React Router, Tailwind CSS, Zustand, Motion, three.js with React Three Fiber and drei, d3-scale, d3-shape and d3-zoom, KaTeX, lucide-react, vitest, json-schema-to-typescript.
- Docker for the production build. nginx and Let's Encrypt are planned for the demo server.

**Hardware.**

- A development PC with an NVIDIA RTX 2060 graphics card, and a laptop for testing.
- A small cloud server (2 vCPU, 3.8 GB RAM, Ubuntu 24.04) is planned for the live demo. At the time of writing, nothing is deployed there.

**Data.** NASA's products are used unchanged, except for resizing and splitting images.

| Product | Used for | URL |
| :--- | :--- | :--- |
| JPL Horizons System | Sun and Earth positions; the check of those positions | https://ssd.jpl.nasa.gov/horizons/ |
| LOLA 80 m and 240 m south-polar terrain (PGDA product 90) | Skylines, slope, the 3D ground | https://pgda.gsfc.nasa.gov/products/90 |
| LOLA 80 m slope map (PGDA product 90) | Validation of our slope | https://pgda.gsfc.nasa.gov/products/90 |
| LOLA average sunlight and Earth visibility, 60 m and 120 m (PGDA product 69) | Polar map overlays; validation | https://pgda.gsfc.nasa.gov/products/69 |
| LOLA 5 m close-up maps (PGDA product 78) | Positions of Artemis candidate sites; slope check | https://pgda.gsfc.nasa.gov/products/78 |
| NASA SVS 4720, CGI Moon Kit | The Moon's colour and height maps in the scene | https://svs.gsfc.nasa.gov/4720 |
| Blue Marble Next Generation (NASA Earth Observatory) | The Earth picture in the scene | https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/march/world.topo.bathy.200403.3x5400x2700.jpg |
| Yale Bright Star Catalogue (NASA/ADC, via HEASARC) | The 8,404 stars in the System view | https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html |
| NASA Artemis III candidate regions | Names of the regions | https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/ |
| LROC QuickMap and NASA Moon Trek | Links from the Compare window | https://quickmap.lroc.im-ldi.com/ and https://trek.nasa.gov/moon/ |

Also: site coordinates from published studies (references 2, 5 and 6), and the match of Artemis region names to NASA's close-up maps from reference 7; NASA, ISRO and Firefly mission documents, for the sourced profile values (for example VIPER, https://science.nasa.gov/mission/viper/lunar-operations/); the IAU gazetteer of planetary nomenclature, for crater names (https://planetarynames.wr.usgs.gov/).

**References.**

1. Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Torrence, M. H. (2011). Illumination conditions of the lunar polar regions using LOLA topography. *Icarus*, 211(2), 1066–1081. https://doi.org/10.1016/j.icarus.2010.10.030
2. Gläser, P., Scholten, F., De Rosa, D., Marco Figuera, R., Oberst, J., Mazarico, E., Neumann, G. A., & Robinson, M. S. (2014). Illumination conditions at the lunar south pole using high resolution Digital Terrain Models from LOLA. *Icarus*, 243, 78–90. https://doi.org/10.1016/j.icarus.2014.08.013
3. Barker, M. K., Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., & Head, J. W. (2021). Improved LOLA elevation maps for south pole landing sites: Error estimates and their impact on illumination conditions. *Planetary and Space Science*, 203, 105119. https://doi.org/10.1016/j.pss.2020.105119
4. Barker, M. K., Mazarico, E., Neumann, G. A., Smith, D. E., Zuber, M. T., Head, J. W., & Sun, X. (2023). A New View of the Lunar South Pole from the Lunar Orbiter Laser Altimeter (LOLA). *The Planetary Science Journal*, 4(9), 183. https://doi.org/10.3847/PSJ/acf3e1
5. De Rosa, D., Bussey, B., Cahill, J. T., Lutz, T., Crawford, I. A., Hackwill, T., van Gasselt, S., Neukum, G., Witte, L., McGovern, A., Grindrod, P. M., & Carpenter, J. D. (2012). Characterisation of potential landing sites for the European Space Agency's Lunar Lander project. *Planetary and Space Science*, 74(1), 224–246. https://doi.org/10.1016/j.pss.2012.08.002 (we took site coordinates from the arXiv preprint, https://arxiv.org/abs/1208.5587)
6. Bussey, D. B. J., McGovern, J. A., Spudis, P. D., Neish, C. D., Noda, H., Ishihara, Y., & Sørensen, S.-A. (2010). Illumination conditions of the south pole of the Moon derived using Kaguya topography. *Icarus*, 208(2), 558–564. https://doi.org/10.1016/j.icarus.2010.03.028
7. Peña-Asensio, E., Neira-Acosta, Á.-S., & Sánchez-Lozano, J. M. (2025). Evaluating potential landing sites for the Artemis III mission using a multi-criteria decision making approach. *Acta Astronautica*, 226, 469–478. https://doi.org/10.1016/j.actaastro.2024.10.049
8. NASA (2024, October 28). NASA provides update on Artemis III Moon landing regions. Release 24-136. https://www.nasa.gov/news-release/nasa-provides-update-on-artemis-iii-moon-landing-regions/
9. NASA JPL Solar System Dynamics Group. Horizons System. https://ssd.jpl.nasa.gov/horizons/

**AI tools used.** Claude Code (Claude Fable 5.2, Opus 5.5 and Sonnet 5.5), Codex (gpt-6.1-sol and gpt-6.1-terra), Cursor (grok-4.7 and grok-4.6) and Antigravity (gemini-4-argon, gemini-4-hydrogen and gemini-3.8-flash). The `impeccable` design skill was used inside Claude Code. The only AI-made images are placeholder drawings of Luna, two start-screen drawings and one lesson diagram, all inline SVG made by Claude Code. NASA images and data are never AI-generated or altered. Full details are in our AI-use disclosure.

## Team

Team name: Landing Went South

1. Abdallah Mostafa
2. Omar Khaled
3. Tawfic Kobtan
4. Ahmed Salah
