# Video script: two minutes, with cuts to 60 and 30 seconds

The organisers accept either a video or a 7-slide presentation. This is the script for the
video. The deck outline is [`slides.md`](slides.md). Both tell the same story with the same
numbers.

The organisers' length limit is not known. The script is written for **2 minutes**, and each
shot says which shorter version keeps it.

| Version | Shots kept | Spoken words |
| :--- | :--- | :--- |
| **2 minutes** | S1 to S10 | **194** |
| **60 seconds** | S1, S2, S3, S4, S5, S9, S10 | **127** |
| **30 seconds** | S2, S3, S5, S10 | **60** |

Counts are of the voice-over column. At about 150 spoken words a minute, 194 words is about
78 seconds of speech; the rest of the two minutes is for clicks and pauses. In the 60-second
cut, shots S4 and S9 need a brisk read. In the 30-second cut, use link B for S3 instead of
the clicks.

The story and every date and result come from [`demo-script.md`](demo-script.md), which was
performed on the running app and whose numbers were recomputed: Connecting Ridge on the
IM-2 Athena profile is **GO** on 1 January 2028 (score 100), **NO-GO** on 22 January (119
hours without a link, against a limit of 12), and **GO** again on 27 January (score 99, the
"Next GO" date). The limits behind GO and NO-GO are mostly **assumed**; only the 10-day
mission length is sourced. The voice-over says the twelve-hour limit is an estimate.

State checked against `origin/main` at **ccb1389, 2026-11-14**. Rehearse once against a
clock and fix any label that moved. Nothing is deployed, so there is no live address in
this file.

## The shots (2-minute version)

Click labels are the on-screen labels. The last column says which cuts keep the shot.

| Shot | Time | On screen | Voice-over | Caption | Kept in |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **S1** | 0:00–0:10 | Open **link A** (see "Before you record"). The **System view** fills the window: the Moon in the middle, Earth beside it, the Sun far off, stars behind. The "Selected sites" rail on the left is open with four sites: Connecting Ridge **GO**, the other three **NO-GO**. Drag the Moon slowly over the pole and let go. *Viewer must read:* the rail's GO and NO-GO lines. | At the Moon's south pole the Sun skims the horizon. Mountains hide it, so a launch slip can change the answer. | The Moon's south pole | 2 min, 60 s |
| **S2** | 0:10–0:20 | Click **Slip Planner** in the view bar. The camera flies to the pole. Each site is a spot; the bottom panel shows one strip per site. *Viewer must read:* the landing date `2028-01-01 00:00 UTC`, the profile "IM-2 Athena" at top right, and Connecting Ridge's spot showing GO. | TrueSouth asks one question: where and when can this mission land? Connecting Ridge, 1 January 2028: GO. | IM-2 Athena · Connecting Ridge · 1 Jan 2028 | 2 min, 60 s, 30 s |
| **S3** | 0:20–0:36 | Click the landing date at the left of the bottom panel (`2028-01-01 00:00 UTC`). In the box that opens, in the row labelled "Slip", press **+14 d**, then **+7 d**. Press Escape. *Viewer must read:* the plate "Slipped +21 d, 01 Jan → 22 Jan 2028. 1 of 4 sites changed. No site is GO or CAUTION on this date.", the spot "was GO", and in the right panel NO-GO with "Longest blackout" **119 h**, limit 12 h, tagged "assumed". Hold 2 s. To skip the clicks, open **link B** in place of S2 and S3 (30-second version: always use link B). | The launch slips three weeks. 22 January: NO-GO. Earth is out of contact for 119 hours; the limit is 12. | 22 Jan 2028: NO-GO | 2 min, 60 s, 30 s |
| **S4** | 0:36–0:52 | Click **Lander's eye** in the view bar. Under the 3D horizon, the foot row gives a one-line reason for the Sun and for Earth, each with a **Why?** button. Press the Sun's **Why?**. The box "Why is it dark?" opens and names the terrain that hides the Sun, with its bearing, distance and height. Hold 3 s. Close it. *Viewer must read:* the box title and the named terrain. Needs the rail open; see the warning in "Before you record". | Why? The screen names the terrain that hides the Sun. The twelve-hour limit is our estimate, and the screen tags it assumed. | Limits we chose are tagged assumed | 2 min, 60 s |
| **S5** | 0:52–1:01 | Click **Next GO** in the landing date row of the bottom strip. The landing date jumps to `2028-01-27`, a note reads "Landing moved to 27 Jan 2028, the next GO date for Connecting Ridge.", and the verdict turns **GO**, score 99. *Viewer must read:* the note and GO. | Press Next GO. 27 January, five days later: GO again. | 27 Jan 2028: GO | 2 min, 60 s, 30 s |
| **S6** | 1:01–1:16 | Click **Compare** in the view bar. The bottom strip folds to one row. One table, four columns: Connecting Ridge GO, the other three NO-GO. One row is marked "Decides between them". The header shows the landing date, **Export CSV** and **Export JSON**; "Open in NASA’s maps" links each site to QuickMap and Moon Trek. Do not press the export buttons. Hold 4 s, then Escape. *Viewer must read:* the GO and NO-GO row and "Decides between them". | Compare puts the sites side by side for one date and marks the row that decides between them. Planners can export the table as CSV or JSON. | Compare | 2 min |
| **S7** | 1:16–1:26 | Click **Local terrain** in the view bar. The camera drops to the ground at Connecting Ridge: 20 km of terrain around the site and more out to the horizon, with Pip standing at the site ("Lander not to scale"). Orbit a little with the mouse. *Viewer must read:* the plate "The series says: lit. 100 % of the Sun's disc is above the skyline." and its note that shading and shadows are for understanding only. Skip this shot if WebGL is off. | This is the ground. The shadows are only a drawing. Lit or dark always comes from the computed record. | Shadows are a drawing; the record decides | 2 min |
| **S8** | 1:26–1:38 | Click **Academy** in the top bar, then **Start lesson 1** ("Where's the Sun?"). Luna asks how high the Sun gets at the south pole. Pick **Under 3°**, press **Check**. *Viewer must read:* the lesson title and the question. | The Academy teaches the same physics. Luna, a moon mascot, guides learners through four lessons to land Pip, a fictional lander. | Academy: four lessons | 2 min |
| **S9** | 1:38–1:50 | Open `<live>/validation` ("How we know it's right") in a second tab prepared in advance. *Viewer must read:* the card "Our Sun and Earth positions agree with NASA's to within 0.0061°." and the line with 2,103,360 comparisons. Then scroll to "Against NASA's maps" until a row marked outside its mark shows. If the page fails, show the headline card from `demo-script.md`. | Our Sun and Earth directions match NASA's JPL Horizons within 0.0061 degrees, in 2,103,360 comparisons. Where we differ from NASA's maps, we publish it. | 5 of 59 comparisons outside their marks, published | 2 min, 60 s |
| **S10** | 1:50–2:00 | A plain closing card, made in the editor: TrueSouth; the line "Landing Went South"; Abdallah Mostafa, Omar Khaled, Tawfic Kobtan, Ahmed Salah; NASA Space Apps Cairo 2026. No live address. | TrueSouth is a planning aid, not flight certification. We are Landing Went South. | Landing Went South | 2 min, 60 s, 30 s |

