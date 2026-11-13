# AI-use disclosure

For the Space Apps submission. Compiled from the "AI use" lines in
[`../../DEVLOG.md`](../../DEVLOG.md) and from [`../orchestration/`](../orchestration/)
(the orchestrator prompt and `status.md`). State as of @@CHECKED@@ on `origin/main`.

## In short

AI tools wrote most of TrueSouth's code, tests and documents. A human team lead set the
direction, picked every design and every scope change, and made the science-method
decisions. Every package was checked by tests and, in most cases, by a second AI agent from
a different provider. Large parts of the code have had no line-by-line human review. We say
so below.

## Which tools and models

| Tool | Models | Used for |
| :--- | :--- | :--- |
| Claude Code | Claude Fable 5.2 (the orchestrator session), `claude-opus-5-5`, `claude-sonnet-5-5` | Planning and the documents; all user-interface code; the 3D scene; design prototypes; documents such as these |
| Codex | `gpt-6.1-sol`, `gpt-6.1-terra` | The Python science pipeline: frames, ephemeris, skylines, discs, series, validation; reviews |
| Cursor | `grok-4.7`, `grok-4.6` (Grok models only) | Scaffolding, the data layer, scoring in TypeScript, the Docker build, scene images, worked examples; reviews |
| Antigravity | `gemini-4-argon`, `gemini-4-hydrogen`, `gemini-3.8-flash` (Google models only) | Reviews, including independent re-derivations of the science |
| `impeccable` design skill (version 4.9.0), used inside Claude Code | | Design critique and polish of the interface |

`claude-haiku-5-5` was allowed but does not appear in the usage ledger.

## What work, by kind

- **Planning.** Claude Code reviewed the first plan against the challenge text and the
  judging guide, researched NASA data products and mission facts, and wrote the plan, the
  specs, the glossary and the decision records.
- **Orchestration.** One Claude Fable 5.2 session handed each work package to a coding
  agent, read the results, merged them and kept the record in `docs/orchestration/status.md`.
  The rules it followed are in `docs/orchestration/orchestrator-prompt.md`.
- **Code.** The Python science pipeline, the API and Docker build, the web app, the
  scoring code, the 3D scene, the Academy screens and the tests were written by agents.
- **Design.** Claude Code, with the `impeccable` skill, made the interface prototypes. The
  team lead picked among them.
- **Writing.** Claude Code wrote the Academy lesson text and the plain-language
  explanations of terms, and wrote these submission documents.
- **Review.** Agents reviewed other agents' work, usually from a different provider (below).

## How the work was checked

- **Tests.** Python science code has pytest tests against known geometry. TypeScript
  scoring code has vitest tests against a shared fixture, so it matches the Python
  reference to 1e-9. The orchestrator's rule was to run both suites before every merge. It
  added that rule after two documents-only merges broke `main`. @@TESTS@@
- **Validation gates.** Eleven gates (G1 to G11) and reported comparisons against NASA's
  own maps. Gate G2 compares our Sun and Earth directions with JPL Horizons at 2,103,360
  points. The results, including two outside their marks, are in
  [`../validation.md`](../validation.md) and `data/derived/validation.json`.
- **Cross-provider review.** The usage ledger in `status.md` has 87 rows (counted from the
  table rows that begin with a 2026 date). 30 of those rows are titled "Review of ...".
  The rule was that a package is reviewed by a provider other than its author. Reviewers
  were asked to run and to mutate the code. Several found real defects, for example a
  wrong rounding rule in scoring and an angle wrap in the geometry helpers.
- **Exceptions.** The orchestrator itself reviewed S9 (polar map images) and S16 (scene
  images), because other providers were unavailable, and said so in the status file. The
  design prototypes got the orchestrator's visual check and no cross-provider review. The
  usage ledger has no rows for work after the Slip Planner spec rewrite, so the counts
  above leave out later packages.
- **Independent recomputation.** For example, the orchestrator recomputed the Academy's
  worked examples with its own script, and every value matched.
- **By eye.** User interface work was looked at in a browser, at three window widths. The
  automated browser has no graphics card, so the 3D scene was judged from captures made on a
  machine with one.
- **Human review.** In 32 of the 43 entries in `DEVLOG.md`, the AI-use line says a human
  has not yet reviewed the code (counted by searching those lines for phrases such as
  "human review pending"; the count is approximate). The team lead reviewed designs and
  results at checkpoints, not every line of code.

## What humans decided

The team lead decided, among other things:

- The product's two modes and the challenge reading (custom coordinates came back into
  scope after the team lead and orchestrator read the full challenge page).
- The look: plain dark mode, no purple, no glow, less on screen (checkpoint C1).
- The Academy's screens (lesson path, lesson step, lesson complete) and the green check for
  a correct answer.
- Mission Control as a space-first 3D scene (decision 0013), and the Slip Planner as a view
  on the Moon (design picked 2026-11-13).
- A small code-built lander in the 3D view.
- Gate G2 compares directions on the sky (decision 0011) and sunlit peaks keep their listed
  point (decision 0012).
- What is out of scope for the deadline: custom-site job queue, sensitivity grid,
  Academy lessons 5 to 8.

Where the team lead did not answer a question, the rule was that the orchestrator's
recommendation stood. The status file records each such case under "Decisions the
orchestrator made".

## AI-generated images and media

- The eight placeholder drawings of Luna, the mascot, are inline SVG made by Claude Code
  (`claude-opus-5-5`). The final art is not made yet.
- The two start-screen porthole drawings are inline SVG ported by Claude Code
  (`claude-opus-5-5`) from a prototype. The skyline in them is a made-up curve, not data.
- `DEVLOG.md` records no other AI-generated imagery, audio or video. The 3D scene's still
  picture is a render of NASA's textures.
- **NASA images and data are never AI-generated or altered.** The Moon and Earth pictures
  are resized, cropped or re-encoded only. Each output's source file, the operation and
  the credit are recorded in `data/derived/scene/meta.json`.

CHECK: the demo video, if it has a voice-over or music made with an AI tool, must be added
here, with the tool's name. Nothing in the repository says what the video is made with.

## How we counted

- **"43 entries".** `DEVLOG.md` has 44 headings that begin `####`; one of them is the
  entry template. The 43 real entries each have an "AI use" line. One says "not recorded"
  (the first planning notes, marked superseded).
- **"87 rows" and "30 review rows".** From the "Usage ledger" table in
  `docs/orchestration/status.md`: rows beginning with a 2026 date. By provider: Claude Code
  22, Codex 26, Cursor 24, Antigravity 15. The status file's own "Totals so far" line reads
  24, 26, 23 and 15 (88 in all), which does not match its table; we use the table.
- **"32 of 43".** A text search, as described above.
