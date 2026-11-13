import { ArrowRight, X } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { Luna } from "../../components/luna";
import { useWorkedExamples } from "../../data";
import "./academy.css";
import { LESSONS, type LessonSummary } from "./catalog";
import { LessonScreen } from "./lesson-screen";
import { sampleExamples, sampleLesson } from "./lessons/sample";
import { PathMap } from "./path-map";
import type { WorkedExamples } from "./placeholders";
import type { Lesson } from "./types";
import { lessonCheck, lessonScreenKind } from "./validate";

type AcademyRoutesProps = {
  lessonId?: string;
  /** The lesson opened for `lesson.id`. Defaults to the sample. Tests pass a broken one. */
  playable?: Lesson;
};

function summaryFrom(lesson: Lesson): LessonSummary {
  const unlocks = typeof lesson.unlocks === "string" ? lesson.unlocks : (lesson.unlocks[0] ?? "SystemView");
  return { id: lesson.id, title: lesson.title, tagline: lesson.tagline, patchName: lesson.patch.name, unlocks };
}

/** Every Academy animation reads the reduce-motion setting itself (useLunaReducedMotion). */
export default function AcademyRoutes({ lessonId, playable = sampleLesson }: AcademyRoutesProps) {
  const worked = useWorkedExamples();
  // The real worked examples, with the sample's own toy values on top.
  const examples = useMemo<WorkedExamples>(() => ({ ...(worked.data ?? {}), ...sampleExamples }), [worked.data]);
  if (!lessonId) return <PathMap />;
  if (lessonId === playable.id) {
    const examplesForCheck = playable.id === sampleLesson.id ? sampleExamples : {};
    if (lessonScreenKind(playable, lessonCheck(examplesForCheck)) === "unwritten") {
      return <UnwrittenLesson lesson={summaryFrom(playable)} />;
    }
    return (
      <LessonScreen
        key={playable.id}
        lesson={playable}
        examples={playable.id === sampleLesson.id ? examples : {}}
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

function UnwrittenLesson({ lesson }: { lesson: LessonSummary }) {
  const number = LESSONS.findIndex((item) => item.id === lesson.id) + 1;
  return (
    <PlainPage>
      <Luna mood="thinking" size={88} decorative />
      <h1>
        {number} · {lesson.title}
      </h1>
      <p>{lesson.tagline}</p>
      <p>This lesson is not written yet.</p>
      <Link className="ac-btn ac-btn--primary" to="/academy">
        Back to the path
      </Link>
    </PlainPage>
  );
}

function MissingLesson({ lessonId }: { lessonId: string }) {
  return (
    <PlainPage>
      <Luna mood="surprised" size={88} decorative />
      <h1>No lesson here</h1>
      <p>There is no lesson with the id “{lessonId}”.</p>
      <Link className="ac-btn ac-btn--primary" to="/academy">
        Back to the path
      </Link>
    </PlainPage>
  );
}
