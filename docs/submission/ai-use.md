# AI-use disclosure

For the Space Apps submission. Compiled from the "AI use" and "State" lines in
[`../../DEVLOG.md`](../../DEVLOG.md) and from [`../orchestration/`](../orchestration/)
(the orchestrator prompt and `status.md`). State as of **2026-11-14, `origin/main` at
69bb26e**, plus the DEVLOG entry for this package.

## In short

AI tools wrote most of TrueSouth's code, tests and documents. A human team lead set the
direction, picked every design and every scope change, and made the science-method
decisions. Every package was checked by tests and, in almost all cases, by a second AI agent
from a different provider. Large parts of the code have had no line-by-line human review.
We say so below.

## Which tools and models

| Tool | Models | Used for |
| :--- | :--- | :--- |
| Claude Code | Claude Fable 5.2 (the orchestrator session), `claude-opus-5-5`, `claude-sonnet-5-5` | Planning and the specs; the user-interface code (shell, timeline, Slip Planner, Compare, Lander's eye, custom-site UI, Academy screens and lessons, validation page); the 3D scene and Polar map; design prototypes; the plain-language explanations; these submission documents |
| Codex | `gpt-6.1-sol`, `gpt-6.1-terra` | The Python science pipeline (frames, ephemeris, skylines, discs, series, validation, polar map images); the custom-site server; scoring boundary fixes; the math review (`A9`); reviews |
| Cursor | `grok-4.7`, `grok-4.6` (Grok models only) | Scaffolding, the data layer, scoring in TypeScript, the sweep worker, slope and terrain meshes, best-lit variants in the build, the Docker build, scene images, worked examples, Academy lesson types; reviews |
| Antigravity | `gemini-4-argon`, `gemini-4-hydrogen`, `gemini-3.8-flash` (Google models only) | Reviews, including independent re-derivations of the science |
| `impeccable` design skill (4.9.0), used inside Claude Code | | Design critique and polish of the interface (named in 21 DEVLOG entries) |

`claude-haiku-5-5` was allowed in the orchestrator rules but does not appear in the usage
ledger. `grok-4.6` and the Gemini models appear in the usage ledger in
[`../orchestration/status.md`](../orchestration/status.md), and in `DEVLOG.md` State lines;
the DEVLOG "AI use" lines themselves name `gemini-3.8-flash` once.

## What work, by kind

- **Planning.** Claude Code reviewed the first plan against the challenge text and the
  judging guide, researched NASA data products and mission facts, and wrote the plan, the
  specs, the glossary and the decision records.
- **Orchestration.** One Claude Fable 5.2 session handed each work package to a coding
  agent, read the results, ran tests and browser checks, merged them and kept the record in
  `docs/orchestration/status.md` and `DEVLOG.md`. The rules it followed are in
  `docs/orchestration/orchestrator-prompt.md`.
- **Code.** The Python science pipeline, the FastAPI custom-sites server and Docker build,
  the web app, the TypeScript scoring port and sweep worker, the 3D scene and flat Polar
  map, the Academy screens and lessons 1 to 4, the validation page, and the tests were
  written by agents.
- **Design.** Claude Code, with the `impeccable` skill, made the interface prototypes. The
  team lead picked among them (for example the space-first layout and the Slip Planner as a
  view on the Moon).
- **Writing.** Claude Code wrote the Academy lesson text, the plain-language explanations
  (`explain.ts`) and these submission documents.
- **Review.** Agents reviewed other agents' work, usually from a different provider (below).

## How the work was checked

- **Tests.** Python science code has pytest tests against known geometry. TypeScript
  scoring code has vitest tests against a shared fixture of 76 cases, so it matches the
  Python reference to 1e-9. The orchestrator's rule was to run both suites before every
  merge. The last full run recorded in `DEVLOG.md` (the "MC testing feedback 3" entry, on
  the tree merged with `a35133f`) shows **438 Python tests** (1 skipped) and **2,465 web
  tests** passing, with typecheck and the production build. This package ran no tests.
- **Validation gates.** Eleven gates (G1 to G11) and 59 reported comparisons against NASA's
  own maps and self-convergence checks. Gate G2 compares our Sun and Earth directions with
  JPL Horizons at 2,103,360 points. The results, including the 5 comparisons outside their
  marks, are published in [`../validation.md`](../validation.md),
  `data/derived/validation.json` and on `/validation`. G10 and G11 are checked in the web
  tests, not by the validation command.
- **Cross-provider review.** The usage ledger in `status.md` has 87 rows (counted from the
  table rows that begin with a 2026 date). 30 of those rows are titled "Review of ...". By
  provider the ledger's rows are Claude Code 22, Codex 26, Cursor 24 and Antigravity 15.
  The ledger stops after work package `MC6`. Later packages kept the practice, as their
  DEVLOG State lines record: at least 26 of the 69 entries name the other tool that
  reviewed them ("reviewed by Codex", "reviewed by Cursor", "reviewed by Gemini"), and others
  describe a review in other words. Reviewers were asked to run the code and to mutate it,
  and they caught real defects, for example a wrong rounding rule in scoring, an angle wrap
  in geometry helpers, a validation headline rounded in our favour, and a drag that turned
  the wrong way after a pan.
- **Exceptions.** The orchestrator itself reviewed `S9` (polar map images) and `S16` (scene
  images) because other providers were unavailable, and recorded that in `status.md`. Design
  prototypes received the orchestrator's visual check without cross-provider review.
- **Independent recomputation.** For example, Codex recomputed every answer in Academy
  lessons 1 to 4 from the stored series, Cursor re-derived the Polar map projection and
  the Slip Planner sweep, and an audit of the scoring change ran 25 sites × 5 presets ×
  2,191 days before and after it.
- **By eye.** Agents opened the interface in a browser at 1440 × 900, 1024 × 768 and
  390 × 844, and several 3D views were seen on hardware WebGL (an NVIDIA RTX 2060 on the
  team's machine). A laptop with built-in graphics has not been measured; the 3D scene
  steps its quality down on slow machines (decision 0014).
- **Human review.** In 52 of the 69 entries in `DEVLOG.md`, the "AI use" line itself says a
  human has not reviewed the work (for example "human review pending", "not yet seen by the
  team lead"). No entry records a human reading the code line by line. The team lead
  judged the product by using the running app and sent fixes on 2026-11-14; that is the
  main human check of the interface.

## What humans decided

The team lead decided, among other things:

- The product's two modes and the challenge reading (custom coordinates came back into scope
  after the team lead and orchestrator read the full challenge page).
- The look: plain dark mode, no purple, no glow, less on screen.
- The Academy's screens (lesson path, lesson step, lesson complete) and the green check for
  a correct answer.
- Mission Control as a space-first 3D scene (decision 0013), and the Slip Planner as a view
  on the Moon.
- After testing on 2026-11-14: no sentence under the view bar, a bottom strip that keeps one
  height, a System view that turns freely over the poles, the Moon drawn around the Polar
  map's square, a Compare table that gets the space, and an "Enter coordinates" row that is
  easy to find.
- A small code-built lander (Pip) in the 3D view.
- Gate G2 compares directions on the sky (decision 0011), and sunlit peaks keep their listed
  point alongside a TrueSouth best-lit variant and nearby range (decision 0012).
- What is out of scope for the deadline: the "compute for my dates" sensitivity grid
  (`S11`, `T8`), Academy lessons 5 to 8 (`A6`), and official Artemis region outlines.

Where the team lead did not answer a question, the rule was that the orchestrator's
recommendation stood. `docs/orchestration/status.md` records these cases under "Decisions
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
  picture (`web/public/still/system-view.webp`) is a render of NASA's textures. The near-
  ground texture in Local terrain (`ground-material.ts`) is shader math, disclosed on screen
  as illustrative, and the lander Pip is built in code. The star background (`stars.bin`)
  comes from NASA/ADC's Yale Bright Star Catalogue.
- **NASA images and data are never AI-generated or altered.** The Moon and Earth pictures
  are resized, cropped or re-encoded only. Each output's source file, the operation and the
  credit are recorded in `data/derived/scene/meta.json`.

CHECK (team lead): if the demo video has a voice-over or music made with an AI tool, add it
here with the tool's name. Nothing in the repository says what the video is made with.

## How we counted

- **"69 entries".** `DEVLOG.md` has 70 headings that begin `####`; the first is the entry
  template. The other 69 are real entries (the MC1 entry appears twice). All 69 have an
  "AI use" line; one says "not recorded" (the first planning notes, marked superseded). By
  the first tool each line names: Claude Code 32, Codex 22, Cursor 14.
- **"87 rows" and "30 review rows".** From the "Usage ledger" table in
  `docs/orchestration/status.md`: rows beginning with a 2026 date. By provider: Claude Code
  22, Codex 26, Cursor 24, Antigravity 15. The status file's own "Totals so far" line reads
  24, 26, 23 and 15 (88 in all), which does not match its table; we use the table.
- **"52 of 69".** A text search of each entry's "AI use" line for phrases saying no human
  has reviewed it (for example `human review pending`, `a human has not`, `no human`,
  `not yet seen by`, `not checked by a human`). Lines that say only that the orchestrator has
  not yet checked it are not counted.
- **"At least 26".** DEVLOG State lines that contain "reviewed by" followed by Codex,
  Cursor, Gemini, Antigravity or the orchestrator.
- **Tests.** The last recorded full run in `DEVLOG.md`, as named above. The counts have
  moved with every merge; the status file's older line (425 and 2,317) is stale.
