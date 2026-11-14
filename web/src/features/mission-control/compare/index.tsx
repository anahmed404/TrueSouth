import { ArrowUpRight, Download } from "lucide-react";
import { memo, useCallback, useContext, useId, useLayoutEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import type { MissionProfile, Site } from "../../../contracts/generated";
import type { PanelProps } from "../../../app/panel";
import { Button } from "../../../components/Button";
import { Explain } from "../../../components/Explain";
import { cx, formatNumber, formatUtc } from "../../../components/format";
import { Tip } from "../../../components/Tip";
import { StatusBadge, StatusLamp } from "../../../components/StatusLamp";
import { useSites } from "../../../data/hooks";
import { saveTextFile } from "../../../lib/export";
import { scoreTitle } from "../../../app/mission/rules";
import { WindowHeaderSlot } from "../../../app/mission/floating-window";
import { useScenarioStore } from "../../../app/mission/scenario-context";
import { SettingsTag } from "../../../app/mission/settings-tag";
import { NO_RESULT_TEXT, useSiteStatus, type SiteStatus } from "../../../app/mission/site-status";
import { coordinatesText, moonTrekLink, quickmapLink } from "../share/nasa-links";
import { currentScenarioLink } from "../share/share-link";
import { compareCsv, compareFileName, scenarioFileName, scenarioJson, type ExportScenario } from "./export";
import {
  compareColumn,
  metricRows,
  slopeSources,
  statusCells,
  summarySentence,
  NOT_RANKED_NOTE,
  TOO_FEW_SITES,
  type Cell,
  type ColumnView,
  type MetricRow,
  type StatusCell,
} from "./model";
import { CHOSEN_TAG, CHOSEN_TIP, isVariant } from "../../../app/mission/site-labels";
import "./compare.css";

/** How many times the table has rendered. For the test that a scrub does not re-render it. */
export const compareRenders = { count: 0 };

/**
 * The Compare window (docs/features/compare.md): the selected sites side by side for the
 * landing date and the mission profile. Nothing in it depends on the current time, so it
 * reads only the profile, the sites, the landing date and the focused site: a scrub does
 * not re-render it.
 */
export default function Compare({ scenario }: PanelProps) {
  return (
    <CompareBody
      profile={scenario.profile}
      siteIds={scenario.siteIds}
      landingUtc={scenario.landingUtc}
      focusedSiteId={scenario.focusedSiteId}
    />
  );
}

type BodyProps = {
  profile: MissionProfile;
  siteIds: readonly string[];
  landingUtc: string;
  focusedSiteId: string | null;
};

type Reported = { status: SiteStatus; profile: MissionProfile; landingUtc: string };

const LOADING: SiteStatus = { kind: "loading" };

function sameStatus(a: SiteStatus, b: SiteStatus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "ready" && b.kind === "ready") return a.evaluation === b.evaluation;
  if (a.kind === "error" && b.kind === "error") return a.message === b.message;
  return true;
}

/**
 * One site's status, through the focused-site panel's own hook. It draws nothing; it
 * reports the status to the table, which lays the sites out row by row.
 */
