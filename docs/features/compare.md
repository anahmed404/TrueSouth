# Compare

The selected sites (up to eight) side by side, for one mission profile and one landing date.

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
- **Header.** The title "Compare", its one-line explanation and a close button.
- **Body.** The summary sentence (below) with "Export CSV" and "Export JSON" beside it, then
  the table. Built in MC9: the summary sits in the body, not the header, so the header stays
  short and the sentence can wrap.
- **Closing.** Escape, or the close button. Focus returns to the view bar button.
- **Not modal.** `role="dialog"` with `aria-modal="false"`.
- **What stays visible.** The scene, the app bar, the view bar, the side panels and the
  timeline. The scrubber and the landing date keep working, and the table updates with
  them.
- The view's address in the shareable link is `view=compare`.

## Layout

One column per selected site, up to eight (the sites rail's limit). The first column (the
row names) stays fixed and the table scrolls sideways inside the window. The column header
is the site's name (a button), its coordinates to two decimals (four in its title and for
screen readers), its terrain tier and its note tags. Rows, top to bottom:

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
| Open in NASA's maps | "Quickmap" and "Moon Trek" links, each opening at the site in a new tab ([`share-export.md`](share-export.md)) |

Deferred from MC9 (in the earlier spec, not in the prototype): a small Timeline row, a
Skyline strip and a Nearby dates strip. Each draws a site's whole series per column; they
can come back as a later work package.

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
  is marked an **upper reading**. A best-lit variant is never given the "best" mark in the
  Sunlight row, because it is chosen to be the highest of our own estimates and would win by
  construction (built in MC9). When one is in the table, the footer says so in one sentence.
  The wording and the range's rounding (low end down, high end up) follow the sites rail's
  (`app/mission/site-labels.ts`, #92).
- **An Artemis candidate entry** carries a "map centre" tag under its name; its tip, and its
  screen-reader text, say "Centre of NASA's close-up map, not a chosen landing point".

## Interaction

- Every selected site is shown (up to eight). To compare fewer, remove sites in the sites
  rail.
- Click a column header's name to focus that site. The camera does not move.
- "Export CSV" saves the table; "Export JSON" saves the whole scenario with full-precision
  results. See [`share-export.md`](share-export.md).
- Moving the current time does not re-render the table: nothing in it depends on the time.

## A sentence that sums it up

At the top of the window's body, one generated sentence states the result plainly:

> For IM-2 Athena landing 2028-03-14 00:00 UTC, Mons Mouton is the only GO site. Connecting
> Ridge fails on a 31 h blackout (limit 12 h).

It is built from the statuses and vetoes, with no AI model. It covers no site, one site,
loading, a site that failed or has no result, every site NO-GO, CAUTION only, one GO site,
and several GO sites with a tie on the printed score. A custom profile is called "a custom
profile". A list of three or more names, any of which holds a comma ("Connecting Ridge,
best-lit point"), is split by semicolons.

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
  scrolls sideways with eight, and scrolls on a phone with every control at least 44 px.
- Moving the current time does not re-render the table.
- Opening and closing the window does not move the camera, and Escape returns focus to the
  view bar button.
- A sunlit-peak site shows its nearby range, a best-lit variant is labelled as chosen by
  TrueSouth with an upper-reading note, and an Artemis candidate entry carries its map-centre
  note.
