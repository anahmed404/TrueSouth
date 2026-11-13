# Mission Control

The planner mode. It answers "where and when can this mission land?" in five steps, and
keeps every view on one clock.

Owner: Mission Control track. Folder: `web/src/features/mission-control/`.

The layout is **space-first**: a 3D scene of the Sun, Earth and Moon fills the window, and
the interface floats above it. Why: [`../decisions/0013`](../decisions/0013-space-first-mission-control.md).
The designer's notes and a working prototype are in
[`../../design/variants/c2-space-first.md`](../../design/variants/c2-space-first.md);
screenshots are in `docs/design/c2/space-*.png`.

## The workflow

1. **Choose a mission profile.** A real-mission preset, or Custom.
2. **Choose sites.** From the catalog, or by clicking the polar map.
3. **Find dates.** The Slip Planner shows every landing date for every chosen site.
4. **Inspect one site and date.** The scene and its camera views, a timeline and
   countdowns.
5. **Compare and share.** Up to four sites side by side; copy a link; export.

A new visitor lands on the System view with a working default: profile `im2_athena`, four
polar sites, landing date 2028-03-01. Nothing is empty on first load. The Slip Planner is
one click away on the view bar.

Step 2 also takes typed coordinates: "Your own coordinates" in the add-site picker
computes a custom site on the server ([`polar-map.md`](polar-map.md), "Custom sites").
Out of scope for the deadline: "compute for my dates"; its spec stays in
[`polar-map.md`](polar-map.md).

## Layout

The scene is the background. Every panel is a solid, flat panel with a 16 px margin
(8 px on a phone) and is only as tall as its content, so the scene shows below and between
them.

```text
 The whole window is the 3D scene: the Moon, with Earth and the Sun beyond it.
┌───────────────────────────────────────────────────────────────────────────────────┐
│ ┌──────────────────────┐                             ┌─────────────┐ ┌───────┐    │
│ │ TrueSouth [MC|Acad.] │                             │ Profile ▾   │ │ Share │    │
│ └──────────────────────┘                             └─────────────┘ └───────┘    │
│  ┌───────────────────────────────────────────────────────────────────────────┐    │
│  │ System · Polar map · Slip Planner · Terrain · Lander's eye │ Compare ▭    │    │
│  └───────────────────────────────────────────────────────────────────────────┘    │
│ ┌──────────────┐                                              ┌───────────────┐   │
│ │ SITES        │                 ◖ the Moon ◗                 │ FOCUSED SITE  │   │
│ │ ● Connecting…│       Earth ○                    ☀ Sun       │ status        │   │
│ │ ● Mons Mouton│                                              │ broken rule   │   │
│ │ + Add site   │      (the scene shows here; a floating       │ metrics       │   │
│ └──────────────┘       window opens over this area)           └───────────────┘   │
│             [ view controls float at the foot of the free space ]                 │
│ ┌──────────────────────────────────────────────────────────────────────────────┐  │
│ │ Landing date ‹ date › → end · 10 d · Next GO     ▶ speed │ countdown cards   │  │
│ │ timeline: lit/dark band, link/blackout band, scrubber    │                   │  │
│ └──────────────────────────────────────────────────────────────────────────────┘  │
│       Planning aid, not flight certification. Limits marked assumed are ours.     │
└───────────────────────────────────────────────────────────────────────────────────┘
```

| Element | What it is |
| :--- | :--- |
| **App bar** | Mode switch, profile picker, share. Three floating blocks along the top, 44 px tall. The landing date is in the bottom strip. |
| **View bar** | A floating bar under the app bar that picks the view. See "The view bar". |
| **About the view** | The current view's tab carries a small info button, "About System view" and so on. Its tip holds the plain-language text from `explain.ts`, whose first sentence says what the view shows. Nothing is drawn under the view bar, so the scene keeps that room. The same first sentence is the current tab's accessible description and is read out politely when the view changes. |
| **Sites rail** | Selected sites, each with a status chip for the current landing date. Click to focus. Up to 8 sites. 256 px wide, or 48 px folded. |
| **Focused-site panel** | Status, the broken rule, passing rules, metrics, slope with its baseline, links out to Quickmap and Moon Trek. 328 px wide, or 48 px folded. Content below. |
| **Timeline** | A floating bar along the bottom with the countdowns. Its header starts with the landing date, where the mission window begins, and "Next GO". 196 px tall, or one row (52 px) folded. Spec: [`site-detail.md`](site-detail.md). In the Slip Planner its slot holds the landing-date panel instead (see [`slip-planner.md`](slip-planner.md)). |
| **View controls** | The current view's controls (presets, overlays, exaggeration, and so on), in a small panel at the foot of the free space. Each view's spec lists them. |
| **Footer line** | "Planning aid, not flight certification. Limits marked assumed are our estimates." Always on screen, on a plate. |

