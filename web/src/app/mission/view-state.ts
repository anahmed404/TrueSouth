import { useCallback, useMemo, useRef, useState } from "react";
import { selectView } from "../../state/scenario";
import { useScenario, useScenarioStore } from "./scenario-context";
import { HOME_CAMERA_VIEW, closeWindow, isCameraView, pickView, viewState, type CameraViewId, type ViewId, type ViewState } from "./views";

/**
 * The camera view and the open window, from the scenario's `view` (see `viewState`). The
 * camera view under a window is remembered here, in the page, not in the link.
 *
 * The object is the same from render to render until the view changes, so a scrub of the
 * current time does not re-render the view bar.
 */
export function useViewState(): ViewState {
  const view = useScenario(selectView);
  const [camera, setCamera] = useState<CameraViewId>(() => (isCameraView(view) ? view : HOME_CAMERA_VIEW));
  // Follow the scenario: a pick, Back and Forward, or a new link.
  if (isCameraView(view) && view !== camera) setCamera(view);
  const current = isCameraView(view) ? view : camera;
  return useMemo(() => viewState(view, current), [view, current]);
}

/**
 * The view bar's two commands, stable for the life of the shell: pick an entry, and close the
 * open window. They read the latest view state when called.
 */
export function useViewCommands(state: ViewState): { pick: (view: ViewId) => void; close: () => void } {
  const store = useScenarioStore();
  const latest = useRef(state);
  latest.current = state;
  const pick = useCallback((picked: ViewId) => store.getState().setView(pickView(latest.current, picked)), [store]);
  const close = useCallback(() => store.getState().setView(closeWindow(latest.current)), [store]);
  return useMemo(() => ({ pick, close }), [pick, close]);
}
