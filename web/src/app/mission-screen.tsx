import { useState, type ComponentType } from "react";
import type { MissionProfile, PanelProps, Scenario } from "./panel";
import SlipPlanner from "../features/mission-control/slip-planner";
import Compare from "../features/mission-control/compare";
import { Countdowns, Timeline } from "../features/mission-control/site-detail";
import LandersEye from "../features/panorama";
import PolarMap from "../features/polar-map";
import LocalTerrain from "../features/three/local-terrain";
import SystemView from "../features/three/system-view";

// TEMP: this placeholder names a preset without its values. MC1 loads profiles.json and MC3
// builds the real scenario from it; until then no panel may read a profile value from here.
const placeholderProfile = { id: "im2_athena" } as unknown as MissionProfile;

const sampleScenario: Scenario = {
  profile: placeholderProfile,
  siteIds: [],
  focusedSiteId: null,
  landingUtc: "2028-03-01T00:00:00Z",
  currentUtc: "2028-03-01T00:00:00Z",
};

const tabs: { id: string; label: string; Panel: ComponentType<PanelProps> }[] = [
  { id: "slip", label: "Slip Planner", Panel: SlipPlanner },
  { id: "map", label: "Polar map", Panel: PolarMap },
  { id: "system", label: "System view", Panel: SystemView },
  { id: "terrain", label: "Local terrain", Panel: LocalTerrain },
  { id: "panorama", label: "Lander's eye", Panel: LandersEye },
  { id: "compare", label: "Compare", Panel: Compare },
];

export function MissionScreen() {
  const [view, setView] = useState(tabs[0]?.id ?? "slip");
  const active = tabs.find((tab) => tab.id === view) ?? tabs[0];

  return (
    <main>
      <h1>Mission Control</h1>
      <div>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            aria-pressed={tab.id === view}
            onClick={() => setView(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {active ? <active.Panel scenario={sampleScenario} mode="mission" /> : null}
      <section>
        <h2>Bottom strip</h2>
        <Timeline scenario={sampleScenario} mode="mission" />
        <Countdowns scenario={sampleScenario} mode="mission" />
      </section>
    </main>
  );
}
