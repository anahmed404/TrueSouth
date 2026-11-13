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

/*
 * ── Under-the-hood cards ─────────────────────────────────────────────────────────────────
 * The spec is docs/academy/overview.md, "Under the hood cards". A card is typed data with
 * five fixed parts, in this order: the idea, the formula, a worked example, in the code,
 * and what can go wrong. `UnderTheHoodCard` in `card/index.tsx` renders it.
 *
 * Text fields marked "card text" may hold:
 * - `$…$` inline maths in TeX (write `\$` for a dollar sign);
 * - `{{example.key}}` placeholders, filled from `worked_examples.json`. A unit written right
 *   after one (`°`, `%`, ` m`, ` km`, ` h`, ` UTC`) is kept with its number. A key that is
 *   missing, malformed or has no usable value shows a "value not built yet" chip;
 * - `{{compare:keyA,keyB|less|more|same}}`, a word chosen from the data: `less` when A's
 *   value is smaller than B's, `more` when larger, `same` when they print the same. A and B
 *   also become a compared set (see `compare`). A comparison word is never typed;
 * - `[[term]]` or `[[term|label]]`, a glossary term explained by `<Explain>` from
 *   `web/src/lib/explain.ts`. A card never explains a term in its own words;
 * - `` `code` `` for a name in the code.
 * No number about the Moon is typed into card text: it is always a placeholder.
 */

/** A section of docs/science.md, as its heading reads, such as "4" and "How high a piece of terrain looks". */
export type ScienceSection = {
  /** "4", or "3.1" for a subsection. */
  number: string;
  /** The heading's words after the number, exactly as in docs/science.md. */
  title: string;
};

/** A letter in a formula. */
export type FormulaSymbol = {
  /** The symbol in TeX, such as "s" or "h_{obs}". */
  tex: string;
  /** What it stands for. Card text. */
  meaning: string;
  /** Its unit inside the formula, such as "m" or "rad". `null` when it has none. */
  unit: string | null;
};

/** One formula, quoted from docs/science.md. */
export type CardFormula = {
  /** Unique within the card. */
  id: string;
  /** A short sentence that leads into the formula. Card text. */
  lead: string;
  /**
   * The formula in TeX, copied from the cited section of docs/science.md. It may hold
   * `{{example.key}}` placeholders, though a quoted formula rarely needs one.
   */
  tex: string;
  /** "block" draws it on its own line; "inline" ends the lead's sentence. */
  display: "block" | "inline";
  /** The formula read out in plain words, for learners and for screen readers. */
  reading: string;
  /** The section of docs/science.md it is quoted from. */
  section: ScienceSection;
  /** The letters it uses, with their units. Shared letters are listed once on the card. */
  symbols: readonly FormulaSymbol[];
};

/**
 * One line of a worked example: a label and either a value in card text, or a
 * calculation in TeX drawn on its own line. Both may hold placeholders.
 */
export type WorkedRow =
  | { label: string; value: string }
  | { label: string; tex: string };

/** A worked example on real data, with every intermediate number as a placeholder. */
export type WorkedExample = {
  /** What the example is about, after "A worked example: ". Card text, drawn in the heading. */
  title: string;
  /** Where and when the numbers come from. Card text. */
  intro: string;
  rows: readonly [WorkedRow, ...WorkedRow[]];
  /** What the numbers show, in a sentence. Card text. */
  outro?: string;
};

/** A function in the code that does the card's work. */
export type CodeRef = {
  /** The function's name, such as "elevation_angle". */
  fn: string;
  /** Its file from the repository root, such as "science/src/truesouth/skyline.py". */
  file: string;
  /** What it does, in a sentence. Card text. */
  does?: string;
};

/** An Under-the-hood card: the full maths behind one lesson. */
export type UnderTheHoodCard = {
  id: string;
  /** 1. The idea, in two or three sentences. Card text. */
  idea: string;
  /** 2. The formula: one or more, each quoted and cited. */
  formulas: readonly [CardFormula, ...CardFormula[]];
  /** 3. A worked example on real data. */
  workedExample: WorkedExample;
  /** 4. In the code: the functions that do it, linked to their files. */
  inTheCode: readonly [CodeRef, ...CodeRef[]];
  /** 5. What can go wrong: the mistakes this formula invites, one per item. Card text. */
  whatCanGoWrong: readonly [string, ...string[]];
  /**
   * Keys whose numbers are compared on the card, each set printed with shared decimals
   * that grow (up to 4) until unequal values print differently. Pairs named in a
   * `{{compare:…}}` are added on their own.
   */
  compare?: readonly (readonly [string, string, ...string[]])[];
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
