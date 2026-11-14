# System view

A 3D scene of the Sun, Earth and Moon at the scrubber's time. It is the home of Mission
Control: it fills the window and is always behind the interface. It shows the whole
geometry of a mission at once: where the site is, where daylight is, and where Earth is.

The other camera views (the Polar map, the Slip Planner, Local terrain and Lander's eye) are not separate
screens. They are camera moves in this same scene. Why:
[`../decisions/0013`](../decisions/0013-space-first-mission-control.md). How the interface
sits on top of it: [`mission-control.md`](mission-control.md).

Owner: 3D and Map track. Folder: `web/src/features/three/system-view/`. The scene itself
(the renderer, the camera and the ground shared with Local terrain) is in
`web/src/features/three/`.
Data: `system.bin`, `sites.json`, the focused site's series, and the scene's image files
(see "Textures").
Math: [`../science.md`](../science.md) §14.
Prototype and designer's notes:
[`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

## What it shows

- **The Moon,** textured with NASA's colour map of the whole Moon and lit from the Sun's
  true direction. The day/night line moves as time passes. NASA's height map gives relief
  along that line. A face-on Moon never clips to white: its brightness rolls off softly.
- **The south polar cap,** poleward of 80°S: TrueSouth's own shaded relief and slope map,
  made from NASA's 80 m terrain map. The real Sun lights the slope map, so the cap shows
  real relief.
- **Earth,** with NASA's Blue Marble texture, placed in its true direction from the Moon.
  It turns once every 23.934 h of the clock. The turning is decoration; nothing reads from
  it.
- **A body between the camera and the Moon is not drawn,** judged by what is on screen, at
  any camera distance, in both scale modes (`bodyInFront` in `proportions.ts`): when the
  camera is inside it, or it is nearer to the camera than the Moon and its disc overlaps the
  Moon's disc (with 30 % of the Moon's angular radius to spare for the site labels), or it is
  at least 5 % nearer than the Moon, larger than the Moon on screen and in view. It fades out
  over 180 ms (at once with reduced motion), with a little hysteresis so a slow drag does not
  make it flicker, and its name and edge arrow show instead. Earth in "From Earth" is never
  drawn; in "From the Sun" it is not drawn whenever it is on the near side and in view. A
  body behind the Moon is drawn (Earth beside the Moon at the edge of "From the Sun"; the Sun
  behind the Moon in "From Earth" around new moon, at most 1.5 times the Moon).
- **The Sun,** drawn in code: a disc with a short warm edge that ends by 1.8 disc radii. It
  is a light source. An arrow marks the Sun, and Earth, at the edge of the free space when
  that body is off screen.
- **Two faint orbit lines** (the tester's wish, 2026-11-14), in the System view only: the
  Moon's orbit, a circle centred on the drawn Earth through the Moon's centre, and Earth's
  orbit, a circle centred on the drawn Sun through Earth's centre. They are drawings of the
  idea of an orbit at the schematic distances, not computed orbits: each lies in the plane
  through its two bodies that is nearest the Moon's equator (the real orbits lie within
  about 7° of it), so the plane turns smoothly as the hour moves and never flips
  (`orbits.ts`). One-pixel hairlines in the Ridge Line grey at low contrast, no glow, no
  labels; drawn behind every body, mark and label, and stopped at the Moon's and Earth's
  limbs: every step of a circle that meets either sphere is cut where it meets it, so a line
  ends on the limb (within 1e-9 radii, at any step length) and no chord passes through a
  body in 3D. They fade out with the flight into the Polar map, Slip Planner, Local terrain and
  Lander's eye. At true scale the Moon's orbit stays (a large circle through the Moon about
  Earth); Earth's orbit is hidden, since the Sun is only a direction there. Cost: two lines
  of 256 steps in fixed buffers (room for 264 segments, for steps a body splits in two),
  rewritten only when the bodies' drawn positions change; a rewrite allocates nothing.
- **Site pins** for every selected site. The focused site's pin has a Moonlight ring and a
  name plate.
- **Two sight-lines** from the focused site: one toward the Sun, one toward Earth.
  - Solid GO Green when the profile counts the hour as lit, or as linked.
  - Dashed NO-GO Red when it does not.
  - The line colour comes from the series, never from the 3D scene.
  - Each line has a plate with a lamp, a word and the state: "To the Sun: dark", "To Earth:
    link". The plate says the state only; the countdown numbers live in the timeline.
- **Labels** for Earth and the Sun. A plate keeps each label readable and keeps it inside
  the free space, moving down to avoid other labels.
- **The Moon's axis** and a faint equator, so the pole is easy to find.
- **Stars,** at the team lead's request (2026-11-13): the real sky, the Yale Bright Star
  Catalogue to magnitude 6.5 (about 8,400 stars), each drawn as a point sized and dimmed by
  its magnitude and faintly tinted by its colour index. Mostly faint, a few bright; no glow,
  no twinkling, no painted Milky Way. They sit behind everything and never over the Moon,
  Earth or the Sun. They fade near the Sun, dim as the lit Moon fills the view (a camera
  exposed for it would see fewer), and are dimmer in Local terrain and Lander's eye.
  - **Orientation:** the Moon's pole points where it truly points in the sky (the IAU
    model), so the Moon's equator lies among the ecliptic's stars; but the sky is turned
    about that pole as on 2000-01-01, not for the scrubber's time. Turning it for a date
    is ephemeris work, which the frontend does not do. Nothing on screen says the stars are
    placed for the date.
  - Stars are decoration. They never decide or imply a result.
  - How `web/public/stars.bin` is made, and its source and licence:
    `web/dev/build-stars.mjs`.

All of it is a photograph of space under a flat interface. The scene's shading and shadows
are decoration.

## Saying the sizes and distances are not to scale

No line on the scene says it (the team lead removed the "Distances not to scale" plate,
2026-11-14). The view's About text says, in one sentence, that sizes and distances are
not to scale, that every direction is true, and that "True scale" shows the real
proportions (`system_view` in `web/src/lib/explain.ts`). The "True scale"
button's description says what it switches.

## Scale

Real distances cannot fit on a screen: Earth is about 110 Moon-diameters away and the Sun
about 390 times further. Earth is 3.67 times the Moon across and the Sun 109 times Earth.

- **Default: a schematic, with the Moon leading and Earth beside it** (the team, 2026-11-14:
  open on the Moon in focus with Earth visible in the background, a little smaller than the
  Moon and a little further out, so the Moon leads; the Sun much further, as an orbit would
  have it; realism is not required). Every direction is true: Earth and the Sun sit along the
  directions in `system.bin`. Only drawn sizes and distances are compressed:
  - drawn radius: Moon 1, Earth 0.83, Sun 3.5 Moon radii (true 1, 3.67, 400), on straight
    lines on log-log axes through the three. Earth is drawn smaller than the Moon by the
    team's choice, so the Moon leads; Earth is still smaller than the Sun, and "True scale"
    shows the real sizes.
  - drawn distance: Earth by 0.4125 × (true distance ÷ Moon radius)^0.385, about 3.3 Moon
    radii (3.20 at perigee to 3.37 at apogee, following the series); the Sun by 0.372 × the
    same power, about 29.5 (29.3 to 29.8), unchanged; a straight log-log line joins the two
    laws between 1 and 100 million km, so a further body is always drawn further. The Sun
    is drawn 8.7 to 9.3 times further than Earth. (Before: both at 2.5, Earth 0.4 and the
    Sun 0.12.)
  - The orbit picture holds: the circle the Moon would trace around the drawn Earth (radius
    the drawn Earth-to-Moon distance) never comes near the drawn Sun, whose nearest surface
    is at least 3.3 times that circle's diameter from Earth at every hour.
  - The Sun's radius is held at 3.5 so that, seen behind the Moon from "From Earth", it is
    never more than 1.5 times the Moon.
  - The constants live in one place, `web/src/features/three/scene/proportions.ts`, with
    the true values beside them.
  - No two bodies ever touch. A sight-line from any site on the Moon, drawn along its true
    direction, points into the drawn Sun's disc, and passes within one Moon radius of the
    drawn Earth's centre (just beside its smaller disc for sites far from the line to Earth).
  - Earth is lit from the series' Moon-to-Sun direction, not from the drawn Earth toward the
    drawn Sun (up to about 6.6° apart in the schematic). From Earth and from the Moon the
    Sun's direction agrees to within about 0.15°, so Earth shows its true phase.
- **True scale toggle.** Earth moves to its real distance at its real size, and the camera
  flies back until the Moon and Earth both fit, the Moon in the middle. Earth glides between
  the two arrangements in step with that flight (on a log scale, so it never jumps); the Sun
  is carried out and then becomes a direction arrow at the edge of the free space, labelled
  with its distance. The glide runs on its own clock: a drag that stops the flight lets
  Earth finish gliding instead of snapping. While the glide is under way, Earth fades out
  (180 ms) whenever any part of its disc is outside the free space, so it never shows over
  the timeline or a panel's edge, and fades back in when it is whole inside again.

## Textures

Every image is NASA data, or made by TrueSouth's pipeline from NASA data. Nothing is
retouched, painted or generated by AI: images are only resized, cropped, split or
re-encoded. Sizes are from the prototype; they are budgets for the real files.

| Image | Source | Size | Notes |
| :--- | :--- | ---: | :--- |
| Moon colour, 4K (4,096 × 2,048) | NASA SVS 4720, LRO LROC colour map | 1.0 MB | The default. |
| Moon colour, 2K (2,048 × 1,024) | Same | 0.24 MB | Proposed: drawn first for the first paint, then replaced by the 4K image. Reason: it costs 0.24 MB and avoids a plain grey Moon on a slow link. |
| Moon colour, 8K (8,192 × 4,096) | Same | 3.0 MB | Optional. Split into two 4,096-pixel halves (west and east), so no file passes 3 MB. Loaded only after a deep zoom away from the pole. |
| Moon heights (1,440 × 720) | NASA SVS 4720, LOLA heights | 0.49 MB | Relief along the day/night line only. Switched off inside the polar cap. |
| Cap shaded relief, 4K, and a sharper core | TrueSouth pipeline, from NASA's 80 m LOLA map ([`../science.md`](../science.md) §2.4) | 1.28 + 0.25 MB | The centre core is ±76 km around the pole. |
| Cap slope map, and a core | TrueSouth pipeline, from the same map | 0.72 + 0.74 MB | Lets the real Sun light real relief inside 80°S. |
| Earth, Blue Marble (2,048 × 1,024) | NASA Earth Observatory, Blue Marble Next Generation, March | 0.33 MB | |
| Terrain around each polar site | TrueSouth pipeline, from the same map | 0.18 MB per site | Loaded for the focused site only. See [`local-terrain.md`](local-terrain.md). |
| Still picture | A render of the textures above | 0.01 MB | See "When 3D does not run". |

- **First load:** about 5.4 MB of images and terrain, plus 0.4 MB of code and fonts. The
  Polar map's overlays (1.1 MB) load after the first paint. They are specified in
  [`polar-map.md`](polar-map.md).
- **8K is not the default.** It triples the Moon's weight, and at home zoom it looks the
  same as 4K. The zoom that matters ends at the pole, and the cap images make that sharp.
- **Credit.** NASA's Scientific Visualization Studio; the LRO LROC and LOLA teams; NASA
  Earth Observatory, Reto Stöckli.
- The pipeline step that makes these files, and the contract for them, are in
  [`../build-plan.md`](../build-plan.md) (work package S16) and
  [`../data-contracts.md`](../data-contracts.md) ("Proposed: scene image files").

### Orientation

- The Moon and Earth maps are equirectangular, with longitude 0° at the centre of the
  image. Check three known places on the Moon: Tycho, Mare Crisium and Shackleton.
- Each cap image is a square centred on the south pole, covering ±304 km, with +x right,
  +y up and south polar stereographic projection ([`../science.md`](../science.md) §2.3).

## The polar cap overlay

- The cap images sit on the globe poleward of 80°S. The global height map is switched off
  inside the cap, because it makes radial streaks at the pole.
- Near the pole, the sharper core is drawn over the 4K cap, so the zoom ends on sharp
  craters.
- During the flight to the Polar map, in the last 45% of the move, the cap's lighting
  blends from the real Sun to the map's fixed top-left lighting. At the end, the flat map
  replaces the globe. From that pose the globe and the stereographic map differ by less
  than 0.3% near the sites and about 1% at 80°S, so the swap is not visible. See
  [`polar-map.md`](polar-map.md).

## Lighting

- The Sun's direction is the sub-solar point from `system.bin` at the scrubber's time
  ([`../science.md`](../science.md) §14). The day/night line moves as time passes.
- At the pole the real Sun circles the horizon without rising. The cap's lit and dark
  sides are the Sun's true direction, not a lamp placed for looks.
- Earth is lit from the same direction.
- **Lit or dark is a result only when it comes from the series.** A pin on the dark side
  of the day/night line is a picture; whether the hour counts as lit is the evaluation
  hooks' answer.

## Pins and sight-lines

- A pin is the approved status lamp with a 2 px Night ring. It is drawn on the globe at
  the site's latitude and east longitude, and its colour comes from the evaluation hooks
  for the landing date.
- Pins closer than 18 px fold into the focused pin, whose plate then says "and N more
  sites here".
- Pins are not in the tab order. The sites rail is the keyboard path to every site.
- A sight-line starts at the site and runs along the true direction to the Sun or Earth
  (from the series' azimuth and elevation, or from the sub-points in `system.bin`). In the
  System view it is a short direction mark, about 1.15 Moon radii long with its label at
  the end: it shows the direction and does not run all the way to the drawn body.
- When the focused site changes, the pins and sight-lines update at once.
- **Labels toggle** (the team lead's wish, 2026-11-14), beside True scale and Sharper Moon;
  on by default, kept for the session only and not in the link. Off, the name tags on the
  scene hide in the System view, Slip Planner and Local terrain: the focused site's name tag
  (with "and N more sites here"), the "To the Sun" and "To Earth" notes, Earth's and the Sun's
  names, "Lander not to scale", and the Slip Planner's site tags with their leaders. The pins,
  the sight-lines, the orbit lines, the edge pointers to an off-screen body, the plates
  (including Local terrain's notes) and the panels stay; a pin keeps its name for screen
  readers and its hover title. Lander's eye keeps its labels.

## Camera

- **Home (the first load, and the way back to the System view from another view):** the
  Moon in the middle of the free space, where it has always been, with Earth whole beside it
  and the Sun far outside (`OPENING` in `camera.ts`).
  - The camera looks at the Moon from under the south pole, turned so the Moon's 0°
    meridian, where Earth always lies to within libration, points along the free space's
    longer side: Earth sits left of the Moon on a laptop (the sight-line labels sit to the
    right of their marks, so they never reach it), above it on a phone. It leans 15° away
    from Earth's side, so Earth is always a little further away than the Moon, reads as
    behind it, and shows about 0.8 times the Moon's size.
  - It does not depend on the hour, so scrubbing time never moves it. At every hour Earth is
    whole inside the free space, clear of the Moon, the marks and the panels, with room for
    its label; the Sun is outside, marked at the edge.
  - Moon radius, from the test layouts: 94.4 px at 1440 × 900 with the panels open, 44.7 px
    at 1024 × 768 with the panels open (the Moon's size limits how far out Earth can sit:
    at 1024 × 768 Earth needs about 4.1 Moon radii of the 188 px half-width).
  - When the Moon is under 60 px on screen (as at 1024 × 768), the site's name plate starts
    past the Moon's limb and the mark labels step around its disc, so the labels do not
    cover it.
  - A click on "South pole" (including the click that leaves "Follow site") frames the polar
    cap close in.
  - The System view zooms out to 420 Moon radii (900 at true scale), just far enough to see
    all three bodies.
- **One rule for every drag: the picture follows the pointer** ("grab the globe"). Whatever
  is under the pointer moves the way the pointer moves, on both axes, in every view: drag
  right and it moves right, drag up and it moves up. In a view that orbits a point (the Slip
  Planner, Local terrain) the part that follows is the ground nearest the viewer; in
  Lander's eye (a look-around) it is the scene ahead, so dragging up moves the horizon up
  and the view looks down. `drag-directions.test.ts` checks every view and input.

  | Input | What the picture does |
  | :--- | :--- |
  | Left-button drag, one-finger drag | Follows the pointer (turns the view; in the Polar map, slides the map) |
  | Middle-button drag | The same as the left button |
  | Right-button drag, Shift + drag, two-finger drag | System view: slides, following the pointer. Views with no slide (Slip Planner, Local terrain, Lander's eye) turn as a left drag does; a two-finger drag there does nothing |
  | Wheel, pinch | Zooms; no direction |
  | Arrow keys | Move the camera the arrow's way, so the picture moves the other way, as on a map (a 24 px drag the other way); Shift and an arrow slides in the System view |
- **Turn, freely:** drag with one finger or the left button. The Moon turns in any
  direction, over either pole and all the way round, as often as you like (the team lead's
  request, 2026-11-14). A horizontal drag turns the camera about its own up axis, a vertical
  drag about its own right axis (a trackball), so the surface moves the way the pointer
  moves whatever the orientation. There is no world "up": after going over a pole the Moon
  may be upside down. A preset, or a double-click on empty space, flies back to a level
  view.
  - Far out, the camera turns about the Moon's centre. Close in, it turns about the point of
    interest: the south pole after "South pole", the site after "Follow site", a
    double-clicked spot, otherwise the point at the centre of the free space. A preset's
    point fades out (it does not switch off) as it leaves the centre of the view or nears
    its horizon.
  - Between 0.5 and 2 Moon radii from that point, the pivot slides along the line from the
    Moon's centre to the point, so nothing jumps.
  - A turn never goes below 60 km from the surface: the camera slides along that height.
  - Each view's drag is its own setting (`ORBIT_STYLE` in `rig.ts`): Local terrain keeps
    its turntable above the ground, Lander's eye keeps a level horizon, and the Polar map
    stays a north-up map.
- **Slide (pan):** right-drag, Shift-drag or two-finger drag. The globe turns under the
  camera about the Moon's centre, so the height above the surface does not change.
- **Zoom:** scroll or pinch, toward the pointer: the surface point under the pointer stays
  fixed on screen. Down to 60 km from the surface, out to 420 Moon radii (900 at true
  scale).
- **Double-click or double-tap** a spot on the Moon: the camera centres it and moves in to
  about half the distance, looking straight down. On empty space: back to the preset's
  framing, level.
- **Keys, when the scene has focus:** an arrow key moves the camera the arrow's way, so the
  picture moves the other way, as on a map (in Lander's eye, the left arrow looks left).
  In the System view the arrows turn freely, like a drag. Shift and an arrow slides. `+`
  and `−` zoom toward the centre.
- A short hint of these controls is in the view's "About" popover (`system_view` in
  `web/src/lib/explain.ts`), not on the scene.
- **Presets:** "South pole" (the default), "From Earth", "From the Sun", and "Follow site"
  (keeps the focused site facing the camera). The first load lands on home. A click on
  "South pole", even when it is already chosen, frames the whole cap poleward of about
  80°S, where the sites are, from straight below the pole, turned as home is.
- **Free space.** The camera's principal point moves to the centre of the space between
  the floating panels, through the projection matrix. The Moon is never covered by a
  panel and there is no crop. When panels fold, the centre slides to the new free space in
  200 ms; with everything folded, the home camera moves in so the Moon fills the room.
- **Camera moves** take 1.3 to 1.5 s with an ease-in-out cubic curve. The path keeps the
  camera's direction from the Moon's centre on a great circle and changes altitude
  logarithmically, so it never passes through the Moon. A drag, a scroll or another pick
  interrupts a move and starts from where the camera is.
- **First load:** the camera eases in from 1.5 times the distance over 1.4 s. That move also
  measures frame times for the still-picture fallback.
- **Reduced motion:** every camera move is a 120 ms dip through Night and a cut. The move to
  the pole is a cross-fade.
- Zoom is limited so the camera cannot pass through the Moon.

## One scene

- One scene in Moon radii, with a logarithmic depth buffer, holds the Moon, Earth, the Sun,
  and, once a flight descends, the ground around the focused site.
- The ground is part of the same scene as the globe. The globe discards its pixels under the
  140 km apron once the ground has dissolved in. The dissolve runs between 52 and 28 km
  altitude, below the System view's zoom limit, so it happens only during flights.
- Local terrain's local frame is in kilometres ([`../science.md`](../science.md) §13); the
  System view uses the Moon's radius as 1 (§14). The coordinate helpers in `lib/geo/` do
  every conversion between them.

## Time

The scrubber drives the scene. Playing time shows the three motions that matter:

- The day/night line sweeping round the Moon once a month.
- Earth nodding up and down and side to side: libration.
- At the pole, the Sun circling the horizon without rising.

## Performance

- **Budget.** 60 frames a second on a laptop's built-in graphics. Measured so far, on an
  NVIDIA RTX 2060 desktop GPU at 1440 × 900: the scene costs under 4 ms a frame with panels
  open or folded, at pixel ratio 1 and 2, and while orbiting Local terrain (each capped by
  the display's 240 Hz). A weak laptop is not measured yet.
- **Weak machines step down; strong ones never change.** The scene measures the frames of
  its flights (they are drawn back to back, so the time between them is a frame's cost)
  and steps its quality down in stages when they are slower than 36 ms. Stage 0, the full
  picture, is what every machine starts on and what a fast one keeps. Stages 1 to 3 draw
  fewer pixels only while the camera or the time moves (60 % of the pixel ratio, then
  half), and lower the resting pixel ratio only on the last two stages (to 1.25, then
  0.85). See [`../decisions/0014-the-scene-steps-quality-down.md`](../decisions/0014-the-scene-steps-quality-down.md).
- **While moving, a lighter Moon.** The Moon sphere has only as many segments as its size
  on screen needs to keep its edge within a quarter of a pixel (64 around at home zoom,
  instead of 384). Shading is per pixel, so nothing else changes. At rest the full mesh is
  back: 160 ms after the last movement the scene draws one full frame, then nothing.
- **Measured** (1440 × 900 unless said; frames are the median time between drawn frames):

  | Machine | Orbiting the System view | Flight to the Polar map |
  | :--- | ---: | ---: |
  | RTX 2060, before and after | 4.2 ms | 4.2 ms |
  | SwiftShader (software GPU), before | 196 ms | 229 ms |
  | SwiftShader, after | 33 ms | 37 ms |
  | SwiftShader, 6× CPU throttling, before | 213 ms | 225 ms |
  | SwiftShader, 6× CPU throttling, after | 36 ms | 41 ms |

  A real laptop's built-in graphics is still not measured. Local terrain on SwiftShader is
  still slow (about 240 ms a frame): the ground's mesh, for the ground package to take on.
- **Dev only:** `?perf` in the address shows the frame time over the scene;
  `window.__truesouthPerf` reads it.
- **When nothing moves, the page renders nothing.** A still scene draws no frames.
- **Rendering stops when the tab is hidden.**
- One sphere per body, a few pins and lines. The page weight is under "Textures".
- Geometry and textures are released when the view closes or the site changes.
- The Moon, Earth and the cap load first. The focused site's terrain loads when a flight
  needs it. The Polar map's overlays load after the first paint.

## When 3D does not run

When WebGL is missing, or the scene is still slow on its last quality stage (a median
flight frame over 55 ms; see "Performance"), a still picture of the System view replaces
the scene. A slow first flight alone no longer does: it steps the quality down.

- A single image behind the interface, with a note and a "Try 3D anyway" button.
- The 55 ms threshold is a guess from one machine. Measure on a laptop with built-in
  graphics and tune it.
- The picture is a render of the same textures, with no interface, pins or sight-lines baked
  into it. It is made at one time, so it does not follow the scrubber.
- Proposed: pins and sight-lines are not drawn over the still. Reason: without a camera
  there is no honest place to put them, and the sites rail and focused-site panel already
  carry the same facts.
- The rest of the interface works as normal. The Polar map is a 2D canvas and still works.
  Local terrain and Lander's eye show their 2D parts: the horizon chart and the view's
  controls.

## States

- **No focused site:** pins and bodies only, no sight-lines.
- **Textures still loading:** a plain grey Moon with the same lighting.
- **Sphere-tier site (Apollo 11):** the pin is on the globe. Local terrain and Lander's eye
  say "No terrain data for this site" and offer "Show it in the System view". The camera
  follows the site on the globe instead of descending.
- **Sun off screen:** an edge marker, an upright Sun icon and an arrow pointing to it.

## Done when

- Three well-known places appear where they should on the texture: Tycho, Mare Crisium and
  Shackleton crater.
- At a fixture hour, the day/night line passes through the points where the formula in
  [`../science.md`](../science.md) §14 gives zero Sun elevation.
- A site's pin is on the day side exactly when its `sun_el` is positive.
- Sight-line colours match the timeline bands at every hour of a fixture window.
- The true-scale toggle shows Earth about 2° wide as seen from the Moon's surface.
- Shackleton's 20.9 km rim, drawn at its IAU position, sits on the crater in the cap image;
  Connecting Ridge falls on the ridge between Shackleton and de Gerlache.
- The Moon is never covered by a panel at 1440 × 900 or 390 × 844, folded or open.
- At rest the page renders no frames. With the tab hidden, rendering stops.
- With WebGL off, the still picture shows and the rest of the interface works.
- First-load images total about 5.4 MB or less; no single image passes 1.6 MB, except the
  optional 8K halves.
- Every text over the scene sits on a plate and meets the contrast rules in
  [`../../DESIGN.md`](../../DESIGN.md).