The numbers are those of the prototype at 1440 × 900. The layout needs a window at least
1024 × 640.

The scene's camera centres the Moon in the free space between the panels, not in the
window, so a panel never covers it. The mechanism is in [`system-view.md`](system-view.md).

Panels and text over the scene follow the contrast rules in
[`../../DESIGN.md`](../../DESIGN.md): a panel is opaque, and any text drawn straight on the
scene sits on a plate.

## The view bar

One floating bar with six entries. A hairline divides the five views from the one window.
The window entry carries a small window icon and `aria-expanded`.

| Entry | Kind | What happens | Spec |
| :--- | :--- | :--- | :--- |
| System view | Camera view | Home. The camera returns to the whole scene. | [`system-view.md`](system-view.md) |
| Polar map | Camera view | The camera flies under the south pole, then the flat map takes over. | [`polar-map.md`](polar-map.md) |
| Slip Planner | Camera view | The camera flies to a stop above the south pole, tilted so the Moon curves away, and the sites become spots. The bottom panel shows landing dates. | [`slip-planner.md`](slip-planner.md) |
| Local terrain | Camera view | The camera continues down to the focused site. | [`local-terrain.md`](local-terrain.md) |
| Lander's eye | Camera view | The camera drops to 2 m above the ground. | [`panorama.md`](panorama.md) |
| Compare | Floating window | Opens over the scene. The camera does not move. | [`compare.md`](compare.md) |

- The selected camera view has a Raised fill and a Moonlight underline. An open window's
  button shows `aria-expanded="true"`.
- The bar has no "what it is for" lines. The current tab's info button does that job: it
  opens on hover, focus or a tap, and holds the view's text from `explain.ts`. It is a 28 px
  target on a wide screen and 44 px on a phone, inside the current tab's Raised fill, so it
  never reads as part of the next tab.
- The free space starts just under the view bar (and under any notice about the link). An
  earlier build put the view's sentence on a plate there; it was removed at the team lead's
  request because it took too much room.
- A pick during a camera move interrupts the move and starts a new one from where the
  camera is. A drag or scroll in the scene does the same.
- Compare is a table, not a place. That is why it is a window. The Slip Planner is a place,
  the south pole with your sites on it, so it is a camera view.
- The old "split" toggle (two views side by side) is dropped. The scene is always behind
  the interface, so there is no main view to split.
- Proposed: the shareable link's `view` parameter keeps its values (`slip`, `system`,
  `map`, `terrain`, `panorama`, `compare`). `system`, `map`, `slip`, `terrain` and `panorama`
  restore the camera view; `compare` opens that window over the System view.
  Reason: old links keep working and no new parameter is needed. The format lives in
  [`../data-contracts.md`](../data-contracts.md).

### Moving between views

- A move between camera views is one continuous camera flight of 1.3 to 1.5 s. It never
  passes through the Moon.
- System view to Polar map is one flight to the pole; at the end the flat map replaces the
  globe in a short fade.
- System view to Slip Planner is one flight to a stop above the pole. The Moon's light blends
  to a fixed drawing light, and back on leaving.
- Polar map to Slip Planner, or to Local terrain and on to Lander's eye, continue from where
  the camera is.
