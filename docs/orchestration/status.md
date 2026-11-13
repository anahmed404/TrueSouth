# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Milestone:** M0 Foundations, in progress. Started 2026-11-13.
- **Checkpoint C0 (kickoff):** sent 2026-11-13. It needs no answer.
- **Checkpoint C1:** the design half was sent early, on 2026-11-13, and the team lead
  answered it (see "Design choices"). The other half, the app running on fixtures with
  test results, is still owed at the end of M0.
- **On `main`:** MC0, T0, A0, A1, design directions A, B and C with their screenshots.
  `pnpm --dir web test` passes 120 tests and typecheck is clean.
- **Critical path:** S0 (pull request #14) is waiting on its review. S1, S2, MC1 and MC2
  all wait on it.
- **Next step:** see "What to do next".

## Running now

Each child works in its own worktree and opens a pull request.

| Task | Branch | Provider, model, effort | State |
| :--- | :--- | :--- | :--- |
| Review of S0 (#14) | — | Cursor, `grok-4.7`, high | running |
| Impeccable pass on design direction C | `design/c1-direction-c2` | Claude Code, `claude-opus-5-5`, high | running |
| S3 frames (gate G3), stacked on the S0 branch | `science/s3-frames` | Codex, `gpt-6.1-terra`, high | running |

S0 itself is finished: pull request #14, orchestrator's check passed (6 tests, repeatable
schema export, every CLI command present, byte-order marks removed).

## What to do next

1. **When the S0 review returns:** fix small findings yourself, send large ones back to the
   S0 thread, then squash-merge #14. Expect it to ask for more tests and for descriptions
   on the models.
2. **Right after S0 merges:**
   - run `pnpm --dir web gen:types`, commit `web/src/contracts/generated.ts`, and replace
     the temporary `MissionProfile` type in `web/src/app/panel.ts` with the generated one;
   - start S1 (catalog files) on Codex `gpt-6.1-terra`;
   - merge `main` into `science/s3-frames` when its pull request arrives (it was branched
     from the S0 branch, so expect a `DEVLOG.md` conflict; keep both entries).
3. **After S1:** S2 (scoring reference and fixtures). **After S2:** MC1 and MC2 on Cursor
   `grok-4.7`, in parallel.
4. **When the impeccable pass returns:** take screenshots of the four `c2` pages into
   `docs/design/c1/` next to the `c` ones, show the team lead before and after, and wait
   for approval. Nothing real is built from the design until then.
5. **After the design is approved:** have Opus set the real theme tokens in
   `web/src/app/theme.css` from `design/variants/direction-c2.md`, delete the losing
   prototypes (`a/`, `b/`, and `c/` once `c2` replaces it), and build MC4–MC6 in that look
   as their data and logic land.
6. **End of M0:** integration check on `main`, then the rest of checkpoint C1.
7. **Still to design before C2:** the Slip Planner, polar map, System view and local
   terrain, and the Academy flow. The team lead asked where the 3D views were, so show the
   System view and local terrain early. Brief them with the impeccable skill and the look
   the team lead approves.

## How to brief and check agents: lessons so far

- **Completions do not always wake you.** A child that finishes while you are mid-turn is
  not announced. At the start of every turn run `gh pr list`, and call `task_status` on
  anything that has been running longer than expected. S0's first run quit after 18 seconds
  and sat unnoticed for 20 minutes.
- **Codex `gpt-6.1-terra` at medium effort is unreliable here.** It quit once with nothing
  built, then delivered thin work and opened its pull request before its own full test run
  had finished. Use high effort, and say "do not end your turn until the tests pass and the
  pull request is open".
- **Tell agents writing files from PowerShell** to write UTF-8 without a byte-order mark.
- **Downloads from `files.pythonhosted.org` crawl on this machine** (about 20 KB/s; the
  first `uv sync` took 39 minutes). The uv cache is warm now. Expect the NASA downloads in
  S5 to need watching.
- **`npx impeccable …` hangs unless stdin is closed** (`< /dev/null`).
- **Every UI or design brief must say "use the impeccable skill"** and carry the team
  lead's taste (see "Design choices"). The first three design briefs did not, and none of
  the designers used it.
- **Children must not relax pnpm's release-age check.** MC0 did; it was undone.
- **Parallel packages in one track collide in `DEVLOG.md` and at their seams.** A0 and A1
  did both. Merge `main` into the second branch, rerun the checks, and fix the seam before
  merging. `mark_verified.py` and `resolve_devlog.py` style helpers are easy to rewrite:
  keep both entries, then change "built, not verified" to "verified (how)".
- **Screenshots:** serve the folder with `python -m http.server` and use the browser tool;
  it refuses `file:` addresses.

## Follow-ups to put in later briefs

| For | What |
| :--- | :--- |
| A2, A3, A5 | A0's lesson types need widening before real lessons are written: a goal's value must allow text, a date and a `{{example.key}}` placeholder, not only a number; `drop-pin` needs a site or coordinates as its attempt and an optional goal; a reveal can be text, not only a panel; `draw-skyline` needs graded XP ("closer sketches earn more"). From the A0 review. |
| T1, T3, T7 | Pass `moon_radius_m`, `skyline_bins` and mesh sizes from the manifest and site meta into the `lib/geo` helpers instead of relying on their defaults. From the T0 review. |
| Opus, when setting theme tokens | A1 wanted tokens that do not exist: Luna's body, crater, feature, sparkle and tear colours, a bubble background, and a confetti palette that does not reuse the status colours. |
| S1 or S2 | Harden `contracts.py` if the S0 review leaves gaps: more tests, descriptions on fields. |

## Decisions the orchestrator made

| Date | Decision | Why |
| :--- | :--- | :--- |
| 2026-11-13 | MC0 went to Cursor `grok-4.7`, not Opus. | It is scaffolding and wiring. Every screen in it is a plain placeholder that Opus replaces after the design choice. |
| 2026-11-13 | S0 declares the whole Python stack and MC0 the whole web stack. | Parallel work packages would otherwise all edit the dependency lists. |
| 2026-11-13 | `schema.json` is one JSON Schema document titled `TrueSouthContracts`, with every model under `$defs`. `gen:types` emits every definition. | S0 and MC0 were built in parallel and needed a fixed seam. |
| 2026-11-13 | Three design directions for C1, each a coherent look across all four screens, one Opus child per direction. | The overall look is the biggest choice. |
| 2026-11-13 | C1 prototypes are static HTML with mock data, not fixture data. | Fixtures (S2) do not exist yet and the prototypes are thrown away. |
| 2026-11-13 | Design-prototype pull requests get the orchestrator's visual check but no cross-provider review. | They are throwaway and never ship. |
| 2026-11-13 | Status and orchestration docs reach `main` through small pull requests, like everything else. | Keeps `main` history uniform and never needs a direct push. |
| 2026-11-13 | MC0: removed the agent's exception to pnpm's release-age check and resolved `motion` to 14.12.0. | The check refuses packages published in the last day. |
| 2026-11-13 | MC0: the dev-server path helper lives in `web/dev/`, not `web/src/app/`. | It imports Node modules and must not sit in the browser source tree. |
| 2026-11-13 | The design half of C1 was sent before M0 finished. | The team lead's pick is the long pole for the M1 screens; nothing else depended on waiting. |
| 2026-11-13 | S3 was started on top of the unmerged S0 branch. | S0's review was the only thing holding the Science chain, and S3 does not touch S0's files. |
| 2026-11-13 | T0: `lib/geo` no longer exports degree and radian conversion. | Angles cross module boundaries in degrees. |

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
| Science (S0–S14) | — | S0 (#14) | S3 |
| Mission Control (MC0–MC7, MC9, MC11) | MC0 | — | — |
| 3D and Map (T0–T8) | T0 | — | — |
| Academy (A0–A11) | A0, A1 | — | — |
| Design for C1 | directions A, B, C and the Mission Control flow (merged, screenshots in `docs/design/c1/`) | — | impeccable pass on C |

## Waiting on the team lead

What is blocked on an answer, and what is running meanwhile.

| Question | Asked at | Blocks | Running meanwhile |
| :--- | :--- | :--- | :--- |
| Approval of the refined direction C | to be asked when the impeccable pass returns | theme tokens; the final build of MC4, MC5, MC6 and the start screen | S0 review, S3, then S1, S2, MC1, MC2 |

## Design choices

| Checkpoint | Screen | Choice | Why |
| :--- | :--- | :--- | :--- |
| C1 | Overall look | **Direction C as the base, to be refined.** Plain dark mode in neutral tones; no purple or indigo; less glow; no all-caps titles; less on screen at once. | The team lead called the three directions "vibe coded slop", disliked the "purple AI colour", and found the screens overwhelming. |
| C1 | Layouts | The team lead "doesn't mind the layouts". The orchestrator's recommendation stands: A's docked shell (sites left, focused site right, timeline bottom) in C's look. | C's floating panels cover the main view. |
| C1 | Every view | Each view says in one plain sentence what it shows. The tabs must make the 3D views (System view, local terrain) obvious. | The team lead did not understand the Lander's eye from the mock-up and asked where the 3D view was. |
| C1 | Process | Design work uses the `impeccable` skill (updated from 4.0.4 to 4.9.0 on 2026-11-13). Tell the team lead before running a design pass. | Asked for directly. |

Not final until the team lead approves the refined screens.

## Usage ledger

One line per delegated task: date, work package, provider, model, effort, outcome.

| Date | Task | Provider | Model | Effort | Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-13 | S0, first run | Codex | `gpt-6.1-terra` | medium | failed: quit after 18 s with nothing built |
| 2026-11-13 | S0, second run | Codex | `gpt-6.1-terra` | medium | pull request #14 after 50 minutes, 39 of them a slow `uv sync`; thin but working |
| 2026-11-13 | MC0 | Cursor | `grok-4.7` | high | merged (#5) after three small fixes; about 15 minutes |
| 2026-11-13 | Review of MC0 | Antigravity | `gemini-3.8-flash` | medium | done; two findings fixed, one dismissed |
| 2026-11-13 | C1 design A and Mission Control flow | Claude Code | `claude-opus-5-5` | high | merged (#8) |
| 2026-11-13 | C1 design B | Claude Code | `claude-opus-5-5` | high | merged (#6) |
| 2026-11-13 | C1 design C | Claude Code | `claude-opus-5-5` | high | merged (#7) |
| 2026-11-13 | T0 | Cursor | `grok-4.7` | high | merged (#12) after four review fixes; about 12 minutes |
| 2026-11-13 | Review of T0 | Antigravity | `gemini-4-hydrogen` | high | done; found a real angle-wrap bug and three test blind spots |
| 2026-11-13 | A0 | Cursor | `grok-4.7` | high | merged (#13) after wiring it to the real Luna; about 15 minutes |
| 2026-11-13 | Review of A0 | Antigravity | `gemini-3.8-flash` | high | done; approved, with follow-ups for the lesson types |
| 2026-11-13 | A1 | Claude Code | `claude-opus-5-5` | medium | merged (#11); about 30 minutes |
| 2026-11-13 | Review of A1 | Cursor | `grok-4.6` | medium | done; approved |
| 2026-11-13 | Review of S0 | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | Impeccable pass on design C | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | S3 | Codex | `gpt-6.1-terra` | high | running |

Totals so far: Claude Code 5 (all Opus), Codex 3, Cursor 6, Antigravity 3 (two flash, one
hydrogen, no argon). No provider has hit a limit.

## Open questions for the team lead

1. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md). Until the file arrives the build follows
   that page's fallback: six regions drawn as their close-up DEM footprint, labelled
   "approximate", and the other three left out.
2. Luna's reference photos, needed at checkpoint C4.
3. Scope: the full plan through M4 will not fit by the end of 14 November at the pace
   measured so far. The orchestrator suggested submitting at M2 plus the validation page,
   the Docker deploy and the submission text. Not yet answered.
