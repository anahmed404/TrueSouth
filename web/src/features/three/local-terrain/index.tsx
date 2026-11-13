import type { PanelProps } from "../../../app/panel";
import { PanelPlaceholder } from "../../../components/PanelPlaceholder";

export default function LocalTerrain({ scenario }: PanelProps) {
  return <PanelPlaceholder name="LocalTerrain" scenario={scenario} />;
}
