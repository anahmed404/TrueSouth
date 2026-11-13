# Share and export

Let a planner send a scenario to a colleague and take results into a report.

Owner: Mission Control track. Folder: `web/src/features/mission-control/share/`.

## Share a link

- The scenario is mirrored into the URL as the user works. The format is in
  [`../data-contracts.md`](../data-contracts.md).
- "Copy link" copies the current URL and confirms with a short message.
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
| Comparison table | CSV | One row per site: status, score, every metric, vetoes, slope and its baseline |
| Timeline | CSV | One row per hour of the focused site's mission window: UTC time and the eight series values, plus lit and link |
| Slip Planner | CSV | One row per site and day in the visible range: status, score, vetoes |
| Current view | PNG | The main view as shown |

- Every CSV starts with comment lines giving the profile, the landing date, the time the
  file was made, and the note "Planning aid, not flight certification".
- Profile values in the header carry their sourced or assumed tag.
- All exports are made in the browser. Nothing is uploaded.
- File names include the site or scenario and the landing date, for example
  `truesouth_compare_2028-03-14.csv`.

## Links to NASA tools

Each site has "Open in Quickmap" and "Open in Moon Trek" links in the focused-site panel.

The exact URL formats for opening those tools at a coordinate have not been confirmed.
Work package MC9 confirms them. Until then the links open each tool's home page, and the
panel shows the coordinates with a copy button.

## Done when

- A copied link, opened in a private window, shows the same scenario.
- A link with one bad parameter loads everything else and shows one notice.
- Each CSV opens cleanly in a spreadsheet and its numbers match the screen.
- PNG export works for the Slip Planner, the Lander's eye view and both 3D views.
