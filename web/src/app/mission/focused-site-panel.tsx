import { ArrowUpRight, Check, PanelRightClose, PanelRightOpen } from "lucide-react";
import { memo, type Ref } from "react";
import type { MissionProfile, Site } from "../../contracts/generated";
import { IconButton } from "../../components/Button";
import { Disclosure } from "../../components/Disclosure";
import { Explain } from "../../components/Explain";
import { cx, formatNumber } from "../../components/format";
import { NumberUnit } from "../../components/NumberUnit";
import { Card, Panel } from "../../components/Panel";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { StatusBadge, StatusLamp } from "../../components/StatusLamp";
import { Tip } from "../../components/Tip";
import { useSites } from "../../data/hooks";
import type { Evaluation } from "../../lib/scoring";
import { windowLength } from "../../lib/scoring";
import { describeEvaluation, describeMetrics, describeUtilities, provenanceOf, type RuleView } from "./rules";
import { useScenario } from "./scenario-context";
import { SHELL_SHORTCUTS } from "./shell-layout";
import { NO_RESULT_TEXT, isSphere, siteName, useSiteStatus, type SiteStatus } from "./site-status";

type FocusedSitePanelProps = {
  collapsed: boolean;
  onToggle: () => void;
  regionRef?: Ref<HTMLElement>;
  toggleRef?: Ref<HTMLButtonElement>;
};

const REGION_ID = "focused-site";

/**
 * The right panel, in the order the user needs it: the status, the broken rules, the
 * rules that pass, the score, then the window's metrics behind a closed disclosure, the
 * ground, and links out. It reads the focused site, the profile and the landing date.
 * Collapsed, it keeps the focused site's status lamp.
 */
export const FocusedSitePanel = memo(function FocusedSitePanel({ collapsed, onToggle, regionRef, toggleRef }: FocusedSitePanelProps) {
  const siteId = useScenario((s) => s.focusedSiteId);
  const profile = useScenario((s) => s.profile);
  const landingUtc = useScenario((s) => s.landingUtc);
  const sites = useSites();
  const site = siteId && sites.status === "ready" ? (sites.data.find((s) => s.id === siteId) ?? null) : null;
  const toggleLabel = collapsed ? "Show the focused-site panel" : "Hide the focused-site panel";

  return (
    <Panel as="aside" ref={regionRef} id={REGION_ID} aria-label="Focused site" className="shell-focus" data-collapsed={collapsed}>
      <div className="focus-head">
        {collapsed || !siteId ? null : <h2 className="focus-name">{siteName(site, siteId)}</h2>}
        {collapsed || !site ? null : (
          <p className="focus-coords tabular">
            {formatNumber(site.lat_deg, 4)}°, {formatNumber(site.lon_deg, 4)}° E
          </p>
        )}
        <IconButton
          ref={toggleRef}
          label={toggleLabel}
          hint={`· shortcut ${SHELL_SHORTCUTS.focusPanel}`}
          aria-expanded={!collapsed}
          aria-controls={`${REGION_ID}-body`}
          aria-keyshortcuts={SHELL_SHORTCUTS.focusPanel}
          icon={collapsed ? <PanelRightOpen size={16} strokeWidth={1.8} /> : <PanelRightClose size={16} strokeWidth={1.8} />}
          onClick={onToggle}
          className="shell-toggle"
        />
      </div>

      <div id={`${REGION_ID}-body`} className="focus-body">
        {!siteId ? (
          collapsed ? null : <p className="focus-empty">Add a site to the sites rail to see its status here.</p>
        ) : (
          <FocusedSiteBody siteId={siteId} site={site} profile={profile} landingUtc={landingUtc} collapsed={collapsed} onToggle={onToggle} />
        )}
      </div>
    </Panel>
  );
});

type BodyProps = {
  siteId: string;
  site: Site | null;
  profile: MissionProfile;
  landingUtc: string;
  collapsed: boolean;
  onToggle: () => void;
};

