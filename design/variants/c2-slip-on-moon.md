# Direction C2, space-first: the Slip Planner on the Moon

A design prototype, added to the approved space-first prototype. Mock data. Open
[`space-first/index.html`](space-first/index.html) over http
(`python -m http.server 5190 --bind 127.0.0.1 --directory design`) and pick **Slip Planner**
in the view bar. Add `?view=slip` to start there, `&sites=eight` or `&sites=one` for other
site sets, and `&slip=b` for variant b.

## What the view is

The Slip Planner is now a place, not a window. The camera flies to the south pole and stops
above it, tilted so the Moon curves away at the top. Each selected site is a spot on the
ground. The spot says whether a landing on the chosen date would be GO, CAUTION or NO-GO.
The bottom panel shows landing dates instead of hours: one strip per site across six years,
an "Any site" line, and a slider for the landing date. Drag the slider, or press
**Slip +7 d**, and every spot changes at once.

The view's sentence: "Your sites at the south pole, each showing whether a landing on the
date below would be GO, CAUTION or NO-GO."

## What changed from the grid, and why

| Before: the floating window | Now: the view on the Moon | Why |
| :--- | :--- | :--- |
| A window of coloured squares, one row per site | Spots on the real polar terrain | The lead asked for the Moon's surface, not rectangles. You see where each site is and what it is doing in one look. |
| The camera stayed where it was | The camera flies to the pole (1.4 s) | It is a place now. The flight shows where the sites are on the Moon. |
| A six-year overview bar, then the grid | Thin strips, one per site, plus "Any site" | Strips answer "when?" in less room. The spot answers "where, on this date?". |
| Slip card inside the window | A before-and-after line over the scene, "was CAUTION" on each changed spot, and a dashed line at the old date | The change is shown where it happens: on the Moon. |
| NO-GO hatched | NO-GO is a low red line; CAUTION half height; GO full height | Strips are 12 to 18 px tall. Hatching cannot be seen at that size. Height still says the status without colour. |

**Honesty.** Results exist at the sites only. The ground between sites is never coloured by
date. The ground's light is a fixed drawing light, not the real Sun on that date, so it
cannot be read as a result. The optional shading is NASA's average sunlight, labelled "NASA's
average sunlight over 18.6 years, not for your date".

## The two variants

Both are in **Design options → Slip Planner spots**. A third button, **Earlier design**,
brings back the floating window of squares for comparison.

**a. Lamp and ring (recommended).** The approved flat status lamp (colour plus glyph) sits
on a dark disc. A thin ring around it fills to the score, out of 100. A NO-GO site shows
an empty ring, because its score is not used. The focused site gets an outer Moonlight
ring, with a gap, so it is not read as a full score.

**b. Lit patch.** A soft patch of status colour lies on the ground, foreshortened like a
circle on the terrain. Its brightness shows the score. A small dark core carries the glyph.

**Recommendation: a.**
- The score can be read: a ring's length can be compared between spots, and brightness cannot.
- A patch has an area, so it hints that the ground around the site has a result. It does not.
- Patches fight the average-sunlight shading, which is also bright and dark.
- A soft glow sits close to what the No Glow Rule bans, even on the scene.
- a reuses the approved lamp, so the spot, the sites panel and the strips look like one family.

Variant b is the more literal reading of "bright and dark spots". It is worth seeing on the
Moon before it is ruled out.

## How the slider, the strips and the main timeline relate

There is one bottom panel, and it changes scale with the view.

- **In the Slip Planner** it shows **landing dates**: days over six years. The landing date
  is a Moonlight line, knob and pill, like the scrubber. The 10-day mission window is a pale
  band after it.
- **In every other view** it shows the **hours** of one mission window, as approved.
- Both have the same header shape: a title, then "Mission window 01 Mar → 11 Mar". So the
  panel reads as one timeline at two zooms, not two timelines.
- **Why not both at once?** Two Moonlight sliders at different scales, one above the other,
  look like two clocks that disagree. At 900 px tall they also leave the Moon about 300 px.
  **Design options → Hours timeline in the Slip Planner → Folded below** shows that
  arrangement, so the lead can judge it.
- The fold button works the same way: folded, the panel keeps one row.

Controls:

- **Mouse.** Drag anywhere on the strips to move the date. A click also focuses that row's
  site. Scroll to pan at 3 or 18 months.
- **Keyboard.** The slider takes ← and → (one day), Shift for a week, Page Up and Page Down
  for 30 days, and Home and End. Each strip is a Tab stop. Its arrows move a reading point
  and show a readout of the status and why. Enter lands on that date.
- **Zoom.** 3 months, 18 months (the default) or 6 years. The visible range follows the
  slider.
- **The right-hand column** says "GO on this date", "next GO 22 Mar" or "no GO before 2032".

