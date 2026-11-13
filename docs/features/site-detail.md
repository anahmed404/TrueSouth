# Site detail: timeline and countdowns

The bottom strip of Mission Control. It shows the focused site's mission window hour by
hour and holds the scrubber that drives every view.

Owner: Mission Control track. Folder: `web/src/features/mission-control/site-detail/`.
Math: [`../science.md`](../science.md) §9.

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
  Shift, 1 day). A play button animates time at a chosen speed.
- **Context.** Faint bands extend 3 days before landing and 3 days after the window ends.

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
the body's azimuth. Clicking the card opens the Lander's eye view centred on that azimuth.

For a sphere-tier site the sentence is "Sun is below the horizon" with no blocker.

## Done when

- Bands match the series for a hand-checked fixture window.
- The labelled longest stretches equal the metrics in the focused-site panel.
- Countdown times match a hand calculation from the fixture to within one minute.
- Dragging the scrubber stays smooth with all views open.
- The explanation sentence names the correct blocker for three fixture cases: blocked by
  near terrain, blocked by far terrain, and below the horizon.
