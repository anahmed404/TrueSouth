/**
 * Starting a custom site from the form or from the Polar map: the same checks, the same
 * row, the same states. The server names the site; only then does its id join the scenario.
 */

import { useCallback, useEffect } from "react";
import { useStore } from "zustand";
import { MAX_SITES, type ScenarioStore } from "../../state/scenario";
import { customSitesStore, isLocalKey, type AvailabilityState, type CustomSitesStore } from "../../state/custom-sites";
import { checkLatitude, checkLongitude, checkName, toEastLongitude } from "./custom-site-form";
import { useScenarioStore } from "./scenario-context";

export const FULL_TEXT = `A scenario holds at most ${MAX_SITES} sites. Remove one, then try again.`;

/** Sites in the scenario plus typed points the server has not named yet. */
export function usedSlots(scenario: ScenarioStore, custom: CustomSitesStore = customSitesStore): number {
  const local = Object.values(custom.getState().entries).filter((entry) => isLocalKey(entry.key)).length;
  return scenario.getState().siteIds.length + local;
}

/** Puts the server's id in the scenario, in place of the row's key if that differs. */
function joinScenario(scenario: ScenarioStore) {
  return (siteId: string, previousKey: string) => {
    if (!isLocalKey(previousKey) && previousKey !== siteId) scenario.getState().removeSite(previousKey);
    scenario.getState().addSite(siteId);
  };
}

export type StartResult = { ok: true; key: string } | { ok: false; message: string };

/**
 * Checks the point, then asks the server for it. A point that cannot be asked for (out of
 * range, too close to a pole, no room) gives a message and starts nothing.
 */
export function startCustomSite(
  scenario: ScenarioStore,
  latDeg: number,
  lonDeg: number,
  name: string | null = null,
  custom: CustomSitesStore = customSitesStore,
): StartResult {
  const lat = checkLatitude(String(latDeg));
  if (!Number.isFinite(latDeg) || lat.value === null) return { ok: false, message: lat.message ?? "Latitude is not a number." };
  const lon = checkLongitude(String(lonDeg));
  if (!Number.isFinite(lonDeg) || lon.value === null) return { ok: false, message: lon.message ?? "Longitude is not a number." };
  const nameMessage = checkName(name ?? "");
  if (nameMessage) return { ok: false, message: nameMessage };
  if (usedSlots(scenario, custom) >= MAX_SITES) return { ok: false, message: FULL_TEXT };
  const key = custom.getState().submit(latDeg, toEastLongitude(lonDeg), name, joinScenario(scenario));
  return { ok: true, key };
}

/** "Try again" and "Compute this site" on a row: ask the server again for that point. */
export function retryCustomSite(scenario: ScenarioStore, key: string, custom: CustomSitesStore = customSitesStore): void {
  const entry = custom.getState().entries[key];
  if (!entry) return;
  // A typed point still needs a free place: its own row counts as one of them.
  if (isLocalKey(key) && usedSlots(scenario, custom) - 1 >= MAX_SITES) {
    custom.getState().refuse(entry.latDeg, entry.lonDeg, entry.name, FULL_TEXT, key);
    return;
  }
  custom.getState().retry(key, joinScenario(scenario));
}

/** Removes a custom site's row: stops waiting, and drops its id from the scenario. */
export function removeCustomSite(scenario: ScenarioStore, key: string, custom: CustomSitesStore = customSitesStore): void {
  custom.getState().forget(key);
  if (!isLocalKey(key)) scenario.getState().removeSite(key);
}

/**
 * The Polar map's "Compute this site" or "Compute this point": a button press, so one POST.
 * A point the form would refuse shows as a failed row with the reason, so a press is never
 * silent.
 */
export function requestFromMap(scenario: ScenarioStore, latDeg: number, lonDeg: number, custom: CustomSitesStore = customSitesStore): void {
  const result = startCustomSite(scenario, latDeg, lonDeg, null, custom);
  if (!result.ok) {
    const lon = Number.isFinite(lonDeg) ? toEastLongitude(lonDeg) : lonDeg;
    custom.getState().refuse(latDeg, lon, null, result.message);
  }
}

/**
 * For the Polar map: `polarMapLayer({ onRequestSite: useRequestCustomSite() })`.
 *
 * - Returns undefined, so the map shows no button, until `/api/health` says this server
 *   computes custom sites, and whenever it says it does not or does not answer.
 * - The health check runs once when the Polar map view first opens (or when the picker
 *   opens, whichever is first): opening the map is something the user does.
 * - The function it returns keeps its identity across renders.
 */
export function useRequestCustomSite(): ((latDeg: number, lonDeg: number) => void) | undefined {
  const scenario = useScenarioStore();
  const view = useStore(scenario, (s) => s.view);
  const availability = useStore(customSitesStore, (s) => s.availability.state);
  useEffect(() => {
    if (view === "map") customSitesStore.getState().checkAvailability();
  }, [view]);
  const request = useCallback((latDeg: number, lonDeg: number) => requestFromMap(scenario, latDeg, lonDeg), [scenario]);
  return mapRequest(availability, request);
}

/** The map gets the callback only while the server says it computes custom sites. */
export function mapRequest<T>(availability: AvailabilityState["state"], request: T): T | undefined {
  return availability === "available" ? request : undefined;
}
