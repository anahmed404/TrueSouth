import { ChevronLeft, ChevronRight } from "lucide-react";
import { memo, useId, useState } from "react";
import { Button, IconButton } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { formatUtc } from "../../components/format";
import { Popover } from "../../components/Popover";
import { hourIndexToUtc, utcToHourIndex } from "../../lib/time";
import { lastLandingHour } from "../../state/scenario";
import { joinUtc, splitUtc, utcDay } from "./landing";
import { formatLimit } from "./rules";
import { useScenario, useScenarioStore } from "./scenario-context";

type LandingDateControlProps = {
  /**
   * "full": the date, the day buttons, the slip buttons and "Next GO" in one row.
   * "compact": the slip buttons move into the date's popover, for the folded strip and the
   * phone, where the row has no room for them.
   */
  density?: "full" | "compact";
};

/**
 * The landing date: the moment the mission window starts. One self-contained control that
 * reads and writes only the scenario store, so any panel can mount it: the bottom strip at
 * the left of the timeline, and the Slip Planner's landing-date panel.
 *
 * It reads the landing date, the profile and the focused site, never the current time, so a
 * scrub does not re-render it. Changing the landing date keeps the current time at the same
 * offset from the landing, clamped to the timeline (`moveLandingKeepingOffset` in
 * `state/scenario.ts`).
 */
export const LandingDateControl = memo(function LandingDateControl({ density = "full" }: LandingDateControlProps) {
  const store = useScenarioStore();
  const landingUtc = useScenario((s) => s.landingUtc);
  const durationDays = useScenario((s) => s.profile.duration_days);
  const grid = useScenario((s) => s.catalog.grid);

  let hour = 0;
  try {
    hour = utcToHourIndex(grid, landingUtc);
  } catch {
    hour = 0;
  }
  const last = lastLandingHour(grid, durationDays);
  const slip = (days: number) => store.getState().slipLanding(days);
  const compact = density === "compact";

  return (
    <div className="ldc" data-density={density} role="group" aria-label="Landing date">
      <span className="ldc-label">
        <Explain term="landing_date">Landing date</Explain>
      </span>
      <span className="ldc-date">
        <IconButton label="One day earlier" icon={<ChevronLeft size={16} strokeWidth={1.8} />} onClick={() => slip(-1)} disabled={hour === 0} />
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
            slips={compact}
            canSlip={hour < last}
          />
        </Popover>
        <IconButton label="One day later" icon={<ChevronRight size={16} strokeWidth={1.8} />} onClick={() => slip(1)} disabled={hour >= last} />
      </span>
      {compact ? null : <SlipButtons disabled={hour >= last} />}
    </div>
  );
});

function SlipButtons({ disabled }: { disabled: boolean }) {
  const store = useScenarioStore();
  const slip = (days: number) => store.getState().slipLanding(days);
  return (
    <span className="ldc-slips">
      <Button className="ldc-slip" onClick={() => slip(7)} disabled={disabled} aria-label="Slip the landing 7 days later">
        <span className="ldc-slip-word">Slip</span> +7 d
      </Button>
      <Button className="ldc-slip" onClick={() => slip(14)} disabled={disabled} aria-label="Slip the landing 14 days later">
        +14 d
      </Button>
    </span>
  );
}

type LandingDateFormProps = {
  landingUtc: string;
  firstUtc: string;
  lastUtc: string;
  durationDays: number;
  /** Show the slip buttons inside the popover, when the row has no room for them. */
  slips: boolean;
  canSlip: boolean;
};

/** A date and an hour, in UTC, limited to the dates whose mission window fits the grid. */
function LandingDateForm({ landingUtc, firstUtc, lastUtc, durationDays, slips, canSlip }: LandingDateFormProps) {
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
      {slips ? (
        <div className="date-form-row">
          <span className="date-form-label">Slip</span>
          <SlipButtons disabled={!canSlip} />
        </div>
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
