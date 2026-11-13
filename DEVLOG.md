# Development log

What has been built, what is blocked, and how AI tools were used.

## How to use this file

- Add an entry when you finish a work package, hit a blocker, or change a contract.
- **Write only in your own track's section.** That keeps four people's entries from
  colliding when branches merge.
- Newest entries go at the top of your section.
- Say **verified** only when the work package's checks have passed. Otherwise say
  **built, not verified**.
- Keep entries short. Details belong in the pull request.

Entry format:

```markdown
#### YYYY-MM-DD · <work package id> · <one-line summary>
- **Who:** <name>
- **AI use:** <tool> — <what it produced> — <how you checked it>
- **State:** verified | built, not verified | blocked
- **Changed:** <folders or key files>
- **Notes:** <anything the next person must know; measured numbers; open questions>
```

The **AI use** line is required. Space Apps asks teams to disclose how AI was used, and
these lines are collected into the submission (work package A11).

- Name the tool and what it produced. "Codex wrote the first version of `skyline.py`" is
  useful. "Used AI for coding" is not.
- Say how a human checked it: which tests, which review.
- List AI-generated images, audio or video separately, with the tool that made them.
- NASA data and logos are never AI-generated or altered.

Tools the team uses: Claude Code, Codex, Cursor, Antigravity.

## Status board

Ids are from [`docs/build-plan.md`](docs/build-plan.md). The team lead updates this at
each integration checkpoint.

| Milestone | State |
| :--- | :--- |
| M0 Foundations | not started |
| M1 Thin slice | not started |
| M2 Mission Control complete on catalog data | not started |
| M3 Everything | not started |
| M4 Tuned and submitted | not started |

## Science

#### 2026-11-13 · S1 · Catalog inputs and validated loaders
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — built catalog inputs, contracts, loaders and document comparison tests — automated checks run; human review pending
- **State:** verified (the orchestrator, Claude Fable 5.2, counted the sourced and assumed values against the presets table and ran the tests; Antigravity, gemini-4-hydrogen compared every value, link, quotation and coordinate with the two documents and tried to break the tests; its findings, one wrong reason and three weak tests, were fixed by the orchestrator; 20 sites, 5 presets, 15 features, 9 regions; 14 values sourced, 46 assumed)
- **Changed:** data/catalog, science catalog and tests, contracts, schema, data-contract documentation
- **Notes:** 20 sites, 5 presets, 15 named features and 9 Artemis regions; 14 sourced and 46 assumed profile values. Region centres and sizes are null where unpublished; representative DEM points are sites.

#### 2026-11-13 · S3 · Site-centred frames and polar projection
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — wrote geometry tests and `frames.py` — agent ran pytest; the orchestrator has not checked it yet
- **State:** verified (the orchestrator, Claude Fable 5.2, compared each function with docs/science.md section 2 and ran the tests; Cursor, grok-4.7 reviewed the math with hand cases near the south pole, checked the pyproj setup, compared results with web/src/lib/geo, and approved; gate G3 measured 3.1e-9 m against a 0.01 m limit)
- **Changed:** `science/src/truesouth/frames.py`, `science/tests/test_frames.py`, this entry
- **Notes:** G3 largest error: 3.0886440072208643e-9 m (inverse); forward: 1.1524528889697587e-9 m.

