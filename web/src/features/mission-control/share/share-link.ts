/**
 * The shareable link to the current scenario (docs/features/share-export.md, "Share a
 * link"; the format is in docs/data-contracts.md, "Shareable scenario link").
 *
 * Built from the store, not read from the address bar: while the scrubber plays, the
 * address bar is updated at most every 250 ms (`throttled-history.ts`), so it can lag.
 */

import { writeScenarioQuery, type ScenarioState } from "../../../state/scenario";
import { writeCmp, type DatesPicks } from "../compare/dates";
import { compareStore } from "../compare/picks-store";

/**
 * The link to a scenario. With Compare open in "Sites and dates", `picks` adds the optional
 * `cmp` parameter (docs/features/compare.md): an older app ignores it, and a link without it
 * is unchanged.
 */
export function scenarioLink(state: ScenarioState, location: { origin: string; pathname: string }, picks: DatesPicks | null = null): string {
  const cmp = picks && state.view === "compare" ? `&cmp=${writeCmp(picks).split(",").map(encodeURIComponent).join(",")}` : "";
  return `${location.origin}${location.pathname}?${writeScenarioQuery(state)}${cmp}`;
}

/** The link for this page, or "" outside a browser. */
export function currentScenarioLink(state: ScenarioState): string {
  if (typeof window === "undefined" || !window.location) return "";
  return scenarioLink(state, window.location, compareStore.get().shown);
}
