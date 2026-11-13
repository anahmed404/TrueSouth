# The Academy in direction C2: two variants

**The difference in one line:** variant **a** is one focused column, with Luna speaking above
each step and one answer bar at the bottom. Variant **b** is a split stage: the scene the
learner looks at and touches is on the left, and Luna's conversation and the answers are on
the right, docked like Mission Control.

Both variants use the approved C2 look ([`direction-c2.md`](direction-c2.md),
[`DESIGN.md`](../../DESIGN.md)) without changing it. They follow the same UX flow and differ
only in layout and interaction.

Prototypes (static, mock data). Every state is shown at 1440 × 900 and at 390 × 844:

| Screen | Variant a | Variant b |
| :--- | :--- | :--- |
| Lesson path | [`academy-path/a`](academy-path/a/index.html) | [`academy-path/b`](academy-path/b/index.html) |
| Lesson, all step kinds and states | [`academy-lesson/a`](academy-lesson/a/index.html) | [`academy-lesson/b`](academy-lesson/b/index.html) |
| Lesson complete and finale | [`academy-complete/a`](academy-complete/a/index.html) | [`academy-complete/b`](academy-complete/b/index.html) |
| UX flow, shared | [`../flows/academy`](../flows/academy/index.html) | |

The lesson pages have a "Play the motion" button on the celebration states, which runs the
moondust and pop animations.

## Recommendation

**Build variant a, and borrow three things from b.**

Why a:
- **It is the calmer of the two.** Each step has one thing to read, one thing to do and one
  button. That is what the lead has asked for every time ("less overwhelming").
- **It works best on a phone.** The column is already a phone layout; the desktop simply gives
  it more air. Variant b has to fold two panels into a band and a sheet, and on a phone the
  sheet's conversation is short enough that a new line can sit just out of view.
- **Feedback is easier to read.** After Check, the answer, the explanation and Continue are
  all in one bar, right under Luna. In b they are split between a scrolling conversation and
  the stage.

The independent design review agreed. It scored a 36/40 and b 31/40 on Nielsen's ten
heuristics, with b losing points on consistency and recovery at phone width.

What to borrow from b:
1. **The spiral map as the path on desktop.** It puts Luna on the next stop, it is the south
   pole itself, and lesson 8 sits on the pole. Keep a's trail at phone width, where the map's
   stops are too small to tap.
2. **A scene above the choice steps.** b's sky ruler shows the learner's guess as an angle.
   In a it would be a scene strip, about 240 px, between Luna and the answers.
3. **b's lesson-complete layout on desktop,** which shows the panel the learner built at full
   size beside the reward.

## The two variants

### Variant a: one focused column

- **Path:** eight round stops down a winding trail over the low skyline from the start
  screen. Finished stops wear their patch, stars and XP. Luna waits beside the next stop in
  a card with one line and one big "Start" button.
- **Lesson:** the screen has three parts:
  1. a top bar with close, progress, Pip's meters and "Skip to Mission Control";
  2. a 720 px column with Luna (128 px) and her bubble, then the step;
  3. a bottom bar with "Under the hood" and one big Check button. After Check, that bar
     becomes the feedback.

  When Luna says something new, her previous line shrinks into a grey bubble above it, so
  the column reads as a short conversation.
- **Under the hood:** the card unfolds inside the column, under the step.
- **Complete:** the patch is the hero, then stars, XP, the recap, and the panel the learner
  built as a card. "Next" is in the bottom bar.

### Variant b: a split stage

- **Path:** the eight lessons spiral in across a flat map of the south pole (the Polar map's
  projection), with lesson 8 on the pole itself, where Pip waits. Luna sits on the next
  stop. A docked panel shows the selected lesson, the totals, all nine patches and "Reset
  progress".
- **Lesson:** a stage panel on the left and a 520 px conversation panel on the right, 8 px
  apart, as in the Mission Control shell. The rule for what goes where: **what you touch is on
  the stage, and what you say is in the conversation.**
  - Choice and predict answers are replies in the conversation.
  - Formula tiles, bug lines, sliders, maps and draggable bodies are on the stage.

  The learner's answers stay in the conversation as reply bubbles, and the stage illustrates
  each one. A choice step draws its angle on a sky ruler, for example.
- **Under the hood:** the card is the conversation panel's second tab, so the math sits beside
  the calculation it explains.
