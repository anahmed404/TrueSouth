import type { MissionProfile, Site } from "../../contracts/generated";
import { useEvaluation, type Evaluation } from "../../lib/scoring";

/** One site's evaluation for the landing date, in the four states a panel draws. */
export type SiteStatus =
  | { kind: "loading" }
  | { kind: "error"; message: string }
  /** The mission window runs past the end of the time grid: no result, not a NO-GO. */
  | { kind: "none" }
  | { kind: "ready"; evaluation: Evaluation };

export function useSiteStatus(siteId: string, profile: MissionProfile, landingUtc: string): SiteStatus {
  const result = useEvaluation(siteId, profile, landingUtc);
  if (result.status === "loading") return { kind: "loading" };
  if (result.status === "error") return { kind: "error", message: result.error };
  if (result.data === null) return { kind: "none" };
  return { kind: "ready", evaluation: result.data };
}

export const NO_RESULT_TEXT = "No result: the mission window runs past 2031";

/** A site's display name. A custom site not yet in the catalog shows its id. */
export function siteName(site: Site | null | undefined, siteId: string): string {
  return site?.name ?? siteId;
}

/** A sphere-tier site has no terrain: no slope, a flat skyline, no blockers. */
export function isSphere(site: Site | null | undefined): boolean {
  return site?.terrain_tier === "sphere";
}
