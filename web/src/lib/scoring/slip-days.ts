/**
 * The Slip Planner's per-day reading of a slip sweep: one entry per landing at 00:00 UTC
 * (docs/science.md §11), as typed arrays of status, score and a bit mask of vetoes.
 *
 * This adds no rule. Each entry is `evaluationAt(sweep, profile, hour)` (docs/science.md
 * §10, applied by scoring.ts) packed small, so a strip, a hover readout and "next GO" all
 * read the same numbers as the sites rail and the focused-site panel. Moving the landing
 * date reads another entry; nothing here runs again.
 */

import { evaluationAt, utcMidnightHours, type Evaluation, type ScoringProfile, type SlipSweep, type Status, type VetoId } from "./scoring.ts";

/** A day's status code. 0 is "no data": the mission window runs past the end of the time grid. */
export const DAY_NONE = 0;
export const DAY_GO = 1;
export const DAY_CAUTION = 2;
export const DAY_NOGO = 3;
export type DayCode = typeof DAY_NONE | typeof DAY_GO | typeof DAY_CAUTION | typeof DAY_NOGO;

/** The bit of each veto in `SlipDays.vetoMask`, in docs/science.md §10's order. */
export const VETO_BITS: Readonly<Record<VetoId, number>> = {
  slope: 1,
  darkness: 2,
  blackout: 4,
  landing_dark: 8,
  landing_sun_low: 16,
  landing_sun_high: 32,
};

export type SlipDays = {
  /** Days on the time grid: day `d` is the landing at hour `24 d`, 00:00 UTC. */
  dayCount: number;
  status: Uint8Array;
  /** The score out of 100; NaN where there is no data. */
  score: Float32Array;
  vetoMask: Uint8Array;
};

export function statusCode(status: Status | null): DayCode {
  if (status === "GO") return DAY_GO;
  if (status === "CAUTION") return DAY_CAUTION;
  if (status === "NO-GO") return DAY_NOGO;
  return DAY_NONE;
}

export function codeStatus(code: number): Status | null {
  if (code === DAY_GO) return "GO";
  if (code === DAY_CAUTION) return "CAUTION";
  if (code === DAY_NOGO) return "NO-GO";
  return null;
}

export function vetoMaskOf(evaluation: Evaluation): number {
  let mask = 0;
  for (const id of Object.keys(VETO_BITS) as VetoId[]) if (evaluation.vetoes[id].triggered) mask |= VETO_BITS[id];
  return mask;
}

/** Every 00:00 UTC landing of the sweep, packed. */
export function slipDays(sweep: SlipSweep, profile: ScoringProfile): SlipDays {
  const hours = utcMidnightHours(sweep.hourCount);
  const dayCount = hours.length;
  const status = new Uint8Array(dayCount);
  const score = new Float32Array(dayCount).fill(Number.NaN);
  const vetoMask = new Uint8Array(dayCount);
  for (let day = 0; day < dayCount; day += 1) {
    const evaluation = evaluationAt(sweep, profile, hours[day]!);
    if (!evaluation) continue;
    status[day] = statusCode(evaluation.status);
    score[day] = evaluation.score;
    vetoMask[day] = vetoMaskOf(evaluation);
  }
  return { dayCount, status, score, vetoMask };
}

const cache = new WeakMap<SlipSweep, { profile: ScoringProfile; days: SlipDays }>();

/** `slipDays`, worked out once per sweep and profile object. */
export function cachedSlipDays(sweep: SlipSweep, profile: ScoringProfile): SlipDays {
  const hit = cache.get(sweep);
  if (hit && hit.profile === profile) return hit.days;
  const days = slipDays(sweep, profile);
  cache.set(sweep, { profile, days });
  return days;
}
