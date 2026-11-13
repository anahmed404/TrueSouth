# TrueSouth

**A lunar landing site navigator for the NASA Space Apps 2026 challenge
[Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/).**

Landing at the Moon's south pole is hard for three reasons: the Sun skims the horizon at
1–2°, Earth bobs above and below the horizon each month, and mountains block both.
A small change in *where* or *when* you land can turn a workable mission into a dead one.

TrueSouth answers one question fast: **"Where and when can this mission land?"**

It has two modes, and they are equally important:

| Mode | For | What it does |
| :--- | :--- | :--- |
| **Mission Control** | Mission planners | Pick a mission profile, pick sites, see every viable landing date, inspect any site and date from four linked views, compare sites, share the result. |
| **Academy** | Students, educators, the public (and us) | A 10–15 minute Duolingo-style story. Luna, a moon mascot, guides you through rebuilding the tool's logic step by step to land a small lander called Pip. |

Both modes run on the same real NASA data: JPL Horizons for Sun and Earth positions, and
LOLA laser-altimeter terrain for the skyline.

## Status

Planning is complete. No application code exists yet. Start with
[`docs/tracks/README.md`](docs/tracks/README.md), then your own track's guide.

## Where things are

| File | Read it when you need… |
| :--- | :--- |
| [`AGENTS.md`](AGENTS.md) | The rules for working in this repo (humans and AI agents). |
| [`CONTEXT.md`](CONTEXT.md) | The meaning of a project term. |
| [`docs/tracks/`](docs/tracks/) | Your own guide: one per person, plus how the four fit together. |
| [`docs/build-plan.md`](docs/build-plan.md) | Who builds what, in what order, and how "done" is checked. |
| [`docs/architecture.md`](docs/architecture.md) | The stack, the repo layout, how data flows, how to run it. |
| [`docs/science.md`](docs/science.md) | Every formula, derived once. |
| [`docs/data-contracts.md`](docs/data-contracts.md) | Exact file and API formats. |
| [`docs/mission-profiles.md`](docs/mission-profiles.md) | The real-mission presets and where each number comes from. |
| [`docs/site-catalog.md`](docs/site-catalog.md) | The site list with coordinates and sources. |
| [`docs/validation.md`](docs/validation.md) | How we know the results are right. |
| [`docs/features/`](docs/features/) | One spec per Mission Control feature. |
| [`docs/academy/`](docs/academy/) | The Academy: mechanics, Luna, and the eight lessons. |
| [`docs/decisions/`](docs/decisions/) | Why we chose what we chose. |
| [`DEVLOG.md`](DEVLOG.md) | What has been built so far, and the AI-use disclosure. |

## Quick start (once code exists)

```bash
# Science pipeline and API (Python 3.12, uv)
uv sync
uv run truesouth build-fixtures        # small synthetic dataset, no downloads
uv run uvicorn truesouth_api.main:app --reload --port 8000

# Web app (Node 22, pnpm)
pnpm --dir web install
pnpm --dir web dev                     # http://localhost:5173
```

The full pipeline, the real NASA downloads and the production Docker build are described in
[`docs/architecture.md`](docs/architecture.md).

## Honesty rules

TrueSouth is a planning aid, not flight certification.

- Every number in a mission profile is tagged **sourced** (with a link) or **assumed**.
- Raw measurements are always shown next to any score.
- Where our result disagrees with NASA's published maps, the validation page shows the gap.