- **Complete:** the stage shows the panel the learner built, large, with its scenario and
  "Open in Mission Control". The right panel holds the reward and "Next".

## How each stays playful inside the approved look

Neither variant adds a colour, glow, gradient or capitals. The warmth comes from:

- **Scale and air.** Lesson body text is 18 px, Luna's bubble 20 px, buttons 56 px and
  answers 64 px. That is bigger than Mission Control's 13–15 px, with the same tokens.
- **Shape.** The porthole circle carries the Academy: path stops, patches, Luna and the
  stars are all round. Academy cards and bubbles use a 20 px radius, rounder than Mission
  Control's 14 px.
- **Luna's moods.** She changes face at every turn: thinking when she asks, worried on a
  miss, surprised at a reveal, cheering on a win, proud at a patch.
- **Moondust.** A correct answer kicks up a small puff of moonlight-grey dust. It rises and
  settles slowly, the way dust moves in the Moon's low gravity, so the celebration comes
  from the Moon itself, not from a confetti stock effect. The lesson-complete version is
  bigger.
- **Writing.** Luna speaks as the Moon ("my south pole"), one idea per bubble, and never
  mocks. Buttons name what happens next ("Next: Mountains steal sunlight", "Show me").
- **Pip.** Pip's two meters react to every step. In variant b Pip hops on the stage when the
  learner is right.

What each variant adds:

- **Variant a:** the trail and the single big button make it feel like a game board.
- **Variant b:** the map and the stage make it feel like a place you are exploring.

## Decisions that apply to both

- **"Right" is moonlight, not green.** The correct answer gets a moonlight disc with a check
  and the word "Correct" or "The answer". GO green, CAUTION amber and NO-GO red stay for
  statuses only. Lesson 6 teaches GO and NO-GO, so those colours should still mean only that
  when it does. The one exception is the slope map in lesson 5: there, green, amber and red
  are the slope rule's own GO, CAUTION and NO-GO, named in a legend.
- **Misses are never red.** A missed option is dashed and crossed out, and Luna gives a hint.
  After a second miss, the answer is marked and explained. There are no lives to lose.
- **Predict steps get one guess.** "Show me" plays the reveal. A right guess earns 10 XP; a
  wrong one earns 2, the same as an answer that had to be shown.
- **Leaving a lesson part-way drops that lesson's progress.** XP, stars and patches are saved
  only when a lesson is completed. The flow shows a "Leave the lesson?" check.
- **"Reset progress" asks first** and says exactly what it will clear.
- **Stars explain themselves.** "4 of 5 right first time" is shown under the stars.
- **The finale is honest on the map too.** Only the six NASA regions we have a close-up map
  for are drawn, as dashed squares marked "approximate", until the official outlines are
  downloaded. NASA's sunlit areas are flat grey and labelled as NASA's.

## What changes at phone width (390 px)

**Variant a**
- The top bar splits into two lines. Close, progress and step go on the first; Pip's meters
  and "Skip to Mission Control" go on the second. The lesson title moves into the close menu.
- Luna shrinks to 64 px and her bubble text to 18 px. Answers stay 64 px tall and full
  width.
- The bottom bar keeps "Under the hood" and a wide Check. Keyboard hints are hidden.
- Path: Luna's card drops into the trail under the next stop, and the trail's sideways wander
  shrinks to a third. "Reset progress" moves to the end of the trail and into the menu.

**Variant b**
- The stage becomes a band under the top bar:
  - 240 px for scenes;
  - 300 px for steps with things to touch;
  - 360 px where a panel needs its full height.
- The conversation becomes a sheet that overlaps the band by 12 px. It shows the latest
  line; earlier ones scroll up. Once a step is answered, the missed answers are hidden,
  because they are already in the conversation as replies.
- Path: the map is 374 px with numbers only; the panel becomes the page under it.
- Complete: the reward comes first and the built panel follows.

**Both**
- Every control is at least 44 px. Embedded Mission Control panels are 358 px wide, the
  content width, because 360 px plus 16 px gutters does not fit a 390 px screen.

## Motion, and what it becomes with reduce motion

