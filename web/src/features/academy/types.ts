import type { Scenario } from "../../app/panel";

/** Mission Control panel a lesson shows at the end. */
export type PanelId =
  | "SystemView"
  | "LandersEye"
  | "LocalTerrain"
  | "Timeline"
  | "Countdowns"
  | "PolarMap"
  | "Compare"
  | "SlipPlanner"
  | "MissionControl";

/** Luna's eight moods. See docs/academy/luna.md. */
export type LunaMood =
  | "idle"
  | "happy"
  | "thinking"
  | "cheering"
  | "worried"
  | "surprised"
  | "sleepy"
  | "proud";

export type LunaLine = {
  mood: LunaMood;
  says: string;
};

/**
 * A goal's value. One of:
 * - a number, such as 12;
 * - a UTC date-time, ISO-8601 ending in `Z`, such as "2028-03-04T06:00:00Z";
 * - a `{{example.key}}` placeholder, filled from `worked_examples.json`;
 * - any other text, compared for equality only.
 * `goalValueKind` in `evaluator.ts` tells them apart.
 */
export type GoalValue = number | string;

/**
 * A condition over evaluation results. The runner never treats this as a
 * hard-coded answer; an evaluator says whether it is met.
 */
export type GoalSpec = {
  metric: string;
  op: "<" | "<=" | ">" | ">=" | "==";
  value: GoalValue;
};

/** A site, a landing date and a profile: a lesson's own scenario. */
export type SceneSpec = {
  scenario: Scenario;
};

/**
 * What a predict step plays out after the guess: a Mission Control panel with a caption,
 * or plain text when no panel is needed.
 */
export type RevealSpec = { panel: PanelId; caption: string } | { text: string };

export type MapSpec = {
  siteIds: readonly string[];
};

export type SliderSpec = {
  min: number;
  max: number;
  step: number;
  unit: string;
  /** What the slider sets, for its label, for example "Distance". */
  label?: string;
};

/**
 * The picture on the stage for a choice or predict step. It is an illustration driven by
 * lesson data: the frontend never computes a Sun position or a skyline for it.
 * - `pip`: Pip on the ground, with a caption.
 * - `sky-ruler`: Pip under a quarter circle from the horizon (0°) to straight up (90°).
 *   `angles` gives one angle per option, in degrees, as a number or a `{{example.key}}`
 *   placeholder; `null` draws no line for that option.
 */
export type StageSpec =
  | { scene: "pip"; caption: string }
  | { scene: "sky-ruler"; caption: string; angles: readonly (GoalValue | null)[] };

/** A sketch point for `draw-skyline`, in degrees. */
export type SketchPoint = { azDeg: number; elDeg: number };

/** Where a learner dropped a pin: a catalog site, or coordinates in degrees. */
export type PinAttempt = { siteId: string } | { latDeg: number; lonEastDeg: number };

export type StepBase = {
  id: string;
  luna: LunaLine;
  /** Shown after the first miss. */
  hint: string;
  /** Shown after a correct answer or the reveal. */
  explain: string;
  pip?: { power?: number; link?: boolean };
};

export type Step = StepBase &
  (
    | { kind: "choice"; options: readonly string[]; answer: number; stage?: StageSpec }
    | {
        kind: "predict";
        options: readonly string[];
        answer: number;
        reveal: RevealSpec;
        stage?: StageSpec;
      }
    | {
        kind: "drag-body";
        body: "sun" | "earth";
        scene: SceneSpec;
        goal: GoalSpec;
        answerLabel?: string;
      }
    | { kind: "draw-skyline"; scene: SceneSpec; azFrom: number; azTo: number }
    | { kind: "drop-pin"; map: MapSpec; goal?: GoalSpec; answerLabel?: string }
    | { kind: "tune-slider"; slider: SliderSpec; goal: GoalSpec; answerLabel?: string }
    | { kind: "fill-formula"; tex: string; options: readonly string[]; answer: number }
    | { kind: "spot-bug"; lines: readonly string[]; buggyLine: number; title?: string }
  );

export type StepKind = Step["kind"];

export type Lesson = {
  id: string;
  title: string;
  /** One line for the path map. */
  tagline: string;
  patch: { name: string; art: string };
  /** The Mission Control panel shown at the end. */
  unlocks: PanelId;
  /** The idea in one sentence. */
  recap: string;
  /** Under-the-hood card id. */
  card: string;
  steps: readonly Step[];
};

/**
 * The five parts of an Under-the-hood card. `UnderTheHoodCard` in `card/index.tsx`
 * takes it as a prop. KaTeX and Markdown rendering is A4.
 */
export type UnderTheHoodCard = {
  id: string;
  idea: string;
  formula: string;
  formulaSection: string;
  workedExample: string;
  inTheCode: { fn: string; file: string };
  whatCanGoWrong: string;
};

export type Submission =
  | { kind: "choice" | "predict" | "fill-formula" | "spot-bug"; selected: number }
  | { kind: "drag-body" | "tune-slider"; value: number | string }
  | { kind: "drop-pin"; pin: PinAttempt }
  | {
      kind: "draw-skyline";
      sketch: readonly SketchPoint[];
      /** Mean absolute gap to the real skyline, in degrees. See `skyline-score.ts`. */
      gapDeg: number;
    };
