/**
 * One site's status at one landing date, through the focused-site panel's own hook. It draws
 * nothing; it reports the status under `reportKey` (the site id, or a column's key in
 * "Sites and dates"), and the table lays the results out.
 */

import { useLayoutEffect } from "react";
import type { MissionProfile } from "../../../contracts/generated";
import { useSiteStatus, type SiteStatus } from "../../../app/mission/site-status";

export type Reported = { status: SiteStatus; profile: MissionProfile; landingUtc: string };

export const LOADING: SiteStatus = { kind: "loading" };

export function sameStatus(a: SiteStatus, b: SiteStatus): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === "ready" && b.kind === "ready") return a.evaluation === b.evaluation;
  if (a.kind === "error" && b.kind === "error") return a.message === b.message;
  return true;
}

/** Keeps the reports object when a report is unchanged, so the table does not redraw. */
export function mergeReport(current: Readonly<Record<string, Reported>>, key: string, reported: Reported): Readonly<Record<string, Reported>> {
  const before = current[key];
  if (before && before.profile === reported.profile && before.landingUtc === reported.landingUtc && sameStatus(before.status, reported.status)) {
    return current;
  }
  return { ...current, [key]: reported };
}

export function StatusProbe({
  siteId,
  profile,
  landingUtc,
  onStatus,
  reportKey = siteId,
}: {
  siteId: string;
  profile: MissionProfile;
  landingUtc: string;
  onStatus: (key: string, reported: Reported) => void;
  reportKey?: string;
}) {
  const status = useSiteStatus(siteId, profile, landingUtc);
  const evaluation = status.kind === "ready" ? status.evaluation : null;
  const message = status.kind === "error" ? status.message : null;
  // Before paint, so the table never shows one frame of the old profile's numbers.
  useLayoutEffect(() => {
    onStatus(reportKey, { status, profile, landingUtc });
    // `status` is rebuilt each render; what it holds is in the other dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onStatus, reportKey, profile, landingUtc, status.kind, evaluation, message]);
  return null;
}
