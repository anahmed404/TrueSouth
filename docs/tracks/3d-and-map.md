# 3D and Map track guide

You build the three views that show where things are: the System view, the local terrain
and the polar map. You also build custom sites, which start from the map.
Read [`README.md`](README.md) in this folder first.

## You own

`web/src/features/three/`, `web/src/features/polar-map/`, `web/src/lib/geo/`,
`web/public/textures/`, and these specs in [`../features/`](../features/):
`system-view.md`, `local-terrain.md`, `polar-map.md`.

## Read first, in this order

1. [`../../CONTEXT.md`](../../CONTEXT.md)
2. [`../architecture.md`](../architecture.md), sections "Stack", "Frontend structure" and
   "Design language"
3. [`../science.md`](../science.md) §2 (frames and the map projection), §13 (local terrain
   coordinates) and §14 (System view coordinates)
4. [`../data-contracts.md`](../data-contracts.md): `terrain.bin`, `closeup.bin`,
   `skyline.bin`, `system.bin`, `maps/`, and the three API messages
5. Your three feature specs
6. Decisions [`0003`](../decisions/0003-site-centred-local-frame.md) and
   [`0008`](../decisions/0008-terrain-tiers.md)

## Your order of work

Details and checks for each id are in [`../build-plan.md`](../build-plan.md).

You can start as soon as Mission Control's scaffold (MC0) is on `main`. Until then, read
the specs and sketch the scenes.

**M0.**

- [ ] **T0** React Three Fiber setup, and the coordinate helpers in `lib/geo/` with their
      tests. Do this before any scene. Every later bug in this track is a coordinate bug.

**M1.**

- [ ] **T1** System view: Moon, sunlight, pins, Earth, camera presets

**M2.**

- [ ] **T2** System view: sight-lines, true-scale toggle, playback
- [ ] **T3** Local terrain: mesh, lighting, shadows, lander marker, camera limits
- [ ] **T4** Local terrain: skyline wall, sight-lines, blocker marker
- [ ] **T7** Polar map: relief, pins, labels, overlays, the instant nudge readout

**M3.**

- [ ] **T5** Local terrain: overlays, close-up mesh, exaggeration, lander's-eye camera
- [ ] **T8** Custom sites and "compute for my dates"
- [ ] **T6** The start screen's Moon, 3D embeds for lessons, performance pass

T7 has no 3D in it and does not depend on T1–T4. If the terrain work stalls, switch to
the map.

## What others need from you

