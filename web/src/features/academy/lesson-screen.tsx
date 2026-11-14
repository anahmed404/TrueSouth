import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import { useNavigate } from "react-router";
import { CompleteScreen } from "./complete-screen";
import { createValueEvaluator, type GoalEvaluator } from "./evaluator";
import { Conversation, type TalkTab } from "./lesson/conversation";
import { Stage } from "./lesson/stage";
import { LessonTopBar } from "./lesson/top-bar";
import { CARDS } from "./cards";
import type { WorkedExamples } from "./placeholders";
import {
  commitLessonProgress,
  initialRunnerState,
  needsLeaveCheck,
  reduceRunner,
  type RunnerAction,
  type RunnerState,
} from "./runner";
import {
  draftAfterCheck,
  initialDraft,
  isAnswered,
  isPickKind,
  optionViews,
  pipAt,
  primaryAction,
  resultFor,
  type Draft,
  type PrimaryAction,
} from "./step-view";
import { progressMarks, reviewRunner, reviewTarget } from "./review";
import { useAcademyStore } from "./store";
import { createLiveValue } from "./live-value";
import type { Lesson, Submission } from "./types";
import { ConfirmDialog } from "./ui/dialog";

function submissionFrom(draft: Draft): Submission | null {
  if (!draft) return null;
  if (draft.kind === "drag-body") {
    return { kind: "drag-body", value: draft.value, utc: draft.utc, ...(draft.values ? { values: draft.values } : {}) };
  }
  if (draft.kind === "draw-skyline") return { kind: "draw-skyline", sketch: draft.sketch, gapDeg: draft.gapDeg };
  if (draft.kind === "tune-slider") {
    if (draft.variant === "date") return { kind: "tune-slider", variant: "date", utc: draft.utc };
    return { kind: "tune-slider", variant: "number", value: draft.value };
  }
  return { kind: draft.kind, selected: draft.selected };
}

const ignoreDraft = () => undefined;
const ignoreStatus = () => undefined;

/** True when a key press belongs to a control that handles Enter itself. */
function ownsEnter(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.closest("[data-ac-option], [data-ac-slider]")) return false;
  return Boolean(target.closest("button, a, input, textarea, select, [role='tab']"));
}