**Before and after.** The first change of date is remembered. After it:

- A plate says: "Slipped +21 d, 01 Mar → 22 Mar 2028. 4 of 5 sites changed. Best now: Mons
  Mouton, GO, score 99 (was Malapert Massif)." Its cross clears the comparison.
- Every changed spot adds "was CAUTION" (lamp and word).
- The strips show a dashed line labelled "was 01 Mar".
- The best site on the date carries "best".

The three-week demo changes every polar site: Connecting Ridge NO-GO → GO, Malapert
Massif GO → CAUTION, Mons Mouton CAUTION → GO, and de Gerlache Rim 2 CAUTION → NO-GO.

## Close sites and the best-lit variant

At this zoom, Connecting Ridge and Shackleton rim are about 30 px apart. The best-lit
variant is 149 m from Connecting Ridge, which is under one pixel.

- **Spots never overlap.** A spot closer than 28 px to a more important one steps aside
  (34 to 58 px; 40 px or more for the variant). A hairline and a small dot mark its true
  place. The variant's dot sits under Connecting Ridge's spot, which is the truth.
- **Priority:** the focused site, then the best site, then changed sites, then listed sites,
  then variants.
- **Labels never overlap.** Each label tries right, left, below and above. If none is free,
  it moves out as a callout with a hairline back to its spot. Only when no callout fits does
  a site show its lamp alone, with its name on hover. In testing with eight sites, every
  site kept its name.
- **Label text.** By default a label shows only the name. The status word and the reason
  are added for the focused, best and changed sites. The lamp carries the status for the
  others (colour plus glyph).
- **The variant.** Its label says "Best-lit variant, 149 m from Connecting Ridge" with a
  dotted "chosen by TrueSouth" tag. The sites panel, the strip row and the focused-site
  panel say the same. The focused-site panel adds "Its sunlight is an upper reading".
- **Apollo 11** is near the equator, about 2,700 km away. A note in the top left of the free
  space says "Apollo 11 NO-GO, near the equator, far off this view". Clicking it focuses
  the site, and its strip is in the panel as usual. (The Polar map has no such note yet. It
  could use the same one.)

## Mock data: one function

`detail(site, landing date)` in `js/data.js` is the only source of a status. The spots, the
strips, the hover readout, the sites panel, the focused-site panel and the earlier grid all
read it.

- A Web Worker (`js/sweep.js`) runs the same function for every day of the six years.
  Visible days come first. It takes about 3 s for five sites. Until then, the days not yet
  worked out pulse grey, and a thin bar along the panel's top edge shows the progress.
- To make that possible, the skyline is now read from a table every 0.01°, and the Sun's
  disc fraction skips its 33 chords when the whole disc is clearly above or below the
  skyline. The results are the same as before: 0 changed statuses in 120 days × 4 sites, and
  0 flips in 20,000 sampled hours. A day now takes 0.17 ms instead of 2.2 ms.
- **Checked:** at 10 dates from 2026 to 2031, for all 8 sites, the spot, the strip's lamp,
  the store and the focused-site panel agree: 80 of 80.
- **New mock sites:** Shackleton rim, de Gerlache rim and Connecting Ridge's best-lit
  variant, with their catalog coordinates. The variant's point is 149 m from the listed
  point; the direction is invented. The variant borrows Connecting Ridge's terrain patch.
  Shackleton rim and de Gerlache rim have no patch in this prototype. Local terrain says so
  and shows them on the globe.

## Motion

- **Entering:** one camera flight of 1.4 s with ease-in-out. In its last 70 %, the Moon's
  light blends from the real Sun to the fixed drawing light. Earth, the Sun and the
  sight-lines fade out halfway.
- **Leaving:** the light blends back in the first 60 % of the next flight.
- **Changing the date:** spots and strips change at once, with no animation. The change
  itself is the moment, and it has to keep up with a drag.
- **Changing the site set or folding a panel:** the camera refits in 450 to 600 ms.
- **While working:** the days not yet worked out pulse slowly between 35 % and 80 %.
- **Reduce motion:** the flight becomes the approved 120 ms dip through Night and a cut.
  The pulse and the panel transitions stop.

## The phone (390 × 844)

- The view bar scrolls. The sentence sits under it.
- The Moon gets about 210 px between the sentence and the controls. Spots are 44 px touch
  targets. Labels stay inside the screen.
- The controls row wraps to two lines and keeps the "not for your date" wording.
- The focused site is the approved one-line sheet.
- The landing-date panel fills the bottom:
  - The 3-month zoom is the default on the phone. Its three buttons are 44 px tall.
  - Row names are cut to 100 px. The "next GO" column is hidden.
  - The whole strip area is one touch target: drag to move the date, tap a row to focus its
    site. So the strips leave the tab order on the phone, and the slider knob is the
    keyboard path.
