# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Milestone:** **M0 Foundations is complete** (2026-11-13). M1, the thin slice, is in
  progress.
- **Checkpoint C0 (kickoff):** sent 2026-11-13. It needs no answer.
- **Checkpoint C1:** the design half was answered on 2026-11-13 (see "Design choices").
  The other half, the app on fixtures with test results, was sent on 2026-11-13 when
  MC1 merged. It needs no answer.
- **On `main`:** S0 to S6, the scoring reference and the fixtures (S2), MC0, MC1, MC2,
  MC4a, T0, A0, A1, A7, the generated TypeScript types, and all design prototypes with
  their screenshots. `uv run pytest` passes 151 tests; `pnpm --dir web test` passes
  1,058; typecheck, build and `gen:types` (no diff) are clean.
- **Fixture check in the browser:** with `VITE_DATA=fixtures` the data hooks load the
  series, skyline and meshes for all five fixture sites (52,584 hours each; the
  sphere-tier site correctly has no terrain), with no failed requests.
- **Gates verified:** G1, G2 (as a direction on the sky, decision 0011), G3, G4, G5, G6,
  G9, G10, G11. G7 is in review with S7.
- **Real data on this machine** (`C:\Users\abdal\TrueSouth\data`, never committed): the
  80 m and 240 m terrain maps, raw and prepared; NASA's 60 m average sunlight and
  Earth-visibility maps; 128 MB of saved Horizons responses. `data/derived/system.bin`
  is the real ephemeris and is committed.
- **Open method question: where a catalog site is evaluated.** See "The site-placement
  question" below. A firm recommendation is with the team lead; nothing in the method
  has been changed.

## Running now

Each child works in its own worktree and opens a pull request.