- With **reduce motion** on (the operating system's setting), every camera move is a short
  cross-fade, and panel and window animations are removed.
- A site with no terrain data (a sphere-tier site such as Apollo 11) cannot be flown to.
  Local terrain and Lander's eye say so and offer "Show it in the System view", where the
  camera follows the site on the globe. See each view's spec.
- Details of the camera path, durations and what is on screen in each view are in the
  views' own specs.

## Floating windows

Compare follows these rules. The Slip Planner is a camera view and does not.

- A window is a solid panel with the popover shadow, centred horizontally, between the
  view bar and the timeline. It is at most 1,120 px wide. On a phone it fills the screen.
- It has a title, a one-sentence description and a close button. It opens with a 180 ms
  rise and fade (none under reduced motion).
- It has `role="dialog"` and `aria-modal="false"`. It is not modal: the app bar, the side
  panels and the timeline stay usable, and the scene stays visible around it.
- **The timeline stays visible** below the window, and the scrubber keeps driving the
  windows' content where it depends on the current time.
- **Escape closes it,** and focus returns to the button that opened it. The close button
  does the same.
- Opening a window does not change the camera or the selected view.
- Picking a camera view while the window is open closes it, and the camera moves there.

## Folding

The sites rail, the focused-site panel and the timeline each fold away.

- Each side panel has a toggle at its top. The keys `[` and `]` fold the sites rail and the
  focused-site panel. The timeline has its own toggle.
- Folded, a side panel keeps a 48 px slim rail: the toggle on top, then the status lamps.
  The sites rail keeps one lamp per site, each still focusing its site; the focused-site
  panel keeps the focused site's lamp.
- The timeline folds to one row: play, speed, the current time and the toggle.
- Folding animates in 200 ms with an ease-out and does not animate under reduced motion.
  The camera's centre slides to the new free space at the same time. With everything
  folded, the home camera moves in so the Moon fills the room.
- The folded state is view state, kept in local storage, not in the scenario or the URL.

## When 3D does not run

When WebGL is missing, or the first camera flight is too slow, a still picture of the
System view replaces the scene, with the note "Try 3D anyway". Everything else keeps
working: panels, timeline and Compare. The flat Polar map still works, since it is a 2D
canvas, and the Slip Planner uses it with the same spots. Local terrain and Lander's eye show their 2D parts only. The
threshold and the details are in [`system-view.md`](system-view.md).

## The phone

Mission Control may ask for a wider screen, but the layout holds at 390 px wide.

- One column, with an 8 px margin. The scene stays behind everything.
- The app bar shows the brand and share; the mode switch and the profile are hidden.
- The view bar scrolls sideways.
- The sites rail is hidden and opens as a sheet from a "Sites" button.
- The focused site is a one-line sheet (name and status) that expands.
- The timeline is a compact strip: the landing date with its day buttons and "Next GO" on
  one 44 px row, the window's end and length with its tag under it, then play, the current
  time and the countdowns, then a 44 px scrubber. The date's picker, with the slip buttons,
  opens as a sheet the width of the screen.
- A floating window fills the screen.
- Every control is at least 44 px.
- The still picture shows the same note and keeps the same layout.

## Keyboard use

- **Tab order,** Proposed: app bar, view bar, sites rail, the scene, focused-site panel,
  timeline (the landing date first, then the play controls and the scrubber), then the
  footer. Reason: it follows the reading order, and the prototype's
  notes list "the scene is the first Tab stop" as a defect to fix.
- The scene canvas takes the arrow keys to turn and `+` and `−` to zoom. Pins are not in the
  tab order: the sites rail is the keyboard path to every site.
- `[` and `]` fold the side panels.
- The scrubber is a slider: arrow keys move one hour (with Shift, one day), Page Up and
  Page Down move 24 hours, Home and End go to the ends of the mission window.
- In the Slip Planner, the landing-date slider takes the arrow keys, one day each. The
  other keys are in [`slip-planner.md`](slip-planner.md).
- **Escape** closes, in this order: an open popover or tooltip, then the open window. Focus
  returns to what opened it.
- Every control has an accessible name. Status is never colour alone.

## Profile picker

- Lists the presets from `profiles.json`, each with the real mission's name and a
  one-line description.
- "Customise" opens an editor with every field of
  [`../mission-profiles.md`](../mission-profiles.md).
- Each field shows its tag. **Sourced** fields link to the source and show the quote on
  hover. **Assumed** fields show the reason.
- Editing a field switches the profile to Custom and marks that field "changed by you".
- Weights are three sliders. They are normalised automatically; there is no "must sum to
  1" error.
- Every change updates statuses, metrics and the Slip Planner at once.

## Landing date

- It sits in the bottom strip, at the left of the timeline where the mission window begins,
  not in the app bar: the landing date sets where the window starts and the scrubber moves
  inside it, so the two controls share one place.
- A date and hour in UTC, limited to the time grid. Arrows step by one day. After the date,
  the window's end and length with the duration's sourced or assumed tag, at every width.
  "Slip" buttons in the date's picker step by 7 and 14 days. "Next GO" moves to the next
  day the focused site is GO.
- The latest valid landing date is the end of the time grid minus the mission duration.
- The whole control, its states and what follows a change are in
  [`site-detail.md`](site-detail.md), "The landing date". The Slip Planner's landing-date
  panel mounts the same component.

## Sites rail and the sunlit peaks

Each row shows the site's name, its status chip and the one fact that matters (the broken
rule's value, or the score). A sphere-tier site adds "Terrain not modelled".

Some sites say what their point is, because the position or the meaning of the point
needs saying
([`../decisions/0012`](../decisions/0012-sunlit-peaks-keep-their-listed-point.md),
[`../site-catalog.md`](../site-catalog.md)). The wording lives in
`web/src/app/mission/site-labels.ts`, so the rail, the focused-site panel and Compare say
the same thing. To keep the rail quiet, only the variant's line is in the rail; the rest
is in the focused-site panel.

- **A best-lit variant** (`<id>_best_lit`) appears in the "Add site" list directly under the
  site it belongs to. Its row and its panel carry the dotted tag **chosen by TrueSouth**, in
  the place of a source, and the line "Best-lit map pixel, 149 m from Connecting Ridge"
  (`offset_m` rounded to the metre). It is never tagged sourced.
- **A custom site** carries the filled tag **Your site** beside its name.
- While a custom site computes, its row shows its state instead of a status
  ([`polar-map.md`](polar-map.md), "Custom sites").

## Focused-site panel

The panel keeps the approved order: the status; the broken rule; the passing rules; a
closed metrics disclosure; links.

What the point is, under the name and coordinates:

- **A best-lit variant:** "chosen by TrueSouth", "Best-lit map pixel, 149 m from Connecting
  Ridge", "Its sunlight is an upper reading: the brightest of the map pixels within 160 m."
  (the radius from the data), and a link that shows or adds the listed site.
- **An Artemis candidate entry** (group `artemis`): "This is the centre of a candidate
  region on NASA's map, not a chosen landing point."
- **A custom site:** "Your site", computed by TrueSouth at a typed point, not a sourced
  mission site. Until it is ready, the panel shows its state and its one action.
- **A sunlit peak with `nearby_sun`:** in "The ground", "Sunlight nearby: Within 160 m: 39 %
  to 87 %, six-year average", rounded outward (low end down, high end up) so the range
  never looks narrower than it is, with the `nearby_range` explanation and a link that
  shows or adds its best-lit point. A variant does not repeat it: the range is around the
  listed point.

The bullets below are the earlier spec; where they differ, the lines above are what is
built.

- **Header.** The site's name, coordinates, terrain tier and, for an Artemis candidate entry,
  the line "Centre of NASA's close-up map, not a chosen landing point".
- **Sunlit-peak sites.** The metrics disclosure shows the site's own six-year average
  sunlight and the nearby range beside it, with an `<Explain>` tooltip. The same wording as
  the sites rail.
- **A best-lit variant.** The header shows "Chosen by TrueSouth" and the distance from the
  listed point, and a link that focuses the listed site. The sunlight figure is marked
  "upper reading".
- **Links.** "Open in Quickmap" and "Open in Moon Trek", with the coordinates and a copy
  button. See [`share-export.md`](share-export.md).

## Explain tooltips

Every metric, veto and profile field has an info icon. It shows one or two plain sentences
from `web/src/lib/explain.ts` and, where one exists, a link to the Academy lesson that
teaches it. The same text is used in the Academy.

## Status and vetoes

- Status is always shown as colour plus word: GO, CAUTION, NO-GO.
- Vetoes are listed by name with the measured value and the limit, for example
  "Blackout: 31 h, limit 12 h".
- The score never hides a veto. A NO-GO site shows its vetoes first and its score greyed.
- A sphere-tier site shows "Terrain not modelled" and "Slope not assessed".
- A persistent footer line reads: "Planning aid, not flight certification. Limits marked
  assumed are our estimates."
- The results in every panel come from the Python-computed series and the evaluation hooks.
  The 3D scene's shadows and lighting never decide a status.

## States

| State | What the user sees |
| :--- | :--- |
| Loading a site | Skeleton rows; other sites stay usable |
| Textures loading | The Moon is drawn plain grey with the same lighting; panels are usable |
| No WebGL, or a slow first flight | The still picture, with "Try 3D anyway" |
| Custom site computing | "Computing terrain for your site…" with its queue position and the time so far; other sites stay usable |
| Custom site from a link, unknown to the server | "Not computed on this server yet" with "Compute this site"; no job starts without a click |
| API offline | The coordinates form shows "Custom sites are not available on this server." and is disabled; a custom site from a link says the server is not answering; all else works |
| No sites selected | A prompt to add one, with the Polar map open |

## Done when

- A first-time visitor sees the System view with its panels, timeline and countdowns
  filled within two seconds on the fixture data, and a filled Slip Planner within two
  seconds of opening it.
- Changing any profile field updates every visible status with no network request.
- Focusing a site, changing the date or dragging the scrubber updates the scene and every
  open window together.
- Each of the five camera views is reached from the view bar by a camera move, and a
  second pick during a move starts from where the camera is.
- Compare opens as a window; Escape closes it and returns focus; the timeline stays
  visible. The Slip Planner is reached by a camera move like the other views, and its
  bottom panel shows landing dates.
- With "reduce motion" on, no camera flight or panel animation plays.
- With WebGL off, the still picture shows and every panel and window still works.
- Folding the three panels works with the keys and the toggles, and the Moon is never
  covered by a panel at 1440 × 900 or at 390 × 844.
- Reloading the page restores the same scenario from the URL.
- Every number on screen has units and an explain tooltip.
- A sunlit-peak site shows its nearby range, a best-lit variant is labelled as chosen by
  TrueSouth with its upper-reading note, and an Artemis candidate entry says it is a map
  centre.
