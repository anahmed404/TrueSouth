import { Eye } from "lucide-react";
import { memo, useCallback, useEffect, useRef, useState, type Ref } from "react";
import { Button } from "../components/Button";
import { firstSentence } from "../components/format";
import { Panel } from "../components/Panel";
import { explanations } from "../lib/explain";
import { selectScenario, selectView } from "../state/scenario";
import { Countdowns, Timeline, WhyDarkCard, type TimeWrite } from "./mission/timeline";
import { FloatingWindow } from "./mission/floating-window";
import { FocusedSitePanel } from "./mission/focused-site-panel";
import { ScenarioProvider, useScenario, useScenarioStore } from "./mission/scenario-context";
import { SceneSlot } from "./mission/scene-slot";
import { SpaceScene } from "../features/three/scene";
import {
  foldAnnouncement,
  loadShellLayout,
  saveShellLayout,
  shortcutPanel,
  toggleShellPanel,
  viewBarFitsBetween,
  type ShellLayout,
  type SidePanel,
} from "./mission/shell-layout";
import { useFreeSpace, usePhone, useReducedMotion, useViewportWidth } from "./mission/shell-hooks";
import { SitesRail } from "./mission/sites-rail";
import { TopBar } from "./mission/top-bar";
import { ViewBar, ViewSentence, windowElementId, type WindowButtons } from "./mission/view-bar";
import {
  HOME_CAMERA_VIEW,
  closeWindow,
  isCameraView,
  pickView,
  viewState,
  windowView,
  type CameraViewId,
  type ViewId,
  type ViewState,
  type WindowViewId,
} from "./mission/views";
import { escapeCloses } from "./mission/window-focus";

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

/** Which panels are folded, remembered across reloads. */
function useShellLayout() {
  const [layout, setLayout] = useState<ShellLayout>(() => loadShellLayout(browserStorage()));
  useEffect(() => saveShellLayout(browserStorage(), layout), [layout]);
  return [layout, setLayout] as const;
}

/**
 * The camera view and the open window, from the scenario's `view` (see `viewState`). The
 * camera view under a window is remembered here, in the page, not in the link.
 */
function useViewState(): ViewState {
  const view = useScenario(selectView);
  const [camera, setCamera] = useState<CameraViewId>(() => (isCameraView(view) ? view : HOME_CAMERA_VIEW));
  // Follow the scenario: a pick, Back and Forward, or a new link.
  if (isCameraView(view) && view !== camera) setCamera(view);
  return viewState(view, isCameraView(view) ? view : camera);
}

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

/**
 * Mission Control, space-first (docs/decisions/0013-space-first-mission-control.md): the
 * scene fills the window, and the app bar, the view bar, the side panels, the timeline and
 * any floating window float above it. The floating layout is a CSS grid over the whole
 * window; the empty cell in its middle is the free space the scene reads.
 */
