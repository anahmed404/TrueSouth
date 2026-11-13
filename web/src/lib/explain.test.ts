import { describe, expect, it } from "vitest";
import contextRaw from "../../../CONTEXT.md?raw";
import profilesRaw from "../../../docs/mission-profiles.md?raw";
import {
  explanations,
  isExplainTerm,
  type ExplainLessonId,
  type ExplainTerm,
} from "./explain";

/**
 * Glossary terms from CONTEXT.md, each with its key in explain.ts. The lists follow the
 * sections "Places", "Directions and visibility", "Time", "Mission logic", "Views" and
 * "Academy", plus Luna, Pip, Mission Control and Academy, and the "Data" terms a user
 * sees. A glossary term added to CONTEXT.md without a line here fails the drift test below.
 */
const GLOSSARY: Readonly<Record<string, readonly (readonly [term: string, key: ExplainTerm])[]>> = {
  "The product": [
    ["Mission Control", "mission_control"],
    ["Academy", "academy"],
    ["Luna", "luna"],
    ["Pip", "pip"],
  ],
  Places: [
    ["Site", "site"],
    ["Catalog site", "catalog_site"],
    ["Custom site", "custom_site"],
    ["Latitude", "latitude"],
    ["East longitude", "east_longitude"],
    ["Local frame", "local_frame"],
    ["Terrain tier", "terrain_tier"],
    ["Close-up DEM", "close_up_dem"],
    ["DEM", "dem"],
    ["Named feature", "named_feature"],
  ],
  "Directions and visibility": [
    ["Azimuth", "azimuth"],
    ["Elevation", "elevation"],
    ["Skyline", "skyline"],
    ["Skyline bin", "skyline_bin"],
    ["Blocker", "blocker"],
    ["Clearance", "clearance"],
    ["Disc fraction", "disc_fraction"],
    ["Sub-solar point", "sub_solar_point"],
    ["Sub-Earth point", "sub_earth_point"],
    ["Libration", "libration"],
  ],
  Time: [
    ["Time grid", "time_grid"],
    ["Series", "series"],
    ["Global ephemeris", "global_ephemeris"],
    ["Landing date", "landing_date"],
    ["Mission window", "mission_window"],
    ["Slip", "slip"],
  ],
  "Mission logic": [
    ["Mission profile", "mission_profile"],
    ["Preset", "preset"],
    ["Sourced", "sourced"],
    ["Assumed", "assumed"],
    ["Lit", "lit"],
    ["Dark", "dark"],
    ["Link", "link"],
    ["Blackout", "blackout"],
    ["Antenna mask", "antenna_mask"],
    ["Relay", "relay"],
    ["Metric", "metric"],
    ["Veto", "veto"],
    ["Utility", "utility"],
    ["Score", "score"],
    ["Status", "status"],
    ["Scenario", "scenario"],
    ["Selected sites", "selected_sites"],
    ["Focused site", "focused_site"],
  ],
  Views: [
    ["Slip Planner", "slip_planner"],
    ["System view", "system_view"],
    ["Polar map", "polar_map"],
    ["Local terrain", "local_terrain"],
    ["Skyline wall", "skyline_wall"],
    ["Lander's eye", "landers_eye"],
    ["Countdown", "countdown"],
    ["Scrubber", "scrubber"],
  ],
  Academy: [
    ["Lesson", "lesson"],
    ["Step", "step"],
    ["Under the hood", "under_the_hood"],
    ["Worked example", "worked_example"],
    ["XP", "xp"],
    ["Mission patch", "mission_patch"],
  ],
  Data: [
    ["Horizons", "horizons"],
    ["LOLA", "lola"],
    ["PGDA", "pgda"],
    ["DTE", "dte"],
  ],
};

/** Glossary terms that are deliberately not explained: developers meet them, users do not. */
const NOT_USER_FACING = ["TrueSouth", "Raw data", "Prepared data", "Derived data", "Fixtures"];

/** Every mission profile field in docs/mission-profiles.md, by field name. */
const PROFILE_FIELDS: readonly ExplainTerm[] = [
  "id",
  "name",
  "based_on",
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
  "provenance",
];

/** Metrics, vetoes, utilities and statuses from docs/science.md sections 9 and 10. */
const SCIENCE_TERMS: readonly ExplainTerm[] = [
  "sun_fraction_mean",
  "lit_fraction",
  "longest_dark_h",
  "link_fraction",
  "longest_blackout_h",
  "landing_sun_el_deg",
  "landing_lit",
  "veto_slope",
  "veto_darkness",
  "veto_blackout",
  "veto_landing_dark",
  "veto_landing_sun_low",
  "veto_landing_sun_high",
  "utility_slope",
  "utility_power",
  "utility_comms",
  "go",
  "caution",
  "no_go",
];

