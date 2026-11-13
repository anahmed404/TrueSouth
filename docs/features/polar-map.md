# Polar map

A flat map of the south polar region. It is where users pick sites, create custom sites
and see how much a small move matters.

Owner: 3D and Map track. Folder: `web/src/features/polar-map/`.
Data: `maps/`, `sites.json`, `features.json`, `artemis_regions.json`.
Math: [`../science.md`](../science.md) §2.3 and §12.

A 3D globe would put the pole at the bottom, where sites are hard to see and click. The
globe lives in the [System view](system-view.md).

## What it shows

- **Base layer:** shaded relief from the 80 m map, covering 80°S to the pole. It is lit
  from the top-left of the image as a drawing convention
  ([`science.md`](../science.md) §2.4), not by the real Sun.
- **Overlays,** one at a time, with an opacity slider:
  - NASA's average sunlight (share of time lit, averaged over 18.6 years).
  - NASA's average Earth visibility.
- **Site pins,** coloured by status for the current landing date. Selected sites are
  ringed.
- **Named features:** crater and mountain labels, shown when zoomed in enough.
- **Artemis candidate regions:** outlines, off by default.
- **Latitude circles** every degree and longitude lines every 30°.
- **A scale bar** and a "north is outward" note, since every direction from the pole is
  north.

## Interaction

- **Pan and zoom** with `d3-zoom`. The sharper 8K relief image loads once zoomed in.
- **Hover:** latitude, east longitude, and the overlay's value at that point.
- **Click a pin:** focus that site. **Click "Add":** add it to the selection.
- **Click empty ground:** offer "Create a site here".

## Custom sites

1. The user clicks the map, or types a latitude and east longitude.
2. The app calls `POST /api/sites/custom` and shows "Computing terrain for your site…".
3. When the job is ready the site joins the selection and behaves like a catalog site.

- Typed coordinates work for anywhere on the Moon. Places with no terrain data become
  sphere-tier sites and are ready at once.
- A custom site is kept in the scenario link by its id.
- Invalid coordinates show a plain message next to the field.

## Nudge the pin

This shows why a small move matters.

**Instant: read NASA's map.** Drag the focused site's pin. A readout follows it with the
average sunlight and Earth visibility under the pin, and the change from the starting
point. Example: "Sunlight 81% → 34% (moved 420 m)". This uses the lookup grids and needs
no API.

**Exact: compute for my dates.** A button calls `POST /api/sensitivity` for the pin's
position, the landing date and the profile. It draws a 9 × 9 grid, 250 m spacing, over the
map, coloured by `sun_fraction_mean` or `link_fraction` for the mission window. Clicking a
grid cell offers "Create a site here".

The grid is labelled "fast approximation", and the panel shows the centre value under both
the fast and the full method.

## Sites outside the map

Contrast sites away from the pole are listed in a strip beside the map with a small
locator globe. Selecting one works as usual; "Show on Moon" opens the System view.

## States

- **API offline:** "Create a site here" and "Compute for my dates" are disabled with a
  one-line reason. The instant nudge readout still works.
- **Overlay has no data at a point:** the readout says "no data".

## Done when

- Clicking the map and converting to latitude and longitude, then back, returns the same
  pixel.
- Every catalog pin sits on its feature in the relief image: Shackleton's rim sites sit on
  the rim.
- The nudge readout matches the lookup grid's value for hand-checked points.
- A custom site created from the map appears in the Slip Planner without a page reload.
- Labels and pins stay the same screen size at every zoom level.
