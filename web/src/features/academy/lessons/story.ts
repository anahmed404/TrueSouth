import type { MissionProfile, Scenario } from "../../../app/panel";
import type { GoalValue, SceneSpec, SkylineKind, TimeRange } from "../types";

/**
 * Pip's profile, copied from `data/catalog/profiles.json` (`im2_athena`).
 * A lesson builds its own scenario and does not read Mission Control's store.
 */
export const pipProfile: MissionProfile = {
  id: "im2_athena",
  name: "IM-2 Athena",
  based_on: "Intuitive Machines IM-2 Athena",
  duration_days: 10,
  min_sun_fraction: 0.5,
  ops_sun_el_min_deg: null,
  max_dark_h: 6,
  relay_available: false,
  antenna_mask_deg: 1,
  max_blackout_h: 12,
  max_slope_deg: 10,
  slope_ideal_deg: 5,
  landing_sun_el_min_deg: null,
  landing_sun_el_max_deg: null,
  weights: { slope: 0.4, power: 0.35, comms: 0.25 },
  provenance: {
    duration_days: {
      kind: "sourced",
      source_url: "https://www.nasa.gov/wp-content/uploads/2025/02/np-2025-02-005-jsc-clps-intuitive-machines-press-kit-508-2-25-25.pdf",
      quote: "Surface Operations: Approximately 10 days",
    },
    min_sun_fraction: { kind: "assumed", reason: "0.5 (half the disc) is assumed for all." },
    ops_sun_el_min_deg: {
      kind: "assumed",
      reason: "No operational Sun elevation limit is specified for this preset.",
    },
    max_dark_h: {
      kind: "assumed",
      reason: 'No figures are published. The lander "cannot survive lunar night"; 6 h allows a short eclipse on battery.',
    },
    relay_available: {
      kind: "assumed",
      reason: "The mission used the company's ground network, direct to Earth. We have no document to cite for this, so the value is tagged assumed.",
    },
    antenna_mask_deg: {
      kind: "assumed",
      reason: "No mission publishes a minimum Earth elevation. 1° is assumed for all.",
    },
    max_blackout_h: { kind: "assumed", reason: "No figures are published." },
    max_slope_deg: {
      kind: "assumed",
      reason: "A 10° figure appears only in a secondary source we could not read. Intuitive Machines publishes no limit.",
    },
    slope_ideal_deg: { kind: "assumed", reason: "Team settings." },
    landing_sun_el_min_deg: {
      kind: "assumed",
      reason: "No landing Sun elevation limit is specified for this preset.",
    },
    landing_sun_el_max_deg: {
      kind: "assumed",
      reason: "No landing Sun elevation limit is specified for this preset.",
    },
    weights: { kind: "assumed", reason: "Team settings." },
  },
};

/**
 * Story scenario for every lesson unless a step says otherwise: Pip, `im2_athena`,
 * at Connecting Ridge. The story says 2028 and does not name the day; this uses
 * the first instant of that year. See the questions in `lessons/COVERAGE.md`.
 */
export const storyScenario: Scenario = {
  profile: pipProfile,
  siteIds: ["connecting_ridge"],
  focusedSiteId: "connecting_ridge",
  landingUtc: "2028-01-01T00:00:00Z",
  currentUtc: "2028-01-01T00:00:00Z",
};

export function storyScene(skyline: SkylineKind, timeRange: TimeRange | null): SceneSpec {
  return { scenario: storyScenario, skyline, timeRange };
}

/** A description from the lesson doc, not final learner-facing wording. */
export function todo(description: string): string {
  return `TODO(words): ${description}`;
}

/** One month around a worked-example hour. The doc says "a month" and does not name the endpoints. */
export function oneMonth(aroundUtc: GoalValue): { kind: "span"; span: "one-month"; aroundUtc: GoalValue } {
  return { kind: "span", span: "one-month", aroundUtc };
}
