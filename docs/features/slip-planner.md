# Slip Planner

The view of sites and landing dates. Your selected sites sit on the Moon as **spots**, and a
panel of **landing dates** sits below. It answers "the launch slipped; is this site still
good, and if not, when or where is?"

Owner: Mission Control track. Folder: `web/src/features/mission-control/slip-planner/`. The
camera flight, the fixed light and the shading are part of the scene (work package T1,
3D and Map track); the spots and the panel are Mission Control's.
Math: [`../science.md`](../science.md) §9–11.
Layout, the view bar and the camera views: [`mission-control.md`](mission-control.md).
Design: [`../../design/variants/c2-slip-on-moon.md`](../../design/variants/c2-slip-on-moon.md),
picked by the team lead on 2026-11-13
([`../decisions/0013`](../decisions/0013-space-first-mission-control.md)). It is a working
prototype with mock data. Screenshots are in `docs/design/c2/slip-moon-*.png`.

## A camera view

The Slip Planner is a place, so it is a **camera view**. It sits in the view bar between the
Polar map and Local terrain.

- **Opening.** Pick it in the view bar. The camera flies to a stop above the south pole,
  tilted so the Moon curves away at the top. The flight takes 1.4 s, with ease-in-out.
- **The address** in the shareable link is `view=slip`. It restores this view.
- **The view's sentence** (in the tab's "About" tip and its accessible description, not on screen): "Your sites at the south pole, each showing whether a landing on
  the date below would be GO, CAUTION or NO-GO."
- **The camera fit.** The camera centres on the middle of the polar sites' bounding box,
  stands on the pole's side 30° up, and aims a little above the sites so the curve shows.
  It picks the distance at which every site, with 16 km of ground around it (70 km for one
  or two sites), fits the free space with room at the sides for labels. Changing the site
  set, or folding a panel, refits the camera in 450 to 600 ms.
- **Orbit and zoom.** Drag orbits around the sites' centre, from 28° to 88° up. Scroll zooms
  from 60 km to 2,600 km, along the line to that centre, keeping the aim: not toward the
  pointer, which would move the aim off the centre the orbit turns about. There is no pan
  (a right-drag, Shift-drag or two-finger drag turns as a drag does), so the sites never
  leave the view. A double-click frames the sites again. This is the view's entry in the
  rig's per-view table (`ORBIT_STYLE.slip = "centre"`, `three/scene/rig.ts`), and its About
  text says so.
- **The scene in this view.** Earth, the Sun, the guide lines, the sight-lines and the
  focused site's close-up ground are hidden. The Moon's light is a fixed drawing light, not
  the real Sun (see "Honesty").
- **Leaving.** The light blends back to the real Sun in the first 60 % of the next flight.
- **Sites outside the view.** A site far from the pole, such as Apollo 11 near the equator, is
  not in the picture. "Far" means a sphere-tier site or one north of 80°S (the polar cap's
  edge); the camera fit uses only the others. A note in the free space says so, for example "Apollo 11 NO-GO, near
  the equator, far off this view". Clicking it focuses the site, and its strip is in the
  landing-date panel as usual.

### What was rejected

- **The floating window of squares.** A table of coloured rectangles. The team lead asked for
  the Moon's surface, not rectangles: on the Moon you see where each site is and what it is
  doing in one look.
- **The lit patch** (variant b). A soft patch of colour on the ground. A patch has an area,
  so it hints that the ground around the site has a result, and it does not. It also fights
  the shading of NASA's average sunlight, and a soft glow sits close to what the No Glow Rule
  bans.

## Spots

Each selected site is a **spot** on the ground. Results exist at the sites only.

- **Lamp and ring.** The flat status lamp (colour plus glyph) sits on a dark disc. A thin ring
  around it fills to the site's score out of 100. A NO-GO site shows an empty ring, because
  its score is not used.
- **The focused site** has an outer ring with a gap between it and the score ring, so it
  cannot be read as a full score.
- **Size.** 32 px; 44 px on a phone. It is a button with `data-site`.
- **Labels.** A label shows the site's name. For the focused site, the best site on the date
  and any site whose status changed, it adds the status word and the reason. For the others,
  the lamp carries the status.
- **Best site.** After a slip, the site with the best result on the date is marked "best".
- **Provenance.** The ring's key carries an "assumed weights" tag, because the score's
  weights are assumed ([`../mission-profiles.md`](../mission-profiles.md)).

### Close sites and the best-lit variant

Sites can sit closer together than a spot is wide. At this zoom Connecting Ridge and
Shackleton rim are about 30 px apart, and Connecting Ridge's best-lit variant is 149 m from
it, which is under one pixel
([`../decisions/0012`](../decisions/0012-sunlit-peaks-keep-their-listed-point.md)).

