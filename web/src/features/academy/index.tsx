import { ArrowRight, X } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { Luna } from "../../components/luna";
import "./academy.css";
import { LESSONS, type LessonSummary } from "./catalog";
import { LessonScreen } from "./lesson-screen";
import { sampleExamples, sampleLesson } from "./lessons/sample";
import { PathMap } from "./path-map";

type AcademyRoutesProps = {
  lessonId?: string;
};

/** Every Academy animation reads the reduce-motion setting itself (useLunaReducedMotion). */
export default function AcademyRoutes({ lessonId }: AcademyRoutesProps) {
  if (!lessonId) return <PathMap />;
  if (lessonId === sampleLesson.id) {
    return <LessonScreen key={sampleLesson.id} lesson={sampleLesson} examples={sampleExamples} />;
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
