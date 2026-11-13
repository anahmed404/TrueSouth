# Tracks: who does what

TrueSouth is built in four tracks. A track is a lane of work with its own folders and its
own guide in this folder.

| Track | Guide | Builds |
| :--- | :--- | :--- |
| Science | [`science.md`](science.md) | The Python pipeline, the derived data, the API |
| Mission Control | [`mission-control.md`](mission-control.md) | The web app's shell, scoring, timeline, Lander's eye, Slip Planner, Compare |
| 3D and Map | [`3d-and-map.md`](3d-and-map.md) | System view, local terrain, polar map, custom sites |
| Academy | [`academy.md`](academy.md) | Lessons, Luna, explanations, validation page, submission |

## Who runs the tracks

One orchestrator runs all four. It is a Claude Fable 5.2 session driven by
[`../orchestration/orchestrator-prompt.md`](../orchestration/orchestrator-prompt.md). It
hands each work package to a coding agent on Claude Code, Codex, Cursor or Antigravity,
checks the result and merges it. The team lead reviews at checkpoints.

So in the guides:

- "You" is the coding agent doing a work package in that track.
- "Tell the team" means report to the orchestrator.
- A track's "owner" is the orchestrator, acting for that track.

The tracks still matter. They are what lets several agents work at once without touching
the same files.

The work packages, their order and their checks are in
[`../build-plan.md`](../build-plan.md). The guides here do not repeat them. They say what
to do first, what each track hands to the others, and how to brief an agent.

## The first day

Most work cannot start until two things exist. Do these first, and merge them to `main`
before anything else.

1. **Science: S0.** The Python workspace and `contracts.py`. This defines every data
   format.
2. **Mission Control: MC0.** The web scaffold, with a placeholder for every panel (see
   "The seams" below).
3. **Science: S1 and S2.** The catalog input files and the fixtures.

After step 2, the 3D and Map track and the Academy track can start. After step 3, every
screen has data to show.

## The seams

Four agents can write code at once only if they meet at a few fixed places. These are
those places. Once the code exists, the code is the truth and this section points to it.

### 1. Data formats

Defined in `science/src/truesouth/contracts.py`. TypeScript types are generated from it.
Spec: [`../data-contracts.md`](../data-contracts.md). Owner: Science.

### 2. Fixtures

`data/fixtures/` holds a small synthetic dataset in the real formats. Every web feature is
built and tested on fixtures first. Real data replaces them with no code change. Owner:
Science.

### 3. Data hooks

Only `web/src/data/` fetches or decodes files. Everyone else uses its hooks. Owner:
Mission Control.

```ts
useManifest()            // time grid, constants
useSites()               // the catalog
useSite(siteId)          // one site's sites.json entry and meta
useSeries(siteId)        // decoded Float32Array per column
useSkyline(siteId)       // the five skyline arrays
useTerrain(siteId)       // the local mesh arrays, or null
useCloseup(siteId)       // the close-up mesh arrays, or null
useSystem()              // sub-solar and sub-Earth points, distances
useProfiles()            // the presets
```

Each hook returns `{ status: "loading" | "ready" | "error", data, error }`.

### 4. Evaluation hooks

Only `web/src/lib/scoring/` turns a series and a profile into metrics, vetoes, a score and
a status. Owner: Mission Control.

```ts
useEvaluation(siteId, profile, landingUtc)   // metrics, vetoes, utilities, score, status
useHourFlags(siteId, profile)                // lit[] and link[] for the whole time grid
useCountdowns(siteId, profile, currentUtc)   // next sunset, sunrise, Earthset, Earthrise
```

No other code decides whether an hour is lit or linked. A sight-line's colour, a pin's
colour and a lesson's "correct" all come from these hooks.

### 5. The scenario

```ts
type Scenario = {
  profile: MissionProfile;
  siteIds: string[];          // selected sites, up to 8
  focusedSiteId: string | null;
  landingUtc: string;
  currentUtc: string;         // the scrubber
};
```

Mission Control keeps one scenario in the `scenario` store and mirrors it to the URL.
A lesson builds its own scenario and never touches the store. Owner: Mission Control.

### 6. Panels

Every view is a panel: a React component that takes a scenario as props and holds no
hidden state. Mission Control shows panels in its tabs. The Academy shows the same panels
inside lessons.

```ts
// web/src/app/panel.ts  (owner: Mission Control)
type PanelProps = {
  scenario: Scenario;
  onScenarioChange?: (patch: Partial<Scenario>) => void;  // omit for a read-only panel
  mode: "mission" | "lesson";     // "lesson" hides chrome and fits a small box
  marker?: { azDeg: number } | null;                      // the shared blocker marker
  onMarkerChange?: (marker: { azDeg: number } | null) => void;
};
```

Each panel is the default export of one fixed file. MC0 creates every one of these as a
placeholder, so the router compiles from the first day. The owner replaces the
placeholder.

| Panel | File | Owner |
| :--- | :--- | :--- |
| `SlipPlanner` | `features/mission-control/slip-planner/index.tsx` | Mission Control |
| `Timeline`, `Countdowns` | `features/mission-control/site-detail/index.tsx` | Mission Control |
| `Compare` | `features/mission-control/compare/index.tsx` | Mission Control |
| `LandersEye` | `features/panorama/index.tsx` | Mission Control |
| `PolarMap` | `features/polar-map/index.tsx` | 3D and Map |
| `SystemView` | `features/three/system-view/index.tsx` | 3D and Map |
| `LocalTerrain` | `features/three/local-terrain/index.tsx` | 3D and Map |
| `AcademyRoutes` | `features/academy/index.tsx` | Academy |
| `ValidationPage` | `features/validation/index.tsx` | Academy |
| `Luna`, `LunaSays` | `components/luna/index.tsx` | Academy |

