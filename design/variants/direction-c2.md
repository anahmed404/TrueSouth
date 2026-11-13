# Direction C2: Night-sky instrument, refined

**The idea in one line:** direction C's instrument, made calm. It is a plain dark tool in
neutral greys. The only colours are the Sun, Earth and the three statuses, the main view
gets the room, and every view says what it is in one sentence.

C2 is a refinement of [direction C](direction-c.md), not a new direction. It keeps C's
content, mock data, states, rounded shapes, Jost type, flat status lamps with cut glyphs,
porthole doors and true-shape close-ups. It drops C's purple ramp, glass, glow, starfield
and capitals, and it docks the Mission Control shell the way direction A does.

Prototypes (static, mock data, open in a browser at 1440 × 900):

| Screen | File |
| :--- | :--- |
| Start screen | [`start/c2/index.html`](start/c2/index.html) |
| Mission Control shell | [`mission-shell/c2/index.html`](mission-shell/c2/index.html) |
| Timeline and countdowns | [`timeline-countdowns/c2/index.html`](timeline-countdowns/c2/index.html) |
| Lander's eye | [`landers-eye/c2/index.html`](landers-eye/c2/index.html) |

The system is also recorded in the repo's root [`DESIGN.md`](../../DESIGN.md), in the
format the `impeccable` design skill reads.

## Palette

These go in `web/src/app/theme.css`. Components use the tokens, never raw values.

| Token | Value | Use |
| :--- | :--- | :--- |
| `--bg` | `#0b0b0c` | Page background, the gutters between docked panels |
| `--surface` | `#141415` | Panels: sites rail, main view, focused-site panel, timeline strip |
| `--raised` | `#1b1b1d` | Cards and wells inside a panel, inputs, the selected tab |
| `--hover` | `#232326` | Hover fill, focused site row, meter track |
| `--line` | `#262629` | Panel and card borders, dividers |
| `--line-strong` | `#37373b` | Control borders, tag outlines |
| `--ink` | `#ececee` | Primary text |
| `--ink-2` | `#b3b3b8` | Secondary text |
| `--ink-3` | `#8c8c93` | Labels, axes, captions (at least 4.69:1 on every surface) |
| `--ink-4` | `#5c5c63` | Disabled controls only, never text that carries meaning |
| `--accent` | `#f3efe6` | Selection, focus ring, scrubber, active mode. Never a status. |
| `--accent-ink` | `#141414` | Text on the accent |
| `--sun` | `#ffe2a0` | Sun band, Sun path, Sun icon |
| `--sun-core` | `#fff4d8` | Sun disc |
| `--earth` | `#6cc4ff` | Earth band, Earth path, antenna mask |
| `--earth-core` | `#9fdbff` | Earth disc |
| `--status-go` | `#45c98b` | GO |
| `--status-caution` | `#f2a33a` | CAUTION, countdown under 6 h |
| `--status-nogo` | `#f0646d` | NO-GO, broken-rule outlines |
| `--plot` | `#0e0e0f` | Chart and panorama background (the sky) |
| `--terrain` | `#1d1d20` | Skyline silhouette fill (flat, no gradient) |
| `--terrain-rim` | `#a8a8af` | Skyline edge line, 1.2–1.3 px |
| `--grid` | `rgba(255,255,255,.06)` | Chart grid lines |

The neutrals have almost no hue (chroma about 0.003), so nothing reads as blue or purple.

**Contrast**, measured with the WCAG formula:

| Pair | Ratio |
| :--- | :--- |
| `--ink` on panels | 13.3–16.7:1 |
| `--ink-2` on panels | 7.5–9.4:1 |
| `--ink-3` on panels | 4.69–5.89:1 |
| `--status-nogo` | at least 5.0:1 |
| `--status-go`, `--status-caution`, `--sun`, `--earth` | at least 7.4:1 |
| `--accent-ink` on `--accent` | 16:1 |
| Lamp glyph `#0b0b0c` on GO, CAUTION and NO-GO | 9.4, 9.4 and 6.3:1 |

### The accent, and why it is moonlight white

Every hue already means something in TrueSouth:

- Sun is yellow.
- Earth is sky blue.
- GO is green.
- CAUTION is amber.
- NO-GO is red.

A coloured accent would collide with one of them:

- **Teal** sits between GO and Earth. A teal scrubber would vanish across the blue Earth band.
- **Orange** reads as CAUTION.
- **Coral** reads as NO-GO.
- **Lime** reads as GO.
- **Purple** was ruled out by the lead.

So the interface's own voice is the one thing that carries no data meaning: brightness. The accent is a slightly warm white, `#f3efe6`, the colour of sunlit regolith.

It marks only what the user controls:

- the active mode;
- the selected tab's underline;
- the scrubber and its time pill;
- the play button;
- the focus ring;
- text selection.

Because it is achromatic, it sits on top of every data colour without being confused with one. It is not in the purple-to-blue range.

If the lead wants a hue after all, the least-bad fallback is a desaturated teal `#7cc7c0`. It would need the scrubber redrawn in white, so we do not recommend it.

