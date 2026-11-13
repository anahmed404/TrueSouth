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
- **It folds to one row** (52 px) with its toggle: play, speed, the current time and the
  toggle remain; the bands and the countdown cards are hidden. The camera's centre slides
  to the new free space as the bar folds (200 ms; none under "reduce motion").
- The folded state is view state, kept in local storage, not in the scenario or the URL.
- **It is always on screen.** A floating window (the Slip Planner or Compare) opens above
  it, never over it, so the scrubber stays reachable.
- **On a phone** it is a 100 px strip: play, the current time, and a 44 px scrubber. The
  countdown cards become one line.

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
- **The bar's header** holds the title "Timeline", the mission window's dates in UTC, and
  the controls.

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
- The bar stays visible and usable while the Slip Planner or Compare window is open.
- Moving the scrubber moves the Sun and Earth in the scene.
