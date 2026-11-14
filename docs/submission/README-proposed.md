# TrueSouth (proposed README)

A proposed replacement for the repository's `README.md`. It is not applied. The real
README is unchanged.

CHECK (team lead): decide whether to apply it. The licence section must be settled first.

## Review of the current README

Read against `origin/main` at **69bb26e, 2026-11-14**:

- **Out of date:** "Planning is complete. No application code exists yet." Code exists:
  the science pipeline, the FastAPI server for custom sites, the web app, all five Mission
  Control views plus Compare, Academy lessons 1 to 4, the validation page and the Docker
  build.
- **Out of date:** "Quick start (once code exists)". It runs today.
- **Missing:** screenshots, the validation headline, the data credits, the licence state,
  the Docker command, and an honest list of what is not built.
- **Still right:** the two modes, the one question, the honesty rules and the table of where
  documents are.
- **Links in this file** are written to resolve from `docs/submission/`. To apply it, copy
  the part below the line to `README.md` and run, from the repository root:
  `sed -i 's#\.\./\.\./##g; s#\.\./#docs/#g' README.md`. Then check the links again.

---

# TrueSouth

**A lunar landing site navigator for the NASA Space Apps 2026 challenge
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).**

TrueSouth answers one question: **"Where and when can this mission land?"** It turns NASA's
LOLA terrain and JPL Horizons positions into a skyline and an hourly record of the Sun and
Earth over six years (2026 to 2031) for 20 catalog sites and 5 best-lit variants. A server
can also compute custom coordinates on demand. A planner can then score any landing date
and mission profile. Mission Control is for planners and the Academy is for learners, and
both run on the same real data.

Landing at the Moon's south pole is hard for three reasons: the Sun stays within about two
degrees of the horizon, Earth bobs above and below the horizon each month, and mountains
block both. A small change in *where* or *when* you land can turn a workable mission into
a dead one.

The science is computed in Python from NASA data. The browser only scores those stored
results against the mission profile. The 3D shadows are decoration, never a result.

## Screenshots

Captured as each view was built, in `docs/design/c2/`:

| Picture | File | Shows |
| :--- | :--- | :--- |
| Mission Control | [`built-shell-feedback-after-1440.png`](../design/c2/built-shell-feedback-after-1440.png) | System view, "Selected sites" rail, "Focused site" panel, the bottom strip with the landing date and "Next GO" |
| Slip Planner | [`built-slip-1440.png`](../design/c2/built-slip-1440.png) | Status-and-score spots on the Moon above six-year landing-date strips |
| Polar map | [`built-polar-map-context-1440.png`](../design/c2/built-polar-map-context-1440.png) | The flat south-pole map with the rest of the Moon around its detailed square |
| Local terrain | [`built-ground-after-cr-terrain-lit.png`](../design/c2/built-ground-after-cr-terrain-lit.png) | The ground around a site with relief and drawn shadows, and Pip |
| Lander's eye | [`built-landers-eye-collapsed-1440-lit-open.png`](../design/c2/built-landers-eye-collapsed-1440-lit-open.png) | The 2 m horizon view with the 360° horizon chart open |
| Compare | [`built-compare-space-1440-four.png`](../design/c2/built-compare-space-1440-four.png) | Four sites side by side, with the landing date and exports in the header |
| Academy | [`built-lesson-steps-l1-drag-correct.png`](../design/c2/built-lesson-steps-l1-drag-correct.png) | Lesson 1: dragging the Sun to its highest point |
| Validation | [`built-validation-1440.png`](../design/c2/built-validation-1440.png) | Checks against JPL Horizons and NASA's maps (`/validation`) |

## The two modes

