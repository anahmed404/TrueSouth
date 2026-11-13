import type { MissionProfile } from "../../../app/panel";

const sampleValue = { kind: "assumed", reason: "Sample value for the step runner. Not a real mission." } as const;

/**
 * A complete mission profile for the sample lesson and the runner's tests.
 * Every value is a toy number marked assumed. It describes no real mission; A5 replaces
 * the sample lesson, and real lessons take their profile from profiles.json.
 */
export const sampleProfile: MissionProfile = {
  id: "sample",
  name: "Sample",
  based_on: "No real mission",
  duration_days: 1,
  min_sun_fraction: 0.5,
  ops_sun_el_min_deg: null,
  max_dark_h: 1,
  relay_available: false,
  antenna_mask_deg: 1,
  max_blackout_h: 1,
  max_slope_deg: 10,
  slope_ideal_deg: 5,
  landing_sun_el_min_deg: null,
  landing_sun_el_max_deg: null,
  weights: { slope: 1, power: 1, comms: 1 },
  provenance: {
    duration_days: sampleValue,
    min_sun_fraction: sampleValue,
    ops_sun_el_min_deg: sampleValue,
    max_dark_h: sampleValue,
    relay_available: sampleValue,
    antenna_mask_deg: sampleValue,
    max_blackout_h: sampleValue,
    max_slope_deg: sampleValue,
    slope_ideal_deg: sampleValue,
    landing_sun_el_min_deg: sampleValue,
    landing_sun_el_max_deg: sampleValue,
    weights: sampleValue,
  },
};
