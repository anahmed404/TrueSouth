/**
 * Mission Control's one scenario, and the shareable link it mirrors.
 *
 * A lesson builds its own scenario and does not touch this store.
 * The shell installs the store once `sites.json`, `profiles.json` and the
 * manifest have loaded, then calls `bindScenarioUrl`.
 *
 * Choices the specs leave open are noted on the functions that make them.
 */

import { createStore, type StoreApi } from "zustand/vanilla";
import type { MissionProfile, TimeGrid, Weights } from "../contracts/generated.ts";
import { isCustomSiteId } from "../data/paths.ts";
import { windowLength } from "../lib/scoring/scoring.ts";
import { hourIndexToUtc, utcToHourIndex } from "../lib/time/index.ts";
import type { Scenario } from "../app/panel.ts";

export const DEFAULT_PROFILE_ID = "im2_athena";
export const DEFAULT_LANDING_UTC = "2028-03-01T00:00:00Z";
/** A new visitor lands on the System view: Mission Control is space-first (decision 0013). */
export const DEFAULT_VIEW = "system";
export const MAX_SITES = 8;
/** Faint bands in the timeline: 3 days either side of the mission window. */
export const TIMELINE_CONTEXT_HOURS = 72;
export const CHANGED_BY_YOU = "Changed by you.";
/** Each score weight is a number from 0 to this (docs/mission-profiles.md). */
export const MAX_WEIGHT = 1000;
export const WEIGHT_RANGE_NOTICE = "A weight must be a number from 0 to 1,000.";

/**
 * The four polar sites in the Mission Control shell sample. Apollo 11 is
 * contrast, so it is not one of them. If none of these ids are in
 * `sites.json`, the first four listed sites are used instead.
 */
export const DEFAULT_SITE_IDS = [
  "connecting_ridge",
  "artemis_malapert",
  "artemis_mouton",
  "artemis_de_gerlache_rim_2",
] as const;

export const VIEWS = ["slip", "system", "map", "terrain", "panorama", "compare"] as const;
export type ViewId = (typeof VIEWS)[number];

export const PROFILE_FIELDS = [
  "duration_days",
  "min_sun_fraction",
  "ops_sun_el_min_deg",
  "max_dark_h",
  "relay_available",
  "antenna_mask_deg",
  "max_blackout_h",
  "max_slope_deg",
  "slope_ideal_deg",
  "landing_sun_el_min_deg",
  "landing_sun_el_max_deg",
  "weights",
] as const;

export type ProfileField = (typeof PROFILE_FIELDS)[number];
export type HistoryMode = "push" | "replace" | "silent";
export type DragMode = "push" | "replace";

export type ScenarioCatalog = {
  profiles: readonly MissionProfile[];
  sites: readonly { id: string }[];
  grid: TimeGrid;
};

export type ReadScenario = {
  profile: MissionProfile;
  basePresetId: string;
  changedFields: ProfileField[];
  siteIds: string[];
  focusedSiteId: string | null;
  landingUtc: string;
  currentUtc: string;
  view: ViewId;
  notices: string[];
};

type ScenarioData = {
  catalog: ScenarioCatalog;
  profile: MissionProfile;
  basePresetId: string;
  changedFields: ProfileField[];
  siteIds: string[];
  focusedSiteId: string | null;
  landingUtc: string;
  currentUtc: string;
  view: ViewId;
  notices: string[];
  /** How the next URL write should touch the address bar. Not part of the scenario. */
  historyMode: HistoryMode;
  scenario: Scenario;
};

export type ScenarioState = ScenarioData & {
  choosePreset: (presetId: string) => void;
  editProfileField: (field: ProfileField, value: unknown, write?: DragMode) => void;
  resetProfileField: (field: ProfileField) => void;
  addSite: (siteId: string) => void;
  removeSite: (siteId: string) => void;
  reorderSites: (siteIds: readonly string[]) => void;
  focusSite: (siteId: string) => void;
  setLandingDate: (utc: string, write?: DragMode) => void;
  slipLanding: (days: number) => void;
  setCurrentTime: (utc: string, write?: DragMode) => void;
  stepCurrentTime: (hours: number) => void;
  setView: (view: ViewId) => void;
  dismissNotices: () => void;
  /** Replace the scenario from a query string without pushing a history entry. */
  applySearch: (search: string) => void;
};

export type ScenarioStore = StoreApi<ScenarioState>;

export type ScenarioHistory = {
  search: () => string;
  replace: (query: string) => void;
  push: (query: string) => void;
  listen: (onPop: (search: string) => void) => () => void;
};

const CUSTOM_ID = "custom";
const CUSTOM_NAME = "Custom";
const CATALOG_ID = /^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$/;

export function selectScenario(state: ScenarioState): Scenario {
  return state.scenario;
}

export function selectView(state: ScenarioState): ViewId {
  return state.view;
}

export function selectChangedFields(state: ScenarioState): readonly ProfileField[] {
  return state.changedFields;
}

