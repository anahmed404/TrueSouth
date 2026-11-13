type AcademyRoutesProps = {
  lessonId?: string;
};

export default function AcademyRoutes({ lessonId }: AcademyRoutesProps) {
  return (
    <section>
      <h1>AcademyRoutes</h1>
      {lessonId ? <p>Lesson {lessonId}</p> : <p>Lesson path</p>}
    </section>
  );
}