| Moment | Motion | With reduce motion |
| :--- | :--- | :--- |
| Luna idle | Gentle bob and a blink every few seconds | Still; she changes mood without moving |
| Pick an answer | Selection ring 150 ms. In b, the ruler's line swings 250 ms | Instant |
| Miss | Old bubble shrinks to grey (200 ms), hint slides in (300 ms) | 150 ms cross-fade |
| Correct | Moondust, 1.1 s, rising and settling in low gravity; "+10 XP" pops (420 ms); b: Pip hops (700 ms) | No dust, pop or hop; feedback fades in |
| Predict reveal | The Sun slides to its real position (800 ms); Pip's power meter follows | Final frame fades in (150 ms) |
| Fill formula | Tile flies to the slot (250 ms) | Appears in the slot |
| Draw skyline | Real skyline draws left to right (600 ms) | Fades in |
| Under the hood | a: card opens downward (300 ms); b: tab cross-fade (200 ms) | Instant |
| Lesson complete | Patch drops in from 130% with a bigger dust puff (1.4 s), stars fill 150 ms apart, XP counts up (600 ms). b: the System view turns once (4 s) | Everything shown filled and still |
| Path | Walked part of the trail or spiral draws in (600 ms) | Shown drawn |

All motion uses `cubic-bezier(.16,1,.3,1)` (ease-out). There is no bounce.

## For the developer

### Proposed tokens (not yet in `DESIGN.md`)