export function selectNotices(state: ScenarioState): readonly string[] {
  return state.notices;
}

export function selectBasePresetId(state: ScenarioState): string {
  return state.basePresetId;
}

export function createScenarioStore(catalog: ScenarioCatalog, search = ""): ScenarioStore {
  const initial = readScenarioQuery(search, catalog);
  return createStore<ScenarioState>((set, get) => ({
    catalog,
    profile: initial.profile,
    basePresetId: initial.basePresetId,
    changedFields: initial.changedFields,
    siteIds: initial.siteIds,
    focusedSiteId: initial.focusedSiteId,
    landingUtc: initial.landingUtc,
    currentUtc: initial.currentUtc,
    view: initial.view,
    notices: initial.notices,
    historyMode: "silent",
    scenario: toScenario(initial),

    choosePreset: (presetId) => {
      const state = get();
      const next = findPreset(state.catalog, presetId);
      if (!next) return;
      if (state.profile.id === presetId && state.changedFields.length === 0) return;
      const profile = structuredClone(next);
      const times = reclampTimes(state.catalog.grid, profile.duration_days, state.landingUtc, state.currentUtc);
      set(
        commit(state, {
          profile,
          basePresetId: profile.id,
          changedFields: [],
          ...times,
          historyMode: "push",
        }),
      );
    },

    editProfileField: (field, value, write = "push") => {
      const state = get();
      const base = findPreset(state.catalog, state.basePresetId);
      if (!base || !isProfileField(field)) return;
      if (fieldEqual(field, state.profile[field], value)) return;
      if (field === "weights" && !weightsInRange(value)) {
        set({ notices: [...state.notices, WEIGHT_RANGE_NOTICE] });
        return;
      }
      if (field === "weights" && powerAndCommsBothZero(value)) {
        set({
          notices: [...state.notices, "A profile's power and comms weights must not both be zero."],
        });
        return;
      }
      const draft: Draft = { profile: state.profile, changed: [...state.changedFields] };
      if (!applyField(draft, base, field, value, state.catalog.grid)) return;
      const times = reclampTimes(
        state.catalog.grid,
        draft.profile.duration_days,
        state.landingUtc,
        state.currentUtc,
      );
      set(
        commit(state, {
          profile: draft.profile,
          basePresetId: draft.profile.id === CUSTOM_ID ? state.basePresetId : draft.profile.id,
          changedFields: draft.changed,
          ...times,
          historyMode: write,
        }),
      );
    },

    resetProfileField: (field) => {
      const state = get();
      const base = findPreset(state.catalog, state.basePresetId);
      if (!base || !state.changedFields.includes(field)) return;
      get().editProfileField(field, cloneField(base, field));
    },

    addSite: (siteId) => {
      const state = get();
      if (!canSelect(state.catalog, siteId)) return;
      if (state.siteIds.includes(siteId) || state.siteIds.length >= MAX_SITES) return;
      const siteIds = [...state.siteIds, siteId];
      set(
        commit(state, {
          siteIds,
          focusedSiteId: state.focusedSiteId ?? siteId,
          historyMode: "push",
        }),
      );
    },

    removeSite: (siteId) => {
      const state = get();
      const index = state.siteIds.indexOf(siteId);
      if (index < 0) return;
      const siteIds = state.siteIds.filter((id) => id !== siteId);
      let focusedSiteId = state.focusedSiteId;
      if (focusedSiteId === siteId) {
        focusedSiteId = siteIds[index] ?? siteIds[index - 1] ?? null;
      }
      set(commit(state, { siteIds, focusedSiteId, historyMode: "push" }));
    },

    reorderSites: (siteIds) => {
      const state = get();
      if (!sameMembers(state.siteIds, siteIds)) return;
      if (siteIds.every((id, index) => id === state.siteIds[index])) return;
      set(commit(state, { siteIds: [...siteIds], historyMode: "push" }));
    },

    focusSite: (siteId) => {
      const state = get();
      if (!state.siteIds.includes(siteId) || state.focusedSiteId === siteId) return;
      set(commit(state, { focusedSiteId: siteId, historyMode: "push" }));
    },

    setLandingDate: (utc, write = "push") => {
      const state = get();
      let landingHour: number;
      try {
        landingHour = utcToHourIndex(state.catalog.grid, utc);
      } catch {
        return;
      }
      const times = moveLandingKeepingOffset(state, landingHour);
      if (times.landingUtc === state.landingUtc && times.currentUtc === state.currentUtc) return;
      set(commit(state, { ...times, historyMode: write }));
    },

    slipLanding: (days) => {
      const state = get();
      if (!Number.isInteger(days) || days === 0) return;
      const grid = state.catalog.grid;
      let hour: number;
      try {
        hour = utcToHourIndex(grid, state.landingUtc) + days * 24;
      } catch {
        return;
      }
      const times = moveLandingKeepingOffset(state, hour);
      if (times.landingUtc === state.landingUtc && times.currentUtc === state.currentUtc) return;
      set(commit(state, { ...times, historyMode: "push" }));
    },

    setCurrentTime: (utc, write = "push") => {
      const state = get();
      const currentUtc = currentFromHour(state, utc);
      if (!currentUtc || currentUtc === state.currentUtc) return;
      set(commit(state, { currentUtc, historyMode: write }));
    },

    stepCurrentTime: (hours) => {
      const state = get();
      if (!Number.isInteger(hours) || hours === 0) return;
      const grid = state.catalog.grid;
      let hour: number;
      try {
        hour = utcToHourIndex(grid, state.currentUtc) + hours;
      } catch {
        return;
      }
      const bounds = timelineBounds(grid, utcToHourIndex(grid, state.landingUtc), state.profile.duration_days);
      const currentUtc = hourIndexToUtc(grid, clamp(hour, bounds.start, bounds.end));
      if (currentUtc === state.currentUtc) return;
      set(commit(state, { currentUtc, historyMode: "push" }));
    },

    setView: (view) => {
      const state = get();
      if (view === state.view || !isView(view)) return;
      set({ view, historyMode: "push" });
    },

    dismissNotices: () => {
      if (get().notices.length === 0) return;
      set({ notices: [] });
    },

    applySearch: (search) => {
      const state = get();
      const read = readScenarioQuery(search, state.catalog);
      set(
        commit(state, {
          profile: read.profile,
          basePresetId: read.basePresetId,
          changedFields: read.changedFields,
          siteIds: read.siteIds,
          focusedSiteId: read.focusedSiteId,
          landingUtc: read.landingUtc,
          currentUtc: read.currentUtc,
          view: read.view,
          notices: read.notices,
          historyMode: "silent",
        }),
      );
    },
  }));
}

