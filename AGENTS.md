# Working in this repo

This file is read by Claude Code (through `CLAUDE.md`), Codex, Cursor and Antigravity.
It applies to human teammates too.

TrueSouth is a lunar landing site navigator with two modes: **Mission Control** (planner
tool) and **Academy** (guided lessons). Read [`README.md`](README.md) for the pitch.

## Before you write code

1. Read [`CONTEXT.md`](CONTEXT.md). Use its terms exactly; do not invent synonyms.
2. Read [`docs/tracks/README.md`](docs/tracks/README.md) and the guide for your track in
   [`docs/tracks/`](docs/tracks/). They say what you own and where tracks meet.
3. Find your work package in [`docs/build-plan.md`](docs/build-plan.md). It names the spec
   to read and the checks that define "done".
4. Read that spec. If the spec and the code disagree, stop and fix the spec first.

## Rules

**One source for everything.**
- A formula is defined in [`docs/science.md`](docs/science.md) and nowhere else. Other
  docs link to its section. Academy cards may quote a formula for learners, and must cite
  the section they quote. If the math changes, change it there, then the code, then the
  cards.
- A file or API format lives in `science/src/truesouth/contracts.py` (Pydantic). The
  TypeScript types in `web/src/contracts/generated.ts` are generated from it. Never edit
  the generated file by hand. Run `pnpm --dir web gen:types` after changing a contract.
- A plain-language explanation of a term lives in `web/src/lib/explain.ts`.

**Stay in your track's folders.** Each track owns folders listed in
[`docs/build-plan.md`](docs/build-plan.md). To change another track's folder, or any
contract, open a pull request that the owning track reviews.

**The frontend does not do terrain or ephemeris science.** Skylines, Sun and Earth
positions, and disc visibility are computed in Python. The frontend computes only mission
metrics and scores from those series (see
[`docs/decisions/0002-scoring-in-browser.md`](docs/decisions/0002-scoring-in-browser.md)).
WebGL shadows are decoration, never a result.

**Sourced or assumed.** Any mission number shown to a user carries a provenance tag.
Never present an assumed number as sourced. See
[`docs/mission-profiles.md`](docs/mission-profiles.md).

**Times are UTC.** Timestamps in files, APIs and the UI are UTC, ISO-8601, ending in `Z`.

**Angles are degrees** in files, APIs and the UI. Convert to radians only inside a
function.

**Tests come with the code.** Python science code needs pytest tests against known
geometry. TypeScript scoring code needs vitest tests against the shared fixture. UI is
tested by hand; do not add Playwright.

**Data.** Never commit `data/raw/` or `data/prepared/`. Do commit `data/derived/` and
`data/fixtures/`.

**Record what you did.** Add an entry to your track's section of
[`DEVLOG.md`](DEVLOG.md) when you finish a work package or hit a blocker, including its
AI-use line. Mark work "verified" only after its checks pass.

**Record why.** A choice that is hard to reverse, surprising, or a real trade-off gets a
short file in [`docs/decisions/`](docs/decisions/).

## Commands

```bash
uv sync                                   # install Python deps
uv run pytest                             # Python tests
uv run truesouth --help                   # pipeline commands
uv run uvicorn truesouth_api.main:app --reload --port 8000

pnpm --dir web install
pnpm --dir web dev                        # web app on :5173
pnpm --dir web test                       # vitest
pnpm --dir web typecheck
pnpm --dir web gen:types                  # regenerate TS types from Pydantic
```

Development uses no Docker. Docker is for the production build only; see
[`docs/architecture.md`](docs/architecture.md).

## This machine's network quirk

On the lead developer's Windows machine, Python and Git-Bash `curl` fail TLS verification
for some NASA hosts. The pipeline uses the `truststore` package so Python trusts the
Windows certificate store. Do not disable certificate checks.
