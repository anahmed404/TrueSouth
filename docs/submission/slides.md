# Slides: the 7-slide deck

The organisers accept either a video or a 7-slide presentation. This file is the content for
the deck. The video script is [`video-script.md`](video-script.md). Both tell the same story
and use the same numbers.

The deck is built from this file:

- [`slides/TrueSouth-slides.pptx`](slides/TrueSouth-slides.pptx): seven 16:9 slides, with the
  speaker notes below in each slide's notes.
- [`slides/TrueSouth-slides.pdf`](slides/TrueSouth-slides.pdf): the same seven slides, one per
  page.
- `slides/preview-1.png` to `slides/preview-7.png`: each slide as it looks.
- `slides/shot-*.png`: the screenshots the slides use, taken at 1600 × 900 from a production
  build of `main` at 6f9cb4e.

State checked against `origin/main` at **6f9cb4e, 2026-11-14**. Nothing is deployed, so no
slide shows a live address. Every number below is in [`proposal.md`](proposal.md),
[`project-description.md`](project-description.md), [`demo-script.md`](demo-script.md),
[`../validation.md`](../validation.md) or `data/derived/validation.json`.

## How the deck is built

- 16:9, one idea per slide, the app's dark neutral surfaces and inks, set in Jost (the app's
  typeface). Status colours appear only where a status is shown. No stock photos.
- Every picture is a real capture of the running app. Nothing AI-generated.
- Captures were taken at a 1600 × 900 window and cropped to what a judge must read.
- The slip story uses the **IM-2 Athena** mission profile and four sites (Connecting Ridge,
  Malapert Massif, Mons Mouton, de Gerlache Rim 2). The links are in
  [`demo-script.md`](demo-script.md), "Before the demo": link A (1 January 2028), link B
  (22 January) and link C (27 January).
- "A planning aid, not flight certification" appears once, on slide 6.

---

## Slide 1. TrueSouth: where and when to land

**On the slide**

- Headline: **TrueSouth**
- Line under it: Where and when can this mission land?
- Small print: Landing Went South · NASA Space Apps Cairo 2026 · Challenge: Lunar Landing Site Navigator

**Picture.** The System view as it opens at link A: the Moon, Earth beside it, and the
lines to the Sun and Earth. The sites rail and the focused-site panel are folded.
Capture: `slides/shot-1-system.png`.

**Speaker notes (about 57 words).** We are Landing Went South. We built TrueSouth for NASA's
Lunar Landing Site Navigator challenge. It answers one question for a mission planner:
where and when can this mission land? It runs on NASA's real terrain and positions, and it
has two modes: Mission Control for planners, and the Academy for anyone who wants to learn
why.

---

## Slide 2. Why the south pole is hard

**On the slide**

- Headline: **At the south pole, the Sun skims the horizon.**
- **2.10°**, the highest the Sun gets at Connecting Ridge in six years of hourly data
- Mountains block the Sun and Earth. A launch slip changes the answer.

**Picture.** Lander's eye at Connecting Ridge, link A, with the Horizon chart open: the
skyline as a 360° strip, the Sun 0.63° up and Earth 2.03° up. Capture:
`slides/shot-2-landers-eye-horizon.png`, cropped to the chart.

**Speaker notes (about 64 words).** At the Moon's south pole the Sun stays within about two
degrees of the horizon. The highest it climbs at Connecting Ridge in our data is 2.10
degrees. Earth hangs low too, and it rises and sets as the Moon wobbles. Mountains block
both. So terrain decides whether a lander has power and a radio link, and when a launch
slips, the answer changes.

---

## Slide 3. One question, three answers

**On the slide**

- Headline: **GO, CAUTION or NO-GO, with the rule that decided it.**
- 25 sites: 20 catalog sites and 5 best-lit variants, or your own coordinates
- Every limit is tagged sourced or assumed

**Picture.** The sites rail and the focused-site panel on 22 January 2028: Connecting Ridge
NO-GO, its three broken rules ("Longest blackout 119 h, limit 12 h") and their "assumed"
tags, and one status per site in the rail. Capture: `slides/shot-3-verdict-nogo.png`,
cropped to the rail and the panel.

**Speaker notes (about 65 words).** You choose a mission profile, up to eight sites and a
landing date. TrueSouth scores that date and gives one of three statuses: GO, CAUTION or
NO-GO, and it shows the rule that broke, such as a dark stretch that is too long or a radio
blackout. Every limit is tagged sourced, with a link, or assumed. We never show an assumed
number as sourced.

---

## Slide 4. A launch slip, on real data

**On the slide**

- Headline: **Same site, same mission. Three weeks later, NO-GO.**
- 1 Jan 2028: **GO**, score 100
- 22 Jan 2028: **NO-GO**: Earth out of contact 119 h (limit 12 h, assumed)
- 27 Jan 2028: **GO** again, score 99, at "Next GO"

