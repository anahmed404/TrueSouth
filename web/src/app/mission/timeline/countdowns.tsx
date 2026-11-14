import type { ReactNode } from "react";
import type { MissionProfile, TimeGrid } from "../../../contracts/generated";
import { BodyIcon } from "../../../components/BodyIcon";
import { Explain } from "../../../components/Explain";
import { cx, formatNumber } from "../../../components/format";
import { Card } from "../../../components/Panel";
import { StatusLamp } from "../../../components/StatusLamp";
import { useManifest, useSeries } from "../../../data/hooks";
import type { DecodedSeries } from "../../../data/decode/layouts";
import { useCountdowns, useHourFlags, windowLength, type HourFlags } from "../../../lib/scoring";
import { hourIndexToUtc, utcToHourIndex } from "../../../lib/time";
import type { PanelProps } from "../../panel";
import { distinctDecimals, ruleFields, settingsProvenance, valueAndLimit } from "../rules";
import { SettingsTag } from "../settings-tag";
import { runAround } from "./axis";
import { SOON_HOURS, earthCountdown, noneBefore, stretchChipText, sunCountdown, waitParts, type CountdownView } from "./countdown-text";

function siteOf(scenario: PanelProps["scenario"]): string | null {
  return scenario.focusedSiteId ?? scenario.siteIds[0] ?? null;
}

/**
 * The Sun and Earth countdown cards, measured from the current time: the state now, the
 * next change, whether this stretch breaks a limit, and the body's values now.
 */
export function Countdowns({ scenario }: PanelProps) {
  const siteId = siteOf(scenario);
  const manifest = useManifest();
  if (!siteId) return <p className="cd-message">Countdowns appear once a site is selected.</p>;
  if (manifest.status === "error") return <p className="cd-message">The time grid could not load.</p>;
  if (manifest.status !== "ready") return <p className="cd-message">Loading…</p>;
  return <SiteCountdowns siteId={siteId} grid={manifest.data.time_grid} scenario={scenario} />;
}

function SiteCountdowns({ siteId, grid, scenario }: { siteId: string; grid: TimeGrid; scenario: PanelProps["scenario"] }) {
  const profile = scenario.profile;
  const flags = useHourFlags(siteId, profile);
  const series = useSeries(siteId);
  const countdowns = useCountdowns(siteId, profile, scenario.currentUtc);

  if (flags.status === "error" || series.status === "error" || countdowns.status === "error") {
    return (
      <p className="cd-message" role="alert">
        Countdowns need this site's hourly data, which could not load.
      </p>
    );
  }
  if (flags.status !== "ready" || series.status !== "ready" || countdowns.status !== "ready") {
    return (
      <p className="cd-message" role="status">
        Loading the countdowns…
      </p>
    );
  }

  let current: number;
  let landing: number;
  try {
    current = utcToHourIndex(grid, scenario.currentUtc);
    landing = utcToHourIndex(grid, scenario.landingUtc);
  } catch {
    return <p className="cd-message">The current time is outside the time grid.</p>;
  }
  const windowEnd = landing + windowLength(profile.duration_days);
  const gridEnd = hourIndexToUtc(grid, grid.count - 1);
  const lit = flags.data.lit[current] === 1;
  const link = flags.data.link[current] === 1;
  const sun = sunCountdown(countdowns.data, lit, gridEnd);
  const earth = earthCountdown(countdowns.data, link, profile.relay_available, gridEnd);

  return (
    <div className="cd-row">
      <CountdownCard
        view={sun}
        gridEnd={gridEnd}
        stretch={stretchNotes("dark", flags.data, current, landing, windowEnd, profile)}
      >
        <Values body="sun" series={series.data} hour={current} profile={profile} />
      </CountdownCard>
      <CountdownCard
        view={earth}
        gridEnd={gridEnd}
        profile={profile}
        stretch={
          profile.relay_available ? null : stretchNotes("blackout", flags.data, current, landing, windowEnd, profile)
        }
      >
        <Values body="earth" series={series.data} hour={current} profile={profile} />
      </CountdownCard>
    </div>
  );
}

