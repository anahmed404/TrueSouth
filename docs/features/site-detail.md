# Site detail: timeline and countdowns

The timeline of Mission Control: a floating bar along the bottom of the window, over the
scene. It shows the focused site's mission window hour by hour and holds the scrubber that
drives every view, including the Sun and Earth in the 3D scene.

Owner: Mission Control track. Folder: `web/src/features/mission-control/site-detail/`.
Math: [`../science.md`](../science.md) §9.
Layout and folding: [`mission-control.md`](mission-control.md). Prototype:
[`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

## Place and folding

- A solid, floating panel with a 16 px margin, the full width of the window less the
  margins, above the footer line. 196 px tall when open.
- **It folds to one row** (52 px) with its toggle: the toggle, the landing date with its
  day buttons and "Next GO", the current time, play and both countdowns remain; the bands and the countdown cards are hidden. The camera's centre slides
  to the new free space as the bar folds (200 ms; none under "reduce motion").
- The folded state is view state, kept in local storage, not in the scenario or the URL.
- **It is always on screen.** The Compare window opens above it, never
  over it, so the scrubber stays reachable. In the Slip Planner its slot holds the
  landing-date panel ([`slip-planner.md`](slip-planner.md)), which has its own slider.
- **On a phone** it is a compact strip: a 44 px row with the landing date, its day buttons
  and "Next GO"; then play, the current time and the countdowns on one line; then a 44 px
  scrubber. The date opens its picker, with the slip buttons, as a sheet the width of the
  screen.

## Timeline

```text
 Sun    ███████████████░░░░░████████████████████████░░░██████████████
 Earth  ██████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
        │ day 1   │ day 2   │ day 3   │ …                    │ day 10
                         ▲ scrubber: day 3, 14:00 UTC
```

- **Sun band.** Lit hours solid, dark hours empty. The band's height at each hour follows
  `sun_frac`, so a half-hidden Sun reads as half height.
- **Earth band.** Link hours solid, blackout hours empty.
- **Longest dark stretch** and **longest blackout** are outlined and labelled with their
  length in hours. If one breaks a veto, its outline is red.
- **Axis.** Mission day numbers above, UTC dates below.
- **Scrubber.** Drag it, click anywhere on the band, or use the arrow keys (1 hour; with
  Shift, 1 day). Page Up and Page Down move 24 hours; Home and End go to the ends of the
  mission window. A play button animates time at a chosen speed; the prototype's speed is
  "1 h per second". It is a slider with an accessible name.
- **Context.** Faint bands extend 3 days before landing and 3 days after the window ends.
- **The bar's header** starts with the landing date, at the left end of the time axis where
  the mission window begins, then the play controls at the right. The title "Timeline" and
  the window's end are read by screen readers; on screen the axis shows Day 1 to the last
  day, and the profile in the app bar shows the window's length with its tag. See "The
  landing date" below.

## The landing date

The landing date and the scrubber are two controls on one time axis: the landing date is
where the mission window starts, the scrubber is the current time inside it. So both sit
in the bottom strip, the landing date first.

```text
 ⌄  Landing date ⓘ  ‹ 2028-03-01 00:00 UTC ›  Slip +7 d  +14 d  Next GO        ▶  6 h per second  ◯ Clearance chart
        −3 d  ─ Day 1 ─ Day 2 ─ … ─ Day 10 ─ +1 d …
 Sun    ░░░░░░████████░░░░███████████████████░░░░░░
 Earth  ░░░░░░██████████████░░░░░░░░░░░░░░░░░░░░░░░
```

- **The control** is one component, `LandingDateControl` in
  `web/src/app/mission/landing-date-control.tsx`. It reads and writes only the scenario
  store, so the Slip Planner's landing-date panel mounts the same component in its header.
  It has a "Landing date" label with its info icon, a one-day earlier button, the date and
  hour in UTC (a button that opens the picker), a one-day later button, "Slip +7 d" and
  "+14 d", and "Next GO".
- **The picker** is a date and an hour in UTC, limited to the time grid. The latest valid
  landing date is the end of the time grid minus the mission duration. It opens above the
  strip. In the folded strip and on the phone the slip buttons move into it.
- **What follows a change of landing date.** The current time keeps its offset from the
  landing (Day 2 at 06:00 stays Day 2 at 06:00), clamped to the timeline's range of the
  window and 3 days either side (`moveLandingKeepingOffset` in `state/scenario.ts`). The
  timeline's "Day N" labels, the mission window band, the stretches and the countdowns
  follow. Each change pushes one browser history entry, so Back restores the previous date.
- **A narrow strip** first drops the word "Slip", then the words "Landing date" (both stay
  as the buttons' and the group's names); the play controls then wrap to a second row.
- **Rejected: a draggable start of the window on the timeline.** The timeline's range is
  anchored to the landing date (3 days either side of the window), so a handle there would
  move its own axis while being dragged. Moving the landing date along the calendar is the
  Slip Planner's slider.

### Next GO

- **What it does.** It moves the landing date to the next landing day on which the focused
  site is GO for the current mission profile, searching forward from the day after the
  current landing date's day. It uses the slip sweep's results for that site (`useSweep`)
  and `nextGoDay` in `web/src/lib/scoring/next-go.ts`, the same function as the Slip
  Planner's "next GO" column. It adds no scoring.
- **Whole days.** The sweep's entries are landings at 00:00 UTC
  ([`slip-planner.md`](slip-planner.md), "Whole days"), so the button sets the landing to
  00:00 UTC on that day. Its description says so.
- **States,** each in words:
  - While the sweep is computing, the button shows a turning ring, is `aria-busy` and cannot
    be pressed. Its description: "Working out the GO dates for Connecting Ridge…".
  - If the sweep fails, it cannot be pressed, and its description says why.
  - With no later GO day in the time grid, a plain line replaces it: "No GO date before
    2032", the year the grid ends.
  - With no focused site, it is not shown.
- **After a jump** a small bubble over the button says "Landing moved to 14 Mar 2028, the
  next GO date for Connecting Ridge." with "Undo", and a polite status line says the same to
  screen readers. Undo restores the previous landing date and current time exactly, and
  says "Landing moved back to 01 Mar 2028."; Back in the browser does the same. The bubble
  goes after 15 s (not while the pointer or focus is in it), on Escape, or when the landing
  date changes another way.
- The label is "Next GO". It is a planning result, not a guarantee: the provenance tags
  and the footer line stay as they are.

A small chart above the bands, shown on demand, plots `sun_clear` and `earth_clear` in
degrees against time, with a line at zero and a line at the antenna mask.

## Countdown cards

Four cards, measured from the scrubber's time:

| Card | Shows when lit / linked | Shows when dark / in blackout |
| :--- | :--- | :--- |
| Sun | "Sunset in 31 h 20 m" | "Sunrise in 6 h 05 m" |
| Earth | "Earthset in 4 h 10 m" | "Earthrise in 9 d 3 h" |

- Each card also shows the current value: Sun elevation and disc fraction; Earth elevation
  and clearance.
- If no event falls inside the time grid, the card says "none before 2032".
- When a countdown is under 6 hours the card turns amber.
- Sunset and Earthset mean the moments defined by the profile's rules, not the geometric
  horizon. The tooltip says so.

## "Why is it dark?" card

When the scrubber is on a dark or blackout hour, a card explains it in one sentence built
from the data:

> Sun is 0.8° up. The ridge in that direction rises to 1.1°, 12.4 km away, near de
> Gerlache. Blocked by terrain.

The blocker's distance, position and nearest named feature come from the skyline bin at
the body's azimuth.

When the Sun is up and lit, the card reads "Lit." and the share of the Sun's disc above the
skyline, for example "Lit. 62 % of the Sun's disc is above the skyline."

For a sphere-tier site the sentence is "Sun is below the horizon" with no blocker.

### Where the card sits

- **In Lander's eye,** as built in the prototype: at the foot of the floating panel under the
  horizon chart, with a Sun icon ([`panorama.md`](panorama.md)).
- **In the other camera views.** Proposed: when the hour is dark or in blackout, the same
  card floats as a plate at the foot of the free space, above the view controls. Clicking it
  flies the camera to Lander's eye, centred on the blocker's azimuth. Reason: the card
  answers "why" wherever a red sight-line is on screen, and the foot of the free space is
  already where each view's controls sit. In Local terrain the blocker marker and its
  plate ("Blocker, 12.4 km away") sit beside it
  ([`local-terrain.md`](local-terrain.md)).
- It is never in a floating window.
- The card's numbers come from the series and the skyline, never from the scene's shading.

## Done when

- Bands match the series for a hand-checked fixture window.
- The labelled longest stretches equal the metrics in the focused-site panel.
- Countdown times match a hand calculation from the fixture to within one minute.
- Dragging the scrubber stays smooth with all views open.
- The explanation sentence names the correct blocker for three fixture cases: blocked by
  near terrain, blocked by far terrain, and below the horizon.
- The bar folds to one row and unfolds with its toggle, and the scrubber works at every
  state, including on a phone at 390 px with a 44 px target.
- The landing date can be changed from the strip in every state (open, folded, phone), and
  a scrub of the current time does not re-render the landing-date control.
- "Next GO" finds the same day as the Slip Planner's "next GO" column for the day after the
  landing date, and shows each of its states in words.
- The bar stays visible and usable while the Compare window is open. In the Slip Planner the
  landing-date panel takes its place.
- Moving the scrubber moves the Sun and Earth in the scene.
