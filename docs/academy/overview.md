# Academy

A 10–15 minute guided story in the style of Duolingo. The learner rebuilds TrueSouth's
logic one idea at a time and uses it to land a small lander.

Owner: Academy track. Folder: `web/src/features/academy/`.
Lessons: [`lessons.md`](lessons.md). Mascot: [`luna.md`](luna.md).

## Who it is for

- **Students and the public,** who want to know why the Moon's south pole is hard.
- **Educators,** who want a ready-made 15-minute activity.
- **Our own team,** who use the "Under the hood" cards to understand and check the math.

## The story

> It is 2028. Pip, a small solar-powered lander, is headed for the Moon's south pole. Pip
> has no relay satellite and cannot survive long darkness. Then the launch slips. You are
> the new mission planner. Luna will help you work out where and when Pip can land.

- **Luna** is the guide: a moon character who talks to the learner.
- **Pip** is the lander the learner is trying to keep alive. Pip uses the `im2_athena`
  mission profile.
- The mission is fictional. Every site, map and number is real.

## Shape

- 8 lessons, about 5 steps each, about 40 steps in all.
- Every lesson is unlocked from the start, so a visitor can jump to any of them.
- Each lesson ends by showing the real Mission Control panel the learner just "built",
  with a button to open it in Mission Control.
- A "Skip to Mission Control" link is always visible.

## Screens

**Path map (`/academy`).** A winding path of eight stops across a stylised lunar surface.
Each stop shows its title, its stars, and its mission patch once earned. Total XP and
patches sit at the top. Luna stands at the next unfinished stop.

**Lesson (`/academy/:lessonId`).**

```text
┌──────────────────────────────────────────────────────────────┐
│ ✕   ▓▓▓▓▓▓▓░░░░░░░ step 3 of 5        Pip: ☀ 82%   📡 link   │
├──────────────────────────────────────────────────────────────┤
│  (Luna)  "The Sun is 1.2° up. That ridge is 12 km away      │
│           and 300 m tall. Will Pip see the Sun?"             │
│                                                              │
│              [ the step's interaction ]                      │
│                                                              │
├──────────────────────────────────────────────────────────────┤
│  Under the hood ▸                              [ Check ]     │
└──────────────────────────────────────────────────────────────┘
```

- A progress bar and a close button at the top.
- Pip's two meters, power and link, react to what happens in the step.
- Luna and her speech bubble.
- The interaction area.
- "Check" (or "Continue") at the bottom, and the "Under the hood" toggle.

**Lesson complete.** Stars, XP earned, the mission patch, a one-line recap of the idea,
the unlocked panel, and buttons for "Next lesson" and "Open in Mission Control".

## Game rules

| Rule | Detail |
| :--- | :--- |
| XP | 10 for a step answered correctly first time, 5 on the second try, 2 after the answer is shown |
| Predict steps | One guess. 10 XP if it is right; 2 XP if it is wrong, the same as an answer that had to be shown. "Show me" then plays out the real answer. There is no hint and no second guess. |
| Draw-skyline steps | One attempt, and every sketch passes. XP is earned by closeness. The gap is the mean absolute difference in degrees between the sketch and the real skyline over the step's azimuth range. XP = round(10 − 8 × clamp((gap − 0.25) / 1.75, 0, 1)): 10 XP at 0.25° or closer, 2 XP at 2° or worse. The step counts as right first time for stars when the gap is 1.0° or less. |
| Wrong answers | No lives. First miss: Luna gives a hint and the learner tries again. Second miss: the answer is shown and explained, then the lesson moves on. |
| Stars | 3 if every scored step was right first time; 2 if at least 60% of the scored steps were; 1 otherwise. A lesson with no scored step earns 1 star and no patch. The complete screen then says the lesson is finished and that no patch was earned. |
| Mission patch | One per lesson, earned on completion; a ninth, named "True South", for finishing all eight |
| Replays | Allowed. The best star count is kept. |
| Progress | Saved in the browser's local storage under `truesouth.academy.v1`. A "Reset progress" button clears it, after asking. |
| Leaving part-way | Drops that lesson's progress. XP, stars and patches are saved only when a lesson is completed. Closing a lesson part-way asks "Leave the lesson?" first. |
| Sound | Off by default, with a toggle |
| Celebration | A short puff of moondust and Luna cheering on each correct answer; a bigger one at lesson end. None with "reduce motion". |

There are no hearts, no streaks and no timers.

## Step types