## Timings of the shorter versions

Play the kept shots back to back. Times for the shots that stay:

**60 seconds**

| Shot | Time |
| :--- | :--- |
| S1 | 0:00–0:08 |
| S2 | 0:08–0:15 |
| S3 | 0:15–0:28 |
| S4 | 0:28–0:39 |
| S5 | 0:39–0:44 |
| S9 | 0:44–0:54 |
| S10 | 0:54–1:00 |

**30 seconds**

| Shot | Time |
| :--- | :--- |
| S2 | 0:00–0:08 |
| S3 | 0:08–0:17 |
| S5 | 0:17–0:22 |
| S10 | 0:22–0:30 |

## Before you record

1. **Window.** Record at 1440 × 900, the size the screens were checked at. Mission Control
   is built for a wide screen. If the organisers ask for 16:9, rehearse once at 1600 × 900
   first, or place the 1440 × 900 capture on a dark 16:9 frame.
2. **First address.** Open **link A** in a private window:
   `<live>/mission?profile=im2_athena&sites=connecting_ridge,artemis_malapert,artemis_mouton,artemis_de_gerlache_rim_2&land=2028-01-01T00%3A00Z&t=0&view=system`
   Prepare **link B** (the same address with `land=2028-01-22T00%3A00Z` and `view=slip`) in a
   second tab as the backup for S3, and `<live>/validation` in a third tab for S9. The
   links are listed in [`demo-script.md`](demo-script.md), "Before the demo".
3. **Graphics acceleration on.** In the browser's settings, turn on "Use graphics
   acceleration when available" and restart it. Open the browser's GPU page and check that
   WebGL says it is hardware accelerated. Without WebGL the System view shows a still picture
   and the Slip Planner shows the flat Polar map, and S7 cannot be recorded.
4. **Hide bookmarks** and other toolbars. Close other tabs, turn off notifications, close
   chat and mail, and use a private window so no extension adds anything to the page.
5. **Sound.** Record the voice-over on its own, after the screen is captured, so the clicks
   can be timed to the words. Read each line aloud once against the shot's length.

**What to check on screen before pressing record**

- The "Selected sites" rail is open and lists four sites. The rail remembers if it was
  folded: if it shows only four status lamps, press "Show the sites rail" at its top. S4
  needs it open.
- The profile reads "IM-2 Athena" and the landing date reads `2028-01-01 00:00 UTC`.
- Connecting Ridge reads GO with score 100; the other three read NO-GO.
- The Moon is the 3D picture, not a still picture, and nothing in the footer or the rail
  says a data file failed to load.
- The footer shows its planning-aid line and the note that limits marked assumed are our
  estimates.
- Run S3 and S5 once as a dry run: the plate says "Slipped +21 d, 01 Jan → 22 Jan 2028", and
  Next GO lands on 27 Jan 2028 with score 99. If a number differs, stop and tell the team
  lead: the story in this script depends on those numbers.
- No lesson, tab or panel is left open from an earlier run, and the mouse pointer is at
  rest outside the view you are about to show.

## Not to show

Academy lessons 5 to 8, official
Artemis region outlines, the sensitivity grid, and any live address in the picture or the
voice-over.