/** "2 h 58 m" as a display number: figures at full size, units at 0.7 em. */
export function CountdownNumber({ hours, gridEnd }: { hours: number | null; gridEnd: string }) {
  if (hours === null) return <span className="cd-none">{noneBefore(gridEnd)}</span>;
  const parts = waitParts(hours);
  if (parts === "now") return <span className="cd-num">now</span>;
  if (parts === "under a minute") return <span className="cd-num cd-num-words">under a minute</span>;
  return (
    <span className="cd-num tabular">
      {parts.map((part, i) => (
        <span key={part.unit}>
          {i > 0 ? " " : ""}
          {part.value}
          <span className="unit">{part.unit}</span>
        </span>
      ))}
    </span>
  );
}

/** "Next sunset", "Next Earthrise": Earthrise and Earthset keep their capital E. */
export function nextEvent(view: Pick<CountdownView, "body" | "eventName">): string {
  return `Next ${view.body === "sun" ? view.eventName.toLowerCase() : view.eventName}`;
}

/**
 * One countdown card. Its rows are the same at every hour, so neither the card nor the
 * bottom strip changes height while the user scrubs or plays: the head, the countdown, the
 * values now, then one notes row of exactly two lines, filled from the bottom. Line one is
 * this stretch's chip ("✕ 130 h · over the 6 h limit"), which always fits one line; line two
 * is the limit's provenance tag and, when the next change is under 6 h, "Under 6 h". Those are
 * the most the row ever holds at once (a stretch and the warning do coexist, at the end of a
 * dark stretch), and both lines are measured to fit the 158 px card, so nothing is clipped.
 */
function CountdownCard({
  view,
  gridEnd,
  profile,
  stretch,
  children,
}: {
  view: CountdownView;
  gridEnd: string;
  profile?: MissionProfile;
  /** The current dark stretch or blackout, while there is one in the mission window. */
  stretch?: StretchNotes | null;
  children: ReactNode;
}) {
  const name = view.body === "sun" ? "Sun" : "Earth";
  return (
    <Card as="section" tone={view.soon ? "caution" : "plain"} className={cx("cd", view.soon && "is-soon")} aria-label={`${name} countdown`}>
      <div className="cd-head">
        <BodyIcon body={view.body} />
        <h3 className="cd-name">{name}</h3>
        <span className="cd-state">
          <Explain term={view.stateTerm === "relay" ? "link" : view.stateTerm}>{view.state}</Explain>
        </span>
      </div>
      {view.event ? (
        <div className="cd-main" aria-live="off">
          <div>
            <p className="cd-event">
              <Explain term={view.event} label={view.eventName}>
                {view.hours !== null && view.hours > 0 ? `${view.eventName} in` : nextEvent(view)}
              </Explain>
            </p>
            <CountdownNumber hours={view.hours} gridEnd={gridEnd} />
          </div>
        </div>
      ) : (
        <div className="cd-main">
          <p className="cd-relay">
            No Earth countdown: a <Explain term="relay">relay</Explain> carries the link{" "}
            {profile ? <SettingsTag settings={settingsProvenance(profile, ruleFields(profile, "relay"))} /> : null}
          </p>
        </div>
      )}
      {children}
      <div className="cd-notes">
        {stretch ? <p className="cd-notes-line">{stretch.chip}</p> : null}
        {stretch || view.soon ? (
          <p className="cd-notes-line">
            {stretch?.tag}
            {view.soon ? (
              <span className="cd-flag">
                <StatusLamp status="CAUTION" size="xs" />
                Under {SOON_HOURS} h
              </span>
            ) : null}
          </p>
        ) : null}
      </div>
    </Card>
  );
}

