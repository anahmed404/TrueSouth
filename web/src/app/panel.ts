// TEMP: replace with the generated type when S0 lands
type MissionProfile = Record<string, unknown>;

export type { MissionProfile };

export type Scenario = {
  profile: MissionProfile;
  siteIds: string[];
  focusedSiteId: string | null;
  landingUtc: string;
  currentUtc: string;
};

export type PanelProps = {
  scenario: Scenario;
  onScenarioChange?: (patch: Partial<Scenario>) => void;
  mode: "mission" | "lesson";
  marker?: { azDeg: number } | null;
  onMarkerChange?: (marker: { azDeg: number } | null) => void;
};
