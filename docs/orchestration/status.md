# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Milestone:** M0 Foundations, in progress. Started 2026-11-13.
- **Checkpoint C0 (kickoff):** sent 2026-11-13. It needs no answer.
- **Last checkpoint the team lead answered:** none yet. C1 is the first that needs one.
- **Running:** five children, listed under "Running now".
- **Next step:** review and merge each child as it finishes, then start the next wave
  (see "What to do next").

## Running now

Started 2026-11-13. Each child works in its own worktree and opens a pull request.

| Task | Branch | Provider, model, effort | State |
| :--- | :--- | :--- | :--- |
| S0 Python workspace, contracts, `export-schema` | `science/s0-workspace` | Codex, `gpt-6.1-terra`, medium | running |
| MC0 web scaffold with placeholders | `mc/mc0-scaffold` | Cursor, `grok-4.7`, high | running |
| C1 design direction A, "Flight console", and the Mission Control flow | `design/c1-direction-a` | Claude Code, `claude-opus-5-5`, high | running |
| C1 design direction B, "Lunar atlas" | `design/c1-direction-b` | Claude Code, `claude-opus-5-5`, high | running |
| C1 design direction C, "Night-sky instrument" | `design/c1-direction-c` | Claude Code, `claude-opus-5-5`, high | running |

## What to do next

M0 order. A package starts when what it needs is merged and a slot is free (five at once).

| Wave | Packages | Needs | Agent |
| :--- | :--- | :--- | :--- |
| 1 (running) | S0, MC0, C1 design directions A, B, C | — | see above |
| 2 | S1 catalog files | S0 | Codex `gpt-6.1-terra`, medium |
| 2 | S3 frames (M1 science, started early because Science is the critical path) | S0 | Codex `gpt-6.1-terra`, medium |
| 2 | T0 `lib/geo/` helpers and tests | MC0 | Cursor `grok-4.7`, high |
| 2 | A0 lesson types, step runner logic, `academy` store; path map behind a plain placeholder | MC0 | Cursor `grok-4.7`, high |
| 2 | A1 Luna and LunaSays with placeholder art | MC0 | Claude Code `claude-opus-5-5`, medium |
| 3 | S2 scoring reference and fixtures | S0, S1 | Codex `gpt-6.1-terra`, medium |
| 4 | MC1 loaders, decoders, data hooks | MC0, S2 | Cursor `grok-4.7`, high |
| 4 | MC2 scoring and gate G10 | MC0, S2 | Cursor `grok-4.7`, high |
| end | Integration check on `main`, screenshots of the variants, checkpoint C1 | all | orchestrator |

After S0 and MC0 are both on `main`: run `pnpm --dir web gen:types` and commit
`web/src/contracts/generated.ts` if MC0 could not (MC0 was told to do it only if S0 had
already merged).

When the three design pull requests are merged: open each prototype at 1440 × 900, save
the screenshots in `docs/design/c1/`, and build the side-by-side comparison for C1.

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
| Mission Control (MC0–MC7, MC9, MC11) | — | — | MC0 |
| 3D and Map (T0–T8) | — | — | — |
| Academy (A0–A11) | — | — | — |
| Design for C1 | — | — | directions A, B, C; Mission Control flow |

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
| 2026-11-13 | S0 | Codex | `gpt-6.1-terra` | medium | running |
| 2026-11-13 | MC0 | Cursor | `grok-4.7` | high | running |
| 2026-11-13 | C1 design A and Mission Control flow | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | C1 design B | Claude Code | `claude-opus-5-5` | high | running |
| 2026-11-13 | C1 design C | Claude Code | `claude-opus-5-5` | high | running |

Totals so far: Claude Code 3 (all Opus), Codex 1, Cursor 1, Antigravity 0.
No provider has hit a limit.

## Open questions for the team lead

1. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md). Until the file arrives the build follows
   that page's fallback: six regions drawn as their close-up DEM footprint, labelled
   "approximate", and the other three left out.
2. Luna's reference photos, needed at checkpoint C4.
