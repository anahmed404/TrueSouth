import { Fragment, useMemo, type ReactNode } from "react";
import { Link } from "react-router";
import type { Site, Validation } from "../../contracts/generated.ts";
import { BrandMark } from "../../components/BrandMark";
import { formatUtc } from "../../components/format";
import { useSites, useValidation, type HookResult } from "../../data";
import type { CheckedReport } from "./check";
import { Method } from "./Method";
import {
  COMPARISON_TITLES,
  MAP_COMPARISONS,
  NOT_RUN_MESSAGE,
  brokenWithoutId,
  comparisonIds,
  groupGates,
  pageState,
  siteNames,
  slopeSectionIds,
  summariseComparisons,
  summariseGates,
} from "./model";
import { GateList, IncompleteComparisons, MapComparison, NotModelled, OtherComparison, SkySection, Sources } from "./sections";
import "./validation.css";

const SECTIONS = [
  { id: "method", title: "The method in one picture" },
  { id: "sun-and-earth", title: "Sun and Earth positions" },
  { id: "terrain", title: "Terrain geometry" },
  { id: "nasa-maps", title: "Against NASA's maps" },
  { id: "slope", title: "Slope" },
  { id: "not-modelled", title: "What we do not model" },
  { id: "sources", title: "Data sources" },
] as const;

type SectionId = (typeof SECTIONS)[number]["id"];

function titleOf(id: SectionId): string {
  return SECTIONS.find((section) => section.id === id)?.title ?? id;
}

/** "How we know it's right": the evidence in validation.json, for judges, planners and learners. */
export default function ValidationPage() {
  const validation = useValidation();
  const sites = useSites();
  return <ValidationView validation={validation} sites={sites.data} />;
}

type ValidationViewProps = {
  validation: HookResult<Validation | null>;
  /** Site names for the tables; the site id stands in while they load. */
  sites: readonly Site[] | null;
};

