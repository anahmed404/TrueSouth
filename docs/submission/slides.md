# Slides: a 7-slide outline

The organisers accept either a video or a 7-slide presentation. This file is the content for
the deck. The video script is [`video-script.md`](video-script.md). Both tell the same story
and use the same numbers.

State checked against `origin/main` at **ccb1389, 2026-11-14**. Nothing is deployed, so no
slide shows a live address. Every number below is in [`proposal.md`](proposal.md),
[`project-description.md`](project-description.md), [`demo-script.md`](demo-script.md),
[`../validation.md`](../validation.md) or `data/derived/validation.json`.

## How to build the deck

- 16:9, one idea per slide, dark neutral background to match the app. No stock photos.
- Every picture is a real capture of the running app or a NASA image. Nothing AI-generated.
- Captures are taken at a 1440 × 900 window. Crop to what a judge must read. If a capture
  cannot be read from the back of a room, crop closer.
- The slip story uses the **IM-2 Athena** mission profile and four sites (Connecting Ridge,
  Malapert Massif, Mons Mouton, de Gerlache Rim 2). The links are in
  [`demo-script.md`](demo-script.md), "Before the demo": link A (1 January 2028), link B
  (22 January) and link C (27 January).
- Existing captures in `docs/design/c2/` were taken during development. Several show other
  dates or sites, and a few show screens as they were then. The notes below say which are
  usable as they are. Retake anything marked "new capture".
- "Planning aid, not flight certification" appears once, on slide 6.

---

## Slide 1. TrueSouth: where and when to land

**On the slide**

- Headline: **TrueSouth**
- Line under it: Where and when can this mission land?
- Small print: Landing Went South · NASA Space Apps Cairo 2026 · Challenge: Lunar Landing Site Navigator

**Picture.** The System view as it opens: the Moon in the middle, Earth beside it a little
smaller and farther, the Sun far off. Full-bleed, text over the dark corner.

- *Stand-in that exists:* `docs/design/c2/built-system-earth-tune-after-1440-opening.png`.
  It shows the current opening (the Moon leads, Earth beside it). It is dated 1 March 2028
  and the rail shows four NO-GO sites, which is fine for a title.
- *Better, new capture:* open link A. In the "Selected sites" rail press "Hide the sites
  rail", and close the right panel, so only the Moon, Earth, the Sun and the view bar show.
  Keep "TrueSouth" visible at top left.

**Speaker notes (about 57 words).** We are Landing Went South. We built TrueSouth for NASA's
Lunar Landing Site Navigator challenge. It answers one question for a mission planner:
where and when can this mission land? It runs on NASA's real terrain and positions, and it
has two modes: Mission Control for planners, and the Academy for anyone who wants to learn
why.

---

## Slide 2. Why the south pole is hard

**On the slide**

- Headline: **At the south pole, the Sun skims the horizon.**
- **2.10°**, the highest the Sun gets at Connecting Ridge in our data
- Mountains block the Sun and Earth. A launch slip changes the answer.

**Picture.** Lander's eye at Connecting Ridge: the skyline as a 360° strip, with the Sun
hugging it.

- *Stand-in that exists:* `docs/design/c2/built-shell-feedback-after-landers-eye-1440.png`.
  It shows the Horizon chart with the skyline, Earth 6.12° up and the Sun 1.07° below level.
  It is dated 1 March 2028 and has NO-GO panels around it. Crop to the chart only.
- *Better, new capture:* open link A, press **Lander's eye**, then press "Horizon chart"
  so the chart opens. Time at 0 hours after landing (1 January 2028, Sun 0.63° up). The
  Sun and the skyline line must both be readable, with the degree scale on the left.

**Speaker notes (about 64 words).** At the Moon's south pole the Sun stays within about two
degrees of the horizon. The highest it climbs at Connecting Ridge in our data is 2.10
degrees. Earth hangs low too, and it rises and sets as the Moon wobbles. Mountains block
both. So terrain decides whether a lander has power and a radio link, and when a launch
slips, the answer changes.

