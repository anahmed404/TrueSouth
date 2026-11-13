# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Milestone:** before M0. No application code exists.
- **Next step:** checkpoint C0 (kickoff).
- **Running:** nothing.

## Model tiers

| Provider | Heavy | Everyday | Light |
| :--- | :--- | :--- | :--- |
| Claude Code | `claude-opus-5-5` | `claude-sonnet-5-5` | `claude-haiku-5-5` |
| Codex | not confirmed | not confirmed | not confirmed |
| Antigravity | not confirmed (`gemini-4-argon` or `gemini-4-hydrogen`) | not confirmed | `gemini-3.8-flash` |
| Cursor | `grok-4.7` | `grok-4.7` | `grok-4.6` |

**Tiers confirmed with the team lead:** no. Ask at kickoff.

Models seen on 2026-11-13: Codex offered `gpt-6.1-sol`, `gpt-6-astra`, `gpt-6.1-terra` and
`gpt-6-luna`.

## Work packages

All not started. Ids are from [`../build-plan.md`](../build-plan.md).

| Track | Verified | In review | In progress |
| :--- | :--- | :--- | :--- |
| Science (S0–S14) | — | — | — |
| Mission Control (MC0–MC7, MC9, MC11) | — | — | — |
| 3D and Map (T0–T8) | — | — | — |
| Academy (A0–A11) | — | — | — |

## Design choices

None yet. Each entry: checkpoint, screen, the variant chosen, and why.

## Usage ledger

One line per delegated task: date, work package, provider, model, effort, outcome.

_Empty._

## Open questions for the team lead

1. Model tiers for Codex and Antigravity (kickoff).
2. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md).
3. Luna's reference photos, needed at checkpoint C4.
