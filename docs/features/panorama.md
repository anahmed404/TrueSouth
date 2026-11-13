# Lander's eye

A 360° panorama of the skyline as seen from the focused site, with the Sun and Earth drawn
on it. It is the view that makes "the Sun is blocked by that ridge" obvious.

Owner: Mission Control track. Folder: `web/src/features/panorama/`.
Data: `skyline.bin` and the series. Math: [`../science.md`](../science.md) §5–7.

## What it shows

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

## Scales

- Horizontal: 360° of azimuth. The view is centred on Earth's average azimuth by default,
  so Earth's small loop is not split across the edges. A control re-centres on north, on
  the Sun, or on Earth.
- Vertical: chosen automatically from the paths and the skyline, with a margin.
  - Near the pole this is about −8° to +10°.
  - Where the Sun climbs high, the range grows to fit.
- The vertical scale is stretched compared with the horizontal. A label states the factor,
  for example "vertical ×12". Discs are drawn as ellipses to stay true in angle.

## Interaction

- **Hover the skyline:** azimuth, skyline elevation, distance to the blocker, the
  blocker's height, and the nearest named feature.
- **Hover a path tick:** the date and that hour's elevation and disc fraction.
- **Drag horizontally** to rotate the view. **Scroll** to zoom the vertical scale.
- **Click a blocker** to mark it; the Terrain and Map views show the same marker.
- The scrubber moves the discs along their paths.

## Drawing

SVG, built by hand with `d3-scale` and `d3-shape`. One path for the skyline, one polyline
per track. Tracks are split where they wrap past the view's edge.

## States

- **Sphere-tier site:** a flat skyline with the note "Terrain not modelled. Showing a
  smooth Moon."
- **Loading:** an empty frame with axes.

## Done when

- The skyline equals the `el_deg` array for a fixture site, bin by bin.
- At a fixture hour where `sun_frac` is 0.5, the Sun's disc is drawn half above the
  skyline.
- Re-centring never splits Earth's path when centred on Earth.
- Hover values match the skyline arrays.
- The view stays smooth while the scrubber plays.