Every step is one of eight kinds. Each is a React component that takes typed props.

| Kind | The learner… | Example |
| :--- | :--- | :--- |
| `choice` | picks one answer | "Which way is north at the south pole?" |
| `predict` | guesses, then watches the real answer play out | "Will Pip be in sunlight at 14:00?" |
| `drag-body` | drags the Sun or Earth along its real path | "Find the hour the Sun is highest." |
| `draw-skyline` | sketches the skyline, then sees the real one laid over it | "Draw what you think Pip sees to the north." |
| `drop-pin` | places a pin on the map to meet a goal | "Find a spot with a slope under 10°." |
| `tune-slider` | moves a slider until a condition holds | "Slide the landing date until Pip has a link all mission." |
| `fill-formula` | picks the missing piece of a formula | "drop = d² / ( ? )" |
| `spot-bug` | finds the wrong line in a worked calculation | A flat-Moon calculation with no curvature term |

Interactions reuse Mission Control's panels: the Lander's eye view, the timeline, the
polar map, the Slip Planner and the 3D views.

## How lessons are written

- Each lesson is a TypeScript file, `lessons/<id>.ts`, exporting a typed `Lesson`.
- Types live in `web/src/features/academy/types.ts`. A lesson that does not match the
  types does not compile.

```ts
type Lesson = {
  id: string;                 // "l2_skyline"
  title: string;
  tagline: string;            // one line for the path map
  patch: { name: string; art: string };
  unlocks: PanelId;           // the Mission Control panel shown at the end
  recap: string;              // the idea in one sentence
  card: string;               // Under-the-hood card id
  steps: Step[];
};

type StepBase = {
  id: string;
  luna: { mood: LunaMood; says: string };
  hint: string;               // shown after the first miss
  explain: string;            // shown after a correct answer or the reveal
  pip?: { power?: number; link?: boolean };
};

type StepAnswer = number | { equals: GoalValue };

type Step = StepBase & (
  | { kind: "choice";       options: string[]; answer: StepAnswer; stage?: StageSpec }
  | { kind: "predict";      options: string[]; answer: StepAnswer; reveal: RevealSpec; stage?: StageSpec }
  | { kind: "drag-body";    body: "sun" | "earth"; panel: PanelId; scene: SceneSpec; goal: GoalSpec; readout?: string[]; follow?: PipFollow }
  | { kind: "draw-skyline"; scene: SceneSpec; azFrom: GoalValue; azTo: GoalValue }
  | { kind: "drop-pin";     map: MapSpec; goal?: GoalSpec }
  | { kind: "tune-slider";  slider: SliderSpec; goal: GoalSpec; unreachable?: Unreachable }
  | { kind: "fill-formula"; tex: string; options: string[]; answer: number }
  | { kind: "spot-bug";     lines: string[]; buggyLine: number }
);

type SceneSpec = {
  scenario: Scenario;         // a site, a landing date and a profile
  skyline: "flat" | "smooth" | "terrain";
  timeRange: { kind: "utc"; fromUtc: string; toUtc: string }
    | { kind: "span"; span: "one-month"; aroundUtc: GoalValue }
    | null;
};

type SliderSpec =
  | { kind: "number"; min: number; max: number; step: number; unit: string; readout?: NumberReadout; scene?: SceneSpec; panel?: PanelId; follow?: PipFollow }
  | { kind: "date"; minUtc: string; maxUtc: string; stepDays: number; readout?: DateReadout; scene?: SceneSpec; panel?: PanelId; follow?: PipFollow };

type RevealSpec =
  | { kind: "text"; text: string }
  | { kind: "panel"; panel: PanelId; caption: string; scene: SceneSpec | null; when: RevealWhen | null }
  | { kind: "illustration"; illustration: "curved-moon-side"; caption: string };

type GoalSpec =
  | { metric: string; op: "<" | "<=" | ">" | ">=" | "=="; value: GoalValue; tolerance?: number; prior?: PriorRef }
  | { metric: string; op: "<" | "<=" | ">" | ">=" | "=="; comparedTo: string; prior?: PriorRef };
```

- `SceneSpec` names a site, a landing date and a profile, and says whether the horizon is
  flat, smooth or the site's terrain. `timeRange` is the span the learner may drag, or null.
