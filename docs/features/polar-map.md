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
- **Leaving.** Picking another view hands the scene back: the map fades out in the same
  260 ms (400 ms with "reduce motion") while the camera's flight to the new view starts at
  once. The scene owns the flight and starts it on the pick, so the map does not hold it back.
- **The swap's scale (as built).** The scene reports the pole's screen position and scale when
  its flight lands (`SceneArrival` in `web/src/app/scene.ts`). A pinhole camera draws the cap
  slightly smaller toward 80°S than the flat map does, so the map takes the scale halfway
  between the pole's and 80°S's: the pole stays put and no pin moves by more than about 0.6 %
  of the map's width at 80°S (tested in `polar-map.test.ts`). If no arrival comes within
  2.4 s (for example the first flight after a page load is still waiting for data), the map
  opens at its own fit, which is the same fit as the camera's pose.
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
  sites are ringed. The focused site's pin has a name plate. As built: a selected site is a
  16 px status lamp with its glyph, ringed and named; a catalog site that is not selected is
  a quiet grey dot (its status needs its series, which loads when it is added), named once
  zoomed in. Pins closer than 18 px fold into one, which shows "+N" (the focused one says
  "and N more sites here"); clicking a fold zooms in. A best-lit variant (71 to 149 m from its
  parent, so under two relief pixels away) has a dotted ring and a hairline to its parent.
  When the parent's own pin is drawn and the two would overlap, the variant stands in a
  callout beside it, with a dot at its true point; both stay clickable. When the parent is
  folded into another pin, a quiet variant folds there with it, so no callout stands beside
  an unrelated pin.
- **Named features:** crater and mountain labels, shown when zoomed in enough.
- **Artemis candidate regions:** outlines, off by default. As built: not drawn.
  `artemis_regions.json` holds names and source links only (every centre and size is
  `null`), so there is nothing to outline yet.
- **Latitude circles** every degree and longitude lines every 30°.
- **A scale bar** reading, for example, "50 km · north is outward from the pole", since
  every direction from the pole is north.

## Interaction

- **Pan and zoom** with `d3-zoom`: drag to pan; scroll, or the + and − buttons, to zoom. The
  sharper 8K relief image loads once zoomed in. As built: zoom runs from 70 % of the opening
  fit in to 25 m a pixel (the 8K image's pixel is 74 m); the 8K image loads once a 4K pixel
  would cover more than one device pixel, and is let go after 20 s zoomed back out and when
  the view is left (with the overlay images). Pan stops while a third of the map's width (or
  half the free space, zoomed in) is still inside the free space. Until the user moves the map it follows the free
  space; reset (or `0`) returns to the fit.
- **Keyboard (as built).** The map is one Tab stop. Arrows pan (Shift for more), `+` and `−`
  zoom, `0` resets, Enter marks a "New site here?" point at the centre and the arrows then
  move it, `N` starts a nudge of the focused pin (sliding it into the free space and zooming
  in to at least 40 m a pixel, so a step shows) and the arrows move it 100 m a press (1 km
  with Shift), Escape clears. A key list shows on a plate while the map has keyboard focus.
  Pins are reached from the sites rail; focusing a site that is off screen slides it into
  view.
- **Hover:** latitude, east longitude, and the overlay's value at that point. As built: the
  value is labelled as NASA's ("NASA's average sunlight 54 %").
- **Click a pin:** focus that site. **Click "Add":** add it to the selection. As built: a
  click on a catalog site that is not selected opens a small card with "Add to sites".
- **Click empty ground:** shows a "New site here?" readout with NASA's average sunlight
  and Earth visibility at that point.

## Custom sites

Built: the server is PR #80, the web side PR #92. Formats
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
- The map takes an optional `onRequestSite(latDeg, lonDeg)` (the `PolarMap` default
  export's prop, and `polarMapLayer({ onRequestSite })` for Mission Control). When it is
  given, the readout shows "Compute this site" and the nudge readout "Compute this point";
  without it there is no button. The map never calls the API itself. Mission Control
  passes `useRequestCustomSite()` from `web/src/app/mission/custom-site-actions.ts`, only
  while the server can compute custom sites: it starts the same flow and the same row as
  the form, with one POST per press.
- A POST is made only by a button press, once per press. A link, a remount, the page
  being shown again or the network coming back only look the id up (GET).

## Nudge the pin

This shows why a small move matters.

**Instant: read NASA's map.** Drag the focused site's pin. A readout follows it with the
average sunlight and Earth visibility under the pin, and the change from the starting
point. Example: "Average sunlight 83 % → 55 %, lower". This uses the lookup grids and needs
no API.

As built: the readout's title is the distance from the site ("640 m from Connecting Ridge");
every value is labelled "NASA's average sunlight" or "NASA's average Earth visibility"; the
start is always the site's listed point; the direction word compares the whole percentages
shown ("the same" when they match; none when either end has no data). Whose number it is
stays on screen for the whole gesture: while dragging, "NASA's long-term averages, not for
your dates."; after release, "This reads NASA's long-term average maps, not TrueSouth's
result for your dates. The site itself does not move." Releasing returns the pin to its
listed point and leaves the readout, with a dashed tie to the nudged point, until it is
closed. A sunlit-peak site adds its nearby range from `sites.json` as TrueSouth's six-year
average sunlight, in the sites package's wording, rounded outward so it never looks
narrower than it is ("Within 160 m: 39 % to 87 %"), and, when the catalog has one, its
best-lit variant ("Best-lit map pixel, 149 m from Connecting Ridge, chosen by TrueSouth")
with "Focus it" or "Add it". A lookup value is the nearest grid cell's byte; the top byte
(254, which the encoding caps at) reads "over 99 %", never "100 %".

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
As built: the list shows the selected sites that are off the map; "Show on Moon" focuses the
site and picks the System view. Following the site is the scene's own "Follow site" camera
preset, which the map cannot set from outside the scene.
Selecting one works as usual.

## States

- **API offline:** "Create a site here" and "Compute for my dates" are out of scope for the
  deadline. When they exist, they are disabled with a one-line reason; the instant nudge
  readout still works.
- **Overlay has no data at a point:** the readout says "no data".
- **Overlays still loading:** the overlay choice is disabled with the word "Loading". As
  built: on a box under 640 px wide the choice is a select with the same options, so the
  controls fit beside the zoom buttons on a phone.
- **In a lesson box** (`mode: "lesson"`, as built): the same map with zoom, reset and the
  scale bar; no overlays and no off-map list.
- **Used by another view** (as built, for the Slip Planner's flat mode and the Academy): the
  `PolarMap` default export also takes `sites` (the pins to place, in place of the whole
  catalog), `showFeatureNames` (default true), `overlay` and `overlayOpacity` (set the
  layer from outside, which hides the map's own overlay choice) and `onProjector` (a
  projector with the same shape as the 3D scene's `SceneProjector`: `project(lat, lon)` and
  `subscribe(onFrame)`).
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