Small print: Connecting Ridge · IM-2 Athena profile.

**Picture.** Three crops of the focused-site panel in the Slip Planner, side by side:

1. Link A, Slip Planner, landing date `2028-01-01 00:00 UTC`: GO, score 100.
   `slides/shot-4a-slip-jan01-go.png`.
2. The landing date slipped with **+14 d** and **Slip +7 d**: the plate reads "Slipped
   +21 d, 01 Jan → 22 Jan 2028. 1 of 4 sites changed. No site is GO or CAUTION on this
   date." The panel shows NO-GO with "Longest blackout 119 h, limit 12 h, assumed".
   `slides/shot-4b-slip-jan22-nogo.png`.
3. **Next GO**: the landing date reads 2028-01-27 and the note reads "Landing moved to 27 Jan
   2028, the next GO date for Connecting Ridge." GO, score 99.
   `slides/shot-4c-slip-jan27-nextgo.png`.

**Speaker notes (about 66 words).** This is real data. Connecting Ridge, on the IM-2 Athena
profile, is GO if we land on 1 January 2028. Slip the launch three weeks, to 22 January, and
it is NO-GO: Earth is out of contact for 119 hours, against a limit of 12 that we assumed.
Press Next GO and the answer is 27 January, five days later. Small date changes decide the
mission.

---

## Slide 5. Five views, one clock, and Compare

**On the slide**

- Headline: **See why a site is lit or dark.**
- Five views share one clock: System view · Polar map · Slip Planner · Local terrain ·
  Lander's eye
- **Compare**: sites side by side, or two sites at two landing dates, with the deciding row
  marked

**Picture.** Compare, large, with the five views as small captures under it, all at link C
(27 January 2028): `slides/shot-5f-compare-sites.png` (Compare, "Sites" mode),
`shot-5a-system-view.png`, `shot-5b-polar-map.png`, `shot-4c-slip-jan27-nextgo.png`,
`shot-5d-local-terrain.png` (with the close-up ground from NASA's 5 m maps) and
`shot-5e-landers-eye.png`. `shot-5g-compare-sites-and-dates.png` shows Compare's second
mode; it is not on the slide.

**Speaker notes (about 75 words).** Five camera views share one clock: the System view,
the Polar map, the Slip Planner, Local terrain and Lander's eye, the 360 degree view from two
metres above the ground. Compare sets sites side by side for one landing date, or two sites
at two landing dates, marks the row that decides between them, and exports CSV and JSON. The
3D shadows are only a drawing. Lit or dark always comes from the computed record.

---

## Slide 6. How we know it is right

**On the slide**

- Lead number: **0.0061°**, the largest difference between our Sun and Earth directions and
  NASA's JPL Horizons
- **2,103,360** comparisons with JPL Horizons
- **5 of 59** comparisons with NASA's maps are outside their marks. We publish them.
- A planning aid, not flight certification.

Source line, small: NASA LOLA terrain · JPL Horizons positions.

**Picture.** The validation page, "How we know it's right", at "Sun and Earth positions":
the card reading "Our Sun and Earth positions agree with NASA's to within 0.0061°", marked
"Passed", and the line with "2,103,360 comparisons in all". Capture:
`slides/shot-6-validation.png`.

**Speaker notes (about 62 words).** The terrain is NASA's LOLA data and the Sun and Earth
positions come from JPL Horizons. We compared our Sun and Earth directions with Horizons'
own tables in 2,103,360 comparisons. The largest difference is 0.0061 degrees. Against
NASA's maps, 5 of 59 comparisons are outside their marks, and we publish each with its
reason. TrueSouth models the stay on the surface only.

---

## Slide 7. The Academy, and the team

**On the slide**

- Headline: **The Academy teaches the same physics.**
- Four lessons with Luna, our mascot, to land Pip, a fictional lander
- Next: more Academy lessons, and the official Artemis region outlines on the Polar map
- Coding agents wrote and reviewed the code under the team's direction.

Team, bottom of the slide: Abdallah Mostafa · Omar Khaled · Tawfic Kobtan · Ahmed Salah.
Team name: Landing Went South.

**Picture.** Lesson 1, "Where's the Sun?", step 2 of 5: the Sun's path over one month at
Connecting Ridge, the elevation readout, and Luna's line. Capture:
`slides/shot-7-academy-lesson1.png`.

**Speaker notes (about 68 words).** The Academy uses the same engine and data as Mission
Control. Luna, our moon mascot, guides a learner through four lessons to land Pip, a
fictional lander, and each lesson has a card with the real formula. Next, we will write more
lessons and draw the official Artemis regions on the Polar map. Coding agents wrote and
reviewed the code under our direction. We are Landing Went South.

---

## What is not on any slide

The sensitivity grid, a list of future plans beyond the one line on slide 7, and any live
address.
