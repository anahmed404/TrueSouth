import { Link } from "react-router";
import { Luna, LunaSays } from "../../components/luna";
import { ALL_EIGHT_PATCH_ID, LESSONS } from "./catalog";
import { AcademyChrome } from "./chrome";
import { sampleLesson } from "./lessons/sample";
import { useAcademyStore } from "./store";

function patchLabel(id: string): string {
  if (id === ALL_EIGHT_PATCH_ID) return "finishing all eight";
  const lesson = LESSONS.find((item) => item.id === id);
  if (lesson) return lesson.patchName;
  if (id === sampleLesson.id) return sampleLesson.patch.name;
  return id;
}

export function PathMap() {
  const xp = useAcademyStore((state) => state.xp);
  const patches = useAcademyStore((state) => state.patches);
  const lessons = useAcademyStore((state) => state.lessons);
  const sound = useAcademyStore((state) => state.sound);
  const setSound = useAcademyStore((state) => state.setSound);
  const reset = useAcademyStore((state) => state.reset);
  const next = LESSONS.find((lesson) => !lessons[lesson.id]?.patch);

  return (
    <section>
      <h1>Academy</h1>
      <AcademyChrome close={false} />
      <Luna />
      <LunaSays />
      <p>{next ? `Luna is at ${next.title}` : "Luna has finished every lesson."}</p>
      <p>XP: {xp}</p>
      <p>Mission patches: {patches.length === 0 ? "none" : patches.map(patchLabel).join(", ")}</p>
      <p>
        <button type="button" onClick={() => setSound(!sound)}>
          {sound ? "Sound: on" : "Sound: off"}
        </button>
      </p>
      <ul>
        {LESSONS.map((lesson) => {
          const saved = lessons[lesson.id];
          const stars = saved?.stars ?? 0;
          return (
            <li key={lesson.id}>
              <Link to={`/academy/${lesson.id}`}>{lesson.title}</Link>
              {` — stars ${stars} — `}
              {saved?.patch ? `mission patch: ${lesson.patchName}` : "no mission patch"}
            </li>
          );
        })}
      </ul>
      <p>
        <Link to={`/academy/${sampleLesson.id}`}>Sample lesson</Link>
        {" — A sample that A5 replaces. It is not one of the eight lessons."}
      </p>
      <p>
        <button type="button" onClick={reset}>
          Reset progress
        </button>
      </p>
    </section>
  );
}