/**
 * Keep the address bar equal to the scenario.
 * A dragged value replaces the current history entry. A discrete change pushes,
 * so Back returns to the previous scenario, including which site is focused.
 */
export function bindScenarioUrl(store: ScenarioStore, history: ScenarioHistory): () => void {
  const canonical = writeScenarioQuery(store.getState());
  if (bareQuery(history.search()) !== canonical) history.replace(canonical);

  let applying = false;
  const unsubscribe = store.subscribe((state, previous) => {
    if (applying) return;
    const next = writeScenarioQuery(state);
    if (next === writeScenarioQuery(previous)) return;
    if (state.historyMode === "replace") history.replace(next);
    else if (state.historyMode === "silent") {
      if (bareQuery(history.search()) !== next) history.replace(next);
    } else history.push(next);
  });

  const unlisten = history.listen((search) => {
    applying = true;
    try {
      store.getState().applySearch(search);
      const next = writeScenarioQuery(store.getState());
      if (bareQuery(search) !== next) history.replace(next);
    } finally {
      applying = false;
    }
  });

  return () => {
    unsubscribe();
    unlisten();
  };
}

/** The browser address bar. Tests pass their own history instead. */
export function browserScenarioHistory(): ScenarioHistory {
  const toUrl = (query: string) => {
    const search = query.length === 0 ? "" : query.startsWith("?") ? query : `?${query}`;
    return `${window.location.pathname}${search}${window.location.hash}`;
  };
  return {
    search: () => window.location.search,
    replace: (query) => {
      window.history.replaceState(window.history.state, "", toUrl(query));
    },
    push: (query) => {
      window.history.pushState(window.history.state, "", toUrl(query));
    },
    listen: (onPop) => {
      const handler = () => onPop(window.location.search);
      window.addEventListener("popstate", handler);
      return () => window.removeEventListener("popstate", handler);
    },
  };
}

export function writeScenarioQuery(state: ScenarioData): string {
  const grid = state.catalog.grid;
  const landingHour = utcToHourIndex(grid, state.landingUtc);
  const currentHour = utcToHourIndex(grid, state.currentUtc);
  const parts = [
    `profile=${encodeProfileParam(writeProfile(state))}`,
    `sites=${state.siteIds.map((id) => encodeURIComponent(id)).join(",")}`,
    `land=${encodeURIComponent(formatLinkUtc(state.landingUtc))}`,
    `t=${String(currentHour - landingHour)}`,
    `view=${encodeURIComponent(state.view)}`,
  ];
  const first = state.siteIds[0] ?? null;
  if (state.focusedSiteId !== null && state.focusedSiteId !== first) {
    parts.push(`focus=${encodeURIComponent(state.focusedSiteId)}`);
  }
  return parts.join("&");
}

/**
 * A bad parameter is dropped and named in `notices`. The rest of the link
 * still loads. An omitted parameter uses the first-visit default.
 * `focus` is written only when the focused site is not the first selected
 * site. If it is absent, or names a site that is not selected, the first
 * selected site is focused.
 */
