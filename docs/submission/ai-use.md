# AI-use disclosure

For the Space Apps submission. Compiled from the "AI use" and "State" lines in
[`../../DEVLOG.md`](../../DEVLOG.md) and from [`../orchestration/`](../orchestration/)
(the orchestrator prompt and `status.md`). State as of **2026-11-14 (`origin/main` at `5a5fd84`)**.

## In short

AI tools wrote most of TrueSouth's code, tests and documents. A human team lead set the
direction, picked every design and every scope change, and made the science-method
decisions. Every package was checked by tests and, in almost all cases, by a second AI
agent from a different provider. Large parts of the code have had no line-by-line human
review. We say so below.

## Which tools and models

| Tool | Models | Used for |
| :--- | :--- | :--- |
| Claude Code | Claude Fable 5.2 (the orchestrator session), `claude-opus-5-5`, `claude-sonnet-5-5` | Planning and the documents; the user-interface code (shell, timeline, Lander's eye, Slip Planner, Compare, custom-site UI, Academy lessons & validation page); the 3D scene & Polar map; design prototypes; submission documents |
| Codex | `gpt-6.1-sol`, `gpt-6.1-terra` | The Python science pipeline: frames, ephemeris, skylines, discs, series, placement/variants, validation, math review (`A9`); reviews |
| Cursor | `grok-4.7`, `grok-4.6` (Grok models only) | Scaffolding, the data layer, scoring in TypeScript, the sweep worker, custom-sites API, Docker build, scene images, worked examples; reviews |
| Antigravity | `gemini-4-argon`, `gemini-4-hydrogen`, `gemini-3.8-flash` (Google models only) | Reviews, including independent re-derivations of the science |
| `impeccable` design skill (version 4.9.0), used inside Claude Code | | Design critique and polish of the interface |

`claude-haiku-5-5` was allowed in the orchestrator rules but does not appear in the usage
ledger.

## What work, by kind

- **Planning.** Claude Code reviewed the first plan against the challenge text and the
  judging guide, researched NASA data products and mission facts, and wrote the plan, the
  specs, the glossary and the decision records.
- **Orchestration.** One Claude Fable 5.2 session handed each work package to a coding
  agent, read the results, ran tests and browser checks, merged them and kept the record in
  `docs/orchestration/status.md` (through PR #71) and `DEVLOG.md`. The rules it followed are
  in `docs/orchestration/orchestrator-prompt.md`.
- **Code.** The Python science pipeline, the FastAPI custom-sites server and Docker build,
  the web app, the TypeScript scoring port and sweep worker, the 3D scene and flat Polar
  map, the Academy screens and lessons 1–4, the validation page, and the tests were written
  by agents.
- **Design.** Claude Code, with the `impeccable` skill, made the interface prototypes. The
  team lead picked among them (for example, C2 space-first layout and the Slip Planner as a
  view on the Moon).
- **Writing.** Claude Code wrote the Academy lesson text, the plain-language explanations
  (`explain.ts`), and these submission documents.
- **Review.** Agents reviewed other agents' work, usually from a different provider (below).

## How the work was checked

- **Tests.** Python science code has pytest tests against known geometry. TypeScript
  scoring code has vitest tests against a shared fixture, so it matches the Python
  reference to 1e-9. The orchestrator's rule was to run both suites before every merge. At
  `origin/main` (`5a5fd84`, `DEVLOG.md` MC7 entry), **425 Python tests** and **2,317 web
  tests** passed alongside typecheck and the production build.
- **Validation gates.** Eleven gates (G1 to G11) and 59 reported comparisons against NASA's
  own maps and self-convergence checks. Gate G2 compares our Sun and Earth directions with
  JPL Horizons at 2,103,360 points. The results—including the 5 comparisons outside their
  marks—are published in [`../validation.md`](../validation.md), `data/derived/validation.json`,
  and on `/validation`.
- **Cross-provider review.** The usage ledger in `status.md` has 87 rows (counted from the
  table rows that begin with a 2026 date, through PR #71). 30 of those rows are titled
  "Review of ...". Later packages (#73 to #92) continued cross-provider review and
  mutation checks as recorded in `DEVLOG.md` (for example: Codex reviewed `A5`, `A8`, `T3`,
  `MC-sites`; Gemini reviewed `T1/T2`, `MC6`, `Scene polish`, `MC9`; Cursor reviewed `T7`,
  `MC7`). Reviewers were asked to run and to mutate the code and caught real defects (such
  as a wrong rounding rule in scoring, an angle wrap in geometry helpers, and a missing
  decoration disclosure in tight free spaces).
- **Exceptions.** The orchestrator itself reviewed S9 (polar map images) and S16 (scene
  images) because other providers were unavailable, and recorded that in `status.md`. Design
  prototypes received the orchestrator's visual check without cross-provider review.
  `status.md` stops at #71, so its ledger row counts leave out packages #73 to #92.
- **Independent recomputation.** For example, the orchestrator and Codex recomputed the
  Academy's worked examples and lessons 1–4 answers against the stored series, and Cursor
  independently re-derived the Polar map projection and Slip Planner sweep.
- **By eye.** User interface work was checked in headless Chromium at 1440 × 900,
  1024 × 768, and 390 × 844, and 3D WebGL views (including Local terrain shadows and
  Slip Planner) were checked on hardware WebGL (RTX 2060, ANGLE D3D11). A laptop with
  built-in graphics has not yet been measured (`T6` performance pass incomplete).
- **Human review.** In 33 of the 59 real entries in `DEVLOG.md`, the `AI use` line says a
  human has not yet reviewed the code (36 of 59 across both `AI use` and `State` lines, e.g.
  "not yet seen by the team lead" or "human review pending"). The team lead reviewed designs
  and product decisions at checkpoints, not every line of code.

## What humans decided

The team lead decided, among other things:

- The product's two modes and the challenge reading (custom coordinates came back into
  scope after the team lead and orchestrator read the full challenge page).
- The look: plain dark mode, no purple, no glow, less on screen (checkpoint C1).
- The Academy's screens (lesson path, lesson step, lesson complete) and the green check for
  a correct answer.
- Mission Control as a space-first 3D scene (decision 0013), and the Slip Planner as a view
  on the Moon (design picked 2026-11-13).
- System view controls (free trackball over both poles, removing the distances plate), and
  removing the view-bar sentence plate so the scene keeps the room.
- A small code-built lander (Pip) in the 3D view.
- Gate G2 compares directions on the sky (decision 0011) and sunlit peaks keep their listed
  point alongside a TrueSouth best-lit variant and nearby range (decision 0012).
- What is out of scope for the deadline: custom-site sensitivity grid (`S11`/`T8`),
  Academy lessons 5 to 8 (`A6`), and official USGS Artemis region outlines.

Where the team lead did not answer a question, the rule was that the orchestrator's
recommendation stood. `docs/orchestration/status.md` records early cases under "Decisions
the orchestrator made".

## AI-generated images and media

- The eight placeholder drawings of Luna, the mascot, are inline SVG made by Claude Code
  (`claude-opus-5-5`, `web/src/components/luna/art/`). The final art is not made yet.
- The two start-screen porthole drawings are inline SVG ported by Claude Code
  (`claude-opus-5-5`, `web/src/app/start/portholes.tsx`) from a prototype. The skyline in
  them is a made-up curve, not data.
- Lesson 3's reveal includes a side-view schematic of the curved Moon drawn as inline SVG by
  Claude Code (`claude-opus-5-5`, `web/src/features/academy/lesson/scenes.tsx`; labelled
  schematic, not to scale).
- `DEVLOG.md` records no other AI-generated imagery, audio or video. The 3D scene's still
  picture (`web/public/still/system-view.webp`) is a render of NASA's textures; the Local
  terrain near-ground regolith texture (`ground-material.ts`) is deterministic GLSL shader
  math (explicitly disclosed on screen as illustrative); and the starfield (`stars.bin`)
  comes from NASA/ADC's Yale Bright Star Catalogue.
- **NASA images and data are never AI-generated or altered.** The Moon and Earth pictures
  are resized, cropped or re-encoded only. Each output's source file, the operation and
  the credit are recorded in `data/derived/scene/meta.json`.

CHECK: the demo video, if it has a voice-over or music made with an AI tool, must be added
here, with the tool's name. Nothing in the repository says what the video is made with.

## How we counted

- **"59 real entries".** `DEVLOG.md` has 60 headings that begin `####`; the first is the
  entry template. All 59 real entries have an `AI use` line; one says "not recorded" (the
  first planning notes, marked superseded).
- **"87 rows" and "30 review rows".** From the "Usage ledger" table in
  `docs/orchestration/status.md`: rows beginning with a 2026 date (stopped after PR #71).
  By provider: Claude Code 22, Codex 26, Cursor 24, Antigravity 15. The status file's own
  "Totals so far" line reads 24, 26, 23 and 15 (88 in all), which does not match its
  table; we use the table.
- **"33 of 59" (and "36 of 59").** Text search of the 59 real entries for phrases
  indicating no human review (`not reviewed`, `has not reviewed`, `human review pending`,
  `not checked by a human`, `not read`, `not played`, `not yet seen`, `not yet tried`,
  `not yet read`, `not yet played`).