| What | Who needs it | When |
| :--- | :--- | :--- |
| `lib/geo/` helpers with tests | Mission Control (map links), Academy | T0, end of M0 |
| `SystemView` in `"lesson"` mode | Academy (lesson 1) | T1 |
| `PolarMap` in `"lesson"` mode, with pin placing | Academy (lessons 5 and 8, the `drop-pin` step) | T7 |
| `LocalTerrain` in `"lesson"` mode with the slope overlay | Academy (lessons 3 and 5) | T4, T5 |
| The Artemis-regions and sunlight overlays on the map | Academy (lesson 8's reveal) | T7 |
| The start screen's Moon | Mission Control (start screen) | T6 |

Tell the team in chat the moment each of these lands on `main`.

## What you need from others

| What | From | Until it arrives |
| :--- | :--- | :--- |
| The scaffold, `PanelProps`, theme tokens | Mission Control (MC0) | Read and plan |
| Data hooks and evaluation hooks | Mission Control (MC1, MC2) | Load a fixture file directly in a throwaway harness; delete it after |
| Fixture meshes, skyline, system file and map images | Science (S2) | — |
| Real map images | Science (S9) | Fixture maps |
| The API | Science (S10, S11) | Build the UI against the message formats in [`../data-contracts.md`](../data-contracts.md); show the "API offline" state |
| The Moon colour map in `web/public/textures/` | You; download it from NASA SVS 4720 | A plain grey sphere |

## Rules for this track

- **The scene never decides a result.** Whether an hour is lit or linked comes from the
  evaluation hooks. Sight-line colours, pin colours and the "Lit" badge all read those
  hooks. Shadows are decoration.
- **All coordinate math lives in `lib/geo/`, with tests.** Components call the helpers.
  No sines and cosines inside a component.
- **Azimuth is from the site's own north.** There is no grid azimuth anywhere. See
  decision 0003.
- **Units.** Local terrain scenes are in kilometres. The System view uses the Moon's
  radius as 1.
- **True to scale by default.** Local terrain starts at ×1. Any exaggeration is labelled
  on screen.
- **Release what you load.** Dispose geometries, materials and textures when a site
  changes or a view closes.
- **Panels hold no hidden state.** Camera position may be local; everything else follows
  from props and hooks.
- **Use tokens and `<Explain>`.**
- **The map is images, not a tile server.** Pan and zoom with `d3-zoom`.

## Performance targets

| What | Target |
| :--- | :--- |
| System view | 60 frames a second on built-in laptop graphics |
| Local terrain with shadows | 60 frames a second; shadows turn off automatically below 30 |
| Polar map pan and zoom | no visible lag with 20 pins and all labels |
| A custom polar site, from click to ready | under 60 s, with the queue position shown |

## Things that are easy to get wrong

- **Axis mapping.** Local terrain: `x = east`, `y = up`, `z = −north`. System view: a
  Moon-fixed `(x, y, z)` becomes scene `(x, z, −y)`. Test every axis in T0.
- **Mesh row order.** Row 0 of a mesh is its northern edge; column 0 is its western edge.
- **The texture seam.** The Moon colour map's centre is longitude 0°. Check three known
  places: Tycho, Mare Crisium and Shackleton.
- **Longitude 0–360.** The map projection uses `atan2(x, y)`, not `atan2(y, x)`.
- **Holes.** Missing terrain is `NaN`. Leave a hole; do not draw a spike to zero.
- **Low Sun.** At 1–2° of elevation, shadows cross the whole mesh and shadow maps speckle.
  Tune the bias, and do not chase perfection: the series is the truth.
- **Blockers beyond the mesh.** Most blockers are further than 10 km. They go on the
  skyline wall.
- **Compressed distances in the System view.** Directions stay exact when distances are
  compressed. Say "not to scale" on screen.

## Brief for your agent

Paste this at the start of a session, with the work package filled in.

```text
You are working on the 3D and Map track of TrueSouth. Work package: <id and name>.

Read, in this order: CONTEXT.md, docs/tracks/README.md, docs/tracks/3d-and-map.md, and the
spec named for this work package in docs/build-plan.md. For coordinates, read
docs/science.md sections 2, 13 and 14.

Before writing code, tell me:
1. The "done when" checks for this work package.
2. The files you will create or change. They must all be in the folders this track owns.
3. The coordinate conversions involved, which lib/geo helper does each one, and the tests
   that prove each helper.

Rules: TypeScript strict, React Three Fiber and drei for 3D, d3-zoom for the map. All
coordinate math goes in web/src/lib/geo/ with vitest tests written first. The scene never
decides whether an hour is lit or linked; read the evaluation hooks. Panels take
PanelProps and hold no hidden state. Dispose GPU resources on unmount. Use the theme
tokens. Do not add a dependency without telling me first. If the spec is silent or looks
wrong, stop and ask me.

When you finish, run `pnpm --dir web test` and `pnpm --dir web typecheck` and show me the
output. Then tell me exactly what to look at on screen to check the feature by hand.
```

## Before you open a pull request

- [ ] `pnpm --dir web test` and `pnpm --dir web typecheck` pass.
- [ ] You checked the spec's "done when" list on fixtures, by eye.
- [ ] The view works in `"lesson"` mode in a box 360 px wide.
- [ ] The view has a sensible display for a sphere-tier site.
- [ ] Switching sites ten times does not grow memory.
- [ ] The diff touches only your folders.
