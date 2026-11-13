import { ArrowRight, X } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { Luna } from "../../components/luna";
import { useWorkedExamples } from "../../data";
import "./academy.css";
import { LESSONS, type LessonSummary } from "./catalog";
import { LessonScreen } from "./lesson-screen";
import { writtenLesson } from "./lessons";
import { sampleExamples, sampleLesson } from "./lessons/sample";
import { PathMap } from "./path-map";
import type { WorkedExamples } from "./placeholders";
import type { Lesson } from "./types";
import type { HookResult } from "../../data/hooks";
import { lessonCheck, lessonScreenKind, missingExampleKeys } from "./validate";

type AcademyRoutesProps = {
  lessonId?: string;
  /** A lesson opened for `lesson.id` instead of a catalog one. Defaults to the sample. Tests pass a broken one. */
  playable?: Lesson;
};

function summaryFrom(lesson: Lesson): LessonSummary {
  const unlocks = typeof lesson.unlocks === "string" ? lesson.unlocks : (lesson.unlocks[0] ?? "SystemView");
  return { id: lesson.id, title: lesson.title, tagline: lesson.tagline, patchName: lesson.patch.name, unlocks };
}

/** Every Academy animation reads the reduce-motion setting itself (useLunaReducedMotion). */
/**
 * A written lesson, or the plain page that says why it cannot start: its numbers are still
 * loading, failed to load, are not all built, or do not match the lesson.
 */
export function WrittenLesson({ lesson, worked }: { lesson: Lesson; worked: HookResult<unknown> }) {
  const values = useMemo<WorkedExamples>(
    () => (worked.data && typeof worked.data === "object" ? { ...(worked.data as Record<string, unknown>) } : {}),
    [worked.data],
  );
  const summary = summaryFrom(lesson);
  if (worked.status === "loading") return <LoadingLesson lesson={summary} />;
  if (worked.status === "error") return <FailedLesson lesson={summary} />;
  if (missingExampleKeys(lesson, values).length > 0) return <UnbuiltLesson lesson={summary} />;
  if (lessonScreenKind(lesson, lessonCheck(values)) === "unwritten") return <BrokenLesson lesson={summary} />;
  return <LessonScreen key={lesson.id} lesson={lesson} examples={values} />;
}

export default function AcademyRoutes({ lessonId, playable = sampleLesson }: AcademyRoutesProps) {
  const worked = useWorkedExamples();
  // The real worked examples, with the sample's own toy values on top, for the sample only.
  const sampleValues = useMemo<WorkedExamples>(() => ({ ...(worked.data ?? {}), ...sampleExamples }), [worked.data]);
  if (!lessonId) return <PathMap />;

  const written = writtenLesson(lessonId);
  if (written) return <WrittenLesson lesson={written} worked={worked} />;

  if (lessonId === playable.id) {
    const examplesForCheck = playable.id === sampleLesson.id ? sampleExamples : {};
    if (lessonScreenKind(playable, lessonCheck(examplesForCheck)) === "unwritten") {
      return <UnwrittenLesson lesson={summaryFrom(playable)} />;
    }
    return (
      <LessonScreen
        key={playable.id}
        lesson={playable}
        examples={playable.id === sampleLesson.id ? sampleValues : {}}
        examplesPending={worked.status === "loading"}
      />
    );
  }
  const summary = LESSONS.find((lesson) => lesson.id === lessonId);
  if (!summary) return <MissingLesson lessonId={lessonId} />;
  return <UnwrittenLesson lesson={summary} />;
}

function PlainPage({ children }: { children: ReactNode }) {
  return (
    <main className="ac-screen">
      <header className="ac-ct">
        <Link className="ac-icon-btn" to="/academy" aria-label="Back to the path">
          <X aria-hidden="true" />
        </Link>
        <span className="ac-spacer" />
        <Link className="ac-quiet" to="/mission">
          Skip to Mission Control
          <ArrowRight aria-hidden="true" />
        </Link>
      </header>
      <div className="ac-plain">{children}</div>
    </main>
  );
}

function lessonHeading(lesson: LessonSummary): string {
  const number = LESSONS.findIndex((item) => item.id === lesson.id) + 1;
  return number > 0 ? `${number} · ${lesson.title}` : lesson.title;
}

function BackToPath() {
  return (
    <Link className="ac-btn ac-btn--primary" to="/academy">
      Back to the path
    </Link>
  );
}

function UnwrittenLesson({ lesson }: { lesson: LessonSummary }) {
  return (
    <PlainPage>
      <Luna mood="thinking" size={88} decorative />
      <h1>{lessonHeading(lesson)}</h1>
      <p>{lesson.tagline}</p>
      <p>This lesson is not written yet.</p>
      <BackToPath />
    </PlainPage>
  );
}

/** `worked_examples.json` is still on its way. Every number in a lesson comes from it. */
function LoadingLesson({ lesson }: { lesson: LessonSummary }) {
  return (
    <PlainPage>
      <Luna mood="idle" size={88} decorative />
      <h1>{lessonHeading(lesson)}</h1>
      <p role="status">Getting this lesson's numbers ready…</p>
    </PlainPage>
  );
}

function FailedLesson({ lesson }: { lesson: LessonSummary }) {
  return (
    <PlainPage>
      <Luna mood="worried" size={88} decorative />
      <h1>{lessonHeading(lesson)}</h1>
      <p role="alert">This lesson's numbers did not load, so it cannot start. Check your connection and try again.</p>
      <button type="button" className="ac-btn ac-btn--primary" onClick={() => window.location.reload()}>
        Try again
      </button>
      <Link className="ac-quiet" to="/academy">
        Back to the path
      </Link>
    </PlainPage>
  );
}

/** A number the lesson quotes is missing from `worked_examples.json`, or has no usable value. */
function UnbuiltLesson({ lesson }: { lesson: LessonSummary }) {
  return (
    <PlainPage>
      <Luna mood="thinking" size={88} decorative />
      <h1>{lessonHeading(lesson)}</h1>
      <p role="alert">Some of this lesson's numbers are not built yet, so it cannot start. Please try another lesson.</p>
      <BackToPath />
    </PlainPage>
  );
}

/** The lesson and the worked examples it was written for do not match. A bug, said plainly. */
function BrokenLesson({ lesson }: { lesson: LessonSummary }) {
  return (
    <PlainPage>
      <Luna mood="worried" size={88} decorative />
      <h1>{lessonHeading(lesson)}</h1>
      <p role="alert">This lesson's numbers do not match the lesson, so it cannot start. That is our bug, not yours.</p>
      <BackToPath />
    </PlainPage>
  );
}

function MissingLesson({ lessonId }: { lessonId: string }) {
  return (
    <PlainPage>
      <Luna mood="surprised" size={88} decorative />
      <h1>No lesson here</h1>
      <p>There is no lesson with the id “{lessonId}”.</p>
      <BackToPath />
    </PlainPage>
  );
}
