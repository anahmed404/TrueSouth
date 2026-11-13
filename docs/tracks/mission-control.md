# Mission Control track guide

You build the planner tool's screens and logic, and you keep the web app in one piece.
Read [`README.md`](README.md) in this folder first.

**Mission Control is space-first.** A 3D scene of the Sun, Earth and Moon (the 3D and Map
track's) fills the window, and your panels float above it. The view bar picks the view:
five are camera moves (the Slip Planner is one), and Compare is a floating window. Read
[`../decisions/0013-space-first-mission-control.md`](../decisions/0013-space-first-mission-control.md)
and [`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

**You are the integrator.** The app shell, the router, the theme, the data hooks and the
scoring are yours. Two other people build inside what you set up.

## You own

`web/package.json`, `web/vite.config.ts`, `web/src/app/`, `web/src/data/`,
`web/src/state/`, `web/src/lib/scoring/`, `web/src/lib/time/`, `web/src/components/`
(except `luna/`), `web/src/features/mission-control/`, `web/src/features/panorama/`, and
these specs in [`../features/`](../features/): `mission-control.md`, `slip-planner.md`,
`site-detail.md`, `panorama.md`, `compare.md`, `share-export.md`.

## Read first, in this order

1. [`../../CONTEXT.md`](../../CONTEXT.md)
2. [`../architecture.md`](../architecture.md), sections "Stack", "Repo layout", "Running
   it", "Frontend structure" and "Design language"
3. [`../data-contracts.md`](../data-contracts.md)
4. [`../science.md`](../science.md) §7 and §9–11
5. [`../mission-profiles.md`](../mission-profiles.md)
6. [`../features/mission-control.md`](../features/mission-control.md), then each of your
   other feature specs as you reach it
7. [`../features/system-view.md`](../features/system-view.md), for the scene your panels
   float over, and [`../../DESIGN.md`](../../DESIGN.md), "Layout" and "The scene"
8. Decisions [`0002`](../decisions/0002-scoring-in-browser.md),
   [`0007`](../decisions/0007-mission-profiles.md) and
   [`0013`](../decisions/0013-space-first-mission-control.md)

## Your order of work

Details and checks for each id are in [`../build-plan.md`](../build-plan.md).

**M0. Unblock everyone.**

- [ ] **MC0** The scaffold. Push the same day you start. It must include:
  - every route in [`../architecture.md`](../architecture.md);
  - a placeholder for every panel file listed in [`README.md`](README.md);
  - `web/src/app/panel.ts` with `PanelProps` and `Scenario`;
  - `web/src/app/theme.css` with the tokens;
  - `gen:types`, the `/data` middleware, the `/api` proxy, and the `test` and `typecheck`
    scripts;
  - the start screen with two equal doors.
- [ ] **MC1** Loaders, decoders and the data hooks.
- [ ] **MC2** Scoring, the evaluation hooks, and gate G10.

**M1. One real site.**

- [ ] **MC3** The `scenario` store and URL sync
- [ ] **MC4** The panels: profile picker and editor, sites rail, focused-site panel (built
      docked as MC4a and MC4b; kept)
- [ ] **MC4c** The space-first shell: float the panels, the app bar, the view bar and the
      timeline over the scene (needs T1); folding, the free-space insets, the phone layout
      and keyboard use
- [ ] **MC5** Timeline, scrubber, countdowns, "why is it dark" card, as a floating bar that
      folds to one row
- [ ] **MC6** Lander's eye: the horizon chart, its card and controls (the camera and 3D
      horizon are T5)

**M2.** MC7 (the Slip Planner view; its sweep worker is done as MC7a).

**M3.** MC9 (the Compare window, share and export, NASA tool links).

**M4.** MC11 (every state, keyboard use, performance).

The scene, the polar map and custom sites belong to the 3D and Map track. Custom sites are
out of scope for the deadline, and so are the sensitivity grid and Academy lessons 5 to 8.

## What others need from you

| What | Who needs it | When |
| :--- | :--- | :--- |
| The scaffold with placeholders, `PanelProps` and theme tokens | 3D and Map, Academy | MC0, day one |
| The data hooks, working on fixtures | 3D and Map, Academy | MC1, end of M0 |
| The evaluation hooks | 3D and Map (sight-line and pin colours), Academy (step goals) | MC2, end of M0 |
| The space-first shell: the view bar, the free-space insets the camera reads, and the floating windows' frame | 3D and Map | MC4c |
| `LandersEye` working in `"lesson"` mode | Academy (lessons 1, 2, 4) | MC6 |
| `Timeline` and `Countdowns` in `"lesson"` mode | Academy (lessons 4, 8) | MC5 |
| `SlipPlanner` in `"lesson"` mode | Academy (lessons 7, 8) | MC7 |
| Reviews of pull requests that touch `web/src/app/`, `components/` or `package.json` | everyone | within a few hours |

Tell the team in chat the moment each of these lands on `main`.

## What you need from others

| What | From | Until it arrives |
| :--- | :--- | :--- |
| The exported schema | Science (S0) | Start the scaffold; add `gen:types` when it lands |
| Fixtures and the scoring cases | Science (S2) | Write loaders against [`../data-contracts.md`](../data-contracts.md) |
| `explain.ts` with a first draft of every term | Academy (A7) | Show the term's name as the tooltip text |
| `Luna` for empty and error states | Academy (A1) | A plain text message |
| The scene (T1): `SystemView`, and the camera moves to `PolarMap`, `LocalTerrain` and Lander's eye | 3D and Map | A plain dark background and the placeholders |
| The scene's image files | Science (S16) | A plain grey Moon |

## Rules for this track

- **No science in the browser beyond `../science.md` §9–11.** Metrics, vetoes, utilities,
  score, status, countdowns and the slip sweep. Nothing about terrain or ephemeris.
- **The TypeScript scoring must match the Python reference exactly.** Gate G10 is the
  proof. If they differ, find out which one disagrees with `../science.md` and fix that
  one.
- **One clock.** Every view reads `scenario.currentUtc`. No view keeps its own time.
- **Panels hold no hidden state.** Everything a panel shows follows from its props and the
  hooks. This is what lets the Academy reuse them.
- **The URL is the scenario.** Any change to the scenario updates the URL. A bad parameter
  is ignored with a notice, never a blank page.
- **Catalog sites and custom sites are the same thing** to every component. Only the
  loader knows the difference.
- **Use tokens and `<Explain>`.** No colour values and no hand-written glossary
  explanations in components.
- **Show the measurement with the verdict.** A veto shows its measured value and its
  limit. A score never hides a veto.
- **Show provenance.** Every profile value shows its sourced or assumed tag.
- **Keep heavy work off the main thread.** The slip sweep runs in a Web Worker.
- **Panels float; they are solid.** Follow `DESIGN.md`: a 16 px margin (8 px on a phone), a
  1 px Control Edge border, no see-through fill. Text drawn straight on the scene sits on a
  plate. Use the tokens; never type a colour value.
- **The interface tells the scene where the free space is,** so the camera can keep the
  Moon clear of the panels. When a panel folds, the free space changes with it.
- **Compare is a window,** with `role="dialog"` and `aria-modal="false"`. Escape closes it
  and returns focus. The timeline stays visible. **The Slip Planner is a camera view,** and
  its bottom panel shows landing dates in place of the timeline.
- **Results never come from the scene.** A status, a lamp or a "lit" label comes from the
  evaluation hooks, not from 3D shading or shadows.
- **Respect reduced motion** in every panel and window animation.
- **Decode once.** Series are typed arrays held in the `data` store. Do not copy them into
  objects per hour.

## Performance targets

| What | Target |
| :--- | :--- |
| First filled Slip Planner on fixtures | under 2 s |
| Slip sweep, 8 sites, 100-day profile | under 200 ms |
| Scrubber drag with all views open | no visible lag |
| Profile slider to updated statuses | within one frame |

## Things that are easy to get wrong

- **Window length.** A 10-day window is 240 hourly samples starting at the landing hour.
  Not 241.
- **The end of the time grid.** A landing date whose window runs past the end has no
  result. Show "no data", not a NO-GO.
- **Byte order and offsets.** Series are `Int16` with a scale and an offset per column.
  Skylines and meshes are `Float32`.
- **Azimuth wrap in the Lander's eye view.** A track that crosses the view's edge must be
  split into two lines.
- **Weights.** They are normalised. Never show a "must add to 1" error.
- **Sphere-tier sites.** No slope, a flat skyline, no blockers. Every panel needs a
  sensible display for them. In Local terrain and Lander's eye the camera does not descend;
  the view offers "Show it in the System view".
- **Panels over a moving background.** Contrast is guaranteed by solid panels and plates,
  not by the scene's brightness. Check text over a bright Moon.
- **Focus order and Escape.** The scene is not the first Tab stop; Escape closes the open
  window and focus returns to its button.

## Brief for your agent

Paste this at the start of a session, with the work package filled in.

```text
You are working on the Mission Control track of TrueSouth. Work package: <id and name>.

Read, in this order: CONTEXT.md, docs/tracks/README.md, docs/tracks/mission-control.md,
and the spec named for this work package in docs/build-plan.md. For scoring, read
docs/science.md sections 9 to 11.

Before writing code, tell me:
1. The "done when" checks for this work package.
2. The files you will create or change. They must all be in the folders this track owns.
3. Which hooks, stores and types you will use, and any you need that do not exist.

Rules: TypeScript strict. Use the theme tokens and the <Explain> component. Panels take
PanelProps and hold no hidden state. Do not fetch or decode data outside web/src/data/.
Do not add a dependency without telling me first. Do not add Playwright. Do not put
terrain or ephemeris math in the browser. If the spec is silent or looks wrong, stop and
ask me.

For scoring and decoding code, write the vitest tests first, against the shared fixture.
When you finish, run `pnpm --dir web test` and `pnpm --dir web typecheck` and show me the
output. Then tell me exactly what to click to check the feature by hand.
```

## Before you open a pull request

- [ ] `pnpm --dir web test` and `pnpm --dir web typecheck` pass.
- [ ] You clicked through the spec's "done when" list on fixtures.
- [ ] The feature works for a sphere-tier fixture site.
- [ ] The panel is readable over a bright Moon and over empty space, and works folded and
      on a phone at 390 px.
- [ ] No colour values, no hand-written explanations, no fetches outside `web/src/data/`.
- [ ] The diff touches only your folders.
