# Polar map

A flat map of the south polar region. It is where users see their sites on the ground and
see how much a small move matters. It is one of the five camera views of Mission Control:
the camera flies to the pole, and the flat map takes over.

Owner: 3D and Map track. Folder: `web/src/features/polar-map/`.
Data: `maps/`, `sites.json`, `features.json`, `artemis_regions.json`.
Math: [`../science.md`](../science.md) §2.3 and §12.
Layout and the view bar: [`mission-control.md`](mission-control.md). Prototype:
[`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

A 3D globe would put the pole at the bottom, where sites are hard to see and click. So the
map is flat, and the globe lives in the [System view](system-view.md).

## How it is entered and left

- **Entering.** Picking "Polar map" on the view bar flies the camera under the south pole
  in 1.3 s, along the same path as every camera move
  ([`system-view.md`](system-view.md)). In the last 45% of the move the cap's lighting
  blends from the real Sun to the map's fixed top-left lighting. At the end the flat map
  (a 2D canvas) replaces the globe in a 260 ms fade. From that pose the globe and the
  stereographic map differ by less than 0.3% near the sites and about 1% at 80°S, so the
  swap does not show.
- **Reduced motion.** With "reduce motion" on, the map fades in over the globe in 400 ms
  with no camera move.
- **Leaving.** Picking another view hands the scene back. Proposed: the globe replaces the
  map in the same 260 ms fade, and the camera then flies to the new view. Reason: it is the
  entering move run backwards, so the map never jumps.
- A pick during the flight interrupts it and starts from where the camera is.
- The view's address in the shareable link is `view=map`.

## What is behind and what floats above

- **Behind the interface:** the flat map, filling the window. Its drawing is the relief
  image below, with latitude rings, pins and labels.
- **Floating above it:** the app bar, the view bar, the sites rail, the focused-site panel
  and the timeline, as in every view. The map's own controls
  float at the foot of the free space: zoom in, zoom out and reset, the overlay choice with
  its opacity slider, and the scale bar.
- The map's centre is the middle of the free space between the panels, so a panel does not
  cover the pole when the view opens.
- The relief is a picture. **Lit or dark comes from the series, never from this shading.**

## What it shows

- **Base layer:** shaded relief from the 80 m map, covering 80°S to the pole, with a sharper
  core near the pole. It is lit from the top-left of the image as a drawing convention
  ([`science.md`](../science.md) §2.4), not by the real Sun.
- **Overlays,** one at a time, with an opacity slider:
  - NASA's average sunlight (share of time lit, averaged over 18.6 years), tinted Sun
    Cream.
  - NASA's average Earth visibility, tinted Earth Sky.

  The overlays load after the first paint of the scene.
- **Site pins,** coloured by status for the current landing date, and named. Selected
  sites are ringed. The focused site's pin has a name plate.
- **Named features:** crater and mountain labels, shown when zoomed in enough.
- **Artemis candidate regions:** outlines, off by default.
- **Latitude circles** every degree and longitude lines every 30°.
- **A scale bar** reading, for example, "50 km · north is outward from the pole", since
  every direction from the pole is north.

## Interaction

- **Pan and zoom** with `d3-zoom`: drag to pan; scroll, or the + and − buttons, to zoom. The
  sharper 8K relief image loads once zoomed in.
- **Hover:** latitude, east longitude, and the overlay's value at that point.
- **Click a pin:** focus that site. **Click "Add":** add it to the selection.
- **Click empty ground:** shows a "New site here?" readout with NASA's average sunlight
  and Earth visibility at that point.

## Custom sites

Built (web side) on branch `mc/sites-custom-and-variants`; the server is PR #80. Formats
are in [`../data-contracts.md`](../data-contracts.md), "API messages".

1. The user types a latitude and east longitude under "Your own coordinates" in the
   add-site picker, or clicks "Compute this site" on the map.
2. The app calls `POST /api/sites/custom`. The row appears in the sites rail at once,
   "Computing terrain for your site…", with its coordinates, its place in the queue, the
   time so far and a moving hairline that says only that the job is alive.
3. When the job is ready the site joins the selection and behaves like a catalog site:
   status, focus, timeline, countdowns, the scene's pin, Local terrain (its own
   `terrain.bin`, no apron or close-up), Lander's eye and the Slip Planner.

- Latitude −90° to 90°, at least 0.001° from a pole; east longitude 0° to 360°, and −180°
  to 0° is accepted and shown as the east value it becomes. Each field says what is wrong
  beside it as the user types.
- Before computing, the form says what will happen. North of 60°S (the server's tier
  bounds, `docs/architecture.md`) it says "Outside our terrain maps: computed on a smooth
  Moon, with no mountains", and the site is ready in seconds.
- The id is always the one the server returns. A custom site is kept in the scenario link
  by that id. Opening a link looks the id up once and never starts a job without a click:
  a known site loads; an unknown one shows "Not computed on this server yet" with
  "Compute this site"; an offline server or a 503 says so, and the other sites keep
  working.
- "Stop waiting" removes the row; the server may still finish the job. A failed row says
  why in plain words, with "Try again" (held until `Retry-After` when the server sends
  one) and "Remove".
- When the server reports `custom_sites: "not_available"`, or no API answers, the section
  shows one line, "Custom sites are not available on this server.", with the form
  disabled. The check runs once, when the picker opens.
- A custom site carries the filled tag "Your site": computed by TrueSouth at a typed
  point, never a sourced mission site.
- For the map: the shell passes `useRequestCustomSite()` from
  `web/src/app/mission/custom-site-actions.ts` as `onRequestSite`; it starts the same flow
  and the same row.

## Nudge the pin

This shows why a small move matters.

**Instant: read NASA's map.** Drag the focused site's pin. A readout follows it with the
average sunlight and Earth visibility under the pin, and the change from the starting
point. Example: "Average sunlight 83 % → 55 %, lower". This uses the lookup grids and needs
no API.

**Exact: compute for my dates.** Out of scope for the deadline; the spec stays. A button
calls `POST /api/sensitivity` for the pin's position, the landing date and the profile. It
draws a 9 × 9 grid, 250 m spacing, over the map, coloured by `sun_fraction_mean` or
`link_fraction` for the mission window. Clicking a grid cell offers "Create a site here".

The grid is labelled "fast approximation", and the panel shows the centre value under both
the fast and the full method.

## Sites outside the map

Contrast sites away from the pole, such as Apollo 11, are not on the flat map. Proposed: a
short list floats beside the map's controls, and each row's "Show on Moon" button flies
the camera back to the System view following that site. Reason: the earlier strip with a
locator globe is now redundant, because the System view is the globe and is one pick away.
Selecting one works as usual.

## States

- **API offline:** "Create a site here" and "Compute for my dates" are out of scope for the
  deadline. When they exist, they are disabled with a one-line reason; the instant nudge
  readout still works.
- **Overlay has no data at a point:** the readout says "no data".
- **Overlays still loading:** the overlay choice is disabled with the word "Loading".
  Proposed. Reason: the overlays arrive after the first paint, so the choice must not be
  live before they do.
- **No WebGL or the still picture:** the flat map is a 2D canvas, so it still opens, with a
  cross-fade in place of the flight.

## Done when

- Clicking the map and converting to latitude and longitude, then back, returns the same
  pixel.
- Every catalog pin sits on its feature in the relief image: Shackleton's rim sites sit on
  the rim.
- The nudge readout matches the lookup grid's value for hand-checked points.
- Labels and pins stay the same screen size at every zoom level.
- The swap from globe to map shows no jump: a pin's screen position before and after the
  fade differs by under 1% of the map's width at 80°S.
- With "reduce motion" on, there is no camera move, only the 400 ms cross-fade.
- A custom site created from the map appears in the Slip Planner without a page reload
  (out of scope for the deadline).
