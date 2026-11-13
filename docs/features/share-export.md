# Share and export

Let a planner send a scenario to a colleague and take results into a report.

Owner: Mission Control track. Folder: `web/src/features/mission-control/share/`.

## Share a link

- The scenario is mirrored into the URL as the user works. The format is in
  [`../data-contracts.md`](../data-contracts.md).
- "Share" in the app bar copies a link built from the scenario store, not the address bar
  (which can lag a scrub by up to 250 ms), and confirms with a short message that screen
  readers announce. If the clipboard is blocked, the link appears selected in a field below
  the button, to copy by hand; Escape closes it and returns focus to the button.
- Opening a link restores the profile, sites, landing date, current time and view.
- A custom profile travels in the link. Only fields that differ from its base preset are
  encoded.
- A custom site travels by its id, which holds its coordinates. If the API no longer has
  the site, the app asks the API to compute it again. If the API is offline, the site is
  shown as unavailable and the rest of the scenario loads.
- An unknown site id, a date outside the time grid, or an unknown profile field is ignored
  with a visible notice. A bad link never produces a blank page.

## Export data

| Export | Format | Content |
| :--- | :--- | :--- |
| Comparison table | CSV | One row per site: status, score, every metric, vetoes, slope and its baseline, best marks and notes (built in MC9) |
| Scenario | JSON | The scenario, every profile value with its provenance, the time grid and each site's full-precision results (built in MC9) |
| Timeline | CSV | One row per hour of the focused site's mission window: UTC time and the eight series values, plus lit and link |
| Slip Planner | CSV | One row per site and day in the visible range: status, score, vetoes |
| Current view | PNG | The main view as shown |

The Timeline CSV, the Slip Planner CSV and the PNG export are not built yet (not in MC9).

- Every CSV starts with `#` comment lines giving the profile, the landing date, the mission
  window, the time grid's range, the time the file was made, the source, the scenario's
  link and the note "Planning aid, not flight certification".
- Units are in the column names (`longest_dark_h`, `link_pct`). Times are UTC ending in
  `Z`. Numbers use a plain hyphen-minus, never the screen's minus sign, so spreadsheets
  read them.
- Profile values in the header carry their sourced or assumed tag.
- All exports are made in the browser. Nothing is uploaded.
- File names include the site or scenario and the landing date, for example
  `truesouth_compare_im2_athena_2028-03-14.csv` and
  `truesouth_scenario_im2_athena_2028-03-14.json`.

## Links to NASA tools

Each site has "Quickmap" and "Moon Trek" links in the Compare table's last row; each opens
the tool centred on the site, in a new tab. They are not yet in the focused-site panel; that
is a follow-up.

MC9 confirmed both formats by opening each link and reading the tool's own coordinate
readout at the map centre, for Apollo 11 (0.674° N, 23.473° E) and Connecting Ridge
(−89.456°, 222.619° E). Neither tool documents them; they come from each tool's share links
and map configuration. The code is in `share/nasa-links.ts`.

- **LROC QuickMap**, now at `quickmap.lroc.im-ldi.com` (the old ASU address redirects):
  `/layers?extent=<minLon>,<minLat>,<maxLon>,<maxLat>&proj=<id>&features=<lon>,<lat>`.
  The extent is longitude and latitude in degrees, −180 to 180, whatever the projection;
  `features` drops a marker. `proj=16` is equidistant cylindrical; `proj=27` is south-pole
  stereographic, used south of 80° S. The view is about 3 km across.
- **Moon Trek**: `https://trek.nasa.gov/moon/#v=0.1&x=<x>&y=<y>&z=8&p=<projection>&d=`. In
  the cylindrical projection (`urn:ogc:def:crs:EPSG::104903`) x and y are longitude (−180
  to 180) and latitude in degrees. South of 80° S it uses
  `urn:ogc:def:crs:IAU2000::30120`, where x and y are polar-stereographic metres on the
  1,737.4 km sphere: ρ = 2R·tan(45° + lat/2), x = ρ·sin(lon), y = ρ·cos(lon). This only
  places a map view; it is not terrain or ephemeris science.

## Done when

- A copied link, opened in a private window, shows the same scenario.
- A link with one bad parameter loads everything else and shows one notice.
- Each CSV opens cleanly in a spreadsheet and its numbers match the screen.
- PNG export works for the Slip Planner, the Lander's eye view and both 3D views.
