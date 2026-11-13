import { Hourglass } from "lucide-react";
import { LayoutGroup, motion } from "motion/react";
import { useLunaReducedMotion } from "../../../components/luna";
import { formatNumber, unitRuleFor } from "../format-example";
import { resolveDegrees, type WorkedExamples } from "../placeholders";
import { numberReadoutAt } from "../readout";
import type { RunnerState } from "../runner";
import { isAnswered, panelPreview, withUnit, type Draft, type OptionView } from "../step-view";
import type { NumberReadout, PanelId, RevealSpec, Step } from "../types";
import { AnswerOption, OptionGroup, optionTabStop } from "../ui/answer-option";
import { filledText } from "../ui/filled";
import { CorrectMark } from "../ui/marks";
import { Moondust } from "../ui/moondust";
import { panelName, PENDING_STEPS } from "../ui/panels";
import { DragBodyStage, type SceneStatus } from "./drag-body-stage";
import { CurvedMoonSide, PipScene, SkyRuler, type RulerMark } from "./scenes";
import { SkylineStage } from "./skyline-stage";

const EASE = [0.16, 1, 0.3, 1] as const;

/** "About 45°" → "about 45°", to follow "Not". A word in capitals, such as "UTC", stays. */
function lowerFirst(text: string): string {
  const first = text.split(" ")[0] ?? "";
  if (first.length > 1 && first === first.toUpperCase()) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

type StageProps = {
  step: Step;
  runner: RunnerState;
  draft: Draft;
  views: readonly OptionView[];
  examples: WorkedExamples;
  /** Changes on each correct answer, to play the hop and the moondust. */
  celebrate: number;
  onDraft: (draft: Draft) => void;
  /** The step's site data failed to load: a drag or sketch step shows its holding form. */
  sceneFailed: boolean;
  onSceneStatus: (status: SceneStatus) => void;
};

/** The stage's size on a phone: a scene band, a touch band, or a tall band for a panel. */
export function stageClass(step: Step): string {
  if (step.kind === "choice" || step.kind === "predict") return "ac-panel ac-stage ac-stage--scene";
  if (step.kind === "tune-slider") return "ac-panel ac-stage";
  if (step.kind === "drag-body" || step.kind === "draw-skyline") return "ac-panel ac-stage ac-stage--panel";
  return "ac-panel ac-stage";
}

/** What the learner looks at and touches. What they say is in the conversation. */
export function Stage(props: StageProps) {
  const { step } = props;
  return (
    <section className={stageClass(step)} aria-label="Stage">
      <StageBody {...props} />
    </section>
  );
}

function StageBody({ step, runner, draft, views, examples, celebrate, onDraft, sceneFailed, onSceneStatus }: StageProps) {
  const answered = isAnswered(runner);
  const dust = celebrate > 0 ? <Moondust key={celebrate} seed={celebrate + 3} style={{ left: "50%", top: "80%" }} /> : null;

  switch (step.kind) {
    case "choice":
    case "predict": {
      const drawing = step.kind === "predict" && answered && step.reveal.kind === "illustration" ? step.reveal : null;
      const scene = drawing ? (
        <CurvedMoonSide label={filledText(drawing.caption, examples)} />
      ) : (
        <ChoiceScene step={step} views={views} draft={draft} answered={answered} examples={examples} celebrate={celebrate} />
      );
      return (
        <>
          {scene}
          {step.kind === "predict" && answered ? <Reveal reveal={step.reveal} examples={examples} /> : null}
        </>
      );
    }
    case "fill-formula":
      return (
        <>
          <FormulaStage step={step} views={views} draft={draft} answered={answered} examples={examples} onDraft={onDraft} />
          <p className="ac-keys ac-stage-hint ac-keys-desk">
            <span className="ac-kbd">1</span>–<span className="ac-kbd">{step.options.length}</span> place a piece ·{" "}
            <span className="ac-kbd">Backspace</span> empties the slot · <span className="ac-kbd">Enter</span> checks
          </p>
          {dust}
        </>
      );
    case "spot-bug":
      return (
        <>
          <div className="ac-calc">
            {step.title ? <h2>{filledText(step.title, examples)}</h2> : null}
            <OptionGroup
              label="Lines of the calculation"
              className="ac-options"
              views={views}
              locked={answered}
              onPick={(index) => onDraft({ kind: "spot-bug", selected: index })}
            >
              {step.lines.map((line, index) => (
                <AnswerOption
                  key={index}
                  index={index}
                  view={views[index] ?? { state: "default", note: null, correct: false }}
                  tabStop={index === optionTabStop(views)}
                  locked={answered}
                  onPick={(picked) => onDraft({ kind: "spot-bug", selected: picked })}
                >
                  {filledText(line, examples)}
                </AnswerOption>
              ))}
            </OptionGroup>
          </div>
          <p className="ac-keys ac-stage-hint ac-keys-desk">
            <span className="ac-kbd">1</span>–<span className="ac-kbd">{step.lines.length}</span> or{" "}
            <span className="ac-kbd">↑</span>
            <span className="ac-kbd">↓</span> pick a line · <span className="ac-kbd">Enter</span> checks
          </p>
          {dust}
        </>
      );
    case "tune-slider":
      return (
        <>
          <SliderStage step={step} runner={runner} draft={draft} answered={answered} examples={examples} onDraft={onDraft} />
          {dust}
        </>
      );
    case "drag-body":
      if (sceneFailed) return <FailedStep step={step} examples={examples} />;
      return (
        <>
          <DragBodyStage step={step} runner={runner} draft={draft} examples={examples} onDraft={onDraft} onStatus={onSceneStatus} />
          {dust}
        </>
      );
    case "draw-skyline":
      if (sceneFailed) return <FailedStep step={step} examples={examples} />;
      return (
        <SkylineStage step={step} runner={runner} draft={draft} examples={examples} onDraft={onDraft} onStatus={onSceneStatus} />
      );
    case "drop-pin":
      return <PendingStep step={step} examples={examples} />;
  }
}

function ChoiceScene({
  step,
  views,
  draft,
  answered,
  examples,
  celebrate,
}: {
  step: Extract<Step, { kind: "choice" | "predict" }>;
  views: readonly OptionView[];
  draft: Draft;
  answered: boolean;
  examples: WorkedExamples;
  celebrate: number;
}) {
  const stage = step.stage ?? { scene: "pip" as const, caption: "Pip, at my south pole" };
  const caption = filledText(stage.caption, examples);
  if (stage.scene === "pip") return <PipScene caption={caption} celebrate={celebrate} />;

  const label = (index: number) => filledText(step.options[index] ?? "", examples);
  const angleOf = (index: number) => resolveDegrees(stage.angles[index] ?? null, examples);
  const marks: RulerMark[] = [];
  views.forEach((view, index) => {
    const angle = angleOf(index);
    if (angle === null) return;
    if (view.state === "missed") marks.push({ angle, label: `Not ${lowerFirst(label(index))}`, kind: "missed" });
  });
  const live = answered ? views.findIndex((view) => view.state === "answer") : draft && "selected" in draft ? draft.selected : -1;
  const liveAngle = live >= 0 ? angleOf(live) : null;
  if (live >= 0 && liveAngle !== null) marks.push({ angle: liveAngle, label: label(live), kind: answered ? "answer" : "selected" });

  const description = `Pip on the ground under a sky ruler from the horizon, 0°, to straight up, 90°.${
    live >= 0 && liveAngle !== null ? ` The line marks ${label(live)}, at ${liveAngle}°.` : ""
  }`;
  return <SkyRuler caption={caption} marks={marks} celebrate={celebrate} description={description} />;
}

function Reveal({ reveal, examples }: { reveal: RevealSpec; examples: WorkedExamples }) {
  const reduced = useLunaReducedMotion();
  return (
    <motion.div
      className="ac-reveal"
      initial={reduced ? { opacity: 0 } : { opacity: 0, y: -12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduced ? 0.15 : 0.8, ease: EASE }}
    >
      {reveal.kind === "panel" ? (
        <PanelBox panel={reveal.panel} caption={filledText(reveal.caption, examples)} />
      ) : (
        <div className="ac-reveal-card" role="status">
          <h3>What happened</h3>
          <p>{filledText(reveal.kind === "text" ? reveal.text : reveal.caption, examples)}</p>
        </div>
      )}
    </motion.div>
  );
}

/** A Mission Control panel in its 360px box. The panels are not built yet, so it says so. */
export function PanelBox({ panel, caption }: { panel: PanelId; caption?: string }) {
  return (
    <div className="ac-mcbox">
      <div className="ac-mcbox-h">{panelName(panel)}</div>
      <div className="ac-mcbox-body">The {panelName(panel)} will play this here once the lesson can show it.</div>
      {caption ? <div className="ac-mcbox-f">{caption}</div> : null}
    </div>
  );
}

function FormulaStage({
  step,
  views,
  draft,
  answered,
  examples,
  onDraft,
}: {
  step: Extract<Step, { kind: "fill-formula" }>;
  views: readonly OptionView[];
  draft: Draft;
  answered: boolean;
  examples: WorkedExamples;
  onDraft: (draft: Draft) => void;
}) {
  const reduced = useLunaReducedMotion();
  const tex = filledText(step.tex, examples);
  const slotAt = tex.indexOf("?");
  const before = slotAt >= 0 ? tex.slice(0, slotAt) : tex;
  const after = slotAt >= 0 ? tex.slice(slotAt + 1) : "";
  const placed = answered
    ? views.findIndex((view) => view.state === "answer")
    : draft && "selected" in draft
      ? draft.selected
      : -1;
  const correct = answered && views[placed]?.correct === true;
  const tileId = (index: number) => `ac-tile-${step.id}-${index}`;
  const pieceLabel = (index: number) => filledText(step.options[index] ?? "", examples);
  const spoken = `${before.trim()} ${placed >= 0 ? pieceLabel(placed) : "blank"} ${after.trim()}`.trim();

  return (
    <LayoutGroup id={`formula-${step.id}`}>
      <div className="ac-formula" role="math" aria-label={spoken}>
        {before.trim() ? <span className="ac-formula-part">{before.trim()}</span> : null}
        <span className="ac-slot" data-full={placed >= 0}>
          {placed >= 0 ? (
            <motion.span
              layoutId={tileId(placed)}
              className="ac-slot-tile"
              transition={{ duration: reduced ? 0 : 0.25, ease: EASE }}
            >
              {pieceLabel(placed)}
              {correct ? <CorrectMark showLabel={false} /> : null}
            </motion.span>
          ) : (
            <span className="ac-visually-hidden">Empty slot</span>
          )}
        </span>
        {after.trim() ? <span className="ac-formula-part">{after.trim()}</span> : null}
      </div>
      <OptionGroup
        label="Pieces"
        className="ac-tiles"
        views={views}
        locked={answered}
        onPick={(index) => onDraft({ kind: "fill-formula", selected: index })}
      >
        {step.options.map((_, index) => {
          const view = views[index] ?? { state: "default" as const, note: null, correct: false };
          const inSlot = index === placed;
          const disabled = answered || view.state === "missed";
          return (
            <button
              key={index}
              type="button"
              role="radio"
              aria-checked={inSlot}
              aria-disabled={disabled || undefined}
              tabIndex={index === optionTabStop(views, placed) ? 0 : -1}
              className="ac-tile"
              data-state={view.state}
              data-ac-option={index}
              onClick={() => {
                if (!disabled) onDraft({ kind: "fill-formula", selected: index });
              }}
            >
              <span className="ac-opt-key" aria-hidden="true">
                {index + 1}
              </span>
              {inSlot ? (
                <span>{pieceLabel(index)}</span>
              ) : (
                <motion.span layoutId={tileId(index)} transition={{ duration: reduced ? 0 : 0.25, ease: EASE }}>
                  {pieceLabel(index)}
                </motion.span>
              )}
            </button>
          );
        })}
      </OptionGroup>
    </LayoutGroup>
  );
}

function SliderStage({
  step,
  runner,
  draft,
  answered,
  examples,
  onDraft,
}: {
  step: Extract<Step, { kind: "tune-slider" }>;
  runner: RunnerState;
  draft: Draft;
  answered: boolean;
  examples: WorkedExamples;
  onDraft: (draft: Draft) => void;
}) {
  const { slider } = step;
  if (slider.kind === "date") {
    return (
      <div className="ac-slider">
        <p>A date slider is not on this screen yet.</p>
      </div>
    );
  }
  const last = runner.attempts[runner.attempts.length - 1];
  const value =
    draft && draft.kind === "tune-slider" && draft.variant === "number"
      ? draft.value
      : last && last.kind === "tune-slider" && last.variant === "number"
        ? last.value
        : slider.min;
  const label = slider.label ?? "Value";
  const right = answered && runner.phase === "correct";
  return (
    <div className="ac-slider">
      <div className="ac-slider-row">
        <label htmlFor={`ac-slider-${step.id}`}>{label}</label>
        <output htmlFor={`ac-slider-${step.id}`} aria-live="off">
          {withUnit(value, slider.unit)}
        </output>
      </div>
      <input
        id={`ac-slider-${step.id}`}
        className="ac-range"
        type="range"
        min={slider.min}
        max={slider.max}
        step={slider.step}
        value={value}
        disabled={answered}
        aria-valuetext={withUnit(value, slider.unit)}
        data-ac-slider=""
        onChange={(event) => onDraft({ kind: "tune-slider", variant: "number", value: Number(event.target.value) })}
      />
      <div className="ac-slider-ends" aria-hidden="true">
        <span>
          {withUnit(slider.min, slider.unit)}
        </span>
        <span>
          {withUnit(slider.max, slider.unit)}
        </span>
      </div>
      {slider.readout ? <SliderReadout readout={slider.readout} at={value} examples={examples} /> : null}
      {right ? <CorrectMark label="Goal reached" /> : null}
      <p className="ac-keys ac-keys-desk">
        <span className="ac-kbd">←</span>
        <span className="ac-kbd">→</span> move the slider · <span className="ac-kbd">Enter</span> checks
      </p>
    </div>
  );
}

/**
 * A slider's live readout, such as the curvature drop or the link time. The number comes
 * from `numberReadoutAt` (a looked-up worked example, or s²/2R for the drop); this only
 * writes it, by the one rounding rule.
 */
function SliderReadout({ readout, at, examples }: { readout: NumberReadout; at: number; examples: WorkedExamples }) {
  const value = numberReadoutAt(readout, at, examples);
  let text: string;
  if (value === null) text = "not built yet";
  else if (typeof value === "string") text = value;
  else if (readout.kind === "curvature-drop") text = `${formatNumber(value, 0)} m`;
  else if (readout.kind === "example-list") {
    const rule = unitRuleFor(readout.key);
    text = `${formatNumber(value, rule?.decimals ?? 2)}${rule?.unit === "pct" ? "%" : ""}`;
  } else text = formatNumber(value, 2);
  return (
    <p className="ac-readout" aria-live="polite">
      <span>{readout.label.charAt(0).toUpperCase() + readout.label.slice(1)}</span>
      <output className="ac-fill">{text}</output>
    </p>
  );
}

/**
 * A drag or sketch step whose site data did not load: a plain message, the real answer from
 * the worked examples, and "Continue", so the lesson is never a dead end. No XP.
 */
function FailedStep({ step, examples }: { step: Extract<Step, { kind: "drag-body" | "draw-skyline" }>; examples: WorkedExamples }) {
  const preview = panelPreview(step);
  return (
    <div className="ac-pending" role="alert">
      <h2>The horizon did not load</h2>
      <p>This step needs the site's stored skyline and Sun and Earth positions, and they did not arrive.</p>
      {preview ? (
        <div className="ac-reveal-card ac-pending-answer">
          <h3>What you would find</h3>
          <p>{filledText(preview.reveal, examples)}</p>
        </div>
      ) : null}
      <p className="ac-pending-note">Continue moves on. No XP for this step, and it does not count for your stars.</p>
    </div>
  );
}

/** What the learner will do on a panel step, by kind. */
function pendingAction(step: Extract<Step, { kind: "drag-body" | "draw-skyline" | "drop-pin" }>): string {
  if (step.kind === "drag-body") return step.body === "sun" ? "Dragging the Sun" : "Dragging Earth";
  return PENDING_STEPS[step.kind]?.action ?? "This step";
}

/**
 * A panel step whose step component is not built yet (`drop-pin`). It shows the real answer
 * from the worked examples, and Continue moves on for no XP.
 */
function PendingStep({
  step,
  examples,
}: {
  step: Extract<Step, { kind: "drag-body" | "draw-skyline" | "drop-pin" }>;
  examples: WorkedExamples;
}) {
  const panelId = step.kind === "drag-body" ? step.panel : PENDING_STEPS[step.kind]?.panel;
  const panel = panelId ? panelName(panelId) : "Mission Control";
  const preview = panelPreview(step);
  return (
    <div className="ac-pending">
      <Hourglass size={28} strokeWidth={1.6} aria-hidden="true" color="var(--ink-3)" />
      <h2>{pendingAction(step)} comes later</h2>
      <p>Once it is ready, this step works inside the {panel} view.</p>
      {preview ? (
        <div className="ac-reveal-card ac-pending-answer" role="status">
          <h3>What you would find</h3>
          <p>{filledText(preview.reveal, examples)}</p>
        </div>
      ) : null}
      <p className="ac-pending-note">No XP for this step, and it does not count for your stars.</p>
    </div>
  );
}
