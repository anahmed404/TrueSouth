import { PanelLeftClose, PanelLeftOpen, Plus } from "lucide-react";
import type { Ref } from "react";
import { Button, IconButton } from "../../components/Button";
import { Explain } from "../../components/Explain";
import { formatUtc } from "../../components/format";
import { Panel } from "../../components/Panel";
import { StatusBadge, StatusLamp, type Status } from "../../components/StatusLamp";
import { Tip } from "../../components/Tip";
import { SHELL_SHORTCUTS } from "./shell-layout";

/** One row of the sites rail. */
export type SiteRowView = {
  id: string;
  name: string;
  status: Status;
  /** One fact: the broken rule, or the score. */
  fact: string;
  /** A third line, for example "Terrain not modelled" for a sphere-tier site. */
  note?: string;
};

type SitesRailProps = {
  sites: readonly SiteRowView[];
  maxSites: number;
  focusedSiteId: string | null;
  landingUtc: string;
  onFocusSite: (id: string) => void;
  onAddSite: () => void;
  collapsed: boolean;
  onToggle: () => void;
  /** True while the rows are sample data. */
  sample?: boolean;
  regionRef?: Ref<HTMLElement>;
  toggleRef?: Ref<HTMLButtonElement>;
};

const REGION_ID = "sites-rail";

/**
 * The left rail: the selected sites, each with its status for the current landing date.
 * Collapsed, it keeps a slim column of status lamps, so the GO/NO-GO picture stays on
 * screen, and each lamp still focuses its site.
 */
export function SitesRail({
  sites,
  maxSites,
  focusedSiteId,
  landingUtc,
  onFocusSite,
  onAddSite,
  collapsed,
  onToggle,
  sample = false,
  regionRef,
  toggleRef,
}: SitesRailProps) {
  const toggleLabel = collapsed ? "Show the sites rail" : "Hide the sites rail";

  return (
    <Panel
      as="aside"
      ref={regionRef}
      id={REGION_ID}
      aria-label="Selected sites"
      className="shell-rail"
      data-collapsed={collapsed}
    >
      <div className="rail-head">
        {collapsed ? null : (
          <h2 className="rail-title">
            <Explain term="selected_sites">Selected sites</Explain>
          </h2>
        )}
        {collapsed ? null : (
          <span className="rail-count">
            {sites.length} of {maxSites}
          </span>
        )}
        <IconButton
          ref={toggleRef}
          label={toggleLabel}
          hint={`· shortcut ${SHELL_SHORTCUTS.sitesRail}`}
          aria-expanded={!collapsed}
          aria-controls={`${REGION_ID}-body`}
          aria-keyshortcuts={SHELL_SHORTCUTS.sitesRail}
          icon={collapsed ? <PanelLeftOpen size={16} strokeWidth={1.8} /> : <PanelLeftClose size={16} strokeWidth={1.8} />}
          onClick={onToggle}
          className="shell-toggle"
        />
      </div>

      <div id={`${REGION_ID}-body`} className="rail-body">
        {collapsed ? (
          <ul className="rail-lamps" aria-label="Site status">
            {sites.map((site) => (
              <li key={site.id}>
                <Tip
                  content={
                    <>
                      <span className="tip-title">{site.name}</span>
                      <span>
                        {site.status} · {site.fact}
                      </span>
                    </>
                  }
                >
                  {(trigger) => (
                    <button
                      {...trigger}
                      type="button"
                      className="rail-lamp"
                      aria-label={`${site.name}, ${site.status}`}
                      aria-current={site.id === focusedSiteId ? "true" : undefined}
                      onClick={() => onFocusSite(site.id)}
                    >
                      <StatusLamp status={site.status} />
                    </button>
                  )}
                </Tip>
              </li>
            ))}
          </ul>
        ) : (
          <div className="rail-full">
            <p className="rail-sub">Status if landing {formatUtc(landingUtc)}</p>
            {sites.length === 0 ? (
              <p className="rail-empty">No sites yet. Add one, or pick one on the Polar map.</p>
            ) : null}
            <ul className="rail-sites">
              {sites.map((site) => (
                <li key={site.id}>
                  <button
                    type="button"
                    className="site-row"
                    aria-current={site.id === focusedSiteId ? "true" : undefined}
                    onClick={() => onFocusSite(site.id)}
                  >
                    <span className="site-name">{site.name}</span>
                    <span className="site-line">
                      <StatusBadge status={site.status} />
                      <span>{site.fact}</span>
                    </span>
                    {site.note ? <span className="site-note">{site.note}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
            <Button
              size="md"
              className="rail-add"
              icon={<Plus size={16} strokeWidth={1.8} aria-hidden="true" />}
              onClick={onAddSite}
              disabled={sites.length >= maxSites}
            >
              Add site
            </Button>
            {sample ? <p className="sample-mark">Sample sites, not computed</p> : null}
          </div>
        )}
      </div>
    </Panel>
  );
}