export function readScenarioQuery(search: string, catalog: ScenarioCatalog): ReadScenario {
  const params = new URLSearchParams(bareQuery(search));
  const notices: string[] = [];
  const { profile, basePresetId, changedFields } = readProfile(rawParam(search, "profile"), catalog, notices);
  const sitesParam = params.get("sites");
  const siteIds = sitesParam === null ? defaultSiteIds(catalog) : parseSites(sitesParam, catalog, notices);
  const landingUtc = readLanding(params.get("land"), catalog.grid, profile.duration_days, notices);
  const currentUtc = readCurrent(params.get("t"), catalog.grid, landingUtc, profile.duration_days, notices);
  const view = readView(params.get("view"), notices);
  return {
    profile,
    basePresetId,
    changedFields,
    siteIds,
    focusedSiteId: readFocus(params.get("focus"), siteIds, notices),
    landingUtc,
    currentUtc,
    view,
    notices,
  };
}

/** Last hour index whose mission window still fits on the grid. */
export function lastLandingHour(grid: TimeGrid, durationDays: number): number {
  const hours = windowLength(durationDays);
  const last = grid.count - hours;
  if (last < 0) throw new RangeError("mission window is longer than the time grid");
  return last;
}

export function timelineBounds(
  grid: TimeGrid,
  landingHour: number,
  durationDays: number,
): { start: number; end: number } {
  const hours = windowLength(durationDays);
  return {
    start: Math.max(0, landingHour - TIMELINE_CONTEXT_HOURS),
    end: Math.min(grid.count - 1, landingHour + hours - 1 + TIMELINE_CONTEXT_HOURS),
  };
}

function defaultSiteIds(catalog: ScenarioCatalog): string[] {
  const known = new Set(catalog.sites.map((site) => site.id));
  const named = DEFAULT_SITE_IDS.filter((id) => known.has(id));
  if (named.length > 0) return [...named];
  return catalog.sites.slice(0, 4).map((site) => site.id);
}

function readProfile(
  raw: string | null,
  catalog: ScenarioCatalog,
  notices: string[],
): { profile: MissionProfile; basePresetId: string; changedFields: ProfileField[] } {
  const fallback = () => {
    const profile = defaultProfile(catalog);
    return { profile, basePresetId: profile.id, changedFields: [] as ProfileField[] };
  };
  if (raw === null) return fallback();
  if (raw.startsWith("custom:")) return readCustomProfile(raw, catalog, notices) ?? fallback();
  const found = findPreset(catalog, raw);
  if (!found) {
    notices.push(`Ignored unknown profile ${quote(raw)}.`);
    return fallback();
  }
  const profile = structuredClone(found);
  return { profile, basePresetId: profile.id, changedFields: [] };
}

function readCustomProfile(
  raw: string,
  catalog: ScenarioCatalog,
  notices: string[],
): { profile: MissionProfile; basePresetId: string; changedFields: ProfileField[] } | null {
  const body = raw.slice("custom:".length);
  const splitAt = body.indexOf(";");
  const baseId = decodeQueryComponent(splitAt === -1 ? body : body.slice(0, splitAt));
  const rest = splitAt === -1 ? "" : body.slice(splitAt + 1);
  const base = baseId !== null && CATALOG_ID.test(baseId) ? findPreset(catalog, baseId) : undefined;
  if (!base) {
    notices.push("Ignored the custom profile because it could not be read.");
    return null;
  }
  const segments = rest.length === 0 ? [] : rest.split(";").filter((segment) => segment.length > 0);
  const pairs: { field: string; raw: string }[] = [];
  for (const segment of segments) {
    const eq = segment.indexOf("=");
    if (eq <= 0) {
      notices.push("Ignored the custom profile because it could not be read.");
      return null;
    }
    const field = decodeQueryComponent(segment.slice(0, eq));
    if (field === null) {
      notices.push("Ignored the custom profile because it could not be read.");
      return null;
    }
    pairs.push({ field, raw: segment.slice(eq + 1) });
  }

  const accepted: { field: ProfileField; value: unknown }[] = [];
  const seen = new Set<string>();
  for (const pair of pairs) {
    if (!isProfileField(pair.field)) {
      notices.push(`Ignored unknown profile field ${quote(pair.field)}.`);
      continue;
    }
    if (seen.has(pair.field)) continue;
    seen.add(pair.field);
    const decoded = decodedFieldText(pair.field, pair.raw);
    if (decoded === null) {
      notices.push(`Ignored ${pair.field} because ${quote(pair.raw)} contains a separator.`);
      continue;
    }
    const value = parseFieldValue(pair.field, decoded);
    if (value === undefined || !isFieldInRange(pair.field, value, catalog.grid)) {
      notices.push(
        pair.field === "weights"
          ? `Ignored weights because ${quote(decoded)} is out of range. ${WEIGHT_RANGE_NOTICE}`
          : `Ignored ${pair.field} because ${quote(decoded)} is out of range.`,
      );
      continue;
    }
    accepted.push({ field: pair.field, value });
  }

  const draft = applyParsed(base, accepted);
  const rule = wholeProfileRule(draft.profile);
  if (rule !== null) {
    notices.push(`Ignored the custom profile because ${rule}.`);
    return null;
  }
  return {
    profile: draft.profile,
    basePresetId: base.id,
    changedFields: draft.changed,
  };
}

