import { Box } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Explain } from "../components/Explain";
import { firstSentence } from "../components/format";
import { Panel } from "../components/Panel";
import { TabPanel, Tabs, type TabItem } from "../components/Tabs";
import { explanations } from "../lib/explain";
import { Countdowns, Timeline } from "../features/mission-control/site-detail";
import { FocusedSitePanel } from "./mission/focused-site-panel";
import { SAMPLE } from "./mission/sample";
import {
  loadShellLayout,
  saveShellLayout,
  shellColumns,
  shortcutPanel,
  toggleShellPanel,
  type ShellLayout,
  type ShellPanel,
} from "./mission/shell-layout";
import { SitesRail } from "./mission/sites-rail";
import { TopBar } from "./mission/top-bar";
import { DEFAULT_VIEW, VIEWS, type ViewId } from "./mission/views";

const FOOTER_LINE = "Planning aid, not flight certification. Limits marked assumed are our estimates.";

function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function isEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/** The collapsed state of the two side panels, remembered across reloads. */
function useShellLayout() {
  const [layout, setLayout] = useState<ShellLayout>(() => loadShellLayout(browserStorage()));
  useEffect(() => saveShellLayout(browserStorage(), layout), [layout]);
  return [layout, setLayout] as const;
}

const viewTabs: TabItem<ViewId>[] = VIEWS.map((view) => ({
  id: view.id,
  label: view.name,
  caption: view.caption,
  badge: view.is3d ? (
    <span className="badge-3d">
      <Box size={10} strokeWidth={1.8} aria-hidden="true" />
      3D
    </span>
  ) : undefined,
}));

export function MissionScreen() {
  const [layout, setLayout] = useShellLayout();
  const [view, setView] = useState<ViewId>(DEFAULT_VIEW);
  // SAMPLE: the focused site lives in the scenario store once MC3 lands.
  const [focusedSiteId, setFocusedSiteId] = useState<string | null>(SAMPLE.scenario.focusedSiteId);

  const regions = {
    sitesRail: useRef<HTMLElement>(null),
    focusPanel: useRef<HTMLElement>(null),
  };
  const toggles = {
    sitesRail: useRef<HTMLButtonElement>(null),
    focusPanel: useRef<HTMLButtonElement>(null),
  };

  // Fold or unfold a panel. If focus was inside it, it lands on the panel's own toggle,
  // which stays on screen in both states, so focus is never lost.
  const toggle = useCallback(
    (panel: ShellPanel) => {
      const hadFocus = regions[panel].current?.contains(document.activeElement) ?? false;
      setLayout((current) => toggleShellPanel(current, panel));
      if (hadFocus) requestAnimationFrame(() => toggles[panel].current?.focus());
    },
    // The refs inside `regions` and `toggles` are stable across renders.
    [setLayout],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const panel = shortcutPanel({
        key: event.key,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        altKey: event.altKey,
        inEditableField: isEditable(event.target),
      });
      if (!panel) return;
      event.preventDefault();
      toggle(panel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle]);

  const active = VIEWS.find((v) => v.id === view) ?? VIEWS[0];
  const scenario = { ...SAMPLE.scenario, focusedSiteId };
  const focused = focusedSiteId === SAMPLE.focused.id ? SAMPLE.focused : null;

  return (
    <div
      className="shell"
      style={{ gridTemplateColumns: shellColumns(layout) }}
      data-rail={layout.sitesRail.collapsed ? "collapsed" : "open"}
      data-focus={layout.focusPanel.collapsed ? "collapsed" : "open"}
    >
      <h1 className="sr-only">Mission Control</h1>
      <TopBar profileName={SAMPLE.profileName} profileDurationDays={SAMPLE.profileDurationDays} landingUtc={SAMPLE.scenario.landingUtc} />

      <SitesRail
        sites={SAMPLE.sites}
        maxSites={SAMPLE.maxSites}
        focusedSiteId={focusedSiteId}
        landingUtc={SAMPLE.scenario.landingUtc}
        onFocusSite={setFocusedSiteId}
        onAddSite={() => setView("map")}
        collapsed={layout.sitesRail.collapsed}
        onToggle={() => toggle("sitesRail")}
        regionRef={regions.sitesRail}
        toggleRef={toggles.sitesRail}
        sample
      />

      <Panel as="main" className="shell-main" aria-label="Main view">
        <Tabs idPrefix="view" label="Views" items={viewTabs} value={view} onChange={setView} />
        {active ? (
          <TabPanel idPrefix="view" id={active.id} className="view-body">
            <p className="view-what">
              {firstSentence(explanations[active.term]?.text ?? "")}{" "}
              <Explain term={active.term} label={active.name} />
            </p>
            <div className="view-stage">
              <active.Panel scenario={scenario} mode="mission" />
            </div>
          </TabPanel>
        ) : null}
      </Panel>

      <FocusedSitePanel
        site={focused}
        collapsed={layout.focusPanel.collapsed}
        onToggle={() => toggle("focusPanel")}
        regionRef={regions.focusPanel}
        toggleRef={toggles.focusPanel}
        sample
      />

      <Panel as="section" className="shell-strip" aria-label="Timeline and countdowns">
        <div className="strip-timeline">
          <Timeline scenario={scenario} mode="mission" />
        </div>
        <div className="strip-countdowns">
          <Countdowns scenario={scenario} mode="mission" />
        </div>
      </Panel>

      <footer className="shell-foot">
        <p>{FOOTER_LINE}</p>
      </footer>
    </div>
  );
}
