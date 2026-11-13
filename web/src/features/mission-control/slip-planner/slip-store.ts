import { createStore, type StoreApi } from "zustand/vanilla";
import type { Zoom } from "./model";

/**
 * The Slip Planner's view state, shared by the spots over the scene and the landing-date
 * panel. None of it is in the scenario or the link: the landing date itself lives only in
 * the scenario store, which the slider, the strips and the app bar's buttons all write.
 */
export type SlipUiState = {
  /** The zoom picked, or null for the default (18 months; 3 months on a phone). */
  zoom: Zoom | null;
  /** The first visible day, or null to place it around the landing day. */
  start: number | null;
  /** NASA's average sunlight on the ground: on when the view first opens. */
  shading: boolean;
  /** The landing hour when the view opened, or when the comparison was last cleared. */
  baselineHour: number | null;
  /** The landing hour before the first change of date: set once the date has changed. */
  fromHour: number | null;
  setZoom: (zoom: Zoom) => void;
  setStart: (start: number | null) => void;
  setShading: (on: boolean) => void;
  /** Called with each landing hour seen in the view: the first change starts the comparison. */
  observeLanding: (hour: number) => void;
  /** The cross on the summary: forget the comparison; the next change starts a new one. */
  clearComparison: (hour: number) => void;
  /** Leaving the view forgets the comparison and the panning. */
  leave: () => void;
};

export function createSlipStore(): StoreApi<SlipUiState> {
  return createStore<SlipUiState>((set, get) => ({
    zoom: null,
    start: null,
    shading: true,
    baselineHour: null,
    fromHour: null,
    setZoom: (zoom) => set({ zoom, start: null }),
    setStart: (start) => set({ start }),
    setShading: (shading) => set({ shading }),
    observeLanding: (hour) => {
      const { baselineHour, fromHour } = get();
      if (baselineHour === null) set({ baselineHour: hour });
      else if (fromHour === null && hour !== baselineHour) set({ fromHour: baselineHour });
    },
    clearComparison: (hour) => set({ fromHour: null, baselineHour: hour }),
    leave: () => set({ baselineHour: null, fromHour: null, start: null }),
  }));
}

/** The one Slip Planner of the page's Mission Control. */
export const slipStore = createSlipStore();

/** The landing hour to compare with, or null: only after a slip, and not back on the same date. */
export function comparisonHour(state: Pick<SlipUiState, "fromHour">, landingHour: number): number | null {
  return state.fromHour !== null && state.fromHour !== landingHour ? state.fromHour : null;
}