- Every control is at least 44 px. There is no horizontal scroll.
- See [`slip-moon-phone.png`](../../docs/design/c2/slip-moon-phone.png).

## When 3D is off

The Slip Planner does not need WebGL. With no WebGL, or with **Design options → Show a state
→ Still image**, the same spots sit on the flat Polar map:

- The map is dimmed, with NASA's average sunlight in Sun cream.
- Crater names are hidden, so they do not collide with the labels.
- The same slider, strips, before-and-after and panels all work.
- A note says: "3D is off, so your sites are shown on the flat Polar map. The spots, the
  landing dates and the panels work as in 3D."

This replaces the still picture for this view only.

## Components and tokens for the developers

No existing token changes. Proposed new tokens:

| Token | Value | Use |
| :--- | :--- | :--- |
| `--dt-h` | `14px` (12 px with 7–8 sites, 18 px with one) | Strip height |
| `--dt-g` | `7px` (5 px with 7–8 sites) | Gap between strips |
| `--spot-r` | `15px` | Spot radius, used to place labels |
| Tag "chosen by TrueSouth" | 1 px dotted Ink 3 outline | The best-lit variant's provenance. Dashed already means "assumed". |

Components:

- **Spot, variant a:**
  - an SVG of 32 px (44 px on the phone);
  - a Night disc at 85 %, radius 13.5;
  - a score track in Control Edge, radius 12, 2 px;
  - a score arc in Ink: its length is the score, and it is absent for NO-GO;
  - the status disc, radius 8, with the Night cut glyph;
  - when focused, an outer Moonlight ring at radius 17.5 over a Night disc of 18.6.
  
  It is a button with `data-site`, out of the tab order like the pins. The sites panel and
  the strips are the keyboard paths.
- **Spot, variant b:** a status-coloured ellipse, made from the projected east and north
  directions at the site, blurred 7 px, with screen blend. Its opacity is 0.15 + 0.55 ×
  score / 100 (0.22 for NO-GO). The core is Night at 88 %, with the glyph in the status
  colour.
- **Spot label:** the approved plate. Line one is the name, plus the status word when it is
  loud. Small lines carry the reason, "was …" and the variant's distance and tag. Labels
  are placed right, left, below, above, or as a callout with a hairline (Ink 2 over a Night
  under-stroke).
- **Landing-date panel:** the timeline's slot and panel style, sized to its content.
  - **Header:** "Landing dates", the mission window, a one-line key, the zoom control and
    the fold button. A 2 px progress bar runs along the top while the sweep runs.
  - **Grid:** label (208 px) | strips | "next GO" (136 px).
  - **Strip:** `--plot` background. GO is full height, CAUTION half height, NO-GO a 2.4 px
    red line at 80 %, no data a 1 px Ink 4 line.
  - **Over the strips:** the slider (Moonlight line and pill), the mission-window band
    (Moonlight at 14 %, with Ink 3 edges), the "was" line (dashed Ink 2) and the reading
    point (a 1.5 px Ink outline).
- **Slip summary:** a plate at the foot of the free space, shown only after a slip.
- **Off-view note:** a plate with a lamp, for sphere-tier sites.
- **Scene mode `slip`:**
  - The Moon is lit by a fixed light from the view's top left, 55° up, at half strength.
  - NASA's average sunlight is drawn inside the 80°S circle as `mix(grey, Sun cream, av)`
    times the relief.
  - Earth, the Sun, the guides and the sight-lines are hidden.
  - Drag orbits around the sites' centre, 28° to 88° up. Scroll zooms from 60 km to 2,600 km.
- **Camera fit:**
  - It centres on the middle of the polar sites' bounding box.
  - It stands on the pole's side, 30° up, and aims 0.2 of the free space's height above the
    sites so the curve shows.
  - It searches for the distance at which every site, plus 16 km around it (70 km for one
    or two sites), fits the free space with 90 px left and right for labels.

## Proposed spec changes (not made here)

`docs/features/slip-planner.md` describes the floating window. If the lead picks this view:

- **The Slip Planner is a camera view,** between the Polar map and Local terrain. Opening it
  flies the camera. The view address `view=slip` opens it.
- **The heatmap becomes per-site strips plus "Any site".** NO-GO is a low line, not
  hatching. The legend sits in the panel header.
- **The bottom panel shows landing dates in this view** and hours elsewhere.
- **Before and after** becomes the summary plate, the "was" labels and the "was" line.
- **New "Done when" items:**
  - The spot, the strip, the hover and the panel agree for every date.
  - No colour appears on the ground between sites.
  - The fallback uses the flat map.