| Token | Value | Use |
| :--- | :--- | :--- |
| `--t-ac` | 18 px | Lesson body, answers |
| `--t-ac-min` | 16 px | The floor for lesson text on a phone (the spec's minimum) |
| `--t-ac-say` | 20 px | Luna's current bubble |
| `--t-ac-title` | 28 px | Path and lesson titles |
| `--r-xl` | 20 px | Academy cards and bubbles |
| `--s8` | 64 px | Large Academy spacing |
| `--h-xl` | 56 px | Big buttons: Check, Continue, Start, Next |
| `--h-opt` | 64 px | Answer options (56 px in variant b's conversation) |
| `--ease-out` | `cubic-bezier(.16,1,.3,1)` | All Academy motion |

### Components

| Component | Variants | What it is |
| :--- | :--- | :--- |
| `LessonTopBar` | Both | Close, progress segments, "Step n of 5", Pip's meters, skip link |
| `PipMeters` | Both | Power: Sun glyph, % and a Sun-cream bar. Link: antenna glyph and "Link" in Earth blue, or "Blackout" with a crossed antenna |
| `AnswerOption` | Both | States: default, selected, missed, answer, dimmed. Number keycap. `role="radio"` |
| `OkBadge` | Both | Moonlight disc with a cut check: the achromatic "right" mark |
| `RetryBadge` | Both | Grey ring with a retry arrow, for a miss |
| `LunaSays` | Both | Bubble, plus an "old" style for her previous line. Variant b adds an avatar per message and the learner's reply bubble (dashed for a miss) |
| `FeedbackBar` | a | The bottom bar after Check |
| `ResultRow` | b | The bottom of the conversation after Check |
| `StageScene` | b | Sky ruler, pole scene, and the stage layout |
| `McPanelBox` | Both | A Mission Control panel in a 360 px box, with a header and a readout line |
| `UnderTheHoodCard` | Both | The five fixed parts. Filled values use a `Fill` chip, so they read as data from `worked_examples.json` |
| `MoondustBurst` | Both | About 26 particles on a parabola under low gravity, Web Animations API, 1.1 s; skipped under reduce motion |
| `MissionPatch` | Both | Nine line glyphs in a porthole ring. Earned: solid ring; not yet: dashed |
| `Stars` | Both | Three; filled Ink when earned, an outline when not |
| `PathTrail` | a | Lesson path as a winding trail |
| `PathSpiral` | b | Lesson path as a spiral on the polar map |
| `FinaleMap` | Both | The learner's site, NASA's approximate regions, NASA's sunlit areas, the distance |
| `ResetDialog` | Both | The one modal in the Academy, because reset can't be undone |

Variant b's split reuses the Mission Control shell grid: panels 8 px apart with 14 px
corners.

### Luna

Luna is drawn from the placeholder art in `web/src/components/luna/art/`. When that art is
reworked in A10, the following extras should be recoloured to the C2 rules (the prototypes
already do this):

- **cheering:** the sparkles use CAUTION amber; they should be Sun cream.
- **proud:** the medal uses GO green and CAUTION amber; it should be a Raised disc with a
  Sun-cream star.
- **worried:** the drop uses `accent`; it should be Ink 2.

### Placeholder numbers

Every Moon number in the prototypes is a realistic filled-in value, standing in for a
`worked_examples.json` key:

| Value in the prototype | Stands in for |
| :--- | :--- |
| Highest Sun 2.0° | `l1.sun_el_max_deg` |
| Sun 1.85° at 2028-03-05 18:00 UTC | a drag position (illustrative) |
| Sun 0.9°, ridge 12 km and 300 m, ridge 1.2° tall, 2028-01-14 06:00 UTC | `l2.sun_el_deg`, `l2.ridge_dist_km`, `l2.ridge_rise_m`, `l2.ridge_el_deg`, `l2.example_utc` |
| Sketch's average gap 0.3° | the draw-skyline score (illustrative) |
| Drop 115 m at 20 km; 1,036 m at 60 km; the card's worked example | `l3.drop_at_20km_m`, `l3.drop_at_60km_m`, `l3.example_*` |
| Slope 4–7° at the pin | `l5.*` (illustrative) |
| Connecting Ridge GO on 2028-03-04; 51 km to de Gerlache Rim 2 | `l8.candidates`, `l8.region_overlap.*` |
| XP, stars and patch totals | the learner's progress (mock) |

The lessons' own design values (2.0°, 115 m, 1,036 m and so on) come from
[`docs/academy/lessons.md`](../../docs/academy/lessons.md). The 51 km is our estimate from the
catalog coordinates.

## Decisions I was unsure about

- **"Right" in moonlight instead of green.** It keeps status colours pure, but most learners
  expect green for "correct". The fallback is GO green with the ✓ glyph, kept off status
  lamps.
- **Predict scoring (10 or 2 XP).** The spec sets XP for answers, not for predictions. I
  treated a wrong guess like an answer that had to be shown.
- **Draw-skyline XP.** The spec says closer sketches earn more, which does not fit the
  10/5/2 rule. I showed +8 on a 2–10 scale. One of the two rules should change.
- **Dropping an unfinished lesson** when the learner leaves. The spec only says progress is
  saved; it does not say at what grain.
- **The ninth patch's name, "True South".** The spec names the eight lesson patches but not
  the ninth.
- **Text size in lesson chrome.** Lesson content, answers, readouts and legends are at least
  16 px, as the spec asks. The top bar, keyboard hints and the axis labels inside embedded
  Mission Control panels keep Mission Control's 12–15 px so the panels look the same in
  both modes.
- **Luna's recoloured extras** (see "Luna" above). The prototypes show the C2-compliant
  colours, not the colours in the component today.
- **Variant b's phone tabs.** "Luna" and "Under the hood" share the sheet's top. On a phone
  the card might be better as its own full-height sheet.
- **The finale's 51 km.** It is my estimate from catalog coordinates, as the crow flies on
  a polar projection. The build should compute it.

## Checks

- **impeccable detector** (`impeccable detect --json` on the four folders): **0 findings**
  in the final run. The first run had 0 anti-patterns and 33 advisories, all values outside
  `DESIGN.md`'s type and radius scales. I moved them onto existing tokens or the proposed
  Academy tokens above.
- **The detector overlay in the browser** (run once by the critique's evidence pass, before
  the fixes) flagged line length, stray words and "nested cards". Almost all of these were on
  the review document's own captions and frame wrappers, not on the screens. The flow page
  had 0.
- **In-page checks after the fixes:**
  - every control in every phone frame is at least 44 × 44 px (235 in all);
  - no HTML text inside a frame is under 12 px;
  - no screen scrolls sideways;
  - no purple, indigo or violet anywhere;
  - no console errors.
- **impeccable critique:** two isolated reviewers (a design review and the detector and
  browser evidence). Fixed after it:
  - the reset dialog overflowing a phone;
  - b's lesson stops being too small to tap on a phone (now a row of 44 px number buttons);
  - b's tabs being 40 px tall;
  - one 10.8 px label;
  - the finale now leads with the win and puts the NASA comparison second, under its own
    heading;
  - "Keep my progress" is now the filled button;
  - "1st try" and "2nd try" instead of "Your pick" twice;
  - a neutral "shown" glyph instead of a check when the answer had to be revealed;
  - readouts and legends raised to 16 px;
  - Luna kept at 48 px or larger in b's conversation;
  - in a, Luna now stands at the next stop on the path.
