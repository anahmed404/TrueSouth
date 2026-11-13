# Slip Planner

A heatmap of sites against landing dates. It answers "the launch slipped; is this site
still good, and if not, when or where is?"

Owner: Mission Control track. Folder: `web/src/features/mission-control/slip-planner/`.
Math: [`../science.md`](../science.md) §9–11.

## What it shows

```text
                 2028 Jan        Feb         Mar         Apr   …
Connecting Ridge ░░▓▓▓▓░░░░░░░░░░▓▓▓▓▓░░░░░░░░░▓▓▓▓░░░░░░░░░   viable 31% · longest run 9 d · next: 14 Mar
Mons Mouton      ▓▓▓▓▓▓▓▓░░░░▓▓▓▓▓▓▓▓▓░░░▓▓▓▓▓▓▓▓▓▓░░░▓▓▓▓▓▓   viable 68% · longest run 17 d · next: today
de Gerlache rim  ░░░░▓▓░░░░░░░░░░░▓▓░░░░░░░░░░░▓▓▓░░░░░░░░░░   viable 12% · longest run 4 d · next: 16 Mar
                              ▲ landing date
```

- **Rows** are the selected sites.
- **Columns** are landing dates, one per day at 00:00 UTC.
- **Each cell** is the result for a mission that lands that day and runs for the profile's
  duration:
  - GO: green, brighter for a higher score.
  - CAUTION: amber.
  - NO-GO: dark red with hatching.
- **A marker** shows the current landing date.
- **A summary** at the end of each row, for the visible date range: share of viable dates
  (GO or CAUTION), longest run of viable dates, and the next viable date on or after the
  landing date.

## Interaction

- **Hover a cell:** date, status, score, and each veto with its measured value.
- **Click a cell:** sets the landing date and focuses that site.
- **Drag the marker,** or use the slip buttons (−14, −7, −1, +1, +7, +14 days).
- **Zoom:** 3 months, 18 months (default) or the whole time grid. Scroll to pan.
- **Slip card:** after the date changes, a card shows before and after for the focused
  site: status, score and each metric, with the change highlighted.
- **Sort rows** by name, by share of viable dates, or by status on the landing date.

## How it is computed

- A Web Worker runs the sweep for every selected site whenever the profile or the site
  list changes.
- Results are typed arrays, one entry per day: status, score, and a bit mask of vetoes.
- Drawing is on a Canvas, one rectangle per cell.

## States

- **Computing:** the previous result stays, dimmed, with a thin progress bar.
- **Dates near the end of the time grid** whose window does not fit are drawn as "no
  data".
- **Sphere-tier site:** computed normally, with a "terrain not modelled" note on the row.

## Done when

- Eight sites with a 100-day profile recompute in under 200 ms on a mid-range laptop.
- Cell results equal the focused-site panel's result for the same site and date.
- The summary numbers are correct for a hand-checked fixture row.
- Hovering, clicking and dragging work at every zoom level.
- Status is readable without colour: NO-GO is hatched, and the tooltip names the status.