A panel in `"lesson"` mode must work in a box 360 px wide.

### 7. Look and words

- **Theme tokens.** Colours, spacing and type sizes are CSS variables in
  `web/src/app/theme.css`. Use the tokens. Never type a colour value in a component.
  Owner: Mission Control.
- **Status colours** come from three tokens: `--status-go`, `--status-caution`,
  `--status-nogo`. Every status also shows a word or an icon.
- **Explanations.** Plain-language text for every term is in `web/src/lib/explain.ts`,
  keyed by term. Use `<Explain term="antenna_mask" />`. Never write your own explanation
  of a glossary term in a component. Owner: Academy.
- **Words.** Use the terms in [`../../CONTEXT.md`](../../CONTEXT.md) in the UI, exactly.
- **Numbers.** Every number on screen has a unit. Angles show one or two decimals. Times
  show "UTC".

## Shared files

Some files are touched by more than one track. These rules stop collisions.

| File | Owner | How others change it |
| :--- | :--- | :--- |
| `web/package.json` | Mission Control | Add a dependency in your own pull request and say so in its description. One dependency per need; check the stack in [`../architecture.md`](../architecture.md) first. |
| `web/src/app/` (router, shell, theme, `panel.ts`) | Mission Control | Ask in a pull request. Routes exist from MC0, so you should rarely need to. |
| `web/src/components/` (shared UI) | Mission Control | Add a component by pull request. Do not restyle someone else's. |
| `contracts.py` and generated types | Science | Pull request reviewed by Science and every track that reads the format. |
| `data/catalog/*.json` | Science | Pull request. Update the matching doc in the same change. |
| `docs/science.md` | Science | Pull request reviewed by Academy. |
| `DEVLOG.md` | everyone | Write only in your own track's section. |
| `AGENTS.md`, `CONTEXT.md` | team lead | Pull request. A new term goes into `CONTEXT.md` before it goes into code. |

## Git

- Work on a branch per work package: `<track>/<id>-<short-name>`, such as
  `science/s6-skyline` or `map/t7-polar-map`. The track prefixes are `science`, `mc`,
  `map` and `academy`.
- Open a pull request into `main`. Keep it to one work package.
- A pull request needs one review from an agent on a different provider than its author,
  and the orchestrator's own check. A change to a seam is also checked against every track
  that uses the seam.
- `main` must always run on fixtures: `pnpm --dir web dev` with `VITE_DATA=fixtures`,
  `pnpm --dir web test`, `pnpm --dir web typecheck` and `uv run pytest` all pass.
- Pull `main` into your branch before you open a pull request, and again before merging.
- Never force-push `main`.

## Integration checkpoints

At the end of each milestone the orchestrator runs this on `main`, then stops and shows
the team lead. The checkpoint format, and the design variants shown at each one, are in
[`../orchestration/orchestrator-prompt.md`](../orchestration/orchestrator-prompt.md).

| After | Check |
| :--- | :--- |
| M0 | The app opens on fixtures. Every route shows its placeholder or its first version. Types generate. All tests pass. |
| M1 | Connecting Ridge with real data: the Lander's eye view, the timeline, the countdowns and the status agree with each other. Gate G2 has passed. |
| M2 | A full pass through the Mission Control workflow on catalog data, by someone who did not build it. Lessons 1–4 play through. |
| M3 | A custom site from the map appears in the Slip Planner. All eight lessons play in 10–15 minutes. The validation page shows real numbers. The Docker build runs. |
| M4 | The demo story in [`../build-plan.md`](../build-plan.md), start to finish, twice, with a stopwatch. |

Each checkpoint ends with a short list of defects, each given to one track.

**No user-facing screen is built in its final form until the team lead has seen variants
and picked one.** Until then, a panel is built with its data and logic behind a plain
placeholder.

## Working with a coding agent

These rules are the same for every track and every tool.

1. **One work package per session.** Start a fresh session for each one. Long sessions
   drift.
2. **Start with the brief in your guide.** It tells the agent what to read. The agent
   already loads `AGENTS.md`.
3. **Make it read the spec before it writes.** Ask it to list the spec's "done when"
   checks back to you first.
4. **Tests first for anything with a right answer.** Geometry, scoring, decoding and
   coordinate helpers get their tests written before the code.
5. **Keep it inside your folders.** If it wants to edit a seam or another track's folder,
   stop it. Open a pull request for the owner.
6. **Do not let it invent.** No new glossary terms, no new dependencies, no new colours,
   no numbers without a source. If the spec is silent, decide with the owner and update
   the spec.
7. **Run it yourself.** An agent saying "done" is not a check. Run the tests and click
   through the feature.
8. **Review the diff before you push.** Look for edits outside your folders, weakened
   tests, changed tolerances, and anything hard-coded that should come from data.
9. **Log it.** Add your `DEVLOG.md` entry and your AI-use line when the package is
   verified.

If two specs disagree, or a spec is wrong, fix the spec in a pull request first. Agents
build what the docs say.
