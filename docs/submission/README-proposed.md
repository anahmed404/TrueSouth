# TrueSouth (proposed README)

A proposed replacement for the repository's `README.md`. It is not applied. The real
README is unchanged.

## Review of the current README

Read against `origin/main` at **2026-11-14 (`origin/main` at `5a5fd84`)**:

- **Out of date:** "Planning is complete. No application code exists yet." Code exists:
  the science pipeline, the FastAPI custom-sites server, the web app, the 3D scene and flat
  Polar map, all five Mission Control views plus Compare, Academy lessons 1 to 4, the
  validation page, and the Docker build.
- **Out of date:** "Quick start (once code exists)". It runs today.
- **Missing:** screenshots, the validation headline, the data credits, the licence state,
  the Docker command, and an honest list of what is not built yet.
- **Still right:** the two modes, the one question, the honesty rules, and the table of
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
LOLA terrain and JPL Horizons positions into a 300 km skyline and an hourly record of the Sun
and Earth over six years (2026–2031) for 20 catalog sites, 5 TrueSouth best-lit variants, and
on-demand custom lunar coordinates, so a planner can score any landing date and mission profile
instantly. Mission Control is for planners and the Academy is for learners, and both run on
the same real data.

Landing at the Moon's south pole is hard for three reasons: the Sun skims the horizon at
1 to 2 degrees, Earth bobs above and below the horizon each month, and mountains block both.
A small change in *where* or *when* you land can turn a workable mission into a dead one.

## Screenshots

Current builds in `docs/design/c2/`:

| Picture | File | Shows |
| :--- | :--- | :--- |
| Mission Control | [`built-shell-feedback-after-1440.png`](../design/c2/built-shell-feedback-after-1440.png) | System view, Selected sites rail, Focused site panel, Timeline with Landing date & Next GO |
| Slip Planner | [`built-slip-1440.png`](../design/c2/built-slip-1440.png) | Status-and-score spots on the Moon above 6-year landing-date strips |
| Polar map | [`built-polar-map-1440.png`](../design/c2/built-polar-map-1440.png) | Flat south-polar relief map with pins, overlays, and instant nudge readout |
| Local terrain | [`built-ground-after-cr-terrain-lit.png`](../design/c2/built-ground-after-cr-terrain-lit.png) | 20 km terrain patch inside 300 km apron with illustrative relief, shadows, and Pip |
| Lander's eye | [`built-landers-eye-collapsed-1440-lit-open.png`](../design/c2/built-landers-eye-collapsed-1440-lit-open.png) | 2 m horizon view with the collapsible 360° horizon chart expanded |
| Compare window | [`built-compare-1440-four.png`](../design/c2/built-compare-1440-four.png) | Up to 8 sites side by side with deciding row, CSV/JSON export, and NASA map links |
| Academy | [`built-lessons-1440-path-after-four.png`](../design/c2/built-lessons-1440-path-after-four.png) | Eight-lesson spiral path over the south pole (lessons 1–4 playable) |
| Validation | [`built-validation-1440.png`](../design/c2/built-validation-1440.png) | Live verification against JPL Horizons and NASA PGDA maps (`/validation`) |

## The two modes

