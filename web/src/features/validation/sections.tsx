import { ArrowUpRight } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import type { Comparison, DataSource, DifferenceOverTime, Gate } from "../../contracts/generated.ts";
import { Disclosure } from "../../components/Disclosure";
import { Explain } from "../../components/Explain";
import { REPO_BLOB_URL } from "../academy/card/links";
import { G2Chart } from "./G2Chart";
import { Scatter } from "./Scatter";
import {
  formatCount,
  formatPercent,
  formatPoints,
  formatSignedDegrees,
  formatValue,
  withUnit,
} from "./format";
import {
  COMPARISON_TITLES,
  comparisonRows,
  defaultG2Site,
  g2Lines,
  g2Peak,
  g2Sites,
  g2YearPeaks,
  gateVerdict,
  isSelfComparison,
  isWebLink,
  scatterPoints,
  sharedMark,
  utcDay,
  type ComparisonRow,
} from "./model";
import { ComparisonResult, GateResult, TableBox } from "./parts";

type Names = ReadonlyMap<string, string>;

const BODY_NAME = { sun: "the Sun", earth: "Earth" } as const;

/** A gate's value with its unit, never rounded up to or past its own limit. */
function gateValue(value: number, gate: Gate): string {
  return withUnit(formatValue(value, { below: gate.passed ? gate.limit : undefined }), gate.unit);
}

// ── Section 2: Sun and Earth positions ───────────────────────────────────────

function skyHeadline(gate: Gate): string {
  const verdict = gateVerdict(gate);
  if (verdict === "elsewhere" || gate.measured === null) {
    return "This run did not compare our Sun and Earth positions with NASA's.";
  }
  const measured = gateValue(gate.measured, gate);
  if (verdict === "passed") return `Our Sun and Earth positions agree with NASA's to within ${measured}.`;
  return `Our Sun and Earth positions differ from NASA's by up to ${measured}, more than our limit allows.`;
}

function skySentence(gate: Gate): string {
  const verdict = gateVerdict(gate);
  const limit = withUnit(formatValue(gate.limit), gate.unit);
  if (verdict === "elsewhere" || gate.measured === null) {
    return gate.detail ?? `The limit is ${limit}.`;
  }
  const measured = gateValue(gate.measured, gate);
  const outcome =
    verdict === "passed"
      ? `The largest difference was ${measured}. Our limit is ${limit}, so this check passed.`
      : `The largest difference was ${measured}. Our limit is ${limit}, so this check failed.`;
  return `We compared the direction of the Sun and of Earth, as seen from every site at every hour, with the answer from NASA's JPL Horizons service: ${formatCount(gate.samples)} comparisons in all. ${outcome}`;
}

export function SkySection({
  gate,
  series,
  names,
}: {
  gate: Gate | null;
  series: readonly DifferenceOverTime[] | undefined;
  names: Names;
}) {
  if (!gate) {
    return <p className="vl-prose">This run has no result for the Sun and Earth positions (gate G2).</p>;
  }
  const verdict = gateVerdict(gate);
  return (
    <>
      <div className={`vl-headline vl-headline-${verdict}`}>
        <p className="vl-headline-text">{skyHeadline(gate)}</p>
        <GateResult verdict={verdict} />
      </div>
      <p className="vl-prose">{skySentence(gate)}</p>
      <p className="vl-prose vl-quiet">
        <Explain term="horizons">JPL Horizons</Explain> is run by NASA's Jet Propulsion Laboratory, and space missions
        use it to know where things are. Differences are angles on the sky. A compass bearing stops meaning anything
        when the Sun or Earth is almost straight overhead or underfoot, so the check compares directions on the sky
        rather than raw bearings; the raw bearing difference is in the pipeline's note below.
      </p>
      <G2Over series={series} gate={gate} names={names} />
      {gate.detail ? (
        <Disclosure title="The pipeline's full note on this check">
          <p className="vl-note">{gate.detail}</p>
        </Disclosure>
      ) : null}
    </>
  );
}