- `GoalSpec` is a small typed condition on a metric, such as
  `{ metric: "longest_blackout_h", op: "<=", value: 12 }`, or a comparison of two metrics
  (`comparedTo`). Its value may be a number, text, a UTC date-time (ISO-8601 ending in `Z`),
  or a `{{example.key}}` placeholder filled from `worked_examples.json`. Numbers compare as
  numbers, UTC times as moments, and text only with `==`. For `==` on numbers, `tolerance`
  is how far either side still counts. A placeholder whose key is missing cannot be checked
  yet: it is not a pass. `prior` names an earlier step's answer to pass to the evaluator.
- `drop-pin`: the learner's attempt is a catalog site id or coordinates in degrees, and the
  goal is optional. With no goal, any pin passes. The map says `polar` or `closeup`, and may
  take its site list from a worked-example key.
- `RevealSpec` is plain text, an illustration, or a Mission Control panel. A panel reveal
  may name a scenario and when to look: an hour, a span such as one month, a UTC range, or
  a timeline band.
- `SliderSpec` is either a slider over numbers or a slider over UTC dates. Either may carry
  a readout looked up from lesson data, a scene, and which of Pip's meters follows it.
- `draw-skyline` carries the azimuth window, in degrees, that `skylineGapDeg` scores. Each
  end is a number or a `{{example.key}}` placeholder. The real skyline is the scene site's.
- A `choice` or `predict` step may name a `StageSpec`: the illustration on the stage, such
  as Pip under a sky ruler whose angles come from lesson data or placeholders. It is a
  drawing, never a computed Sun position. A choice or predict answer is an option index, or
  the option whose text equals a value once placeholders are filled.

The exact types are in `web/src/features/academy/types.ts`. Where this sketch and that
file differ, the file is right and this sketch should be updated.
- Lesson text may contain `{{example.key}}` placeholders. They are filled from
  `worked_examples.json`, so the numbers in the story always match the real data.

## Under the hood cards

Each lesson has one optional card for readers who want the real math. Opening it never
costs XP and is not part of the 10–15 minutes.

Each card is typed data, an `UnderTheHoodCard` from `web/src/features/academy/types.ts`, in
`cards/<id>.ts`, so a card that misses a part does not compile, as with lessons. Its maths
is TeX, drawn with KaTeX. It has five fixed parts:

1. **The idea** in two or three sentences.
2. **The formula,** quoted from [`../science.md`](../science.md), with the section cited.
   Each formula has its TeX, a reading in plain words, the section it is quoted from (shown
   as "Science notes, section 4", linked), and its symbols with their units.
3. **A worked example** on real data, with every intermediate number. The numbers are
   `{{example.key}}` placeholders, in text or inside TeX.
4. **In the code:** the function that does it, with a link to the file.
5. **What can go wrong:** the mistakes this formula invites, including ones we made.

Card text may hold `$…$` inline maths, `{{example.key}}` placeholders (a unit written right
after one stays with its number), `[[term]]` or `[[term|label]]` for a glossary term
explained from `web/src/lib/explain.ts`, and `` `code` ``. The exact syntax is documented
beside the type. A filled number shows in a box, so a learner can see it is real data; a
key that `worked_examples.json` does not have yet shows "value not built yet", never the
raw placeholder. Numbers are rounded by one rule, in
`web/src/features/academy/format-example.ts`.

The cards hold everything an engineering-level explanation would. Nothing is left out for
simplicity; it is moved here.

**If a card's worked example disagrees with what the app shows, that is a bug.** Report it.
The cards are how the team checks the math together.

## Worked examples

`uv run truesouth build-worked-examples` computes every number the lessons and cards
quote, using the real science code and the real derived data, and writes
`data/derived/academy/worked_examples.json`:

```json
{ "l1.sun_el_max_deg": 2.0, "l1.sun_el_min_deg": 0.72, "l3.drop_at_20km_m": 115.1 }
```

The keys each lesson needs are listed in [`lessons.md`](lessons.md). The build fails if a
lesson uses a key the file does not have.

## Accessibility

- Every step works with a keyboard.
- Dragging steps also accept arrow keys.
- Animations respect the system's "reduce motion" setting.
- Correct and wrong are shown with words and icons as well as colour.
- Text is at least 16 px in lessons.

## Done when

- A new visitor can finish all eight lessons in 10–15 minutes.
- Each of the eight step kinds works by mouse, touch and keyboard.
- Closing the browser and returning keeps XP, stars and patches.
- Every number in a lesson or card comes from `worked_examples.json`.
- Each lesson's end screen opens the matching Mission Control panel with the lesson's
  scenario loaded.
- The Academy is usable on a 390-pixel-wide phone screen.
