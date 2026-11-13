import { LoaderCircle } from "lucide-react";
import { memo, useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Button } from "../../components/Button";
import { useSites, type HookResult } from "../../data/hooks";
import { evaluationsAtUtcMidnight, useSweep, type DayResult } from "../../lib/scoring";
import { movedText, nextGoView, undoneText } from "./landing-control";
import { useScenario, useScenarioStore } from "./scenario-context";
import { siteName } from "./site-status";

/** How long the "Landing moved" note stays when nothing is pointing at it or focused in it. */
const NOTE_MS = 15_000;

/**
 * "Next GO": moves the landing date to the next day, after the current landing date's day,
 * on which the focused site is GO for the current mission profile. It reads the slip sweep's
 * 00:00 UTC landings (the Slip Planner's whole-days rule) through `nextGoDay`, so it adds no
 * scoring. Not shown when no site is focused.
 */
export const NextGoButton = memo(function NextGoButton() {
  const siteId = useScenario((s) => s.focusedSiteId);
  if (!siteId) return null;
  return <NextGoFor siteId={siteId} />;
});

/** One jump: where it went, what Undo restores, and the site and profile it was for. */
type Moved = {
  toUtc: string;
  from: { landingUtc: string; currentUtc: string };
  text: string;
  siteId: string;
  profile: object;
};

function NextGoFor({ siteId }: { siteId: string }) {
  const store = useScenarioStore();
  const profile = useScenario((s) => s.profile);
  const landingUtc = useScenario((s) => s.landingUtc);
  const grid = useScenario((s) => s.catalog.grid);
  const sites = useSites();
  const name = siteName(sites.status === "ready" ? sites.data.find((s) => s.id === siteId) : null, siteId);

  // The sweep's statuses at 00:00 UTC each day: the Slip Planner's whole-days rule.
  const sweep = useSweep(siteId, profile);
  const sweepData = sweep.data;
  const rows = useMemo(() => (sweepData ? evaluationsAtUtcMidnight(sweepData, profile) : null), [sweepData, profile]);
  const days: HookResult<ArrayLike<DayResult>> =
    sweep.status === "ready" && rows ? { status: "ready", data: rows, error: null } : sweep.status === "error" ? sweep : { status: "loading", data: null, error: null };
  const view = nextGoView({ siteId, siteName: name, days, landingUtc, grid });

  const buttonRef = useRef<HTMLButtonElement>(null);
  const descriptionId = useId();
  const [moved, setMoved] = useState<Moved | null>(null);
  // What the polite status line says, and the landing date, site and profile it is about.
  const [announcement, setAnnouncement] = useState<{ text: string; landingUtc: string; siteId: string; profile: object | null }>({
    text: "",
    landingUtc: "",
    siteId: "",
    profile: null,
  });

  // The note and the status line are about one jump for one site and one profile: any other
  // change of the landing date, the focused site or the mission profile ends them, so Undo is
  // never offered for a site or profile it was not about.
  useEffect(() => {
    if (moved && (moved.toUtc !== landingUtc || moved.siteId !== siteId || moved.profile !== profile)) setMoved(null);
    if (announcement.text && (announcement.landingUtc !== landingUtc || announcement.siteId !== siteId || announcement.profile !== profile)) {
      setAnnouncement({ text: "", landingUtc: "", siteId: "", profile: null });
    }
  }, [moved, announcement, landingUtc, siteId, profile]);

  const jump = () => {
    if (view.kind !== "ready") return;
    const state = store.getState();
    const from = { landingUtc: state.landingUtc, currentUtc: state.currentUtc };
    state.setLandingDate(view.targetUtc);
    const text = movedText(view.targetUtc, name);
    setMoved({ toUtc: view.targetUtc, from, text, siteId, profile });
    setAnnouncement({ text, landingUtc: view.targetUtc, siteId, profile });
  };

  // Closing the note never strands focus: if it was inside, it lands on "Next GO".
  const closeNote = useCallback(() => {
    const hadFocus = document.activeElement?.closest(".ldc-note") != null;
    setMoved(null);
    if (hadFocus) requestAnimationFrame(() => buttonRef.current?.focus());
  }, []);

  const undo = () => {
    if (!moved) return;
    const state = store.getState();
    state.setLandingDate(moved.from.landingUtc);
    // The scrubber keeps its offset from the landing, so this is usually already true; a
    // jump near the end of the grid clamps it, and Undo puts it back exactly (tested).
    state.setCurrentTime(moved.from.currentUtc, "replace");
    setMoved(null);
    setAnnouncement({ text: undoneText(moved.from.landingUtc), landingUtc: moved.from.landingUtc, siteId, profile });
    requestAnimationFrame(() => buttonRef.current?.focus());
  };

  return (
    <span className="ldc-next">
      {view.kind === "hidden" ? null : view.kind === "none" ? (
        <span className="ldc-none" title={view.description}>
          {view.text}
        </span>
      ) : (
        <>
          <Button
            ref={buttonRef}
            className="ldc-go"
            icon={view.kind === "working" ? <LoaderCircle className="ldc-spin" size={14} strokeWidth={2} aria-hidden="true" /> : undefined}
            onClick={jump}
            disabled={view.kind !== "ready"}
            aria-busy={view.kind === "working" || undefined}
            aria-describedby={descriptionId}
            title={view.description}
          >
            Next GO
          </Button>
          {/* Read as the button's description only, not again in the reading flow. */}
          <span id={descriptionId} hidden>
            {view.description}
          </span>
        </>
      )}
      {moved ? <MovedNote text={moved.text} onUndo={undo} onClose={closeNote} /> : null}
      <span className="sr-only" role="status">
        {announcement.text}
      </span>
    </span>
  );
}

/**
 * "Landing moved to 14 Mar 2028, the next GO date for Connecting Ridge." with Undo, in a
 * bubble over "Next GO". It stays while the pointer or focus is in it, and goes after fifteen
 * seconds, on Escape, or when the landing date changes another way. Screen readers hear the
 * same words from the button's own polite status line.
 */
function MovedNote({ text, onUndo, onClose }: { text: string; onUndo: () => void; onClose: () => void }) {
  const [held, setHeld] = useState(false);
  useEffect(() => {
    if (held) return;
    const timer = window.setTimeout(onClose, NOTE_MS);
    return () => window.clearTimeout(timer);
  }, [held, onClose]);

  return (
    <div
      className="ldc-note"
      onPointerEnter={() => setHeld(true)}
      onPointerLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          event.stopPropagation();
          onClose();
        }
      }}
    >
      <p className="ldc-note-text">{text}</p>
      <Button onClick={onUndo}>Undo</Button>
    </div>
  );
}
