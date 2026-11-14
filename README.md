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

Built by team **Landing Went South** for NASA Space Apps Cairo 2026.

## Screenshots

Captured as each view was built, in `docs/design/c2/`:

| Picture | File | Shows |
| :--- | :--- | :--- |
| Mission Control | [`built-shell-feedback-after-1440.png`](docs/design/c2/built-shell-feedback-after-1440.png) | System view, "Selected sites" rail, "Focused site" panel, the bottom strip with the landing date and "Next GO" |
| Slip Planner | [`built-slip-1440.png`](docs/design/c2/built-slip-1440.png) | Status-and-score spots on the Moon above six-year landing-date strips |
| Polar map | [`built-polar-map-context-1440.png`](docs/design/c2/built-polar-map-context-1440.png) | The flat south-pole map with the rest of the Moon around its detailed square |
| Local terrain | [`built-ground-after-cr-terrain-lit.png`](docs/design/c2/built-ground-after-cr-terrain-lit.png) | The ground around a site with relief and drawn shadows, and Pip |
| Lander's eye | [`built-landers-eye-collapsed-1440-lit-open.png`](docs/design/c2/built-landers-eye-collapsed-1440-lit-open.png) | The 2 m horizon view with the 360° horizon chart open |
| Compare | [`built-compare-space-1440-four.png`](docs/design/c2/built-compare-space-1440-four.png) | Four sites side by side, with the landing date and exports in the header |
| Academy | [`built-lesson-steps-l1-drag-correct.png`](docs/design/c2/built-lesson-steps-l1-drag-correct.png) | Lesson 1: dragging the Sun to its highest point |
| Validation | [`built-validation-1440.png`](docs/design/c2/built-validation-1440.png) | Checks against JPL Horizons and NASA's maps (`/validation`) |

## The two modes

| Mode | For | What it does |
| :--- | :--- | :--- |
| **Mission Control** | Mission planners | Pick a mission profile and up to eight sites (or type custom coordinates), test landing dates in the **Slip Planner**, inspect any hour in the **System view**, **Polar map**, **Local terrain** and **Lander's eye**, compare sites in **Compare**, export CSV or JSON, and share a scenario as a link. |
| **Academy** | Students, educators, the public | Four lessons (*Where's the Sun?*, *Mountains steal sunlight*, *The Moon is round*, *Phone home*) with Luna, our moon mascot. Learners drag the Sun, sketch a skyline and find bugs in a calculation. Each lesson has an "Under the hood" formula card with real pipeline numbers. |

## What is built, and what is not

State as of **2026-11-14**.

**Built:**

- The Python science pipeline (`science/`) and the precomputed dataset for 20 catalog
  sites plus 5 best-lit variants (`data/derived/`).
- The FastAPI server (`api/`) for custom coordinates: 80 m terrain south of 80°S, 240 m
  from 80°S to 60°S, a smooth Moon north of 60°S; a queue with position and plain error
  messages. It needs NASA's prepared terrain maps for the terrain tiers; without them the
  app says custom sites are not available.
- Mission Control: the five camera views, the **Compare** window (the selected sites on one
  landing date, or two sites on two landing dates), CSV and JSON export,
  QuickMap and Moon Trek links, the **Share** link, the timeline and countdowns, and the
  "Add site" picker with "Enter coordinates".
- Academy lessons 1 to 4 with real worked examples and KaTeX cards, and a plain-language
  entry for every term.
- Close-up ground from NASA's 5 m maps under the lander in Local terrain and Lander's eye,
  at the 16 sites those maps cover. It is used for drawing only; the results still come
  from the 80 m map.
- The validation page (`/validation`) and the Docker build.

**Next steps:** more Academy lessons (the path shows lessons 5 to 8 as "Not written yet")
and the official Artemis region outlines on the Polar map.

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
[`docs/architecture.md`](docs/architecture.md). Putting it on a server behind HTTPS is
described in [`docs/deploy.md`](docs/deploy.md).

## What is real, and what is assumed

- **Real:** the terrain (NASA LOLA), the Sun and Earth positions (JPL Horizons), and the
  skylines and hourly Sun and Earth record from 2026-01-01 to 2031-12-31. The Academy's
  lander, Pip, is fictional. Its data is not.
- **Sourced or assumed:** every number in a mission profile is tagged **sourced** (with a
  link) or **assumed** (our estimate, because none is published). We never show an assumed
  number as sourced. For IM-2 Athena only the 10-day length is sourced. Best-lit variants
  are labelled "chosen by TrueSouth", are upper readings and never win "best" in Compare.
  See [`docs/mission-profiles.md`](docs/mission-profiles.md).
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

Full results: [`docs/validation.md`](docs/validation.md) and `data/derived/validation.json`.

## Data sources and credits

| Source | Used for |
| :--- | :--- |
| [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/) | Sun and Earth positions |
| LOLA 80 m and 240 m polar terrain, [PGDA product 90](https://pgda.gsfc.nasa.gov/products/90) | Skylines, slope, the 3D ground |
| LOLA average sunlight and Earth visibility, [PGDA product 69](https://pgda.gsfc.nasa.gov/products/69) | Polar map overlays and validation |
| LOLA 5 m close-up maps, [PGDA product 78](https://pgda.gsfc.nasa.gov/products/78) | Representative points for six Artemis candidate regions; close-up ground tiles for 16 sites |
| [NASA SVS 4720](https://svs.gsfc.nasa.gov/4720) | Moon colour and height maps in the scene |
| Blue Marble Next Generation, NASA Earth Observatory | The Earth picture in the scene |
| Yale Bright Star Catalogue V/50 (NASA/ADC, HEASARC `bsc5p`) | The star background in the System view |

Credit lines as recorded with the images: "NASA Scientific Visualization Studio; LRO LROC and
LOLA teams. SVS 4720." and "NASA Earth Observatory, Reto Stöckli. Blue Marble Next
Generation, March 2004." NASA images are resized and re-encoded only, never retouched. Site
and mission-profile sources are in [`docs/site-catalog.md`](docs/site-catalog.md) and
[`docs/mission-profiles.md`](docs/mission-profiles.md).

## AI use

Most of this code was written and reviewed by AI coding agents, under the direction of the
team, who tested the running app, chose between designs and made the decisions. See [`docs/submission/ai-use.md`](docs/submission/ai-use.md) and the
"AI use" line of every entry in [`DEVLOG.md`](DEVLOG.md).

## Where things are

| File | Read it when you need... |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | The rules for working in this repo (humans and AI agents). |
| [`CONTEXT.md`](CONTEXT.md) | The meaning of a project term. |
| [`docs/challenge.md`](docs/challenge.md) | What the challenge asks, and where TrueSouth answers it. |
| [`docs/build-plan.md`](docs/build-plan.md) | Who builds what, and how "done" is checked. |
| [`docs/science.md`](docs/science.md) | Every formula, derived once. |
| [`docs/data-contracts.md`](docs/data-contracts.md) | Exact file and API formats. |
| [`docs/decisions/`](docs/decisions/) | Why we chose what we chose. |
| [`DEVLOG.md`](DEVLOG.md) | What has been built, and the AI-use disclosure. |

## Licence

The code in this repository is released under the [MIT License](LICENSE).

NASA's data and images are not ours to license. They keep their own terms and credits, as
listed under "Data sources and credits" above; the files derived from them in
`data/derived/` are provided with those credits. The TrueSouth name and the drawings of
Luna and Pip are the team's.
