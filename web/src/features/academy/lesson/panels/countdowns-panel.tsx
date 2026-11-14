import { Countdowns } from "../../../../app/mission/timeline/countdowns";
import "../../../../app/mission/timeline/timeline.css";
import { resolveValue, type WorkedExamples } from "../../placeholders";
import type { SceneSpec } from "../../types";

/**
 * Mission Control's countdowns, as they stand for the lesson's scene (lesson 4 unlocks them):
 * the Sun's and Earth's next change, from the story site's series and Pip's profile. Loaded
 * only when a screen shows them, so no other lesson carries Mission Control's timeline code.
 */
export default function CountdownsPanel({ scene, examples }: { scene: SceneSpec; examples: WorkedExamples }) {
  const text = (value: string) => {
    const resolved = resolveValue(value, examples).value;
    return typeof resolved === "string" ? resolved : value;
  };
  const sites = scene.scenario.siteIds.map(text);
  const scenario = {
    ...scene.scenario,
    siteIds: sites,
    focusedSiteId: scene.scenario.focusedSiteId ? text(scene.scenario.focusedSiteId) : (sites[0] ?? null),
    landingUtc: text(scene.scenario.landingUtc),
    currentUtc: text(scene.scenario.currentUtc),
  };
  return (
    <div className="ac-countdowns">
      <Countdowns scenario={scenario} mode="lesson" />
    </div>
  );
}
