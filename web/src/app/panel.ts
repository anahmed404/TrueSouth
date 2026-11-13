import type { MissionProfile } from "../contracts/generated";

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
