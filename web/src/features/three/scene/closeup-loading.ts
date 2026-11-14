import { useEffect, useRef, useState } from "react";
import { useStore } from "zustand";
import type { DecodedTerrain } from "../../../data";
import type { HookResult } from "../../../data/hooks";
import { closeupKey, dataStore, type DataStore } from "../../../state/data";

/**
 * When the close-up (closeup-ground.ts) is fetched and drawn (docs/features/local-terrain.md,
 * "The close-up"): only in the two views that draw the ground near the lander, Local terrain
 * and Lander's eye. The camera view changes when its flight starts, so the file is requested
 * as the flight into one of them begins and is usually in by the time it lands. After leaving
 * them it is kept for `CLOSEUP_GRACE_MS`, so a quick look at another view does not throw it away
 * and build it again; then its geometry and height texture are released. Moving between the
 * two ground views keeps it.
 */
export const CLOSEUP_GRACE_MS = 10_000;

export function isGroundView(view: string): boolean {
  return view === "terrain" || view === "panorama";
}

/** Whether the close-up is wanted as the view changes: on in a ground view, off a grace period after leaving one. */
export class CloseupHold {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private held: boolean;

  constructor(
    view: string,
    private readonly onChange: (wanted: boolean) => void,
    private readonly graceMs = CLOSEUP_GRACE_MS,
  ) {
    this.held = isGroundView(view);
  }

  get wanted(): boolean {
    return this.held;
  }

  setView(view: string): void {
    if (isGroundView(view)) {
      this.cancel();
      if (!this.held) {
        this.held = true;
        this.onChange(true);
      }
      return;
    }
    if (!this.held || this.timer !== null) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.held = false;
      this.onChange(false);
    }, this.graceMs);
  }

  dispose(): void {
    this.cancel();
  }

  private cancel(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
  }
}

/** Asks the data store for the site's close-up. A site without one requests nothing (its meta lists none). */
export function requestCloseup(store: DataStore, siteId: string): Promise<unknown> {
  return store
    .getState()
    .ensure(closeupKey(siteId))
    .catch(() => undefined);
}

/** CloseupHold for a React view. */
export function useCloseupWanted(view: string): boolean {
  const [wanted, setWanted] = useState(() => isGroundView(view));
  const hold = useRef<CloseupHold | null>(null);
  useEffect(() => {
    const h = new CloseupHold(view, setWanted);
    hold.current = h;
    return () => {
      h.dispose();
      hold.current = null;
    };
    // The hold is made once; later views reach it through setView below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    hold.current?.setView(view);
  }, [view]);
  return wanted;
}

/**
 * The focused site's close-up while it is wanted; otherwise nothing is requested and the
 * answer is "none" (ready, no data), so the ground is the patch alone.
 */
export function useGroundCloseup(siteId: string, wanted: boolean, store: DataStore = dataStore): HookResult<DecodedTerrain | null> {
  const key = closeupKey(siteId);
  const entry = useStore(store, (state) => (wanted ? state.entries[key] : undefined));
  const absent = entry === undefined;
  useEffect(() => {
    if (wanted && absent) void requestCloseup(store, siteId);
  }, [wanted, absent, store, siteId]);
  if (!wanted) return { status: "ready", data: null, error: null };
  if (!entry || entry.status === "loading") return { status: "loading", data: null, error: null };
  if (entry.status === "error") return { status: "error", data: null, error: entry.error ?? "unknown error" };
  return { status: "ready", data: entry.data as DecodedTerrain | null, error: null };
}
