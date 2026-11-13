/**
 * SAMPLE DATA, for the Mission Control shell only.
 *
 * Everything here is invented to lay out the sites rail and the focused-site panel exactly
 * as the real content will be. It is not computed from any series, and none of it may be
 * read anywhere else. It is replaced by:
 * - MC1, the data hooks (sites and their series);
 * - MC2, the scoring and evaluation hooks (statuses, metrics, vetoes, scores);
 * - MC3, the scenario store and URL sync (selected sites, focused site, landing date).
 *
 * The numbers are the same mock numbers as the C2 prototypes in design/variants/.
 */

import type { MissionProfile, Scenario } from "../panel";
import type { FocusedSiteView } from "./focused-site-panel";
import type { SiteRowView } from "./sites-rail";

// TEMP: this placeholder names a preset without its values. MC1 loads profiles.json and MC3
// builds the real scenario from it; until then no panel may read a profile value from here.
const placeholderProfile = { id: "im2_athena" } as unknown as MissionProfile;

const ASSUMED = {
  kind: "assumed",
  reason: "Sample reason. The real reason comes from the mission profile.",
} as const;

export const SAMPLE = {
  /** Shown in the profile slot of the top bar. */
  profileName: "IM-2 Athena",
  profileDurationDays: 10,

  scenario: {
    profile: placeholderProfile,
    siteIds: ["connecting_ridge", "artemis_malapert", "artemis_mouton", "artemis_de_gerlache_rim_2", "apollo11"],
    focusedSiteId: "connecting_ridge",
    landingUtc: "2028-03-01T00:00:00Z",
    currentUtc: "2028-03-03T15:00:00Z",
  } satisfies Scenario,

  maxSites: 8,

  sites: [
    { id: "connecting_ridge", name: "Connecting Ridge", status: "NO-GO", fact: "Blackout 31 h" },
    { id: "artemis_malapert", name: "Malapert Massif", status: "GO", fact: "Score 81" },
    { id: "artemis_mouton", name: "Mons Mouton", status: "CAUTION", fact: "Score 63" },
    { id: "artemis_de_gerlache_rim_2", name: "de Gerlache Rim 2", status: "CAUTION", fact: "Score 58" },
    { id: "apollo11", name: "Apollo 11", status: "GO", fact: "Score 100", note: "Terrain not modelled" },
  ] satisfies SiteRowView[],

  focused: {
    id: "connecting_ridge",
    name: "Connecting Ridge",
    latDeg: -89.4555,
    lonEastDeg: 222.6192,
    terrainTier: "core80",
    hasCloseUpDem: true,
    status: "NO-GO",
    statusSentence: "One rule is broken, so this landing date fails.",
    unusedScore: 51,
    brokenRules: [
      {
        term: "veto_blackout",
        name: "Longest blackout",
        value: 31,
        unit: "h",
        limit: 12,
        provenance: ASSUMED,
        sentence: "Earth is out of contact for 31 hours in a row from 2028-03-09 17:00 UTC.",
        scaleMax: 31,
      },
    ],
    passingRules: [
      { term: "veto_darkness", name: "Longest dark", value: 4, unit: "h", limit: "limit 6 h", provenance: ASSUMED },
      { term: "veto_slope", name: "Slope", value: 3.1, decimals: 1, unit: "°", limit: "limit 10°", provenance: ASSUMED },
      { term: "landing_lit", name: "Lit at landing", value: 1, decimals: 2, unit: "", limit: "needs 0.5", provenance: ASSUMED },
    ],
    windowHours: 240,
    metrics: [
      { term: "lit_fraction", name: "Lit", value: 97.1, decimals: 1, unit: "%" },
      { term: "sun_fraction_mean", name: "Mean Sun disc fraction", value: 0.96, decimals: 2, unit: "" },
      { term: "longest_dark_h", name: "Longest dark stretch", value: 4, unit: "h" },
      { term: "link_fraction", name: "Earth link", value: 87.1, decimals: 1, unit: "%" },
      { term: "longest_blackout_h", name: "Longest blackout", value: 31, unit: "h", broken: true },
      { term: "landing_sun_el_deg", name: "Sun at landing", value: 0.8, decimals: 2, unit: "°" },
      { term: "slope", name: "Slope, 100 m baseline", value: 3.1, decimals: 1, unit: "°" },
      { term: "utility", name: "Utilities (slope, power, comms)", value: "1.00 · 0.32 · 0.00", unit: "" },
    ],
    links: {
      quickmap: "https://quickmap.lroc.asu.edu/",
      moonTrek: "https://trek.nasa.gov/moon/",
    },
  } satisfies FocusedSiteView,
};
