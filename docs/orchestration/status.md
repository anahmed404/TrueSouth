# Orchestration status

The orchestrator's memory between sessions. It is rewritten after every merge.
The prompt that drives the orchestrator is [`orchestrator-prompt.md`](orchestrator-prompt.md).

## Now

- **Milestone:** before M0. No application code exists.
- **Next step:** send checkpoint C0 (kickoff) and start M0 without waiting.
- **Running:** nothing.
- **Last checkpoint the team lead answered:** none yet.

## Model tiers

Confirmed with the team lead on 2026-11-13.

| Provider | Heavy | Everyday | Light |
| :--- | :--- | :--- | :--- |
| Claude Code | `claude-opus-5-5` | `claude-sonnet-5-5` | `claude-haiku-5-5` |
| Codex | `gpt-6.1-sol` | `gpt-6.1-terra` | `gpt-6.1-terra` at low effort |
| Antigravity (Google models only) | `gemini-4-argon` | `gemini-4-hydrogen` | `gemini-3.8-flash` |
| Cursor (Grok models only) | `grok-4.7` | `grok-4.7` | `grok-4.6` |

All UI work goes to `claude-opus-5-5`.

## Work packages

All not started. Ids are from [`../build-plan.md`](../build-plan.md).

| Track | Verified | In review | In progress |
| :--- | :--- | :--- | :--- |
| Science (S0–S14) | — | — | — |
| Mission Control (MC0–MC7, MC9, MC11) | — | — | — |
| 3D and Map (T0–T8) | — | — | — |
| Academy (A0–A11) | — | — | — |

## Waiting on the team lead

What is blocked on an answer, and what is running meanwhile.

| Question | Asked at | Blocks | Running meanwhile |
| :--- | :--- | :--- | :--- |
| — | — | — | — |

## Design choices

None yet. Each entry: checkpoint, screen, the variant chosen, and why.

## Usage ledger

One line per delegated task: date, work package, provider, model, effort, outcome.

_Empty._

## Open questions for the team lead

1. The Artemis region outlines need a free ScienceBase login to download. See
   [`../site-catalog.md`](../site-catalog.md).
2. Luna's reference photos, needed at checkpoint C4.