- **Spots never overlap.** A spot closer than 28 px to a more important one steps aside. A
  hairline and a small dot mark its true place. The variant's dot sits under Connecting
  Ridge's spot, which is the truth.
- **Priority:** the focused site, then the best site, then changed sites, then listed sites,
  then variants.
- **Labels never overlap.** Each label tries right, left, below and above. If none is free,
  it moves out as a callout with a hairline back to its spot. Only when no callout fits does
  a site show its lamp alone, with its name on hover.
- **The best-lit variant** keeps its own spot. Its label says "Best-lit map pixel, 149 m from
  Connecting Ridge" (the Polar map's words; the distance is the catalog's `offset_m`) with a
  dotted "chosen by TrueSouth" tag. The sites rail, its strip row and
  the focused-site panel say the same. The focused-site panel adds "Its sunlight is an upper
  reading".

## The landing-date panel

The bottom panel **swaps** in this view. It shows landing dates instead of hours, in the
timeline's own slot and style, sized to its content. In every other view it shows the hours
of one mission window, as the timeline does today. The two never stack: two sliders at
different scales, one above the other, read as two clocks that disagree.

```text
⌄  Landing date ‹ 01 Mar 2028 00:00 › → 11 Mar · 10 d  Next GO   ● GO full · ◐ CAUTION half · ▁ NO-GO low   3 mo · 18 mo · 6 yr
                     2028 Jan        Feb         Mar         Apr   …
Any site           ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔   GO on this date
Connecting Ridge   ▁▁▄▄▄▄▁▁▁▁▁▁▁▁▁▁▄▄▄▄▄▁▁▁▁▁▁▁▁▁▄▄▄▄▁▁▁▁▁▁▁▁▁            next GO 14 Mar
Mons Mouton        ▔▔▔▔▔▔▔▔▁▁▁▁▔▔▔▔▔▔▔▔▔▁▁▁▔▔▔▔▔▔▔▔▔▔▁▁▁▔▔▔▔▔▔            GO on this date
de Gerlache rim    ▁▁▁▁▄▄▁▁▁▁▁▁▁▁▁▁▁▄▄▁▁▁▁▁▁▁▁▁▁▁▄▄▄▁▁▁▁▁▁▁▁▁▁            next GO 16 Mar
                                 ┃ landing date, with the mission window as a pale band after it
```

The sketch shows the parts, not the final drawing. The header and the grid are as follows.

- **Header.** One row: the fold button; the shell's landing-date control
  (`LandingDateControl`, the same control as at the head of the timeline: the date with its
  day buttons, a picker that also holds the slips, the mission window's end and length with
  its tag, and "Next GO"); a one-line key; the zoom control. "Landing dates" is the panel's
  heading for screen readers, as "Timeline" is in the timeline. A 2 px progress bar runs
  along the top while the sweep runs. On the phone the control takes its own row.
- **Grid.** A label column, the strips, and a "next GO" column.
- **One strip per selected site,** across the six years of the time grid, with one mark per
  landing day. Status shows by height as well as colour:
  - GO: full height;
  - CAUTION: half height;
  - NO-GO: a low line;
  - no data, where the mission window runs past the end of the time grid: a 1 px faint line.
  No hatching: a strip is 12 to 18 px tall, and hatching cannot be seen at that size.
- **"Any site"** is one more line above the strips. Its mark on a day is the best status among
  the selected sites that day. It answers "is there anywhere to land on this date?".
- **The key** is the legend. It sits in the panel header, one line, so no other legend is
  needed: "GO full, CAUTION half, NO-GO a low line", with the lamps.
- **The right-hand column** says "GO on this date", "next GO 22 Mar" or "no GO before
  2032", for each site. It reads the first 00:00 UTC landing at or after the landing: the
  landing day itself when the landing is at 00:00, else the next day. A site with no later
  GO says so in words. The control's "Next GO" button looks only after the landing day, so
  when that day is GO and no later one is, the button reads "No later GO before 2032"
  beside "GO on this date"; both are true.
- **The slider** is a Moonlight line, knob and pill across the strips, like the scrubber. It
  sets the landing date. The mission window is a pale band after it, with edges.
- **The slip buttons** ("Slip +7 d", "+14 d") are in the landing-date control's date
  picker, and its day buttons move the date a day at a time (see
  [`mission-control.md`](mission-control.md)). They move the same landing date, so the
  slider, the spots and the strips follow at once.
- **Zoom.** 3 months, 18 months (the default; 3 months on a phone) or 6 years, the whole time
  grid. The visible range follows the slider. Scroll pans at 3 and 18 months.
- **Fold.** The fold button keeps one row, as the timeline does.

### Before and after a slip

The first change of date is remembered. After it:

- **A summary line** on a plate over the scene: "Slipped +21 d, 01 Mar → 22 Mar 2028. 4 of 5
  sites changed. Best now: Mons Mouton, GO, score 99 (was Malapert Massif)." A cross on it
  clears the comparison. The line is shown only after a slip.
