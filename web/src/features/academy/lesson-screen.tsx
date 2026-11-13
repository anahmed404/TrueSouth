import { useMemo, useState } from "react";
import { Link } from "react-router";
import { Luna, LunaSays } from "../../components/luna";
import { LESSONS } from "./catalog";
import { AcademyChrome } from "./chrome";
import type { GoalEvaluator } from "./evaluator";
import { sampleCard } from "./lessons/sample";
import { fillPlaceholders, type WorkedExamples } from "./placeholders";
import { initialRunnerState, reduceRunner, type RunnerState } from "./runner";
import { useAcademyStore } from "./store";
import { createStubEvaluator } from "./stub-evaluator";
import type { Lesson, Step, Submission, UnderTheHoodCard } from "./types";

const cards: Record<string, UnderTheHoodCard> = {
  [sampleCard.id]: sampleCard,
};

function submissionFor(step: Step | undefined): Submission | null {
  if (!step) return null;
  if (step.kind === "drag-body") return { kind: "drag-body", value: 0 };
  if (step.kind === "tune-slider") return { kind: "tune-slider", value: step.slider.min };
  return null;
}

function nextLessonHref(lessonId: string): string | null {
  const index = LESSONS.findIndex((lesson) => lesson.id === lessonId);
  if (index < 0) return null;
  const next = LESSONS[index + 1];
  return next ? `/academy/${next.id}` : null;
}

function Filled({ value, examples }: { value: string; examples: WorkedExamples }) {
  const filled = fillPlaceholders(value, examples);
  return (
    <>
      {filled.text}
      {filled.missing.length > 0 ? <span> Missing worked example: {filled.missing.join(", ")}.</span> : null}
    </>
  );
}

export function LessonScreen({
  lesson,
  examples,
  evaluator,
}: {
  lesson: Lesson;
  examples: WorkedExamples;
  evaluator?: GoalEvaluator;
}) {
  const goalEvaluator = useMemo(() => evaluator ?? createStubEvaluator(true), [evaluator]);
  const recordCompletion = useAcademyStore((state) => state.recordCompletion);
  const [runner, setRunner] = useState<RunnerState>(() => initialRunnerState());
  const [submission, setSubmission] = useState<Submission | null>(() => submissionFor(lesson.steps[0]));
  const [notice, setNotice] = useState("");
  const [cardOpen, setCardOpen] = useState(false);
  const [recorded, setRecorded] = useState(false);

  function finishIfComplete(next: RunnerState) {
    if (recorded || next.phase !== "complete" || next.stars === 0) return;
    setRecorded(true);
    recordCompletion(lesson.id, next.stars, next.xp);
  }

  function onCheck() {
    const step = lesson.steps[runner.stepIndex];
    if (!step) return;
    if (runner.phase !== "prompt" && runner.phase !== "hint") return;
    if (!submission || submission.kind !== step.kind) {
      setNotice("Finish this step first.");
      return;
    }
    setNotice("");
    const next = reduceRunner(runner, { type: "submit", submission }, lesson, goalEvaluator);
    setRunner(next);
    finishIfComplete(next);
  }

  function onContinue() {
    const next = reduceRunner(runner, { type: "continue" }, lesson, goalEvaluator);
    setRunner(next);
    setNotice("");
    setSubmission(submissionFor(lesson.steps[next.stepIndex]));
    setCardOpen(false);
    finishIfComplete(next);
  }

  if (runner.phase === "complete") {
    const nextHref = nextLessonHref(lesson.id);
    return (
      <section>
        <AcademyChrome close />
        <Luna mood="cheering" />
        <h1>{lesson.title}</h1>
        <p>{lesson.tagline}</p>
        <p>Lesson complete.</p>
        <p>Stars: {runner.stars}</p>
        <p>XP: {runner.xp}</p>
        <p>Mission patch: {lesson.patch.name}</p>
        <p>
          <Filled value={lesson.recap} examples={examples} />
        </p>
        <p>Unlocked panel: {lesson.unlocks}</p>
        <p>{nextHref ? <Link to={nextHref}>Next lesson</Link> : <Link to="/academy">Back to the path map</Link>}</p>
        <p>
          <Link to="/mission">Open in Mission Control</Link>
        </p>
      </section>
    );
  }

  const step = lesson.steps[runner.stepIndex];
  if (!step) {
    return (
      <section>
        <AcademyChrome close />
        <p>This lesson has no steps.</p>
      </section>
    );
  }

  const waiting = runner.phase === "prompt" || runner.phase === "hint";

  return (
    <section>
      <AcademyChrome close />
      <h1>{lesson.title}</h1>
      <p>{lesson.tagline}</p>
      <p>
        Step {runner.stepIndex + 1} of {lesson.steps.length}
      </p>
      <PipMeters step={step} />
      <LunaSays mood={step.luna.mood} announce>
        <Filled value={step.luna.says} examples={examples} />
      </LunaSays>
      <StepControls
        step={step}
        submission={submission}
        disabled={!waiting}
        examples={examples}
        onSubmission={setSubmission}
      />
      <div aria-live="polite">
        {notice ? <p>{notice}</p> : null}
        {runner.feedback ? (
          <p>
            <Filled value={runner.feedback} examples={examples} />
          </p>
        ) : null}
        {(runner.phase === "correct" || runner.phase === "revealed") && step.kind === "predict" ? (
          <p>
            Reveal: <Filled value={step.reveal.caption} examples={examples} />
          </p>
        ) : null}
      </div>
      <p>
        <button type="button" onClick={waiting ? onCheck : onContinue}>
          {waiting ? "Check" : "Continue"}
        </button>
      </p>
      <p>
        <button type="button" aria-expanded={cardOpen} onClick={() => setCardOpen((open) => !open)}>
          Under the hood
        </button>
      </p>
      {cardOpen ? <CardView card={cards[lesson.card]} examples={examples} /> : null}
      <p>Use Tab and Enter. A slider also takes arrow keys.</p>
    </section>
  );
}