function StatusProbe({
  siteId,
  profile,
  landingUtc,
  onStatus,
}: {
  siteId: string;
  profile: MissionProfile;
  landingUtc: string;
  onStatus: (siteId: string, reported: Reported) => void;
}) {
  const status = useSiteStatus(siteId, profile, landingUtc);
  const evaluation = status.kind === "ready" ? status.evaluation : null;
  const message = status.kind === "error" ? status.message : null;
  // Before paint, so the table never shows one frame of the old profile's numbers.
  useLayoutEffect(() => {
    onStatus(siteId, { status, profile, landingUtc });
    // `status` is rebuilt each render; what it holds is in the other dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStatus, siteId, profile, landingUtc, status.kind, evaluation, message]);
  return null;
}

const CompareBody = memo(function CompareBody({ profile, siteIds, landingUtc, focusedSiteId }: BodyProps) {
  const store = useScenarioStore();
  const sitesResult = useSites();
  const sites: readonly Site[] = sitesResult.status === "ready" ? sitesResult.data : [];
  const [reports, setReports] = useState<Readonly<Record<string, Reported>>>({});

  const onStatus = useCallback((siteId: string, reported: Reported) => {
    setReports((current) => {
      const before = current[siteId];
      if (before && before.profile === reported.profile && before.landingUtc === reported.landingUtc && sameStatus(before.status, reported.status)) {
        return current;
      }
      return { ...current, [siteId]: reported };
    });
  }, []);

  const columns = useMemo(
    () =>
      siteIds.map((siteId) => {
        const report = reports[siteId];
        // A status computed for another profile or date is not shown.
        const status = report && report.profile === profile && report.landingUtc === landingUtc ? report.status : LOADING;
        return compareColumn(siteId, sites, status, profile);
      }),
    [siteIds, reports, sites, profile, landingUtc],
  );
  const rows = useMemo(() => metricRows(columns, profile), [columns, profile]);
  const statuses = useMemo(() => statusCells(columns), [columns]);
  const summary = summarySentence(columns, profile, landingUtc);
  const focusSite = useCallback((siteId: string) => store.getState().focusSite(siteId), [store]);

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
    const scenario = exportScenario();
    saveTextFile(compareFileName(scenario), compareCsv(columns, rows, scenario, new Date()), "text/csv;charset=utf-8");
  };
  const saveJson = () => {
    const scenario = exportScenario();
    saveTextFile(scenarioFileName(scenario), scenarioJson(columns, scenario, new Date()), "application/json");
  };

  // The window's header holds the landing date and the exports, beside the title; the
  // summary sentence is the table's accessible description (docs/features/compare.md).
  const headerSlot = useContext(WindowHeaderSlot);
  const head = (
    <>
      <p className="cmp-date">
        <span className="sr-only">Landing </span>
        <time className="tabular" dateTime={landingUtc}>
          {formatUtc(landingUtc)}
        </time>
      </p>
      {columns.length > 0 ? (
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

  return (
    <div className="cmp">
      {siteIds.map((siteId) => (
        <StatusProbe key={siteId} siteId={siteId} profile={profile} landingUtc={landingUtc} onStatus={onStatus} />
      ))}
      {headerSlot ? createPortal(head, headerSlot) : <div className="cmp-bar">{head}</div>}
      {columns.length === 0 ? <p className="cmp-empty">{summary}</p> : null}
      {columns.length > 0 ? (
        <CompareTable
          summary={summary}
          columns={columns}
          rows={rows}
          statuses={statuses}
          profile={profile}
          landingUtc={landingUtc}
          focusedSiteId={focusedSiteId}
          onFocusSite={focusSite}
        />
      ) : null}
    </div>
  );
});

type TableProps = {
  /** The one-line answer, read to assistive technology as the table's description. */
  summary?: string;
  columns: readonly ColumnView[];
  rows: readonly MetricRow[];
  statuses: readonly (StatusCell | null)[];
  profile: MissionProfile;
  landingUtc: string;
  focusedSiteId: string | null;
  onFocusSite: (siteId: string) => void;
};

/** The table itself. Exported for tests, which draw it with known columns. */
export const CompareTable = memo(function CompareTable({ summary, columns, rows, statuses, profile, landingUtc, focusedSiteId, onFocusSite }: TableProps) {
  compareRenders.count += 1;
  const sources = slopeSources(columns);
  const summaryId = useId();
  return (
    <>
      {summary ? (
        <p id={summaryId} className="sr-only" aria-live="polite">
          {summary}
        </p>
      ) : null}
      <div className="cmp-scroll" role="region" aria-label="Comparison table" tabIndex={0}>
        <table className="cmp-table" data-columns={columns.length} aria-describedby={summary ? summaryId : undefined}>
          <caption className="sr-only">
            Selected sites compared for {profile.name}, landing {formatUtc(landingUtc)}. One column per site; the best value in a row
            is marked “best”.
          </caption>
          <thead>
            <tr>
              <td className="cmp-corner" />
              {columns.map((column) => (
                <SiteHeader key={column.siteId} column={column} focused={column.siteId === focusedSiteId} onFocusSite={onFocusSite} />
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="cmp-row-status">
              <th scope="row">
                <Explain term="status">Status</Explain>
                <span className="cmp-limit">and the score, of 100</span>
              </th>
              {columns.map((column, index) => (
                <td key={column.siteId}>
                  <StatusContent column={column} cell={statuses[index] ?? null} />
                </td>
              ))}
            </tr>
            <tr>
              <th scope="row">
                <Explain term="veto">Broken rule</Explain>
              </th>
              {columns.map((column) => (
                <td key={column.siteId}>
                  <BrokenContent column={column} />
                </td>
              ))}
            </tr>
            {rows.map((row) => (
              <MetricRowView key={row.id} row={row} columns={columns} />
            ))}
            <tr className="cmp-row-links">
              <th scope="row">Open in NASA’s maps</th>
              {columns.map((column) => (
                <td key={column.siteId}>
                  <NasaLinks site={column.site} />
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <p className="cmp-foot">
        {columns.length === 1 ? `${TOO_FEW_SITES} ` : null}
        A tie for best marks every tied site.
        {columns.some((column) => isVariant(column.site)) ? ` ${NOT_RANKED_NOTE}` : null}
        {sources.length > 0 ? ` Slope from ${sources.join("; ")}.` : null}
      </p>
    </>
  );
});

function SiteHeader({ column, focused, onFocusSite }: { column: ColumnView; focused: boolean; onFocusSite: (siteId: string) => void }) {
  const site = column.site;
  return (
    <th scope="col" className={cx("cmp-site", focused && "cmp-site-focused")}>
      <button
        type="button"
        className="cmp-site-name"
        aria-current={focused ? "true" : undefined}
        title={column.name}
        onClick={() => onFocusSite(column.siteId)}
      >
        {column.name}
      </button>
      {site ? (
        <span className="cmp-meta tabular" title={column.coords ?? undefined}>
          <span aria-hidden="true">
            <span className="whitespace-nowrap">{formatNumber(site.lat_deg, 2)}°,</span>{" "}
            <span className="whitespace-nowrap">{formatNumber(site.lon_deg, 2)}° E</span>
          </span>
          <span className="sr-only">{column.coords}</span>
        </span>
      ) : null}
      {column.tier || column.notes.length > 0 ? (
        <span className="cmp-meta">
          {column.tier}
          {column.tier && column.notes.length > 0 ? " " : null}
          {column.notes.map((note) => (
            <NoteTag key={note} label="map centre" text={note} />
          ))}
        </span>
      ) : null}
      {column.chosenBy ? (
        <span className="cmp-meta">
          <NoteTag label={CHOSEN_TAG} text={CHOSEN_TIP} dotted />
          <span className="cmp-meta-line" title={column.chosenBy}>
            {column.chosenBy}
          </span>
        </span>
      ) : null}
    </th>
  );
}

/** A quiet tag whose tip, and screen-reader text, is the whole note. */
function NoteTag({ label, text, dotted = false }: { label: string; text: string; dotted?: boolean }) {
  return (
    <Tip content={text}>
      {(trigger) => (
        <button {...trigger} type="button" className={cx("tag cmp-tag", dotted && "tag-chosen")}>
          {label}
          <span className="sr-only">: {text}</span>
        </button>
      )}
    </Tip>
  );
}

function NotReady({ column }: { column: ColumnView }) {
  if (column.status.kind === "loading") return <span className="skeleton skeleton-line cmp-skeleton" aria-label="Loading" />;
  return (
    <span className="cmp-none" aria-label="No value">
      —
    </span>
  );
}

function StatusContent({ column, cell }: { column: ColumnView; cell: StatusCell | null }) {
  if (column.status.kind === "error") {
    return (
      <span className="cmp-quiet" title={column.status.message}>
        Could not load this site’s data
      </span>
    );
  }
  if (column.status.kind === "none") return <span className="cmp-quiet">{NO_RESULT_TEXT}</span>;
  if (!cell) return <NotReady column={column} />;
  return (
    <span className="cmp-status">
      <StatusBadge status={cell.status} />
      <span className={cx("cmp-score tabular", cell.best && "cmp-best")} title={scoreTitle(cell.score)}>
        {cell.used ? cell.scoreText : <s>{cell.scoreText}</s>}
        {cell.used ? null : <span className="cmp-sub"> not used</span>}
        {cell.best ? <BestMark /> : null}
      </span>
    </span>
  );
}

function BrokenContent({ column }: { column: ColumnView }) {
  if (!column.rules) return <NotReady column={column} />;
  if (column.rules.broken.length === 0) return <span className="cmp-quiet">None</span>;
  return (
    <ul className="cmp-broken">
      {column.rules.broken.map((rule) => (
        <li key={rule.id}>
          <span className="cmp-broken-name">
            <StatusLamp status="NO-GO" size="xs" />
            {rule.name}
          </span>
          {rule.value !== null ? (
            <span className="cmp-sub tabular">
              <b>{rule.valueLabel}</b>, {rule.limitText}
            </span>
          ) : (
            <span className="cmp-sub">{rule.limitText}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function BestMark() {
  return <span className="cmp-best-mark">best</span>;
}

function MetricRowView({ row, columns }: { row: MetricRow; columns: readonly ColumnView[] }) {
  return (
    <tr className={cx(row.deciding && "cmp-deciding")}>
      <th scope="row">
        <Explain term={row.term}>{row.name}</Explain>
        <span className="cmp-limit">
          {row.limitText} <SettingsTag settings={row.provenance} />
        </span>
        {row.deciding ? <span className="cmp-decides">Decides between them</span> : null}
      </th>
      {columns.map((column, index) => {
        const cell = row.cells[index] ?? null;
        return <td key={column.siteId}>{cell ? <CellContent cell={cell} kind={row.id} /> : <NotReady column={column} />}</td>;
      })}
    </tr>
  );
}

function CellContent({ cell, kind }: { cell: Cell; kind: MetricRow["id"] }) {
  return (
    <span className="cmp-cell">
      <span className={cx("cmp-value tabular", cell.best && "cmp-best", cell.broken && "cmp-broken-value", cell.value === null && "cmp-quiet")}>
        {cell.broken ? <StatusLamp status="NO-GO" size="xs" /> : null}
        {cell.text}
        {cell.broken ? <span className="sr-only"> (breaks a rule)</span> : null}
        {cell.best ? <BestMark /> : null}
      </span>
      {cell.sub ? <span className="cmp-sub">{cell.sub}</span> : null}
      {cell.bar !== null ? (
        <span className={cx("cmp-bar-track", kind === "link" ? "cmp-bar-earth" : "cmp-bar-sun")} aria-hidden="true">
          <i style={{ width: `${Math.min(Math.max(cell.bar, 0), 1) * 100}%` }} />
        </span>
      ) : null}
      {cell.notes.map((note) => (
        <span key={note} className="cmp-note">
          {note}
        </span>
      ))}
    </span>
  );
}

function NasaLinks({ site }: { site: Site | null }) {
  if (!site) return <span className="cmp-none">—</span>;
  const links = [quickmapLink(site.lat_deg, site.lon_deg), moonTrekLink(site.lat_deg, site.lon_deg)];
  const anyUncentred = links.some((link) => !link.centred);
  return (
    <span className="cmp-links">
      {links.map((link) => (
        <a key={link.tool} href={link.href} target="_blank" rel="noopener noreferrer">
          {link.tool}
          <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
          <span className="sr-only">{link.centred ? ", opens at this site in a new tab" : ", opens the front page in a new tab"}</span>
        </a>
      ))}
      {anyUncentred ? <span className="cmp-sub tabular">Go to {coordinatesText(site.lat_deg, site.lon_deg)}</span> : null}
    </span>
  );
}
