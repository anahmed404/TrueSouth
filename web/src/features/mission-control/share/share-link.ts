/**
 * The shareable link to the current scenario (docs/features/share-export.md, "Share a
 * link"; the format is in docs/data-contracts.md, "Shareable scenario link").
 *
 * Built from the store, not read from the address bar: while the scrubber plays, the
 * address bar is updated at most every 250 ms (`throttled-history.ts`), so it can lag.
 */

import { writeScenarioQuery, type ScenarioState } from "../../../state/scenario";

export function scenarioLink(state: ScenarioState, location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}?${writeScenarioQuery(state)}`;
}

/** The link for this page, or "" outside a browser. */
export function currentScenarioLink(state: ScenarioState): string {
  if (typeof window === "undefined" || !window.location) return "";
  return scenarioLink(state, window.location);
}
