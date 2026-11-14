# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Submission day, 2026-11-14.** Every major feature is on `main` (5a5fd84, #87). What is
  left is fixes from the team lead's testing, four small pull requests in review, and the
  submission texts.
- **On `main`:** the space-first shell; the 3D scene (the System view turns freely over the
  poles, real stars, quality stages for slow machines); the flat Polar map (pin nudge,
  "New site here?", "Compute this site"); the Slip Planner as a camera view; Local terrain
  and the Lander's eye with relief, drawn shadows and texture; the Lander's eye horizon
  chart, collapsed by default; the Compare window with CSV and JSON export, share and
  confirmed QuickMap and Moon Trek links; custom coordinates (API and entry form); 25 sites
  (20 listed and 5 best-lit variants, decision 0012); the landing date and "Next GO" in the
  bottom strip; Academy lessons 1 to 4 playable; the validation page; Docker; the math
  review (docs/reviews/a9-math-review.md); submission drafts (docs/submission/, stale).
- **Last full check on `main`:** 425 Python tests (1 skipped: the real-map test), 2,317 web
  tests, typecheck and build.
- **Servers running for the team lead (do not stop; children use other ports):** the dev
  server on 5173 from the main checkout (it follows `git pull`), the API on 8000 (uvicorn,
  needed for custom sites in development), Docker project `truesouth-s13` on 8080. After a
  batch of merges: `docker compose -p truesouth-s13 up -d --build`.
- **The machine is the limit.** At most 6 or 7 children at once (the team lead, 2026-11-14,
  after 12 to 14 at once exhausted CPU and memory). Tell every child: each suite once,
  nothing in parallel, no dev server or browser left running. Drive C filled completely
  once that night: remove finished worktrees as packages merge (clean, and on GitHub).
- **Providers:** all four work. Claude usage ran out once for under an hour and cut four
  children off mid-task; the team lead restored it with a banked reset. Children commit and
  push as they go for this reason.
- **Task ids:** `task_status` needs the full id, which starts
  `node:delegated-task:command%3Amcp%3A…`. A message to a finished child's thread starts a
  new run in the same worktree with its context, which is the cheapest way to send review
  findings back.

## Running now

Each child works in its own worktree and opens a pull request. Seven is the limit.

| Task | Branch or PR | Provider, model | State |
| :--- | :--- | :--- | :--- |
| Team lead's fixes: the bottom strip keeps one height while scrubbing; the middle mouse button turns the camera; "Enter coordinates" reads as a button; a black box beside the folded sites rail (not reproduced so far) | `mc/testing-feedback-3` | Claude Code, `claude-opus-5-5` | finishing; pull request not opened yet |
| The Moon drawn around the Polar map's square, with a border on the square | `three/t7b-polar-map-context` | Claude Code, `claude-opus-5-5` | finishing; pull request not opened yet |
| Compare: one-row header with the date; the strip folds while Compare is open | `mc/mc9b-compare-space` | Claude Code, `claude-opus-5-5` | final checks; pull request not opened yet |
| Submission texts brought up to date | `docs/a11b-submission-update` | Claude Code, `claude-sonnet-5-5` | restarted from nothing |
| Review of the scoring boundary fix and the science document clarifications | #93, #94 | Antigravity, `gemini-4-hydrogen` | running |
| Review of the Academy's drag and sketch steps | #95 | Codex, `gpt-6.1-terra` | running |
| Review of the API status follow-ups and validation fields | #96 | Cursor, `grok-4.7` | running |

## Site placement: decided

