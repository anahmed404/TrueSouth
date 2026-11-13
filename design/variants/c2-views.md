# Mission Control views in direction C2: Slip Planner, Polar map, System view, Local terrain

Throwaway prototypes of the four Mission Control views that had no design yet, two variants
each, drawn inside the approved C2 shell ([`mission-shell/c2/index.html`](mission-shell/c2/index.html)).
The team lead picks one variant per view; nothing here is final UI.

Open each page at 1440 × 900. Each page is a stack of full 1440 × 900 frames:

1. the default state, with both side panels open;
2. the same view with both side panels collapsed, usually in a second interesting state;
3. on some pages, a third state (a zoom level, true scale, or a sphere-tier site).

Scroll down to see the frames after the first. Each frame is live: the panel buttons and the
<kbd>[</kbd> and <kbd>]</kbd> keys fold and open the side panels, and the view redraws at
its new size.

All data is mock, consistent with the approved shell: profile `im2_athena`, landing date
2028-03-01 00:00 UTC, the scrubber at Day 3 · 03 Mar 15:00 UTC, Connecting Ridge focused and
NO-GO on its 31 h blackout. Each page carries the "prototype · mock data" tag.

| View | Variant a | Variant b |
| :--- | :--- | :--- |
| Slip Planner | [`slip-planner/a`](slip-planner/a/index.html) | [`slip-planner/b`](slip-planner/b/index.html) |
| Polar map | [`polar-map/a`](polar-map/a/index.html) | [`polar-map/b`](polar-map/b/index.html) |
| System view | [`system-view/a`](system-view/a/index.html) | [`system-view/b`](system-view/b/index.html) |
| Local terrain | [`local-terrain/a`](local-terrain/a/index.html) | [`local-terrain/b`](local-terrain/b/index.html) |

## How the shell's panels collapse

The lead asked for collapsible side panels. Every page uses the same answer:

- Each side panel has a small panel icon in its header. It folds the panel to a 48 px strip.
- **The folded sites rail** keeps one button per site: a status lamp and a short label
  (CR, Mal, Mou, dG2, A11), with the full name on hover. The focused site keeps its outline. "Add site" stays as a "+".
