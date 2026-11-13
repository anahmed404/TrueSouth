# Direction C2, space-first: a 3D scene behind a floating interface

A working prototype of the lead's new direction for Mission Control. It is throwaway: mock
data, three.js from a CDN, nothing final. Open
[`space-first/index.html`](space-first/index.html) over http (`python -m http.server` from the
repo root). The browser refuses `file:`, and the textures need http.

## The direction in a few sentences

The System view is now home. A live Sun, Earth and Moon fill the whole window. The C2
interface floats above it, in the same places as before. Picking a view moves the camera:
it flies under the south pole for the Polar map, down to the site for Local terrain, and to
2 m above the ground for Lander's eye. The Slip Planner and Compare open as floating windows.
The scene is treated as a photograph of space. The interface stays flat and calm.

## What changed from the approved shell, and why

| Before (docked C2) | Now | Why |
| :--- | :--- | :--- |
| Docked panels, 8 px apart; nothing over the main view | Each panel floats with a 16 px margin. Side panels are only as tall as their content, so the scene shows below them | The lead asked for the scene behind and the interface above it. A docked look with gaps cut into it did not read as floating, so the panels shrink to their content. |
| Six two-line tabs inside the main view | One floating view bar: four scene views, then the two windows, each window marked with a small window icon | The tabs' purpose lines are gone: each view's sentence does that job, and the bar has to fit between the side panels. |
| The view's sentence, controls and legend inside a main panel | The sentence sits on a plate under the view bar. The controls float at the foot of the free space | The scene is the main view, so nothing frames it. |
| Six views | Four camera views and two windows | Slip Planner and Compare are tables, not places, so they open over the scene and leave the camera where it is. |
| System view was one tab among six | It is the home screen | The lead's direction. |
| The 3D badges | Removed | Everything behind the interface is 3D now. |

Kept as approved: the C2 tokens, Jost, lamps with cut glyphs, provenance tags, the
focused-site panel's order (status, broken rule, passing rules, metrics, links), the timeline
and its countdown cards, the folded rails with lamps, and the `[` and `]` keys.

## The two choices for the lead

Both are live in **Design options** (bottom right, dashed, marked prototype-only).

1. **Panel surface: solid (recommended) or see-through.**
   - See-through panels start at 80 % opacity. A probe renders the scene at 160 × 100
     after it settles and finds the brightest pixel under each panel. It then raises that
     panel's opacity until the faintest text (Ink 3) still meets 4.5:1. Over a bright Moon
     or Earth, the panels rise to about 94 %, which is nearly solid.
   - So see-through only shows over dark space, where there is nothing to see. Over
     anything interesting it has to turn solid. Moving shapes behind text also make reading
     harder, even when the contrast passes.
   - Solid panels are calmer, need no probe, and still float, because the margins and the
     scene around them do that work. **Recommendation: solid.**
2. **The move to the pole: one flight (recommended) or a cross-fade.**
   - **One flight:** the camera flies under the pole in 1.3 s. In the last 45 % of the move,
     the cap's lighting blends from the real Sun to the map's fixed top-left lighting. At the
     end, the flat map replaces the globe in a 260 ms fade.
   - The two line up: from that pose, the globe's view and the stereographic map differ by
     less than 0.3 % near the sites and about 1 % at 80°S, so the swap is not visible.
   - **Cross-fade:** the map fades in over the globe in 400 ms, with no camera move.
   - **Recommendation: one flight.** It shows where the map is on the Moon, which is the
     point of a space-first home. The cross-fade remains the reduced-motion path.

## What each view becomes

