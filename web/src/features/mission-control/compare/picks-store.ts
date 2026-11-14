/**
 * Compare's own state, kept apart from the scenario so that picking never moves it
 * (docs/features/compare.md, "Sites and dates"): which mode shows, the user's picks (null
 * until they pick, so the defaults follow the scenario), and the picks in use for the share
 * link. It lives for the page's session; a reload starts in the Sites mode unless the link
 * carries `cmp`.
 */

import { useSyncExternalStore } from "react";
import type { CompareMode, DatesPicks } from "./dates";

export type CompareState = {
  mode: CompareMode;
  /** The user's own picks; null while the defaults apply. */
  picks: DatesPicks | null;
  /** The picks shown, for the share link; null in the Sites mode. */
  shown: DatesPicks | null;
};

const INITIAL: CompareState = { mode: "sites", picks: null, shown: null };

let state: CompareState = INITIAL;
const listeners = new Set<() => void>();

/** The `cmp` parameter of the address the page opened at, read before anything rewrites it. */
let linkPicks: string | null = readOpeningLink();

function readOpeningLink(): string | null {
  try {
    if (typeof window === "undefined" || !window.location) return null;
    return new URLSearchParams(window.location.search).get("cmp");
  } catch {
    return null;
  }
}

export const compareStore = {
  get: (): CompareState => state,
  set(next: Partial<CompareState>): void {
    const merged = { ...state, ...next };
    if (merged.mode === state.mode && merged.picks === state.picks && merged.shown === state.shown) return;
    state = merged;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },
  /** The opening link's `cmp`, once: later openings of Compare start from the stored state. */
  takeLinkPicks(): string | null {
    const raw = linkPicks;
    linkPicks = null;
    return raw;
  },
  /** For tests: back to the Sites mode, with a fresh opening link. */
  reset(openingCmp: string | null = null): void {
    state = INITIAL;
    linkPicks = openingCmp;
    for (const listener of listeners) listener();
  },
};

export function useCompareState(): CompareState {
  return useSyncExternalStore(compareStore.subscribe, compareStore.get, compareStore.get);
}
