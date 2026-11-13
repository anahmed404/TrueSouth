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
 * A condition over evaluation results. The runner never treats this as a
 * hard-coded answer; an evaluator says whether it is met.
 */
export type GoalSpec = {
  metric: string;
  op: "<" | "<=" | ">" | ">=" | "==";
  value: number;
};

/** A site, a landing date and a profile: a lesson's own scenario. */
export type SceneSpec = {
  scenario: Scenario;
};

export type RevealSpec = {
  panel: PanelId;
  caption: string;
};

export type MapSpec = {
  siteIds: readonly string[];
};

export type SliderSpec = {
  min: number;
  max: number;
  step: number;
  unit: string;
};

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
    | { kind: "choice"; options: readonly string[]; answer: number }
    | {
        kind: "predict";
        options: readonly string[];
        answer: number;
        reveal: RevealSpec;
      }
    | { kind: "drag-body"; body: "sun" | "earth"; scene: SceneSpec; goal: GoalSpec }
    | { kind: "draw-skyline"; scene: SceneSpec; azFrom: number; azTo: number }
    | { kind: "drop-pin"; map: MapSpec; goal: GoalSpec }
    | { kind: "tune-slider"; slider: SliderSpec; goal: GoalSpec }
    | { kind: "fill-formula"; tex: string; options: readonly string[]; answer: number }
    | { kind: "spot-bug"; lines: readonly string[]; buggyLine: number }
  );

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

/** The five parts of an Under-the-hood card. Markdown rendering is A4. */
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
  | { kind: "drag-body" | "drop-pin" | "tune-slider"; value: number }
  | { kind: "draw-skyline"; sketch: readonly number[] };
