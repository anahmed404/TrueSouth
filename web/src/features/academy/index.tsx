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

type AcademyRoutesProps = {
  lessonId?: string;
};

/** Every Academy animation reads the reduce-motion setting itself (useLunaReducedMotion). */
export default function AcademyRoutes({ lessonId }: AcademyRoutesProps) {
  const worked = useWorkedExamples();
  // The real worked examples, with the sample's own toy values on top.
  const examples = useMemo<WorkedExamples>(() => ({ ...(worked.data ?? {}), ...sampleExamples }), [worked.data]);
  if (!lessonId) return <PathMap />;
  if (lessonId === sampleLesson.id) {
    return (
      <LessonScreen
        key={sampleLesson.id}
        lesson={sampleLesson}
        examples={examples}
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
