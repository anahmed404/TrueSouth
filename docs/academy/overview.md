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
| Wrong answers | No lives. First miss: Luna gives a hint and the learner tries again. Second miss: the answer is shown and explained, then the lesson moves on. |
| Stars | 3 if every step was right first time; 2 if at least 60% were; 1 otherwise |
| Mission patch | One per lesson, earned on completion; a ninth for finishing all eight |
| Replays | Allowed. The best star count is kept. |
| Progress | Saved in the browser's local storage under `truesouth.academy.v1`. A "Reset progress" button clears it. |
| Sound | Off by default, with a toggle |
| Celebration | A short burst of confetti and Luna cheering on each correct answer; a bigger one at lesson end |

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

type Step = StepBase & (
  | { kind: "choice";       options: string[]; answer: number }
  | { kind: "predict";      options: string[]; answer: number; reveal: RevealSpec }
  | { kind: "drag-body";    body: "sun" | "earth"; scene: SceneSpec; goal: GoalSpec }
  | { kind: "draw-skyline"; scene: SceneSpec; azFrom: number; azTo: number }
  | { kind: "drop-pin";     map: MapSpec; goal: GoalSpec }
  | { kind: "tune-slider";  slider: SliderSpec; goal: GoalSpec }
  | { kind: "fill-formula"; tex: string; options: string[]; answer: number }
  | { kind: "spot-bug";     lines: string[]; buggyLine: number }
);
```

- `SceneSpec` names a site, a landing date and a profile: a scenario.
- `GoalSpec` is a small typed condition on a metric, such as
  `{ metric: "longest_blackout_h", op: "<=", value: 12 }`.
- Lesson text may contain `{{example.key}}` placeholders. They are filled from
  `worked_examples.json`, so the numbers in the story always match the real data.

## Under the hood cards

Each lesson has one optional card for readers who want the real math. Opening it never
costs XP and is not part of the 10–15 minutes.

Each card is a Markdown file, `cards/<id>.md`, with KaTeX math and five fixed parts:

1. **The idea** in two or three sentences.
2. **The formula,** quoted from [`../science.md`](../science.md), with the section cited.
3. **A worked example** on real data, with every intermediate number. The numbers are
   `{{example.key}}` placeholders.
4. **In the code:** the function that does it, with a link to the file.
5. **What can go wrong:** the mistakes this formula invites, including ones we made.

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