## Type

- **Family:** [Jost](https://fonts.google.com/specimen/Jost) from Google Fonts, weights
  400, 500 and 600. It is kept from direction C: Jost is a Futura revival, the face on the
  Apollo 11 plaque, and its round forms carry the Academy's friendliness. Fallback stack:
  `"Jost", "Futura", "Century Gothic", "Avenir Next", "Trebuchet MS", system-ui, sans-serif`.
- Numbers use `font-variant-numeric: tabular-nums`. Units follow a number at 0.7 em in
  `--ink-2`, for example `31` `h`.
- **Sentence case everywhere.** No `text-transform: uppercase` and no letter-spacing on
  labels.
  - The only words in capitals are the status values GO, CAUTION and NO-GO, and real
    acronyms (UTC, DEM, NASA, LOLA).
  - State words are sentence case: Lit, Dark, Link, Blackout, "Under 6 h".
- No eyebrow labels above headings. A heading carries its own weight.

| Token | Size | Use |
| :--- | :--- | :--- |
| `--t-xs` | 11 px | SVG axis ticks only. HTML text never goes below `--t-sm`. |
| `--t-sm` | 12 px | Captions, labels, provenance tags, tab descriptions, legend |
| `--t-md` | 13 px | Mission Control body |
| `--t-lg` | 15 px | Panel titles, the view description sentence, Academy body |
| `--t-xl` | 18 px | Site name, page section titles, brand |
| `--t-2xl` | 24 px | Status word, countdowns in the shell, the broken rule's value, door titles |
| `--t-3xl` | 32 px | Close-study page titles and countdowns |
| `--t-display` | 44 px | Start-screen headline |

Weights: 400 for body, 500 for numbers, names and controls, 600 for titles and status words.

## Spacing, radius, depth

- **Spacing scale:**

  | Token | Value |
  | :--- | :--- |
  | `--s1` | 4 px |
  | `--s2` | 8 px |
  | `--s3` | 12 px |
  | `--s4` | 16 px |
  | `--s5` | 24 px |
  | `--s6` | 32 px |
  | `--s7` | 48 px |

  Panels sit 8 px apart. Panel padding is 16 px in Mission Control and 24 px in close-study and Academy panels.
- **Radius:** this keeps C's rounder character in a calmer form.

  | Token | Value | Use |
  | :--- | :--- | :--- |
  | `--r-sm` | 6 px | Buttons and keys |
  | `--r-md` | 10 px | Cards, inputs, the plot frame |
  | `--r-lg` | 14 px | Panels |
  | `--r-pill` | 999 px | Segmented controls, tags, lamps, door buttons |
- **Depth is tonal, not shadowed.**
  - Panels are flat `--surface` with a 1 px `--line` border. Cards inside them are `--raised`.
  - There is no `backdrop-filter`, no glass, no gradient wash and no glow.
  - One exception: the Lander's eye hover readout, which floats over the plot, has an offset shadow `0 8px 20px rgba(0,0,0,.45)` to lift it.
  - The Sun has no halo. It reads clearly without one, because the label, the blocker ring and the faded below-skyline part of its disc already make it findable.
- No starfield anywhere.

## Layout of the Mission Control shell (1440 × 900)

This is direction A's docked arrangement. Nothing floats over the main view.

| Element | Position | Size |
| :--- | :--- | :--- |
| Top bar | full width, on `--bg` | 52 px tall |
| Sites rail | left | 256 px wide, 620 px tall |
| Main view | middle | 824 px wide, 620 px tall |
| Focused-site panel | right | 328 px wide, 620 px tall |
| Timeline strip | full width, under all three | 196 px tall. The two countdown cards sit at its right end. |
| Footer line | bottom | 24 px |

**Main view, top to bottom:**

1. View tabs. Each tab has its glossary name and a short line saying what it is for. System view and Local terrain carry a "3D" badge with a cube icon.
2. The view's one-sentence description at 15 px.
3. View controls in one row.
4. The plot.
5. A single legend line.
6. The "Why is it dark?" card, docked in the view's own column, not over it.

The panorama draws all 360° at 2.1 px per degree, with heights stretched ×12. The control row says so in words.

**Focused-site panel, top to bottom.** The order follows what the user needs first:

1. Site name, coordinates and terrain tier on one line.
2. Status: lamp, word, and one sentence saying what it means. The unused score is struck through and greyed.
3. **Broken rule:** measured value, limit with its provenance tag, one sentence, and a meter.
4. **Rules that pass:** three one-line rows, each limit with its tag.
5. A closed disclosure, **Mission window metrics**, holding the other eight values and the utilities.
6. Text links to Quickmap and Moon Trek.

**Sites rail:** each row has the name, then a status lamp and word, then one fact: the broken rule, or the score. Tier chips are gone from the rows. A sphere-tier site says "Terrain not modelled" in a third line.

## What each view is: candidate copy for `web/src/lib/explain.ts`

The tab line is the short form shown under each tab. The sentence is shown at the top of the active view.

| View | Tab line | One-sentence description |
| :--- | :--- | :--- |
| Slip Planner | Every landing date | A grid of your sites against landing dates, coloured by status, so you can see every date that works and how far a launch can slip. |
| Polar map | Pick and nudge sites | A flat map of the Moon's south pole seen from straight above, where you choose sites and see how much a small move changes them. |
| System view (3D) | Moon, Earth and Sun | A 3D model of the Moon, Earth and Sun at the current time, showing where your site is, where daylight falls and which way Earth lies. |
| Local terrain (3D) | The ground at the site | A 3D model of the ground for 10 km on every side of the site, lit by the Sun and ringed by a wall that traces the distant mountains on the skyline. |
| Lander's eye | The horizon from the site | What you would see standing at the site and turning in a full circle: the outline of the horizon, with the Sun and Earth drawn at their real height above it. |
| Compare | Sites side by side | Up to four sites for the same landing date in matching columns, so the rule or number that decides between them stands out. |

There is also a sentence for the timeline, which is not a tab: "The mission window hour by hour. The Sun band is filled while the site is lit, the Earth band while it can talk to Earth, and the scrubber moves every view to the hour you pick."

## Components a developer needs

- **Lamp** (`.lamp`):
  - A flat circle, 16 px in lists and 24 px in the status block, filled with the status colour.
  - An SVG glyph cut into it at about 65 % size: ✓ for GO, ! for CAUTION, ✕ for NO-GO.
  - The glyph stroke is `#0b0b0c` at 3.2.
  - No glow, ring or gradient.
  - Always next to the word.
- **Status word:** the status colour at weight 600. No letter-spacing.
- **Provenance tag:**
  - 12 px grey text in a pill.
  - **Sourced:** a solid `--line-strong` outline and "↗".
  - **Assumed:** a dashed outline.
  - The two differ by shape and word, never by colour.
  - Tags are quiet on purpose: grey, never coloured.
  - A rule threshold such as "needs 0.5" is plain text. It never borrows the tag shape.
- **View tab:**
  - Two lines: the name at 13 px weight 500, and the tab line at 12 px in `--ink-3`.
  - Selected: `--raised` fill and a 2 px `--accent` underline.
  - The 3D badge is a small `--hover` chip with a cube icon and "3D".
- **Broken rule card:**
  - A 1 px border of `--status-nogo` at 45 % opacity, with no wash.
  - The value is 24 px in `--status-nogo`.
  - The meter is a 6 px track with a white tick at the limit.
- **Countdown card:**
  - A `--raised` card.
  - Under 6 h, the border and number turn `--status-caution`, and an amber lamp with "Under 6 h" appears.
  - No wash or gradient.
- **Longest-stretch outline:**
  - **Passes its limit:** a dashed `--ink-2` outline.
  - **Breaks a rule:** a solid 2 px `--status-nogo` outline, labelled with a NO-GO lamp and the value and limit.
- **Scrubber:** a 2 px `--accent` line, a knob, and an `--accent` pill with the mission day and UTC time in `--accent-ink`.
- **Lander's eye discs:**
  - The full ellipse is drawn at 30 % opacity, then the same ellipse is clipped to the sky above the skyline at full strength.
  - Labels sit on a `--plot` plate at 88 % opacity, so grid lines never cut through text.
- **True-shape close-ups:** 120 px circles with a 1 px `--line-strong` ring. They sit beside the panorama on the close-study page, not over it.
- **Disclosure:** native `<details>` with a chevron that turns 90° in 150 ms. The summary shows a count, for example "8 values, 240 h".
- **Focus:** `:focus-visible` gets a 2 px `--accent` outline, offset 2 px.
- **Selection:** `::selection` uses `--accent` on `--accent-ink`.

## Building it in `web/src/app/theme.css`

1. Put every token above on `:root`, with `color-scheme: dark`.
2. Set `body` to `--bg`, `--ink`, Jost, 13 px, line-height 1.4, and `tabular-nums`.
3. Add global rules for `::selection` and `:focus-visible`.
4. Delete direction C's `--sky-*`, `--glass-*`, `--well*` and `--accent: #a99cff` tokens, and its `.eyebrow` class.
5. The SVG views read colours through `getComputedStyle` on the same tokens, so a token change reaches the charts too. The prototypes do this with a small `css('--token')` helper.

## Decisions I was unsure of

- **The white accent.** It is the most restrained choice and it avoids every data colour. A lead who expects "an accent" to be a hue may read it as no accent. The fallback is above.
- **No Sun halo.** It is allowed, but I left it out. Every check of the panorama read clearly without it.
- **The type-hierarchy warning.** The detector flags one warning on the shell: section labels such as "Broken rule" are 12 px, below the 13 px body. I left that on purpose, so the focused-site panel stays quiet. The status word and the broken rule's value carry its hierarchy.
- **The Mission window metrics disclosure.** It is closed in the prototype, which is the default state. Opening it shows a plain two-column list.
