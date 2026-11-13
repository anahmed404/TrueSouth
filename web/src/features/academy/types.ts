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
export type GoalOp = "<" | "<=" | ">" | ">=" | "==";

/** An earlier step's answer, passed to the evaluator with the goal. The lesson does not recompute it. */
export type PriorRef = {
  stepId: string;
  field: "siteId" | "utc" | "value" | "selected";
};

/**
 * A condition on one metric.
 * `tolerance` applies only to `==` on numbers: how far either side still counts, in the value's unit.
 * Omit it for an exact match. A negative tolerance never matches.
 */
export type ValueGoal = {
  metric: string;
  op: GoalOp;
  value: GoalValue;
  tolerance?: number;
  prior?: PriorRef;
};

/** A condition that compares two metrics, such as site B's score above site A's. */
export type ComparedGoal = {
  metric: string;
  op: GoalOp;
  comparedTo: string;
  prior?: PriorRef;
};

export type GoalSpec = ValueGoal | ComparedGoal;

/** A fixed option index, or the option whose text equals a value once placeholders are filled. */
export type StepAnswer = number | { equals: GoalValue };

/** How the horizon is drawn. `flat` is a level line, `smooth` a round Moon with no ridges, `terrain` the site's skyline. */
export type SkylineKind = "flat" | "smooth" | "terrain";

/**
 * The span a learner may drag across.
 * - `utc`: inclusive instants, each a UTC ISO-8601 string ending in `Z`.
 * - `span`: a named length such as one month, around an instant (a number or a placeholder).
 */
export type TimeRange =
  | { kind: "utc"; fromUtc: string; toUtc: string }
  | { kind: "span"; span: "one-month"; aroundUtc: GoalValue }
  | {
      /**
       * `halfHours` on either side of `aroundUtc`, inclusive, then clamped to the time grid.
       * 24 is the 48 hours from −24 h to +24 h.
       */
      kind: "hours";
      aroundUtc: GoalValue;
      halfHours: number;
    };

/** A site, a landing date and a profile, plus how the horizon is drawn and the drag window. */
export type SceneSpec = {
  scenario: Scenario;
  skyline: SkylineKind;
  /** Null when the learner does not drag through time. */
  timeRange: TimeRange | null;
};

/** When a panel reveal looks. An hour, a named span, an inclusive range, or a timeline band. */
export type RevealWhen =
  | { kind: "hour"; utc: GoalValue }
  | { kind: "span"; span: "one-month"; aroundUtc: GoalValue }
  | { kind: "range"; fromUtc: GoalValue; toUtc: GoalValue }
  | { kind: "band"; band: "earth" | "sun" };

/** A picture that is not a Mission Control panel. */
export type IllustrationId = "curved-moon-side";

/** Layers a map reveal can add on top of the panel. */
export type MapOverlay = "learner-site" | "nasa-average-sunlight" | "artemis-regions";

/**
 * Two captions, chosen from a worked-example flag. The lesson does not decide which;
 * the key's value does. Used for the honest ending of lesson 8.
 */
export type HonestReveal = {
  whenKey: string;
  yes: string;
  no: string;
};

/**
 * What a predict step plays out after the guess.
 * - `text`: words, when no panel is needed.
 * - `panel`: a Mission Control panel, optionally at a scenario, hour, or playback window.
 * - `illustration`: a drawing, not a Mission Control panel.
 */
export type RevealSpec =
  | { kind: "text"; text: string }
  | {
      kind: "panel";
      panel: PanelId;
      caption: string;
      /** The scenario the panel shows. Null keeps the lesson's own scene. */
      scene: SceneSpec | null;
      /** Where in time the panel looks. Null when it is not pinned to a time. */
      when: RevealWhen | null;
      overlays?: readonly MapOverlay[];
      honest?: HonestReveal;
    }
  | { kind: "illustration"; illustration: IllustrationId; caption: string };

export type MapSpec = {
  /** `closeup` is the slope map; `polar` is the south-polar map. */
  view: "polar" | "closeup";
  siteIds: readonly string[];
  /**
   * A worked-example key whose value is a list of site ids, such as `l8.candidates`.
   * Null means `siteIds` is the list.
   */
  sitesKey: string | null;
  /** A panel beside the map, or null when the map stands alone. */
  aside: PanelId | null;
};

/**
 * What a number slider shows beside the handle.
 * - `stops`: text looked up at exact positions. The lesson does not compute it.
 * - `curvature-drop`: the drop distance² / 2R (docs/science.md §4). `radiusM` is the Moon's radius.
 * - `piecewise-linear`: straight lines through knots. A knot's position or value may be a placeholder.
 * - `example-list`: one number per slider step, read from a worked-example list. The lesson does not interpolate it.
 */