#### 2026-11-13 · S0 · Python workspace and contracts
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — implemented workspace, contracts and CLI — automated checks run; human review pending
- **State:** verified (the orchestrator, Claude Fable 5.2, ran uv sync, the tests, the CLI and the schema export, and confirmed by running the models that each of the review's five must-fix gaps is closed; Cursor, grok-4.7 reviewed the pull request field by field against the docs; 30 tests, 49 models)
- **Changed:** Python workspace, science, api, schema and data contract documentation
- **Notes:** Review fixes: closed provenance and layouts, flat worked examples, validations, descriptions, feature IDs, documentation and expanded tests.


## Mission Control

#### 2026-11-13 · MC0 · Web scaffold with panel placeholders
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the Vite app, router, theme tokens, data middleware,
  panel placeholders and tests — the orchestrator (Claude Fable 5.2) read the diff, ran the
  tests, typecheck and build, and probed every route and the `/data` middleware on a
  running dev server; Antigravity, gemini-3.8-flash reviewed the pull request
- **State:** verified
- **Changed:** `web/`, this entry
- **Notes:**
  - Every screen is a plain placeholder until the design choice at checkpoint C1.
  - S0 had not merged, so `panel.ts` has a temporary `MissionProfile` and `generated.ts`
    does not exist yet. Both are replaced when S0 lands.
  - The sample scenario on `/mission` is hard-coded: profile `{ id: "im2_athena" }`,
    landing date and current time `2028-03-01T00:00:00Z`, no sites. MC3 replaces it.
  - Review fixes: the pnpm release-age exception for `motion` 14.13.0 was removed and the
    lockfile resolves 14.12.0; `/data` responses send a content type; the dev-server path
    helper moved from `web/src/app/` to `web/dev/`.
  - Measured: 4 vitest tests pass; production bundle 259 kB (82 kB gzipped).

## 3D and Map

#### 2026-11-13 · T0 · Coordinate helpers and a shared Canvas mount
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote `web/src/lib/geo/` (tests first), the `SceneCanvas` wrapper and this entry — not checked by a human; the orchestrator marks this verified after `pnpm --dir web test`, typecheck and build
- **State:** verified (the orchestrator, Claude Fable 5.2, compared every helper with docs/science.md and ran the tests, typecheck and build; Antigravity, gemini-4-hydrogen reviewed the math and found an angle-wrap bug, a hard-coded bin count and three test blind spots, all fixed by the orchestrator; 64 tests pass)
- **Changed:** `web/src/lib/geo/`, `web/src/features/three/scene-canvas.tsx`, this entry
- **Notes:**
  - The two view placeholders are unchanged. `SceneCanvas` is not mounted yet, so the production bundle stays 259 kB.
  - Angles in and out of the helpers are degrees. Local terrain is kilometres in the scene; the System view uses Moon radius 1.
  - A map pixel is the centre of that pixel. The south pole is the centre pixel of an odd-sized image. The 7,600 px map is even, so the pole sits on the shared corner of the four central pixels.
  - `|latitude| > 89.999°` throws for the local frame and for walking. The sphere point and the Sun-elevation formula still accept the poles.

## Academy

#### 2026-11-13 · A7 · `explain.ts`: a plain-language entry for every term a user meets
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-sonnet-5-5 — wrote the 113 entries in
  `web/src/lib/explain.ts` and the vitest checks in `explain.test.ts` — checked by the
  agent with the tests, typecheck and build, and by two read-throughs of every entry: once
  as a reader with no background, once against `docs/science.md`. A human has not read
  the text yet.
- **State:** verified (the orchestrator, Claude Fable 5.2, ran the tests, typecheck and build and applied the review's corrections; Antigravity, gemini-4-hydrogen checked every entry against CONTEXT.md and docs/science.md and asked for seven wording fixes and five lesson-link fixes, all made)
- **Changed:** `web/src/lib/explain.ts`, `web/src/lib/explain.test.ts`, this entry
- **Notes:**
  - Every glossary term in CONTEXT.md (except the developer-only ones), every profile
    field, and every metric, veto, utility and status has an entry. Each entry can link
    to the lesson that teaches it (`lesson`).
  - Callers can now type a term with `ExplainTerm`; `explanations` is still a plain
    record, so `Explain.tsx` needs no change.
  - The test reads `CONTEXT.md` and `docs/mission-profiles.md`, so a new glossary term
    or profile field fails the tests until it is explained.
  - Vetoes and utilities are keyed `veto_slope`, `utility_slope` and so on, because
    `blackout` is already a glossary term. First draft; a polish pass is due.

#### 2026-11-13 · A0 · Lesson types, step runner, feedback flow, academy store, path map
- **Who:** Cursor agent, for the orchestrator
- **AI use:** Cursor, grok-4.7 — wrote the lesson types, pure step runner, placeholder
  substitution, `academy` store, sample lesson and plain placeholder screens — the agent
  ran `pnpm --dir web test`, `typecheck` and `build`; the orchestrator has not verified
  this yet
- **State:** verified (the orchestrator, Claude Fable 5.2, read the runner against the spec's game rules and ran the tests, typecheck and build; Antigravity, gemini-3.8-flash reviewed the pull request and approved)
- **Changed:** `web/src/features/academy/`, this entry
- **Notes:**
  - Screens are plain placeholders until the design choice. The sample lesson id is
    `sample`, at `/academy/sample`. A5 replaces it. It is not one of the eight lessons.
  - Goal checks go through an injected evaluator. `stub-evaluator.ts` returns a fixed
    boolean until MC2. The sample passes every goal.
  - Progress is stored at `truesouth.academy.v1`. The store takes a storage object, so
    the tests do not need a DOM. Best stars and best XP are kept. The ninth mission
    patch is `all-eight`, after the eight catalog lessons.
  - Spec questions are in the pull request.

#### 2026-11-13 · A1 · Luna and LunaSays with placeholder art in eight moods; celebrations
- **Who:** Claude Code agent, for the orchestrator
- **AI use:** Claude Code, claude-opus-5-5 — wrote `Luna`, `LunaSays`, `LunaCelebration`,
  `LunaGallery`, the motion logic and its vitest tests — checked by the agent with the
  tests, typecheck and build, and by eye in a browser at 160 px, 48 px, 390 px wide and
  with reduced motion. **AI-generated images:** the eight placeholder Luna mood drawings
  (inline SVG in `web/src/components/luna/art/`), made by Claude Code, claude-opus-5-5.
- **State:** verified (the orchestrator, Claude Fable 5.2, read the diff, ran the tests, typecheck and build, and looked at all eight moods at 160 px and 48 px on a running page; Cursor, grok-4.6 reviewed the pull request and approved)
- **Changed:** `web/src/components/luna/`
- **Notes:** Luna's look lives only in `art/`; the seam is documented at the top of
  `art/index.ts`. To look at it, mount `LunaGallery` (exported from
  `components/luna`) on a temporary route. Reduced motion follows the system setting
  live, or a `reduceMotion` prop.

## Planning

#### 2026-11-13 · planning · One orchestrator runs all four tracks
- **Who:** team lead
- **AI use:** Claude Code — wrote `docs/orchestration/` — team lead set the rules it
  encodes
- **State:** verified (documents only)
- **Changed:** `docs/orchestration/`, `docs/tracks/README.md`, `docs/build-plan.md`,
  `docs/academy/luna.md`
- **Notes:** A Claude Fable 5.2 session hands work packages to agents on Claude Code,
  Codex, Cursor (Grok models only) and Antigravity (Google models only). All UI work goes
  to Claude Opus 5.5. It stops at six checkpoints for review and shows design variants
  before any final UI. Luna stays a placeholder until the last milestone.

#### 2026-11-13 · planning · Work split into four tracks with a guide each
- **Who:** team lead
- **AI use:** Claude Code — wrote `docs/tracks/` and moved the polar map and custom sites
  from Mission Control to the 3D and Map track — team lead reviewed the split
- **State:** verified (documents only)
- **Changed:** `docs/tracks/`, `docs/build-plan.md`, `AGENTS.md`, `README.md`, this file

#### 2026-11-13 · planning · Plan rewritten as an implementation-ready doc set
- **Who:** team lead
- **AI use:** Claude Code — reviewed the first plan against the challenge text and the
  judging guide, researched NASA data products and mission facts, and wrote the documents
  in `docs/` — team lead answered every design question and approved the result
- **State:** verified (documents only; no application code exists)
- **Changed:** replaced the three `lunar_navigator_*.md` files with `README.md`,
  `AGENTS.md`, `CONTEXT.md`, `DEVLOG.md` and `docs/`.
- **Notes:**
  - Main changes: two modes (Mission Control and Academy); mission profiles named after
    real missions; Slip Planner; Lander's eye view; System view; a site-centred local
    frame; one global ephemeris; Sun and Earth as discs.
  - A real Horizons run for Connecting Ridge (December 2026) showed the earlier fixed
    limits would have made every polar site NO-GO. See
    [`docs/decisions/0007-mission-profiles.md`](docs/decisions/0007-mission-profiles.md).
  - Open items are listed in [`docs/build-plan.md`](docs/build-plan.md).

#### 2026-11-13 · planning · First planning notes committed
- **Who:** team
- **AI use:** not recorded
- **State:** superseded
- **Changed:** `lunar_navigator_tech_decisions.md`,
  `lunar_navigator_team_implementation_plan.md`, `lunar_navigator_development_log.md`
  (commit `76bb523`; still in git history).