function readLanding(raw: string | null, grid: TimeGrid, durationDays: number, notices: string[]): string {
  if (raw === null) return hourIndexToUtc(grid, defaultLandingHour(grid, durationDays));
  try {
    const hour = utcToHourIndex(grid, raw);
    if (hour > lastLandingHour(grid, durationDays)) {
      notices.push(
        `Ignored the landing date ${quote(raw)} because the mission window runs past the end of the time grid.`,
      );
      return hourIndexToUtc(grid, defaultLandingHour(grid, durationDays));
    }
    return hourIndexToUtc(grid, hour);
  } catch {
    notices.push(`Ignored the landing date ${quote(raw)} because it is outside the time grid.`);
    return hourIndexToUtc(grid, defaultLandingHour(grid, durationDays));
  }
}

function readCurrent(
  raw: string | null,
  grid: TimeGrid,
  landingUtc: string,
  durationDays: number,
  notices: string[],
): string {
  if (raw === null) return landingUtc;
  if (!/^-?\d+$/.test(raw)) {
    notices.push(`Ignored the current time because ${quote(raw)} is not a whole number of hours.`);
    return landingUtc;
  }
  const landingHour = utcToHourIndex(grid, landingUtc);
  const hour = landingHour + Number(raw);
  if (hour < 0 || hour >= grid.count) {
    notices.push("Ignored the current time because it is outside the time grid.");
    return landingUtc;
  }
  const bounds = timelineBounds(grid, landingHour, durationDays);
  if (hour < bounds.start || hour > bounds.end) {
    notices.push("Ignored the current time because it is outside the timeline.");
    return landingUtc;
  }
  return hourIndexToUtc(grid, hour);
}

function readView(raw: string | null, notices: string[]): ViewId {
  if (raw === null) return DEFAULT_VIEW;
  if (isView(raw)) return raw;
  notices.push(`Ignored unknown view ${quote(raw)}.`);
  return DEFAULT_VIEW;
}

function parseSites(raw: string, catalog: ScenarioCatalog, notices: string[]): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const part of raw.split(",")) {
    const id = part.trim();
    if (id.length === 0) continue;
    if (seen.has(id)) {
      notices.push(`Ignored repeated site ${quote(id)}.`);
      continue;
    }
    seen.add(id);
    if (!catalog.sites.some((site) => site.id === id) && !isCustomSiteId(id)) {
      notices.push(`Ignored unknown site ${quote(id)}.`);
      continue;
    }
    if (ids.length >= MAX_SITES) {
      notices.push(`Ignored site ${quote(id)} because a scenario holds at most 8 sites.`);
      continue;
    }
    ids.push(id);
  }
  return ids;
}

function writeProfile(state: ScenarioData): string {
  if (state.changedFields.length === 0) return state.basePresetId;
  const fields = state.changedFields.map((field) => `${field}=${formatField(field, state.profile)}`);
  return `custom:${state.basePresetId};${fields.join(";")}`;
}

function formatField(field: ProfileField, profile: MissionProfile): string {
  const value = profile[field];
  if (field === "weights") {
    const weights = value as Weights;
    return `${formatNumber(weights.slope)}:${formatNumber(weights.power)}:${formatNumber(weights.comms)}`;
  }
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return formatNumber(value);
  return String(value);
}

function formatNumber(value: number): string {
  if (Object.is(value, -0)) return "0";
  const text = String(value);
  const match = /^(-?)(\d+)(?:\.(\d+))?[eE]([+-]?\d+)$/.exec(text);
  if (!match) return text;
  const sign = match[1] ?? "";
  const digits = `${match[2] ?? "0"}${match[3] ?? ""}`;
  const point = (match[2] ?? "0").length + Number(match[4]);
  if (point <= 0) return `${sign}0.${"0".repeat(-point)}${digits}`;
  if (point >= digits.length) return `${sign}${digits}${"0".repeat(point - digits.length)}`;
  return `${sign}${digits.slice(0, point)}.${digits.slice(point)}`;
}

function formatLinkUtc(utc: string): string {
  return utc.endsWith(":00Z") ? `${utc.slice(0, -4)}Z` : utc;
}

function parseFieldValue(field: ProfileField, raw: string): unknown | undefined {
  switch (field) {
    case "relay_available":
      if (raw === "true") return true;
      if (raw === "false") return false;
      return undefined;
    case "ops_sun_el_min_deg":
    case "landing_sun_el_min_deg":
    case "landing_sun_el_max_deg":
      if (raw === "null") return null;
      return parseDecimal(raw) ?? undefined;
    case "weights": {
      const parts = raw.split(":");
      if (parts.length !== 3) return undefined;
      const slope = parseDecimal(parts[0] ?? "");
      const power = parseDecimal(parts[1] ?? "");
      const comms = parseDecimal(parts[2] ?? "");
      if (slope === null || power === null || comms === null) return undefined;
      return { slope, power, comms };
    }
    default:
      return parseDecimal(raw) ?? undefined;
  }
}