- **The folded focused-site panel** keeps the status lamp and one vertical line: site name,
  status word and the broken rule ("Connecting Ridge · NO-GO · Longest blackout 31 h,
  limit 12 h"). So the verdict never leaves the screen.
- <kbd>[</kbd> folds the left panel and <kbd>]</kbd> folds the right one.
- The grid columns animate over 200 ms. The view redraws once at its new size; it does not
  stretch.
- With both panels folded, the main view grows from 824 px to 1,312 px wide.
- **The timeline folds too** (proposed after the review). The arrow at the right of its
  header folds it to that header row. It keeps the mission window and play, and gives the
  main view 152 px more height: 772 px instead of 620 px. Folding the side panels only adds
  width, and the maps and 3D scenes are limited by height. Polar map a, frame 2 shows it.
- After a slip, the timeline and the countdown cards follow the new landing date. On the
  Slip Planner pages they are redrawn from the mock series.

## 1. Slip Planner

**a, one long strip.** One big heatmap. A six-year overview bar sits above it, with a white
window that you drag to move through time. Before and after a slip are shown in a card
under the grid.

**b, slip ladder.** An answer-first table gives every site's status in words on the landing
date and on each slip step: +7, +14, +21 and +28 days, more when the panels fold. A compact
heatmap under it pages through the six years.

**Recommendation: a.** It is the spec's heatmap, and it puts one grid on screen instead
of two. Its slip card already answers the demo line, "Pip's launch just slipped three
weeks", in words: "Slipped +21 d: 01 Mar → 22 Mar, NO-GO → GO". With the panels folded,
each day gets about twice the width.

Variant b reads even faster for that one moment, but its heatmap shrinks to a strip with
thin rows. I first recommended b, and changed my mind after the independent review below.
One idea worth borrowing from b: the dimmed "Before slip" column could become a small
ladder inside a's slip card.

**States shown:**

- **a:**
  - The default, with a pinned hover on Connecting Ridge × 01 Mar showing why it is NO-GO.
  - Panels folded, after a +21 d slip, with the before-and-after card.
  - A 3-month zoom, with the slip ticks labelled.
- **b:**
  - The default ladder.
  - Panels folded, after a +21 d slip: eight dates and a dimmed "Before slip" column.
- **Sphere-tier site:** Apollo 11 appears as a normal row with "Terrain not modelled". Its
  narrow monthly GO stripe is the equator's rhythm.

**Moving through time and zooming:**

- **a:**
  - Zoom 3 months, 18 months (the default) or 6 years.
  - Drag the overview window, or scroll, to pan.
  - ← and → move the landing date by a day.
  - Drag the marker, or click any cell, to land on that date and focus that site.
- **b:**
  - Zoom 6 months, 18 months or 6 years.
  - The pager arrows step three quarters of a window.
  - Scroll to pan, click a cell or a ladder column to land on it, and change the slip step
    (1, 7 or 14 days).

**Never colour alone.** A status reads from shape as well as colour:

| Status | Cell |
| :--- | :--- |
| GO | Full bar. Its brightness has three steps by score. |
| CAUTION | Half-height bar |
| NO-GO | Hatched |
| No data | Dotted |

The hover and the ladder always name the status in words.

**For the developer:**

- The heatmap is one SVG in the prototype. Runs of equal status are merged into one
  rectangle. In the app, draw it on Canvas as the spec says.
- The overview bar's grey density is "how many selected sites are viable that day".
- In the prototype, the slip buttons in the top bar really move the date. The rail, the
  folded strips and the focused-site status follow. The rest of the focused-site panel and
  the timeline do not; in the app they follow the date too.

## 2. Polar map

**a, full-width map.** The map fills the plot. The overlay choice, opacity, "Artemis regions"
and "Feature names" sit in the one control row. The nudge readout is a strip docked under
the map, and clicking empty ground opens a small popover at that point.

**b, map with a docked column.** The map and a 252 px column sit side by side. The column
holds the layers, the nudge readout, "New site here" and "Off this map". Nothing opens over
the map.

**Recommendation: a**, together with the foldable timeline. The map is the subject, and a
gives it the full width: 792 px with the panels open, and 1,312 × about 460 px with the side
panels and the timeline folded. In b the map shrinks to about 525 px wide with the panels
open. The one popover in a is small and sits at the point you clicked.

The independent review preferred b, for its taller, squarer map with no popover over it.
That is a fair call if the timeline does not fold.

**States shown:**

- **a:**
  - The default, with the "New site here?" popover. The popover names its source, NASA's
    average maps.
  - Side panels and timeline folded, zoomed on the ridge, with the sunlight overlay and the
    Artemis outlines on, and Connecting Ridge nudged 1.1 km: "Average sunlight 83 % → 55 %,
    lower".
- **b:**
  - The default.
  - Panels folded, with the Earth-visibility overlay, the Artemis outlines and the same
    nudge.

**What is on the map:**

- The relief is drawn from invented heights. The catalog's named craters and massifs sit at
  their IAU positions with their real diameters, in the §2.3 polar stereographic
  projection.
- Latitude circles are drawn every degree, labelled where there is room. Longitude lines
  are drawn every 30°.
- A scale bar reads "north is outward from the pole".
- Selected sites are ringed lamp pins with the status word. Other catalog sites are hollow
  dots.
- **Sphere-tier site:** Apollo 11 is off the map. It is listed with a small locator globe
  and "Show on Moon".

**For the developer:**

- Both overlays use the data hue, never a status colour: Sun cream for sunlight, Earth blue
  for Earth visibility. The ramp runs from transparent to the hue.
- Nudge changes are shown in ink with a small arrow and the word "lower" or "higher", never
  in GO or NO-GO colours. A change of light is not a status.
- The nudge readout uses only the lookup grids, as the spec says, so it needs no API.
- "Compute for my dates" and "Create a site here" are the API actions. When the API is
  offline they are disabled with a reason; that state is not drawn.

## 3. System view

**a, one scene.** One 3D scene fills the plot. The camera presets, "True scale" and
"Watch a month" sit in the control row, and the two sight-lines carry their own labels in the
scene.

**b, scene with porthole presets.** The scene sits beside a docked column. The four presets
are round previews ("portholes") of what each one shows. The column also reads out the two
sight-lines in words, the scale and the playback.

**Recommendation: a.** It answers "where is the 3D view?" at first glance with a big lit
globe: Earth on one side, the Sun's arrow on the other, and two labelled sight-lines leaving
the site. Variant b's portholes are lovely and teach the presets, but they take room from the
globe while the panels are open. They could come back later as the preset menu's
thumbnails.

**States shown:**

- **a:**
  - The South pole preset.
  - Panels folded: a larger Moon, with Earth further out.
  - True scale on: the Moon is a few pixels wide, Earth is 221 Moon radii away, and the Sun
    is a direction.
- **b:**
  - The South pole preset.
  - Panels folded with "Follow site": the Moon turns until Connecting Ridge faces the camera,
    and the polar sites separate and are named.
- **Sphere-tier site:** Apollo 11 is an ordinary green pin on the globe. It is visible from
  "From Earth".

**How it is drawn.** The globe is a hand-written ray-cast on a 2D canvas, not three.js, so it
loads with no network and looks right in a still screenshot. Its parts:

- The Moon has an invented texture: maria, Tycho with rays, Crisium and a crater field. It
  is lit from the Sun's direction, with a little earthshine on the night side.
- A dashed day/night line, Earth's lit side facing the Sun, the axis and a faint equator.

Drag to orbit, scroll to zoom. "Watch a month" plays the shared clock at 1 day per second:
the terminator sweeps round and Earth bobs.

**For the developer:**

- Sight-line colour and words come from the series (Sun dark → red dashed, Earth link →
  green), never from the scene.
- The "Distances not to scale. Every direction is true." chip is always on unless true scale
  is on.
- In the app this is three.js per the spec. Keep the in-scene label plates: Ink text on Sky
  at 88 % opacity, as on the Lander's eye.

## 4. Local terrain

**a, one scene.** The 3D scene fills the plot. The colour, height-exaggeration, close-up and
"Lander's eye" controls sit in the control row. The series' answer, the exaggeration label
and the shadow note are pinned in the scene's corners.

**b, scene with a steering plan.** A docked column holds a flat plan of the same ground,
north up, with the Sun and Earth rays, the blocker and a camera marker. Dragging the marker
turns the 3D camera. The series' answer and the controls live in the column.

**Recommendation: a**, for the room. It gives the ground the whole plot, and it reads
immediately as a block of terrain.

Variant b's plan solves the real problem with oblique 3D, "which way am I looking?", and it
is the stronger teaching tool. If the lead finds a's orientation hard, the plan from b could
dock as a small inset in a, folded by default.

**States shown:**

- **a:**
  - The default, ×1 and regolith shading.
  - Panels folded, with slope colours and heights ×2. The corner label says "Heights ×2" and
    the badge adds "shadows not to scale".
  - Apollo 11, the sphere-tier state.
- **b:**
  - The default.
  - Panels folded, with the camera turned from the plan to look along the Sun's ray.
  - Apollo 11.

**What the scene shows:**

- **The site and the Sun.** The lander sits in shadow, as the series says: dark, 1 % of the
  Sun's disc. Sunlit ground lies 1–2 km east, where the higher ridge sees over the wall.
- **The skyline wall.** Its top follows the same skyline as the Lander's eye (`M.sky`).
- **The blocker.** The Sun's red dashed sight-line ends at the blocker ring on the wall, at
  azimuth 265.98°, 12.4 km away and 1.30° up. That is the same point the Lander's eye rings.
- **Shadows.** They are ray-marched against the terrain and the wall, for illustration only.

**Sphere-tier site:** "No terrain data for Apollo 11" with one plain sentence on why,
"Open the System view" and "Pick a polar site".

**For the developer:**

- **The ground is a disc.** The mesh is clipped to the 10 km wall ring and given a cut-away
  side, so it reads as a block of ground. The spec says a 20 km square. I propose drawing
  the square's data clipped to the ring, because the square's corners poke through the wall
  and confuse it. The data stays a 257 × 257 square.
- **Form shading.** A soft fill light from the north-west shades the ground's form. It is
  illustration, like the shadows.

## New tokens and components (proposals; DESIGN.md is not edited)

| Proposal | Value | Where |
| :--- | :--- | :--- |
| `--rail-w`, `--focus-w`, `--mini-w` | 256 px, 328 px, 48 px | Collapsible shell columns |
| Shell rows when the timeline folds | `52px 772px 8px 44px 24px` | Folded timeline |
| `--dur-panel` | 200 ms, `cubic-bezier(.2,.7,.2,1)` | Panel fold. Off under `prefers-reduced-motion`. |
| `--hatch-nogo` | NO-GO at 10 % fill with 1.3 px lines at 60 %, 6 px pitch, 45° | NO-GO heatmap cells |
| `--height-ramp` | `#3c3a38 → #e6d6b8` (warm grey to sand) | Local terrain height colours. No purple and no data hue; the detector flags `#e6d6b8` as outside the palette, which is expected. |
| `--terrain-wall` | `#2c2c30` facing, `#232326` away | Skyline wall faces, under the existing `--terrain-rim` edge |
| `--terrain-skirt` | `#141415`–`#1e1e20` | Cut-away side of the terrain disc |

**Components:**

| Component | What it is |
| :--- | :--- |
| Collapsed rail strip | Lamp and short label buttons, with the full name on hover, plus a vertical "Selected sites · 5 of 8" |
| Folded timeline | The header row only, 44 px: title, mission window, play, speed, and an arrow to open it again |
| Collapsed focus strip | Lamp, plus one vertical line with the name, status word and broken rule |
| Heatmap cell | Full bar, half bar or hatch, as described above |
| Landing marker | A 2 px Moonlight line, with a Moonlight pill under the rows reading "Landing 01 Mar 2028" |
| Overview brush | A Moonlight outline at 1.5 px, with an 8 % fill |
| Slip ladder | A table. The current column has a Raised fill and a 2 px Moonlight top edge; the "Before slip" column is at 55 % opacity. |
| Map pin | A ringed lamp, 8 px radius, with an outer ring that is Moonlight when focused. The label and status word sit on a Sky halo. |
| Readout pill | Sky at 88 %, with a Control Edge border |
| Nudge strip | Raised. The changed value is in ink, with a small triangle and the word "lower" or "higher". |
| Porthole preset | A 64 px round preview. When selected, its ring is Moonlight. |
| Steering plan | A top-down disc with the Sun and Earth rays, the blocker ring and a Moonlight camera marker with a 10 % view wedge |
| In-scene label plate | Sky at 88 %, 6 px corners. A canvas-drawn status lamp, never a Unicode glyph. |

## Decisions I was unsure about

- **The view sentence.** The brief asked for the `explain.ts` text under the tabs. Those
  entries are two sentences, longer than the shell's one-liners, so the sentence runs to two
  lines at 824 px.
  - `slip_planner` says "a flat colour grid", while the cells also differ by shape. Worth a
    small edit there.
- **The shell's "Why is it dark?" copy.** It says the blocking ridge is "near de Gerlache".
  From Connecting Ridge, de Gerlache lies at azimuth about 112°, not 266°. My views
  name the blocker only by its distance and height. The shell copy should drop
  "near de Gerlache".
- **Earth's size in the System view.** The default draws Earth smaller than the Moon,
  because "larger than life" in the spec is about apparent size. True scale shows the real
  ratio.
- **Slope colours.** The Local terrain slope overlay uses the three status colours, as the
  spec's table says. They mean "under ideal, under limit, over limit", not GO, CAUTION and
  NO-GO. They are always explained in the legend line, but it is a reuse of status hues.
- **Recommending a everywhere.** I recommend a for all four views; for the Slip Planner I
  first chose b, then changed my mind after the review. That consistency is partly the
  brief's "less on screen", which the a variants share: one control row and the view gets
  the plot. The b variants are real alternatives, not straw men. Each has one idea worth
  keeping:
  - the ladder's "Before slip" column;
  - the Polar map's taller map;
  - the porthole presets;
  - the steering plan.
- **The foldable timeline is a shell change** beyond the approved C2 shell. I added it
  because the review showed that side panels alone cannot give the maps and 3D scenes
  height.

## How these were made

- The eight pages are self-contained. They are generated from one shared shell plus one
  view script each, but every page inlines all its CSS and JS and needs no build.
- The only network request is the Jost font from Google Fonts, as on every C2 page.
- Checked by eye at 1440 × 900 in a browser, for every frame.
- Every page was also checked for console errors, horizontal overflow and folding with
  <kbd>[</kbd> and <kbd>]</kbd>.
- The `impeccable` detector reports 2 advisory findings, both the proposed height-ramp
  colour (one per Local terrain page), and no warnings. A first run found 11 advisories;
  the other 9 were fixed: an off-scale radius, a raw `#ffffff` and swatch radii.

## Independent review, and what changed

A separate reviewer saw the pages and the brief, but not my notes. It scored the set 28/40
on Nielsen's heuristics. It judged the views specific to this product, and both 3D views to
read as 3D at a glance.

**Fixed after the review:**

| Was | Now |
| :--- | :--- |
| The timeline stayed on 01 Mar after a slip (P0) | It follows the landing date |
| The views were height-starved (P1) | The timeline folds |
| Nudge changes were in status colours | They are in ink, with an arrow and a word |
| Folded labels "MM" and "Mo" were easy to confuse | They are now "Mal" and "Mou" |
| The b columns hid True scale, Watch a month and Lander's eye below a scroll | Those columns are reordered |
| The scene said "1% of the disc" while the timeline said "Disc fraction 0.01" | Both now use the disc fraction |
| The Polar map popover named no source | It names NASA's average maps |
| The lit terrain was a flat blob | It keeps its relief shading |
| The System view did not mark the pole | It has a "South pole" label |

**Not changed, on purpose:**

- **The slope overlay's status hues.** They are what the spec asks for. They are flagged
  above as a question for the lead.
- **The sentence under the tabs.** It stays the two-sentence `explain.ts` text the brief
  asked for.
- **The folded focused-site strip reads bottom to top.** That is how vertical text in a
  48 px strip reads. The lamp at the top carries the status at a glance.
- **The Polar map b column still scrolls** to "New site here?" and "Off this map" with the
  panels open.
