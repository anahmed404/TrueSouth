# Compare

Up to four sites side by side for one mission profile and one landing date.

Owner: Mission Control track. Folder: `web/src/features/mission-control/compare/`.
Math: [`../science.md`](../science.md) §9–10.

## Layout

One column per site. Rows, top to bottom:

| Row | Content |
| :--- | :--- |
| Site | Name, coordinates, terrain tier |
| Status | GO, CAUTION or NO-GO, with the score |
| Vetoes | Each triggered veto with its measured value and limit |
| Sunlight | `sun_fraction_mean` and `lit_fraction`, as numbers and bars |
| Longest dark stretch | Hours, against the profile's limit |
| Earth link | `link_fraction`, as a number and a bar |
| Longest blackout | Hours, against the profile's limit |
| Sun at landing | Elevation, and whether it is lit |
| Slope | Degrees, with its baseline and source |
| Timeline | The mission window's Sun and Earth bands, small |
| Skyline | A small Lander's eye strip |
| Nearby dates | The site's Slip Planner row for 60 days either side of the landing date |

- The best value in each row is marked. For hours of darkness and slope, lower is best.
- A row whose values differ a lot between sites is highlighted, so the deciding factor
  stands out.
- Bars in a row share one scale.

## Interaction

- Choose which of the selected sites to show. The first four are shown by default.
- Click a column header to focus that site.
- Click a "Nearby dates" cell to change the landing date for all columns.
- "Export" saves the table as CSV. See [`share-export.md`](share-export.md).

## A sentence that sums it up

Above the table, one generated sentence states the result plainly:

> For IM-2 Athena landing 14 March 2028, Mons Mouton is the only GO site. Connecting Ridge
> fails on a 31-hour blackout.

It is built from the statuses and vetoes, with no AI model.

## Done when

- Every number equals the focused-site panel's number for the same site.
- "Best" marks are correct for a fixture set of four sites, including a tie.
- The summary sentence is correct for fixtures with zero, one and several GO sites.
- The table reads correctly at 1,280 pixels wide with four columns.