function Values({ body, series, hour, profile }: { body: "sun" | "earth"; series: DecodedSeries; hour: number; profile: MissionProfile }) {
  const el = (body === "sun" ? series.sun_el[hour] : series.earth_el[hour]) ?? Number.NaN;
  const elDecimals =
    body === "sun" && profile.ops_sun_el_min_deg !== null ? distinctDecimals(el, profile.ops_sun_el_min_deg, 2) : 2;
  if (body === "sun") {
    const frac = series.sun_frac[hour] ?? Number.NaN;
    return (
      <dl className="cd-vals">
        <div>
          <dt>
            <Explain term="elevation">Elevation</Explain>
          </dt>
          <dd className="tabular">{formatNumber(el, elDecimals)}°</dd>
        </div>
        <div>
          <dt>
            <Explain term="disc_fraction">Disc fraction</Explain>
          </dt>
          <dd className="tabular">{formatNumber(frac, distinctDecimals(frac, profile.min_sun_fraction, 2))}</dd>
        </div>
      </dl>
    );
  }
  const clear = series.earth_clear[hour] ?? Number.NaN;
  const clearDecimals = profile.relay_available ? 2 : distinctDecimals(clear, profile.antenna_mask_deg, 2);
  return (
    <dl className="cd-vals">
      <div>
        <dt>
          <Explain term="elevation">Elevation</Explain>
        </dt>
        <dd className="tabular">{formatNumber(el, 2)}°</dd>
      </div>
      <div>
        <dt>
          <Explain term="clearance">Clearance</Explain>
        </dt>
        <dd className="tabular">{formatNumber(clear, clearDecimals)}°</dd>
      </div>
    </dl>
  );
}

/**
 * While dark (or in a blackout) inside the mission window: how long this stretch lasts in
 * the window, against the profile's limit, with the same rounding and the same strict
 * comparison as the veto (docs/science.md §10).
 */
export function stretchNow(
  flags: Uint8Array,
  hour: number,
  landing: number,
  windowEnd: number,
  limit: number,
): { hours: number; broken: boolean; value: string; limit: string } | null {
  if (hour < landing || hour >= windowEnd || flags[hour] === 1) return null;
  const run = runAround(flags, hour, landing, windowEnd);
  const hours = run.to - run.from;
  const printed = valueAndLimit(hours, limit, "h", 0);
  return { hours, broken: hours > limit, value: printed.value, limit: printed.limit };
}

/** A stretch's chip and its limit's provenance tag, for the two lines of the notes row. */
type StretchNotes = { chip: ReactNode; tag: ReactNode };

/**
 * While the current hour is in a dark stretch (Sun) or a blackout (Earth) inside the mission
 * window: the chip, which says in words whether the stretch is over or within the profile's
 * limit ("✕ 130 h · over the 6 h limit"), with the NO-GO lamp when over, and the whole
 * sentence for screen readers; and the limit's sourced or assumed tag. No tooltip: the chip
 * says everything on screen, on touch as well.
 */
function stretchNotes(
  kind: "dark" | "blackout",
  flags: HourFlags,
  hour: number,
  landing: number,
  windowEnd: number,
  profile: MissionProfile,
): StretchNotes | null {
  const limit = kind === "dark" ? profile.max_dark_h : profile.max_blackout_h;
  const now = stretchNow(kind === "dark" ? flags.lit : flags.link, hour, landing, windowEnd, limit);
  if (!now) return null;
  const tag = settingsProvenance(profile, ruleFields(profile, kind === "dark" ? "darkness" : "blackout"));
  const text = stretchChipText(kind, now);
  return {
    chip: (
      <span className={cx("cd-chip", now.broken && "is-broken")}>
        {now.broken ? <StatusLamp status="NO-GO" size="xs" /> : null}
        <span className="tabular" aria-hidden="true">
          {text.short}
        </span>
        <span className="sr-only">{text.sentence}</span>
      </span>
    ),
    tag: <SettingsTag settings={tag} />,
  };
}
