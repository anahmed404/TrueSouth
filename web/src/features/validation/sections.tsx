import { ArrowUpRight } from "lucide-react";
import { useId, useMemo, useState, type ReactNode } from "react";
import type { DataSource, Gate } from "../../contracts/generated.ts";
import { INCOMPLETE_MESSAGE, type ComparisonItem, type G2Series, type GateItem } from "./check";
import { Disclosure } from "../../components/Disclosure";
import { Explain } from "../../components/Explain";
import { REPO_BLOB_URL } from "../academy/card/links";
import { G2Chart } from "./G2Chart";
import { Scatter } from "./Scatter";
import {
  gateLimitText,
  gateMeasuredText,
  kindOf,
  largestDegreesText,
  markText,
  measureText,
  readingText,
  type ValueKind,
} from "./display";
import { formatCount, formatPercent } from "./format";
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
  tableRows,
  type TableRow,
  isWebLink,
  rawBearingNote,
  scatterPoints,
  sharedMark,
  utcDay,
  type ComparisonRow,
} from "./model";
import { ComparisonResult, GateResult, IncompleteResult, TableBox } from "./parts";

type Names = ReadonlyMap<string, string>;

const BODY_NAME = { sun: "the Sun", earth: "Earth" } as const;

/** A gate's largest error, rounded up (display.ts). */
function gateValue(value: number, gate: Gate): string {
  return gateMeasuredText({ ...gate, measured: value });
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
  const limit = gateLimitText(gate);
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
  item,
  series,
  brokenSeries,
  names,
}: {
  item: GateItem | null;
  series: readonly G2Series[];
  brokenSeries: number;
  names: Names;
}) {
  if (!item) {
    return <p className="vl-prose">This run has no result for the Sun and Earth positions (gate G2).</p>;
  }
  if (item.kind === "broken") return <GateList items={[item]} label="Sun and Earth positions" />;
  const gate = item.gate;
  const verdict = gateVerdict(gate);
  return (
    <>
      <div className={`vl-headline vl-headline-${verdict}`}>
        <p className="vl-headline-text">{skyHeadline(gate)}</p>
        <GateResult verdict={verdict} />
      </div>
      <p className="vl-prose">{skySentence(gate)}</p>
      <BearingNote detail={gate.detail} />
      <p className="vl-prose vl-quiet">
        <Explain term="horizons">JPL Horizons</Explain> is run by NASA's Jet Propulsion Laboratory, and space missions
        use it to know where things are.
      </p>
      <G2Over series={series} gate={gate} names={names} />
      {brokenSeries > 0 ? (
        <p className="vl-prose vl-quiet">
          {brokenSeries === 1
            ? "One chart series is incomplete in this build and is not drawn."
            : `${brokenSeries} chart series are incomplete in this build and are not drawn.`}
        </p>
      ) : null}
      {gate.detail ? (
        <Disclosure title="The pipeline's full note on this check">
          <p className="vl-note">{gate.detail}</p>
        </Disclosure>
      ) : null}
    </>
  );
}

/**
 * Decision 0011: G2 is gated on the angle on the sky, and the raw compass-bearing
 * difference is shown beside it, in the open. The numbers are the file's own words,
 * quoted from `detail`; nothing is read out of them.
 */
function BearingNote({ detail }: { detail: string | null | undefined }) {
  const quote = rawBearingNote(detail);
  return (
    <div className="vl-bearing">
      <h3 className="vl-h3">Measured on the sky, not by compass bearing</h3>
      <p className="vl-prose">
        This check measures each difference as an angle on the sky. When the Sun or Earth is almost straight overhead
        or underfoot, a tiny shift on the sky can swing its compass bearing a long way, so the raw difference between
        compass bearings says little about whether a direction is right. It is reported here, and it is not gated
        {quote ? ". The pipeline's note on it reads:" : ". This run's file does not report it."}
      </p>
      {quote ? (
        <blockquote className="vl-quote">
          <p>{quote}</p>
        </blockquote>
      ) : null}
    </div>
  );
}

