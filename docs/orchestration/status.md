# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Milestone:** M0 Foundations, in progress. Started 2026-11-13.
- **Checkpoint C0 (kickoff):** sent 2026-11-13. It needs no answer.
- **Last checkpoint the team lead answered:** none yet. C1 is the first that needs one.
- **On `main`:** MC0 (web scaffold), design directions B and C.
- **Running:** see "Running now".
- **Next step:** review and merge each child as it finishes, then start the next wave
  (see "What to do next").
- **Watch out:** a child's completion does not always wake the orchestrator. Whenever you
  are active, check `gh pr list` and each running worktree, and do not assume silence means
  "still working". S0's first run quit after 18 seconds and sat unnoticed for 20 minutes.

## Running now

Each child works in its own worktree and opens a pull request.

| Task | Branch | Provider, model, effort | State |
| :--- | :--- | :--- | :--- |
| S0 Python workspace, contracts, `export-schema` | `science/s0-workspace` | Codex, `gpt-6.1-terra`, medium | running (second run; the first quit without building anything) |
| C1 design direction A, "Flight console", and the Mission Control flow | `design/c1-direction-a` | Claude Code, `claude-opus-5-5`, high | running; all files drafted, no pull request yet |
| T0 `lib/geo/` helpers and tests | `map/t0-geo-helpers` | Cursor, `grok-4.7`, high | running |
| A0 lesson types, step runner, `academy` store | `academy/a0-lesson-runner` | Cursor, `grok-4.7`, high | running |
| A1 Luna with placeholder art | `academy/a1-luna-placeholder` | Claude Code, `claude-opus-5-5`, medium | running |

## What to do next

M0 order. A package starts when what it needs is merged and a slot is free (five at once).

| Wave | Packages | Needs | Agent |
| :--- | :--- | :--- | :--- |
| 1 | S0 (running), MC0 (merged), C1 design B and C (merged), C1 design A (running) | — | see above |
| 2 (running) | T0, A0, A1 | MC0 | see above |
| 2 | S1 catalog files | S0 | Codex `gpt-6.1-terra`, medium |
| 2 | S3 frames (M1 science, started early because Science is the critical path) | S0 | Codex `gpt-6.1-terra`, medium |
| 3 | S2 scoring reference and fixtures | S0, S1 | Codex `gpt-6.1-terra`, medium |
| 4 | MC1 loaders, decoders, data hooks | MC0, S2 | Cursor `grok-4.7`, high |
| 4 | MC2 scoring and gate G10 | MC0, S2 | Cursor `grok-4.7`, high |
| end | Integration check on `main`, the C1 comparison, checkpoint C1 | all | orchestrator |

When S0 is on `main`: run `pnpm --dir web gen:types`, commit
`web/src/contracts/generated.ts`, and replace the temporary `MissionProfile` type in
`web/src/app/panel.ts` with the generated one.

Design screenshots for C1 are in `docs/design/c1/`, named `<screen>-<direction>.png`, taken
at 1440 px wide (full page). B and C are done. When direction A merges, take its four
screenshots and the Mission Control flow the same way: serve `design/` with
`python -m http.server` and use the browser tool, since it refuses `file:` addresses.

If Codex quits early again on a Science package, raise its effort to high; if that also
fails, move the package to `gpt-6.1-sol`.

## Decisions the orchestrator made

| Date | Decision | Why |
| :--- | :--- | :--- |
| 2026-11-13 | MC0 went to Cursor `grok-4.7`, not Opus. | It is scaffolding and wiring. Every screen in it is a plain placeholder that Opus replaces after the C1 design choice. |
| 2026-11-13 | S0 declares the whole Python stack and MC0 the whole web stack. | Parallel work packages would otherwise all edit the dependency lists. |
| 2026-11-13 | `schema.json` is one JSON Schema document titled `TrueSouthContracts`, with every model under `$defs`. `gen:types` emits every definition. | S0 and MC0 were built in parallel and needed a fixed seam. |
| 2026-11-13 | Three design directions for C1, each a coherent look across all four screens, one Opus child per direction. | The overall look is the biggest choice. Splitting by direction keeps each look consistent and the three clearly different. Later checkpoints can use two variants. |
| 2026-11-13 | C1 prototypes are static HTML with mock data, not fixture data. | Fixtures (S2) do not exist yet and the prototypes are thrown away. |
| 2026-11-13 | Design-prototype pull requests get the orchestrator's visual check but no cross-provider review. | They are throwaway and never ship. |
| 2026-11-13 | Status and orchestration docs reach `main` through small pull requests, like everything else. | Keeps `main` history uniform and never needs a direct push. |
| 2026-11-13 | MC0: removed the agent's exception to pnpm's release-age check and resolved `motion` to 14.12.0. | The check refuses packages published in the last day. Children are now told not to relax it. |
| 2026-11-13 | MC0: the dev-server path helper lives in `web/dev/`, not `web/src/app/`. | It imports Node modules and must not sit in the browser source tree. |

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
| Science (S0–S14) | — | — | S0 |
| Mission Control (MC0–MC7, MC9, MC11) | MC0 | — | — |
| 3D and Map (T0–T8) | — | — | T0 |
| Academy (A0–A11) | — | — | A0, A1 |
| Design for C1 | directions B, C (merged, screenshots taken) | — | direction A; Mission Control flow |

## Waiting on the team lead

What is blocked on an answer, and what is running meanwhile.

| Question | Asked at | Blocks | Running meanwhile |
| :--- | :--- | :--- | :--- |
| — | — | — | — |

## Design choices

None yet. Each entry: checkpoint, screen, the variant chosen, and why.

## Usage ledger

One line per delegated task: date, work package, provider, model, effort, outcome.

| Date | Task | Provider | Model | Effort | Outcome |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 2026-11-13 | S0, first run | Codex | `gpt-6.1-terra` | medium | failed: quit after 18 s with nothing built and no reason |
| 2026-11-13 | S0, second run (same thread) | Codex | `gpt-6.1-terra` | medium | running |
| 2026-11-13 | MC0 | Cursor | `grok-4.7` | high | merged (#5) after three small fixes by the orchestrator; about 15 minutes |
| 2026-11-13 | Review of MC0 | Antigravity | `gemini-3.8-flash` | medium | done; three findings, two fixed, one dismissed (placeholder labels) |
| 2026-11-13 | C1 design A and Mission Control flow | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | C1 design B | Claude Code | `claude-opus-5-5` | high | merged (#6); about 25 minutes |
| 2026-11-13 | C1 design C | Claude Code | `claude-opus-5-5` | high | merged (#7); about 25 minutes |
| 2026-11-13 | T0 | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | A0 | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | A1 | Claude Code | `claude-opus-5-5` | medium | running |

Totals so far: Claude Code 4 (all Opus), Codex 2, Cursor 3, Antigravity 1.
No provider has hit a limit.

## Open questions for the team lead

1. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md). Until the file arrives the build follows
   that page's fallback: six regions drawn as their close-up DEM footprint, labelled
   "approximate", and the other three left out.
2. Luna's reference photos, needed at checkpoint C4.
