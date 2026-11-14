import { ChevronDown, Download } from "lucide-react";
import { memo, useCallback, useContext, useLayoutEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { MissionProfile, Site, TimeGrid } from "../../../contracts/generated";
import { Button } from "../../../components/Button";
import { cx, formatNumber, formatUtc } from "../../../components/format";
import { Popover } from "../../../components/Popover";
import { useSites } from "../../../data/hooks";
import { evaluationsAtUtcMidnight, dayToHour, nextGoDay, useSweep } from "../../../lib/scoring";
import { hourIndexToUtc } from "../../../lib/time";
import { lastLandingHour } from "../../../state/scenario";
import { WindowHeaderSlot } from "../../../app/mission/floating-window";
import { LandingDateFields } from "../../../app/mission/landing-date-control";
import { clampLanding, searchFromDay } from "../../../app/mission/landing-control";
import { useScenarioStore } from "../../../app/mission/scenario-context";
import { siteName } from "../../../app/mission/site-status";
import { saveTextFile } from "../../../lib/export";
import { currentScenarioLink } from "../share/share-link";
import { bestColumns, columnLabel, datesColumnSpecs, datesSummary, defaultPicks, resolvePicks, type DatesPicks } from "./dates";
import { datesCsv, datesFileName, scenarioJson, type ExportScenario } from "./export";
import { CompareTable } from "./index";
import { ModeSwitch } from "./mode-switch";
import { compareColumn, metricRows, statusCells } from "./model";
import { compareStore, useCompareState } from "./picks-store";
import { LOADING, StatusProbe, mergeReport, type Reported } from "./probe";

type DatesBodyProps = {
  profile: MissionProfile;
  siteIds: readonly string[];
  landingUtc: string;
  focusedSiteId: string | null;
  grid: TimeGrid;
};

/**
 * "Sites and dates" (docs/features/compare.md): two sites at two landing dates, four
 * columns. The picks live in Compare's own store, never in the scenario; only "Use this
 * date" changes the scenario. Like the Sites table, it reads no current time.
 */
export const DatesBody = memo(function DatesBody({ profile, siteIds, landingUtc, focusedSiteId, grid }: DatesBodyProps) {
  const store = useScenarioStore();
  const sitesResult = useSites();
  const sites: readonly Site[] = sitesResult.status === "ready" ? sitesResult.data : [];
  const { picks: stored } = useCompareState();
  const durationDays = profile.duration_days;

  // Date 2's default: site A's next GO day after date 1, as "Next GO" finds it.
  const defaultA = focusedSiteId !== null && siteIds.includes(focusedSiteId) ? focusedSiteId : (siteIds[0] ?? "");
  const nextGo = useNextGo(defaultA, profile, landingUtc, grid);
  const defaults = useMemo(
    () => defaultPicks(siteIds, focusedSiteId, landingUtc, nextGo, grid, durationDays),
    [siteIds, focusedSiteId, landingUtc, nextGo, grid, durationDays],
  );
  const picks = useMemo(
    () => resolvePicks(stored, defaults, siteIds, (utc) => clampLanding(grid, durationDays, utc)),
    [stored, defaults, siteIds, grid, durationDays],
  );

  // The share link carries the picks shown (share-link.ts), and only while they show.
  useLayoutEffect(() => {
    compareStore.set({ shown: picks });
  }, [picks]);
  useLayoutEffect(() => () => compareStore.set({ shown: null }), []);

  const specs = useMemo(() => (picks ? datesColumnSpecs(picks) : []), [picks]);
  const [reports, setReports] = useState<Readonly<Record<string, Reported>>>({});
  const onStatus = useCallback((key: string, reported: Reported) => setReports((current) => mergeReport(current, key, reported)), []);
  // One probe per site and date: with A and B the same site, two columns share each result.
  const probes = useMemo(() => [...new Map(specs.map((spec) => [`${spec.siteId}@${spec.landingUtc}`, spec])).entries()], [specs]);

  const columns = useMemo(
    () =>
      specs.map((spec) => {
        const report = reports[`${spec.siteId}@${spec.landingUtc}`];
        const status = report && report.profile === profile && report.landingUtc === spec.landingUtc ? report.status : LOADING;
        return { ...compareColumn(spec.siteId, sites, status, profile, spec.landingUtc), key: `${spec.site}${spec.date}` };
      }),
    [specs, reports, sites, profile],
  );
  const rows = useMemo(() => metricRows(columns, profile), [columns, profile]);
  const statuses = useMemo(() => statusCells(columns), [columns]);
  const best = useMemo(() => bestColumns(columns), [columns]);
  const summary = datesSummary(columns, profile, best);

  const setPicks = useCallback((change: Partial<DatesPicks>) => {
    if (!picks) return;
    compareStore.set({ picks: { ...picks, ...change } });
  }, [picks]);
  const firstUtc = hourIndexToUtc(grid, 0);
  const lastUtc = hourIndexToUtc(grid, lastLandingHour(grid, durationDays));
  const pickDate = (which: 1 | 2) => (utc: string) => {
    const clamped = clampLanding(grid, durationDays, utc);
    if (clamped) setPicks(which === 1 ? { date1: clamped } : { date2: clamped });
  };

  // "Use this date": the one way the scenario moves. The picks are kept as they are first,
  // so the table does not follow the scenario's new landing date.
  const adoptColumn = useCallback(
    (siteId: string, utc: string) => {
      if (picks) compareStore.set({ picks });
      const state = store.getState();
      state.setLandingDate(utc);
      state.focusSite(siteId);
    },
    [picks, store],
  );

  const exportScenario = useCallback((): ExportScenario => {
    const state = store.getState();
    return {
      profile: state.profile,
      basePresetId: state.basePresetId,
      changedFields: state.changedFields,
      siteIds: state.siteIds,
      focusedSiteId: state.focusedSiteId,
      landingUtc: state.landingUtc,
      currentUtc: state.currentUtc,
      view: state.view,
      grid: state.catalog.grid,
      link: currentScenarioLink(state),
    };
  }, [store]);
  const loading = columns.some((c) => c.status.kind === "loading");
  const saveCsv = () => {
    if (!picks) return;
    const scenario = exportScenario();
    saveTextFile(datesFileName(scenario, picks, "csv"), datesCsv(columns, rows, best, scenario, picks, new Date()), "text/csv;charset=utf-8");
  };
  const saveJson = () => {
    if (!picks) return;
    const scenario = exportScenario();
    saveTextFile(datesFileName(scenario, picks, "json"), scenarioJson(columns, scenario, new Date(), { picks, best }), "application/json");
  };

  const headerSlot = useContext(WindowHeaderSlot);
  const head = (
    <>
      <ModeSwitch />
      {picks ? (
        <div className="cmp-actions">
          <Button icon={<Download size={14} strokeWidth={1.8} aria-hidden="true" />} onClick={saveCsv} disabled={loading}>
            Export CSV
          </Button>
          <Button icon={<Download size={14} strokeWidth={1.8} aria-hidden="true" />} onClick={saveJson} disabled={loading}>
            Export JSON
          </Button>
        </div>
      ) : null}
    </>
  );

  const nameOf = (id: string) => siteName(sites.find((s) => s.id === id), id);
  const siteOf = (id: string) => sites.find((s) => s.id === id) ?? null;
  const scenarioUses = (siteId: string, utc: string) => utc === landingUtc && siteId === focusedSiteId;

  return (
    <div className="cmp">
      {probes.map(([key, spec]) => (
        <StatusProbe key={key} reportKey={key} siteId={spec.siteId} profile={profile} landingUtc={spec.landingUtc} onStatus={onStatus} />
      ))}
      {headerSlot ? createPortal(head, headerSlot) : <div className="cmp-bar">{head}</div>}
      {!picks ? <p className="cmp-empty">No sites are selected. Add sites from the sites rail to compare them.</p> : null}
      {picks ? (
        <CompareTable
          summary={summary}
          columns={columns}
          rows={rows}
          statuses={statuses}
          profile={profile}
          landingUtc={landingUtc}
          focusedSiteId={focusedSiteId}
          onFocusSite={() => undefined}
          statusBest={best}
          tieNote="The best column is GO before CAUTION before NO-GO, then the higher score; a tie marks every tied column."
          caption={
            <>
              Two sites at two landing dates for {profile.name}: {columnLabel(columns[0] ?? { name: "", landingUtc: null })},{" "}
              {columnLabel(columns[1] ?? { name: "", landingUtc: null })}, {columnLabel(columns[2] ?? { name: "", landingUtc: null })} and{" "}
              {columnLabel(columns[3] ?? { name: "", landingUtc: null })}. The best value in a row, and the best column, are marked “best”.
            </>
          }
          head={
            <>
              <tr className="cmp-dates-sites">
                <td className="cmp-corner" />
                {(["A", "B"] as const).map((which) => {
                  const id = which === "A" ? picks.siteA : picks.siteB;
                  return (
                    <th key={which} scope="colgroup" colSpan={2} className="cmp-dates-group">
                      <SitePicker
                        which={which}
                        siteId={id}
                        name={nameOf(id)}
                        options={siteIds.map((option) => ({ id: option, name: nameOf(option) }))}
                        onPick={(siteId) => setPicks(which === "A" ? { siteA: siteId } : { siteB: siteId })}
                      />
                      <SiteMeta site={siteOf(id)} />
                    </th>
                  );
                })}
              </tr>
              <tr className="cmp-dates-dates">
                <td className="cmp-corner cmp-corner-label">Landing date</td>
                {specs.map((spec) => (
                  <th key={`${spec.site}${spec.date}`} scope="col" className="cmp-dates-date">
                    <span className="sr-only">{nameOf(spec.siteId)} · </span>
                    <DatePicker
                      which={spec.date}
                      utc={spec.landingUtc}
                      firstUtc={firstUtc}
                      lastUtc={lastUtc}
                      durationDays={durationDays}
                      onPick={pickDate(spec.date)}
                    />
                  </th>
                ))}
              </tr>
            </>
          }
          lastRow={{
            name: "In Mission Control",
            cell: (column) =>
              column.landingUtc === null ? null : scenarioUses(column.siteId, column.landingUtc) ? (
                <span className="cmp-quiet">The current landing</span>
              ) : (
                <Button
                  size="sm"
                  className="cmp-use"
                  onClick={() => adoptColumn(column.siteId, column.landingUtc as string)}
                  aria-label={`Use this date: land on ${formatUtc(column.landingUtc)} and focus ${column.name}`}
                >
                  Use this date
                </Button>
              ),
          }}
        />
      ) : null}
    </div>
  );
});

/** Site A's next GO day after `fromUtc`, at 00:00 UTC, from the Slip Planner's sweep; null when none or not known yet. */
function useNextGo(siteId: string, profile: MissionProfile, fromUtc: string, grid: TimeGrid): string | null {
  const sweep = useSweep(siteId, profile);
  const data = sweep.data;
  return useMemo(() => {
    if (!data || !siteId) return null;
    try {
      const day = nextGoDay(evaluationsAtUtcMidnight(data, profile), searchFromDay(grid, fromUtc));
      return day === null ? null : hourIndexToUtc(grid, dayToHour(day));
    } catch {
      return null;
    }
  }, [data, siteId, profile, grid, fromUtc]);
}

function SitePicker({
  which,
  siteId,
  name,
  options,
  onPick,
}: {
  which: "A" | "B";
  siteId: string;
  name: string;
  options: readonly { id: string; name: string }[];
  onPick: (siteId: string) => void;
}) {
  return (
    <Popover
      label={`Site ${which}`}
      width={280}
      trigger={(props) => (
        <button {...props} type="button" className="cmp-pick cmp-pick-site" aria-label={`Site ${which}: ${name}. Change`} title={name}>
          <span className="cmp-pick-text">{name}</span>
          <ChevronDown className="cmp-pick-icon" size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    >
      {(close) => (
        <div className="cmp-pick-list" role="group" aria-label={`Site ${which}`}>
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              className={cx("cmp-pick-option", option.id === siteId && "cmp-pick-option-on")}
              aria-pressed={option.id === siteId}
              data-autofocus={option.id === siteId ? "" : undefined}
              onClick={() => {
                onPick(option.id);
                close();
              }}
            >
              {option.name}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function SiteMeta({ site }: { site: Site | null }): ReactNode {
  if (!site) return null;
  return (
    <span className="cmp-meta tabular" title={`${formatNumber(site.lat_deg, 4)}°, ${formatNumber(site.lon_deg, 4)}° E`}>
      {formatNumber(site.lat_deg, 2)}°, {formatNumber(site.lon_deg, 2)}° E
    </span>
  );
}

function DatePicker({
  which,
  utc,
  firstUtc,
  lastUtc,
  durationDays,
  onPick,
}: {
  which: 1 | 2;
  utc: string;
  firstUtc: string;
  lastUtc: string;
  durationDays: number;
  onPick: (utc: string) => void;
}) {
  return (
    <Popover
      label={`Landing date ${which}`}
      width={320}
      trigger={(props) => (
        <button {...props} type="button" className="cmp-pick cmp-pick-date" aria-label={`Date ${which}: ${formatUtc(utc)}. Change`}>
          {/* The day, then the hour under it: the whole date fits a narrow column. */}
          <span className="cmp-pick-when tabular">
            <span>{utc.slice(0, 10)}</span>
            <small>{utc.slice(11, 16)} UTC</small>
          </span>
          <ChevronDown className="cmp-pick-icon" size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      )}
    >
      <LandingDateFields landingUtc={utc} firstUtc={firstUtc} lastUtc={lastUtc} durationDays={durationDays} onPick={onPick} />
    </Popover>
  );
}
