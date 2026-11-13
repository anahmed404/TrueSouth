import type { PanelProps } from "../../../app/panel";
import { PanelPlaceholder } from "../../../components/PanelPlaceholder";

export default function SystemView({ scenario }: PanelProps) {
  return <PanelPlaceholder name="SystemView" scenario={scenario} />;
}