| Mode | For | What it does |
| :--- | :--- | :--- |
| **Mission Control** | Mission planners | Pick a mission profile and up to eight sites (or type custom coordinates), test landing dates in the **Slip Planner**, inspect any hour in the **System view**, **Polar map**, **Local terrain** and **Lander's eye**, compare sites in **Compare**, export CSV or JSON, and share a scenario as a link. |
| **Academy** | Students, educators, the public | Four lessons (*Where's the Sun?*, *Mountains steal sunlight*, *The Moon is round*, *Phone home*) with Luna, our moon mascot. Learners drag the Sun, sketch a skyline and find bugs in a calculation. Each lesson has an "Under the hood" formula card with real pipeline numbers. |

## What is built, and what is not

State as of **2026-11-14, `origin/main` at 69bb26e**.

**Built:**

- The Python science pipeline (`science/`) and the precomputed dataset for 20 catalog
  sites plus 5 best-lit variants (`data/derived/`).
- The FastAPI server (`api/`) for custom coordinates: 80 m terrain south of 80°S, 240 m
  from 80°S to 60°S, a smooth Moon north of 60°S; a queue with position and plain error
  messages. It needs NASA's prepared terrain maps for the terrain tiers; without them the
  app says custom sites are not available.
- Mission Control: the five camera views, the **Compare** window, CSV and JSON export,
  QuickMap and Moon Trek links, the **Share** link, the timeline and countdowns, and the
  "Add site" picker with "Enter coordinates".
- Academy lessons 1 to 4 with real worked examples and KaTeX cards, and a plain-language
  entry for every term.
- The validation page (`/validation`) and the Docker build.

**Not built, or out of scope for the deadline:**

- Academy lessons 5 to 8 (the path shows "Not written yet").
- A blocker ring and slope or height colour overlays on the 3D ground, and close-up 5 m
  terrain.
- Official Artemis region outlines on the Polar map (a ScienceBase login is needed).
- The "compute for my dates" sensitivity grid.
- Luna's final art. Her drawings are placeholders.

## Run it

You need Python 3.12 with [`uv`](https://docs.astral.sh/uv/), and Node 22 with `pnpm`.
The derived catalog data is committed, so you do not need to download NASA files to run the
app.

```bash
uv sync                                   # install Python dependencies
uv run pytest                             # Python tests
uv run uvicorn truesouth_api.main:app --reload --port 8000

pnpm --dir web install
pnpm --dir web dev                        # the web app on port 5173
pnpm --dir web test                       # web tests
pnpm --dir web typecheck
```

With Docker (the production build; catalog sites only unless NASA's prepared maps are
mounted):

```bash
docker compose up -d --build              # then open port 8080 on your machine
docker compose down                       # to stop it
```

Development needs no Docker. The stack, the folder layout and the data flow are in
[`docs/architecture.md`](../architecture.md).

## What is real, and what is assumed

- **Real:** the terrain (NASA LOLA), the Sun and Earth positions (JPL Horizons), and the
  skylines and hourly Sun and Earth record from 2026-01-01 to 2031-12-31. The Academy's
  lander, Pip, is fictional. Its data is not.
- **Sourced or assumed:** every number in a mission profile is tagged **sourced** (with a
  link) or **assumed** (our estimate, because none is published). We never show an assumed
  number as sourced. For IM-2 Athena only the 10-day length is sourced. Best-lit variants
  are labelled "chosen by TrueSouth", are upper readings and never win "best" in Compare.
  See [`docs/mission-profiles.md`](../mission-profiles.md).
- **Planning aid, not flight certification.** It models the stay on the surface only: no
  launch, transit, descent or return.

## How we know it is right

- Our Sun and Earth directions match JPL Horizons within **0.0061°** at all 20 catalog
  sites and every hour of six years: 2,103,360 comparisons (pass mark 0.02°). The raw
  compass bearing differs by more than 0.02° at 28 hours, up to 0.083°, all for the Sun
  almost overhead or underfoot at Apollo 11. It is reported and not gated.
- Nine pipeline gates (G1 to G9) pass. The web tests check TypeScript scoring against the
  Python reference on 76 shared cases (G10) and the generated types (G11).
- Across 59 comparisons against NASA's maps and against ourselves (`validation.json`), 54
  are within their marks and **5 are outside, published with explanations**: sunlight at
  Peak near Shackleton and at the best-lit variants of de Gerlache rim and Malapert Massif
  peak, Earth visibility at the de Gerlache rim variant, and skyline convergence at
  Connecting Ridge. Close-up slope (R4) and the sensitivity check (R6) are not run in this
  build.

Full results: [`docs/validation.md`](../validation.md) and `data/derived/validation.json`.

## Data sources and credits

| Source | Used for |
| :--- | :--- |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | Sun and Earth positions |
| LOLA 80 m and 240 m polar terrain, [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Skylines, slope, the 3D ground |
| LOLA average sunlight and Earth visibility, [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69) | Polar map overlays and validation |
| LOLA 5 m close-up maps, [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78) | Positions of Artemis candidate sites |
| [NASA SVS 4720](https://svs.gsfc.nasa.gov/4720) | Moon colour and height maps in the scene |
| Blue Marble Next Generation, NASA Earth Observatory | The Earth picture in the scene |
| Yale Bright Star Catalogue V/50 (NASA/ADC, HEASARC `bsc5p`) | The star background in the System view |

Credit lines as recorded with the images: "NASA Scientific Visualization Studio; LRO LROC and
LOLA teams. SVS 4720." and "NASA Earth Observatory, Reto Stöckli. Blue Marble Next
Generation, March 2004." NASA images are resized and re-encoded only, never retouched. Site
and mission-profile sources are in [`docs/site-catalog.md`](../site-catalog.md) and
[`docs/mission-profiles.md`](../mission-profiles.md).

## AI use

Most of this code was written by AI agents, under a human team lead who set the direction
and picked the designs. See [`docs/submission/ai-use.md`](../submission/ai-use.md) and the
"AI use" line of every entry in [`DEVLOG.md`](../../DEVLOG.md).

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
terms. CHECK (team lead): choose a licence (for example MIT for the code) and add a
`LICENSE` file before the repository is made public. Do not publish this section as
written.
