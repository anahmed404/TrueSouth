# Build plan

Who builds what, in what order, and how each piece is checked.

Each track's guide is in [`tracks/`](tracks/): what to do first, what to hand to whom, and
how to brief an AI agent. This page is the full list of work.

One orchestrator runs all four tracks and hands each work package to a coding agent. Its
prompt, its checkpoints and its record are in [`orchestration/`](orchestration/).

**Mission Control is space-first** ([`decisions/0013`](decisions/0013-space-first-mission-control.md)):
a 3D scene of the Sun, Earth and Moon fills the window and the interface floats above it.
So the scene (T1 and T2) comes first and is the base of Mission Control, a shell package
(MC4c) floats the existing panels over it, and the other camera views are camera moves in
the same scene. A new Science package (S16) makes the scene's image files.

## Tracks

Four tracks. A track owns folders. Tracks meet only at the seams listed in
[`tracks/README.md`](tracks/README.md), so several agents can write code at once without
colliding.

| Track | Owns | In one line |
| :--- | :--- | :--- |
| **Science** | `science/`, `api/`, `data/`, `Dockerfile`, `compose.yaml`, `docs/science.md`, `docs/data-contracts.md`, `docs/validation.md`, `docs/site-catalog.md`, `docs/mission-profiles.md` | Turns NASA data into derived files and serves custom sites |
| **Mission Control** | `web/package.json`, `web/src/app/`, `web/src/data/`, `web/src/state/`, `web/src/lib/scoring/`, `web/src/lib/time/`, `web/src/components/` (except `luna/`), `web/src/features/mission-control/`, `panorama/`, and their specs | The app shell and the planner tool's screens and logic |
| **3D and Map** | `web/src/features/three/`, `web/src/features/polar-map/`, `web/src/lib/geo/`, `web/public/textures/`, `docs/features/system-view.md`, `local-terrain.md`, `polar-map.md` | The System view, local terrain, polar map and custom sites |
| **Academy** | `web/src/features/academy/`, `web/src/features/validation/`, `web/src/components/luna/`, `web/src/lib/explain.ts`, `docs/academy/`, `docs/features/validation-page.md` | Lessons, Luna, explanations, the validation page, and reviewing the math |

Anyone may add a shared component to `web/src/components/` by pull request.

The Academy track also reviews every change to `docs/science.md`. Writing the
Under-the-hood cards is how the math gets a second pair of eyes.

## Working rules

- **Branch per work package:** `<track>/<id>-<short-name>`, for example
  `science/s6-skyline`. The track prefixes are `science`, `mc`, `map` and `academy`. Small
  pull requests into `main`.
- **`main` always runs** on the fixture data.
- **Fixtures first.** No web work waits for real data. The Science track delivers
  fixtures in milestone 0; real data replaces them later with no code change.
- **Contracts change by pull request,** reviewed by Science and every track that reads the
  format. Steps are in [`data-contracts.md`](data-contracts.md).
- **A work package is done** when its "done when" checks pass and a `DEVLOG.md` entry says
  so.

## Milestones

