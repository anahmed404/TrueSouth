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
  come from a march over the heights already loaded for drawing. See "What is drawn".
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
> Shading, shadows and the fine ground texture are drawn for understanding only. Where the
> drawing differs, the series is right.

When the series says dark, the first line reads "The series says: dark. Sun disc fraction
0.12 above the skyline." Without the series, the plate shows the second line only. In
Lander's eye the plate is that second line only, because the horizon bar there already gives
the series' answer. The plate sits at the foot of the free space, above the view's
controls; at the top it covered Earth, which Lander's eye centres.

The drawn shadow at the lander can differ from the series, and that is expected: the
drawing marches over the 20 km patch and the 300 km terrain around it, at 80 m and 1.9 km,
while the series used the full 300 km skyline from the 80 m map at 2 m above the ground.
The browser never compares the two or judges the drawing; the plate says in every case
which one is right. Example: Connecting Ridge, 2028-03-06 18:00 UTC. The series says dark,
and the drawing shows a sunlit patch beside the lander. The plate's answer comes from
`seriesSunAnswer` (`plates.ts`): the profile's hour flag and the series' disc fraction for
the hour on the clock, tested on the shared fixture.

**The disclosure is on screen wherever the drawing is** (`decorationDisclosure`,
`visiblePlates` in `plates.ts`). Other plates and labels hide in a tight free space or while
a floating window is open; this one does not:

- With room (at least 360 × 140 px of free space and no window open): the plate above.
- Tight (at least 200 × 56 px), or beside an open window such as Compare: one line,
  "Shadows and ground texture are illustrative."
- No room even for that line: no plate, and the ground is drawn plain, with no drawn
  shadows and no texture, until the line fits again (`GroundLook.setDisclosed`).

Two things keep the picture close to the truth:

- The terrain around the patch is the real terrain from the same map, so far ridges cast
  the shadows they would.
- At ×1 exaggeration the ground is true to scale, so nearby shadows fall where they should.

With exaggeration above ×1, shadows are no longer true and the plate adds "shadows not to
scale".

## What is drawn

Everything in this section is drawing, like the polar map's hillshade
([`../science.md`](../science.md) §2.4). None of it decides lit or dark, link or no link,
or any number, and nothing reads it back. The code is `ground-material.ts`; its pure parts
are in `ground-relief.ts` and tested.

1. **Relief beyond the patch.** The terrain around the patch has a vertex every 1.9 km, too
   coarse to light. Each pixel there is lit with a surface normal from the polar cap's slope
   maps (`scene/cap_slope_core.webp`, 160 m, within ±76 km of the pole;
   `scene/cap_slope.webp`, 320 m, out to 80° S), read through the projection of
   [`../science.md`](../science.md) §2.3 at the pixel's true position and scaled by its
   factor k. Inside the patch the patch's own mesh normals (78 m grid) are used; they hand
   over to the maps across the patch's last 1.6 km, and the core hands over to the cap at
   its edge, so there is no seam. Outside the cap (a sphere-tier site), or before the maps
   load, the mesh normals are used.
