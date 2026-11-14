import { useStore } from "zustand";
import { usePhone } from "../../../app/mission/shell-hooks";
import type { FlatLayer, FlatLayerProps } from "../../../app/scene";
import { slipStore } from "./slip-store";
import { SlipPlannerScene } from "./spots-layer";

/**
 * The Slip Planner over the scene, as a flat layer of the scene slot (`FlatLayer` in
 * app/scene.ts), the same mechanism as the Polar map's. Its view never shows the shell's still
 * picture: with 3D off it draws the flat Polar map under the same spots.
 */
function SlipPlannerLayer(props: FlatLayerProps) {
  const phone = usePhone();
  const projector = useStore(slipStore, (s) => s.projector);
  if (props.view !== "slip") return null;
  return (
    <SlipPlannerScene
      projector={projector}
      mode={props.mode}
      canTryAgain={props.canTryAgain}
      onTryAgain={props.onTryAgain}
      freeSpace={props.freeSpace}
      scenario={props.scenario}
      phone={phone}
      reduceMotion={props.reduceMotion}
      onFocusSite={props.onFocusSite}
    />
  );
}

export const SLIP_PLANNER_LAYER: FlatLayer = { views: ["slip"], Layer: SlipPlannerLayer };