/** The six Mission Control views (docs/features/mission-control.md, "Views"). */
const SIX_VIEWS: readonly ExplainTerm[] = [
  "slip_planner",
  "polar_map",
  "system_view",
  "local_terrain",
  "landers_eye",
  "compare",
];

/** The eight lesson ids in web/src/features/academy/catalog.ts. */
const LESSON_IDS = [
  "l1_sun",
  "l2_skyline",
  "l3_horizon",
  "l4_link",
  "l5_slope",
  "l6_tradeoffs",
  "l7_slip",
  "l8_mission",
] as const satisfies readonly ExplainLessonId[];

// The docs may be checked out with Windows line endings.
const contextMarkdown = contextRaw.replace(/\r\n/g, "\n");
const profilesMarkdown = profilesRaw.replace(/\r\n/g, "\n");

const ALL_KEYS = Object.keys(explanations);

function textOf(key: string): string {
  const entry = explanations[key];
  if (!entry) throw new Error(`No explanation for "${key}"`);
  return entry.text;
}

/** Counts sentences: a full stop, question mark or exclamation mark before a space or the end. */
function sentenceCount(text: string): number {
  return (text.match(/[.!?](?=\s|$)/g) ?? []).length;
}

/** The bold terms in the first column of one "##" section of CONTEXT.md. */
function glossaryTermsIn(section: string): string[] {
  const start = contextMarkdown.indexOf(`\n## ${section}\n`);
  if (start < 0) throw new Error(`CONTEXT.md has no section "${section}"`);
  const rest = contextMarkdown.slice(start + 1);
  const next = rest.indexOf("\n## ", 3);
  const body = next < 0 ? rest : rest.slice(0, next);
  return [...body.matchAll(/^\|\s*\*\*(.+?)\*\*\s*\|/gm)].map((match) => match[1] as string);
}

describe("every glossary term has an explanation", () => {
  for (const [section, pairs] of Object.entries(GLOSSARY)) {
    for (const [term, key] of pairs) {
      it(`${section}: ${term} (${key})`, () => {
        expect(isExplainTerm(key)).toBe(true);
        expect(textOf(key).length).toBeGreaterThan(0);
      });
    }
  }

  it("keeps the test's glossary list in step with CONTEXT.md", () => {
    const listed = new Set<string>(NOT_USER_FACING);
    for (const pairs of Object.values(GLOSSARY)) for (const [term] of pairs) listed.add(term);

    const inContext = [
      ...glossaryTermsIn("The product"),
      ...glossaryTermsIn("Places"),
      ...glossaryTermsIn("Directions and visibility"),
      ...glossaryTermsIn("Time"),
      ...glossaryTermsIn("Mission logic"),
      ...glossaryTermsIn("Views"),
      ...glossaryTermsIn("Academy"),
      ...glossaryTermsIn("Data"),
    ];
    expect(inContext.length).toBeGreaterThan(60);

    const missing = inContext.filter((term) => !listed.has(term));
    expect(missing, "add these CONTEXT.md terms to GLOSSARY or NOT_USER_FACING").toEqual([]);

    const inContextSet = new Set(inContext);
    const stale = [...listed].filter((term) => !inContextSet.has(term));
    expect(stale, "these terms are no longer in CONTEXT.md").toEqual([]);
  });
});

describe("every mission profile field has an explanation", () => {
  for (const field of PROFILE_FIELDS) {
    it(field, () => {
      expect(isExplainTerm(field)).toBe(true);
    });
  }

  it("lists every field named in docs/mission-profiles.md", () => {
    const start = profilesMarkdown.indexOf("\n## Fields\n");
    expect(start).toBeGreaterThan(-1);
    const rest = profilesMarkdown.slice(start + 1);
    const section = rest.slice(0, rest.indexOf("\n## ", 3));
    const named = [...section.matchAll(/^\|\s*((?:`[a-z_]+`(?:,\s*)?)+)\s*\|/gm)].flatMap((row) =>
      [...(row[1] as string).matchAll(/`([a-z_]+)`/g)].map((m) => m[1] as string),
    );
    expect(named.length).toBeGreaterThan(10);
    expect([...named].sort()).toEqual([...PROFILE_FIELDS].sort());
  });
});

describe("metrics, vetoes, utilities and statuses have explanations", () => {
  for (const key of SCIENCE_TERMS) {
    it(key, () => {
      expect(isExplainTerm(key)).toBe(true);
    });
  }
});

