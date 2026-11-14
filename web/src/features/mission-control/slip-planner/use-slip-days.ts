import { useRef } from "react";
import type { MissionProfile } from "../../../contracts/generated";
import { evaluationAt, useSweeps, type SlipSweep } from "../../../lib/scoring";
import { cachedSlipDays, type SlipDays } from "../../../lib/scoring/slip-days";
import type { SiteResult } from "./model";

/**
 * One selected site's slip sweep, read day by day, for the current profile only. While a new
 * sweep runs (a profile or site-list change) the site is "loading" and has no days: the
 * previous profile's picture is never shown as if it were this one's.
 */
export type SiteDays = {
  siteId: string;
  state: "ready" | "loading" | "error";
  days: SlipDays | null;
  sweep: SlipSweep | null;
  /** The profile the sweep was run with: the current one. */
  profile: MissionProfile | null;
  error: string | null;
};

/**
 * The Slip Planner's one door to the strips: `useSweeps` (the Web Worker) for every selected
 * site, each packed per landing day once (`cachedSlipDays`). The landing date is not an
 * input, so moving it never runs the sweep again: it reads another entry. What a user reads
 * for a site and a date comes from `useEvaluate` (landing-results.ts), not from here.
 */
export function useSlipDays(siteIds: readonly string[], profile: MissionProfile): SiteDays[] {
  const sweeps = useSweeps(siteIds, profile);
  const previous = useRef<SiteDays[]>([]);

  const next = siteIds.map((siteId, index): SiteDays => {
    const result = sweeps[index];
    if (result?.status === "ready" && result.data) {
      return { siteId, state: "ready", days: cachedSlipDays(result.data, profile), sweep: result.data, profile, error: null };
    }
    if (result?.status === "error") return { siteId, state: "error", days: null, sweep: null, profile: null, error: result.error };
    return { siteId, state: "loading", days: null, sweep: null, profile: null, error: null };
  });

  // The same array while nothing changed, so the strips' canvas is not drawn again.
  const old = previous.current;
  const same =
    old.length === next.length &&
    old.every((o, i) => {
      const n = next[i]!;
      return o.siteId === n.siteId && o.state === n.state && o.days === n.days && o.error === n.error;
    });
  if (same) return old;
  previous.current = next;
  return next;
}

/**
 * A site's result for a landing hour, read from its sweep (evaluationAt, docs/science.md
 * §10). Only the agreement tests use it, to check the sweep against `evaluateLanding`.
 */
export function resultAt(entry: SiteDays | undefined, hour: number): SiteResult {
  if (!entry?.sweep || !entry.profile) return { kind: "pending" };
  if (hour < 0 || hour >= entry.sweep.hourCount) return { kind: "none" };
  const evaluation = evaluationAt(entry.sweep, entry.profile, hour);
  return evaluation ? { kind: "ready", evaluation } : { kind: "none" };
}
