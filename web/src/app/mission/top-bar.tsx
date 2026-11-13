import { Check, ChevronDown, ChevronLeft, ChevronRight, Share2 } from "lucide-react";
import { memo, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router";
import { BrandMark } from "../../components/BrandMark";
import { Button, IconButton } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { formatUtc } from "../../components/format";
import { Popover } from "../../components/Popover";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { lastLandingHour } from "../../state/scenario";
import { joinUtc, splitUtc, utcDay } from "./landing";
import { profileTitle } from "./profile-fields";
import { ProfileEditor } from "./profile-editor";
import { formatLimit } from "./rules";
import { useScenario, useScenarioStore } from "./scenario-context";

/**
 * The Mission Control top bar: brand, mode switch, the profile picker, the landing-date
 * picker and Share. It reads only the profile and the landing date from the scenario, so
 * moving the current time does not re-render it.
 */
export const TopBar = memo(function TopBar() {
  return (
    <header className="shell-top">
      <BrandMark />
      <ModeSwitch current="mission" />
      <div className="shell-top-spacer" />
      <ProfilePicker />
      <LandingDatePicker />
      <ShareButton />
    </header>
  );
});

/** Mission Control or Academy. A navigation, so each mode is a link. */
export function ModeSwitch({ current }: { current: "mission" | "academy" }) {
  return (
    <nav aria-label="Mode" className="seg seg-accent">
      <Link to="/mission" className="seg-option" aria-current={current === "mission" ? "page" : undefined}>
        Mission Control
      </Link>
      <Link to="/academy" className="seg-option" aria-current={current === "academy" ? "page" : undefined}>
        Academy
      </Link>
    </nav>
  );
}

function ProfilePicker() {
  const profile = useScenario((s) => s.profile);
  const changedCount = useScenario((s) => s.changedFields.length);
  const baseName = useScenario((s) => s.catalog.profiles.find((p) => p.id === s.basePresetId)?.name ?? s.basePresetId);
  const title = profileTitle(profile, changedCount, baseName);
  const duration = formatLimit(profile.duration_days, "d");

  return (
    <div className="field field-profile">
      <Popover
        label="Mission profile"
        width={440}
        align="end"
        trigger={(props) => (
          <button {...props} type="button" className="field-trigger" aria-label={`Mission profile: ${title}. Change`}>
            <span className="field-label">Mission profile</span>
            <span className="field-value field-value-clip">{title}</span>
            <ChevronDown className="field-icon" size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      >
        {(close) => <ProfileEditor onChosen={close} />}
      </Popover>
      <span className="field-sub tabular" aria-label={`Duration ${duration}`}>
        {duration}
      </span>
      <ProvenanceTag provenance={profile.provenance.duration_days} />
    </div>
  );
}

function LandingDatePicker() {
  const store = useScenarioStore();
  const landingUtc = useScenario((s) => s.landingUtc);
  const durationDays = useScenario((s) => s.profile.duration_days);
  const grid = useScenario((s) => s.catalog.grid);

  const hour = utcToHourIndex(grid, landingUtc);
  const last = lastLandingHour(grid, durationDays);
  const slip = (days: number) => store.getState().slipLanding(days);

  return (
    <div className="field" role="group" aria-label="Landing date">
      <span className="field-label">
        <Explain term="landing_date">Landing date</Explain>
      </span>
      <IconButton label="One day earlier" icon={<ChevronLeft size={16} strokeWidth={1.8} />} onClick={() => slip(-1)} disabled={hour === 0} />
      <Popover
        label="Landing date"
        width={320}
        trigger={(props) => (
          <button {...props} type="button" className="field-date" aria-label={`Landing date ${formatUtc(landingUtc)}. Change`}>
            <span className="field-value tabular">
              {formatUtc(landingUtc, { withZone: false })} <small>UTC</small>
            </span>
          </button>
        )}
      >
        <LandingDateForm landingUtc={landingUtc} firstUtc={hourIndexToUtc(grid, 0)} lastUtc={hourIndexToUtc(grid, last)} durationDays={durationDays} />
      </Popover>
      <IconButton label="One day later" icon={<ChevronRight size={16} strokeWidth={1.8} />} onClick={() => slip(1)} disabled={hour >= last} />
      <span className="field-rule" aria-hidden="true" />
      <Button className="field-slip" onClick={() => slip(7)} disabled={hour >= last} aria-label="Slip the landing 7 days later">
        <span className="field-slip-word">Slip</span> +7 d
      </Button>
      <Button className="field-slip" onClick={() => slip(14)} disabled={hour >= last} aria-label="Slip the landing 14 days later">
        +14 d
      </Button>
    </div>
  );
}

type LandingDateFormProps = {
  landingUtc: string;
  firstUtc: string;
  lastUtc: string;
  durationDays: number;
};

/** A date and an hour, in UTC, limited to the dates whose mission window fits the grid. */
function LandingDateForm({ landingUtc, firstUtc, lastUtc, durationDays }: LandingDateFormProps) {
  const store = useScenarioStore();
  const dateId = useId();
  const hourId = useId();
  const parts = splitUtc(landingUtc) ?? { date: "", hour: 0 };
  const [note, setNote] = useState<string | null>(null);

  const pick = (date: string, hour: number) => {
    const utc = joinUtc(date, hour);
    if (!utc) return;
    const tooLate = Date.parse(utc) > Date.parse(lastUtc);
    const tooEarly = Date.parse(utc) < Date.parse(firstUtc);
    store.getState().setLandingDate(utc);
    if (tooLate) setNote(`Moved to the latest landing date that leaves room for the ${formatLimit(durationDays, "d")} mission window.`);
    else if (tooEarly) setNote("Moved to the first hour of the time grid.");
    else setNote(null);
  };

  return (
    <div className="date-form">
      <div className="date-form-row">
        <label htmlFor={dateId} className="date-form-label">
          Date
        </label>
        <input
          id={dateId}
          type="date"
          className="pe-input date-input tabular"
          value={parts.date}
          min={utcDay(firstUtc)}
          max={utcDay(lastUtc)}
          onChange={(event) => pick(event.target.value, parts.hour)}
        />
      </div>
      <div className="date-form-row">
        <label htmlFor={hourId} className="date-form-label">
          Hour
        </label>
        <select id={hourId} className="pe-input date-input tabular" value={parts.hour} onChange={(event) => pick(parts.date, Number(event.target.value))}>
          {Array.from({ length: 24 }, (_, h) => (
            <option key={h} value={h}>
              {String(h).padStart(2, "0")}:00
            </option>
          ))}
        </select>
        <span className="date-form-zone">UTC</span>
      </div>
      <p className="date-form-hint">
        From {formatUtc(firstUtc)} to {formatUtc(lastUtc)}, the last landing whose {formatLimit(durationDays, "d")} window ends
        inside the data.
      </p>
      {note ? (
        <p className="date-form-note" role="status">
          {note}
        </p>
      ) : null}
    </div>
  );
}

/** Copies the address, which is always the current scenario. */
function ShareButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 2400);
  };

  return (
    <span className="share">
      <Button
        size="md"
        className="share-button"
        icon={state === "copied" ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Share2 size={16} strokeWidth={1.8} aria-hidden="true" />}
        onClick={copy}
        aria-label="Share: copy a link to this scenario"
      >
        {state === "copied" ? "Copied" : "Share"}
      </Button>
      <span className="sr-only" role="status">
        {state === "copied" ? "Link copied." : state === "failed" ? "Could not copy. The link is in the address bar." : ""}
      </span>
      {state === "failed" ? <span className="share-failed">Copy the address bar</span> : null}
    </span>
  );
}