| # | Name | Goal |
| :--- | :--- | :--- |
| M0 | Foundations | Everyone can run the app on fixtures. Contracts and types exist. |
| M1 | Thin slice | One real site, end to end: real series and skyline for Connecting Ridge drive the System view scene, the Lander's eye view, the timeline, the countdowns and a status, in the floating shell. |
| M2 | Mission Control complete on catalog data | All catalog sites; the scene and its five camera views (System view, Polar map, Slip Planner, Local terrain, Lander's eye); the Compare window; Academy lessons 1–4. |
| M3 | Everything for the deadline | Validation page, share and export, Docker, the sharper Moon and the performance pass. Custom sites, the sensitivity grid and lessons 5–8 are out of scope for the deadline; see "Out of scope for the deadline". |
| M4 | Tuned and submitted | Presets tuned, validation reviewed, polish, submission materials. |

M1 is the point where the science and the contracts are proven. Do not start M2 features
that depend on real data until G2 in [`validation.md`](validation.md) passes.

## Work packages

Each row: id, what to build, the spec to read, what it depends on, and the milestone.
"Done when" for a feature is the list at the end of its spec; extra checks are noted here.

### Science

| Id | Build | Spec | Needs | M |
| :--- | :--- | :--- | :--- | :--- |
| S0 | `uv` workspace, `truesouth` package and CLI skeleton, `constants.py`, `contracts.py` v1, `export-schema` | [`architecture.md`](architecture.md), [`data-contracts.md`](data-contracts.md) | — | M0 |
| S1 | `data/catalog/` input files: `sites.json`, `profiles.json`, `features.json`, `artemis_regions.json` | [`site-catalog.md`](site-catalog.md), [`mission-profiles.md`](mission-profiles.md) | S0 | M0 |
| S2 | `scoring.py` reference and `build-fixtures`: a synthetic crater, a synthetic ephemeris, every derived file, and the scoring cases | [`science.md`](science.md) §9–10, [`validation.md`](validation.md) | S0, S1 | M0 |
| S3 | `frames.py` with tests (gate G3) | [`science.md`](science.md) §2 | S0 | M1 |
| S4 | `horizons.py`, `fetch-ephemeris`, `ephemeris.py`; per-site Horizons pulls for checking (gates G1, G2). Confirm the longitude sign and which lunar frame Horizons uses. | [`science.md`](science.md) §3 | S3 | M1 |
| S5 | `fetch-raw`, `prepare-dem`, `dem.py` sampling and tiers | [`architecture.md`](architecture.md) | S3 | M1 |
| S6 | `skyline.py` (gates G4–G6) | [`science.md`](science.md) §4–5 | S5 | M1 |
| S7 | `discs.py` (G7), `series.py` (G9), `build-sites` for series and skylines | [`science.md`](science.md) §6–7 | S4, S6 | M1 |
| S8 | `slope.py` (G8), `terrain_mesh.py`, close-up meshes; finish `build-sites` for all catalog sites | [`science.md`](science.md) §8, §13 | S5 | M2 |
| S9 | `maps.py`, `build-maps` | [`features/polar-map.md`](features/polar-map.md) | S5 | M2 |
| S10 | API: custom sites, job queue, rate limits, static mounts, `/api/health`. The custom-site job queue is out of scope for the deadline; static mounts and `/api/health` are not. | [`architecture.md`](architecture.md) | S7, S8 | M3 |
| S11 | `sensitivity.py` and its endpoint. **Out of scope for the deadline.** | [`science.md`](science.md) §12 | S10 | — |
| S12 | `validation.py`, `validate` (R1–R6), `build-worked-examples` | [`validation.md`](validation.md), [`academy/lessons.md`](academy/lessons.md) | S8 | M3 |
| S13 | `Dockerfile`, `compose.yaml`, the `init` service | [`architecture.md`](architecture.md) | S10 | M3 |
| S14 | Preset tuning checkpoint | [`mission-profiles.md`](mission-profiles.md) | S12 | M4 |
| S16 | Scene image files: a pipeline step, `build-scene-assets`, that makes the web-sized Moon, Earth and polar-cap images and the per-site surrounding-terrain grids reproducibly from NASA's files. Its outputs and formats must be defined in [`data-contracts.md`](data-contracts.md) and `contracts.py` before it is built. | [`features/system-view.md`](features/system-view.md) (Textures), [`data-contracts.md`](data-contracts.md) ("Proposed: scene image files"), [`features/local-terrain.md`](features/local-terrain.md) | S5, S9; the contract | M1 |

Extra checks:

- **S2:** `pnpm --dir web dev` with `VITE_DATA=fixtures` shows data for at least four
  fixture sites, one of them sphere-tier.
- **S4:** the largest difference in G2 is written to `DEVLOG.md`.
- **S7:** `build-sites` for one site finishes in under two minutes.
- **S10:** a custom polar site is ready in under 60 seconds on the development machine.
  Out of scope for the deadline; see below.
- **S16:**
  - Before any code: the files, their names, sizes, orientation and encoding are in
    `contracts.py` and `data-contracts.md`, reviewed by Science and the 3D and Map track.
  - Running the step twice gives byte-identical files, and the second run skips work that
    is up to date.
  - Every output is only a resize, crop, split or re-encode of a NASA file, or a map the
    pipeline already makes from NASA data. Nothing is retouched, painted or AI-generated.
    Each output's source file and the operation are recorded beside it, with the credit.
  - Sizes meet the budget in [`features/system-view.md`](features/system-view.md): no image
    over 1.6 MB, the whole set about 9.5 MB.
  - Orientation tests: Tycho, Mare Crisium and Shackleton land on the right pixels of the
    Moon image, using [`science.md`](science.md) §2; Shackleton's 20.9 km rim, drawn with
    the §2.3 formulas, sits on the crater in the cap image; Connecting Ridge falls on the
    ridge between Shackleton and de Gerlache.
  - A surrounding-terrain grid's centre height equals the site's `elevation_m` to within the
    encoding step, and its 20 km patch equals the heights `terrain.bin` was built from.
  - `fetch-raw` checks the new downloads exist before fetching them (the Moon colour maps at
    4K and 8K, the Moon height map, and Blue Marble), and the Moon and Earth files reach it
    through `truststore`.
  - The prototype's `design/variants/space-first/tools/make_assets.py` and
    `make_cap_slopes.py` and `assets/README.md` show what is needed. They are the reference,
    not the implementation: the step lives in `science/` and has pytest tests.

### Mission Control

| Id | Build | Spec | Needs | M |
| :--- | :--- | :--- | :--- | :--- |
| MC0 | Vite, React, TypeScript, Tailwind, router, theme tokens, start screen, `gen:types`, the Vite `/data` middleware and `/api` proxy, `panel.ts`, and a placeholder for every panel | [`architecture.md`](architecture.md), [`tracks/README.md`](tracks/README.md) | S0 | M0 |
| MC1 | `web/src/data/`: loaders and decoders for every derived file; the `data` store | [`data-contracts.md`](data-contracts.md) | MC0, S2 | M0 |
| MC2 | `lib/scoring/`: metrics, vetoes, utilities, score, status, countdowns (gate G10) | [`science.md`](science.md) §9–10 | MC0, S2 | M0 |
| MC3 | `scenario` store with URL sync | [`data-contracts.md`](data-contracts.md) | MC1 | M1 |
| MC4 | Mission Control panels: profile picker and editor, sites rail, focused-site panel, explain tooltips. Built docked as MC4a and MC4b; the panels are kept. | [`features/mission-control.md`](features/mission-control.md) | MC2, MC3 | M1 |
| MC4c | The space-first shell: float the MC4 panels, the app bar, the view bar and the timeline over the scene; folding; the free-space insets for the camera; the phone layout; keyboard use; the still-picture note. Placeholders stand in for the window contents until MC7 and MC9. | [`features/mission-control.md`](features/mission-control.md), [`../DESIGN.md`](../DESIGN.md) | MC4, T1 | M1 |
| MC5 | Timeline, scrubber, countdown cards, "why is it dark" card. A floating bar along the bottom that folds to one row. | [`features/site-detail.md`](features/site-detail.md) | MC4 | M1 |
| MC6 | Lander's eye: the horizon chart, its card and its controls, floating under the 3D horizon. The camera and the 3D horizon are T5. | [`features/panorama.md`](features/panorama.md) | MC4c | M1 |
| MC7 | The Slip Planner as a camera view on the Moon: the flight to the pole, a spot for each site, the landing-date panel (strips, "Any site", slider), hover and keyboard use, before and after a slip, and the flat-map fallback. Its sweep worker is done (MC7a). Design picked 2026-11-13: [`../design/variants/c2-slip-on-moon.md`](../design/variants/c2-slip-on-moon.md). | [`features/slip-planner.md`](features/slip-planner.md) | MC4c, T1 | M2 |
| MC9 | The Compare window; share and export; confirm the Quickmap and Moon Trek link formats | [`features/compare.md`](features/compare.md), [`features/share-export.md`](features/share-export.md) | MC7 | M3 |
| MC11 | Every loading, empty and error state, including the still picture and reduced motion; keyboard use; performance pass | all feature specs | all | M4 |

MC8 and MC10 were the polar map and custom sites. They moved to the 3D and Map track as T7
and T8, to even out the load. The other ids keep their numbers. MC4c is new: it is the step
from the docked shell (MC4a and MC4b) to the space-first one.

### 3D and Map

| Id | Build | Spec | Needs | M |
| :--- | :--- | :--- | :--- | :--- |
| T0 | React Three Fiber setup; `lib/geo/` helpers for scene coordinates, System view coordinates and the map projection, with unit tests for every axis and direction | [`science.md`](science.md) §2.3, §13–14 | MC0 | M0 |
| T1 | The scene, first and the base of Mission Control: Moon (4K colour map, height relief, the polar cap overlay), real-Sun lighting, Earth with its texture, the Sun drawn in code, pins, camera presets, camera moves, the free-space inset, rest and hidden-tab pausing, and the still-picture fallback. Until S16 lands the Moon is plain grey. | [`features/system-view.md`](features/system-view.md) | T0, MC1 | M1 |
| T2 | The scene: sight-lines from the series, labels and plates, the Sun edge marker, the "not to scale" line, true-scale toggle, playback | same | T1, MC3 | M1 |
| T7 | The Polar map as a camera destination: the flight to the pole and the swap to the flat map, relief, pins, labels, overlays, the instant nudge readout. The flat map can be built first and entered by cross-fade until T1 lands. | [`features/polar-map.md`](features/polar-map.md) | T0, MC1, MC2, T1 | M2 |
| T3 | Local terrain: the descent, the 20 km patch inside the surrounding terrain out to a curved horizon, lighting, shadows, lander marker, camera limits | [`features/local-terrain.md`](features/local-terrain.md) | T1, S16 | M2 |
| T4 | Local terrain: sight-lines, blocker marker, the series' plate. No skyline wall: the surrounding terrain replaces it. | same | T3 | M2 |
| T5 | Local terrain: overlays, close-up mesh, exaggeration, the Lander's eye camera and 3D horizon | same, [`features/panorama.md`](features/panorama.md) | T4, S8 | M3 |
| T6 | Start-screen Moon (reusing the scene), 3D embeds for Academy steps, performance pass: measure on a laptop with built-in graphics and tune the still-picture threshold | [`academy/overview.md`](academy/overview.md) | T2, T5 | M3 |
| T8 | Custom sites and "compute for my dates". **Out of scope for the deadline.** | [`features/polar-map.md`](features/polar-map.md) | T7, S10, S11 | — |

Extra check for T0: tests confirm azimuth 0° maps to −z, azimuth 90° to +x, elevation 90°
to +y, that the Moon's north pole maps to +y in the System view, and that a map pixel
converted to latitude and longitude and back returns the same pixel.

Extra checks for T1: the Moon never sits under a panel at 1440 × 900 or 390 × 844, folded or
open; the page renders no frames at rest; and with WebGL off the still picture shows.

T7 is built on fixture maps and switches to real ones when S9 lands.

### Academy

| Id | Build | Spec | Needs | M |
| :--- | :--- | :--- | :--- | :--- |
| A0 | Lesson types, the step runner, feedback flow, the `academy` store, path map | [`academy/overview.md`](academy/overview.md) | MC0 | M0 |
| A1 | Luna and LunaSays with placeholder art in all eight moods; celebrations | [`academy/luna.md`](academy/luna.md) | MC0 | M0 |
| A2 | Step components: `choice`, `predict`, `fill-formula`, `spot-bug`, `tune-slider` | [`academy/overview.md`](academy/overview.md) | A0 | M1 |
| A3 | Step components that embed panels: `drag-body`, `draw-skyline`, `drop-pin` | same | A2, MC6, T7 | M2 |
| A4 | Card renderer with KaTeX and worked-example placeholders | same | A0 | M1 |
| A5 | Lessons 1–4 and their cards | [`academy/lessons.md`](academy/lessons.md) | A2, A3, A4 | M2 |
| A6 | Lessons 5–8, their cards and the finale reveal. **Out of scope for the deadline.** | same | A5, MC7 | — |
| A7 | `explain.ts`: plain text for every glossary term used in the UI. A first draft of every key early in M1, so tooltips can be wired; polished by M2. | [`../CONTEXT.md`](../CONTEXT.md) | MC0 | M1 |
| A8 | Validation page | [`features/validation-page.md`](features/validation-page.md) | S12 | M3 |
| A9 | Math review: read `science.md` against the Python code, section by section; file every mismatch | [`science.md`](science.md) | S7 | M3 |
| A10 | Luna's final art | [`academy/luna.md`](academy/luna.md) | reference photos | M4 |
| A11 | Submission materials (below) | — | all | M4 |

Until worked examples exist (S12), lessons read a fixture `worked_examples.json`.

## Out of scope for the deadline

These keep their specs and their rows. They are not built before the deadline.

| Id | What | Where it shows in the specs |
| :--- | :--- | :--- |
| T8 | Custom sites and "compute for my dates" | [`features/polar-map.md`](features/polar-map.md), [`features/mission-control.md`](features/mission-control.md) |
| S10 (part) | The custom-site job queue and its routes | [`architecture.md`](architecture.md) |
| S11 | The sensitivity grid and its endpoint | [`features/polar-map.md`](features/polar-map.md) |
| A6 | Academy lessons 5 to 8, their cards and the finale reveal | [`academy/lessons.md`](academy/lessons.md) |

## Dependency picture

```text
M0   S0 ─► S1 ─► S2 ──────────────► MC1, MC2            MC0 ─► T0, A0, A1
M1   S3 ─► S4 ─┐                    MC3 ─► MC4 ─┐              T1 ─► T2     A7, A2, A4
           S5 ─► S6 ─► S7  (real site replaces fixture)   T1 ─► MC4c ─► MC5, MC6
           S5, S9 ─► S16 (scene images) ─► T1 textures, T3
M2   S8, S9                         MC7 (view)                 T7, T3 ─► T4   A3, A5
M3   S10 (static, health), S13   S12   MC9 (window)            T5, T6         A8, A9
M4   S14                            MC11                                  A10, A11
     out of scope: T8, S10 (job queue), S11, A6
```

## Open items to confirm during the build

| Item | Where it is settled |
| :--- | :--- |
| Horizons longitude sign for sub-points, and its lunar frame | S4 |
| Exact file name of the 240 m wide map | S5 (`fetch-raw` checks it) |
| Whether gate G2 can be met at 0.02° | S4; fallback in [`decisions/0004`](decisions/0004-one-global-ephemeris.md) |
| Preset values that give the Academy story both GO and NO-GO dates | S14 |
| Status threshold (score 70) | S14 |
| Quickmap and Moon Trek link formats | MC9: confirmed, see [`features/share-export.md`](features/share-export.md) |
| The still-picture threshold (a median frame over 55 ms in the first flight is a guess) | T6, measured on built-in graphics |
| Where the "why is it dark" card sits outside Lander's eye (a proposal) | MC5 |
| The names and encodings of the scene image files | S16, before it is built |
| Official outlines of the nine Artemis regions (USGS file needs a free login) | S1; see [`site-catalog.md`](site-catalog.md) |
| Luna's final look | A10 |

## Submission materials (A11)

From the Space Apps Cairo judging guide.

- **Project description:** the problem, who benefits, how it works, which NASA data it
  uses and how.
- **A map from challenge objectives to features,** one line each.
- **The demo story,** about three minutes:
  1. Open on the System view: the Sun, Earth and Moon, with the sites on the pole.
  2. "Pip's launch just slipped three weeks." Open the Slip Planner: the camera
     flies to the pole and the sites become spots.
  3. The site turns NO-GO. Hover to see why: a blackout.
  4. Slide to the next GO date; or switch to a site that is GO now.
  5. Fly down to the Lander's eye view and read the countdowns for that date.
  6. Scrub to a dark hour; the "why is it dark" card names the ridge; fly up to Local
     terrain, which shows it.
  7. Pull back to the System view.
  8. Switch to Apollo 11 for contrast.
  9. Thirty seconds of the Academy: one lesson step with Luna.
  10. The validation page's headline number.
- **A live link** that opens without logging in, and a recorded backup video.
- **AI-use disclosure,** from [`../DEVLOG.md`](../DEVLOG.md).
- **A check that every submitted link opens** in a private browser window.
