import { ArrowRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import { BrandMark } from "../components/BrandMark";
import { buttonClass } from "../components/Button";
import { AcademyPorthole, MissionPorthole, illustrativeSkyline } from "./start/portholes";

/**
 * The start screen: two equal doors, Mission Control and Academy. Neither is the main
 * one. Works from a phone (390 px) up.
 */
export function StartScreen() {
  return (
    <div className="start">
      <header className="start-top">
        <BrandMark />
        <nav aria-label="About TrueSouth">
          <Link to="/validation">How we know it's right</Link>
        </nav>
      </header>

      <main>
        <div className="start-hero">
          <h1>Where and when can this mission land?</h1>
          <p>A lunar south pole landing site navigator. Two ways in, the same real NASA data underneath.</p>
        </div>

        <div className="doors">
          <Door
            to="/mission"
            title="Mission Control"
            text="Pick a mission profile and sites, find every date that works, and inspect any site hour by hour."
            meta="For mission planners · 5 real-mission presets"
            action="Open Mission Control"
            picture={<MissionPorthole />}
          />
          <Door
            to="/academy"
            title="Academy"
            text="Help Luna land Pip at the south pole, and rebuild the tool's logic one short lesson at a time."
            meta="For students and the curious · 8 lessons · 10–15 minutes"
            action="Start the Academy"
            picture={<AcademyPorthole />}
          />
        </div>
      </main>

      <Ground />

      <footer className="start-foot">
        <span>Sun and Earth from JPL Horizons · terrain from LOLA via NASA PGDA</span>
        <span>Planning aid, not flight certification · NASA Space Apps 2026</span>
      </footer>
    </div>
  );
}

type DoorProps = {
  to: string;
  title: string;
  text: string;
  meta: string;
  action: string;
  picture: ReactNode;
};

/** A whole door is one link, so the picture, the title and the pill all open it. */
function Door({ to, title, text, meta, action, picture }: DoorProps) {
  return (
    <Link to={to} className="door" aria-label={`${action}: ${text}`}>
      {picture}
      <h2>{title}</h2>
      <p className="door-text">{text}</p>
      <p className="door-meta">{meta}</p>
      <span className={buttonClass("door")} aria-hidden="true">
        {action}
        <ArrowRight size={16} strokeWidth={1.8} />
      </span>
    </Link>
  );
}

/** The polar skyline along the bottom of the page, kept low under the footer. */
function Ground() {
  const d = useMemo(() => {
    let path = "";
    for (let i = 0; i <= 360; i++) {
      const y = 58 - illustrativeSkyline(i + 100) * 14;
      path += `${i ? "L" : "M"}${i * 4},${y.toFixed(1)}`;
    }
    return path;
  }, []);
  return (
    <svg className="start-ground" viewBox="0 0 1440 120" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path className="ground-fill" d={`${d}L1440,120L0,120Z`} />
      <path className="ground-rim" d={d} />
    </svg>
  );
}