function parseDecimal(raw: string): number | null {
  if (!/^-?\d+(?:\.\d+)?$/.test(raw)) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

/** Structural separators stay literal so a `%3B` inside a value is not a new field. */
function encodeProfileParam(value: string): string {
  return value
    .split(/([;=:])/)
    .map((part) => (part === ";" || part === "=" || part === ":" ? part : encodeURIComponent(part)))
    .join("");
}

function rawParam(search: string, name: string): string | null {
  const query = bareQuery(search);
  if (query.length === 0) return null;
  let found: string | null = null;
  for (const part of query.split("&")) {
    if (part.length === 0) continue;
    const eq = part.indexOf("=");
    const rawKey = eq === -1 ? part : part.slice(0, eq);
    const rawValue = eq === -1 ? "" : part.slice(eq + 1);
    const key = decodeQueryComponent(rawKey);
    if (key === name) found = rawValue;
  }
  return found;
}

function decodeQueryComponent(value: string): string | null {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return null;
  }
}

function readFocus(raw: string | null, siteIds: readonly string[], notices: string[]): string | null {
  const first = siteIds[0] ?? null;
  if (raw === null || raw.length === 0) return first;
  if (!siteIds.includes(raw)) {
    notices.push(`Ignored focus ${quote(raw)} because that site is not selected.`);
    return first;
  }
  return raw;
}

const SEPARATOR = /[;=:]/;

function decodedFieldText(field: ProfileField, raw: string): string | null {
  if (field === "weights") {
    const parts = raw.split(":");
    const decoded = parts.map((part) => decodeQueryComponent(part));
    if (decoded.some((part) => part === null || SEPARATOR.test(part))) return null;
    return decoded.join(":");
  }
  const text = decodeQueryComponent(raw);
  if (text === null || SEPARATOR.test(text)) return null;
  return text;
}

function isFieldInRange(field: ProfileField, value: unknown, grid: TimeGrid): boolean {
  switch (field) {
    case "duration_days":
      if (!isFiniteNumber(value) || value <= 0) return false;
      try {
        return windowLength(value) <= grid.count;
      } catch {
        return false;
      }
    case "min_sun_fraction":
      return isFiniteNumber(value) && value >= 0 && value <= 1;
    case "ops_sun_el_min_deg":
    case "landing_sun_el_min_deg":
    case "landing_sun_el_max_deg":
      return value === null || isFiniteNumber(value);
    case "max_dark_h":
    case "max_blackout_h":
    case "antenna_mask_deg":
      return isFiniteNumber(value) && value >= 0;
    case "max_slope_deg":
      return isFiniteNumber(value) && value > 0;
    case "slope_ideal_deg":
      return isFiniteNumber(value) && value >= 0;
    case "relay_available":
      return typeof value === "boolean";
    case "weights":
      return weightsInRange(value);
    default:
      return false;
  }
}

function applyParsed(base: MissionProfile, fields: readonly { field: ProfileField; value: unknown }[]): Draft {
  const profile = structuredClone(base);
  const changed: ProfileField[] = [];
  for (const { field, value } of fields) {
    if (fieldEqual(field, base[field], value)) continue;
    assignField(profile, field, value);
    profile.provenance = {
      ...profile.provenance,
      [field]: { kind: "assumed", reason: CHANGED_BY_YOU },
    };
    changed.push(field);
  }
  if (changed.length === 0) return { profile: structuredClone(base), changed: [] };
  profile.id = CUSTOM_ID;
  profile.name = CUSTOM_NAME;
  return { profile, changed: PROFILE_FIELDS.filter((item) => changed.includes(item)) };
}

function wholeProfileRule(profile: MissionProfile): string | null {
  if (!(profile.slope_ideal_deg < profile.max_slope_deg)) {
    return "slope_ideal_deg must be less than max_slope_deg";
  }
  const min = profile.landing_sun_el_min_deg;
  const max = profile.landing_sun_el_max_deg;
  if (min !== null && max !== null && !(min <= max)) {
    return "landing_sun_el_min_deg must not be above landing_sun_el_max_deg";
  }
  if (powerAndCommsBothZero(profile.weights)) {
    return "power and comms weights must not both be zero";
  }
  if (profile.weights.slope + profile.weights.power + profile.weights.comms <= 0) {
    return "weights must sum to more than zero";
  }
  return null;
}

/** Each weight is a finite number from 0 to `MAX_WEIGHT`. */
function weightsInRange(value: unknown): value is Weights {
  if (!isWeights(value)) return false;
  return [value.slope, value.power, value.comms].every((w) => w >= 0 && w <= MAX_WEIGHT);
}

function powerAndCommsBothZero(value: unknown): boolean {
  return isWeights(value) && value.power === 0 && value.comms === 0;
}

