---
name: TrueSouth
description: A lunar south pole landing site navigator. Mission Control and Academy share one calm, dark instrument look.
colors:
  bg: "#0b0b0c"
  surface: "#141415"
  raised: "#1b1b1d"
  hover: "#232326"
  line: "#262629"
  line-strong: "#37373b"
  ink: "#ececee"
  ink-2: "#b3b3b8"
  ink-3: "#8c8c93"
  ink-4: "#5c5c63"
  moonlight: "#f3efe6"
  moonlight-ink: "#141414"
  sun: "#ffe2a0"
  sun-core: "#fff4d8"
  earth: "#6cc4ff"
  earth-core: "#9fdbff"
  status-go: "#45c98b"
  status-caution: "#f2a33a"
  status-nogo: "#f0646d"
  plot: "#0e0e0f"
  terrain: "#1d1d20"
  terrain-rim: "#a8a8af"
  shadow: "rgba(0,0,0,0.45)"
  luna-body: "#d8d5ce"
  luna-crater: "#b2afa8"
  luna-feature: "#18181a"
  luna-sparkle: "#fffaf0"
  luna-tear: "#a6d2ef"
  speech-bg: "#1f1f22"
  celebrate-1: "#f3efe6"
  celebrate-2: "#ffd36b"
  celebrate-3: "#8fd6ff"
  celebrate-4: "#ff9ec4"
  celebrate-5: "#c9c9cf"
typography:
  display:
    fontFamily: "Jost Variable, Jost, Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "44px"
    fontWeight: 500
    lineHeight: 1.1
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Jost Variable, Jost, Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "32px"
    fontWeight: 600
    lineHeight: 1.1
  title:
    fontFamily: "Jost Variable, Jost, Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: 1.2
  status:
    fontFamily: "Jost Variable, Jost, Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1
  lead:
    fontFamily: "Jost Variable, Jost, Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.5
  body:
    fontFamily: "Jost Variable, Jost, Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.4
    fontFeature: "tnum"
  label:
    fontFamily: "Jost Variable, Jost, Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.4
rounded:
  sm: "6px"
  md: "10px"
  lg: "14px"
  pill: "999px"
spacing:
  s1: "4px"
  s2: "8px"
  s3: "12px"
  s4: "16px"
  s5: "24px"
  s6: "32px"
  s7: "48px"
components:
  panel:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "16px"
  card:
    backgroundColor: "{colors.raised}"
    rounded: "{rounded.md}"
    padding: "12px 16px"
  button-secondary:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink-2}"
    rounded: "{rounded.sm}"
    height: "28px"
    padding: "0 10px"
  button-secondary-hover:
    backgroundColor: "{colors.hover}"
    textColor: "{colors.ink}"
  mode-switch-selected:
    backgroundColor: "{colors.moonlight}"
    textColor: "{colors.moonlight-ink}"
    rounded: "{rounded.pill}"
    height: "28px"
  view-tab-selected:
    backgroundColor: "{colors.raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
  provenance-tag:
    textColor: "{colors.ink-3}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    height: "18px"
    padding: "0 6px"
  status-lamp:
    size: "16px"
    rounded: "{rounded.pill}"
  scrubber-pill:
    backgroundColor: "{colors.moonlight}"
    textColor: "{colors.moonlight-ink}"
    rounded: "{rounded.pill}"
---

