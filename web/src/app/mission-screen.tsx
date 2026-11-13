import { Eye } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useRef, useState, type Ref } from "react";
import { Button } from "../components/Button";
import { firstSentence } from "../components/format";
import { Panel } from "../components/Panel";
import LandersEye from "../features/panorama";
import { explanations } from "../lib/explain";
import { selectScenario } from "../state/scenario";
import { Countdowns, Timeline, WhyDarkLine, type TimeWrite } from "./mission/timeline";
import { FloatingWindow } from "./mission/floating-window";
import { FocusedSitePanel } from "./mission/focused-site-panel";
import { LandingDateControl } from "./mission/landing-date-control";
import { ScenarioProvider, useScenario, useScenarioStore } from "./mission/scenario-context";
import { windowPlacement, type Rect, type ShellState } from "./mission/free-space";
import { SceneSlot } from "./mission/scene-slot";
import { SpaceScene } from "../features/three/scene";
import { LandingDatePanel, SlipPlannerScene, slipStore, type LandingWrite } from "../features/mission-control/slip-planner";
import type { SceneProjector } from "./scene";
import { useStore } from "zustand";
import { TRY_AGAIN_ANNOUNCEMENT } from "./mission/scene-status";
import {
  OVERLAY_SELECTOR,
  foldAnnouncement,
  loadShellLayout,
  saveShellLayout,
  shortcutPanel,
  toggleShellPanel,
  viewBarFitsBetween,
  type ShellLayout,
  type SidePanel,
} from "./mission/shell-layout";
import { rectOf, useFreeSpace, usePhone, useReducedMotion, useViewportWidth } from "./mission/shell-hooks";
import { SitesRail } from "./mission/sites-rail";
import { TopBar } from "./mission/top-bar";
import { ViewBar, ViewNotices, windowElementId, type WindowButtons } from "./mission/view-bar";
import { windowView, type CameraViewId, type WindowViewId } from "./mission/views";
import { useViewCommands, useViewState } from "./mission/view-state";
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
  const commands = useViewCommands(state);
  const windowOpen = state.window !== null;
  const shellRef = useRef<HTMLDivElement>(null);

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
  const sheet = useMemo(
    () =>
      phone
        ? {
            actions: (
              <Button className="sheet-sites" aria-expanded={sitesSheet} aria-controls="sites-rail" onClick={toggleSitesSheet}>
                Sites
              </Button>
            ),
          }
        : undefined,
    [phone, sitesSheet, toggleSitesSheet],
  );

  // ── Views, windows and the scene's requests ──────────────────────────────
  const windowButtons: WindowButtons = useRef({});
  const closedByUser = useRef(false);
  const { pick } = commands;
  const closeOpenWindow = useCallback(() => {
    closedByUser.current = true;
    commands.close();
  }, [commands]);
  const showLandersEye = useCallback(() => pick("panorama"), [pick]);
  const showSystemView = useCallback(() => pick("system"), [pick]);
  const setCameraView = useCallback((view: CameraViewId) => pick(view), [pick]);
  const focusSite = useCallback((siteId: string) => store.getState().focusSite(siteId), [store]);
  const addSite = useCallback((siteId: string) => store.getState().addSite(siteId), [store]);
  // "Try 3D anyway" removes its own button: say so, and put focus on the current view.
  const tryAgain = useCallback(() => {
    setAnnouncement(TRY_AGAIN_ANNOUNCEMENT);
    requestAnimationFrame(() => shellRef.current?.querySelector<HTMLElement>('.view-bar-item[aria-current="true"]')?.focus());
  }, []);

  // ── Keys: [ and ] fold the side panels; Escape closes a window ───────────
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const popoverOpen = document.querySelector(".popover:popover-open") !== null;
      if (event.key === "Escape") {
        const what = escapeCloses({
          popoverOpen,
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
        inOverlay: popoverOpen || (event.target instanceof Element && event.target.closest(OVERLAY_SELECTOR) !== null),
      });
      if (!panel) return;
      event.preventDefault();
      toggle(panel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toggle, windowOpen, closeOpenWindow, phone]);

  // ── The free space ───────────────────────────────────────────────────────
  const topRef = useRef<HTMLDivElement>(null);
  const footRef = useRef<HTMLDivElement>(null);
  const windowRef = useRef<HTMLElement>(null);
  const railCollapsed = phone ? false : layout.sitesRail.collapsed;
  const focusCollapsed = phone ? !focusSheet : layout.focusPanel.collapsed;
  const timelineFolded = phone ? false : layout.timeline.collapsed;
  const topSpans = !phone && !viewBarFitsBetween(viewportWidth, layout);
  const placement = windowPlacement(viewportWidth, layout, phone);

  // The layout state, read when the free space is measured.
  const shell = useRef({ phone, layout, windowOpen, sitesSheet, focusSheet });
  shell.current = { phone, layout, windowOpen, sitesSheet, focusSheet };
  const readShell = useCallback((): ShellState | null => {
    const { phone: onPhone, layout: now, windowOpen: open, sitesSheet: sitesOpen, focusSheet: focusOpen } = shell.current;
    const top = topRef.current;
    const timeline = strip.current;
    if (!top || !timeline) return null;
    const focusNode = regions.focusPanel.current;
    const railNode = regions.sitesRail.current;
    // The foot stack's own plate, not the one inside Lander's eye's panel.
    const plate = footRef.current?.querySelector(":scope > .why-line");
    const covers: Rect[] = [];
    if (open && windowRef.current) covers.push(rectOf(windowRef.current));
    if (plate) covers.push(rectOf(plate));
    if (onPhone && sitesOpen && railNode) covers.push(rectOf(railNode));
    if (onPhone && focusOpen && focusNode) covers.push(rectOf(focusNode));
    const belowTops = [rectOf(timeline).y];
    // In Lander's eye the horizon chart's panel ends the free space above it, open or folded.
    // The foot stack is measured, not the panel: the panel rises as the chart opens, while the
    // stack is already where the panel ends up, so the camera reframes once, with no jump.
    const foot = footRef.current;
    // While a window is open the foot stack is hidden and measures as zero: leave it out.
    if (!open && foot?.querySelector(".pano-panel")) belowTops.push(rectOf(foot).y);
    if (onPhone && !focusOpen && focusNode) belowTops.push(rectOf(focusNode).y);
    return {
      viewport: { width: window.innerWidth, height: window.innerHeight },
      phone: onPhone,
      folded: { sitesRail: now.sitesRail.collapsed, focusPanel: now.focusPanel.collapsed },
      windowOpen: open,
      topBottom: rectOf(top).y + rectOf(top).height,
      belowTops,
      covers,
    };
    // The refs inside `regions` are stable across renders.
  }, []);
  const watched = [topRef, strip, footRef, windowRef, regions.focusPanel, regions.sitesRail];
  const measureKey = [
    phone,
    layout.sitesRail.collapsed,
    layout.focusPanel.collapsed,
    layout.timeline.collapsed,
    state.camera,
    state.window ?? "",
    sitesSheet,
    focusSheet,
  ].join("|");
  const freeSpace = useFreeSpace(readShell, watched, measureKey);

  const scenario = useScenario(selectScenario);

  // ── The Slip Planner: spots over the scene, landing dates in the timeline's slot ──
  const slip = state.camera === "slip";
  const [projector, setProjector] = useState<SceneProjector | null>(null);
  const slipShading = useStore(slipStore, (s) => s.shading);
  useEffect(() => {
    if (!slip) slipStore.getState().leave();
  }, [slip]);
  const openMap = useCallback(() => pick("map"), [pick]);

  return (
    <div
      ref={shellRef}
      className="mc"
      data-top={topSpans ? "span" : "between"}
      data-rail={railCollapsed ? "collapsed" : "open"}
      data-focus={focusCollapsed ? "collapsed" : "open"}
      data-timeline={timelineFolded ? "folded" : "open"}
      data-sites-sheet={sitesSheet ? "open" : "closed"}
      data-window={state.window ?? "none"}
      data-window-place={placement}
    >
      <h1 className="sr-only">Mission Control</h1>
      <TopBar />

      <ViewBar state={state} onPick={pick} windowButtons={windowButtons} />
      <ViewNotices ref={topRef} />

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
        onAddSite={addSite}
        onTryAgain={tryAgain}
        onProjector={setProjector}
        slipShading={slipShading}
      >
        {slip
          ? (scene) => (
              <SlipPlannerScene
                projector={projector}
                mode={scene.mode}
                canTryAgain={scene.canTryAgain}
                onTryAgain={scene.tryAgain}
                freeSpace={freeSpace}
                scenario={scenario}
                phone={phone}
                onFocusSite={focusSite}
              />
            )
          : undefined}
      </SceneSlot>

      <FootStack
        ref={footRef}
        camera={state.camera}
        hidden={windowOpen || slip}
        onShowLandersEye={showLandersEye}
        onShowSystemView={showSystemView}
      />

      <FocusedSitePanel
        collapsed={focusCollapsed}
        onToggle={phone ? toggleFocusSheet : toggleFocus}
        regionRef={regions.focusPanel}
        toggleRef={toggles.focusPanel}
        sheet={sheet}
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

      <TimelineStrip folded={timelineFolded} compact={phone} onToggleFold={toggleTimeline} regionRef={strip} slip={slip} onOpenMap={openMap} />

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

/** The open floating window, with its placeholder content until MC9 (Compare). */
const OpenWindow = memo(function OpenWindow({ id, windowRef, onClose, windowButtons, closedByUser }: OpenWindowProps) {
  const view = windowView(id);
  const scenario = useScenario(selectScenario);
  const button = useCallback(() => windowButtons.current[id] ?? null, [windowButtons, id]);
  return (
    <FloatingWindow
      ref={windowRef}
      id={windowElementId(id)}
      title={view.name}
      closeLabel="Close Compare"
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
 * The foot of the free space: on a dark or blackout hour, one plate with the short reason for
 * the Sun and for Earth, and "Why?" opening the full "Why is it dark?" card above it
 * (docs/features/site-detail.md, "Where the card sits"). Each camera view's own controls will
 * sit here too, when their packages build them. Hidden while a window is open (the card is
 * never in a window) and on the phone, as in the prototype.
 */
const FootStack = memo(function FootStack({
  camera,
  hidden,
  onShowLandersEye,
  onShowSystemView,
  ref,
}: {
  camera: CameraViewId;
  hidden: boolean;
  onShowLandersEye: () => void;
  onShowSystemView: () => void;
  ref?: Ref<HTMLDivElement>;
}) {
  const scenario = useScenario(selectScenario);
  return (
    <div ref={ref} className="mc-foot-stack" data-view={camera} hidden={hidden}>
      {camera === "panorama" ? (
        <LandersEye scenario={scenario} mode="mission" onShowSystemView={onShowSystemView} />
      ) : (
        <WhyDarkLine
          scenario={scenario}
          mode="mission"
          extra={(close) => (
            <Button
              className="why-pop-go"
              icon={<Eye size={14} strokeWidth={1.8} aria-hidden="true" />}
              onClick={() => {
                close();
                onShowLandersEye();
              }}
            >
              See it from Lander's eye
            </Button>
          )}
        />
      )}
    </div>
  );
});

type TimelineStripProps = {
  folded: boolean;
  compact: boolean;
  onToggleFold: () => void;
  regionRef: Ref<HTMLElement>;
  /** In the Slip Planner the slot holds the landing-date panel instead (slip-planner.md). */
  slip: boolean;
  onOpenMap: () => void;
};

/**
 * The bottom strip: the landing date at the left of the timeline, the timeline and the two
 * countdown cards. Folded, one row; on a phone, the compact strip. In the Slip Planner it
 * swaps to the landing-date panel; the two never stack.
 */
const TimelineStrip = memo(function TimelineStrip({ folded, compact, onToggleFold, regionRef, slip, onOpenMap }: TimelineStripProps) {
  const store = useScenarioStore();
  const scenario = useScenario(selectScenario);
  const onTimeChange = useCallback(
    (utc: string, write: TimeWrite) => store.getState().setCurrentTime(utc, write),
    [store],
  );
  const onLandingChange = useCallback(
    (utc: string, write: LandingWrite) => store.getState().setLandingDate(utc, write),
    [store],
  );
  const onFocusSite = useCallback((siteId: string) => store.getState().focusSite(siteId), [store]);
  if (slip) {
    return (
      <Panel
        as="section"
        ref={regionRef}
        className="shell-strip"
        data-folded={folded}
        data-compact={compact}
        data-slip="true"
        aria-label="Landing dates"
      >
        <LandingDatePanel
          scenario={scenario}
          folded={folded}
          compact={compact}
          onToggleFold={compact ? undefined : onToggleFold}
          onLandingChange={onLandingChange}
          onFocusSite={onFocusSite}
          onOpenMap={onOpenMap}
        />
      </Panel>
    );
  }
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
          landing={<LandingDateControl />}
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
