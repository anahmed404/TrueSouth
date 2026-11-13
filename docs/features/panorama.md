# Lander's eye

A 360° view of the skyline as seen from the focused site, with the Sun and Earth drawn on
it. It is the view that makes "the Sun is blocked by that ridge" obvious. In Mission
Control it is a camera view: the camera drops to 2 m above the ground, and the horizon
chart floats under the real horizon.

Owner: Mission Control track. Folder: `web/src/features/panorama/`. The camera and the 3D
horizon belong to the 3D and Map track (work package T5); this folder owns the horizon
chart, its card and its controls.
Data: `skyline.bin` and the series. Math: [`../science.md`](../science.md) §5–7.
Layout and the view bar: [`mission-control.md`](mission-control.md). Prototype:
[`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

## How it is entered and left

- **Entering.** Picking "Lander's eye" on the view bar, or the "Lander's eye" button in
  Local terrain, drops the camera to 2 m above the site, with a 26° lens, centred on Earth
  by default. From any other view the camera flies there in one move of 1.3 to 1.5 s.
- **Looking around.** Drag to look around. The control row centres the view on Earth, on the
  Sun or on north.
- **Leaving.** Picking another view flies the camera there. The view's address in the
  shareable link is `view=panorama`.
- **Reduced motion.** Every move is a 120 ms dip through Night and a cut.
- **A sphere-tier site** cannot be flown to. See "States".

## What is behind and what floats above

- **Behind the interface:** the real horizon in 3D, from the site's terrain: the 20 km
  patch and the terrain around it ([`local-terrain.md`](local-terrain.md)). Earth and the
  Sun are drawn at their true angular size. Each has a label with its height and state, for
  example "Earth, 0.9° up · in view" and "Sun, 0.8° up · behind the ridge". The ground
  near the lander is a flat grey plane: 80 m data cannot show regolith at 2 m.
- **Floating above it,** under the horizon: a panel holding the horizon chart (below), the
  "Why is it dark?" card and a one-line legend. The app bar, view bar, sites rail,
  focused-site panel and timeline float as in every view. The scene's free space ends above
  this panel, so the horizon is never covered.
- A plate says that shading and shadows are for understanding only. **Lit or dark comes
  from the series.** Earth's and the Sun's "in view" or "blocked" in the labels come from
  the series' `clearance` and disc fraction, never from what the scene draws.

## The horizon chart

The chart is the approved panorama, unchanged by the move into the scene. The component
is `LandersEye`; it takes `PanelProps` and also works alone in the Academy's lessons.

```text
 +6° ┤                                             ◯ Earth
 +4° ┤
 +2° ┤      ☀ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ Sun's path ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─ ─
  0° ┤▂▃▅▆▅▃▂▁▁▂▃▃▂▁▁▁▂▄▆█▆▄▂▁▁▁▂▂▃▂▁▁▁▂▃▄▃▂▁▁▁▂▃▅▆▅▃▂▁▁▂▃▃▂▁▁▁▂▄▆▅▃▂▁
 −2° ┤
     N        E        S        W        N
```

- **Skyline:** a filled silhouette across all 360°.
- **Sun and Earth:** discs at their true angular size at the scrubber's time. The part of
  a disc below the skyline is drawn dimmed.
- **Paths:** the Sun's and Earth's tracks over the mission window, with a tick each day.
- **Horizontal line** at 0° (the local horizontal) and a dashed line at the antenna mask
  above the skyline around Earth's position.
- **Compass labels** along the bottom.
- **Legend,** one line: "Sun's path, one dot a day", "Earth's path", "A disc's faded part
  is below the skyline".

### Scales

- Horizontal: 360° of azimuth. The view is centred on Earth's average azimuth by default,
  so Earth's small loop is not split across the edges. A control re-centres on north, on
  the Sun, or on Earth. The same control turns the 3D camera.
- Vertical: chosen automatically from the paths and the skyline, with a margin.
  - Near the pole this is about −8° to +10°.
  - Where the Sun climbs high, the range grows to fit.
- The vertical scale is stretched compared with the horizontal. A label states the factor,
  for example "vertical ×12". Discs are drawn as ellipses to stay true in angle.

### Interaction

- **Hover the skyline:** azimuth, skyline elevation, distance to the blocker, the
  blocker's height, and the nearest named feature.
- **Hover a path tick:** the date and that hour's elevation and disc fraction.
- **Drag horizontally** to rotate the view. **Scroll** to zoom the vertical scale.
- **Click a blocker** to mark it; Local terrain shows the same marker.
- The scrubber moves the discs along their paths.

### Drawing

SVG, built by hand with `d3-scale` and `d3-shape`. One path for the skyline, one polyline
per track. Tracks are split where they wrap past the view's edge.

## The "Why is it dark?" card

The card sits at the foot of the floating panel, under the chart, in this view. Its text,
its wording and its data are in [`site-detail.md`](site-detail.md). It says "Lit." plus the
share of the Sun's disc above the skyline when the Sun is up.

## States

- **Sphere-tier site (Apollo 11):** in Mission Control, the camera does not descend. The
  view sentence reads "No terrain data for Apollo 11, so its horizon is flat: the Moon
  there is a smooth sphere." A button offers "Show Apollo 11 in the System view". In the
  Academy's lesson mode, the chart still draws a flat skyline with the note "Terrain not
  modelled. Showing a smooth Moon."
- **Loading:** an empty frame with axes.
- **No WebGL or the still picture.** Proposed: the floating panel (the chart and the card)
  still shows, with a plain dark ground behind it. Reason: the chart carries the whole
  answer and needs no 3D.

## Done when

- The skyline equals the `el_deg` array for a fixture site, bin by bin.
- At a fixture hour where `sun_frac` is 0.5, the Sun's disc is drawn half above the
  skyline, in the chart and in the 3D view.
- Re-centring never splits Earth's path when centred on Earth.
- Hover values match the skyline arrays.
- The view stays smooth while the scrubber plays.
- The 3D horizon and the chart show the same skyline at four test azimuths.
- The labels' "in view" and "blocked" equal the series' answer at every hour of a fixture
  window.
- The panel works in a box 360 px wide in the Academy's lesson mode.