2. **Shadows.** From each lit pixel, a march toward the light over the patch's heights
   (terrain.bin's `up_km`) and the terrain around it (as drawn), with the Moon's curvature
   in them (§13): 64 steps that grow from 40 m to the terrain's edge, reading coarser mip
   levels as the steps grow, so shadows do not crawl as the Sun moves. The shadow's edge is
   as soft as the Sun's disc (0.27° radius). Toward the terrain's outer edge the drawn
   shadow fades out, because the globe beyond draws none. Pip does not cast a shadow: it is
   drawn 300 times larger than life, so its shadow would be a false stripe kilometres long.
3. **Near-ground texture.** Close up, small craters, a few rocks and grain, made up in the
   shader. The craters follow real small lunar craters: many small and few large; most old
   and worn (a gentle bowl about 0.03 of its diameter deep, no rim), a few fresh (up to 0.2
   of the diameter, with a sharp rim); scattered by chance in patches, with no grid. A bowl
   is lit like everything else and, at a low Sun, partly filled by its sunward rim's shadow,
   at half strength so the texture stays quieter than the real relief. It is generic ground,
   not real topography: the largest craters are about 11 m across, far below the 80 m data;
   it is a bump on the lighting and a slight change of albedo only; it never moves the
   ground or the skyline; and each size fades out as it shrinks to a few pixels, so it
   shows only close to the camera and never at map scale.
4. **Tone.** A grey albedo from the Moon's colour map, its range narrowed; a lunar
   photometric function (Lommel–Seeliger and Lambert mixed by phase angle, with the
   brightening when looking down-Sun); and a faint fill from sunlit ground nearby and from
   earthshine (by Earth's phase, when Earth is up), so shadows are dark but not black.

Each of 1 to 3 can be set to full, reduced or off (`GroundQuality`, `ground-quality.ts`,
`world.groundLook.setQuality`). For checking, the address takes `ground=reduced` (or
`off`), or one effect, such as `ground-shadows=off`.

**While moving on a slow machine** the ground follows the scene's quality governor
(`perf.ts`; decision 0014): each frame the scene calls
`world.groundLook.setMotion(moving, stage)`. Stage 0 draws the full ground, still and
moving. While moving, stage 1 draws every second grid point with shadows reduced, stage 2
also drops the texture, and stage 3 draws every fourth point with no drawn shadows
(`MOTION_DETAIL` in `ground-material.ts`). The governor's frame at rest puts the full ground
back. The coarser meshes share the full mesh's index buffer and are picked by draw range,
and the effects switch by uniforms, so nothing recompiles or uploads. When a site's ground
is built, `world.prepareGround` compiles its shader and draws it once off-screen, so its
meshes and height textures are on the GPU before the first flight.

## Performance

- 66,049 vertices in the patch and 25,921 in the terrain around it. Target 60 frames a
  second on a laptop's built-in graphics; if it drops below 30, shadows turn off
  automatically. Measured so far on a desktop GPU: under 4 ms a frame while orbiting.
- Shadow settings are tuned for very low Sun angles, to avoid speckled artefacts.
- Measured cost of "What is drawn", per frame at 1440 × 900 (canvas 1424 × 805, pixel
  ratio 1), Connecting Ridge, 2026-11-14. RTX 2060, ANGLE D3D11: the ground with every
  effect off 0.5 ms; relief +0.1 ms; shadows +1.6 ms full, +0.3 ms reduced; texture
  within the noise (Lander's eye: +0.2 ms); all full 1.8 ms, all reduced 1.3 ms. With 4× CPU
  throttling: all full 1.75 ms, all reduced 1.06 ms. Software rendering (SwiftShader):
  1.67 s a frame with every effect off, 2.05 s reduced, 2.37 s full; the app shows its
  still picture there anyway. At rest the scene draws no frames.
- On a software GPU (SwiftShader), the whole Local terrain frame at 1440 × 900 (canvas
  1424 × 805, pixel ratio 1), one run each on a heavily loaded machine, 2026-11-14: 2,301 ms
  with the full ground; while moving, 1,727 ms at stage 1, 1,705 ms at stage 2, 1,486 ms at
  stage 3; 958 ms with no ground at all. At stage 3's moving pixel ratio of 0.5: 1,095 ms
  with the full ground, 555 ms with stage 3's ground. The first frame showing a new site's
  ground stalled about 3.0 s without `prepareGround` (3,963 ms against 937 ms for the next)
  and about 1.0 s with it (2,005 against 986); the 2.4 s it moves is paid when the site's
  data arrives, not during the flight.
- The terrain files are 0.18 MB per site and load for the focused site only.
- Geometry and textures are released when the site changes or the view closes.

## States

- **Sphere-tier site (Apollo 11, or a custom site north of 60° S):** the smooth Moon: a
  300 km square on the reference sphere, where the globe is, so it joins the globe with no
  step. A plate at the top of the free space reads "No terrain data for Apollo 11. This is
  the smooth Moon." with a button "Show it in the System view". (Seen, not changed: in
  Lander's eye at such a site the camera looks toward Earth or the Sun, often tens of
  degrees up, so little or no ground is in the picture.)
- **A custom site with terrain (80 m or 240 m tier).** The API makes the patch but no
  apron, and having none is by design, not an error: no plate says anything failed to load.
  An apron that is listed in the scene's metadata but fails to load keeps its message
  (`apronLoadState`, `plates.ts`). Without an apron the patch sat alone at the site's true
  height, often kilometres above or below the globe's reference sphere, in the 140 km hole
  the globe leaves for an apron. So the browser builds the apron from data it already has
  (`custom-apron.ts`), and invents nothing:
  - on the patch, the patch's own heights;
  - farther out, NASA's global height map that the globe already uses
    (`scene/moon_height_1440.png`: LOLA, 4 pixels a degree, so one height about every
    7.6 km north to south), read at each point's true position
    ([`../science.md`](../science.md) §2.2);
  - between them, the patch's edge carried outward and handed over to the global map within
    25 km of the edge, with no step at the edge;
  - in the catalog apron's layout (161 × 161 over 300 km), eased at its outer edge like
    every apron, and shaded, shadowed and stepped down on a slow machine the same way.

  One quiet plate line says what that means: "Around a custom site, the ground beyond the
  nearest few kilometres is drawn from a coarse height map of the whole Moon, so it shows
  only large hills and craters." (`explain.ts`, `custom_site_surroundings`). While the map is
  being read, the plate says "Loading the ground around … ". If it cannot be read (a failed
  fetch, a failed decode, or no way to read image pixels), the patch is drawn alone and the
  plate says so plainly: "The ground around … could not be loaded, so only the nearest ground
  is drawn." A failure is not kept for the session: the next visit to Local terrain or
  Lander's eye tries again. A finer apron would need the API to make one (see the DEVLOG
  entry "T3b").
- **How every apron meets the patch and the globe** (catalog and custom alike, `ground.ts`):
  - At full detail the apron leaves out every cell inside its first ring of points beyond
    the patch, and a strip of triangles joins that ring to the patch's own rim points, which
    it repeats exactly, with the patch's normals there. The two surfaces share their edge:
    sampled on the drawn triangles 10 cm either side of the rim they differ by under
    0.25 m. (While the camera moves on a slow machine the coarser levels keep the older
    join, the apron's cells crossing the patch's edge 30 m lower.)
  - From 80 % to 98 % of its half-width the apron eases to 150 m below the reference sphere
    (`APRON_EDGE_DROP_M`). The globe is drawn again beyond 140 km of the site and its own
    triangles lie up to 116.3 m inside the sphere, so where both cover the ground the globe
    is in front by tens of metres, far more than the depth buffer's step there (about
    1 m): they never fight. A sphere-tier site's smooth ground eases the same way.
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
