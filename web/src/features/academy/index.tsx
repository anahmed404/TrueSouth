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
import { lessonCheck, lessonScreenKind } from "./validate";

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
export default function AcademyRoutes({ lessonId, playable = sampleLesson }: AcademyRoutesProps) {
  const worked = useWorkedExamples();
  // The real worked examples, with the sample's own toy values on top, for the sample only.
  const sampleValues = useMemo<WorkedExamples>(() => ({ ...(worked.data ?? {}), ...sampleExamples }), [worked.data]);
  const realValues = useMemo<WorkedExamples>(() => ({ ...(worked.data ?? {}) }), [worked.data]);
  if (!lessonId) return <PathMap />;

  const written = writtenLesson(lessonId);
  if (written) {
    if (worked.status === "loading") return <LoadingLesson lesson={summaryFrom(written)} />;
    if (worked.status === "error") return <FailedLesson lesson={summaryFrom(written)} />;
    if (lessonScreenKind(written, lessonCheck(realValues)) === "unwritten") return <BrokenLesson lesson={summaryFrom(written)} />;
    return <LessonScreen key={written.id} lesson={written} examples={realValues} />;
  }

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