function G2Over({ series, gate, names }: { series: readonly G2Series[]; gate: Gate; names: Names }) {
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
  const limit = gateLimitText(gate);
  // Daily and yearly values are largest differences: rounded up, against the limit.
  const deg = (value: number) => largestDegreesText(value, gate.limit);
  const summary = `At ${name(site)}, the largest daily difference from JPL Horizons was ${deg(peak.value)}, for ${BODY_NAME[peak.body]} on ${utcDay(peak.time)} UTC. The limit is ${limit}.`;
  const across =
    overall && sites.length > 1 && overall.siteId !== site
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

export function GateList({ items, label }: { items: readonly GateItem[]; label: string }) {
  if (items.length === 0) return <p className="vl-prose vl-quiet">This run has no results here.</p>;
  return (
    <ul className="vl-gates" aria-label={label}>
      {items.map((item, index) => {
        if (item.kind === "broken") {
          return (
            <li key={`broken-${index}`} className="vl-gate vl-gate-broken">
              <div className="vl-gate-main">
                <p className="vl-gate-name">
                  {item.id ? <span className="vl-id">{item.id}</span> : null}
                  {item.name ?? "A check with no name"}
                </p>
                <p className="vl-note">{INCOMPLETE_MESSAGE}.</p>
              </div>
              <div className="vl-gate-values" />
              <div className="vl-gate-result">
                <IncompleteResult />
              </div>
            </li>
          );
        }
        const gate = item.gate;
        const verdict = gateVerdict(gate);
        return (
          <li key={`${gate.id}-${index}`} className={`vl-gate vl-gate-${verdict}`}>
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
                <dd className="tabular">{gateLimitText(gate)}</dd>
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
                ? `${measureText(row, kind)} against a mark of ${markText(row.mark, kind)}`
                : `ours ${readingText(row.ours, kind)}, NASA's ${readingText(row.reference, kind)}`}
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

function ComparisonTable({ rows, kind, self, title }: { rows: readonly TableRow[]; kind: ValueKind; self: boolean; title: string }) {
  const columns = self ? 2 : 4;
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
          {rows.map((row) =>
            row.kind === "broken" ? (
              <tr key={row.key} className="vl-row-broken">
                <th scope="row">{row.name ?? "A site with no name"}</th>
                <td colSpan={columns}>
                  <IncompleteResult /> <span className="vl-quiet">{INCOMPLETE_MESSAGE}.</span>
                </td>
              </tr>
            ) : (
            <tr key={row.key} className={row.verdict === "outside" ? "vl-row-outside" : undefined}>
              <th scope="row">{row.siteName}</th>
              {self ? (
                <td className="vl-num">{measureText(row, kind)}</td>
              ) : (
                <>
                  <td className="vl-num">{readingText(row.ours, kind)}</td>
                  <td className="vl-num">{readingText(row.reference, kind)}</td>
                  <td className="vl-num">{measureText(row, kind)}</td>
                </>
              )}
              <td>
                <ComparisonResult verdict={row.verdict} />
              </td>
            </tr>
            ),
          )}
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
    lead: "For each polar site, how much of the Sun's disc shows above the skyline, averaged over every hour, against NASA's average-sunlight map at the same spot.",
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

function mapSummary(rows: readonly ComparisonRow[], mark: number | null, incomplete: number): string {
  const outside = rows.filter((row) => row.verdict === "outside");
  // Counts of the file's rows: display values.
  const within = rows.length - outside.length;
  const markWords = mark === null ? "their mark" : markText(mark, "percent");
  const head = `${within} of ${rows.length} sites are within ${markWords} of NASA's value.`;
  const tail = outside
    .map((row) => ` ${row.siteName} is outside the mark: ours ${formatPercent(row.ours)}, NASA's ${formatPercent(row.reference)}.`)
    .join("");
  // A record the page could not read is said, not drawn and not counted as within.
  const missing =
    incomplete === 0
      ? ""
      : incomplete === 1
        ? " One more record is incomplete in this build and is not drawn."
        : ` ${incomplete} more records are incomplete in this build and are not drawn.`;
  return head + tail + missing;
}

export function MapComparison({ id, comparisons, names }: { id: "R1" | "R2"; comparisons: readonly ComparisonItem[]; names: Names }) {
  const rows = useMemo(() => comparisonRows(comparisons, id, names), [comparisons, id, names]);
  const all = useMemo(() => tableRows(comparisons, id, names), [comparisons, id, names]);
  const title = COMPARISON_TITLES[id] ?? id;
  const intro = MAP_INTRO[id];
  if (all.length === 0 || !intro) {
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
  const summary = mapSummary(rows, mark, all.length - rows.length);
  return (
    <div className="vl-block" id={`comparison-${id.toLowerCase()}`}>
      <h3 className="vl-h3">
        <span className="vl-id">{id}</span>
        {title}
      </h3>
      <p className="vl-prose">
        {intro.lead}
        {mark === null ? null : ` We look into any site where the two differ by more than ${markText(mark, "percent")}.`}
      </p>
      <Outliers rows={rows} kind="percent" self={false} />
      <div className="vl-pair">
        {rows.length === 0 ? (
          <p className="vl-prose vl-quiet">No record of {id} is complete in this build, so there is no chart.</p>
        ) : (
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
        )}
        <div className="vl-pair-table">
          <ComparisonTable rows={all} kind="percent" self={false} title={`${id} ${title}`} />
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

export function OtherComparison({ id, comparisons, names }: { id: string; comparisons: readonly ComparisonItem[]; names: Names }) {
  const rows = useMemo(() => comparisonRows(comparisons, id, names), [comparisons, id, names]);
  const all = useMemo(() => tableRows(comparisons, id, names), [comparisons, id, names]);
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
        {mark === null ? null : ` We look into any site where ${self ? "the difference is" : "the two differ by"} more than ${markText(mark, kind)}.`}
      </p>
      <Outliers rows={rows} kind={kind} self={self} />
      <ComparisonTable rows={all} kind={kind} self={self} title={`${id} ${title}`} />
      <RowNotes rows={rows} />
      {self ? null : <SourceLine urls={sources(rows)} />}
    </div>
  );
}

/** Comparison records with no usable id, listed on their own so none is dropped. */
export function IncompleteComparisons({ rows }: { rows: readonly TableRow[] }) {
  if (rows.length === 0) return null;
  return (
    <div className="vl-block">
      <h3 className="vl-h3">Records we could not read</h3>
      <ul className="vl-gates">
        {rows.map((row) => (
          <li key={row.key} className="vl-gate vl-gate-broken">
            <div className="vl-gate-main">
              <p className="vl-gate-name">{row.kind === "broken" && row.name ? row.name : "A comparison with no id"}</p>
              <p className="vl-note">{INCOMPLETE_MESSAGE}.</p>
            </div>
            <div className="vl-gate-values" />
            <div className="vl-gate-result">
              <IncompleteResult />
            </div>
          </li>
        ))}
      </ul>
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
