# System view

A 3D bird's-eye view of the Moon, Earth and Sun at the scrubber's time. It shows the whole
geometry of a mission at once: where the site is, where daylight is, and where Earth is.

Owner: 3D and Map track. Folder: `web/src/features/three/system-view/`.
Data: `system.bin`, `sites.json`, the focused site's series.
Math: [`../science.md`](../science.md) §14.

## What it shows

- **The Moon,** textured with NASA's colour map, lit from the Sun's true direction. The
  day/night line moves as time passes.
- **Site pins** for every selected site. The focused site's pin is larger.
- **Earth,** placed in its true direction from the Moon.
- **The Sun's direction,** shown as a light source and an arrow at the edge of the scene.
- **Two sight-lines** from the focused site: one toward the Sun, one toward Earth.
  - Green when the profile counts the hour as lit, or as linked.
  - Red when it does not.
  - The line colour comes from the series, never from the 3D scene.
- **The Moon's axis** and a faint equator, so the pole is easy to find.

## Scale

Real distances cannot fit on a screen: Earth is about 110 Moon-diameters away and the Sun
about 400 times further.

- **Default: compressed.** Every direction and angle is correct. Earth is drawn closer and
  larger than life so it can be seen. A label reads "Distances not to scale".
- **True scale toggle.** Earth moves to its real distance at its real size. The camera
  pulls back to fit both. The Sun stays a direction arrow, labelled with its distance.

## Camera

- Orbit, zoom and pan around the Moon.
- Presets: "South pole" (looking up at the pole, the default), "From Earth", "From the
  Sun", and "Follow site" (keeps the focused site facing the camera).
- Zoom is limited so the camera cannot pass through the Moon.

## Time

The scrubber drives the scene. Playing time shows the three motions that matter:

- The day/night line sweeping round the Moon once a month.
- Earth nodding up and down and side to side: libration.
- At the pole, the Sun circling the horizon without rising.

## Performance

- One sphere with a 4K texture, a few pins and lines. It must hold 60 frames a second on
  a laptop's built-in graphics.
- The texture loads at 2K first and swaps to 4K.
- Geometry and textures are released when the view closes.

## States

- **No focused site:** pins and bodies only, no sight-lines.
- **Texture still loading:** a plain grey Moon with the same lighting.

## Done when

- Three well-known places appear where they should on the texture: Tycho, Mare Crisium and
  Shackleton crater.
- At a fixture hour, the day/night line passes through the points where the formula in
  [`../science.md`](../science.md) §14 gives zero Sun elevation.
- A site's pin is on the day side exactly when its `sun_el` is positive.
- Sight-line colours match the timeline bands at every hour of a fixture window.
- The true-scale toggle shows Earth about 2° wide as seen from the Moon's surface.