| Mode | For | What it does |
| :--- | :--- | :--- |
| **Mission Control** | Mission planners | Pick a mission profile and up to eight sites (or type custom coordinates), test landing dates in the **Slip Planner**, inspect any hour across **System view**, **Polar map**, **Local terrain**, and **Lander's eye**, compare sites in **Compare**, export CSV/JSON, and share scenarios by URL. |
| **Academy** | Students, educators, the public | Four playable lessons (*Where's the Sun?*, *Mountains steal sunlight*, *The Moon is round*, *Phone home*) with Luna, our moon mascot, and KaTeX "Under the hood" formula cards backed by real pipeline numbers. |

## What is built, and what is not

State as of **2026-11-14 (`origin/main` at `5a5fd84`)**.

**Built:**
- The Python science pipeline (`science/`) and precomputed dataset for 20 catalog sites plus 5 TrueSouth best-lit variants (`data/derived/`).
- The FastAPI backend (`api/`) with on-demand custom coordinate computation (`POST /api/sites/custom`, requiring prepared NASA maps mounted; returns `501` in catalog-only Docker).
- Mission Control: all five camera views (**System view**, **Polar map**, **Slip Planner**, **Local terrain**, **Lander's eye**), **Compare** floating window, CSV & JSON exports, confirmed LROC QuickMap & Moon Trek links, URL-synced **Share**, timeline & countdowns, and custom-coordinates UI.
- Academy lessons 1 to 4 playable with real `worked_examples.json` and KaTeX cards, plus plain-language explanations (`explain.ts`) on every term.
- Live Validation page (`/validation`) and Docker build (`Dockerfile`, `compose.yaml`).

**In review at draft time (not described as built yet):**
- `#93` scoring boundary refinement; `#94` science doc clarifications; `#95` interactive `drag-body` / `draw-skyline` panel steps in Academy lessons 1, 2 and 4 (currently showing Luna's preview and the real answer); `#96` custom-site queue position and G2 diagnostic fields.

**Not built / out of scope for the deadline:**
- Local terrain 3D blocker ring (`T4`), slope/height colour overlays & 5 m close-up mesh (`T5`), the 9×9 sensitivity grid (`S11`/`T8`), official USGS Artemis region outlines (ScienceBase login required), Academy lessons 5 to 8 (`A6`), and Luna's final hand-drawn art (`A10`).

## Run it

You need Python 3.12 with [`uv`](https://docs.astral.sh/uv/), and Node 22 with `pnpm`.
The derived catalog data is committed, so you do not need to download NASA files to run the app.

```bash
uv sync                                   # install Python dependencies
uv run pytest                             # Python tests
uv run uvicorn truesouth_api.main:app --reload --port 8000

pnpm --dir web install
pnpm --dir web dev                        # the web app on http://localhost:5173
pnpm --dir web test                       # web tests
pnpm --dir web typecheck
```

With Docker (production build, catalog sites only, custom coordinates disabled with HTTP 501 unless prepared NASA maps are mounted):

```bash
docker compose -p truesouth-s13 up -d --build   # then open http://localhost:8080
docker compose -p truesouth-s13 down            # to stop it
```

Development needs no Docker. The stack, the folder layout and the data flow are in
[`docs/architecture.md`](../architecture.md).

## What is real, and what is assumed

- **Real:** the terrain (NASA LOLA), the Sun and Earth positions (JPL Horizons), the
  skylines and the hourly Sun and Earth record from 2026-01-01 to 2031-12-31.
  The Academy's lander, Pip, is fictional. Its data is not.
- **Sourced or assumed:** every number in a mission profile is tagged **sourced** (with a
  link) or **assumed** (our estimate, because none is published). We never show an assumed
  number as sourced. For IM-2 Athena only the 10-day length is sourced. Best-lit variants
  are tagged **chosen by TrueSouth** as upper readings and never win "best" in Compare. See
  [`docs/mission-profiles.md`](../mission-profiles.md).
- **Planning aid, not flight certification.** It models the stay on the surface only: no
  launch, no transit, no descent, no return.

## How we know it is right

- Our Sun and Earth directions match NASA's JPL Horizons within **0.0061°** at all 20 catalog
  sites and every hour of six years: 2,103,360 comparisons (pass mark 0.02°). Raw compass
  azimuth exceeds 0.02° at 28 near-zenith/nadir hours at Apollo 11 (max 0.083°) and is
  reported openly.
- Nine pipeline geometry and encoding gates (G1 to G9) pass; TypeScript/Python scoring
  parity across 58 cases (G10) and generated-type parity (G11) pass in the web tests.
- Across 59 comparisons against NASA PGDA maps and self-convergence checks (`validation.json`),
  54 are within their marks and **5 outside-mark rows are published with explanations**
  (sunlight at Peak near Shackleton, `de_gerlache_rim_best_lit`, and `malapert_peak_best_lit`;
  Earth visibility at `de_gerlache_rim_best_lit`; and skyline convergence at Connecting Ridge).
  Close-up 5 m slope (`R4`) and sensitivity (`R6`) checks are not run in this build.

Full results: [`docs/validation.md`](../validation.md) and `data/derived/validation.json`.

## Data sources and credits

| Source | Used for |
| :--- | :--- |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | Sun and Earth positions |
| LOLA 80 m and 240 m polar terrain, [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Skylines, slope, 3D ground |
| LOLA average sunlight and Earth visibility, [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69) | Polar map context overlays and validation |
| LOLA 5 m close-up maps, [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78) | Positions of Artemis candidate sites |
| [NASA SVS 4720](https://svs.gsfc.nasa.gov/4720) | Moon colour and height maps in the scene |
| Blue Marble Next Generation, NASA Earth Observatory | The Earth picture in the scene |
| Yale Bright Star Catalogue V/50 (NASA/ADC, HEASARC `bsc5p`) | Star background in System view |

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
