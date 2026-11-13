import { Antenna, ArrowRight, Sun, X } from "lucide-react";
import type { MouseEvent } from "react";

/** Antenna with a slash: Pip has no link to Earth. */
function AntennaOff() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
      <path d="M2 12 7 2M7 12l5-10M12 12l5-10M17 12l5-10M4.5 7h15M12 16v6" />
      <path d="M3 3l18 18" />
    </svg>
  );
}

/** Pip's two meters: power (Sun glyph, % and a Sun-cream bar) and the link to Earth. */
export function PipMeters({ power, link }: { power?: number; link?: boolean }) {
  return (
    <div className="ac-pip" role="group" aria-label="Pip's meters">
      <span className="ac-pip-name" aria-hidden="true">
        Pip
      </span>
      {power !== undefined ? (
        <span className="ac-meter" role="img" aria-label={`Pip's power: ${Math.round(power)}%`}>
          <Sun aria-hidden="true" />
          <b aria-hidden="true">{Math.round(power)}%</b>
          <span className="ac-meter-bar" aria-hidden="true">
            <i style={{ width: `${Math.max(0, Math.min(100, power))}%` }} />
          </span>
        </span>
      ) : null}
      {link !== undefined ? (
        <span className={link ? "ac-meter ac-meter--link" : "ac-meter"}>
          {link ? <Antenna aria-hidden="true" /> : <AntennaOff />}
          <b>{link ? "Link" : "Blackout"}</b>
        </span>
      ) : null}
    </div>
  );
}

type LessonTopBarProps = {
  title: string;
  stepIndex: number;
  stepCount: number;
  /** The current step is answered, so its segment is done. */
  answered: boolean;
  pip: { power?: number; link?: boolean } | null;
  onClose: () => void;
  onSkip: (event: MouseEvent<HTMLAnchorElement>) => void;
};

/** Close, progress, "Step n of N", Pip's meters and the skip link. */
export function LessonTopBar({ title, stepIndex, stepCount, answered, pip, onClose, onSkip }: LessonTopBarProps) {
  const doneCount = stepIndex + (answered ? 1 : 0);
  return (
    <header className="ac-lt">
      <div className="ac-lt-a">
        <button type="button" className="ac-icon-btn" aria-label="Leave the lesson" onClick={onClose}>
          <X aria-hidden="true" />
        </button>
        <h1 className="ac-lt-title">{title}</h1>
        <div
          className="ac-prog"
          role="progressbar"
          aria-label="Lesson progress"
          aria-valuemin={0}
          aria-valuemax={stepCount}
          aria-valuenow={doneCount}
          aria-valuetext={`${doneCount} of ${stepCount} steps done`}
        >
          {Array.from({ length: stepCount }, (_, index) => (
            <i key={index} data-done={index < doneCount} data-now={index === stepIndex && !answered} />
          ))}
        </div>
        <span className="ac-stepn">
          Step {stepIndex + 1} of {stepCount}
        </span>
      </div>
      <div className="ac-lt-b">
        {pip ? <PipMeters power={pip.power} link={pip.link} /> : <span />}
        <a className="ac-quiet" href="/mission" onClick={onSkip}>
          Skip to Mission Control
          <ArrowRight aria-hidden="true" />
        </a>
      </div>
    </header>
  );
}