function MissionShell() {
  const store = useScenarioStore();
  const [layout, setLayout] = useShellLayout();
  const phone = usePhone();
  const reduceMotion = useReducedMotion();
  const viewportWidth = useViewportWidth();
  const state = useViewState();
  const windowOpen = state.window !== null;

  // ── Folding ──────────────────────────────────────────────────────────────
  const [announcement, setAnnouncement] = useState("");
  const regions = { sitesRail: useRef<HTMLElement>(null), focusPanel: useRef<HTMLElement>(null) };
  const toggles = { sitesRail: useRef<HTMLButtonElement>(null), focusPanel: useRef<HTMLButtonElement>(null) };
  const strip = useRef<HTMLElement>(null);

  // Fold or unfold a side panel. If focus was inside it, it lands on the panel's own toggle,
  // which stays on screen in both states, so focus is never lost.
  const toggle = useCallback(
    (panel: SidePanel) => {
      const hadFocus = regions[panel].current?.contains(document.activeElement) ?? false;
      setLayout((current) => {
        const next = toggleShellPanel(current, panel);
        setAnnouncement(foldAnnouncement(panel, next[panel].collapsed));
        return next;
      });
      if (hadFocus) requestAnimationFrame(() => toggles[panel].current?.focus());
    },
    // The refs inside `regions` and `toggles` are stable across renders.
    [setLayout],
  );
  const toggleRail = useCallback(() => toggle("sitesRail"), [toggle]);
  const toggleFocus = useCallback(() => toggle("focusPanel"), [toggle]);
  // Folding swaps the strip's content; if focus was in it, it lands on the new fold button.
  const toggleTimeline = useCallback(() => {
    const hadFocus = strip.current?.contains(document.activeElement) ?? false;
    setLayout((current) => {
      const next = toggleShellPanel(current, "timeline");
      setAnnouncement(foldAnnouncement("timeline", next.timeline.collapsed));
      return next;
    });
    if (hadFocus) requestAnimationFrame(() => strip.current?.querySelector<HTMLButtonElement>(".tl-fold")?.focus());
  }, [setLayout]);

  // ── The phone's two sheets: the sites rail, and the focused site expanded ──
  const [sitesSheet, setSitesSheet] = useState(false);
  const [focusSheet, setFocusSheet] = useState(false);
  const focusedSiteId = useScenario((s) => s.focusedSiteId);
  useEffect(() => setSitesSheet(false), [focusedSiteId]);
  const toggleSitesSheet = useCallback(() => {
    setSitesSheet((open) => !open);
    setFocusSheet(false);
  }, []);
  const toggleFocusSheet = useCallback(() => {
    setFocusSheet((open) => !open);
    setSitesSheet(false);
  }, []);

  // ── Views and windows ────────────────────────────────────────────────────
  const windowButtons: WindowButtons = useRef({});
  const closedByUser = useRef(false);
  const pick = useCallback(
    (picked: ViewId) => {
      closedByUser.current = false;
      store.getState().setView(pickView(state, picked));
    },
    [store, state],
  );
  const closeOpenWindow = useCallback(() => {
    closedByUser.current = true;
    store.getState().setView(closeWindow(state));
  }, [store, state]);
  const setCameraView = useCallback((view: CameraViewId) => pick(view), [pick]);
  const focusSite = useCallback((siteId: string) => store.getState().focusSite(siteId), [store]);

  // ── Keys: [ and ] fold the side panels; Escape closes a window ───────────
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const what = escapeCloses({
          popoverOpen: document.querySelector(".popover:popover-open") !== null,
          tipOpen: document.querySelector(".tip-bubble:not([hidden])") !== null,
          windowOpen,
          inEditableField: isEditable(event.target),
        });
        if (what === "window") {
          event.preventDefault();
          closeOpenWindow();
        }
        return;
      }
      if (phone) return;
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
  }, [toggle, windowOpen, closeOpenWindow, phone]);

  // ── The free space ───────────────────────────────────────────────────────
  const gapRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLElement>(null);
  const railCollapsed = phone ? false : layout.sitesRail.collapsed;
  const focusCollapsed = phone ? !focusSheet : layout.focusPanel.collapsed;
  // What floats over the gap: the open window, and on a phone an open sheet.
  const covers = [
    ...(windowOpen ? [windowRef] : []),
    ...(phone && sitesSheet ? [regions.sitesRail] : []),
    ...(phone && focusSheet ? [regions.focusPanel] : []),
  ];
  const coverKey = `${state.window ?? ""}|${phone && sitesSheet ? "sites" : ""}|${phone && focusSheet ? "focus" : ""}`;
  const freeSpace = useFreeSpace(gapRef, covers, windowOpen, coverKey);

  const scenario = useScenario(selectScenario);
  const timelineFolded = phone ? false : layout.timeline.collapsed;
  const topSpans = !phone && !viewBarFitsBetween(viewportWidth, layout);

  return (
    <div
      className="mc"
      data-top={topSpans ? "span" : "between"}
      data-rail={railCollapsed ? "collapsed" : "open"}
      data-focus={focusCollapsed ? "collapsed" : "open"}
      data-timeline={timelineFolded ? "folded" : "open"}
      data-sites-sheet={sitesSheet ? "open" : "closed"}
      data-window={state.window ?? "none"}
    >
      <h1 className="sr-only">Mission Control</h1>
      <TopBar />

      <ViewBar state={state} onPick={pick} windowButtons={windowButtons} />
      <ViewSentence camera={state.camera} />

      <SitesRail
        collapsed={railCollapsed}
        onToggle={phone ? toggleSitesSheet : toggleRail}
        regionRef={regions.sitesRail}
        toggleRef={toggles.sitesRail}
      />

      <SceneSlot
        Scene={SpaceScene}
        view={state.camera}
        scenario={scenario}
        freeSpace={freeSpace}
        reduceMotion={reduceMotion}
        onFocusSite={focusSite}
        onViewChange={setCameraView}
      />

      <div ref={gapRef} className="mc-gap" aria-hidden="true" />

      <FootStack camera={state.camera} hidden={windowOpen} onShowLandersEye={() => pick("panorama")} />

      <FocusedSitePanel
        collapsed={focusCollapsed}
        onToggle={phone ? toggleFocusSheet : toggleFocus}
        regionRef={regions.focusPanel}
        toggleRef={toggles.focusPanel}
        sheet={
          phone
            ? {
                actions: (
                  <Button className="sheet-sites" aria-expanded={sitesSheet} aria-controls="sites-rail" onClick={toggleSitesSheet}>
                    Sites
                  </Button>
                ),
              }
            : undefined
        }
      />

      {state.window ? (
        <OpenWindow
          key={state.window}
          id={state.window}
          windowRef={windowRef}
          onClose={closeOpenWindow}
          windowButtons={windowButtons}
          closedByUser={closedByUser}
        />
      ) : null}

      <TimelineStrip folded={timelineFolded} compact={phone} onToggleFold={toggleTimeline} regionRef={strip} />

      <footer className="mc-foot">
        <p className="plate">{FOOTER_LINE}</p>
      </footer>

      <p className="sr-only" role="status">
        {announcement}
      </p>
    </div>
  );
}