---

## Slide 3. One question, three answers

**On the slide**

- Headline: **Where and when can this mission land?**
- **GO**, **CAUTION** or **NO-GO**, with the rule that decided it
- 20 catalog sites, 5 best-lit variants, or your own coordinates

**Picture.** The focused-site panel showing a NO-GO with its broken rule and its limit
tagged "assumed", beside the sites rail with one status per site.

- *Exists, usable:* `docs/design/c2/built-slip-after-slip.png`. NO-GO at Connecting Ridge,
  "Longest blackout 206 h, limit 12 h", the "assumed" tag, the four sites in the rail. It is
  dated 19 September 2028, which does not matter on this slide. Crop to the left rail and
  the right panel, leaving out the Moon.

**Speaker notes (about 65 words).** You choose a mission profile, up to eight sites and a
landing date. TrueSouth scores that date and gives one of three statuses: GO, CAUTION or
NO-GO, and it shows the rule that broke, such as a dark stretch that is too long or a radio
blackout. Every limit is tagged sourced, with a link, or assumed. We never show an assumed
number as sourced.

---

## Slide 4. A launch slip, on real data

**On the slide**

- Headline: **Same site, same mission. Three weeks later, NO-GO.**
- 1 Jan 2028: **GO**
- 22 Jan 2028: **NO-GO**: Earth out of contact 119 h (limit 12 h, assumed)
- 27 Jan 2028: **GO** again, at "Next GO"

Small print under the three: Connecting Ridge · IM-2 Athena profile.

**Picture.** Three crops side by side, left to right, from the Slip Planner. All new
captures, 1440 × 900, IM-2 Athena, the four demo sites, Connecting Ridge focused:

1. Link A, then press **Slip Planner**. Landing date reads `2028-01-01 00:00 UTC`.
   Connecting Ridge's spot shows GO; the other three show NO-GO. Crop to the focused-site
   panel (GO, score 100) and the spots.
2. Link B (22 January, Slip Planner). The plate reads "Slipped +21 d, 01 Jan → 22 Jan 2028.
   1 of 4 sites changed. No site is GO or CAUTION on this date." Crop to that plate and the
   NO-GO panel with "Longest blackout 119 h, limit 12 h, assumed".
3. Press **Next GO**. Landing date reads 2028-01-27. The note reads "Landing moved to 27 Jan
   2028, the next GO date for Connecting Ridge." Focused panel shows GO, score 99.

Existing capture for panel 1 only: `docs/design/c2/built-compare-1440-four.png` shows
Connecting Ridge GO at score 100 on 2028-01-01, but with a different set of sites and the
Compare window open. Prefer the new capture.

**Speaker notes (about 66 words).** This is real data. Connecting Ridge, on the IM-2 Athena
profile, is GO if we land on 1 January 2028. Slip the launch three weeks, to 22 January, and
it is NO-GO: Earth is out of contact for 119 hours, against a limit of 12 that we assumed.
Press Next GO and the answer is 27 January, five days later. Small date changes decide the
mission.

---

## Slide 5. Five views, one clock, and Compare

**On the slide**

- Headline: **See why a site is lit or dark.**
- System view · Polar map · Slip Planner · Local terrain · Lander's eye
- **Compare**: sites side by side, with the deciding row marked

**Picture.** A strip of five small captures labelled with the view names, and a sixth,
larger, of Compare. New captures are best, all at link C (27 January 2028), 1440 × 900.
Existing stand-ins, all showing real data:

