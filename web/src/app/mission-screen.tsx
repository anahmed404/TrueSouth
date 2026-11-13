import { Box } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState } from "react";
import { Explain } from "../components/Explain";
import { firstSentence } from "../components/format";
import { Panel } from "../components/Panel";
import { TabPanel, Tabs, type TabItem } from "../components/Tabs";
import { explanations } from "../lib/explain";
import { selectScenario, selectView } from "../state/scenario";
import { Countdowns, Timeline } from "../features/mission-control/site-detail";
import { FocusedSitePanel } from "./mission/focused-site-panel";
import { NoticeStrip } from "./mission/notice-strip";
import { ScenarioProvider, useScenario, useScenarioStore } from "./mission/scenario-context";
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
import { VIEWS, type ViewId } from "./mission/views";

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
  return (
    <ScenarioProvider
      loading={
        <div className="shell-wait" role="status">
          <p>Loading the site catalog and mission profiles…</p>
        </div>
      }
      error={(message) => (
        <div className="shell-wait" role="alert">
          <p className="shell-wait-title">Mission Control could not load its data.</p>
          <p>{message}</p>
        </div>
      )}
    >
      <MissionShell />
    </ScenarioProvider>
  );
}

function MissionShell() {
  const [layout, setLayout] = useShellLayout();

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
  const toggleRail = useCallback(() => toggle("sitesRail"), [toggle]);
  const toggleFocus = useCallback(() => toggle("focusPanel"), [toggle]);

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

  return (
    <div
      className="shell"
      style={{ gridTemplateColumns: shellColumns(layout) }}
      data-rail={layout.sitesRail.collapsed ? "collapsed" : "open"}
      data-focus={layout.focusPanel.collapsed ? "collapsed" : "open"}
    >
      <h1 className="sr-only">Mission Control</h1>
      <TopBar />

      <SitesRail
        collapsed={layout.sitesRail.collapsed}
        onToggle={toggleRail}
        regionRef={regions.sitesRail}
        toggleRef={toggles.sitesRail}
      />

      <MainView />

      <FocusedSitePanel
        collapsed={layout.focusPanel.collapsed}
        onToggle={toggleFocus}
        regionRef={regions.focusPanel}
        toggleRef={toggles.focusPanel}
      />

      <TimelineStrip />

      <footer className="shell-foot">
        <p>{FOOTER_LINE}</p>
      </footer>
    </div>
  );
}

/** The view tabs and the open view. The views are still placeholders (MC5 onwards). */
const MainView = memo(function MainView() {
  const store = useScenarioStore();
  const view = useScenario(selectView);
  const scenario = useScenario(selectScenario);
  const setView = useCallback((id: ViewId) => store.getState().setView(id), [store]);
  const active = VIEWS.find((v) => v.id === view) ?? VIEWS[0];

  return (
    <Panel as="main" className="shell-main" aria-label="Main view">
      <NoticeStrip />
      <Tabs idPrefix="view" label="Views" items={viewTabs} value={view} onChange={setView} />
      {active ? (
        <TabPanel idPrefix="view" id={active.id} className="view-body">
          <p className="view-what">
            {firstSentence(explanations[active.term]?.text ?? "")} <Explain term={active.term} label={active.name} />
          </p>
          <div className="view-stage">
            <active.Panel scenario={scenario} mode="mission" />
          </div>
        </TabPanel>
      ) : null}
    </Panel>
  );
});

const TimelineStrip = memo(function TimelineStrip() {
  const scenario = useScenario(selectScenario);
  return (
    <Panel as="section" className="shell-strip" aria-label="Timeline and countdowns">
      <div className="strip-timeline">
        <Timeline scenario={scenario} mode="mission" />
      </div>
      <div className="strip-countdowns">
        <Countdowns scenario={scenario} mode="mission" />
      </div>
    </Panel>
  );
});
