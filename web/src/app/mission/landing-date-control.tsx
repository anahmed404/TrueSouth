import { ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useId, useState, type ReactNode } from "react";
import { Button, IconButton } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { formatUtc } from "../../components/format";
import { Popover } from "../../components/Popover";
import { Tip } from "../../components/Tip";
import type { MissionProfile } from "../../contracts/generated";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { lastLandingHour } from "../../state/scenario";
import { joinUtc, splitUtc, utcDay } from "./landing";
import { endReasons, windowEnd } from "./landing-control";
import { NextGoButton } from "./next-go-button";
import { formatLimit, settingsProvenance } from "./rules";
import { useScenario, useScenarioStore } from "./scenario-context";
import { SettingsTag } from "./settings-tag";

/**
 * The landing date: the moment the mission window starts. One self-contained control that
 * reads and writes only the scenario store, so any panel can mount it: the bottom strip at
 * the left of the timeline, and the Slip Planner's landing-date panel.
 *
 * One row: "Landing date", the day buttons around the date (a button that opens the picker,
 * which also holds "Slip +7 d" and "+14 d"), the window's end and length with its tag, and
 * "Next GO".
 *
 * It reads the landing date, the profile and the focused site, never the current time, so a
 * scrub does not re-render it. Changing the landing date keeps the current time at the same
 * offset from the landing, clamped to the timeline (`moveLandingKeepingOffset` in
 * `state/scenario.ts`).
 */
export const LandingDateControl = memo(function LandingDateControl() {
  const store = useScenarioStore();
  const landingUtc = useScenario((s) => s.landingUtc);
  const profile = useScenario((s) => s.profile);
  const durationDays = profile.duration_days;
  const grid = useScenario((s) => s.catalog.grid);

  let hour = 0;
  try {
    hour = utcToHourIndex(grid, landingUtc);
  } catch {
    hour = 0;
  }
  const last = lastLandingHour(grid, durationDays);
  const slip = (days: number) => store.getState().slipLanding(days);
  const reasons = endReasons(grid, durationDays, last);
  const atFirst = hour === 0;
  const atLast = hour >= last;

  return (
    <div className="ldc" role="group" aria-label="Landing date">
      <span className="ldc-label">
        <Explain term="landing_date">Landing date</Explain>
      </span>
      <span className="ldc-date">
        <EndIconButton label="One day earlier" icon={<ChevronLeft size={16} strokeWidth={1.8} />} onClick={() => slip(-1)} reason={atFirst ? reasons.first : null} />
        <Popover
          label="Landing date"
          width={320}
          placement="above"
          trigger={(props) => (
            <button {...props} type="button" className="ldc-value" aria-label={`Landing date ${formatUtc(landingUtc)}. Change`}>
              <span className="tabular">
                {formatUtc(landingUtc, { withZone: false })} <small>UTC</small>
              </span>
            </button>
          )}
        >
          <LandingDateForm
            landingUtc={landingUtc}
            firstUtc={hourIndexToUtc(grid, 0)}
            lastUtc={hourIndexToUtc(grid, last)}
            durationDays={durationDays}
            lastReason={atLast ? reasons.last : null}
          />
        </Popover>
        <EndIconButton label="One day later" icon={<ChevronRight size={16} strokeWidth={1.8} />} onClick={() => slip(1)} reason={atLast ? reasons.last : null} />
      </span>
      <WindowEnd landingUtc={landingUtc} profile={profile} />
      <NextGoButton />
    </div>
  );
});

/**
 * Where the mission window ends and how long it is, with the duration's sourced or assumed
 * tag: "→ 11 Mar · 10 d [sourced]". The landing date before it is the window's start. The
 * end's time is shown only when it differs from the landing's (a duration that is not whole
 * days), and a narrow strip drops it; screen readers always hear the whole sentence.
 */
function WindowEnd({ landingUtc, profile }: { landingUtc: string; profile: MissionProfile }) {
  const end = windowEnd(landingUtc, profile.duration_days);
  if (!end) return null;
  const duration = formatLimit(profile.duration_days, "d");
  return (
    <span className="ldc-window">
      <span className="sr-only">
        Mission window ends {end.long}, {duration} after landing.
      </span>
      <span className="ldc-window-end tabular" aria-hidden="true">
        → {end.day}
        {end.time === landingUtc.slice(11, 16) ? null : <span className="ldc-window-time"> {end.time} UTC</span>}
      </span>
      <span className="ldc-window-length">
        <span className="tabular" aria-hidden="true">
          <span className="ldc-window-sep">·</span> {duration}
        </span>
        <SettingsTag settings={settingsProvenance(profile, ["duration_days"])} />
      </span>
    </span>
  );
}