export function LessonScreen({
  lesson,
  examples,
  examplesPending = false,
  evaluator,
}: {
  lesson: Lesson;
  examples: WorkedExamples;
  /** `worked_examples.json` is still loading. */
  examplesPending?: boolean;
  evaluator?: GoalEvaluator;
}) {
  const navigate = useNavigate();
  const goalEvaluator = useMemo(() => evaluator ?? createValueEvaluator(), [evaluator]);
  const recordCompletion = useAcademyStore((state) => state.recordCompletion);
  const [runner, setRunner] = useState<RunnerState>(() => initialRunnerState());
  const [draft, setDraft] = useState<Draft>(() => initialDraft(lesson.steps[0]));
  const [tab, setTab] = useState<TalkTab>("luna");
  const [celebrate, setCelebrate] = useState(0);
  const [leaveTo, setLeaveTo] = useState<string | null>(null);
  // Pip's power while a drag drives it (lesson 2 step 4), read by the meter alone, so a
  // drag does not re-render the lesson screen. Cleared on each new step.
  const livePower = useMemo(() => createLiveValue<number | null>(null), []);
  useEffect(() => livePower.set(null), [runner.stepIndex, livePower]);
  // A finished step opened again from the progress marks, read-only (review.ts), or null.
  // A request for a step not yet reached is ignored by `reviewTarget`.
  const [viewing, setViewing] = useState<number | null>(null);
  // The learner's last draft on each finished step (where the body was, the sketch), so a
  // review can draw it. Kept for this lesson only, like the rest of its progress.
  const pastDrafts = useRef(new Map<number, Draft>());
  // Whether the current step's site data failed to load, by step id, so a new step starts clean.
  const [failedStep, setFailedStep] = useState<string | null>(null);
  const recorded = useRef(false);
  const primaryRef = useRef<HTMLButtonElement>(null);
  const stepRef = useRef<HTMLDivElement>(null);

  const step = lesson.steps[runner.stepIndex];
  const views = useMemo(() => (step ? optionViews(step, runner, draft) : []), [step, runner, draft]);
  const isLast = runner.stepIndex === lesson.steps.length - 1;
  const sceneFailed = step !== undefined && failedStep === step.id;
  const primary = step ? primaryAction(step, runner, draft, isLast, sceneFailed) : null;
  const stepId = step?.id;
  const onSceneStatus = useCallback(
    (status: "loading" | "ready" | "error") => {
      if (stepId === undefined) return;
      setFailedStep((current) => (status === "error" ? stepId : current === stepId ? null : current));
    },
    [stepId],
  );
  const onStageDraft = useCallback(
    (next: Draft) => {
      if (!isAnswered(runner)) setDraft(next);
    },
    [runner],
  );

  // Save once, when the lesson is complete. Leaving part-way saves nothing.
  useEffect(() => {
    if (recorded.current) return;
    commitLessonProgress(runner, (record) => {
      recorded.current = true;
      recordCompletion(lesson.id, record.stars, record.xp, record.patch);
    });
  }, [runner, lesson.id, recordCompletion]);

  const dispatch = useCallback(
    (action: RunnerAction) => {
      const next = reduceRunner(runner, action, lesson, goalEvaluator, examples);
      if (next === runner) return;
      if (action.type !== "submit") pastDrafts.current.set(runner.stepIndex, draft);
      setViewing(null);
      setRunner(next);
      const nextStep = lesson.steps[next.stepIndex];
      if (action.type === "submit" && step) {
        setDraft(draftAfterCheck(step, next, draft));
        if (next.phase === "correct") setCelebrate((count) => count + 1);
        if (isAnswered(next)) requestAnimationFrame(() => primaryRef.current?.focus());
      } else {
        setDraft(initialDraft(nextStep));
        setCelebrate(0);
        setTab("luna");
        // Focus the new step's area, not its first option: a ring on an option would read
        // as a second selection. Tab goes on into the step; number keys work at once.
        requestAnimationFrame(() => stepRef.current?.focus());
      }
    },
    [runner, lesson, goalEvaluator, examples, step, draft],
  );

  const reviewing = reviewTarget(runner, viewing);
  const openStep = useCallback(
    (index: number) => {
      // The current step's mark returns to it; any other is reviewed if it is finished.
      setViewing(index === runner.stepIndex ? null : reviewTarget(runner, index));
      setTab("luna");
      requestAnimationFrame(() => stepRef.current?.focus());
    },
    [runner],
  );
  const backToCurrent = useCallback(() => openStep(runner.stepIndex), [openStep, runner.stepIndex]);

  const onPrimary = useCallback(() => {
    if (!step || !primary) return;
    if (reviewing !== null) {
      backToCurrent();
      return;
    }
    if (primary.kind === "continue") dispatch({ type: "continue" });
    else if (primary.kind === "skip") dispatch({ type: "skip" });
    else if (primary.kind === "check" && primary.enabled) {
      const submission = submissionFrom(draft);
      if (submission) dispatch({ type: "submit", submission });
    }
  }, [step, primary, draft, dispatch, reviewing, backToCurrent]);

  const onPick = useCallback(
    (index: number) => {
      if (!step || !isPickKind(step.kind) || isAnswered(runner) || reviewing !== null) return;
      if (views[index]?.state === "missed") return;
      setDraft({ kind: step.kind, selected: index });
    },
    [step, runner, views, reviewing],
  );

  // Keyboard: number keys pick, Backspace empties a formula slot, Enter checks or continues.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (leaveTo !== null || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) return;
      // The "Under the hood" tab hides the step, so no shortcut may answer it from there.
      if (!step || tab !== "luna") return;
      if (reviewing !== null) {
        // A reviewed step is read-only: Enter or Escape goes back; nothing else answers it.
        if (event.key === "Escape" || (event.key === "Enter" && !ownsEnter(event.target))) {
          event.preventDefault();
          backToCurrent();
        }
        return;
      }
      if (event.key === "Enter") {
        if (ownsEnter(event.target)) return;
        event.preventDefault();
        onPrimary();
        return;
      }
      if (event.key === "Backspace" && step.kind === "fill-formula" && !isAnswered(runner)) {
        setDraft(null);
        return;
      }
      if (/^[1-9]$/.test(event.key) && isPickKind(step.kind)) {
        if (event.target instanceof HTMLElement && event.target.closest("input, textarea")) return;
        onPick(Number(event.key) - 1);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [step, tab, runner, onPrimary, onPick, leaveTo, reviewing, backToCurrent]);

  const requestLeave = (to: string) => {
    if (needsLeaveCheck(runner)) setLeaveTo(to);
    else navigate(to);
  };

  if (runner.phase === "complete") {
    return <CompleteScreen lesson={lesson} runner={runner} examples={examples} />;
  }

  if (!step || !primary) {
    return (
      <main className="ac-screen">
        <div className="ac-plain">
          <h1>{lesson.title}</h1>
          <p>This lesson has no steps.</p>
        </div>
      </main>
    );
  }

  // What is on screen: the current step, or a finished one opened for review (read-only).
  const reviewed = reviewing !== null ? reviewRunner(runner, reviewing) : null;
  const shownStep = (reviewed ? lesson.steps[reviewed.stepIndex] : undefined) ?? step;
  const shownRunner = reviewed ?? runner;
  const shownDraft = reviewed ? (pastDrafts.current.get(reviewed.stepIndex) ?? null) : draft;
  const shownViews = reviewed ? optionViews(shownStep, shownRunner, shownDraft) : views;
  const shownPrimary: PrimaryAction = reviewed ? { kind: "back", label: `Back to step ${runner.stepIndex + 1}` } : primary;
  const result = resultFor(shownStep, shownRunner);
  const marks = progressMarks(runner, lesson.steps.length, reviewing);

  return (
    <main className="ac-screen ac-screen--fixed">
      <LessonTopBar
        title={lesson.title}
        stepIndex={runner.stepIndex}
        stepCount={lesson.steps.length}
        marks={marks}
        reviewing={reviewing}
        onMark={openStep}
        pip={pipAt(lesson.steps, runner.stepIndex)}
        livePower={livePower}
        onClose={() => requestLeave("/academy")}
        onSkip={(event: MouseEvent<HTMLAnchorElement>) => {
          event.preventDefault();
          requestLeave("/mission");
        }}
      />
      <div
        className="ac-split"
        ref={stepRef}
        tabIndex={-1}
        aria-label={
          reviewed
            ? `Reviewing step ${reviewed.stepIndex + 1} of ${lesson.steps.length}, read-only`
            : `Step ${runner.stepIndex + 1} of ${lesson.steps.length}`
        }
        data-reviewing={reviewed ? true : undefined}
      >
        <Stage
          key={reviewed ? `review-${reviewed.stepIndex}` : "current"}
          step={shownStep}
          runner={shownRunner}
          draft={shownDraft}
          views={shownViews}
          examples={examples}
          celebrate={reviewed ? 0 : celebrate}
          onDraft={reviewed ? ignoreDraft : onStageDraft}
          sceneFailed={reviewed ? false : sceneFailed}
          onSceneStatus={reviewed ? ignoreStatus : onSceneStatus}
          onLivePower={reviewed ? undefined : livePower.set}
        />
        <Conversation
          step={shownStep}
          runner={shownRunner}
          views={shownViews}
          examples={examples}
          examplesPending={examplesPending}
          card={CARDS[lesson.card]}
          lessonTitle={lesson.title}
          tab={tab}
          onTab={setTab}
          onPick={onPick}
          primary={shownPrimary}
          onPrimary={onPrimary}
          result={result}
          primaryRef={primaryRef}
        />
      </div>
      <ConfirmDialog
        open={leaveTo !== null}
        title="Leave the lesson?"
        keepLabel="Keep going"
        confirmLabel="Leave"
        onKeep={() => setLeaveTo(null)}
        onConfirm={() => {
          const to = leaveTo ?? "/academy";
          setLeaveTo(null);
          navigate(to);
        }}
      >
        <p>
          You will lose this lesson's {runner.xp} XP so far. XP, stars and patches are saved when you finish a lesson.
        </p>
      </ConfirmDialog>
    </main>
  );
}
