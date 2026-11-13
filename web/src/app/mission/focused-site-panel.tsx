import { ArrowUpRight, Check, PanelRightClose, PanelRightOpen } from "lucide-react";
import type { Ref } from "react";
import { IconButton } from "../../components/Button";
import { Disclosure } from "../../components/Disclosure";
import { Explain } from "../../components/Explain";
import { formatNumber } from "../../components/format";
import { NumberUnit } from "../../components/NumberUnit";
import { Card, Panel } from "../../components/Panel";
import { ProvenanceTag, type Provenance } from "../../components/ProvenanceTag";
import { StatusBadge, StatusLamp, type Status } from "../../components/StatusLamp";
import { Tip } from "../../components/Tip";
import { SHELL_SHORTCUTS } from "./shell-layout";

/** A rule the mission window breaks: a veto. */
export type BrokenRuleView = {
  /** explain.ts key for the rule. */
  term: string;
  name: string;
  value: number;
  unit: string;
  decimals?: number;
  limit: number;
  provenance: Provenance;
  /** One plain sentence on what happened. Times in UTC. */
  sentence: string;
  /** The meter's full scale, in the rule's unit. */
  scaleMax: number;
};

/** A rule the mission window passes, in one line. */
export type PassingRuleView = {
  term: string;
  name: string;
  value: number;
  unit: string;
  decimals?: number;
  /** The threshold as plain text, for example "limit 6 h" or "needs 0.5". */
  limit: string;
  provenance: Provenance;
};

export type MetricView = {
  term: string;
  name: string;
  value: number | string;
  unit: string;
  decimals?: number;
  /** True when this metric breaks a rule. */
  broken?: boolean;
};

export type FocusedSiteView = {
  id: string;
  name: string;
  latDeg: number;
  lonEastDeg: number;
  terrainTier: "core80" | "wide240" | "sphere";
  hasCloseUpDem: boolean;
  status: Status;
  /** One sentence saying what the status means. */
  statusSentence: string;
  /** A NO-GO window's score, shown struck through because it is not used. */
  unusedScore?: number | null;
  brokenRules: readonly BrokenRuleView[];
  passingRules: readonly PassingRuleView[];
  metrics: readonly MetricView[];
  windowHours: number;
  links: { quickmap: string; moonTrek: string };
};

type FocusedSitePanelProps = {
  site: FocusedSiteView | null;
  collapsed: boolean;
  onToggle: () => void;
  sample?: boolean;
  regionRef?: Ref<HTMLElement>;
  toggleRef?: Ref<HTMLButtonElement>;
};

const REGION_ID = "focused-site";

/**
 * The right panel, in the order the user needs it: the status, the broken rule, the
 * rules that pass, then the remaining metrics behind a closed disclosure. Collapsed, it
 * keeps the focused site's status lamp.
 */
