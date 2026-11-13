import { ArrowDown, ArrowRight } from "lucide-react";
import { Fragment } from "react";
import { Link } from "react-router";
import { sampleLesson } from "../academy/lessons/sample";

/**
 * A lesson link is drawn only for a lesson the app can play. Today the Academy routes a
 * lesson to its screen only when it is the playable one (web/src/features/academy/index.tsx);
 * lessons 1 to 8 still open "This lesson is not written yet", so no box links yet.
 */
export function isPlayableLesson(lessonId: string): boolean {
  return lessonId === sampleLesson.id;
}

type Box = {
  title: string;
  text: string;
  /** The Academy lesson that teaches this step. Linked only once it is playable. */
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
  const playable = box.lesson !== undefined && isPlayableLesson(box.lesson);
  return (
    <li className="vl-box">
      <h4 className="vl-box-title">{box.title}</h4>
      <p>{box.text}</p>
      <p className="vl-box-links">
        <a href={box.checked.href}>{box.checked.label}</a>
        {playable && box.lesson ? <Link to={`/academy/${box.lesson}`}>Learn it in the Academy</Link> : null}
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