Decision [`../decisions/0012`](../decisions/0012-sunlit-peaks-keep-their-listed-point.md),
taken by the team lead on 2026-11-13: every catalog site is evaluated at its listed
coordinates; each `sunlit_peak` site also reports the range of mean sunlight within
160 m and gets a second, labelled site at its best-lit map pixel. The rule is
docs/science.md section 7.1. The measured table, what was rejected (including the
orchestrator's own first rule) and the comparison with NASA's maps are in the decision
file. The choice of a best-lit pixel must never use NASA's average-sunlight map.

Still to do after the pipeline part: the catalog description for Connecting Ridge must
say that the published 92.27% is hours with any Sun; validation R1 must be published
for the listed point and the variant, including the large gaps at `de_gerlache_rim` and
`malapert_peak`.

## What to do next

1. **Merge what is open, in this order when their reviews return:** #93 (scoring boundary;
   no status changed across 273,875 results) before #94 (science document); #96 (its full
   Python suite has not had a clean run: two failures were fixed and only re-run alone);
   #95 (the Academy steps). Then the three team-lead fixes as their pull requests open,
   each with a review from another provider.
2. **Rebuild Docker** after each batch, and tell the team lead what to try.
3. **Owed by the orchestrator:**
   - A full catalog rebuild check after #80: `uv run truesouth build-sites` on the real
     data must leave `git status` clean. About 40 minutes of heavy computing, because #80
     changed the science package's fingerprint and so emptied the placement cache. Run it
     when few children are active.
   - The status board at the top of `DEVLOG.md`.
4. **Small follow-ups not yet assigned:** Local terrain says a custom site's apron "could
   not be loaded" though it never has one (the data layer has no "none" state; a scene
   change); QuickMap and Moon Trek links are in Compare but not in the focused-site panel;
   the Academy's `drop-pin` step is a holding form (lessons 5 to 8 are out of scope); the
   validation page still quotes G2's diagnostic from prose and can read the new fields once
   #96 merges; contract validators for the profile rules (math review, B8).
5. **Submission:** when the texts are updated, read them against the app once. Only the
   team lead can settle: the repository is private and has no licence file (judges need a
   public link or a zip); the live link; the backup video; whether to apply
   docs/submission/README-proposed.md; why the data covers six years.
6. **If the team lead reports a bug from testing:** assign it at once to the child that
   built that part (a message to its thread), and pause a lower-priority child if that
   would exceed seven.

## How to brief and check agents: lessons so far

- **Completions do not always wake you.** A child that finishes while you are mid-turn is
  not announced, or is announced late. At the start of every turn run `gh pr list`, and
  call `task_status` on anything that has run longer than expected.
- **Say where a child may not write.** The Docker child wrote two context files under
  `~/.docker/contexts/meta/`, outside the repo and outside its brief. A brief that touches
  Docker, a global tool or a user profile says: change nothing outside the worktree.
- **A review is worth its cost.** On 2026-11-13 and 14 every pull request went to a
  reviewer from another provider, and nearly every review found something real: a
  validation headline rounded in our favour, a link that could start a server job
  without a click, a formula that gave 181° for a southern latitude, a drag that turned
  the wrong way after a pan, a spot that disagreed with the sites rail mid-sweep. Brief
  the reviewer to recompute independently, not to read; ask for mutations.
- **Send findings back to the author's own thread**, numbered, with the reviewer's
  evidence, and say which of your own earlier instructions a new request overrides.