- **A "was …" label** on each spot whose status changed, with the old lamp and word: "was
  CAUTION".
- **A dashed line** at the old date in the strips, labelled "was 01 Mar".

Before any slip, none of these are shown.

### Changing the date

- **Mouse.** Drag anywhere on the strips to move the date. A click also focuses that row's
  site.
- **Spots and strips change at once,** with no animation. The change is the moment, and it
  must keep up with a drag.
- **A click on a spot** focuses the site. It does not change the date.
- **Whole days.** Each mark on a strip is a landing at 00:00 UTC on that day
  ([`../science.md`](../science.md) §11). The slider, a strip's Enter key and a drag set
  the landing to 00:00 UTC on the chosen day. The slip buttons and the date picker can
  leave another hour. Then the spots, the sites rail, the focused-site panel, the row
  lamps, the folded row and the slider's words show that exact landing; the slider sits on
  its day; and "Strips show landings at 00:00 UTC" is shown in the header, the folded row
  and on the phone, and read with the slider's value. No sentence pins a 00:00 result on a
  landing at another hour: the strips' hovers name their 00:00 UTC day, and "next GO"
  starts from the next 00:00 UTC landing.

## Hover and focus

- **Hover a strip:** a readout with the date, the status, the score and each broken veto with
  its measured value and limit, for that site; when every rule passes it says so. The words
  name the status.
- **Hover a spot:** the site's name, status, score and the broken rule, for the landing date.
- **Focus.** Clicking a spot, a strip row or a site in the sites rail focuses it. The focused
  site gets the outer ring on its spot, and the focused-site panel shows it.

## Keyboard use

- **The slider** takes ← and → (one day), Shift with an arrow (one week), Page Up and Page
  Down (30 days), and Home and End (the ends of the time grid, limited by the mission
  duration).
- **Each strip is a Tab stop.** Its arrows move a reading point along the strip and show a
  readout of the status and why. Enter lands on that date.
- **Spots are not in the tab order,** like the pins. The sites rail and the strips are the
  keyboard paths to every site.
- **Every control has an accessible name.** Status is never colour alone.

## Honesty

- **Results exist at the sites only.** The ground between sites is never coloured by date or
  by status.
- **The ground's light is fixed.** It is a drawing light from the view's top left, 55° up, at
  half strength, never the real Sun on the chosen date. So the ground does not change as the
  date moves and cannot be read as a result.
- **The shading can be switched off.** It shades the ground from dark to bright by NASA's
  average sunlight inside the 80°S circle. It is on when the view first opens, because it
  is the "bright and dark" the team lead asked for; a switch in the view's controls turns
  it off. It carries this label whenever it is on: "NASA's average sunlight over 18.6
  years, not for your date". It is context, never a result.
- **Shadows and shading in the scene never decide a result.** Statuses come from the sweep.

## How it is computed

- The numbers are the existing slip sweep. A Web Worker runs it for every selected site
  whenever the profile or the site list changes. The worker is built (work package MC7a) and
  its results come through the `useSweeps` hook in `web/src/lib/scoring/`. The formulas are
  in [`../science.md`](../science.md) §9–11; this page repeats none of them. Where the
  sweep runs, and why: [`../decisions/0002-scoring-in-browser.md`](../decisions/0002-scoring-in-browser.md).
- Results are typed arrays, one entry per day: status, score, and a bit mask of vetoes.
- Moving the slider or pressing a slip button does not run the sweep again. It reads another
  entry of the same arrays.
- The strips are drawn on a Canvas. The spots are SVG over the scene.
- The sweep reads the Python-computed series and the mission profile. The scene's shading
  plays no part, and neither does the fixed drawing light.
- The spot, the strip, the hover readout, the sites rail and the focused-site panel cannot
  disagree. Every status, rule and score a user reads for a site and a landing hour comes
  from one function, the sites rail's single-date evaluation (`cachedEvaluation`, through
  `slip-planner/landing-results.ts`). The sweep draws the strips and finds "next GO"; its
  statuses equal that evaluation on every 00:00 UTC day (tested), and its packed score is
  never shown. The earlier prototype's grid came from a
  separate cheap mock and could disagree with its own hover; the real build must not.

## States

- **Computing.** A thin progress bar runs along the top of the panel. A site whose sweep is
  still running for the current profile and site list pulses grey (35 % to 80 %; under
  "reduce motion" the pulse stops), its words say "Still computing this site" and its
  "next GO" says "computing…". The previous profile's picture is never shown in its place.
  The spots do not wait for the sweep: they read the same single-date evaluation as the
  sites rail, so a spot always equals the rail.