| View | Camera | What is on screen |
| :--- | :--- | :--- |
| System view (home) | From under the south pole, turned so Earth and the Sun sit either side of the Moon. Drag to turn, scroll to zoom (down to 60 km). Presets: South pole, From Earth, From the Sun, Follow site. True scale on a toggle. | The sentence; "Distances not to scale. Every direction is true."; the focused pin, with "and 3 more sites here" when pins crowd; two sight-lines labelled "To the Sun: dark" and "To Earth: link" (colour and dash from the series); Earth and Sun labels; an edge marker when the Sun is off screen. |
| Polar map | Flies under the pole; then the flat map (a 2D canvas) takes over. Drag to pan, scroll or +/− to zoom. | The pipeline's 80 m shaded relief, with a sharper core near the pole; latitude rings every degree; longitude lines every 30°; feature names; pins named by status; overlays for average sunlight (Sun cream) and Earth visibility (Earth blue) with an opacity slider; the scale bar ("north is outward from the pole"). Click the ground for "New site here?" with NASA's average values. Drag the focused pin to nudge it: "Average sunlight 83 % → 55 %, lower". |
| Local terrain | Descends to 19 km from the site, 22° up, turned so both sight-lines run away from you. Drag to orbit, scroll to zoom. | The 20 km patch at 80 m (257 × 257) sits inside a 300 km apron from the same map, out to the curved horizon, so it reads as part of the Moon. The 20 km square is outlined in Ridge Line grey. Shadows come from a horizon march over the real heights. The series' answer is on a plate: "The series says: dark… Shading and shadows here are drawn for understanding only." Colour: regolith, slope (GO/CAUTION/NO-GO thresholds 5° and 10°), height. Heights ×1, ×2, ×5. |
| Lander's eye | Drops to 2 m above the site with a 26° lens, centred on Earth, the Sun or north. Drag to look around. | The real horizon. Earth and the Sun at true angular size, each labelled with its height and state. Under them, the approved horizon chart (heights ×12) with "Why is it dark?". |
| Slip Planner (window) | No camera move | Variant a's heatmap, overview bar, zoom (3 months, 18 months, 6 years), hover readout, and slip card ("Connecting Ridge slipped +21 d: 01 Mar → 22 Mar, NO-GO → GO, score 77"). Click a square to land on that date and focus that site. |
| Compare (window) | No camera move | The summary sentence; four matching columns; "best" marks; the deciding row raised. Click a column name to focus that site. |

**Empty and edge states:**

- **Apollo 11 (sphere tier):** Local terrain and Lander's eye say "No terrain data for
  Apollo 11…" and offer "Show Apollo 11 in the System view". The camera follows the site
  on the globe instead of descending.
- **Textures loading:** the Moon is drawn plain grey with the same lighting. It starts at
  2K and swaps to 4K.
- **No WebGL, or a slow first flight** (median frame over 55 ms): the scene is replaced by a
  still picture, with "Try 3D anyway". Everything else keeps working.

All three can be shown from Design options.

## Motion

- Camera moves take 1.3 to 1.5 s with an ease-in-out cubic curve. The path keeps the
  camera's direction from the Moon's centre on a great circle and changes altitude
  logarithmically, so it never passes through the Moon.
- A drag, a scroll or another pick interrupts a move and starts from where the camera is.
- The first load eases in from 1.5 times the distance over 1.4 s. That move also measures
  frame times for the still-image fallback.
- Panels fold in 200 ms, and the camera's centre slides to the new free space at the same
  time. With everything folded, the home camera moves in so the Moon fills the room.
- Windows open with a 180 ms rise and fade.
- **Reduce motion** (the OS setting or Design options): every camera move becomes a 120 ms
  dip through Night and a cut. The pole move becomes a cross-fade. Panel and window
  animations are removed.

## Textures and page weight