- **When two open branches edit the same file, say so in both briefs** and merge the
  first approved; tell the other to merge `main`. A structural collision (#80 against
  #77 in `build_sites.py`) goes back to an author, not to the orchestrator's editor.
- **Stopping a background shell does not stop its server on Windows.** Find the
  `node.exe` or `python.exe` by its command line and end that process by id.
- **Under load a test can time out.** Re-run that file alone before believing it; with
  seven children the Python suite takes four to seven minutes, not one.
- **The team lead judges by using the app.** Keep the dev server and Docker current,
  say what to try after each merge, and show a screenshot when one exists.
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

- **A provider that reports a usage limit may still finish queued work.** Codex's S9 run
  completed after the limit message, so a duplicate started on Cursor had to be
  cancelled. Check the branch and the pull-request list before re-sending a task.
- **Stale completion notices arrive with different ids.** Check `task_status` on the task
  you actually started before acting on one.
- **Reviewers' browser tools often time out.** Codex could not open the screens for MC4b
  or A4. The orchestrator opens every UI pull request itself before merging.
- **`cd` into a worktree can fail silently and the rest of the command then runs in the
  main checkout.** Write `cd <path> || exit 1`.
- **Test a rule at more than one site before recommending it.** The placement rule came
  from one site and failed at another.

- **Run both test suites before every merge, documents included.** Two docs-only merges
  broke `main`: a test ties the catalog document to the catalog file, and another ties
  CONTEXT.md's glossary to `explain.ts`.
- **`pnpm --dir web gen:types` reads `schema.json`; it does not rebuild it.** Run
  `uv run truesouth export-schema` first, or gate G11's "no diff" proves nothing.
- **A finished child does not always wake the orchestrator.** The team lead noticed only
  two of five were running. Check `task_status` whenever a task has gone quiet for longer
  than its kind usually takes, and after every merge.
- **The automated browser has no graphics card.** It shows the scene's still-picture
  fallback. 3D must be judged from the author's captures or by the team lead.
- **The browser tool can read pages the command-line tools cannot** (it validates
  certificates with its own root store). That is how the challenge page was read. Never
  disable a certificate check.
- **Read the source of a requirement before cutting scope.** Custom coordinates were cut
  before anyone had read the challenge statement, which lists them.

## Follow-ups to put in later briefs

| For | What |
| :--- | :--- |
| Academy types, before A5 | The A2 review listed what the lesson types cannot yet express for lessons 1 to 4: a reveal with a scenario, an hour or a playback window, or a non-panel illustration; a scene with a flat skyline or a drag time range; a slider with a readout, a scene or a live Pip update, and date sliders. Also: `starsFor(0, 0)` gives 3 stars for a lesson finished only by skipping; the map's stops are 42.6 px on a phone; the lesson screen's "save only on completion" guard has no mounted test. |
| A3 | Remove "Skip this step" once the three panel step kinds exist. Remove the unused `LunaCelebration` confetti (status colours). Pip's power meter is a story meter and carries no provenance tag. |
| A5, A6 | The card type and renderer are A4's. Terms the cards will want (horizon, observer height, the Moon's radius) go into CONTEXT.md first, then `explain.ts`. |
| T1, T3, T7 | Pass `moon_radius_m`, `skyline_bins` and mesh sizes from the manifest and site meta into the `lib/geo` helpers instead of relying on their defaults. From the T0 review. |
| T3 to T5 | The mesh's per-vertex slope has its own baseline (156.25 m; science.md section 13); the slope overlay's legend must say it differs from the site's slope. Mesh rows run north to south, columns west to east. |
| MC7 (UI) | `useSweep` and `useSweeps` are ready. Remove the worker's build input from `web/vite.config.ts` when a screen imports them, or the worker is emitted twice. |
| MC4b follow-ups | `editProfileField` gives a notice only for some refusals; the editor works around it. Weights are number boxes; the spec says sliders. The no-result state cannot be reached from the date picker because the store clamps the landing date. `DEVLOG.md` has the MC1 entry twice. |
| MC1, later | Only `parseProfiles` checks every required field; the other JSON parsers check selected fields. `worked_examples.json` values are not validated one by one. |
| S2 or MC2, later | Add shared scoring cases for the half-hour rounding tie and for a relay profile whose clearance crosses the limit. |
| S6, later | An off-centre plateau test for G6; crop the far-field scan to the 300 km bounding box (about 13 s saved per site); record that one-pixel peaks between sight-lines can be under-read by about 0.1° at 18 km. |
| S8, later | Close-up 5 m DEMs: download, their own prepare path (another projection would stop `prepare-dem`), `closeup.bin`, close-up slope. Not needed for the deadline. |
| S12, A8 | Fill `g2_over_time` in `validation.json` and report the raw compass-azimuth difference beside G2, as decision 0011 says. R1 must compare like with like: NASA's map is a mean disc fraction at 0 m over 18.6 years. |
| Science, later | Contract validators: `slope_ideal_deg < max_slope_deg`; power and comms weights not both zero; each weight from 0 to 1,000. `scoring.py` and the store already enforce these. |
| A10 | Luna's colour tokens exist in `web/src/app/theme.css`; recolour the final art with them. |
| Design clean-up | Delete the losing prototypes (`a/`, `b/`, `c/` under `design/variants/` for the C1 screens). |
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
| 2026-11-13 | The orchestrator withdrew its own placement rule ("highest point within 160 m") after measuring it at all five sunlit-peak sites. | It helped two sites, changed nothing at two and made one worse. |
| 2026-11-13 | S9's two spec gaps were filled in the spec (#47): a lookup fraction is stored as min(round(255 f), 254); the hillshade is lit from the top-left at 45° (science.md section 2.4). | The agent stopped, correctly, instead of guessing. |
| 2026-11-13 | The shareable link carries an optional `focus` parameter. | A link should open on the site the sender was looking at. |
| 2026-11-13 | A profile's power and comms weights must not both be zero, and each weight is from 0 to 1,000 (science.md section 10, mission-profiles.md). | Otherwise a site with no slope, or absurd weights, has no score. |
| 2026-11-13 | The slope from a polar map is read at the pixel nearest the site, not interpolated; the mesh's per-vertex slope is defined in science.md section 13. | The spec left both open; the S8 reviewer proposed the wording. |
| 2026-11-13 | The sweep worker (MC7a) was built before the Slip Planner's screen. | It has no user interface, so it did not wait for the design. |
| 2026-11-13 | S9 (#48) was reviewed by the orchestrator, not a second agent. | All slots were in use; the orchestrator is a different provider from the author, read the code and checked the outputs independently. The team lead was told. |
| 2026-11-13 | A sixth child ran for a time (the space-first design). | The team lead asked for it to start at once. |
| 2026-11-13 | Numbers on screen never contradict a verdict: a value and its limit gain decimals until they differ, and scores round down. Angles from data show at least one decimal. | From the MC4b and A4 reviews. |
| 2026-11-13 | **The team lead: "Go with your recommendations till now."** That settled: site placement (decision 0012); the scope for the deadline; solid panels as the default for the space-first design unless the prototype changes their mind; Pip's power meter carries no provenance tag; the unused confetti is removed; weights stay number boxes; the "worst broken rule" order; the orchestrator's own review of S9. | Unanswered questions were holding up nothing yet, but the placement question blocked honest results at five sites. |
| 2026-11-13 | **Space-first Mission Control** (decision 0013): the team lead's direction; prototype approved with "No objections" (solid panels, one continuous flight to the pole, the 4K Moon by default). | See "Design choices". |
| 2026-11-13 | The Slip Planner becomes a view over the pole: spots at the sites that change with a landing-date slider, and thin status strips below. No colour on the ground between sites; NASA's long-term average sunlight may shade the ground, in one warm tone, labelled as an average. | The team lead's idea; results exist only at sites, and red and amber already mean NO-GO and CAUTION. The team lead: "we don't need to compute each and every pixel". |
| 2026-11-13 | A code-built lander ("Pip") stands at the site in Local terrain, larger than life and labelled so; its panel faces the Sun and its dish Earth. No landing animation. | The team lead asked whether the lander would appear as a spacecraft. |
| 2026-11-13 | Custom coordinates return to scope in a small form. | The challenge's first objective lists them; the cut was made before anyone had read the full statement. Agreed by the team lead. |
| 2026-11-13 | `Gate.passed` and `Gate.measured` may be null: "not measured by this command". | G10 and G11 are checked in the web tests; writing them as failed would mislead the validation page. |
| 2026-11-13 | The scene build fingerprints its inputs by content hash, not modification time. | `scene/meta.json` is committed, and modification times differ on every checkout. |
| 2026-11-13 | The orchestrator reviewed S16 (#67) itself, as it had S9. | Codex was logged out and Antigravity's plan is small; the outputs matched the prototype's files pixel for pixel and an independent check of the aprons agreed within the encoding step. |
| 2026-11-13 | Lesson settings the lesson document left open were decided and written into it as "Exact settings" lines (the sketch window, the drag range, two sliders, lesson 4's unlocks). | The skeleton had quietly picked values. |

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
| Science (S0–S16) | S0 to S9, S10 (health, static files, custom sites), S12 and S12b, S13, S15a and S15b, S16 | #93 (score boundary), #94 (science document), #96 (API status, validation fields) | — |
| Mission Control (MC0–MC11) | MC0 to MC7, MC9, the shell feedback, custom coordinates and variant labels | — | strip height, middle mouse, Enter coordinates; Compare header |
| 3D and Map (T0–T8) | T0, T1, T2, T3, T7, scene polish | — | the Moon around the Polar map's square |
| Academy (A0–A11) | A0, A1, A2, A4, A5 (lessons 1 to 4), A7, A8 (validation page), A9 (math review), A11 (drafts) | #95 (A3: drag and sketch steps) | A11b (submission texts) |
| Design | Everything picked; see Design choices | — | — |

Out of scope for the deadline: T8's "compute for my dates", S10's job queue, S11 (the
sensitivity grid), A6 (lessons 5 to 8).

## Waiting on the team lead

An unanswered question takes the orchestrator's recommendation.

| Question | Asked at | Blocks | Running meanwhile |
| :--- | :--- | :--- | :--- |
| The repository is private and has no licence file. Judges need a public link or a zip. | 2026-11-13, three times | the submission | everything |
| The live demo link and the backup video. | 2026-11-13 | the submission | everything |
| Apply docs/submission/README-proposed.md? The real README still says "No application code exists yet". | 2026-11-13 | nothing | — |
| "Slip +7 d" and "+14 d" moved into the date picker to fit the window's end on one row. Back in the strip (at the cost of a second row)? | 2026-11-14 | nothing; left as built | — |
| The black box beside the folded sites rail: window size, which panels were open, browser. Two children could not reproduce it. | 2026-11-14 | that fix | everything else |
| Delete the stray `default` file a Docker child wrote under `~/.docker/contexts/meta/`? | 2026-11-13 | nothing | — |
| Links for the five retagged profile values; Luna's reference photos; the Artemis region outlines. | 2026-11-13 | nothing; shown as assumed, a placeholder, and not drawn | — |

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
| C2 | Mission Control's core layout | **Space-first, directed by the team lead on 2026-11-13.** The System view (a 3D Sun, Earth and Moon) is the home of Mission Control and fills the window. The interface floats above it in the same layout, panels still collapsible. A floating top bar picks the view and the camera does the switching: it flies to the south pole and the flat Polar map takes over; it continues down for Local terrain and the Lander's eye. The Slip Planner and Compare open as floating windows. Earth gets a real texture, the Sun must look good, and the Moon must be sharp: an 8K or 4K NASA globe with our 80 m shaded relief over the polar cap. Local terrain must read as part of the Moon, not a disc. A prototype is being made before anything final is built. | The team lead: "I want the main view to be the system view... the UI elements to kind of float above the space view". This replaces the a-or-b question for the four views; the a variants' content carries over. |
| C2 | The Slip Planner | **A camera view on the Moon, not a window; spots are variant a, the lamp and ring.** Picked 2026-11-13: "For the slip planner go with your recommendations". The camera stops above the south pole; each selected site is a status lamp with a ring that fills to the score; the bottom panel swaps to landing dates (a strip per site, an "Any site" line, a date slider); the ground's light is fixed; NASA's average sunlight is an optional dark-to-bright shading with its label; the ground between sites is never coloured by date. Prototype and note: `design/variants/c2-slip-on-moon.md` (#69). | The team lead asked for the Moon's surface with a slider instead of rectangles of colour, then took the designer's recommendations. |
| C2 | A lander in the 3D view | **Yes: a small code-built lander ("Pip") at the site in Local terrain.** Asked for by the team lead on 2026-11-13; part of T1. | "will we have the lander in the 3d view as a spaceship?" |
| Testing, 2026-11-14 | Every view | **No sentence under the view bar.** Its text is behind an info button on the current view's tab. | The team lead: "is taking too much space, just remove it". |
| Testing, 2026-11-14 | Bottom strip | **The landing date sits in the timeline's header**, with the window's end and "Next GO"; the strip keeps one height at every hour (the smaller one). | "The landing date selector should go down with the timeline scrub"; "the timeline's height expands while scrubbing which is very bad UX". |
| Testing, 2026-11-14 | System view | **A free trackball: no limit at the poles.** The middle mouse button turns like the left. No "Distances not to scale" plate (the fact stays in the About text). Real stars. | "I want to be able to freely rotate around the moon by just panning"; "remove the 'Distances are not to scale' label"; "Add some realistic stars". |
| Testing, 2026-11-14 | Local terrain, Lander's eye | **Relief to the horizon, visible drawn shadows, near-ground texture;** the horizon chart is collapsed by default behind an arrow. Shadows are decoration (decision 0015); the series decides lit or dark. | "it feels like a ps1 video game"; "see the 3d view by default and pop up the 2d detailed view with an arrow button". |
| Testing, 2026-11-14 | Polar map | **The rest of the Moon shows around the detailed square, and the square has a border.** | "It's just a square and everything else around it is black". |
| Testing, 2026-11-14 | Compare | **No description or summary sentence; the date beside the title; the table gets the space** (the strip folds while Compare is open). | "this data is useless… remove it"; "the table is barely visible". |
| Testing, 2026-11-14 | Add site | **Typed coordinates must be obvious:** an "Enter coordinates" row that looks like a control. | The team lead could not find the folded text toggle. |
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
| 2026-11-13 | MC3 and its review fixes | Cursor | `grok-4.7` | high | merged (#45); all seven findings closed in one run |
| 2026-11-13 | S7 | Codex | `gpt-6.1-sol` | high | merged (#42); reported the sunlight gap plainly and measured it |
| 2026-11-13 | C2 design, Mission Control views | Claude Code | `claude-opus-5-5` | high | merged (#41); waiting for the team lead's pick |
| 2026-11-13 | Review of S7 | Antigravity | `gemini-4-argon` | high | excellent: independent derivations, eight mutations, the NASA comparison reproduced; one surviving mutation fixed by the orchestrator |
| 2026-11-13 | Review of MC3 | Codex | `gpt-6.1-terra` | high | five must-fix findings, all real |
| 2026-11-13 | A2 and the Academy screens | Claude Code | `claude-opus-5-5` | high | merged (#50); three review fixes made by the orchestrator |
| 2026-11-13 | S9, first run | Codex | `gpt-6.1-terra` | high | stopped, correctly, on two spec gaps (fixed in #47); the rerun hit Codex's usage limit |
| 2026-11-13 | S8 part 1, first run | Codex | `gpt-6.1-terra` | high | hit the usage limit; found a mistake in the brief first |
| 2026-11-13 | S9, second run | Cursor | `grok-4.7` | high | cancelled: the Codex run finished after all (#48, merged) |
| 2026-11-13 | S8 part 1, second run, and its review fixes | Cursor | `grok-4.7` | high | merged (#51) |
| 2026-11-13 | C2 design, space-first Mission Control | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | Review of S8 part 1 | Codex | `gpt-6.1-sol` | high | five must-fix findings; reproduced all 66,049 mesh vertices independently |
| 2026-11-13 | Review of A2 | Antigravity | `gemini-4-hydrogen` | high | three must-fix findings; measured the screens in a browser |
| 2026-11-13 | MC4b and its review fixes | Claude Code | `claude-opus-5-5` | high | merged (#52) |
| 2026-11-13 | Review of MC4b | Codex | `gpt-6.1-terra` | high | four must-fix findings; could not open a browser |
| 2026-11-13 | MC7a, the sweep worker, and its review fixes | Cursor | `grok-4.7` | high | merged (#53) |
| 2026-11-13 | Review of MC7a | Codex | `gpt-6.1-terra` | high | two must-fix findings |
| 2026-11-13 | A4 | Claude Code | `claude-opus-5-5` | high | pull request #54; review fixes running |
| 2026-11-13 | Review of A4 | Codex | `gpt-6.1-terra` | high | six must-fix findings |
| 2026-11-13 | MC5 | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | S8 part 2 | Codex | `gpt-6.1-terra` | high | pull request #56, in review |
| 2026-11-13 | Review of S8 part 2 | Antigravity | `gemini-4-hydrogen` | high | running |
| 2026-11-13 | A4 review fixes | Claude Code | `claude-opus-5-5` | high | merged (#54) |
| 2026-11-13 | Academy lesson types and skeletons for lessons 1 to 4 | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | Sunlit-peak placement, part A (decision 0012) | Codex | `gpt-6.1-sol` | high | running |
| 2026-11-13 | MC5 and its review fixes | Claude Code | `claude-opus-5-5` | high | merged (#59) |
| 2026-11-13 | Review of MC5 | Antigravity | `gemini-4-hydrogen` | high | six must-fix findings, found by using it in a browser |
| 2026-11-13 | Lesson types (A5a) and review fixes | Cursor | `grok-4.7` | high | merged (#61) |
| 2026-11-13 | Review of A5a | Codex | `gpt-6.1-terra` | high | five findings, mostly quiet guesses where the lesson document was vague |
| 2026-11-13 | Placement part A (S15a) | Codex | `gpt-6.1-sol` | high | merged (#60); two review fixes made by the orchestrator |
| 2026-11-13 | Review of S15a | Cursor | `grok-4.7` | high | two findings; reproduced two sites on real data |
| 2026-11-13 | S12, validation | Codex | `gpt-6.1-sol` | high | stopped once, correctly, on undefined lesson numbers; merged (#63) after fixes by Cursor |
| 2026-11-13 | Review of S12 | Antigravity | `gemini-4-hydrogen` | high | reproduced every row; three surviving mutations |
| 2026-11-13 | S12 review fixes | Cursor | `grok-4.7` | high | all closed in one run |
| 2026-11-13 | C2 design, space-first Mission Control | Claude Code | `claude-opus-5-5` | high | merged (#62); approved |
| 2026-11-13 | Specs for space-first (decision 0013) | Claude Code | `claude-sonnet-5-5` | high | merged (#64); it added glossary terms that broke a web test (fixed in #65) |
| 2026-11-13 | S16, scene image files | Cursor | `grok-4.7` | high | merged (#67); the orchestrator reviewed it and replaced modification times with hashes |
| 2026-11-13 | MC4c, the space-first shell | Claude Code | `claude-opus-5-5` | high | merged (#66) after the review fixes |
| 2026-11-13 | Review of MC4c | Antigravity | `gemini-4-hydrogen` | high | eleven findings |
| 2026-11-13 | MC4c review fixes | Claude Code | `claude-opus-5-5` | high | all eleven closed in one run |
| 2026-11-13 | T1 and T2, the 3D scene | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | C2 design, the Slip Planner on the Moon | Claude Code | `claude-opus-5-5` | high | merged (#69); variant a picked |
| 2026-11-13 | S10 minimal and S13, Docker | Cursor | `grok-4.7` | high | merged (#71); it wrote two context files under `~/.docker`, outside its brief |
| 2026-11-13 | Review of S13 | Antigravity | `gemini-4-hydrogen` | high | approve; six follow-ups, four fixed by the orchestrator |
| 2026-11-13 | S15b, variants in build-sites | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | S12b, worked examples | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | Slip Planner spec rewrite | Claude Code | `claude-sonnet-5-5` | high | running |
| 2026-11-13 | MC6, the Lander's eye horizon chart | Claude Code | `claude-opus-5-5` | high | running |

Totals so far: Claude Code 24 (21 Opus, 3 Sonnet), Codex 26 (21 terra, 5 sol), Cursor 23
(22 `grok-4.7`, 1 `grok-4.6`), Antigravity 15 (3 flash, 10 hydrogen, 2 argon). Codex hit its
usage limit once and was reset by the team lead; later the same evening it was logged
out. Three Opus tasks often run at once because every screen goes to Opus.

## Open questions for the team lead

1. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md). Until the file arrives the build follows
   that page's fallback.
2. Luna's reference photos, needed at checkpoint C4.
3. Links for the Times of India interview on Chandrayaan-3's Sun-elevation limits, and a
   citable statement that IM-2 and Chandrayaan-3 used no relay.
