import { ArrowDown, ArrowRight } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";
import { LESSONS } from "../academy/catalog";

/**
 * Lessons 1 to 4 are part of the deadline build (work package A5), so a box that teaches
 * one of them links to it. Lessons 5 to 8 get no link. Ids and titles come from the
 * Academy's public catalog; nothing is imported from inside its lesson files.
 */
const LINKED_LESSONS = 4;

export type LessonLink = { href: string; label: string };

export function lessonLink(lessonId: string): LessonLink | null {
  const index = LESSONS.findIndex((lesson) => lesson.id === lessonId);
  const lesson = LESSONS[index];
  if (!lesson || index >= LINKED_LESSONS) return null;
  return { href: `/academy/${lesson.id}`, label: `Lesson ${index + 1}: ${lesson.title}` };
}

type Box = {
  title: string;
  text: string;
  /** The Academy lesson that teaches this step. Linked only for lessons 1 to 4. */
  lesson?: string;
  /** Where on this page the step is checked. */
  checked: { href: string; label: string };
};

type Column = { heading: string; boxes: Box[] };

const COLUMNS: Column[] = [
  {
    heading: "What goes in",
    boxes: [
      {
        title: "JPL Horizons",
        text: "Where the Sun and Earth are, hour by hour.",
        lesson: "l1_sun",
        checked: { href: "#sun-and-earth", label: "Checked in Sun and Earth positions" },
      },
      {
        title: "LOLA terrain",
        text: "How high the ground is near the south pole, from NASA's maps.",
        lesson: "l3_horizon",
        checked: { href: "#terrain", label: "Checked in Terrain geometry" },
      },
    ],
  },
  {
    heading: "Worked out once, in Python",
    boxes: [
      {
        title: "Skyline",
        text: "The outline of the terrain against the sky, seen from each site.",
        lesson: "l2_skyline",
        checked: { href: "#terrain", label: "Checked in Terrain geometry" },
      },
      {
        title: "Hourly series",
        text: "Each site's sky, hour by hour: how much of the Sun and of Earth shows above the skyline.",
        lesson: "l4_link",
        checked: { href: "#nasa-maps", label: "Checked against NASA's maps" },
      },
    ],
  },
  {
    heading: "Worked out in your browser",
    boxes: [
      {
        title: "Scores",
        text: "Mission metrics, statuses and scores for your mission profile, read from the series.",
        lesson: "l6_tradeoffs",
        checked: { href: "#terrain-other", label: "Checked in Other checks" },
      },
    ],
  },
];

function MethodBox({ box }: { box: Box }) {
  const lesson = box.lesson === undefined ? null : lessonLink(box.lesson);
  return (
    <li className="vl-box">
      <h4 className="vl-box-title">{box.title}</h4>
      <p>{box.text}</p>
      <p className="vl-box-links">
        <a href={box.checked.href}>{box.checked.label}</a>
        {lesson ? <Link to={lesson.href}>{lesson.label}</Link> : null}
      </p>
    </li>
  );
}

/** Section 1: the method in one picture, as plain HTML boxes and arrows. */
export function Method() {
  return (
    <div className="vl-method" role="group" aria-label="How TrueSouth turns NASA data into scores">
      {COLUMNS.map((column, index) => (
        <Fragment key={column.heading}>
          {index > 0 ? (
            <div className="vl-arrow" aria-hidden="true">
              <ArrowRight className="vl-arrow-wide" size={20} strokeWidth={1.6} />
              <ArrowDown className="vl-arrow-narrow" size={20} strokeWidth={1.6} />
            </div>
          ) : null}
          <div className="vl-method-col">
            <h3 className="vl-method-heading">{column.heading}</h3>
            <ul>
              {column.boxes.map((box) => (
                <MethodBox key={box.title} box={box} />
              ))}
            </ul>
          </div>
        </Fragment>
      ))}
    </div>
  );
}
