import { Link } from "react-router";
import { LESSONS, type LessonSummary } from "./catalog";
import { AcademyChrome } from "./chrome";
import { LessonScreen } from "./lesson-screen";
import { sampleExamples, sampleLesson } from "./lessons/sample";
import { PathMap } from "./path-map";

type AcademyRoutesProps = {
  lessonId?: string;
};

export default function AcademyRoutes({ lessonId }: AcademyRoutesProps) {
  if (!lessonId) return <PathMap />;
  if (lessonId === sampleLesson.id) {
    return <LessonScreen lesson={sampleLesson} examples={sampleExamples} />;
  }
  const summary = LESSONS.find((lesson) => lesson.id === lessonId);
  if (!summary) return <MissingLesson lessonId={lessonId} />;
  return <UnwrittenLesson lesson={summary} />;
}

function UnwrittenLesson({ lesson }: { lesson: LessonSummary }) {
  return (
    <section>
      <AcademyChrome close />
      <h1>{lesson.title}</h1>
      <p>{lesson.tagline}</p>
      <p>This lesson is not written yet.</p>
      <p>
        <Link to="/academy">Back to the path map</Link>
      </p>
    </section>
  );
}

function MissingLesson({ lessonId }: { lessonId: string }) {
  return (
    <section>
      <AcademyChrome close />
      <h1>No lesson</h1>
      <p>No lesson with id {lessonId}.</p>
      <p>
        <Link to="/academy">Back to the path map</Link>
      </p>
    </section>
  );
}