function G2Over({ series, gate, names }: { series: readonly DifferenceOverTime[] | undefined; gate: Gate; names: Names }) {
  const sites = useMemo(() => g2Sites(series), [series]);
  const [chosen, setChosen] = useState<string | null>(null);
  const selectId = useId();
  const site = chosen ?? defaultG2Site(series);
  const lines = useMemo(() => (site ? g2Lines(series, site) : []), [series, site]);
  const peak = useMemo(() => g2Peak(series?.filter((item) => item.site_id === site)), [series, site]);
  const overall = useMemo(() => g2Peak(series), [series]);
  const years = useMemo(() => g2YearPeaks(lines), [lines]);

  // No series in the file: the headline stands alone, and no chart is drawn.
  if (!site || sites.length === 0 || !peak) return null;

  const name = (id: string) => names.get(id) ?? id;
  const limit = withUnit(formatValue(gate.limit), "deg");
  const deg = (value: number) => withUnit(formatValue(value, { below: gate.limit }), "deg");
  const summary = `At ${name(site)}, the largest daily difference from JPL Horizons was ${deg(peak.value)}, for ${BODY_NAME[peak.body]} on ${utcDay(peak.time)} UTC. The limit is ${limit}.`;
  const across =
    overall && sites.length > 1
      ? ` Across all ${sites.length} sites the largest was ${deg(overall.value)}, at ${name(overall.siteId)}.`
      : "";

  return (
    <figure className="vl-figure">
      <div className="vl-figure-head">
        <h3 className="vl-h3">The largest difference each day</h3>
        {sites.length > 1 ? (
          <label className="vl-select" htmlFor={selectId}>
            <span>Site</span>
            <select id={selectId} value={site} onChange={(event) => setChosen(event.target.value)}>
              {sites.map((id) => (
                <option key={id} value={id}>
                  {name(id)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <G2Chart lines={lines} limit={gate.limit} summary={summary} />
      <figcaption className="vl-caption">
        {summary}
        {across}
      </figcaption>
      <Disclosure title="The same numbers by year" meta={name(site)}>
        <TableBox label={`Largest difference from JPL Horizons by year at ${name(site)}`}>
          <table className="vl-table">
            <thead>
              <tr>
                <th scope="col">Year (UTC)</th>
                <th scope="col" className="vl-num">
                  Sun
                </th>
                <th scope="col" className="vl-num">
                  Earth
                </th>
              </tr>
            </thead>
            <tbody>
              {years.map((row) => (
                <tr key={row.year}>
                  <th scope="row">{row.year}</th>
                  <td className="vl-num">{row.sun === null ? "—" : deg(row.sun)}</td>
                  <td className="vl-num">{row.earth === null ? "—" : deg(row.earth)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </TableBox>
      </Disclosure>
    </figure>
  );
}

// ── Section 3: gates as a list ───────────────────────────────────────────────

export function GateList({ gates, label }: { gates: readonly Gate[]; label: string }) {
  if (gates.length === 0) return <p className="vl-prose vl-quiet">This run has no results here.</p>;
  return (
    <ul className="vl-gates" aria-label={label}>
      {gates.map((gate) => {
        const verdict = gateVerdict(gate);
        return (
          <li key={gate.id} className={`vl-gate vl-gate-${verdict}`}>
            <div className="vl-gate-main">
              <p className="vl-gate-name">
                <span className="vl-id">{gate.id}</span>
                {gate.name}
              </p>
              {gate.detail ? <p className="vl-note">{gate.detail}</p> : null}
            </div>
            <dl className="vl-gate-values">
              <div>
                <dt>Limit</dt>
                <dd className="tabular">{withUnit(formatValue(gate.limit), gate.unit)}</dd>
              </div>
              <div>
                <dt>Largest error</dt>
                <dd className="tabular">{gate.measured === null ? "Not measured here" : gateValue(gate.measured, gate)}</dd>
              </div>
              <div>
                <dt>Samples</dt>
                <dd className="tabular">{gate.samples > 0 ? formatCount(gate.samples) : "—"}</dd>
              </div>
            </dl>
            <div className="vl-gate-result">
              <GateResult verdict={verdict} />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

// ── Comparisons ──────────────────────────────────────────────────────────────

type ValueKind = "percent" | "degrees";

function kindOf(rows: readonly ComparisonRow[]): ValueKind {
  return rows[0]?.unit === "fraction" ? "percent" : "degrees";
}

function showValue(value: number, kind: ValueKind): string {
  return kind === "percent" ? formatPercent(value) : withUnit(formatNumber2(value), "deg");
}

function formatNumber2(value: number): string {
  return formatValue(value, { sig: 3 });
}

function showDifference(row: ComparisonRow, kind: ValueKind): string {
  return kind === "percent" ? `${formatPoints(row.difference)} points` : formatSignedDegrees(row.difference);
}

function showMark(mark: number, kind: ValueKind): string {
  return kind === "percent" ? `${formatValue(mark * 100, { sig: 2 })} percentage points` : withUnit(formatValue(mark), "deg");
}

/** Rows outside their mark, each with the explanation the file gives. Shown above the table. */
function Outliers({ rows, kind, self }: { rows: readonly ComparisonRow[]; kind: ValueKind; self: boolean }) {
  const outside = rows.filter((row) => row.verdict === "outside");
  if (outside.length === 0) return null;
  return (
    <ul className="vl-outliers">
      {outside.map((row) => (
        <li key={row.key} className="vl-outlier-card">
          <p className="vl-outlier-head">
            <ComparisonResult verdict="outside" />
            <strong>{row.siteName}</strong>
            <span className="tabular vl-quiet">
              {self
                ? `${showValue(row.ours, kind)} against a mark of ${showMark(row.mark, kind)}`
                : `ours ${showValue(row.ours, kind)}, NASA's ${showValue(row.reference, kind)}`}
            </span>
          </p>
          <p className="vl-outlier-text">
            {row.explanation ?? "The file gives no explanation for this result yet."}
          </p>
        </li>
      ))}
    </ul>
  );
}

function ComparisonTable({ rows, kind, self, title }: { rows: readonly ComparisonRow[]; kind: ValueKind; self: boolean; title: string }) {
  return (
    <TableBox label={`${title}: one row per site`}>
      <table className="vl-table">
        <thead>
          <tr>
            <th scope="col">Site</th>
            {self ? (
              <th scope="col" className="vl-num">
                Difference
              </th>
            ) : (
              <>
                <th scope="col" className="vl-num">
                  Ours
                </th>
                <th scope="col" className="vl-num">
                  NASA's
                </th>
                <th scope="col" className="vl-num">
                  Difference
                </th>
              </>
            )}
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className={row.verdict === "outside" ? "vl-row-outside" : undefined}>
              <th scope="row">{row.siteName}</th>
              {self ? (
                <td className="vl-num">{showValue(row.ours, kind)}</td>
              ) : (
                <>
                  <td className="vl-num">{showValue(row.ours, kind)}</td>
                  <td className="vl-num">{showValue(row.reference, kind)}</td>
                  <td className="vl-num">{showDifference(row, kind)}</td>
                </>
              )}
              <td>
                <ComparisonResult verdict={row.verdict} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </TableBox>
  );
}

/** The file's note for each row that is within its mark (for R1 to R3, where NASA's map was read). */
function RowNotes({ rows }: { rows: readonly ComparisonRow[] }) {
  const notes = rows.filter((row) => row.verdict === "within" && row.explanation);
  if (notes.length === 0) return null;
  return (
    <Disclosure title="Notes from the pipeline, site by site" meta={`${notes.length} notes`}>
      <dl className="vl-notes">
        {notes.map((row) => (
          <div key={row.key}>
            <dt>{row.siteName}</dt>
            <dd className="vl-note">{row.explanation}</dd>
          </div>
        ))}
      </dl>
    </Disclosure>
  );
}

function sources(rows: readonly ComparisonRow[]): string[] {
  return [...new Set(rows.map((row) => row.referenceSource).filter(isWebLink))];
}

const MAP_INTRO: Record<string, { lead: string; x: string; y: string; body: "sun" | "earth" }> = {
  R1: {
    lead: "For each polar site, the share of the time the Sun is in view, averaged over every hour, against NASA's average-sunlight map at the same spot.",
    x: "NASA's average sunlight",
    y: "Our average sunlight",
    body: "sun",
  },
  R2: {
    lead: "For each polar site, the share of hours when any part of Earth shows above the skyline, against NASA's Earth-visibility map at the same spot.",
    x: "NASA's Earth in view",
    y: "Our Earth in view",
    body: "earth",
  },
};

function mapSummary(rows: readonly ComparisonRow[], mark: number | null): string {
  const outside = rows.filter((row) => row.verdict === "outside");
  // Counts of the file's rows: display values.
  const within = rows.length - outside.length;
  const markText = mark === null ? "their mark" : showMark(mark, "percent");
  const head = `${within} of ${rows.length} sites are within ${markText} of NASA's value.`;
  const tail = outside
    .map((row) => ` ${row.siteName} is outside the mark: ours ${formatPercent(row.ours)}, NASA's ${formatPercent(row.reference)}.`)
    .join("");
  return head + tail;
}

export function MapComparison({ id, comparisons, names }: { id: "R1" | "R2"; comparisons: readonly Comparison[]; names: Names }) {
  const rows = useMemo(() => comparisonRows(comparisons, id, names), [comparisons, id, names]);
  const title = COMPARISON_TITLES[id] ?? id;
  const intro = MAP_INTRO[id];
  if (rows.length === 0 || !intro) {
    return (
      <div className="vl-block">
        <h3 className="vl-h3">
          <span className="vl-id">{id}</span>
          {title}
        </h3>
        <p className="vl-prose vl-quiet">This run has no results for {id}.</p>
      </div>
    );
  }
  const mark = sharedMark(rows);
  const summary = mapSummary(rows, mark);
  return (
    <div className="vl-block" id={`comparison-${id.toLowerCase()}`}>
      <h3 className="vl-h3">
        <span className="vl-id">{id}</span>
        {title}
      </h3>
      <p className="vl-prose">
        {intro.lead}
        {mark === null ? null : ` We look into any site where the two differ by more than ${showMark(mark, "percent")}.`}
      </p>
      <Outliers rows={rows} kind="percent" self={false} />
      <div className="vl-pair">
        <figure className="vl-figure vl-figure-scatter">
          <Scatter
            points={scatterPoints(rows)}
            mark={mark}
            body={intro.body}
            xLabel={intro.x}
            yLabel={intro.y}
            summary={summary}
          />
          <figcaption className="vl-caption">
            {summary} A point on the diagonal agrees exactly; the shaded band is the mark.
          </figcaption>
        </figure>
        <div className="vl-pair-table">
          <ComparisonTable rows={rows} kind="percent" self={false} title={`${id} ${title}`} />
        </div>
      </div>
      <RowNotes rows={rows} />
      <SourceLine urls={sources(rows)} />
    </div>
  );
}

const OTHER_INTRO: Record<string, string> = {
  R3: "Our slope from NASA's polar terrain map, against NASA's own slope map made from the same terrain.",
  R4: "Our slope from a close-up terrain map, against NASA's close-up slope map.",
  R5: "The skyline worked out twice at a few sites: once in our usual slices, and once in slices half as wide, with half the step along each line of sight. This compares our method with itself; the value is the typical difference between the two skylines.",
  R6: "The fast skyline used for the sensitivity grid, against the full method, at a few sites. This compares our method with itself.",
};

export function OtherComparison({ id, comparisons, names }: { id: string; comparisons: readonly Comparison[]; names: Names }) {
  const rows = useMemo(() => comparisonRows(comparisons, id, names), [comparisons, id, names]);
  const title = COMPARISON_TITLES[id] ?? `Comparison ${id}`;
  const self = isSelfComparison(id);
  const kind = kindOf(rows);
  const mark = sharedMark(rows);
  return (
    <div className="vl-block" id={`comparison-${id.toLowerCase()}`}>
      <h3 className="vl-h3">
        <span className="vl-id">{id}</span>
        {title}
      </h3>
      <p className="vl-prose">
        {OTHER_INTRO[id] ?? null}
        {mark === null ? null : ` We look into any site where ${self ? "the difference is" : "the two differ by"} more than ${showMark(mark, kind)}.`}
      </p>
      <Outliers rows={rows} kind={kind} self={self} />
      <ComparisonTable rows={rows} kind={kind} self={self} title={`${id} ${title}`} />
      <RowNotes rows={rows} />
      {self ? null : <SourceLine urls={sources(rows)} />}
    </div>
  );
}

function SourceLine({ urls }: { urls: readonly string[] }) {
  if (urls.length === 0) return null;
  return (
    <p className="vl-source-line">
      NASA's map:{" "}
      {urls.map((url, index) => (
        <span key={url}>
          {index > 0 ? ", " : null}
          <ExternalLink href={url}>{hostAndPath(url)}</ExternalLink>
        </span>
      ))}
    </p>
  );
}

// ── Section 6: what we do not model ──────────────────────────────────────────

const LIMITS: { title: string; text: string }[] = [
  {
    title: "Small things on the ground",
    text: "Our terrain map is a grid of squares, each wider than a lander. It cannot see boulders, small craters or anything narrower than one square, so our slope describes the area around a site, not the ground under a lander's feet.",
  },
  {
    title: "Two ways of drawing the Moon's grid",
    text: "NASA's terrain maps and JPL Horizons may lay the Moon's latitude and longitude lines down in very slightly different ways. The two common ways differ by less than our skyline can tell apart.",
  },
  {
    title: "Mixing maps",
    text: "Skylines use only the polar maps. The sharper close-up maps are used only for slope and for the 3D view, because joining maps made with different height adjustments can create ridges that are not there.",
  },
  {
    title: "Radio contact",
    text: "A clear line of sight to Earth is not a full radio link, and seeing Earth does not mean a particular ground station can hear the lander.",
  },
  {
    title: "Hour by hour",
    text: "We work in steps of one hour and fill in between them, so a sunrise or an earthset is right to within a few minutes, not to the second.",
  },
  {
    title: "Mission limits we had to choose",
    text: "Many missions have not published their limits. Where we had to choose a number ourselves, it is tagged assumed in Mission Control.",
  },
];

export function NotModelled() {
  return (
    <>
      <ul className="vl-limits">
        {LIMITS.map((item) => (
          <li key={item.title}>
            <h3 className="vl-limit-title">{item.title}</h3>
            <p>{item.text}</p>
          </li>
        ))}
      </ul>
      <p className="vl-source-line">
        In plain words, from{" "}
        <ExternalLink href={`${REPO_BLOB_URL}docs/science.md#15-known-limits`}>
          docs/science.md, section 15, “Known limits”
        </ExternalLink>
        .
      </p>
    </>
  );
}

// ── Section 7: data sources ──────────────────────────────────────────────────

export function Sources({ sources: list }: { sources: readonly DataSource[] }) {
  if (list.length === 0) return <p className="vl-prose vl-quiet">This run lists no sources.</p>;
  return (
    <ul className="vl-sources">
      {list.map((source, index) => (
        <li key={`${source.url}-${index}`}>
          {isWebLink(source.url) ? (
            <ExternalLink href={source.url} className="vl-source-name">
              {source.name}
            </ExternalLink>
          ) : (
            <span className="vl-source-name">{source.name}</span>
          )}
          <span className="vl-source-use">Used for {source.used_for}.</span>
          <span className="vl-source-host">{hostAndPath(source.url)}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Links ────────────────────────────────────────────────────────────────────

function hostAndPath(url: string): string {
  try {
    const parsed = new URL(url);
    const path = parsed.pathname.replace(/\/$/, "");
    return `${parsed.host}${path}`;
  } catch {
    return url;
  }
}

function ExternalLink({ href, children, className }: { href: string; children: ReactNode; className?: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer noopener" className={className ?? "vl-link"}>
      {children}
      <ArrowUpRight size={13} strokeWidth={1.8} aria-hidden="true" className="vl-link-icon" />
      <span className="vl-visually-hidden"> (opens in a new tab)</span>
    </a>
  );
}