type Draft = { profile: MissionProfile; changed: ProfileField[] };

function applyField(
  draft: Draft,
  base: MissionProfile,
  field: ProfileField,
  value: unknown,
  grid: TimeGrid,
): boolean {
  if (!isValidValue(field, value, draft.profile, grid)) return false;
  if (!landingPairOk(draft.profile, field, value)) return false;
  const profile = structuredClone(draft.profile);
  if (fieldEqual(field, base[field], value)) {
    assignField(profile, field, cloneField(base, field));
    profile.provenance = {
      ...profile.provenance,
      [field]: structuredClone(base.provenance[field]),
    };
    draft.changed = draft.changed.filter((item) => item !== field);
  } else {
    profile.id = CUSTOM_ID;
    profile.name = CUSTOM_NAME;
    assignField(profile, field, value);
    profile.provenance = {
      ...profile.provenance,
      [field]: { kind: "assumed", reason: CHANGED_BY_YOU },
    };
    if (!draft.changed.includes(field)) draft.changed.push(field);
  }
  if (draft.changed.length === 0) {
    draft.profile = structuredClone(base);
    draft.changed = [];
  } else {
    draft.profile = profile;
    draft.changed = PROFILE_FIELDS.filter((item) => draft.changed.includes(item));
  }
  return true;
}

function isValidValue(field: ProfileField, value: unknown, profile: MissionProfile, grid: TimeGrid): boolean {
  switch (field) {
    case "duration_days":
      if (!isFiniteNumber(value) || value <= 0) return false;
      try {
        return windowLength(value) <= grid.count;
      } catch {
        return false;
      }
    case "min_sun_fraction":
      return isFiniteNumber(value) && value >= 0 && value <= 1;
    case "ops_sun_el_min_deg":
    case "landing_sun_el_min_deg":
    case "landing_sun_el_max_deg":
      return value === null || isFiniteNumber(value);
    case "max_dark_h":
    case "max_blackout_h":
    case "antenna_mask_deg":
      return isFiniteNumber(value) && value >= 0;
    case "max_slope_deg":
      return isFiniteNumber(value) && value > profile.slope_ideal_deg;
    case "slope_ideal_deg":
      return isFiniteNumber(value) && value >= 0 && value < profile.max_slope_deg;
    case "relay_available":
      return typeof value === "boolean";
    case "weights":
      return weightsInRange(value) && value.slope + value.power + value.comms > 0 && !powerAndCommsBothZero(value);
    default:
      return false;
  }
}

function landingPairOk(profile: MissionProfile, field: ProfileField, value: unknown): boolean {
  const min = field === "landing_sun_el_min_deg" ? value : profile.landing_sun_el_min_deg;
  const max = field === "landing_sun_el_max_deg" ? value : profile.landing_sun_el_max_deg;
  if (min === null || max === null) return true;
  return isFiniteNumber(min) && isFiniteNumber(max) && min <= max;
}

function assignField(profile: MissionProfile, field: ProfileField, value: unknown): void {
  switch (field) {
    case "duration_days":
    case "min_sun_fraction":
    case "max_dark_h":
    case "antenna_mask_deg":
    case "max_blackout_h":
    case "max_slope_deg":
    case "slope_ideal_deg":
      profile[field] = value as number;
      return;
    case "ops_sun_el_min_deg":
    case "landing_sun_el_min_deg":
    case "landing_sun_el_max_deg":
      profile[field] = value as number | null;
      return;
    case "relay_available":
      profile.relay_available = value as boolean;
      return;
    case "weights": {
      const weights = value as Weights;
      profile.weights = { slope: weights.slope, power: weights.power, comms: weights.comms };
      return;
    }
    default:
      return;
  }
}

function fieldEqual(field: ProfileField, current: MissionProfile[ProfileField], value: unknown): boolean {
  if (field === "weights") {
    if (!isWeights(value)) return false;
    const weights = current as Weights;
    return weights.slope === value.slope && weights.power === value.power && weights.comms === value.comms;
  }
  return current === value;
}

function cloneField(profile: MissionProfile, field: ProfileField): unknown {
  const value = profile[field];
  if (field === "weights") {
    const weights = value as Weights;
    return { slope: weights.slope, power: weights.power, comms: weights.comms };
  }
  return value;
}

