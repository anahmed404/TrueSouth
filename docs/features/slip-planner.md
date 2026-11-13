# Slip Planner

A heatmap of sites against landing dates. It answers "the launch slipped; is this site
still good, and if not, when or where is?"

Owner: Mission Control track. Folder: `web/src/features/mission-control/slip-planner/`.
Math: [`../science.md`](../science.md) §9–11.
Layout, floating windows and the view bar: [`mission-control.md`](mission-control.md).
Prototype: [`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

## A floating window

The Slip Planner is a table, not a place, so it opens as a **floating window** over the
scene and leaves the camera where it is.

- **Opening.** The "Slip Planner" button on the view bar, marked with a small window icon.
  The window rises and fades in over 180 ms (none under "reduce motion").
- **Size and place.** A solid panel with the popover shadow, centred, at most 1,120 px wide
  (or the window's width less 32 px, if smaller). It sits between the view bar and the
  timeline. On a phone it fills the screen.
- **Header.** The title "Slip Planner", one sentence ("Every selected site against landing
  dates. Each square says whether a landing that day would be GO, CAUTION or NO-GO, so you
  can see how far a launch can slip.") and a close button.
- **Closing.** Escape, or the close button. Focus returns to the view bar button. Clicking the Compare button replaces this window with Compare.
- **Not modal.** `role="dialog"` with `aria-modal="false"`. The app bar, side panels and
  timeline stay usable.
- **What stays visible behind and around it.** The scene, the app bar, the view bar and the
  timeline. The side panels stay where they are and the window covers only the space
  between them and above the timeline. The landing-date marker, the "slip" buttons in the
  app bar and the focused-site panel update live as the window changes the date.
- The view's address in the shareable link is `view=slip`, which opens the window over
  whatever camera view was last shown.

## What it shows

```text
                 2026 ┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈ the six-year bar ┈┈┈┈┈┈┈┈┈┈┈┈ 2031
                 ▁▂▂▃▃▂▃▅▆▅▃▂▃▃▄▃▂▂▃▃▅▆▇▆▅▃▂▂▃▃▄▃▂▃▃▂▃▅▆▅▄▃▂▂▃▃▂▃▃▄▃▂▂▃▃▂▃▅▆▅▃
                 [ visible range ]
                 2028 Jan        Feb         Mar         Apr   …
Connecting Ridge ░░▓▓▓▓░░░░░░░░░░▓▓▓▓▓░░░░░░░░░▓▓▓▓░░░░░░░░░   31 % viable · next 14 Mar
Mons Mouton      ▓▓▓▓▓▓▓▓░░░░▓▓▓▓▓▓▓▓▓░░░▓▓▓▓▓▓▓▓▓▓░░░▓▓▓▓▓▓   68 % viable · today
de Gerlache rim  ░░░░▓▓░░░░░░░░░░░▓▓░░░░░░░░░░░▓▓▓░░░░░░░░░░   12 % viable · next 16 Mar
                              ▲ landing date
```

- **The six-year bar** across the top covers the whole time grid. Its height at each day
  shows how many selected sites are viable (GO or CAUTION) that day. A frame marks the
  visible range. Click the bar to move the visible range there.
- **Rows** are the selected sites.
- **Columns** are landing dates, one per day at 00:00 UTC.
- **Each cell** is the result for a mission that lands that day and runs for the profile's
  duration:
  - GO: green, brighter for a higher score.
  - CAUTION: amber.
  - NO-GO: dark red with hatching.
  - No data: dotted, where the window runs past the end of the time grid.
- **A marker** shows the current landing date.
- **A summary** at the end of each row, for the visible date range: share of viable dates
  (GO or CAUTION), the longest run of viable dates, and the next viable date on or after
  the landing date. The prototype shows the share and the next date.
- **A legend,** one line: the three statuses with their lamps, and "No data: the window
  runs past 2031".

## Interaction

- **Hover a cell:** date, status, score, and each veto with its measured value.
- **Click a cell:** sets the landing date and focuses that site.
- **Drag the marker,** or use the slip buttons (−14, −7, −1, +1, +7, +14 days). The
  prototype's app bar has −1, +1, +7 and +14. The arrow keys move the date by a day while
  the window has focus.
- **Zoom:** 3 months, 18 months (default) or 6 years, the whole time grid. Scroll to pan.
- **Slip card:** at the foot of the window. After the date changes, it shows before and
  after for the focused site: "Connecting Ridge slipped +21 d: 01 Mar → 22 Mar", the status
  before and after, and the broken rule or the score. For example, NO-GO → GO, score 77.
  Before any slip it reads "Press Slip +7 d or +14 d above, or click a square."
- **Sort rows** by name, by share of viable dates, or by status on the landing date. The
  prototype does not sort yet.

## How it is computed

- A Web Worker runs the sweep for every selected site whenever the profile or the site list
  changes. The worker is built (work package MC7a); the window uses it.
- Results are typed arrays, one entry per day: status, score, and a bit mask of vetoes.
- Drawing is on a Canvas, one rectangle per cell. The prototype uses SVG.
- The sweep reads the Python-computed series and the mission profile. The scene's shading
  plays no part.
- The prototype's squares come from a separate cheap mock sweep, so a square can disagree
  with its own hover. In the real build they must agree.

## States

- **Computing:** the previous result stays, dimmed, with a thin progress bar.
- **Dates near the end of the time grid** whose window does not fit are drawn as "no
  data".
- **Sphere-tier site:** computed normally, with a "terrain not modelled" note on the row.
- **No WebGL or the still picture:** unchanged; the window does not use the scene.

## Done when

- Eight sites with a 100-day profile recompute in under 200 ms on a mid-range laptop.
- Cell results equal the focused-site panel's result for the same site and date, and equal
  the hover readout of the same square.
- The summary numbers are correct for a hand-checked fixture row.
- Hovering, clicking and dragging work at every zoom level.
- Status is readable without colour: NO-GO is hatched, and the tooltip names the status.
- Opening the window does not move the camera. Escape closes it and returns focus to the
  view bar button.
- The timeline stays visible and usable while the window is open.
- Clicking a square lands on that date and focuses that site, and the focused-site panel and
  timeline show the new date at once.
- The window fills the screen on a phone, with every control at least 44 px.