| View | Existing capture in `docs/design/c2/` | Note |
| :--- | :--- | :--- |
| System view | `built-system-earth-tune-after-1440-opening.png` | Current opening. 1 March 2028. |
| Polar map | `built-shell-feedback-after-map-1440.png` | 1 March 2028. Four spots on the pole. |
| Slip Planner | `built-slip-after-slip.png` | 19 September 2028, with six years of strips. |
| Local terrain | `built-ground-after-cr-terrain-lit.png` | Connecting Ridge, 1 March 2028. Taken before the close-up ground work. |
| Lander's eye | `built-shell-feedback-after-landers-eye-1440.png` | Horizon chart open. 1 March 2028. |
| Compare | `built-compare-1440-four.png` | 1 January 2028. Connecting Ridge GO; Mons Mouton, Apollo 11 and Shackleton rim NO-GO. Export CSV and Export JSON visible. |

Do **not** use `built-shell-feedback-after-compare-1440.png` or `space-compare.png`: they
were taken before Compare was built and say "Not built yet".

**Speaker notes (about 68 words).** Five camera views share one clock: the System view,
the Polar map, the Slip Planner, Local terrain and Lander's eye, the 360 degree view from two
metres above the ground. Compare sets sites side by side for one landing date, marks the row
that decides between them, and exports CSV and JSON. The 3D shadows are only a drawing.
Lit or dark always comes from the computed record.

---

## Slide 6. How we know it is right

**On the slide**

- Headline: **Our Sun and Earth directions match NASA's within 0.0061°.**
- **2,103,360** comparisons with JPL Horizons
- **5 of 59** comparisons with NASA's maps are outside their marks. We publish them.
- Planning aid, not flight certification.

Source line, small: NASA LOLA terrain · JPL Horizons positions.

**Picture.** The top of the validation page, "How we know it's right": the card reading "Our
Sun and Earth positions agree with NASA's to within 0.0061°", with the pass mark visible.

- *Exists:* `docs/design/c2/built-validation-1440.png`. It is a full-length page capture, so
  crop the first card of "Sun and Earth positions". The "Against NASA's maps" tables further
  down show the rows marked "Outside the mark"; a second crop of one of those is optional.
- *Better, new capture:* open `<live>/validation` on a running copy at 1440 × 900 and
  capture the card and the line "2,103,360 comparisons".

**Speaker notes (about 62 words).** The terrain is NASA's LOLA data and the Sun and Earth
positions come from JPL Horizons. We compared our Sun and Earth directions with Horizons'
own tables in 2,103,360 comparisons. The largest difference is 0.0061 degrees. Against
NASA's maps, 5 of 59 comparisons are outside their marks, and we publish each with its
reason. TrueSouth models the stay on the surface only.

---

## Slide 7. The Academy and what is next

**On the slide**

- Headline: **The Academy teaches the same physics.**
- Four lessons with Luna, to land a fictional lander, Pip
- Next: close-up ground from NASA's 5 m maps (in progress), Academy lessons 5 to 8
- Built with AI tools under the team's direction. Full disclosure in our submission.

Team, bottom of the slide: Abdallah Mostafa · Omar Khaled · Tawfic Kobtan · Ahmed Salah.
Team name: Landing Went South.

**Picture.** An Academy lesson step with Luna and a live panel.

- *Exists, usable:* `docs/design/c2/built-academy-panels-l1-system-view-after.png`. Lesson 1,
  "Where's the Sun?", step 3 of 5, with the System view panel and Luna's reply. Luna is a
  placeholder drawing, so crop her out or keep her small. Do not describe her art as final.
- *Alternative, new capture:* **Academy**, then lesson 1, step 1 or 2 (the Sun drag), at
  1440 × 900.

**Speaker notes (about 70 words).** The Academy uses the same engine and data as Mission
Control. Luna, a moon mascot, guides a learner through four lessons to land Pip, a fictional
lander, and each lesson has a card with the real formula. Next: close-up ground from NASA's
5 metre maps, in progress, and lessons 5 to 8, not yet written. AI tools wrote most of the
code under our direction. We are Landing Went South.

---

## What is not on any slide

Academy lessons 5 to 8, final art for Luna (her drawings are placeholders), official
Artemis region outlines on the Polar map, the sensitivity grid, and any live address.