function FocusedSiteBody({ siteId, site, profile, landingUtc, collapsed, onToggle }: BodyProps) {
  const status = useSiteStatus(siteId, profile, landingUtc);
  const name = siteName(site, siteId);
  if (collapsed) return <CollapsedLamp name={name} status={status} onToggle={onToggle} />;

  return (
    <div className="focus-full">
      {status.kind === "loading" ? (
        <div className="focus-loading" aria-label="Loading this site">
          <span className="skeleton skeleton-block" />
          <span className="skeleton skeleton-line" />
          <span className="skeleton skeleton-line skeleton-short" />
        </div>
      ) : status.kind === "error" ? (
        <Card className="verdict" role="status">
          <p className="verdict-quiet">Could not load this site's data.</p>
          <p className="verdict-text">{status.message}</p>
        </Card>
      ) : status.kind === "none" ? (
        <Card className="verdict" role="status">
          <p className="verdict-quiet">
            <span className="lamp-none" aria-hidden="true" />
            {NO_RESULT_TEXT}.
          </p>
          <p className="verdict-text">The data ends on 2031-12-31 23:00 UTC. Pick an earlier landing date to see a status.</p>
        </Card>
      ) : (
        <EvaluationDetail evaluation={status.evaluation} profile={profile} />
      )}

      {site ? <GroundSection site={site} /> : null}

      {site ? (
        <nav className="focus-links" aria-label="Open this site elsewhere">
          <a href={site.quickmap_url} target="_blank" rel="noreferrer">
            Open in Quickmap
            <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
          </a>
          <a href={site.moontrek_url} target="_blank" rel="noreferrer">
            Open in Moon Trek
            <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
          </a>
        </nav>
      ) : null}
    </div>
  );
}

function CollapsedLamp({ name, status, onToggle }: { name: string; status: SiteStatus; onToggle: () => void }) {
  const word = status.kind === "ready" ? status.evaluation.status : status.kind === "none" ? "no result" : status.kind;
  return (
    <Tip
      content={
        <>
          <span className="tip-title">{name}</span>
          <span>{word}</span>
        </>
      }
    >
      {(trigger) => (
        <button {...trigger} type="button" className="rail-lamp" aria-label={`${name}, ${word}. Show the focused-site panel`} onClick={onToggle}>
          {status.kind === "ready" ? <StatusLamp status={status.evaluation.status} /> : <span className="lamp-none" aria-hidden="true" />}
        </button>
      )}
    </Tip>
  );
}

