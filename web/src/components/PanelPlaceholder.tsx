import type { Scenario } from "../app/panel";
import { formatUtc } from "./format";

type PanelPlaceholderProps = {
  name: string;
  scenario: Scenario;
};

/**
 * Stands in for a panel that is not built yet. It fills the box the shell gives it, so
 * the layout can be judged before the panel exists, and says which scenario it would show.
 */
export function PanelPlaceholder({ name, scenario }: PanelPlaceholderProps) {
  return (
    <section className="placeholder" aria-label={`${name}, not built yet`}>
      <span className="placeholder-name">{name}</span>
      <span>Not built yet. It will show the scenario at {formatUtc(scenario.currentUtc)}.</span>
    </section>
  );
}
