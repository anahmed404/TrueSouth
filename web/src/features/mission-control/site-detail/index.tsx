import type { PanelProps } from "../../../app/panel";
import { PanelPlaceholder } from "../../../components/PanelPlaceholder";

export function Timeline({ scenario }: PanelProps) {
  return <PanelPlaceholder name="Timeline" scenario={scenario} />;
}

export function Countdowns({ scenario }: PanelProps) {
  return <PanelPlaceholder name="Countdowns" scenario={scenario} />;
}

export default Timeline;