- **CONTEXT.md** would need **Spot** (a site's mark in the Slip Planner) and
  **Landing-date panel**. It would change **Slip Planner** from "the heatmap of sites
  against landing dates" to "the view of sites and landing dates".
- **Decision 0013** would move the Slip Planner from "floating window" to "camera view".
- **DESIGN.md** would add the spot and the landing-date panel to Components. The No Glow
  Rule is unchanged if variant a is picked.

## Decisions I was unsure about

- **A fixed drawing light, not the real Sun.** It is honest, because the ground never
  changes with the date. But the pole then looks lit at an angle it never is. The
  alternative, the real Sun on the landing date, makes the ground flicker as you drag, and
  it reads as a result.
- **The average-sunlight shading is on by default.** It is the lead's "bright and dark". It
  is context only, and switchable off. Off is calmer.
- **The bottom panel swaps** rather than stacking. The stacked option is there to judge.
- **The 8-site cluster is tight.** Every site keeps its name through callouts, but five
  labels share about 250 × 150 px. Scrolling zooms in. A real build could zoom on the
  cluster by default when sites crowd.
- **"was 01 Mar" sits on the axis.** At 3 months it can overlap a month label.
- **"de Gerlache rim" and "de Gerlache Rim 2"** keep the catalog's spellings, though they
  look inconsistent side by side.
- **The phone hides the "next GO" column** and drops the strips from the tab order.

## Review: what the detector and the critique found, and what changed

**The impeccable detector:**
- Off-scale corner radii (1, 2 and 3 px). Fixed: strips and the reading point use
  `--r-sm`; the band, the slider line and the key have no rounding.
- Cramped padding in the app bar blocks, and tight leading on one-line display numbers.
  Both were already in the approved prototype. Not changed here.

**The isolated critique, and what I did:**

| Finding | What changed |
| :--- | :--- |
| The focus ring looked like a full score ring on a NO-GO site | The focus ring is now outside the score ring, with a dark gap. NO-GO draws no arc. |
| The strips had no key | A one-line key is in the panel header: GO full, CAUTION half, NO-GO a low line. |
| The spec still describes the window | Listed above as proposed spec changes, to make if this is picked. |
| The phone cut labels at the edge and showed 18 months in 230 px | Labels are measured while shown and kept inside the screen. The phone opens at 3 months. |
| Four plates of text over the scene | The "drag the date" hint is gone. The summary appears only after a slip. |
| Status shown on every label | Labels show the name only. The status word is shown for the focused, best and changed sites. |
| Scores carry no provenance | The ring's key carries an "assumed weights" tag. |
| An unfinished progress sentence, and "…" in a summary | Now a 2 px bar along the panel's top. Unknown summaries are blank until known. |
| The fallback map was a boxed rectangle, and crater names collided | The map fills the free width. Crater names are hidden in this view. |
| The header repeated "10 d sourced" | Removed. The app bar has it. |
| The mission-window band was faint | It has Ink 3 edges. |
| The best-lit row lost "chosen by TrueSouth" | The tag is back in the row. |
| The variant b legend overflowed | Shortened. |
| The phone footer overlapped the honesty line | Checked: they do not overlap at 390 × 844. |
| The Apollo 11 note floats | Kept. The brief asks to say where it goes. It now sits below the sentence and the fallback note. |
| The list cuts off with no sign that it scrolls | Not changed. The sites panel is the approved component, and it shows its scrollbar. |

## Checks

| Check | Result |
| :--- | :--- |
| Console errors | None, over every view, Compare, the three spot options, three site sets, the fallback and the phone. |
| Horizontal scroll | None at 1440 × 900 or 390 × 844. |
| Phone controls | Every visible, clickable control is at least 44 × 44 px. |
| Purple, indigo, violet | None added. The only new colour value is Night (`#0b0b0c`). |
| Capitals | None added, apart from GO, CAUTION, NO-GO and UTC. No uppercase transforms or letter-spacing. |
| Keyboard | The slider: → +1 day, Shift+→ +7, ← −1. On a strip, arrows move the readout and Enter lands. 41 Tab stops, all named. |
| Status never colour alone | Spots carry a glyph. Strips use height. Labels and the panels carry words. |
| Agreement | 80 of 80 site-date pairs agree across the spot, the strip, the store and the panel. |
| Graphics | Captured on the GPU: ANGLE, NVIDIA RTX 2060, Direct3D 11. The 3D did not fall back. |

Screenshots, in [`docs/design/c2/`](../../docs/design/c2/):
- `slip-moon-a.png` and `slip-moon-b.png`: the two variants.
- `slip-moon-after-slip.png`: three weeks later.
- `slip-moon-8-sites.png` and `slip-moon-1-site.png`: the largest and smallest site sets.
- `slip-moon-zoom-3-months.png`: the 3-month zoom.
- `slip-moon-phone.png`: the phone.
- `slip-moon-fallback.png`: 3D off.
- `slip-moon-earlier-grid.png`: the earlier design, for comparison.
- `flow-mission-control-space.png`: the updated flow.
