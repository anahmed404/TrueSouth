# 3D and Map track guide

You build the scene that is Mission Control's home, and the camera views inside it: the
System view, the polar map and the local terrain (with the camera for Lander's eye). Custom
sites also start from the map, but they are out of scope for the deadline.
Read [`README.md`](README.md) in this folder first.

**Your scene is the base of Mission Control.** It fills the window and the interface floats
above it. Read
[`../decisions/0013-space-first-mission-control.md`](../decisions/0013-space-first-mission-control.md)
and [`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md)
before T1. The prototype in `design/variants/space-first/` is a reference, not code to copy:
it is throwaway JavaScript with mock data.

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
   `skyline.bin`, `system.bin`, `maps/`, the proposed scene image files, and the three API
   messages
5. Your three feature specs, and [`../features/mission-control.md`](../features/mission-control.md)
   for the interface around your scene
6. [`../../DESIGN.md`](../../DESIGN.md), "The scene"
7. Decisions [`0003`](../decisions/0003-site-centred-local-frame.md),
   [`0008`](../decisions/0008-terrain-tiers.md) and
   [`0013`](../decisions/0013-space-first-mission-control.md)

## Your order of work

Details and checks for each id are in [`../build-plan.md`](../build-plan.md).

You can start as soon as Mission Control's scaffold (MC0) is on `main`. Until then, read
the specs and sketch the scenes.

**M0.**

- [ ] **T0** React Three Fiber setup, and the coordinate helpers in `lib/geo/` with their
      tests. Do this before any scene. Every later bug in this track is a coordinate bug.

**M1. The scene comes first.**

- [ ] **T1** The scene: Moon (4K colour map, relief, the polar cap), real-Sun lighting,
      Earth with its texture, the Sun drawn in code, pins, camera presets and moves, the
      free-space inset, pausing at rest, the still-picture fallback. Plain grey until S16
      delivers the images.
- [ ] **T2** The scene: sight-lines from the series, labels, the Sun edge marker, true
      scale, playback

**M2.**

- [ ] **T7** The Polar map as a camera destination: the flight and the swap, relief, pins,
      labels, overlays, the instant nudge readout
- [ ] **T3** Local terrain: the descent, the patch inside the surrounding terrain to a
      curved horizon, lighting, shadows, lander marker, camera limits
- [ ] **T4** Local terrain: sight-lines, blocker marker, the series' plate (no skyline wall)

**M3.**

- [ ] **T5** Local terrain: overlays, close-up mesh, exaggeration, the Lander's eye camera
      and 3D horizon
- [ ] **T6** The start screen's Moon, 3D embeds for lessons, performance pass (measure on
      built-in graphics and tune the still-picture threshold)

**Out of scope for the deadline:** T8, custom sites and "compute for my dates".

The flat map in T7 has no 3D in it. If the terrain work stalls, the flat map can be built
and entered by cross-fade (the reduced-motion path) before T1 lands. The flight to the pole
needs T1.

## What others need from you

| What | Who needs it | When |
| :--- | :--- | :--- |
| `lib/geo/` helpers with tests | Mission Control (map links), Academy | T0, end of M0 |
| The scene, with the free-space inset and camera moves the interface drives | Mission Control (MC4c) | T1 |
| `SystemView` in `"lesson"` mode | Academy (lesson 1) | T1 |
| `PolarMap` in `"lesson"` mode, with pin placing | Academy (lessons 5 and 8, the `drop-pin` step; lessons 5 to 8 are out of scope for the deadline) | T7 |
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
| The scene's image files: Moon, Earth, the polar cap and the per-site surrounding terrain | Science (S16) | A plain grey sphere and a flat dark ground |
| A floating-interface frame that reports the free space | Mission Control (MC4c) | A fixed inset in a throwaway harness |

## Rules for this track

- **The scene never decides a result.** Whether an hour is lit or linked comes from the
  evaluation hooks. Sight-line colours, pin colours and the series plate all read those
  hooks. Shadows are decoration.
- **All coordinate math lives in `lib/geo/`, with tests.** Components call the helpers.
  No sines and cosines inside a component.
- **Azimuth is from the site's own north.** There is no grid azimuth anywhere. See
  decision 0003.
- **Units.** Local terrain scenes are in kilometres. The System view uses the Moon's
  radius as 1. The scene is one scene in Moon radii with a logarithmic depth buffer; the
  ground around a site lives in it.
- **The camera does the switching.** Moves take 1.3 to 1.5 s with an ease-in-out cubic
  curve, never pass through the Moon, and are interrupted by any new pick or gesture. With
  reduced motion they become a 120 ms dip, and the move to the pole becomes a cross-fade.
- **Keep the Moon out from under the panels.** The camera's principal point sits at the
  centre of the free space, through the projection matrix, not by cropping.
- **Spend nothing at rest.** Render no frames when nothing moves, and stop when the tab is
  hidden.
- **Text in the scene sits on a plate** ([`../../DESIGN.md`](../../DESIGN.md)).
- **Every image is NASA data or made from it.** No AI-generated imagery, and no retouching.
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
| System view | 60 frames a second on built-in laptop graphics; no frames at rest |
| First load of the scene | about 5.4 MB of images and terrain, and no image over 1.6 MB |
| Local terrain with shadows | 60 frames a second; shadows turn off automatically below 30 |
| Still-picture fallback | a median frame over 55 ms in the first flight, or no WebGL; the threshold is a guess to tune |
| Polar map pan and zoom | no visible lag with 20 pins and all labels |
| A custom polar site, from click to ready | under 60 s, with the queue position shown (out of scope for the deadline) |

## Things that are easy to get wrong

- **Axis mapping.** Local terrain: `x = east`, `y = up`, `z = −north`. System view: a
  Moon-fixed `(x, y, z)` becomes scene `(x, z, −y)`. Test every axis in T0.
- **Mesh row order.** Row 0 of a mesh is its northern edge; column 0 is its western edge.
- **The texture seam.** The Moon colour map's centre is longitude 0°. Check three known
  places: Tycho, Mare Crisium and Shackleton.
- **The seam between the globe and the ground.** The ground dissolves in between 52 and
  28 km altitude and the globe discards its pixels under the apron. Do it only during
  flights, or the dissolve shows as dots.
- **The seam between the globe and the flat map.** The swap is invisible only if the pose is
  right: check a pin's screen position before and after.
- **Radial streaks at the pole.** Switch the global height map off inside the polar cap.
- **Longitude 0–360.** The map projection uses `atan2(x, y)`, not `atan2(y, x)`.
- **Holes.** Missing terrain is `NaN`. Leave a hole; do not draw a spike to zero.
- **Low Sun.** At 1–2° of elevation, shadows cross the whole mesh and shadow maps speckle.
  Tune the bias, and do not chase perfection: the series is the truth.
- **Blockers beyond the patch.** Most blockers are further than 10 km. The terrain around
  the patch is drawn out to 150 km, so most blockers are on real ground. A blocker beyond
  that needs a plate on the horizon with its distance (a proposal in
  [`../features/local-terrain.md`](../features/local-terrain.md)). There is no skyline wall
  any more.
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
