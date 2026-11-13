# Local terrain

A 3D close-up of the ground around the focused site, lit from the Sun's true direction.
It shows the ridges and crater walls that shape the skyline. It is a camera view of
Mission Control: the camera descends from the pole to the site, and the ground fills the
window.

Owner: 3D and Map track. Folder: `web/src/features/three/local-terrain/`.
Data: `terrain.bin` (the 20 km patch), the terrain around the site (the scene's image
files; see [`system-view.md`](system-view.md)), `closeup.bin`, `skyline.bin`, the series.
Math: [`../science.md`](../science.md) §13.
Layout and the view bar: [`mission-control.md`](mission-control.md). Prototype:
[`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

## How it is entered and left

- **Entering.** Picking "Local terrain" on the view bar flies the camera on from wherever
  it is, down to the focused site. It ends 19 km from the site, 22° up, turned so that both
  sight-lines run away from the viewer. The flight takes 1.5 s. From the Polar map it
  continues the same move. Between 52 and 28 km altitude the ground dissolves in and the
  globe stops drawing the pixels under it. This happens only during flights.
- **Leaving.** Picking another view moves the camera there. The "Lander's eye" button drops
  it to 2 m above the site.
- **Reduced motion.** With "reduce motion" on, every move is a 120 ms dip through Night and
  a cut.
- **A sphere-tier site** (such as Apollo 11) cannot be flown to. See "States".
- Proposed: changing the focused site while this view is open flies the camera to the new
  site. Reason: the view always shows the focused site.
- The view's address in the shareable link is `view=terrain`.

## What is behind and what floats above

- **Behind the interface:** the Moon's real ground around the site, out to a curved
  horizon, with the Moon's curvature included. It is the same scene as the System view, so
  the globe is still there beyond the ground.
- **Floating above it:** the app bar, the view bar, the sites rail, the focused-site panel
  and the timeline. The view's controls float at the foot of
  the free space. Labels in the scene sit on plates.

## What it shows

- **The 20 km patch:** a square centred on the site, 257 × 257 points at 80 m, with the
  Moon's curvature included ([`../science.md`](../science.md) §13).
- **The terrain around it,** from the same 80 m map: a 300 km square (150 km on each side of
  the site) on a coarser grid of 161 × 161 points, so the patch reads as part of the Moon
  and not as a plate floating in space. It runs out to the horizon, which curves away.
  The earlier look, a mesh with a dark wall around it (a "disc"), is rejected.
- **The patch outline:** the 20 km square is outlined in Ridge Line grey. It is not an
  accent colour.
- **The lander marker** at the centre, with the plate "The lander, 2 m above the ground"
  when the camera is close.
- **Sunlight** from the Sun's direction at the scrubber's time, with shadows. The shadows
  come from a horizon march over the real heights.
- **Sight-lines** from the lander toward the Sun and toward Earth, solid GO Green or dashed
  NO-GO Red by the series, with the same plates as the System view.
- **The blocker marker:** when the Sun is blocked, a ring on the terrain point that blocks
  it, with a plate such as "Blocker, 12.4 km away, 1.30° up". It is the same point the
  Lander's eye view reports. Proposed: a blocker beyond 150 km, which the terrain around
  the site does not draw, is shown as a plate on the horizon in its direction with its
  distance. Reason: the skyline reaches 300 km, and a blocker must never be silently
  missing.
- **A north arrow and a scale bar.** Kept from the earlier spec. The prototype does not
  draw them yet.
- **The series' answer** on a plate (see "Shadows are decoration").

## Overlays

Colour, one at a time:

| Colour | What it shows |
| :--- | :--- |
| Regolith | Grey regolith shading |
| Slope | Green below the profile's ideal slope, amber up to its limit, red above |
| Height | A colour ramp by elevation |

A legend shows the colour's scale and the slope baseline. The slope on the mesh uses a
156.25 m baseline, not the site's own slope baseline
([`../science.md`](../science.md) §13), and the legend says so. The prototype's 5° and 10°
thresholds are mock values; the real thresholds come from the profile.

## Controls

- **Orbit and zoom:** drag to orbit, scroll to zoom. The camera cannot go below the ground.
- **Vertical exaggeration:** ×1 (default), ×2, ×5. The label always shows the factor: "true
  to scale" at ×1, "shadows not to scale" above it.
- **Close-up:** for sites with a close-up DEM, a toggle swaps to the 2 km mesh built from
  5 m data. Close-up data is not available yet, and the prototype has no toggle.
- **Lander's eye:** a button drops the camera to 2 m above the site, looking at the Sun
  ([`panorama.md`](panorama.md)).

## Shadows are decoration

Shadows and shading on the ground are drawn for understanding only. **Whether an hour is
lit comes from the series. When the two disagree, the series is right.** A plate always
shows the series' answer:

> The series says: lit. 62 % of the Sun's disc is above the skyline.
> Shading and shadows here are drawn for understanding only. The series decides lit or dark.

When the series says dark, the first line reads "The series says: dark. Sun disc fraction
0.12 above the skyline."

Two things keep the picture close to the truth:

- The terrain around the patch is the real terrain from the same map, so far ridges cast
  the shadows they would.
- At ×1 exaggeration the ground is true to scale, so nearby shadows fall where they should.

With exaggeration above ×1, shadows are no longer true and the plate adds "shadows not to
scale".

## Performance

- 66,049 vertices in the patch and 25,921 in the terrain around it. Target 60 frames a
  second on a laptop's built-in graphics; if it drops below 30, shadows turn off
  automatically. Measured so far on a desktop GPU: under 4 ms a frame while orbiting.
- Shadow settings are tuned for very low Sun angles, to avoid speckled artefacts.
- The terrain files are 0.18 MB per site and load for the focused site only.
- Geometry and textures are released when the site changes or the view closes.

## States

- **Sphere-tier site (Apollo 11):** no ground. A plate at the top of the free space reads "No terrain data for
  Apollo 11. It is far from the pole, so TrueSouth treats the ground there as a smooth
  sphere." A button offers "Show Apollo 11 in the System view", and the camera follows the
  site on the globe instead of descending.
- **Missing terrain in part of the mesh:** holes are left open, not filled.
- **Terrain still loading.** Proposed: the camera flies, and the ground appears when it is
  ready; the globe stays in place until then. Reason: a flight should never wait on a file.
- **No WebGL or the still picture.** Proposed: the view has no ground to draw. It shows the
  sentence and the series' answer, and offers the System view. Reason: there is nothing
  honest to draw without 3D.

## Done when

- A synthetic fixture crater appears with the correct depth and width.
- North, east and up are correct: a test mesh with a single peak north-east of centre
  shows it north-east.
- At a fixture hour, the Sun's sight-line points along the series' azimuth and elevation.
- The terrain around the patch matches the 80 m map at hand-checked points, and its edge
  meets the patch with no gap or step.
- The horizon curves away, and no skyline wall is drawn.
- The blocker marker lands on the same point the Lander's eye view reports.
- The series' plate shows the same answer as the timeline at every hour of a fixture
  window.
- Switching sites ten times does not grow memory.