function isWeights(value: unknown): value is Weights {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return isFiniteNumber(record.slope) && isFiniteNumber(record.power) && isFiniteNumber(record.comms);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isProfileField(value: string): value is ProfileField {
  return (PROFILE_FIELDS as readonly string[]).includes(value);
}

function isView(value: string): value is ViewId {
  return (VIEWS as readonly string[]).includes(value);
}

function findPreset(catalog: ScenarioCatalog, id: string): MissionProfile | undefined {
  return catalog.profiles.find((item) => item.id === id);
}

function defaultProfile(catalog: ScenarioCatalog): MissionProfile {
  const chosen = findPreset(catalog, DEFAULT_PROFILE_ID) ?? catalog.profiles[0];
  if (!chosen) throw new Error("scenario catalog has no mission profiles");
  return structuredClone(chosen);
}

function defaultLandingHour(grid: TimeGrid, durationDays: number): number {
  try {
    return clamp(utcToHourIndex(grid, DEFAULT_LANDING_UTC), 0, lastLandingHour(grid, durationDays));
  } catch {
    return 0;
  }
}

function reclampTimes(
  grid: TimeGrid,
  durationDays: number,
  landingUtc: string,
  currentUtc: string,
): { landingUtc: string; currentUtc: string } {
  let landingHour: number;
  try {
    landingHour = utcToHourIndex(grid, landingUtc);
  } catch {
    landingHour = defaultLandingHour(grid, durationDays);
  }
  landingHour = clamp(landingHour, 0, lastLandingHour(grid, durationDays));
  const nextLanding = hourIndexToUtc(grid, landingHour);
  let currentHour: number;
  try {
    currentHour = utcToHourIndex(grid, currentUtc);
  } catch {
    currentHour = landingHour;
  }
  const bounds = timelineBounds(grid, landingHour, durationDays);
  return {
    landingUtc: nextLanding,
    currentUtc: hourIndexToUtc(grid, clamp(currentHour, bounds.start, bounds.end)),
  };
}

/**
 * A new landing hour that keeps the current time's offset from landing, the link's `t`
 * (docs/data-contracts.md, "Shareable scenario link"): the scrubber moves with the
 * landing. The landing is clamped to the last hour whose window fits, and the current
 * time only to the timeline that the time grid allows.
 */
function moveLandingKeepingOffset(
  state: ScenarioData,
  landingHour: number,
): { landingUtc: string; currentUtc: string } {
  const grid = state.catalog.grid;
  const durationDays = state.profile.duration_days;
  let offset = 0;
  try {
    offset = utcToHourIndex(grid, state.currentUtc) - utcToHourIndex(grid, state.landingUtc);
  } catch {
    offset = 0;
  }
  const landing = clamp(landingHour, 0, lastLandingHour(grid, durationDays));
  const bounds = timelineBounds(grid, landing, durationDays);
  return {
    landingUtc: hourIndexToUtc(grid, landing),
    currentUtc: hourIndexToUtc(grid, clamp(landing + offset, bounds.start, bounds.end)),
  };
}

function currentFromHour(state: ScenarioData, utc: string): string | null {
  const grid = state.catalog.grid;
  let hour: number;
  try {
    hour = utcToHourIndex(grid, utc);
  } catch {
    return null;
  }
  const bounds = timelineBounds(grid, utcToHourIndex(grid, state.landingUtc), state.profile.duration_days);
  return hourIndexToUtc(grid, clamp(hour, bounds.start, bounds.end));
}

function canSelect(catalog: ScenarioCatalog, siteId: string): boolean {
  return catalog.sites.some((site) => site.id === siteId) || isCustomSiteId(siteId);
}

function sameMembers(current: readonly string[], next: readonly string[]): boolean {
  if (current.length !== next.length) return false;
  const seen = new Set<string>();
  for (const id of next) {
    if (seen.has(id) || !current.includes(id)) return false;
    seen.add(id);
  }
  return seen.size === current.length;
}

function toScenario(read: Pick<ReadScenario, "profile" | "siteIds" | "focusedSiteId" | "landingUtc" | "currentUtc">): Scenario {
  return {
    profile: read.profile,
    siteIds: read.siteIds,
    focusedSiteId: read.focusedSiteId,
    landingUtc: read.landingUtc,
    currentUtc: read.currentUtc,
  };
}

function commit(state: ScenarioData, patch: Partial<ScenarioData>): Partial<ScenarioState> {
  const profile = patch.profile ?? state.profile;
  const siteIds = patch.siteIds ?? state.siteIds;
  const focusedSiteId = patch.focusedSiteId !== undefined ? patch.focusedSiteId : state.focusedSiteId;
  const landingUtc = patch.landingUtc ?? state.landingUtc;
  const currentUtc = patch.currentUtc ?? state.currentUtc;
  const unchanged =
    profile === state.profile &&
    siteIds === state.siteIds &&
    focusedSiteId === state.focusedSiteId &&
    landingUtc === state.landingUtc &&
    currentUtc === state.currentUtc;
  return {
    ...patch,
    profile,
    siteIds,
    focusedSiteId,
    landingUtc,
    currentUtc,
    scenario: unchanged ? state.scenario : { profile, siteIds, focusedSiteId, landingUtc, currentUtc },
  };
}

function bareQuery(search: string): string {
  const query = search.indexOf("?");
  if (query >= 0) return search.slice(query + 1);
  return search.includes("=") ? search : "";
}

function quote(value: string): string {
  return `"${value}"`;
}

function clamp(value: number, start: number, end: number): number {
  if (value < start) return start;
  if (value > end) return end;
  return value;
}