function EvaluationDetail({ evaluation, profile }: { evaluation: Evaluation; profile: MissionProfile }) {
  const view = describeEvaluation(evaluation, profile);
  const nogo = evaluation.status === "NO-GO";
  const metrics = describeMetrics(evaluation);

  return (
    <>
      <Card className="verdict" role="status">
        <StatusBadge status={evaluation.status} size="lg" />
        <p className="verdict-text">{view.statusSentence}</p>
      </Card>

      {view.broken.length > 0 ? (
        <section aria-labelledby="broken-rules-h" className="focus-section">
          <h3 id="broken-rules-h" className="focus-label">
            {view.broken.length === 1 ? "Broken rule" : "Broken rules"}
          </h3>
          <div className="broken-list">
            {view.broken.map((rule) => (
              <BrokenRule key={rule.id} rule={rule} />
            ))}
          </div>
        </section>
      ) : null}

      {view.passing.length > 0 ? (
        <section aria-labelledby="passing-rules-h" className="focus-section">
          <h3 id="passing-rules-h" className="focus-label">
            Rules that pass
          </h3>
          <ul className="passes">
            {view.passing.map((rule) => (
              <li key={rule.id}>
                <Check className="passes-icon" size={14} strokeWidth={2.6} aria-hidden="true" />
                <span>
                  <Explain term={rule.term}>{rule.name}</Explain> <RuleValue rule={rule} />
                  {rule.limitText ? `, ${rule.limitText}` : null}
                </span>
                {rule.provenance ? <ProvenanceTag provenance={rule.provenance} /> : <span />}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <ScoreSection evaluation={evaluation} profile={profile} unused={nogo} />

      <Disclosure
        title="Mission window metrics"
        meta={
          <>
            {metrics.length} values, <NumberUnit value={windowLength(profile.duration_days)} unit="h" />
          </>
        }
      >
        <p className="metrics-lead">
          Over the <Explain term="mission_window">mission window</Explain>, from the landing hour.
        </p>
        <dl className="metrics">
          {metrics.map((metric) => (
            <div key={metric.term} className="metrics-row">
              <dt>
                <Explain term={metric.term}>{metric.name}</Explain>
              </dt>
              <dd className={metric.broken ? "metrics-broken" : undefined}>
                <NumberUnit value={metric.value} unit={metric.unit} decimals={metric.decimals} />
                {metric.broken ? <span className="sr-only"> (breaks a rule)</span> : null}
              </dd>
            </div>
          ))}
        </dl>
      </Disclosure>
    </>
  );
}

function RuleValue({ rule }: { rule: RuleView }) {
  if (rule.value === null) return <b>{rule.valueText}</b>;
  return (
    <b>
      <NumberUnit value={rule.value} unit={rule.unit} decimals={rule.decimals} />
    </b>
  );
}

function BrokenRule({ rule }: { rule: RuleView }) {
  const share = (n: number) => `${Math.min(Math.max((n / rule.scaleMax) * 100, 0), 100)}%`;
  const hasBar = rule.value !== null && rule.limit !== null;
  return (
    <Card tone="nogo" className="broken">
      <div className="broken-row">
        <span className="broken-name">
          <StatusLamp status="NO-GO" />
          <Explain term={rule.term}>{rule.name}</Explain>
        </span>
        {rule.value !== null ? (
          <NumberUnit className="broken-value" value={rule.value} unit={rule.unit} decimals={rule.decimals} display />
        ) : (
          <span className="broken-value">{rule.valueText}</span>
        )}
      </div>
      <p className="broken-text">{rule.sentence}</p>
      {hasBar ? (
        <div className="meter" aria-hidden="true">
          <i style={{ width: share(rule.value ?? 0) }} />
          <u style={{ left: share(rule.limit ?? 0) }} />
        </div>
      ) : null}
      <p className="broken-limit">
        {rule.limitText ? <span>{rule.limitText.charAt(0).toUpperCase() + rule.limitText.slice(1)}</span> : null}
        {rule.provenance ? <ProvenanceTag provenance={rule.provenance} /> : null}
      </p>
    </Card>
  );
}


function ScoreSection({ evaluation, profile, unused }: { evaluation: Evaluation; profile: MissionProfile; unused: boolean }) {
  const utilities = describeUtilities(evaluation, profile);
  const weightsTag = provenanceOf(profile, "weights");
  return (
    <section aria-labelledby="score-h" className={cx("focus-section score", unused && "score-unused")}>
      <div className="score-head">
        <h3 id="score-h" className="score-title">
          <Explain term="score">Score</Explain>
        </h3>
        <span className="score-value tabular">
          {unused ? <s>{formatNumber(evaluation.score)}</s> : formatNumber(evaluation.score)}
          <span className="unit"> of 100</span>
        </span>
      </div>
      {unused ? <p className="score-note">Not used: a broken rule decides this date.</p> : null}
      <table className="utilities">
        <caption className="sr-only">Utilities and their weights</caption>
        <thead>
          <tr>
            <th scope="col">
              <Explain term="utility">Utility</Explain>
            </th>
            <th scope="col" className="num">
              Rating
            </th>
            <th scope="col" className="num">
              <span className="explain">
                Weight {weightsTag ? <ProvenanceTag provenance={weightsTag} /> : null}
              </span>
            </th>
          </tr>
        </thead>
        <tbody>
          {utilities.map((u) => (
            <tr key={u.id}>
              <th scope="row">
                <Explain term={u.term}>{u.name}</Explain>
              </th>
              <td className="num tabular">{u.value === null ? "not assessed" : formatNumber(u.value, 2)}</td>
              <td className="num tabular">
                {u.share === null ? "left out" : `${formatNumber(u.share * 100)} %`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function GroundSection({ site }: { site: Site }) {
  const sphere = isSphere(site);
  return (
    <section aria-labelledby="ground-h" className="focus-section">
      <h3 id="ground-h" className="focus-label">
        The ground
      </h3>
      <dl className="metrics">
        <div className="metrics-row">
          <dt>
            <Explain term="slope">Slope</Explain>
          </dt>
          <dd>
            {site.slope ? (
              <>
                <NumberUnit value={site.slope.deg} unit="°" decimals={1} />{" "}
                <span className="dd-sub">
                  over <NumberUnit value={site.slope.baseline_m} unit="m" />
                  <Explain term="slope_baseline_m" label="slope baseline" />
                </span>
              </>
            ) : (
              <span className="dd-sub">Slope not assessed</span>
            )}
          </dd>
        </div>
        <div className="metrics-row">
          <dt>
            <Explain term="terrain_tier">Terrain</Explain>
          </dt>
          <dd>{sphere ? <span className="dd-sub">Terrain not modelled</span> : `${site.terrain_tier}${site.has_closeup ? ", close-up DEM" : ""}`}</dd>
        </div>
        {site.elevation_m !== null ? (
          <div className="metrics-row">
            <dt>Ground height</dt>
            <dd>
              <NumberUnit value={site.elevation_m} unit="m" />
            </dd>
          </div>
        ) : null}
      </dl>
      {site.slope ? <p className="ground-source">Slope from {site.slope.source}.</p> : null}
    </section>
  );
}
