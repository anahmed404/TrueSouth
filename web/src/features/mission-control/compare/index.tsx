import type { PanelProps } from "../../../app/panel";
import { PanelPlaceholder } from "../../../components/PanelPlaceholder";

export default function Compare({ scenario }: PanelProps) {
  return <PanelPlaceholder name="Compare" scenario={scenario} />;
}