| Task | Branch | Provider, model, effort | State |
| :--- | :--- | :--- | :--- |
| Review of S7 (#42) | — | Antigravity, `gemini-4-argon`, high | running; also reproducing the NASA-map comparison independently |
| Review of MC3 (#45) | — | Codex, `gpt-6.1-terra`, high | running |
| A2 and the Academy screens in the picked form | `academy/a2-screens` | Claude Code, `claude-opus-5-5`, high | running |
| S9: `maps.py` and `build-maps` | `science/s9-maps` | Codex, `gpt-6.1-terra`, high | running |
| NASA's wider 120 m sunlight and Earth-visibility maps (background command, not an agent) | — | — | `fetch-raw --group visibility` into the shared data folder, with retries; the 60 m pair is complete |

S7 (#42) and MC3 (#45) are finished and waiting on those reviews. MC3 was built on MC1
before MC1's review fixes: merge `main` into it before checking it.

## The site-placement question

Raised by the S6 review, measured on the real 80 m map. It is a property of the method,
not a defect in the code. The team lead was told on 2026-11-13 and is owed a firm
recommendation with numbers.

The observer stands 2 m above the ground. When a site's coordinates fall a little way
down the side of a ridge, the uphill part of its own map pixel rises above eye level
within 80 to 160 m and hides the low polar Sun. Connecting Ridge's catalog coordinates
(−89.4555, 222.6192) are about 20 m down-slope of the local crest.

| Where the site is placed | Share of azimuths with the skyline above +1° |
| :--- | :--- |
| Catalog coordinates | 22.4% |
| 40 m east, on the crest | 0% |
| 40 m west, further down-slope | 34.1% |
| Catalog coordinates, terrain closer than 160 m ignored | 7.2% |
| Catalog coordinates, terrain closer than 500 m ignored | 0% |

The published sunlight share at that point is 92.27% (Gläser et al. 2014, their point
CR1).

**Measured on 2026-11-13** with S7's code (#42) and NASA's 60 m average maps (PGDA product
69; the file's values times its own scale, 4e-05):

| Where the site is evaluated | Our mean `sun_frac` | NASA sunlight map, same pixel | Our hours with any Earth | NASA Earth map |
| :--- | :--- | :--- | :--- | :--- |
| Catalog coordinates | 59.9% | 66.1% | 54.9% | 55.7% |
| Highest point within 80 m | 82.9% | 73.9% | 58.2% | 56.8% |
| Highest point within 160 m (it is 148 m away) | 86.9% | 86.4% | 58.2% | 57.9% |

S7 also measured the effect of ignoring terrain closer than 100, 250 and 500 m at the
catalog coordinates: 63.3%, 78.2% and 82.8%. NASA's own map varies from 0% to 86% across
neighbouring 60 m pixels around the catalog point. So the method agrees with NASA's
product; the gap to the published figure comes from where the point sits.

- **Firm recommendation, sent to the team lead on 2026-11-13:** evaluate catalog sites
  that are defined as sunlight peaks at the highest point of the 80 m map within 160 m
  (two pixels) of their listed coordinates, and show the offset on screen. Sites of real
  landings keep their exact coordinates. It needs a per-site field in the catalog and
  the contract.
- **Not chosen:** ignoring terrain closer than about two pixels. It would also ignore
  real slopes beside a lander, and it reaches only 78 to 83%.
- The S7 reviewer is reproducing the table independently. If it holds and the team lead
  does not object, make the change as its own pull request after S7 merges.
- Whichever is chosen is a change to docs/science.md first, then the code, and gets a
  file in docs/decisions/.

## What to do next

1. **MC1:** merged (#40) on 2026-11-13 after six review fixes. M0 is complete.
2. **MC3 (#45):** when the Codex review returns, send the findings to its author (Cursor),
   merge `main` into it (it is stacked on MC1; take `main`'s copy of MC1's files), run
   the checks, merge.
3. **After MC1 and MC3, on Opus with the impeccable skill:** MC4b (the shell on real
   hooks, replacing `web/src/app/mission/sample.ts` and the TEMP profile), then MC5
   (timeline and countdowns) and MC6 (Lander's eye), as in the C2 prototypes.
4. **S7:** when its pull request arrives, merge `main` (take `main`'s copy of the S6
   files), check G7, run `build-sites` for Connecting Ridge on the real data, get a heavy
   review from a provider other than Codex, merge. Then settle the site-placement
   question with the team lead. That is the M1 thin slice and checkpoint C2.
5. **C2 design, Mission Control views:** merged (#41) with screenshots (#44) and shown to
   the team lead on 2026-11-13 for a pick. The designer and the orchestrator recommend
   variant a for all four views, with the designer's fold for the timeline. With no
   answer, that stands. S9 (`build-maps`) is running so the polar map (T7) has data.
6. **Academy:** the team lead picked on 2026-11-13 (see "Design choices"). Opus builds
   the Academy screens in that form with the impeccable skill: first the lesson path,
   the split lesson screen, the lesson-complete screen and the step components that
   need no Mission Control panel (A2), with the card renderer (A4); then A3 and the
   lessons (A5) once MC6 and T7 exist.
7. **Update the status board in `DEVLOG.md`** at each checkpoint.

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

- **Ask a reviewer to mutate the code.** The S6 and MC1 reviews each found a test
  that still passed with the code deliberately broken (rows read bottom-up; meshes
  transposed). Review briefs now ask for it by name: endianness, row and column order,
  swapped columns, dropped offsets.
- **Run the science on real data before merging it.** Synthetic gates passed for the
  skyline while the real map showed the site-placement sensitivity.
- **`gemini-4-argon` earned its cost on S6**: it measured the problem instead of
  describing it. Keep it for science reviews.

## Follow-ups to put in later briefs

| For | What |
| :--- | :--- |
| A2, A3, A5 | A0's lesson types need widening before real lessons are written: a goal's value must allow text, a date and a `{{example.key}}` placeholder, not only a number; `drop-pin` needs a site or coordinates as its attempt and an optional goal; a reveal can be text, not only a panel; `draw-skyline` needs graded XP. From the A0 review. |
| T1, T3, T7 | Pass `moon_radius_m`, `skyline_bins` and mesh sizes from the manifest and site meta into the `lib/geo` helpers instead of relying on their defaults. From the T0 review. |
| MC4b, MC5 | The mission screen has a TEMP placeholder profile (`{ id: "im2_athena" }` cast to `MissionProfile`) and sample props in `web/src/app/mission/sample.ts`; replace both with the hooks from MC1 and MC3. Memoise `TopBar`, `SitesRail` and `FocusedSitePanel` when the scenario store is wired. |
| MC4b or A7 | Move the tab captions from `web/src/app/mission/views.ts` into `web/src/lib/explain.ts`, where plain-language text lives. |
| MC1, later | Only `parseProfiles` checks every required field after the review fixes; the other JSON parsers check selected fields. Complete them. |
| S2 or MC2, later | Add shared scoring cases for the half-hour rounding tie and for a relay profile whose clearance crosses the limit. From the MC2 review. |
| S6, later | An off-centre plateau test for G6; crop the far-field scan to the 300 km bounding box (about 13 s saved per site); record in the known limits that one-pixel peaks between sight-lines can be under-read by about 0.1° at 18 km. From the S6 review. |
| S8 | `prepare-dem` checks every raster against the south polar projection, so close-up DEMs in another projection would stop the run. Give them their own prepare path. |
| S12, A8 | Fill `g2_over_time` in `validation.json` and report the raw compass-azimuth difference beside G2, as decision 0011 says. |
| Science, later | Consider a contract validator that `slope_ideal_deg < max_slope_deg`; `scoring.py` already rejects it. |
| A10 | Luna's colour tokens now exist in `web/src/app/theme.css`; recolour the placeholder art with them. |
| Design clean-up | Delete the losing prototypes (`a/`, `b/`, `c/` under `design/variants/`) now that MC4a has merged; `c2/` stays until the screens it shows are built. |
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
| 2026-11-13 | Gate G2 compares directions on the sky; the raw compass azimuth is reported, not gated. The team lead's decision on the orchestrator's recommendation ([`../decisions/0011`](../decisions/0011-g2-compares-directions-on-the-sky.md)). | The raw azimuth passed 0.02° at 28 hours, all with the Sun almost overhead or underfoot at Apollo 11, where a bearing means nothing. |
| 2026-11-13 | The `Validation` contract was extended (#32): `g2_over_time`, `sources`, a comparison's `investigate_above`, `outside_mark` and `explanation`, a gate's `detail`. | The fixtures task stopped, correctly, because the contract could not hold what the validation page shows. |
| 2026-11-13 | Decoded series are `Float64Array` in the browser, not `Float32Array`. | Values are `raw × scale + offset` in float64, as in Python, so scoring agrees to 1e-9 (gate G10). The seam in docs/tracks/README.md is corrected in #40. |
| 2026-11-13 | More than five children ran at once for a short time. Told the team lead. | Reviews of finished work overlapped with new starts on the critical path. Back within five since. |
| 2026-11-13 | S7 and MC3 were each started on a branch that had not merged (S6, MC1). | Both are on the critical path and their bases were complete and in review. |
| 2026-11-13 | The skyline's site-placement sensitivity is not being fixed by the orchestrator. It goes to the team lead with numbers. | It changes what a catalog site means, which is a science-method choice. |

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
| Science (S0–S14) | S0, S1, S2, S3, S4, S5, S6 | S7 (#42) | S9 |
| Mission Control (MC0–MC7, MC9, MC11) | MC0, MC1, MC2, MC4a | MC3 (#45) | — |
| 3D and Map (T0–T8) | T0 | — | — |
| Academy (A0–A11) | A0, A1, A7 (first draft) | — | A2 with the three screens |
| Design | C1: directions A, B, C, the refined C2, the Mission Control flow. C2: the Academy screens and flow (picked); the Mission Control views (waiting for a pick) | — | — |

## Waiting on the team lead

An unanswered question takes the orchestrator's recommendation.

| Question | Asked at | Blocks | Running meanwhile |
| :--- | :--- | :--- | :--- |
| Mission Control views: variant a or b for the Slip Planner, Polar map, System view and Local terrain? Recommended: a for all four, with the timeline fold. | 2026-11-13, with the screenshots | MC7, T1, T3, T7 in their final form | their data and logic |
| Where is a catalog site evaluated? Firm recommendation: sunlight-peak sites at the highest point within 160 m, with the offset shown; landed sites at their exact coordinates. | 2026-11-13, with the measured table | real derived data for the catalog sites | S7's review |
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
| C2 | Academy lesson path | **Variant b:** the eight lessons spiral in across a flat map of the south pole, with a docked panel for the selected lesson. Picked 2026-11-13. | The team lead's pick. |
| C2 | Academy lesson step | **Variant b, the split stage:** the scene on the left, Luna's conversation and the answers on the right. Picked 2026-11-13. | The team lead: in variant a "I can't see the split screen view". |
| C2 | Academy lesson complete | **Variant a:** the patch as the hero in one column, then stars, XP, the recap and the panel the learner built. Picked 2026-11-13. | The team lead's pick. |
| C2 | A correct answer | **A green check.** It replaces the designer's moonlight-white mark: GO green with the check glyph and the word "Correct", kept off status lamps. A miss is still never red. | The team lead: "we can do a green check its fine". |
| C2 | Skyline sketch XP | **Scored on closeness:** a closer sketch earns more XP. docs/academy/overview.md needs the rule written down beside the 10/5/2 rule for answers. | The team lead took the recommendation on 2026-11-13. |

The shell, start screen and shared components are built in this look (MC4a, #34).

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
| 2026-11-13 | S5 | Codex | `gpt-6.1-terra` | high | merged (#28) |
| 2026-11-13 | Review of S5 | Cursor | `grok-4.7` | high | findings fixed before the merge |
| 2026-11-13 | S4 | Codex | `gpt-6.1-sol` | high | merged (#27); G1 and G2 at all 20 sites |
| 2026-11-13 | Review of S4 | Cursor | `grok-4.7` | high | found the raw-azimuth excess near the zenith, which led to decision 0011 |
| 2026-11-13 | S2 part 2, fixtures (four runs) | Codex | `gpt-6.1-terra` | high | merged (#33); stopped once on a contract gap, sent back twice for variety in the sites |
| 2026-11-13 | Review of the fixtures | Antigravity | `gemini-4-hydrogen` | high | findings fixed before the merge |
| 2026-11-13 | MC4a | Claude Code | `claude-opus-5-5` | high | merged (#34) |
| 2026-11-13 | Review of MC4a | Antigravity | `gemini-3.8-flash` | high | findings fixed before the merge |
| 2026-11-13 | C2 design, Academy (three runs) | Claude Code | `claude-opus-5-5` | high | merged (#37); waiting for the team lead's pick |
| 2026-11-13 | MC2 | Cursor | `grok-4.7` | high | merged (#38); gate G10 on 58 shared cases |
| 2026-11-13 | Review of MC2 | Codex | `gpt-6.1-terra` | high | approved, with follow-ups |
| 2026-11-13 | S6 | Codex | `gpt-6.1-sol` | high | merged (#35); gates G4 to G6 |
| 2026-11-13 | Review of S6 | Antigravity | `gemini-4-argon` | high | one missing orientation test, fixed by the orchestrator; measured the site-placement sensitivity on real data |
| 2026-11-13 | MC1 | Cursor | `grok-4.7` | high | merged (#40) after six review fixes |
| 2026-11-13 | Review of MC1 | Codex | `gpt-6.1-terra` | high | changes needed: five must-fix findings, two can-follow |
| 2026-11-13 | MC1, review fixes | Cursor | `grok-4.7` | high | all six closed in one run |
| 2026-11-13 | MC3 | Cursor | `grok-4.7` | high | pull request #45, in review |
| 2026-11-13 | S7 | Codex | `gpt-6.1-sol` | high | pull request #42, in review; reported the sunlight gap plainly and measured it |
| 2026-11-13 | C2 design, Mission Control views | Claude Code | `claude-opus-5-5` | high | merged (#41); waiting for the team lead's pick |
| 2026-11-13 | Review of S7 | Antigravity | `gemini-4-argon` | high | running |
| 2026-11-13 | Review of MC3 | Codex | `gpt-6.1-terra` | high | running |
| 2026-11-13 | A2 and the Academy screens | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | S9 | Codex | `gpt-6.1-terra` | high | running |

Totals so far: Claude Code 10 (9 Opus, 1 Sonnet), Codex 16 (13 terra, 3 sol), Cursor 12
(11 `grok-4.7`, 1 `grok-4.6`), Antigravity 9 (3 flash, 4 hydrogen, 2 argon). No provider
has hit a limit.

## Open questions for the team lead

1. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md). Until the file arrives the build follows
   that page's fallback.
2. Luna's reference photos, needed at checkpoint C4.
3. Scope for the deadline (see "Waiting on the team lead").
4. Links for the Times of India interview on Chandrayaan-3's Sun-elevation limits, and a
   citable statement that IM-2 and Chandrayaan-3 used no relay.