type OpenWindowProps = {
  id: WindowViewId;
  windowRef: Ref<HTMLElement>;
  onClose: () => void;
  windowButtons: WindowButtons;
  closedByUser: { current: boolean };
};

/** The open floating window, with its placeholder content until MC7 (Slip Planner) and MC9 (Compare). */
const OpenWindow = memo(function OpenWindow({ id, windowRef, onClose, windowButtons, closedByUser }: OpenWindowProps) {
  const view = windowView(id);
  const scenario = useScenario(selectScenario);
  const button = useCallback(() => windowButtons.current[id] ?? null, [windowButtons, id]);
  return (
    <FloatingWindow
      ref={windowRef}
      id={windowElementId(id)}
      title={view.name}
      closeLabel={id === "slip" ? "Close the Slip Planner" : "Close Compare"}
      description={firstSentence(explanations[view.term]?.text ?? "")}
      onClose={onClose}
      button={button}
      closedByUser={closedByUser}
    >
      <view.Panel scenario={scenario} mode="mission" />
    </FloatingWindow>
  );
});

/**
 * The foot of the free space: on a dark or blackout hour, the "Why is it dark?" card on a
 * solid panel, with a way to see it from Lander's eye (docs/features/site-detail.md, "Where
 * the card sits"). Each camera view's own controls will sit here too, when their packages
 * build them. Hidden while a window is open: the card is never in a window.
 */
const FootStack = memo(function FootStack({
  camera,
  hidden,
  onShowLandersEye,
}: {
  camera: CameraViewId;
  hidden: boolean;
  onShowLandersEye: () => void;
}) {
  const scenario = useScenario(selectScenario);
  return (
    <div className="mc-foot-stack" hidden={hidden}>
      <div className="panel why-float">
        <WhyDarkCard scenario={scenario} mode="mission" hideWhenLit />
        {camera === "panorama" ? null : (
          <Button className="why-float-go" icon={<Eye size={14} strokeWidth={1.8} aria-hidden="true" />} onClick={onShowLandersEye}>
            See it from Lander's eye
          </Button>
        )}
      </div>
    </div>
  );
});

type TimelineStripProps = { folded: boolean; compact: boolean; onToggleFold: () => void; regionRef: Ref<HTMLElement> };

/** The bottom strip: the timeline and the two countdown cards. Folded, one row; on a phone, the compact strip. */
const TimelineStrip = memo(function TimelineStrip({ folded, compact, onToggleFold, regionRef }: TimelineStripProps) {
  const store = useScenarioStore();
  const scenario = useScenario(selectScenario);
  const onTimeChange = useCallback(
    (utc: string, write: TimeWrite) => store.getState().setCurrentTime(utc, write),
    [store],
  );
  return (
    <Panel
      as="section"
      ref={regionRef}
      className="shell-strip"
      data-folded={folded}
      data-compact={compact}
      aria-label="Timeline and countdowns"
    >
      <div className="strip-timeline">
        <Timeline
          scenario={scenario}
          mode="mission"
          folded={folded}
          compact={compact}
          onToggleFold={compact ? undefined : onToggleFold}
          onTimeChange={onTimeChange}
        />
      </div>
      {folded || compact ? null : (
        <div className="strip-countdowns">
          <Countdowns scenario={scenario} mode="mission" />
        </div>
      )}
    </Panel>
  );
});