/**
 * A day button that stays focusable at the end of the time grid but does nothing, and says
 * why on hover, on focus and to screen readers (the Academy's `aria-disabled` pattern).
 */
function EndIconButton({ label, icon, onClick, reason }: { label: string; icon: ReactNode; onClick: () => void; reason: string | null }) {
  const reasonId = useId();
  return (
    <>
      <IconButton
        label={label}
        hint={reason ? `· ${reason}` : undefined}
        icon={icon}
        aria-disabled={reason ? true : undefined}
        aria-describedby={reason ? reasonId : undefined}
        onClick={() => {
          if (!reason) onClick();
        }}
      />
      {reason ? (
        <span id={reasonId} hidden>
          {reason}
        </span>
      ) : null}
    </>
  );
}

export function SlipButtons({ reason }: { reason: string | null }) {
  const store = useScenarioStore();
  const slip = (days: number) => {
    if (!reason) store.getState().slipLanding(days);
  };
  const button = (days: number, children: ReactNode) => (
    <Tip content={reason ?? ""} describe={reason !== null}>
      {(trigger) => (
        <Button
          {...trigger}
          className="ldc-slip"
          onClick={() => slip(days)}
          aria-disabled={reason ? true : undefined}
          aria-label={`Slip the landing ${days} days later`}
        >
          {children}
        </Button>
      )}
    </Tip>
  );
  return (
    <span className="ldc-slips" data-blocked={reason ? "true" : undefined}>
      {button(
        7,
        <>
          <span className="ldc-slip-word">Slip</span> +7 d
        </>,
      )}
      {button(14, "+14 d")}
    </span>
  );
}

type LandingDateFormProps = {
  landingUtc: string;
  firstUtc: string;
  lastUtc: string;
  durationDays: number;
  /** Why the landing cannot move later, at the last landing that fits; null otherwise. */
  lastReason: string | null;
};

/** The scenario's landing date: the shared fields, writing to the store, with the slip buttons. */
function LandingDateForm({ landingUtc, firstUtc, lastUtc, durationDays, lastReason }: LandingDateFormProps) {
  const store = useScenarioStore();
  return (
    <LandingDateFields
      landingUtc={landingUtc}
      firstUtc={firstUtc}
      lastUtc={lastUtc}
      durationDays={durationDays}
      onPick={(utc) => store.getState().setLandingDate(utc)}
    >
      <div className="date-form-row">
        <span className="date-form-label">Slip</span>
        <SlipButtons reason={lastReason} />
      </div>
    </LandingDateFields>
  );
}

export type LandingDateFieldsProps = {
  landingUtc: string;
  /** The grid's first hour and the last landing whose mission window fits the data. */
  firstUtc: string;
  lastUtc: string;
  durationDays: number;
  /**
   * The picked date and hour, as typed; the caller clamps it to the limits (the store's
   * `setLandingDate` does, and `clampLanding` in landing-control.ts gives the same answer).
   */
  onPick: (utc: string) => void;
  /** Rows after the hour, before the window's end (the strip's form puts "Slip" there). */
  children?: ReactNode;
};

/**
 * A date and an hour, in UTC, limited to the dates whose mission window fits the grid, with
 * the window's end, the limits and a note when a date is moved to a limit. The landing-date
 * control's form and Compare's "Sites and dates" pickers share it.
 */
export function LandingDateFields({ landingUtc, firstUtc, lastUtc, durationDays, onPick, children }: LandingDateFieldsProps) {
  const dateId = useId();
  const hourId = useId();
  const parts = splitUtc(landingUtc) ?? { date: "", hour: 0 };
  const end = windowEnd(landingUtc, durationDays);
  const [note, setNote] = useState<string | null>(null);

  const pick = (date: string, hour: number) => {
    const utc = joinUtc(date, hour);
    if (!utc) return;
    const tooLate = Date.parse(utc) > Date.parse(lastUtc);
    const tooEarly = Date.parse(utc) < Date.parse(firstUtc);
    onPick(utc);
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
      {children}
      {end ? (
        <p className="date-form-window">
          The {formatLimit(durationDays, "d")} mission window ends {end.long}.
        </p>
      ) : null}
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
