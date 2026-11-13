# Development log

What has been built, what is blocked, and how AI tools were used.

## How to use this file

- Add an entry when you finish a work package, hit a blocker, or change a contract.
- **Write only in your own track's section.** That keeps four people's entries from
  colliding when branches merge.
- Newest entries go at the top of your section.
- Say **verified** only when the work package's checks have passed. Otherwise say
  **built, not verified**.
- Keep entries short. Details belong in the pull request.

Entry format:

```markdown
#### YYYY-MM-DD · <work package id> · <one-line summary>
- **Who:** <name>
- **AI use:** <tool> — <what it produced> — <how you checked it>
- **State:** verified | built, not verified | blocked
- **Changed:** <folders or key files>
- **Notes:** <anything the next person must know; measured numbers; open questions>
```

The **AI use** line is required. Space Apps asks teams to disclose how AI was used, and
these lines are collected into the submission (work package A11).

- Name the tool and what it produced. "Codex wrote the first version of `skyline.py`" is
  useful. "Used AI for coding" is not.
- Say how a human checked it: which tests, which review.
- List AI-generated images, audio or video separately, with the tool that made them.
- NASA data and logos are never AI-generated or altered.

Tools the team uses: Claude Code, Codex, Cursor, Antigravity.

## Status board

Ids are from [`docs/build-plan.md`](docs/build-plan.md). The team lead updates this at
each integration checkpoint.

| Milestone | State |
| :--- | :--- |
| M0 Foundations | not started |
| M1 Thin slice | not started |
| M2 Mission Control complete on catalog data | not started |
| M3 Everything | not started |
| M4 Tuned and submitted | not started |

## Science

#### 2026-11-13 · S3 · Site-centred frames and polar projection
- **Who:** Codex agent, for the orchestrator
- **AI use:** Codex, gpt-6.1-terra — wrote geometry tests and `frames.py` — agent ran pytest; the orchestrator has not checked it yet
- **State:** built, not verified
- **Changed:** `science/src/truesouth/frames.py`, `science/tests/test_frames.py`, this entry
- **Notes:** G3 largest error: 3.0886440072208643e-9 m (inverse); forward: 1.1524528889697587e-9 m.

#### 2026-11-13 · S0 · Python workspace and contracts
- **Who:** Science track
- **AI use:** Codex, gpt-6.1-terra — implemented workspace, contracts and CLI — automated checks run; human review pending
- **State:** built, not verified
- **Changed:** Python workspace, science, api, schema and data contract documentation
- **Notes:** Provenance serialization and worked-example nesting are specified in data-contracts.md.


## Mission Control

_No entries yet._

## 3D and Map

_No entries yet._

## Academy

_No entries yet._

## Planning

#### 2026-11-13 · planning · One orchestrator runs all four tracks
- **Who:** team lead
- **AI use:** Claude Code — wrote `docs/orchestration/` — team lead set the rules it
  encodes
- **State:** verified (documents only)
- **Changed:** `docs/orchestration/`, `docs/tracks/README.md`, `docs/build-plan.md`,
  `docs/academy/luna.md`
- **Notes:** A Claude Fable 5.2 session hands work packages to agents on Claude Code,
  Codex, Cursor (Grok models only) and Antigravity (Google models only). All UI work goes
  to Claude Opus 5.5. It stops at six checkpoints for review and shows design variants
  before any final UI. Luna stays a placeholder until the last milestone.

#### 2026-11-13 · planning · Work split into four tracks with a guide each
- **Who:** team lead
- **AI use:** Claude Code — wrote `docs/tracks/` and moved the polar map and custom sites
  from Mission Control to the 3D and Map track — team lead reviewed the split
- **State:** verified (documents only)
- **Changed:** `docs/tracks/`, `docs/build-plan.md`, `AGENTS.md`, `README.md`, this file

#### 2026-11-13 · planning · Plan rewritten as an implementation-ready doc set
- **Who:** team lead
- **AI use:** Claude Code — reviewed the first plan against the challenge text and the
  judging guide, researched NASA data products and mission facts, and wrote the documents
  in `docs/` — team lead answered every design question and approved the result
- **State:** verified (documents only; no application code exists)
- **Changed:** replaced the three `lunar_navigator_*.md` files with `README.md`,
  `AGENTS.md`, `CONTEXT.md`, `DEVLOG.md` and `docs/`.
- **Notes:**
  - Main changes: two modes (Mission Control and Academy); mission profiles named after
    real missions; Slip Planner; Lander's eye view; System view; a site-centred local
    frame; one global ephemeris; Sun and Earth as discs.
  - A real Horizons run for Connecting Ridge (December 2026) showed the earlier fixed
    limits would have made every polar site NO-GO. See
    [`docs/decisions/0007-mission-profiles.md`](docs/decisions/0007-mission-profiles.md).
  - Open items are listed in [`docs/build-plan.md`](docs/build-plan.md).

#### 2026-11-13 · planning · First planning notes committed
- **Who:** team
- **AI use:** not recorded
- **State:** superseded
- **Changed:** `lunar_navigator_tech_decisions.md`,
  `lunar_navigator_team_implementation_plan.md`, `lunar_navigator_development_log.md`
  (commit `76bb523`; still in git history).
