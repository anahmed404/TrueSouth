# Compare

Up to four sites side by side for one mission profile and one landing date.

Owner: Mission Control track. Folder: `web/src/features/mission-control/compare/`.
Math: [`../science.md`](../science.md) §9–10.
Layout, floating windows and the view bar: [`mission-control.md`](mission-control.md).
Prototype: [`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md).

## A floating window

Compare is a table, not a place, so it opens as a **floating window** over the scene and
leaves the camera where it is. It follows the floating-window rules in
[`mission-control.md`](mission-control.md):

- **Opening.** The "Compare" button on the view bar, marked with a small window icon. The
  window rises and fades in over 180 ms (none under "reduce motion").
- **Size and place.** A solid panel with the popover shadow, centred, at most 1,120 px wide,
  between the view bar and the timeline. On a phone it fills the screen.
- **Header.** The title "Compare", the summary sentence (below), an "Export CSV" button and
  a close button.
- **Closing.** Escape, or the close button. Focus returns to the view bar button.
- **Not modal.** `role="dialog"` with `aria-modal="false"`.
- **What stays visible.** The scene, the app bar, the view bar, the side panels and the
  timeline. The scrubber and the landing date keep working, and the table updates with
  them.
- The view's address in the shareable link is `view=compare`.

## Layout

One column per site. The column header is the site's name (a button), its terrain tier and
its coordinates. Rows, top to bottom:

| Row | Content |
| :--- | :--- |
| Status | GO, CAUTION or NO-GO, with the score. A NO-GO site's score is struck through and marked "not used" |
| Broken rule | Each triggered veto with its measured value and limit, or "None" |
| Sunlight | `sun_fraction_mean` and `lit_fraction`, as numbers and bars |
| Longest dark stretch | Hours, against the profile's limit |
| Earth link | `link_fraction`, as a number and a bar |
| Longest blackout | Hours, against the profile's limit |
| Sun at landing | Elevation, and whether it is lit |
| Slope | Degrees, with its baseline and source |
| Timeline | The mission window's Sun and Earth bands, small |
| Skyline | A small Lander's eye strip |
| Nearby dates | The site's Slip Planner strip for 60 days either side of the landing date |

The prototype draws the first eight rows. The last three come from the earlier spec and
are kept.

- The best value in each row is marked "best". For hours of darkness and slope, lower is
  best. A tie marks every tied site.
- **The deciding row is raised:** the row whose values differ most between sites, among
  the rows where a site breaks a rule, is highlighted and labelled "decides between them".
- Bars in a row share one scale.
- The values are the Python-computed series scored in the browser. The scene's shading and
  shadows play no part.

### Sites with a note

The site row carries the same notes as the sites rail and the focused-site panel
([`mission-control.md`](mission-control.md)):

- **A sunlit-peak site** shows its **nearby range** beside its own six-year average
  sunlight in the Sunlight row: the lowest and highest six-year average sunlight within
  160 m of the listed point
  ([`../decisions/0012`](../decisions/0012-sunlit-peaks-keep-their-listed-point.md)). The
  range is not part of "best": it is context.
- **A best-lit variant** (`<id>_best_lit`) can be a column. Its header carries "chosen by
  TrueSouth" and its distance from the listed point, never a source tag, and its sunlight
  is marked an **upper reading**. Proposed: a best-lit variant is never given the "best" mark in
  the Sunlight row. Reason: it is chosen to be the highest of our own estimates, so it
  would win by construction.
- **An Artemis candidate entry** says "Centre of NASA's close-up map, not a chosen landing
  point" under its name.

## Interaction

- Choose which of the selected sites to show. The first four are shown by default.
- Click a column header's name to focus that site. The camera does not move.
- Click a "Nearby dates" cell to change the landing date for all columns.
- "Export CSV" saves the table. See [`share-export.md`](share-export.md).

## A sentence that sums it up

In the window's header, one generated sentence states the result plainly:

> For IM-2 Athena landing 14 March 2028, Mons Mouton is the only GO site. Connecting Ridge
> fails on a 31-hour blackout.

It is built from the statuses and vetoes, with no AI model.

## States

- **Fewer than two sites selected.** Proposed: the table shows what there is, with a line
  saying Compare needs two or more sites. Reason: one column compares nothing.
- **A sphere-tier site:** its Slope row says "Slope not assessed: terrain not modelled",
  and its Skyline strip is flat.

## Done when

- Every number equals the focused-site panel's number for the same site.
- "Best" marks are correct for a fixture set of four sites, including a tie.
- The summary sentence is correct for fixtures with zero, one and several GO sites.
- The table reads correctly at 1,120 pixels wide (the window's width) with four columns,
  and scrolls on a phone with every control at least 44 px.
- Opening and closing the window does not move the camera, and Escape returns focus to the
  view bar button.
- A sunlit-peak site shows its nearby range, a best-lit variant is labelled as chosen by
  TrueSouth with an upper-reading note, and an Artemis candidate entry carries its map-centre
  note.