| File | Size | Notes |
| :--- | ---: | :--- |
| Moon colour, 2K / 4K / 8K | 0.24 / 0.99 / 3.0 MB | 8K is split into two 4,096-pixel halves. |
| Moon heights (1,440 × 720) | 0.49 MB | Relief along the day/night line. |
| Cap shaded relief 4K + core | 1.28 + 0.25 MB | From the pipeline (PR #48). |
| Cap slopes + core | 0.72 + 0.74 MB | New: lets the real Sun light real relief inside 80°S. |
| Earth, Blue Marble March | 0.33 MB | |
| Map overlays, sunlight + Earth visibility | 0.57 + 0.52 MB | Loaded after the first paint. |
| Terrain, per polar site | 0.18 MB | Loaded for the focused site only. |
| Still picture | 0.01 MB | |

- **Assets folder:** 9.5 MB in total; the largest file is 1.56 MB.
- **First load:** 5.4 MB of images and terrain, plus 0.4 MB of code and fonts (three.js
  r160 is 249 KB compressed). The map overlays add 1.1 MB about 1.5 s later.
- **Is 8K worth it?** Not as the default.
  [`space-moon-4k-vs-8k.png`](../../docs/design/c2/space-moon-4k-vs-8k.png) shows Tycho
  close up. 8K is clearly sharper there, but it triples the Moon's weight, and at home zoom
  the two look the same.
- **What actually fixes the "low resolution Moon":** the polar cap. The 80 m relief and
  slopes make the zoom end on sharp craters
  ([`space-pole-zoom.png`](../../docs/design/c2/space-pole-zoom.png)). Load 8K only after a
  deep zoom away from the pole.

## Frame rate (this machine, 1440 × 900)

- **Machine:** NVIDIA RTX 2060 desktop GPU (ANGLE, Direct3D 11), Chromium, device pixel
  ratio 1.
- **Method:** the benchmark turns the camera every frame for 4 to 5 s.

| Case | Frames per second | Median frame | 95th percentile |
| :--- | ---: | ---: | ---: |
| System view, panels open | 239 | 4.2 ms | 4.3 ms |
| System view, panels folded | 230 | 4.2 ms | 4.3 ms |
| Local terrain, orbiting | 240 | 4.2 ms | 4.3 ms |
| System view at pixel ratio 2 | 240 | 4.2 ms | 4.3 ms |

- Every case is capped by the display's 240 Hz refresh, so the scene costs less than 4 ms a
  frame here.
- When nothing moves, the page renders nothing: 0 frames in 2 s.
- Rendering stops when the tab is hidden.
- **Still to measure:** a weak laptop with built-in graphics. The fallback threshold (a
  median frame over 55 ms during the first flight) is a guess.

## Contrast: how it is guaranteed

- **Solid panels:** C2's tokens on `--surface` (`#141415`), with the ratios measured in
  [`direction-c2.md`](direction-c2.md). Ink 3 is at least 4.69:1. Nothing in the scene can
  change that.
- **Text over the scene** (the sentence, labels, pins, the footer): always on a plate of
  `--surface` at 92 % opacity.
  - Over pure white, the plate blends to grey 39. Ink is then 12.7:1, Ink 2 7.1:1, and the
    NO-GO red 4.8:1.
  - Scene labels use only Ink, Ink 2 and data colours, never Ink 3.
- **See-through panels:** the live probe described above.
  - Blending happens in sRGB. Ink 3 passes 4.5:1 while the blended background stays at
    or below grey 34.
  - So the panel's opacity is at least (B − 34) / (B − 20), where B is the brightest
    scene grey under the panel plus a margin of 12.
- **The Moon's brightness:** it rolls off softly, so a face-on Moon never clips to white.

## Components and tokens for the developers

**New tokens** (proposed; no existing token changed):

| Token | Value | Use |
| :--- | :--- | :--- |
| `--space` | `#0b0b0c` | The scene's clear colour. It equals Night, so panels look the same over empty space. |
| `--float-gap` | `16px` (8 px on the phone) | The margin around every floating panel. |
| `--plate` | `rgba(20,20,21,.92)` | The plate behind any text over the scene. |
| `--panel-alpha` | `1` | Panel opacity. The see-through option sets 0.8, and the probe raises it per panel through `--a`. |
| `--shadow-pop` | `0 8px 20px rgba(0,0,0,.45)` | The existing popover shadow, now named. It is used on the two windows and the design options. |
| `--ease-out`, `--dur-panel` | `cubic-bezier(.2,.7,.2,1)`, `200ms` | Panel folding, as approved, now named. |

**Components:**

- **Floating panel:** a `--surface` fill, a 1 px Control Edge border (the scene needs the
  firmer edge), and 14 px corners.
- **View bar:** a floating panel holding the four scene views as approved tabs (a Raised
  fill and a Moonlight underline), a hairline divider, then the two window buttons with a
  window icon and `aria-expanded`.
- **View sentence plate:** 15 px Ink on `--plate`, at most 72ch, centred under the view bar.
- **Scene label:** a plate with one 13 px line and an optional 12 px Ink 2 line. It is kept
  inside the free space and moved down to avoid other labels.
- **Pin:** an approved lamp with a 2 px Night ring.
  - The focused pin adds a Moonlight ring and a name plate.
  - Pins closer than 18 px fold into the focused pin, which says "and N more sites here".
  - Pins are not in the tab order (`tabindex=-1`). The sites panel is the keyboard path.
- **Sight-line:**
  - A WebGL line from the site along the true direction.
  - Solid GO green when the series says lit or linked; dashed NO-GO red when it does not.
  - Its plate carries a lamp, a word and the state.
- **Sun edge marker:** an upright Sun icon and an arrow that rotates toward the off-screen
  Sun.
- **Floating window:** a `--surface` panel with the popover shadow and `role="dialog"` with
  `aria-modal="false"`.
  - It sits between the view bar and the timeline. On the phone it fills the screen.
  - Escape closes it, and focus returns to its button.
- **Design options:** a dashed panel and button. Prototype only; delete before building.
- **Still fallback:** an `<img>` behind the interface and a note with "Try 3D anyway".

**Scene rules for `web/src/features/three/`:**

- One scene in Moon radii, using the logarithmic depth buffer.
- The camera's principal point moves to the centre of the free space through the
  projection matrix, so the Moon is never covered by a panel and there is no crop.
- The local ground sits in the same scene as the globe. The globe discards its pixels under
  the 140 km apron once the ground has dissolved in. The dissolve runs between 52 and 28 km
  altitude, below the System view's zoom limit, so it only happens during flights.

## Decisions I was unsure about

- **The view bar drops the purpose lines.** "Every landing date" and the others are gone.
  The sentence under the bar does that job, and two lines did not fit between the panels.
- **The mock series are reshaped.** Before, the timeline could say NO-GO while the panel
  said GO.
  - Every polar site now uses the approved series' shape, with its own skyline and offsets.
  - The panel, the timeline, the countdowns, Compare and the slip card read the same numbers.
  - The base date still gives NO-GO, GO, CAUTION, CAUTION, as approved.
  - Only the Slip Planner's colours still come from a separate cheap mock sweep, so a
    square can disagree with its own hover.
- **Apollo 11 is NO-GO on 01 Mar here, not GO.** Its series comes from the true geometry,
  and on day 3 its pin is on the Moon's night side. I kept the 3D and the panels in
  agreement rather than keep the old mock value.
- **The Sun is drawn small, with a short warm edge** that ends by 1.8 disc radii, not a halo.
  In the System view it is squeezed to 2.5 Moon radii away like Earth, so it can share the
  frame.
- **Local terrain drops the skyline wall.** The real terrain around the patch is drawn
  instead, out to 150 km. Shadows come from a horizon march over the same heights, which
  replaces the wall's job. It is decoration, and the plate says so.
- **"core80 terrain"** stays in the focused-site header, because it is the CONTEXT.md term.
  The reviewer suggested plainer words.

## What I would still improve

- In Lander's eye, the ground near the lander is a flat grey plane. 80 m data cannot show
  regolith at 2 m. A close-up DEM, where one exists, or a subtle procedural grain labelled
  as decoration, would help.
- Run the Slip Planner's sweep on the real series in a worker, so its colours match the
  panels.
- Measure on a laptop with built-in graphics, and tune the fallback threshold.
- In System view, the scene canvas is the first Tab stop. It should come after the app bar.
- The phone sheet's expand control uses the panel icon. A chevron would say more.
- The Sun's off-screen marker can sit on top of the Sun sight-line's label at some angles.

## Proposed changes to DESIGN.md (not made here)

- **Layout:** replace "Panels sit 8px apart, and nothing floats over the main view" with
  the floating rule: a 16 px margin, panels sized to their content, and the scene as the
  main view.
- **Do's and Don'ts:** replace "Don't float panels or cards over the main view". Add:
  "Text over the scene sits on a plate".
- **Starfield:** "no starfield" stays. The scene has no stars, because a camera exposed for
  a sunlit Moon would not see them.
- **No Glow Rule:** add one exception for the scene's Sun: a disc and an edge that ends by
  1.8 disc radii.

## Review: what the detector and the critique found, and what changed

**The impeccable detector:**

| Finding | What changed |
| :--- | :--- |
| Cramped padding in the app-bar blocks | Fixed: 6 px vertical padding. It still flags the blocks; the pills inside now have room. |
| Tight leading (1.21) | Fixed on the site name and the brand. It still reports one instance: the single-line display numbers at line-height 1, which is approved. |
| An undocumented hatch colour | Replaced with NO-GO red at 16 %. |

**The isolated critique:**

| Finding | What changed |
| :--- | :--- |
| Panels still read as docked columns | They are now sized to their content. |
| The Sun had a halo | Its edge now ends by 1.8 radii. |
| Pins piled up at the pole | Crowded pins fold into the focused pin, which says how many. |
| Sight-line labels repeated the countdown numbers | The labels now say only the state. |
| Keyboard order | Pins are out of the tab order; the scene takes arrow keys and + and −. |
| The Sun marker pointed nowhere | It now has an upright icon plus a rotating arrow. |
| The patch outline used the accent colour | It now uses Ridge Line grey. |
| The honesty line was a bordered chip | It is now plain text. |
| The phone hid the honesty line | It is shown again. |
| The phone hid the countdowns | They are now one line. |
| The phone scrubber was under 44 px | It is now 44 px. |
| "your sites are" | Now "your site is", as approved. |
| The Moon is smaller than before | Not changed. |
| Three styles for "selected" | Not changed. |

The last two findings were noted but left alone. The Moon is sized so Earth and the Sun fit
between the panels, and it grows when they fold. The three "selected" styles are all
approved C2 components.

**My own checks found and fixed:**

- The polar cap read as a flat disc. Fixed with the slope maps.
- Radial streaks at the pole came from the global height map. Fixed by switching it off
  inside the cap.
- A resampling grid showed in the slope map. Fixed with integer block means.
- The ground's dissolve showed as dots when the camera stopped. It now happens only during
  flights.
- A face-on Moon clipped to white. Fixed with the soft roll-off.
- Several labels collided. Fixed by moving them apart.
- The still showed live labels on top of baked ones. Fixed: the still now has none.

## Checks

| Check | Result |
| :--- | :--- |
| Console errors | None, at 1440 × 900 or 390 × 844, across every view, window and design option. |
| Horizontal scroll | None at 1440 or 390. |
| Phone controls | Every control is at least 44 px. |
| Purple, indigo or violet | None. Every colour was checked by hue. The only hit was the random-number constant `0x6D2B79F5`. |
| Capitals and letter-spacing | None, apart from GO, CAUTION, NO-GO and acronyms. |
| Keyboard | Tab reaches all 45 controls, each with a name. Escape closes the popover, then the design options, then a window, and returns focus. |
| Pins on the right ground | Shackleton's 20.92 km rim, drawn from its IAU position with the §2.3 formulas, sits on the crater in the cap image. Connecting Ridge lands on the ridge between Shackleton and de Gerlache. |
| The Sun from the pole | Between −0.04° and 2.41° across the window. |

Screenshots are in [`docs/design/c2/`](../../docs/design/c2/): `space-*.png` and
`flow-mission-control-space.png`. The flow is
[`design/flows/mission-control-space/`](../flows/mission-control-space/index.html).
