# TrueSouth (proposed README)

A proposed replacement for the repository's `README.md`. It is not applied. The real
README is unchanged.

## Review of the current README

Read against `origin/main` at @@CHECKED@@:

- **Out of date:** "Planning is complete. No application code exists yet." Code exists:
  the science pipeline, the API, the web app, the 3D scene and the Docker build.
- **Out of date:** "Quick start (once code exists)". It runs today.
- **Missing:** a screenshot, the validation headline, the data credits, the licence state,
  the Docker command and an honest list of what is not built yet.
- **Still right:** the two modes, the one question, the honesty rules and the table of
  where documents are.
- **Links in this file** are written to resolve from `docs/submission/`. To apply it, copy
  the part below the line to `README.md` and run, from the repository root:
  `sed -i 's#\.\./\.\./##g; s#\.\./#docs/#g' README.md`. Then check the links again.

CHECK: the team lead decides whether to apply it.

---

# TrueSouth

**A lunar landing site navigator for the NASA Space Apps 2026 challenge
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).**

TrueSouth answers one question: **"Where and when can this mission land?"** It turns NASA's
LOLA terrain and JPL Horizons positions into a skyline and an hourly record of the Sun and
Earth for 20 sites over six years, so a planner can score any landing date and mission
profile instantly. Mission Control is for planners and the Academy is for learners, and
both run on the same real data.

Landing at the Moon's south pole is hard for three reasons: the Sun skims the horizon at
1 to 2 degrees, Earth bobs above and below the horizon each month, and mountains block both.
A small change in *where* or *when* you land can turn a workable mission into a dead one.

## Screenshots

Placeholders. Use these files in `docs/design/c2/`; open each and confirm it matches the
current app before publishing, because some are older than the last merges.

| Picture | File | Shows |
| :--- | :--- | :--- |
| Hero | [`built-scene-system.png`](../design/c2/built-scene-system.png) | Mission Control: the 3D System view, the sites rail, a NO-GO verdict, the timeline and the countdowns |
| Lander's eye | [`built-landers-eye-1440-lit-landing.png`](../design/c2/built-landers-eye-1440-lit-landing.png) | The skyline with the Sun and Earth drawn on it, and the broken rules |
| Timeline, real data | [`built-timeline-real-connecting-ridge.png`](../design/c2/built-timeline-real-connecting-ridge.png) | The hourly timeline for Connecting Ridge |
| The pole | [`built-scene-pole.png`](../design/c2/built-scene-pole.png) | The camera over the south pole |
| Local terrain | [`built-scene-local-terrain.png`](../design/c2/built-scene-local-terrain.png) | The ground around a site, with the lander |
| Academy path | [`built-academy-path.png`](../design/c2/built-academy-path.png) | The eight lessons on a map of the south pole |
| Academy lesson | [`built-academy-lesson-choice.png`](../design/c2/built-academy-lesson-choice.png) | One lesson step with Luna |

CHECK: `built-mission-nogo.png` shows an older build ("Not built yet" panels). Do not use it.

## The two modes

| Mode | For | What it does |
| :--- | :--- | :--- |
| **Mission Control** | Mission planners | Pick a mission profile and up to eight sites, set a landing date, and see a GO, CAUTION or NO-GO verdict with the rule that fails, an hourly timeline, countdowns to sunset and Earthset, a 3D scene and the Lander's eye view. Share the scenario as a link. |
| **Academy** | Students, educators, the public | A 10 to 15 minute story. Luna, a moon mascot, guides you through rebuilding the tool's logic to land a small fictional lander called Pip. |

## What is built, and what is not

State as of @@CHECKED@@. [`docs/orchestration/status.md`](../orchestration/status.md) is the
live record.

**Built:** the science pipeline and its derived data for 20 sites; validation against
NASA's maps; the Mission Control shell; the 3D scene (System view, the ground in Local
terrain); the Lander's eye; the timeline and countdowns; scoring in the browser; the
shareable link; a Docker build; Academy screens and lesson skeletons.