function PipMeters({ step }: { step: Step }) {
  if (!step.pip) return null;
  const power = step.pip.power;
  const link = step.pip.link;
  return (
    <p>
      {power !== undefined ? `Pip power: ${power}%` : null}
      {power !== undefined && link !== undefined ? " · " : null}
      {link === undefined ? null : link ? "Pip: link" : "Pip: blackout"}
    </p>
  );
}

function StepControls({
  step,
  submission,
  disabled,
  examples,
  onSubmission,
}: {
  step: Step;
  submission: Submission | null;
  disabled: boolean;
  examples: WorkedExamples;
  onSubmission: (submission: Submission) => void;
}) {
  switch (step.kind) {
    case "choice":
    case "predict":
    case "fill-formula":
      return (
        <div role="group" aria-label="Answers">
          {step.kind === "fill-formula" ? (
            <p>
              <Filled value={step.tex} examples={examples} />
            </p>
          ) : null}
          {step.options.map((option, index) => {
            const selected = submission?.kind === step.kind && submission.selected === index;
            return (
              <button
                key={`${step.id}-${index}`}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onSubmission({ kind: step.kind, selected: index })}
              >
                <Filled value={option} examples={examples} />
              </button>
            );
          })}
        </div>
      );
    case "spot-bug":
      return (
        <div role="group" aria-label="Lines">
          {step.lines.map((line, index) => {
            const selected = submission?.kind === "spot-bug" && submission.selected === index;
            return (
              <button
                key={`${step.id}-${index}`}
                type="button"
                aria-pressed={selected}
                disabled={disabled}
                onClick={() => onSubmission({ kind: "spot-bug", selected: index })}
              >
                <Filled value={line} examples={examples} />
              </button>
            );
          })}
        </div>
      );
    case "drag-body": {
      const value = submission?.kind === "drag-body" ? submission.value : 0;
      return (
        <p>
          <label htmlFor="academy-marker">Marker</label>{" "}
          <input
            id="academy-marker"
            type="range"
            min={0}
            max={4}
            step={1}
            value={value}
            disabled={disabled}
            onChange={(event) => onSubmission({ kind: "drag-body", value: Number(event.target.value) })}
          />{" "}
          {value} steps
        </p>
      );
    }
    case "tune-slider": {
      const value = submission?.kind === "tune-slider" ? submission.value : step.slider.min;
      return (
        <p>
          <label htmlFor="academy-slider">Slider</label>{" "}
          <input
            id="academy-slider"
            type="range"
            min={step.slider.min}
            max={step.slider.max}
            step={step.slider.step}
            value={value}
            disabled={disabled}
            onChange={(event) => onSubmission({ kind: "tune-slider", value: Number(event.target.value) })}
          />{" "}
          {value} {step.slider.unit}
        </p>
      );
    }
    case "draw-skyline": {
      const sketched = submission?.kind === "draw-skyline";
      return (
        <p>
          <button
            type="button"
            aria-pressed={sketched}
            disabled={disabled}
            onClick={() => onSubmission({ kind: "draw-skyline", sketch: [step.azFrom, step.azTo] })}
          >
            Sketch
          </button>{" "}
          {step.azFrom} to {step.azTo} degrees
        </p>
      );
    }
    case "drop-pin": {
      const placed = submission?.kind === "drop-pin";
      return (
        <p>
          <button
            type="button"
            aria-pressed={placed}
            disabled={disabled}
            onClick={() => onSubmission({ kind: "drop-pin", value: 1 })}
          >
            Place the pin
          </button>
        </p>
      );
    }
  }
}

function CardView({ card, examples }: { card: UnderTheHoodCard | undefined; examples: WorkedExamples }) {
  if (!card) return <p>This card is not written yet.</p>;
  return (
    <div>
      <h2>The idea</h2>
      <p>
        <Filled value={card.idea} examples={examples} />
      </p>
      <h2>The formula</h2>
      <p>
        <Filled value={card.formula} examples={examples} />
      </p>
      <p>{card.formulaSection}</p>
      <h2>A worked example</h2>
      <p>
        <Filled value={card.workedExample} examples={examples} />
      </p>
      <h2>In the code</h2>
      <p>
        {card.inTheCode.fn} in {card.inTheCode.file}
      </p>
      <h2>What can go wrong</h2>
      <p>
        <Filled value={card.whatCanGoWrong} examples={examples} />
      </p>
    </div>
  );
}
