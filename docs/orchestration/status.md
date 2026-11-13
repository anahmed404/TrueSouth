# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Milestone:** M0 Foundations is nearly done; M1 science is running alongside it.
  Started 2026-11-13.
- **Checkpoint C0 (kickoff):** sent 2026-11-13. It needs no answer.
- **Checkpoint C1:** the design half was sent early and **answered on 2026-11-13** (see
  "Design choices"). The other half, the app running on fixtures with test results, is
  still owed at the end of M0.
- **On `main`:** S0, S1, S3, the scoring reference (S2 part 1), MC0, T0, A0, A1, A7, the
  generated TypeScript types, and all design prototypes with their screenshots.
  `uv run pytest` passes 81 tests; `pnpm --dir web test` passes 911; typecheck and build
  are clean.
- **Left in M0:** the fixtures (S2 part 2, running), then MC1 and MC2.
- **Biggest risk, mostly retired:** gate G2 passed at Connecting Ridge, the hardest site
  (largest difference 0.006° against a 0.02° limit, 52,584 hours, no correction needed).
  The other 19 sites are still running.

## Running now

Each child works in its own worktree and opens a pull request.

| Task | Branch | Provider, model, effort | State |
| :--- | :--- | :--- | :--- |
| S2 part 2: fixtures and scoring cases | `science/s2-fixtures` | Codex, `gpt-6.1-terra`, high | running |
| S4 ephemeris, gates G1 and G2 | `science/s4-ephemeris` (#27, open early) | Codex, `gpt-6.1-sol`, high | running the remaining sites |
| Review of S5 (#28) | — | Cursor, `grok-4.7`, high | running |
| MC4a: theme, shared UI, start screen, collapsible shell | `mc/mc4a-theme-shell` | Claude Code, `claude-opus-5-5`, high | running |
| C2 design: Slip Planner, polar map, System view, Local terrain | `design/c2-mission-views` | Claude Code, `claude-opus-5-5`, high | running |
| C2 design: the Academy screens and flow | `design/c2-academy` | Claude Code, `claude-opus-5-5`, high | running |
| Terrain map download (background command, not an agent) | — | — | `fetch-raw --group terrain` into `C:\Users\abdal\TrueSouth\data\raw`; about 190 KB/s; the 80 m map then the 240 m map, 408 MB in all |

S5 itself is finished: pull request #28, waiting on its review.

## What to do next

1. **S5 (#28):** when the review returns, fix or send back, merge. Its docstrings have
   `?` where `§` should be; fix that. When the download finishes, run
   `uv run truesouth prepare-dem` with `TRUESOUTH_DATA_ROOT=C:\Users\abdal\TrueSouth\data`
   and record the per-map numbers the S5 brief asked for (shape, missing pixels, height
   range, heights at the south pole, Connecting Ridge and Shackleton's floor).
2. **S4 (#27):** when it finishes, check G2 for every site, get a heavy review from a
   provider other than Codex, merge. It changes docs/science.md section 3.
3. **After S4 and S5:** start S6, the skyline (Codex `gpt-6.1-sol`, high). After S6: S7,
   series and `build-sites` for Connecting Ridge. That is the M1 thin slice.
4. **Fixtures (S2 part 2):** review with a heavy reviewer, merge, then start MC1 (loaders
   and data hooks) and MC2 (browser scoring, gate G10) on Cursor `grok-4.7` in parallel.
   After MC1: MC3 (scenario store and URL sync).
5. **MC4a:** when its pull request arrives, run the checks, open the app and look at every
   state (both panels collapsed and open, three window sizes), get a light review, merge.
   Then, as MC1 to MC3 land, Opus builds MC4b (profile picker, sites rail and focused-site
   panel on real hooks), MC5 (timeline and countdowns) and MC6 (Lander's eye).
6. **The two C2 design tasks:** when they arrive, merge, take screenshots into
   `docs/design/c2/` (serve `design/` with `python -m http.server`; the browser tool
   refuses `file:`), and show the team lead the variants for their pick. This is the
   design half of checkpoint C2.
7. **End of M0:** integration check on `main`, then the rest of checkpoint C1.

## How to brief and check agents: lessons so far

- **Completions do not always wake you.** A child that finishes while you are mid-turn is
  not announced, or is announced late. At the start of every turn run `gh pr list`, and
  call `task_status` on anything that has run longer than expected.
- **Read each check's exit code directly.** Piping a check into `grep` or `tail` hid a
  typecheck failure and a broken change was merged (#18, fixed by #19). Use
  `cmd > log 2>&1; echo exit=$?`.
- **Codex `gpt-6.1-terra`:** unreliable at medium effort (quit once with nothing built,
  then thin work). At high effort, with "do not end your turn until the tests pass and the
  pull request is open", it has been fast and correct, though terse: S3 in four minutes.
  Its work still needs a strong reviewer.
- **Cursor `grok-4.7` at high effort is the best reviewer so far.** Its S0 and scoring
  reviews found real, specific defects by running things.
- **PowerShell-written files:** tell agents to write UTF-8 without a byte-order mark and
  to check that `§`, `°`, `·`, `—` survive. They have turned into `?` three times.
- **Writing patch scripts:** write them with the Write tool, not a shell heredoc;
  backslashes in heredocs were mangled twice.
- **Line endings:** `.gitattributes` forces LF. Before that, byte-comparison tests failed
  on a fresh Windows checkout.
- **Downloads:** `files.pythonhosted.org` crawled at 20 KB/s once (39-minute first
  `uv sync`); the uv cache is warm now. NASA's PGDA host gives 150 to 190 KB/s.
- **Shared data:** set `TRUESOUTH_DATA_ROOT=C:\Users\abdal\TrueSouth\data` in every brief
  that downloads or reads NASA data, so worktrees share one copy.
- **Pipeline steps** are one module each in `science/src/truesouth/commands/`. Nobody
  edits `cli.py`.
- **`npx impeccable …` hangs unless stdin is closed** (`< /dev/null`). Its own engine
  download also hung for one designer.
- **Every UI or design brief must say "use the impeccable skill"** and carry the team
  lead's taste (see "Design choices").
- **Children must not relax pnpm's release-age check.**
- **Parallel packages in one track collide in `DEVLOG.md` and at their seams.** Merge
  `main` into the second branch, resolve `DEVLOG.md` keeping both entries, rerun the
  checks, fix the seam, then merge. A branch stacked on an unmerged branch (S3 on S0)
  conflicts in every file of the base after the base is squash-merged: take `main`'s copy
  of those files.
- **Screenshots:** serve the folder with `python -m http.server` (background commands stop
  at their time limit) and use the browser tool.

## Follow-ups to put in later briefs

| For | What |
| :--- | :--- |
| A2, A3, A5 | A0's lesson types need widening before real lessons are written: a goal's value must allow text, a date and a `{{example.key}}` placeholder, not only a number; `drop-pin` needs a site or coordinates as its attempt and an optional goal; a reveal can be text, not only a panel; `draw-skyline` needs graded XP. From the A0 review. |
| T1, T3, T7 | Pass `moon_radius_m`, `skyline_bins` and mesh sizes from the manifest and site meta into the `lib/geo` helpers instead of relying on their defaults. From the T0 review. |
| MC2 | Port `scoring.py` exactly: window length `floor(24 × days + 0.5)`; countdowns follow the lit and link flags (earliest failing condition for a set, latest passing condition for a rise, none with a relay); sum in float64 in the order power, comms, slope. Callers of `<Explain>` use the keys `veto_*` and `utility_*`. |
| MC4b, MC5 | The mission screen has a TEMP placeholder profile (`{ id: "im2_athena" }` cast to `MissionProfile`); replace it with real profiles from MC1 and the scenario store from MC3. |
| S7 | `series.py` will already hold the Int16 encode and decode from the fixtures task; add the series computation to it. |
| S8 | `prepare-dem` checks every raster against the south polar projection, so close-up DEMs in another projection would stop the run. Handle them. |
| S12, A8 | `validation.json` has no field for the G2 difference over time or for an explanation of a comparison outside its mark, which docs/features/validation-page.md asks for. Extend the contract then. |
| S2 part 2 or later | Consider a contract validator that `slope_ideal_deg < max_slope_deg`; `scoring.py` already rejects it. |
| Team lead | `Compare` and `Timeline` are used as terms but are not in CONTEXT.md. "Elevation" means an angle in the glossary but a height in "digital elevation model". |

## Decisions the orchestrator made

| Date | Decision | Why |
| :--- | :--- | :--- |
| 2026-11-13 | MC0 went to Cursor `grok-4.7`, not Opus. | It is scaffolding; every screen in it is a plain placeholder. |
| 2026-11-13 | S0 declares the whole Python stack and MC0 the whole web stack. | Parallel packages would otherwise all edit the dependency lists. |
| 2026-11-13 | `schema.json` is one JSON Schema document titled `TrueSouthContracts`, every model under `$defs`. | A fixed seam between S0 and MC0. |
| 2026-11-13 | Design-prototype pull requests get the orchestrator's visual check but no cross-provider review. | They are throwaway and never ship. |
| 2026-11-13 | Status and orchestration docs reach `main` through small pull requests. | Uniform history, no direct pushes. |
| 2026-11-13 | MC0: no exception to pnpm's release-age check; `motion` resolved to 14.12.0. | The check refuses packages published in the last day. |
| 2026-11-13 | The design half of C1 was sent before M0 finished. | The team lead's pick was the long pole for the M1 screens. |
| 2026-11-13 | `worked_examples.json` is a flat map keyed by the full dotted key, every key typed and required. | docs/academy/overview.md and the web code already used that shape; S0 had nested it. |
| 2026-11-13 | `gen:types` runs `web/dev/gen-types.mjs`, which drops per-property titles. | Otherwise every field became a numbered alias (`Id3`, `Name13`). |
| 2026-11-13 | `.gitattributes`: `* text=auto eol=lf`. | Byte-comparison tests failed on a CRLF checkout. |
| 2026-11-13 | One module per pipeline step in `truesouth/commands/`; `paths.py` with `TRUESOUTH_DATA_ROOT`. | Science packages run in parallel and share one copy of the NASA data. |
| 2026-11-13 | S3, and later S4 and S5, were started before the package they follow had merged. | Science is the critical path and they do not touch each other's files. |
| 2026-11-13 | S2 was split: the scoring reference first, the fixtures second. | Scoring needed only the contracts, so it ran while the catalog was being written. |
| 2026-11-13 | docs/mission-profiles.md: five values retagged from sourced to assumed (IM-2 and Chandrayaan-3 `relay_available`; Chandrayaan-3's three Sun-elevation values). | The page had no link for them, and for the relay values no quotation. Told the team lead. |
| 2026-11-13 | docs/science.md section 9: the window is `floor(24 × duration_days + 0.5)` hours; a window past the grid has no result. | Python and JavaScript round halves differently. |
| 2026-11-13 | docs/science.md section 9: countdowns follow the lit and link flags, not disc fraction and clearance alone. | Otherwise a profile with an operations Sun elevation shows dark hours with no sunset, and a relay profile shows an Earthset. |
| 2026-11-13 | MC4 was split: MC4a (theme, shared components, start screen, shell chrome) now on sample props; MC4b on real hooks later. | The look was approved before the data hooks existed. |
| 2026-11-13 | Two variants per screen for the C2 designs, in the approved look. | The look is fixed; variants now differ in layout and interaction only. |

## Model tiers

Confirmed with the team lead on 2026-11-13. Every model below was listed as available by
`orchestrator_capabilities` on 2026-11-13.

| Provider | Heavy | Everyday | Light |
| :--- | :--- | :--- | :--- |
| Claude Code | `claude-opus-5-5` | `claude-sonnet-5-5` | `claude-haiku-5-5` |
| Codex | `gpt-6.1-sol` | `gpt-6.1-terra` | `gpt-6.1-terra` at low effort |
| Antigravity (Google models only) | `gemini-4-argon` | `gemini-4-hydrogen` | `gemini-3.8-flash` |
| Cursor (Grok models only) | `grok-4.7` | `grok-4.7` | `grok-4.6` |

All UI work goes to `claude-opus-5-5`.

Effort option names differ by provider: Codex `reasoningEffort`, Claude Code `effort`,
Cursor `grok-4.7` `reasoning_effort`, Cursor `grok-4.6` `effort`, Antigravity
`thinking_level`.

## Work packages

Ids are from [`../build-plan.md`](../build-plan.md). Anything not listed is not started.

| Track | Verified | In review | In progress |
| :--- | :--- | :--- | :--- |
| Science (S0–S14) | S0, S1, S3, S2 part 1 (scoring) | S5 (#28) | S2 part 2 (fixtures), S4 (#27) |
| Mission Control (MC0–MC7, MC9, MC11) | MC0 | — | MC4a |
| 3D and Map (T0–T8) | T0 | — | — |
| Academy (A0–A11) | A0, A1, A7 (first draft) | — | — |
| Design | C1: directions A, B, C, the refined C2, the Mission Control flow | — | C2: Mission Control views; Academy screens and flow |

## Waiting on the team lead

| Question | Asked at | Blocks | Running meanwhile |
| :--- | :--- | :--- | :--- |
| Scope: submit at M2 plus the validation page, Docker and the submission text, and drop custom sites, the sensitivity grid and lessons 5 to 8? | first asked with the time estimate on 2026-11-13; not answered | nothing yet; it decides the order of work after M1 | everything |
| Links for the five retagged profile values | 2026-11-13 | nothing; they show as assumed until a link arrives | — |

## Design choices

| Checkpoint | Screen | Choice | Why |
| :--- | :--- | :--- | :--- |
| C1 | Overall look | **The refined direction C ("C2"), approved 2026-11-13:** "this looks good". Plain dark mode in neutral tones; no purple or indigo; no glow; no all-caps titles; less on screen at once. `PRODUCT.md`, `DESIGN.md` and `design/variants/direction-c2.md` describe it. | The team lead called the first three directions "vibe coded slop" and asked for an impeccable pass on C. |
| C1 | Accent | Warm white, by default: the team lead did not answer the question, so the recommendation stands. | Every hue already means the Sun, Earth or a status. |
| C1 | Mission Control shell | A's docked layout in the C2 look, **with the left and right panels collapsible** so the main view can expand. | The team lead: "sometimes it looks small". |
| C1 | Every view | One plain sentence saying what it shows; the tabs mark the 3D views. | The team lead did not understand the Lander's eye from the mock-up and asked where the 3D view was. |
| C1 | Start screen, timeline and countdowns, Lander's eye | As in the C2 prototypes. | Approved with the rest. |
| C1 | Process | Design work uses the `impeccable` skill (4.9.0). Tell the team lead before a design pass. | Asked for directly. |

Losing prototypes (`a/`, `b/`, `c/` under `design/variants/`) can be deleted once MC4a
has merged; `c2/` stays until the screens it shows are built.

## Usage ledger

One line per delegated task: date, work package, provider, model, effort, outcome.

| Date | Task | Provider | Model | Effort | Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-13 | S0, first run | Codex | `gpt-6.1-terra` | medium | failed: quit after 18 s with nothing built |
| 2026-11-13 | S0, second run | Codex | `gpt-6.1-terra` | medium | thin but working after 50 minutes, 39 of them a slow install |
| 2026-11-13 | S0, review fixes | Codex | `gpt-6.1-terra` | medium | merged (#14); 7 minutes |
| 2026-11-13 | Review of S0 | Cursor | `grok-4.7` | high | five must-fix gaps found by running the models |
| 2026-11-13 | MC0 | Cursor | `grok-4.7` | high | merged (#5) |
| 2026-11-13 | Review of MC0 | Antigravity | `gemini-3.8-flash` | medium | two findings fixed |
| 2026-11-13 | C1 design A, B, C (three tasks) | Claude Code | `claude-opus-5-5` | high | merged (#8, #6, #7); rejected by the team lead as a set |
| 2026-11-13 | C1 impeccable pass on C | Claude Code | `claude-opus-5-5` | high | merged (#24); approved |
| 2026-11-13 | T0 | Cursor | `grok-4.7` | high | merged (#12) after four review fixes |
| 2026-11-13 | Review of T0 | Antigravity | `gemini-4-hydrogen` | high | found a real angle-wrap bug |
| 2026-11-13 | A0 | Cursor | `grok-4.7` | high | merged (#13) |
| 2026-11-13 | Review of A0 | Antigravity | `gemini-3.8-flash` | high | approved, with follow-ups |
| 2026-11-13 | A1 | Claude Code | `claude-opus-5-5` | medium | merged (#11) |
| 2026-11-13 | Review of A1 | Cursor | `grok-4.6` | medium | approved |
| 2026-11-13 | S3 | Codex | `gpt-6.1-terra` | high | merged (#16); 4 minutes |
| 2026-11-13 | Review of S3 | Cursor | `grok-4.7` | high | approved |
| 2026-11-13 | A7 | Claude Code | `claude-sonnet-5-5` | high | merged (#17) after 12 corrections |
| 2026-11-13 | Review of A7 | Antigravity | `gemini-4-hydrogen` | medium | 12 corrections |
| 2026-11-13 | S1, first run | Codex | `gpt-6.1-terra` | high | stopped, correctly, on a conflict in the spec |
| 2026-11-13 | S1, second run | Codex | `gpt-6.1-terra` | high | merged (#29) after review fixes |
| 2026-11-13 | Review of S1 | Antigravity | `gemini-4-hydrogen` | high | one wrong reason, three weak tests |
| 2026-11-13 | S2 part 1, scoring, and its review fixes | Codex | `gpt-6.1-terra` | high | merged (#23) |
| 2026-11-13 | Review of scoring | Cursor | `grok-4.7` | high | found the rounding mismatch |
| 2026-11-13 | S5 | Codex | `gpt-6.1-terra` | high | pull request #28, in review |
| 2026-11-13 | Review of S5 | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | S4 | Codex | `gpt-6.1-sol` | high | running; G2 passed at the first site |
| 2026-11-13 | S2 part 2, fixtures | Codex | `gpt-6.1-terra` | high | running |
| 2026-11-13 | MC4a | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | C2 design, Mission Control views | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | C2 design, Academy | Claude Code | `claude-opus-5-5` | high | running |

Totals so far: Claude Code 9 (8 Opus, 1 Sonnet), Codex 10 (9 terra, 1 sol), Cursor 9
(8 `grok-4.7`, 1 `grok-4.6`), Antigravity 6 (2 flash, 4 hydrogen, no argon). No provider
has hit a limit.

## Open questions for the team lead

1. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md). Until the file arrives the build follows
   that page's fallback.
2. Luna's reference photos, needed at checkpoint C4.
3. Scope for the deadline (see "Waiting on the team lead").
4. Links for the Times of India interview on Chandrayaan-3's Sun-elevation limits, and a
   citable statement that IM-2 and Chandrayaan-3 used no relay.