export type NumberReadout =
  | { kind: "stops"; label: string; stops: readonly { at: number; text: string }[] }
  | { kind: "curvature-drop"; label: string; radiusM: number }
  | { kind: "piecewise-linear"; label: string; knots: readonly { at: GoalValue; value: GoalValue }[] }
  | { kind: "example-list"; label: string; key: string; origin: number; step: number };

export type DateReadout = {
  label: string;
  stops: readonly { atUtc: string; text: string }[];
};

/**
 * Which of Pip's meters follows the step as the learner drags.
 * The number comes from the panel. The lesson never computes it.
 */
export type PipFollow =
  | { power: "sun-fraction"; link?: "link-up" }
  | {
      link: "link-up";
      power?: "sun-fraction";
      /** `readout` means the link meter shows the slider's readout. Omit it to follow the panel. */
      source?: "readout";
    };

/** A slider over a number, such as kilometres or degrees. */
export type NumberSliderSpec = {
  kind: "number";
  min: number;
  max: number;
  step: number;
  unit: string;
  /** What the slider sets, for its label, for example "Distance". */
  label?: string;
  readout?: NumberReadout;
  scene?: SceneSpec;
  panel?: PanelId;
  follow?: PipFollow;
};

/**
 * A slider over UTC instants. `minUtc` and `maxUtc` are inclusive, ISO-8601, ending in `Z`.
 * `stepDays` is the gap between stops, in whole days.
 */
export type DateSliderSpec = {
  kind: "date";
  minUtc: string;
  maxUtc: string;
  stepDays: number;
  label?: string;
  readout?: DateReadout;
  scene?: SceneSpec;
  panel?: PanelId;
  follow?: PipFollow;
};

export type SliderSpec = NumberSliderSpec | DateSliderSpec;

/** What Luna offers when no stop on a slider can meet the goal. */
export type Unreachable = {
  says: string;
  offer: readonly ("best-caution-date" | "change-site")[];
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

/**
 * The azimuth window a draw-skyline step scores, in degrees.
 * `centred` is how a lesson says "this direction": a centre, often a worked-example key,
 * plus a half-width. It is not two fixed ends.
 */
export type AzimuthWindow =
  | { kind: "between"; from: GoalValue; to: GoalValue }
  | { kind: "centred"; centre: GoalValue; halfWidthDeg: number };

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
    | { kind: "choice"; options: readonly string[]; answer: StepAnswer; stage?: StageSpec }
    | {
        kind: "predict";
        options: readonly string[];
        answer: StepAnswer;
        reveal: RevealSpec;
        stage?: StageSpec;
      }
    | {
        kind: "drag-body";
        body: "sun" | "earth";
        /** The Mission Control panel the learner drags on. */
        panel: PanelId;
        scene: SceneSpec;
        goal: GoalSpec;
        answerLabel?: string;
        /** Lines beside the drag, such as a highest and a lowest. May hold placeholders. */
        readout?: readonly string[];
        follow?: PipFollow;
      }
    | {
        kind: "draw-skyline";
        scene: SceneSpec;
        /**
         * Azimuth window, in degrees, passed to `skylineGapDeg`.
         * `between` is a clockwise arc. `centred` is `centre` ± `halfWidthDeg`, and it wraps
         * at 0°/360°. The centre may be a `{{example.key}}` placeholder. The real skyline is
         * the scene site's skyline; this step never stores the elevations.
         */
        window: AzimuthWindow;
      }
    | { kind: "drop-pin"; map: MapSpec; goal?: GoalSpec; answerLabel?: string }
    | {
        kind: "tune-slider";
        slider: SliderSpec;
        goal: GoalSpec;
        answerLabel?: string;
        /** Shown when no stop can meet the goal. Absent when every slider has a reachable goal. */
        unreachable?: Unreachable;
      }
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
  /** The Mission Control panel or panels shown at the end. */
  unlocks: PanelId | readonly PanelId[];
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
  | { kind: "drag-body"; value: number | string }
  | { kind: "tune-slider"; variant: "number"; value: number }
  | { kind: "tune-slider"; variant: "date"; utc: string }
  | { kind: "drop-pin"; pin: PinAttempt }
  | {
      kind: "draw-skyline";
      sketch: readonly SketchPoint[];
      /** Mean absolute gap to the real skyline, in degrees. See `skyline-score.ts`. */
      gapDeg: number;
    };