export function FocusedSitePanel({ site, collapsed, onToggle, sample = false, regionRef, toggleRef }: FocusedSitePanelProps) {
  const toggleLabel = collapsed ? "Show the focused-site panel" : "Hide the focused-site panel";

  return (
    <Panel
      as="aside"
      ref={regionRef}
      id={REGION_ID}
      aria-label="Focused site"
      className="shell-focus"
      data-collapsed={collapsed}
    >
      <div className="focus-head">
        {collapsed || !site ? null : <h2 className="focus-name">{site.name}</h2>}
        {collapsed || !site ? null : (
          <p className="focus-coords">
            {formatNumber(site.latDeg, 4)}°, {formatNumber(site.lonEastDeg, 4)}° E · {site.terrainTier} terrain
            {site.hasCloseUpDem ? " · close-up DEM" : ""}
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
        {!site ? (
          collapsed ? null : <p className="focus-empty">Pick a site in the sites rail to see its status here.</p>
        ) : collapsed ? (
          <Tip
            content={
              <>
                <span className="tip-title">{site.name}</span>
                <span>{site.status}</span>
              </>
            }
          >
            {(trigger) => (
              <button
                {...trigger}
                type="button"
                className="rail-lamp"
                aria-label={`${site.name}, ${site.status}. Show the focused-site panel`}
                onClick={onToggle}
              >
                <StatusLamp status={site.status} />
              </button>
            )}
          </Tip>
        ) : (
          <FocusedSiteDetail site={site} sample={sample} />
        )}
      </div>
    </Panel>
  );
}

function FocusedSiteDetail({ site, sample }: { site: FocusedSiteView; sample: boolean }) {
  return (
    <div className="focus-full">
      <Card className="verdict" role="status">
        <StatusBadge status={site.status} size="lg" />
        <p className="verdict-text">
          {site.statusSentence}
          {site.unusedScore != null ? (
            <>
              {" "}
              Score <s>{formatNumber(site.unusedScore)}</s> is not used.
            </>
          ) : null}
        </p>
      </Card>

      {site.brokenRules.length > 0 ? (
        <section aria-labelledby="broken-rules-h" className="focus-section">
          <h3 id="broken-rules-h" className="focus-label">
            {site.brokenRules.length === 1 ? "Broken rule" : "Broken rules"}
          </h3>
          {site.brokenRules.map((rule) => (
            <BrokenRule key={rule.term} rule={rule} />
          ))}
        </section>
      ) : null}

      {site.passingRules.length > 0 ? (
        <section aria-labelledby="passing-rules-h" className="focus-section">
          <h3 id="passing-rules-h" className="focus-label">
            Rules that pass
          </h3>
          <ul className="passes">
            {site.passingRules.map((rule) => (
              <li key={rule.term}>
                <Check className="passes-icon" size={14} strokeWidth={2.6} aria-hidden="true" />
                <span>
                  <Explain term={rule.term}>{rule.name}</Explain>{" "}
                  <b>
                    <NumberUnit value={rule.value} unit={rule.unit} decimals={rule.decimals} />
                  </b>
                  , {rule.limit}
                </span>
                <ProvenanceTag provenance={rule.provenance} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <Disclosure
        title="Mission window metrics"
        meta={
          <>
            {site.metrics.length} values, <NumberUnit value={site.windowHours} unit="h" />
          </>
        }
      >
        <dl className="metrics">
          {site.metrics.map((metric) => (
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

      <nav className="focus-links" aria-label="Open this site elsewhere">
        <a href={site.links.quickmap} target="_blank" rel="noreferrer">
          Open in Quickmap
          <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
        </a>
        <a href={site.links.moonTrek} target="_blank" rel="noreferrer">
          Open in Moon Trek
          <ArrowUpRight size={12} strokeWidth={2} aria-hidden="true" />
        </a>
      </nav>

      {sample ? <p className="sample-mark">Sample values, not computed</p> : null}
    </div>
  );
}

function BrokenRule({ rule }: { rule: BrokenRuleView }) {
  const share = (n: number) => `${Math.min(Math.max((n / rule.scaleMax) * 100, 0), 100)}%`;
  return (
    <Card tone="nogo" className="broken">
      <div className="broken-row">
        <span className="broken-name">
          <StatusLamp status="NO-GO" />
          <Explain term={rule.term}>{rule.name}</Explain>
        </span>
        <NumberUnit className="broken-value" value={rule.value} unit={rule.unit} decimals={rule.decimals} display />
      </div>
      <p className="broken-text">
        Limit <NumberUnit value={rule.limit} unit={rule.unit} decimals={rule.decimals} />{" "}
        <ProvenanceTag provenance={rule.provenance} />. {rule.sentence}
      </p>
      <div className="meter" aria-hidden="true">
        <i style={{ width: share(rule.value) }} />
        <u style={{ left: share(rule.limit) }} />
      </div>
      <div className="meter-keys" aria-hidden="true">
        <span>
          <NumberUnit value={0} unit={rule.unit} />
        </span>
        <span className="meter-key-limit" style={{ left: share(rule.limit) }}>
          limit <NumberUnit value={rule.limit} unit={rule.unit} decimals={rule.decimals} />
        </span>
        <span>
          <NumberUnit value={rule.scaleMax} unit={rule.unit} decimals={rule.decimals} />
        </span>
      </div>
    </Card>
  );
}
