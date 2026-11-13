import { useRef } from "react";
import type { MissionProfile } from "../../../contracts/generated";
import { evaluationAt, useSweeps, type SlipSweep } from "../../../lib/scoring";
import { cachedSlipDays, type SlipDays } from "../../../lib/scoring/slip-days";
import type { SiteResult } from "./model";

/**
 * One selected site's slip sweep, read day by day. `stale` is true while a new sweep runs
 * and the previous result is still shown (slip-planner.md, "States: Computing").
 */
export type SiteDays = {
  siteId: string;
  state: "ready" | "loading" | "error";
  days: SlipDays | null;
  sweep: SlipSweep | null;
  /** The profile the shown sweep was run with. */
  profile: MissionProfile | null;
  stale: boolean;
  error: string | null;
};

/**
 * The Slip Planner's one door to the numbers: `useSweeps` (the Web Worker) for every selected
 * site, each packed per landing day once (`cachedSlipDays`). The landing date is not an
 * input, so moving it never runs the sweep again: it reads another entry.
 */
export function useSlipDays(siteIds: readonly string[], profile: MissionProfile): SiteDays[] {
  const sweeps = useSweeps(siteIds, profile);
  const last = useRef(new Map<string, { sweep: SlipSweep; profile: MissionProfile; days: SlipDays }>());
  const previous = useRef<SiteDays[]>([]);

  const next = siteIds.map((siteId, index): SiteDays => {
    const result = sweeps[index];
    if (result?.status === "ready" && result.data) {
      const days = cachedSlipDays(result.data, profile);
      last.current.set(siteId, { sweep: result.data, profile, days });
      return { siteId, state: "ready", days, sweep: result.data, profile, stale: false, error: null };
    }
    const kept = last.current.get(siteId);
    if (result?.status === "error") {
      return { siteId, state: "error", days: null, sweep: null, profile: null, stale: false, error: result.error };
    }
    if (kept) return { siteId, state: "loading", days: kept.days, sweep: kept.sweep, profile: kept.profile, stale: true, error: null };
    return { siteId, state: "loading", days: null, sweep: null, profile: null, stale: false, error: null };
  });

  // The same array while nothing changed, so the strips' canvas is not drawn again.
  const old = previous.current;
  const same =
    old.length === next.length &&
    old.every((o, i) => {
      const n = next[i]!;
      return o.siteId === n.siteId && o.state === n.state && o.days === n.days && o.stale === n.stale && o.error === n.error;
    });
  if (same) return old;
  previous.current = next;
  return next;
}

/**
 * A site's result for a landing hour, from its sweep: the spot, the sites rail's agreement
 * and the hover readout all use this (evaluationAt, docs/science.md §10).
 */
export function resultAt(entry: SiteDays | undefined, hour: number): SiteResult {
  if (!entry?.sweep || !entry.profile) return { kind: "pending" };
  if (hour < 0 || hour >= entry.sweep.hourCount) return { kind: "none" };
  const evaluation = evaluationAt(entry.sweep, entry.profile, hour);
  return evaluation ? { kind: "ready", evaluation } : { kind: "none" };
}