/** The page itself, without the data hooks, so tests can draw any state of the file. */
export function ValidationView({ validation, sites }: ValidationViewProps) {
  const state = pageState(validation);
  const names = useMemo(() => siteNames(sites), [sites]);

  return (
    <div className="vl-page">
      <header className="vl-top">
        <BrandMark />
        <nav aria-label="TrueSouth" className="vl-top-nav">
          <Link to="/mission">Mission Control</Link>
          <Link to="/academy">Academy</Link>
        </nav>
      </header>

      <main className="vl-main" aria-busy={state.kind === "loading"}>
        <div className="vl-intro">
          <h1>How we know it's right</h1>
          <p className="vl-lead">
            TrueSouth's answers are only as good as the numbers behind them. This page shows every check we run on
            those numbers, including any that came out badly, and what we leave out.
          </p>
          {state.kind === "ready" ? <RunLine report={state.report} /> : null}
          {state.kind === "loading" ? <p className="vl-run">Loading the validation results.</p> : null}
        </div>

        {state.kind === "not-run" ? (
          <div className="vl-not-run" role="status">
            <p className="vl-not-run-title">{NOT_RUN_MESSAGE}.</p>
            <p>The checks have not produced their results file for this copy of the app, so there is nothing to show yet.</p>
            <Link to="/">Back to the start</Link>
          </div>
        ) : (
          <div className="vl-layout">
            <nav className="vl-contents" aria-label="On this page">
              <h2 className="vl-contents-title">On this page</h2>
              <ol>
                {SECTIONS.map((section) => (
                  <li key={section.id}>
                    <a href={`#${section.id}`}>{section.title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="vl-body">
              {state.kind === "ready" ? <Report report={state.report} names={names} /> : <LoadingFrame />}
            </div>
          </div>
        )}
      </main>

      <footer className="vl-foot">
        Planning aid, not flight certification. Limits marked assumed are our estimates.
      </footer>
    </div>
  );
}

function RunLine({ report }: { report: CheckedReport }) {
  // Counts of the file's own rows: display values only. An incomplete record is never
  // counted as passed or as within its mark.
  const gates = summariseGates(report.gates);
  const comparisons = summariseComparisons(report.comparisons);
  const within = comparisons.total - comparisons.outside - comparisons.incomplete;
  const gateText =
    `${gates.measured} of ${gates.total} checks were measured by this run: ${gates.passed} passed` +
    (gates.failed > 0 ? ` and ${gates.failed} failed` : "") +
    "." +
    (gates.elsewhere > 0 ? ` ${gates.elsewhere} more ${gates.elsewhere === 1 ? "is" : "are"} checked in the web tests.` : "") +
    (gates.incomplete > 0
      ? ` ${gates.incomplete} ${gates.incomplete === 1 ? "check's record is" : "checks' records are"} incomplete in this build.`
      : "");
  const comparisonText =
    (comparisons.outside === 0
      ? comparisons.incomplete === 0
        ? ` All ${comparisons.total} comparisons are within their mark.`
        : ` ${within} of ${comparisons.total} comparisons are within their mark.`
      : ` ${comparisons.outside} of ${comparisons.total} comparisons ${comparisons.outside === 1 ? "is" : "are"} outside their mark; each is explained where it appears.`) +
    (comparisons.incomplete > 0
      ? ` ${comparisons.incomplete} comparison ${comparisons.incomplete === 1 ? "record is" : "records are"} incomplete in this build.`
      : "");
  return (
    <>
      <p className="vl-run">
        Last run <time dateTime={report.generated_utc}>{formatUtc(report.generated_utc)}</time>.
      </p>
      <p className="vl-summary">
        {gateText}
        {comparisonText}
      </p>
    </>
  );
}

function Section({ id, children, lead }: { id: SectionId; children?: ReactNode; lead?: ReactNode }) {
  return (
    <section className="vl-section" id={id} aria-labelledby={`${id}-title`}>
      <h2 id={`${id}-title`} className="vl-h2">
        {titleOf(id)}
      </h2>
      {lead ? <p className="vl-prose">{lead}</p> : null}
      {children}
    </section>
  );
}

/** The page's frame while the file loads: the headings in place, no numbers. */
function LoadingFrame() {
  return (
    <>
      {SECTIONS.map((section) => (
        <Section key={section.id} id={section.id}>
          <div className="vl-skeleton" aria-hidden="true" />
        </Section>
      ))}
    </>
  );
}

function Report({ report, names }: { report: CheckedReport; names: ReadonlyMap<string, string> }) {
  const groups = groupGates(report.gates);
  const otherIds = slopeSectionIds(report.comparisons);
  const ids = new Set(comparisonIds(report.comparisons));
  const r4Missing = ids.has("R3") && !ids.has("R4");

  return (
    <>
      <Section
        id="method"
        lead="Two NASA sources go in. Python works out each site's skyline and its sky hour by hour, once. Your browser turns those into scores for your mission. Each step below is checked further down this page."
      >
        <Method />
        <p className="vl-prose vl-quiet">
          Two kinds of check follow. A check has a limit it must stay under, or the build fails. A comparison with
          NASA's maps has a mark: beyond it, we look into the difference and write down why.
        </p>
      </Section>

      <Section id="sun-and-earth">
        <SkySection item={groups.sky} series={report.g2_over_time} brokenSeries={report.brokenSeries} names={names} />
      </Section>

      <Section
        id="terrain"
        lead="We build made-up terrain whose answer is known exactly, such as a flat Moon, a wall at a known distance and a plane tilted at a known angle, and check that our code gets that answer."
      >
        <GateList items={groups.terrain} label="Terrain geometry checks" />
        <h3 className="vl-h3" id="terrain-other">
          Other checks
        </h3>
        <p className="vl-prose">
          Checks on reading NASA's files, on map projections, on storing the numbers and on the scoring in your
          browser.
        </p>
        <GateList items={groups.other} label="Other checks" />
      </Section>

      <Section
        id="nasa-maps"
        lead="NASA has published its own maps of how often each spot near the pole sees the Sun and Earth. We read those maps at each polar site and compare. They are not hard checks: NASA averages a longer span of years, from its own terrain and for an observer on the ground, so a small gap is expected."
      >
        {MAP_COMPARISONS.map((id) => (
          <MapComparison key={id} id={id} comparisons={report.comparisons} names={names} />
        ))}
      </Section>

      <Section id="slope">
        {otherIds.length === 0 ? <p className="vl-prose vl-quiet">This run has no slope results.</p> : null}
        {otherIds.map((id) => (
          <Fragment key={id}>
            <OtherComparison id={id} comparisons={report.comparisons} names={names} />
            {id === "R3" && r4Missing ? (
              <p className="vl-prose vl-quiet">
                This run has no results for R4, {COMPARISON_TITLES.R4?.toLowerCase()}.
              </p>
            ) : null}
          </Fragment>
        ))}
        <IncompleteComparisons rows={brokenWithoutId(report.comparisons, names)} />
      </Section>

      <Section
        id="not-modelled"
        lead="A result is only as good as what it leaves out. These are the limits we know about."
      >
        <NotModelled />
      </Section>

      <Section id="sources" lead="Every NASA product this run used, with its link.">
        <Sources sources={report.sources} />
        {report.brokenSources > 0 ? (
          <p className="vl-prose vl-quiet">
            {report.brokenSources === 1
              ? "One more source is incomplete in this build and is not listed."
              : `${report.brokenSources} more sources are incomplete in this build and are not listed.`}
          </p>
        ) : null}
      </Section>
    </>
  );
}