**In review (open pull requests):** Academy lessons 1 to 4 playable (#81); the validation
page (#79); nearby range and best-lit variants for sunlit peaks (#77); a server that
computes custom sites (#80).

**Not built:** the Slip Planner view, the Compare window, the flat Polar map, Local terrain
overlays, a form for custom coordinates, Academy lessons 5 to 8, Luna's final art.

CHECK: update these three lists from `gh pr list --state open` on the day.

## Run it

You need Python 3.12 with [`uv`](https://docs.astral.sh/uv/), and Node 22 with `pnpm`.
The derived data is committed, so you do not need to download NASA files.

```bash
uv sync                                   # install Python dependencies
uv run pytest                             # Python tests
uv run uvicorn truesouth_api.main:app --reload --port 8000

pnpm --dir web install
pnpm --dir web dev                        # the web app on http://localhost:5173
pnpm --dir web test                       # web tests
pnpm --dir web typecheck
```

With Docker (production build, catalog sites only, no downloads at start):

```bash
docker compose -p truesouth-s13 up -d --build   # then open http://localhost:8080
docker compose -p truesouth-s13 down            # to stop it
```

Development needs no Docker. The stack, the folder layout and the data flow are in
[`docs/architecture.md`](../architecture.md).

## What is real, and what is assumed

- **Real:** the terrain (NASA LOLA), the Sun and Earth positions (JPL Horizons), the
  skylines and the hourly Sun and Earth record for 20 sites from 2026-01-01 to 2031-12-31.
  The Academy's lander, Pip, is fictional. Its data is not.
- **Sourced or assumed:** every number in a mission profile is tagged **sourced** (with a
  link) or **assumed** (our estimate, because none is published). We never show an assumed
  number as sourced. For IM-2 Athena only the 10-day length is sourced. See
  [`docs/mission-profiles.md`](../mission-profiles.md).
- **Planning aid, not flight certification.** It models the stay on the surface only: no
  launch, no transit, no descent, no return.

## How we know it is right

- Our Sun and Earth directions match NASA's JPL Horizons within **0.0061°** at all 20 sites
  and every hour of six years: 2,103,360 comparisons (pass mark 0.02°).
- Nine automated geometry and encoding gates (G1 to G9) pass.
- Against NASA's average-sunlight map, 13 of 14 polar sites are within 6.3 percentage
  points. **Two results are outside their marks and are published with their reasons:**
  sunlight at Peak near Shackleton (24.1 points above NASA's 60 m pixel, on a sharp ridge
  where neighbouring pixels range from 44.7% to 58.0%) and the skyline's convergence at
  Connecting Ridge (405 of 1,440 directions move by more than 0.05° when the method's step is
  halved; terrain within 0.56 km of the site).

Full results: [`docs/validation.md`](../validation.md) and `data/derived/validation.json`.

## Data sources and credits

| Source | Used for |
| :--- | :--- |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | Sun and Earth positions |
| LOLA 80 m and 240 m polar terrain, [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Skylines, slope, 3D ground |
| LOLA average sunlight and Earth visibility, [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69) | Validation only |
| LOLA 5 m close-up maps, [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78) | Positions of Artemis candidate sites |
| [NASA SVS 4720](https://svs.gsfc.nasa.gov/4720) | Moon colour and height maps in the scene |
| Blue Marble Next Generation, NASA Earth Observatory | The Earth picture in the scene |

Credit lines as recorded with the images: "NASA Scientific Visualization Studio; LRO LROC and
LOLA teams. SVS 4720." and "NASA Earth Observatory, Reto Stöckli. Blue Marble Next
Generation, March 2004." NASA images are resized and re-encoded only, never retouched. Site
and mission-profile sources are in [`docs/site-catalog.md`](../site-catalog.md) and
[`docs/mission-profiles.md`](../mission-profiles.md).

## AI use

Most of this code was written by AI agents, under a human team lead who set the direction
and picked the designs. See [`docs/submission/ai-use.md`](../submission/ai-use.md) and the "AI use" line
of every entry in [`DEVLOG.md`](../../DEVLOG.md).

## Where things are

| File | Read it when you need... |
| :--- | :--- |
| [`AGENTS.md`](../../AGENTS.md) | The rules for working in this repo (humans and AI agents). |
| [`CONTEXT.md`](../../CONTEXT.md) | The meaning of a project term. |
| [`docs/challenge.md`](../challenge.md) | What the challenge asks, and where TrueSouth answers it. |
| [`docs/build-plan.md`](../build-plan.md) | Who builds what, and how "done" is checked. |
| [`docs/science.md`](../science.md) | Every formula, derived once. |
| [`docs/data-contracts.md`](../data-contracts.md) | Exact file and API formats. |
| [`docs/decisions/`](../decisions/) | Why we chose what we chose. |
| [`DEVLOG.md`](../../DEVLOG.md) | What has been built, and the AI-use disclosure. |

## Licence

**There is no licence file in this repository today.** Without one, the code is "all rights
reserved" by default and others may not reuse it. NASA's data and images carry their own
terms. CHECK: the team lead must choose a licence (for example MIT for the code) and add a
`LICENSE` file before the repository is made public. Do not publish this section as
written.