<!-- Recorded from the direction C2 prototypes in design/variants/*/c2/ (November 2026), and
updated from the first build of C2 in web/ (work package MC4a). The team lead picked C2
and asked for collapsible side panels. Tokens live in web/src/app/theme.css; shared
components in web/src/components/. Updated 2026-11-13 for the space-first Mission Control
layout (docs/decisions/0013-space-first-mission-control.md), from the designer's notes in
design/variants/c2-space-first.md. Only the layout, the scene and the rules that guard them
changed. -->

# Design System: TrueSouth

## Overview

**Creative North Star: "The Calm Instrument"**

TrueSouth is a well-made instrument for reading the sky at the lunar south pole. The tool
recedes and the data speaks.

The surfaces are neutral, near-black greys with almost no hue. The only colours on screen
carry meaning:

- the Sun's cream;
- Earth's sky blue;
- the three statuses, GO, CAUTION and NO-GO.

Depth comes from tonal steps between grey surfaces, not from shadow, glass or glow.

Mission Control is dense and calm. Behind everything is the scene: a 3D photograph of the
Sun, Earth and Moon. The panels float above it, each only as tall as its content, so the
scene gets the room. Each view says in one sentence what the user is looking at, behind
the small info button on its tab, so the sentence never takes room from the scene. Detail
waits behind a disclosure until it is asked for.

The Academy uses the same tokens with more air: larger type, rounder cards and bigger
buttons. Rounded corners and the geometric Jost face keep both modes friendly. The round
porthole and the flat status lamp are the shared signature shapes.

Rejected, at the team lead's request: purple, indigo or violet anywhere; glow on panels,
chips, buttons, lamps or text; starfields behind data; all-caps letter-spaced labels; and
showing everything at full volume. The scene's only stars are the real sky behind the
3D scene, added at the team lead's request (2026-11-13): faint points from a star
catalogue, never a decorative starfield behind the interface's data.

**Key Characteristics:**
- Neutral near-black greys with tonal depth.
- One achromatic accent, moonlight white, used only for what the user controls.
- Data colours (Sun, Earth, status) are the only hues.
- Sentence case everywhere. Only GO, CAUTION, NO-GO and true acronyms are in capitals.
- Floating panels, 16 px from the window edge and from each other, 14 px corners, sized to
  their content.
- A scene behind the interface, treated as a photograph of space. The interface stays flat.
- Every view has one plain sentence, one tap away on its tab.

## Colors

A grey instrument whose only hues are data.

### Primary
- **Moonlight** (`moonlight`): a slightly warm white, the colour of sunlit regolith. It
  marks only what the user controls:
  - the active mode;
  - the selected tab's underline;
  - the scrubber and its time pill;
  - the play button;
  - focus rings;
  - text selection.

  Text on it is **Moonlight Ink** (`moonlight-ink`).

### Secondary
- **Sun Cream** (`sun`, disc `sun-core`): the Sun band, the Sun's path and the Sun icon.
- **Earth Sky** (`earth`, disc `earth-core`): the Earth band, Earth's path and the antenna mask.

### Tertiary
- **GO Green** (`status-go`), **CAUTION Amber** (`status-caution`), **NO-GO Red**
  (`status-nogo`): statuses only, plus the amber "under 6 h" countdown, red
  broken-rule outlines, and the Academy's green "Correct" check (see "Academy scale").
  Always paired with a word or a glyph.

### Neutral
- **Night** (`bg`): the page, the gutters between panels, and the scene's clear colour
  (proposed token `--space`, the same value), so a panel looks the same over empty space.
- **Panel** (`surface`): floating panels, always opaque.
- **Raised** (`raised`): cards and controls inside a panel, and the selected tab.
- **Hover** (`hover`): hover fills, the focused row and meter tracks.
- **Hairline** (`line`), **Control Edge** (`line-strong`): borders and dividers.
- **Ink**, **Ink 2**, **Ink 3** (`ink`, `ink-2`, `ink-3`): primary, secondary and label
  text. Ink 3 is at least 4.69:1 on every surface.
- **Ink 4** (`ink-4`): disabled controls only.
- **Sky** (`plot`), **Ground** (`terrain`), **Ridge Line** (`terrain-rim`): chart and
  panorama backgrounds, the skyline silhouette, and its edge.
- **Shadow** (`shadow`): only in the popover shadow (see Elevation).

### Luna and the Academy
Luna's art and celebrations are the one place where hue is decoration, and only inside
the Academy:
- **Luna** (`luna-body`, `luna-crater`, `luna-feature`, `luna-sparkle`, `luna-tear`): a warm
  regolith grey face, darker craters, near-black features, a warm white sparkle and a pale
  tear that is lighter than Earth's blue.
- **Speech bubble** (`speech-bg`, with the Control Edge border and Ink text).
- **Celebration** (`celebrate-1` to `celebrate-5`): moonlight, gold, light sky, rose and
  silver. None of them is a status colour, so confetti is never read as GO or NO-GO.

### Named Rules
**The Only Hues Are Data Rule.** Any colour with a hue must be the Sun, Earth or a status.
Interface chrome is grey, and the accent is white.

**The No Purple Rule.** Nothing in the purple, indigo or violet range: no background,
border, focus ring, chart line or illustration detail.

## Typography

**Display Font:** Jost (with Futura, Century Gothic, Avenir Next, Trebuchet MS, system-ui)
**Body Font:** Jost
**Label/Mono Font:** none. Numbers use tabular figures in Jost.

Jost is self-hosted from the `@fontsource-variable/jost` package (one variable file per
script, weights 400–600 used), so the app works offline and in the production container.
The CSS family name is "Jost Variable".

**Character:** a Futura revival, the face on the Apollo 11 plaque. It is geometric and
round, so it reads technical in Mission Control and friendly in the Academy.

### Hierarchy
- **Display** (500, 44px, 1.1): the start-screen headline only.
- **Headline** (600, 32px, 1.1): close-study page titles and large countdowns.
- **Status** (600, 24px, 1): the status word, the broken rule's value, countdowns in the
  shell, and door titles.
- **Title** (600, 18px, 1.2): site names and section titles.
- **Lead** (400, 15px, 1.5): panel titles and Academy body. Maximum 72ch.
- **Body** (400, 13px, 1.4): Mission Control text.
- **Label** (400, 12px): captions, tags, legends and tab lines. This is the HTML floor.
  SVG axis ticks may use 11px.

**Numbers and units.** A unit follows its number after a narrow no-break space, at the
same size, as in "31 h". Only a display number (the broken rule's value, a countdown) sets
its unit at 0.7em in Ink 2. Degrees attach with no space: "3.1°". Negative numbers use a
true minus sign.

### Named Rules
**The Sentence Case Rule.** No `text-transform: uppercase` and no letter-spacing on labels.
Capitals are kept for GO, CAUTION, NO-GO and real acronyms (UTC, DEM, NASA).

**The No Eyebrow Rule.** No small label above a heading. The heading carries its own
weight.

## Layout

The Mission Control shell fills the window (at least 1024 × 640). The scene is the main
view and fills the whole window. Every panel floats above it:

| Element | Size |
| :--- | :--- |
| Scene | the whole window |
| App bar: three floating blocks (brand and mode, profile, share), 12px from the top | 44px tall |
| View bar, under the app bar (nothing is drawn under it but a notice about the link) | 44px tall |
| Sites rail | 256px open, 48px collapsed |
| Focused-site panel | 328px open, 48px collapsed |
| Timeline strip, along the bottom, its header starting with the landing date | 196px open, 52px folded |
| Footer line | 20px |
| Floating window (Compare) | at most 1120px wide, between the view bar and the timeline |
| Landing-date panel (Slip Planner), in the timeline's slot | as tall as its content |

**Floating panels.** Every panel keeps a 16px margin (8px on a phone) from the window edge
and from the other panels. A side panel is only as tall as its content, so the scene shows
below it. The scene is the main view: nothing frames it. The scene's camera centres the
Moon in the free space between the panels, so a panel never covers the Moon.

**Collapsing the side panels.** Each side panel has a toggle at its top (also the keys
`[` and `]`). Collapsed, it keeps a 48px slim rail: the toggle on top, then the status
lamps. The sites rail keeps one lamp per site, each still focusing its site; the
focused-site panel keeps the focused site's lamp, with its name and verdict written down the
rail (as in the prototype). The timeline folds to one row. The scene
takes all the freed room: its centre slides to the new free space, and with everything
folded the home camera moves in so the Moon fills the window. The change animates in 200ms with an ease-out and does not animate under
reduced motion. The collapsed state is view state, kept in local storage, not in the
scenario or the URL.

**The view stacks, top to bottom, over the scene:**

1. the view bar (five scene views, the current one with its info button, a divider, one
   window button);
2. the scene, with its labels and pins on plates;
3. one control row, floating at the foot of the free space;
4. one legend line;
5. any explanation card;
6. the timeline strip.

**The focused-site panel stacks:**

1. the status;
2. the broken rule;
3. the passing rules;
4. a closed metrics disclosure;
5. links.

Close-study and Academy pages use a 1440px maximum width with 32px page padding and 24px
panel padding. Spacing follows the scale: 4, 8, 12, 16, 24, 32 and 48px.

### The scene

The scene is a photograph of space: NASA's Moon and Earth textures and a Sun drawn in code.
The rules that keep it from spoiling the instrument:

- **The interface stays flat.** The scene gets no tonal steps, borders or panels of its own.
  Nothing in the interface imitates it: no gradients, glow or glass.
- **Text over the scene sits on a plate.** A plate is `--surface` at 92% opacity
  (proposed token `--plate`). Over pure white it blends to grey 39, so Ink is then 12.7:1,
  Ink 2 7.1:1 and the NO-GO red 4.8:1. Labels drawn on the scene use only Ink, Ink 2 and
  the data colours, never Ink 3.
- **Panels are opaque.** Their contrast is the one measured on `--surface`, and nothing in
  the scene can change it. See-through panels were tried and rejected: over a bright Moon
  they had to turn almost solid.
- **The Moon's brightness rolls off softly,** so a face-on Moon never clips to white.
- **Real stars only, and quiet:** the bright-star catalogue as faint points, sized by
  magnitude, with no glow or twinkling, dimmer when the lit Moon fills the view. See
  docs/features/system-view.md, "What it shows".
- **The Only Hues Are Data Rule applies to the interface,** not to the photograph. The
  scene's blues, greys and warm Sun are NASA data, not chrome.
- **Shadows and shading in the scene are decoration.** They never decide a result.

### Proposed tokens for the scene

Proposed by the designer; no existing token changes. They live in `web/src/app/theme.css`
when adopted. Adopted in MC4c: `--space`, `--float-gap` and `--plate`. The popover shadow
keeps its existing name, `--shadow-popover`, and `--ease-out` and `--dur-panel` already
existed.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--space` | `#0b0b0c` | The scene's clear colour. It equals Night. |
| `--float-gap` | `16px` (8px on the phone) | The margin around every floating panel. |
| `--plate` | `rgba(20,20,21,.92)` | The plate behind any text over the scene. |
| `--panel-alpha` | `1` | Panel opacity. Only the rejected see-through option changed it, so it may be dropped. |
| `--shadow-pop` | `0 8px 20px rgba(0,0,0,.45)` | The existing popover shadow, now named. Used on the floating window. |
| `--ease-out`, `--dur-panel` | `cubic-bezier(.2,.7,.2,1)`, `200ms` | Panel folding, as approved, now named. |

### Academy scale

The Academy uses the same colours and a docked grid (panels 8px apart, 14px corners, as
Mission Control had before the space-first layout), with more air. These tokens are in the "Academy" block of
`web/src/app/theme.css`. They come from the designer's notes,
`design/variants/c2-academy.md`.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--t-ac` | 18px | Lesson body and answers |
| `--t-ac-min` | 16px | The floor for lesson text on a phone |
| `--t-ac-say` | 20px | Luna's current bubble |
| `--t-ac-title` | 28px | Path and lesson titles |
| `--r-xl` | 20px | Academy cards and bubbles |
| `--s8` | 64px | Large Academy spacing |
| `--h-xl` | 56px | Big buttons: Check, Continue, Start, Next |
| `--h-opt` | 64px | Answer options (56px in the lesson's conversation panel) |
| `--ease-ac` | `cubic-bezier(.16,1,.3,1)` | All Academy motion. An ease-out with no bounce. |

`--ease-ac` has its own name because `--ease-out` is already Mission Control's curve.

**The Academy's "correct" mark** is a GO Green check glyph with the word "Correct". It is a
bare check, never a filled disc, so it cannot be read as a status lamp. A miss is never
red: the missed answer is dashed and crossed out. An answer that had to be shown gets a
grey ring with an eye.

## Elevation & Depth

Flat by default. Depth comes from tonal layering: Night under Panel, Panel under Raised,
and Raised under Hover. Each layer has a 1px hairline. There is no backdrop blur, no
gradient wash, no glow, and no decorative starfield. The scene behind the interface is a photograph;
the interface stays flat above it. A floating panel has a 1px Control Edge border, because
the scene needs the firmer edge, and no shadow.

### Shadow Vocabulary
- **Popover** (`box-shadow: 0 8px 20px rgba(0,0,0,0.45)`): the only shadow. It is used for a
  hover readout or popover that floats over a plot, and for the floating window.

### Named Rules
**The No Glow Rule.** Panels, chips, buttons, lamps and text never glow. The Sun's disc may
take a faint, small halo only if a drawing reads worse without it. The C2 prototypes use
none. One exception: the scene's Sun is a disc with a short warm edge that ends by 1.8 disc
radii. It is part of the photograph, not of the interface, and it is not a halo.

## Shapes

Rounded and friendly, never bubbly:

| Element | Radius |
| :--- | :--- |
| Panels | 14px |
| Cards, inputs and plot frames | 10px |
| Buttons and keys | 6px |
| Segmented controls, tags, lamps and door buttons | full pills |

The round porthole is the signature shape. It frames the start-screen doors, the
true-shape close-ups and future Academy lesson scenes. Borders are 1px; the one
exception is the 2px red outline of a broken-rule stretch. No coloured side borders.

## Components

### Buttons
- **Shape:** gently rounded (6px). Door buttons on the start screen are pills (999px).
- **Secondary (default):** grey text on the panel, a 1px Control Edge border, 28–30px tall.
- **Hover / Focus:** Hover fill and Ink text. Focus is a 2px Moonlight outline, offset 2px.
- **Play:** a Moonlight circle with a dark triangle.

### Chips
- **Provenance tag:** 12px Ink 3 text in a pill.
  - **Sourced:** a solid outline and a small up-right arrow icon; it links to the source.
  - **Assumed:** a dashed outline.
  - Quiet on purpose, and never coloured.
- **3D badge:** removed. Everything behind the interface is 3D now.

### Cards / Containers
- **Corner Style:** 14px for panels, 10px for cards inside them.
- **Background:** Panel, then Raised.
- **Shadow Strategy:** none (see Elevation).
- **Border:** a 1px Hairline. A broken-rule card has a 1px NO-GO Red border at 45%.
  A countdown under 6 hours has a CAUTION Amber border.
- **Internal Padding:** 12–16px.

### Navigation
- **Mode switch:** a pill segmented control. The selected mode is filled Moonlight with
  dark text.
- **View bar:** a floating panel holding the five scene views as tabs (a Raised fill and a
  2px Moonlight underline on the selected one), a hairline divider, then the window button,
  Compare, with a small window icon and `aria-expanded`. The Slip Planner is the third tab,
  between the Polar map and Local terrain. The tabs have a name only; the old "what it is for" lines are gone. The current tab
  shares its Raised fill with a small info button (28px, 44px on a phone) whose tip holds the
  view's text, and the view's first sentence is the tab's accessible description. On a phone the bar scrolls sideways and every tab is at
  least 44px tall.
- **Panel toggle:** a 28px borderless icon button (panel-close or panel-open icon) in Ink 3.

### Tips
- **Bubble:** Raised fill, a 1px Control Edge border, 10px corners, 13px Ink text, at most
  300px wide, with the popover shadow. It sits above its trigger, or below when there is no
  room, and never clips inside a panel.
- **Explain:** a 14px info icon in Ink 3 after a label (24px target). It opens the term's
  text from `explain.ts` and, when there is one, a "Learn it in Academy lesson N" link.
  It opens on hover or keyboard focus, pins on click, and closes on Escape.
- **Provenance tag tips:** sourced shows the quote and the source's host; assumed shows
  the reason.

### Floating panel, plate and scene parts
- **Floating panel:** a `--surface` fill, a 1px Control Edge border and 14px corners.
- **Scene label:** a plate with one 13px line and an optional 12px Ink 2 line, kept inside
  the free space and moved to avoid other labels.
- **Pin:** a status lamp with a 2px Night ring. The focused pin adds a Moonlight ring and a
  name plate. Pins closer than 18px fold into the focused pin, which says "and N more sites
  here". Pins are not in the tab order; the sites rail is the keyboard path.
- **Sight-line:** a line from the site along the true direction. Solid GO Green when lit or
  linked, dashed NO-GO Red when not, with a plate carrying a lamp, a word and the state.
- **Sun edge marker:** an upright Sun icon and an arrow that rotates toward the off-screen
  Sun.
- **Floating window:** a floating panel with the popover shadow, `role="dialog"` and
  `aria-modal="false"`. Escape closes it and focus returns to its button. Only Compare is one.
- **Spot** (Slip Planner): an SVG of 32px (44px on a phone), a button with `data-site`, out of
  the tab order like the pins.
  - A Night disc at 85%, radius 13.5; a score track in Control Edge, radius 12, 2px; a score
    arc in Ink, whose length is the score out of 100 and which is absent for NO-GO; the
    status disc, radius 8, with the Night cut glyph.
  - When focused, an outer Moonlight ring at radius 17.5 over a Night disc of 18.6, so the
    focus ring is not read as a full score.
  - `--spot-r` (`15px`) is the radius used to place labels. A spot label is a scene label:
    line one is the name, plus the status word when it is loud; small lines carry the reason,
    "was …" and a variant's distance and tag. It is placed right, left, below or above, or as
    a callout with a hairline (Ink 2 over a Night under-stroke).
  - The "chosen by TrueSouth" tag, for a best-lit variant, is a 1px dotted Ink 3 outline.
    Dashed already means assumed.
- **Landing-date panel** (Slip Planner): a floating panel in the timeline's slot, sized to its
  content.
  - **Header:** "Landing dates", the mission window, a one-line key, the zoom control and the
    fold button. A 2px progress bar runs along the top while the sweep runs.
  - **Grid:** label (208px) | strips | "next GO" (136px).
  - **Strip:** a `--plot` background and `--dt-h` tall (`14px`; 12px with seven or eight
    sites, 18px with one), with `--dt-g` between strips (`7px`; 5px with seven or eight).
    GO is full height, CAUTION half height, NO-GO a 2.4px red line at 80%, and no data a 1px
    Ink 4 line.
  - **Over the strips:** the slider (a Moonlight line and pill), the mission-window band
    (Moonlight at 14%, with Ink 3 edges), the "was" line (dashed Ink 2) and the reading point
    (a 1.5px Ink outline).
- **Slip summary:** a plate at the foot of the free space, shown only after a slip.
- **Still picture:** an `<img>` behind the interface and a note with "Try 3D anyway", when
  WebGL is missing or slow.

### Status lamp
A flat circle in the status colour with a dark cut glyph: ✓, ! or ✕. It is 16px in lists
and 24px in the status block, and always sits next to the status word. No ring, gradient
or glow.

### Timeline
- **Bands:** Sun and Earth bands on Sky wells.
- **Longest stretches:** outlined. Dashed Ink 2 when the stretch is within its limit;
  solid 2px NO-GO Red, labelled with a NO-GO lamp, when it breaks one.
- **Scrubber:** a Moonlight line and knob, with a pill showing the mission day and UTC
  time.
- **Landing date:** the first thing in the strip's header, where the mission window
  begins: a "Landing date" label, the date in a Raised box between two day buttons, the
  window's end and length in Ink 2 with the duration's provenance tag ("→ 11 Mar · 10 d
  [sourced]"), and "Next GO" (a secondary button). The slip buttons are in the date's
  picker. After "Next GO" a tip-style bubble (Raised,
  Control Edge, the popover shadow) says where the landing moved, with "Undo".

## Do's and Don'ts

### Do:
- **Do** give every view one plain sentence saying what the user is looking at, behind the
  info button on its tab.
- **Do** lead the focused-site panel with the status and the rule that is broken, and put
  the remaining metrics behind a disclosure.
- **Do** tag every mission-profile value as sourced or assumed, quietly.
- **Do** give every number a unit, and say "UTC" on every time.
- **Do** keep text at or above 4.5:1. Ink 3 is the faintest text colour.
- **Do** put text drawn over the scene on a plate.

### Don't:
- **Don't** use purple, indigo or violet, or any gradient as decoration.
- **Don't** add glow, glass, backdrop blur or a decorative starfield (the scene's catalogue
  stars are the one sky there is).
- **Don't** write labels in capitals or letter-space them. Only GO, CAUTION, NO-GO and
  acronyms are in capitals.
- **Don't** make a panel see-through, or let the scene decide a contrast ratio.
- **Don't** draw text straight on the scene without a plate.
- **Don't** repeat a chip, tag or legend that is already on screen.
- **Don't** show a status by colour alone.
