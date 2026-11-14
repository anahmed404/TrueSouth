import { SegmentedControl } from "../../../components/SegmentedControl";
import { MODE_LABELS, type CompareMode } from "./dates";
import { compareStore, useCompareState } from "./picks-store";

const OPTIONS = (["sites", "dates"] as const).map((value) => ({ value, label: MODE_LABELS[value] }));

/** Compare's two modes, beside the window's title: "Sites" and "Sites and dates". */
export function ModeSwitch() {
  const { mode } = useCompareState();
  return (
    <SegmentedControl<CompareMode>
      label="Compare"
      options={OPTIONS}
      value={mode}
      onChange={(next) => compareStore.set({ mode: next })}
      className="cmp-mode"
    />
  );
}
