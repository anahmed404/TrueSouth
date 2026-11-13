# Local terrain

A 3D close-up of the ground around the focused site, lit from the Sun's true direction.
It shows the ridges and crater walls that shape the skyline.

Owner: 3D and Map track. Folder: `web/src/features/three/local-terrain/`.
Data: `terrain.bin`, `closeup.bin`, `skyline.bin`, the series.
Math: [`../science.md`](../science.md) §13.

## What it shows

- **The terrain mesh:** a 20 km square centred on the site, 257 × 257 points, with the
  Moon's curvature included.
- **The lander marker** at the centre.
- **Sunlight** from the Sun's direction at the scrubber's time, with shadows.
- **The skyline wall:** a dark ring around the mesh whose top edge follows the skyline of
  terrain further than 10 km away. It makes distant mountains visible, and it casts the
  shadows they would cast.
- **Sight-lines** from the lander toward the Sun and toward Earth, green or red by the
  series.
- **The blocker marker:** when the Sun or Earth is blocked, a ring on the terrain point
  that blocks it. If the blocker is beyond the mesh, the marker sits on the skyline wall
  with its distance.
- **A north arrow** and a scale bar.

## Overlays

One at a time:

| Overlay | Colours |
| :--- | :--- |
| None | Grey regolith shading |
| Slope | Green below the profile's ideal slope, amber up to its limit, red above |
| Height | A colour ramp by elevation |

A legend shows the overlay's scale and the slope baseline.

## Controls

- Orbit, zoom and pan. The camera cannot go below the ground or leave the mesh.
- **Vertical exaggeration:** ×1 (default), ×2, ×5. The label always shows the factor.
- **Close-up:** for sites with a close-up DEM, a toggle swaps to the 2 km mesh built from
  5 m data.
- **Lander's eye:** a button drops the camera to 2 m above the site, looking at the Sun.

## Shadows are decoration

Shadows on the mesh come from the graphics card and are for understanding only. Whether an
hour is lit comes from the series. When the two disagree, the series is right. A small
badge shows the series' answer: "Lit, 62% of the Sun's disc".

Two things keep the picture close to the truth:

- The skyline wall adds the far terrain the mesh does not include.
- At ×1 exaggeration the mesh is true to scale, so nearby shadows fall where they should.

With exaggeration above ×1, shadows are no longer true and the badge adds "shadows not to
scale".

## Performance

- 66,049 vertices and one 2,048-pixel shadow map. Target 60 frames a second on a laptop's
  built-in graphics; if it drops below 30, shadows turn off automatically.
- Shadow bias is tuned for very low Sun angles to avoid speckled artefacts.
- Geometry and textures are released when the site changes or the view closes.

## States

- **Sphere-tier site:** no mesh. The view shows "No terrain data for this site" and offers
  the System view.
- **Missing terrain in part of the mesh:** holes are left open, not filled.

## Done when

- A synthetic fixture crater appears with the correct depth and width.
- North, east and up are correct: a test mesh with a single peak north-east of centre
  shows it north-east.
- At a fixture hour, the Sun's sight-line points along the series' azimuth and elevation.
- The skyline wall's top matches the skyline's elevation in four test directions.
- The blocker marker lands on the same point the Lander's eye view reports.