- **"Any site" while computing.** It is GO on a day as soon as any site is known to be GO
  that day; its hover then says "GO: <site>. <n> more still computing." CAUTION, NO-GO and
  "no GO before 2032" are stated only once every site is known; until then the mark pulses
  and the words say how many are computing. Its "next GO" is final only when no earlier day
  is still being worked out.
- **A site that could not be computed.** Its strip says "Could not compute this site." with
  "Retry". "Any site" is worked out from the others, its label says "1 site missing", and
  its hover names the missing site.
- **Dates near the end of the time grid** whose mission window does not fit are drawn as "no
  data".
- **One site.** The strip is taller (18 px) and the camera frames the site with 70 km around
  it.
- **Many sites.** With seven or eight sites, strips are 12 px tall with a 5 px gap. Spots and
  labels follow the close-sites rules.
- **No site selected.** The panel and the scene show a prompt to add one, and the panel's
  "Open the Polar map" opens it, as in [`mission-control.md`](mission-control.md). The view
  does not switch by itself.
- **Every date NO-GO.** A strip shows only low lines. Its right-hand column says "no GO
  before 2032". "Any site" shows no GO either. The spot of that site is a NO-GO lamp with an
  empty ring on every date.
- **Sphere-tier site.** Computed normally, with a "terrain not modelled" note on its row. Its
  off-view note is a plate with a lamp.
- **No WebGL, or the scene is slow.** See "When 3D is off".

## Reduced motion

With "reduce motion" on, the flight into the view becomes a 120 ms dip through Night and a
cut, as for every other camera view. The pulse and the panel transitions stop. Changing the
date never animates in any case.

## The phone

At 390 × 844:

- The view bar scrolls sideways; nothing sits under it.
- The Moon gets the room between the view bar and the controls. Spots are 44 px touch
  targets. Labels are measured while shown and kept inside the screen.
- The controls row wraps to two lines and keeps the "not for your date" wording.
- The focused site is the one-line sheet.
- The landing-date panel fills the bottom. Its zoom defaults to 3 months, and its buttons are
  44 px tall. Row names are cut to 100 px, and the "next GO" column is hidden.
- The whole strip area is one touch target: drag to move the date, tap a row to focus its
  site. So the strips leave the tab order on the phone, and the slider knob is the keyboard
  path.
- Every control is at least 44 px. There is no horizontal scroll.

## When 3D is off

The Slip Planner does not need WebGL. With no WebGL, or when the first flight is too slow,
the view uses the flat Polar map with the same spots.

- The map is the Polar map's own (`MapCore`, features/polar-map/) with no pins of its own
  (the spots are the Slip Planner's, placed through the map's projector) and none of its
  readouts (no "New site here?", no nudge, no hover readout: its `readouts` prop is off).
  NASA's average sunlight, when the shading is on, is its "sunlight" overlay, with the same
  label. Its zoom and drag move the map, and the spots follow.
- Crater names are hidden, so they do not collide with the labels.
- The same slider, strips, before-and-after and panels all work, and the bottom panel is
  unchanged: it still shows landing dates.
- A note says: "3D is off, so your sites are shown on the flat Polar map. The spots, the
  landing dates and the panels work as in 3D."

This replaces the still picture for this view only: the Slip Planner is a flat layer of the
scene slot (`SLIP_PLANNER_LAYER`, the same mechanism as the Polar map's `POLAR_MAP_LAYER`), so
the shell counts its view as drawable flat.

## Done when

- The spot, the strip, the hover text and the sites panel agree for every landing at 00:00
  UTC. A test sweeps every selected fixture site and a spread of dates and compares all
  four.
- With a landing at another hour, the spot equals the sites rail, and the "Strips show
  landings at 00:00 UTC" note shows open, folded and on the phone, and is read with the
  slider's value.
- Eight sites with a 100-day profile recompute in under 200 ms on a mid-range laptop.
- Results equal the focused-site panel's result for the same site and date.
- No colour appears on the ground between sites, on any date and with the shading on or off.
- The ground's light does not change with the landing date.
- The shading carries its label, "NASA's average sunlight over 18.6 years, not for your date",
  whenever it is on.
- With 3D off, the view uses the flat Polar map with the same spots, and the bottom panel is
  unchanged.
- Every status is readable without colour: the spot has a glyph, the strip has height, and
  the labels, the readouts and the panels carry words.
- The summary line, the "was …" labels and the dashed "was" line appear only after a slip,
  and the cross clears them.
- With close sites, spots and labels never overlap, and every site keeps its name (on hover at
  worst).
- Opening the view flies the camera in 1.4 s, and `view=slip` opens it from a shared link.
- A strip's keyboard use (arrows, Enter) and the slider's keys work, and every control has an
  accessible name.
- The phone layout has no horizontal scroll, and every control is at least 44 px.
- One site, no site and every date NO-GO each show their state.
- With "reduce motion" on, the flight becomes the short dip and nothing pulses.