describe("the six views", () => {
  it("each say what the user is looking at", () => {
    for (const key of SIX_VIEWS) expect(textOf(key).length).toBeGreaterThan(40);
  });

  it("say that the System view and the Local terrain are 3D", () => {
    expect(textOf("system_view")).toMatch(/\b3D\b/);
    expect(textOf("local_terrain")).toMatch(/\b3D\b/);
    expect(textOf("system_view")).toMatch(/dragging/);
    expect(textOf("local_terrain")).toMatch(/dragging/);
  });

  it("say that the flat views are flat", () => {
    expect(textOf("slip_planner")).toMatch(/\bflat\b/);
    expect(textOf("polar_map")).toMatch(/\bflat\b/);
    expect(textOf("landers_eye")).toMatch(/\b2D\b/);
  });

  it("explain the Lander's eye as a full circle unrolled into a strip", () => {
    const text = textOf("landers_eye");
    expect(text).toMatch(/standing at the site/);
    expect(text).toMatch(/full circle/);
    expect(text).toMatch(/unrolled/);
    expect(text).toMatch(/strip/);
    expect(text).toMatch(/Sun and Earth/);
    expect(text).toMatch(/true angles above the skyline/);
  });
});

describe("the shape of every entry", () => {
  it("has at least the keys the tests above expect", () => {
    expect(ALL_KEYS.length).toBeGreaterThan(110);
  });

  it("uses snake_case keys", () => {
    for (const key of ALL_KEYS) expect(key).toMatch(/^[a-z][a-z0-9]*(_[a-z0-9]+)*$/);
  });

  for (const key of ALL_KEYS) {
    describe(key, () => {
      const text = textOf(key);

      it("is not empty", () => {
        expect(text.trim().length).toBeGreaterThan(0);
        expect(text).toBe(text.trim());
      });

      it("is at most 320 characters", () => {
        expect(text.length).toBeLessThanOrEqual(320);
      });

      it("is one or two sentences", () => {
        const count = sentenceCount(text);
        expect(count).toBeGreaterThanOrEqual(1);
        expect(count).toBeLessThanOrEqual(2);
        expect(text).toMatch(/[.!?]$/);
      });

      it("has no formula in it", () => {
        expect(text).not.toMatch(/[=$\\^<>]/);
        expect(text).not.toMatch(/\b(sin|cos|tan|atan|arctan|arccos|arcsin|sqrt|log)\s*\(/i);
        expect(text).not.toMatch(/[×÷√∑]/);
      });

      it("uses British spelling", () => {
        expect(text).not.toMatch(/\b(center|meter|kilometer|color|normalize|favorite|analyze)s?\b/i);
      });

      it("has no timestamp or measured site value", () => {
        // Times come from data; so do per-site numbers such as heights and distances in km.
        expect(text).not.toMatch(/\b\d{4}-\d{2}-\d{2}/);
        expect(text).not.toMatch(/\b\d+(\.\d+)?\s*(km|kilometres)\b/);
      });
    });
  }
});

describe("lesson links", () => {
  const catalogIds: readonly string[] = LESSON_IDS;

  it("only use lesson ids that exist", () => {
    for (const key of ALL_KEYS) {
      const lesson = explanations[key]?.lesson;
      if (lesson !== undefined) {
        expect(catalogIds, `"${key}" links to unknown lesson "${lesson}"`).toContain(lesson);
      }
    }
  });

  it("are filled in for a good share of the entries, and are left out for the rest", () => {
    const linked = ALL_KEYS.filter((key) => explanations[key]?.lesson !== undefined);
    expect(linked.length).toBeGreaterThan(20);
    expect(linked.length).toBeLessThan(ALL_KEYS.length);
  });

  it("points each lesson's own idea at that lesson", () => {
    expect(explanations["sub_solar_point"]?.lesson).toBe("l1_sun");
    expect(explanations["skyline"]?.lesson).toBe("l2_skyline");
    expect(explanations["local_terrain"]?.lesson).toBe("l3_horizon");
    expect(explanations["antenna_mask"]?.lesson).toBe("l4_link");
    expect(explanations["slope"]?.lesson).toBe("l5_slope");
    expect(explanations["veto"]?.lesson).toBe("l6_tradeoffs");
    expect(explanations["slip"]?.lesson).toBe("l7_slip");
    expect(explanations["mission_control"]?.lesson).toBe("l8_mission");
  });
});

describe("isExplainTerm", () => {
  it("accepts a real term and rejects others", () => {
    expect(isExplainTerm("antenna_mask")).toBe(true);
    expect(isExplainTerm("antenna_masks")).toBe(false);
    expect(isExplainTerm("toString")).toBe(false);
  });
});
