import { AppWindow } from "lucide-react";
import { memo, useEffect, useRef, type Ref, type RefObject } from "react";
import { Explain } from "../../components/Explain";
import { firstSentence } from "../../components/format";
import { explanations } from "../../lib/explain";
import { NoticeStrip } from "./notice-strip";
import { CAMERA_VIEWS, WINDOW_VIEWS, cameraView, type ViewId, type ViewState, type WindowViewId } from "./views";

/** The window buttons, so focus can return to the one that opened a window. */
export type WindowButtons = RefObject<Partial<Record<WindowViewId, HTMLButtonElement | null>>>;

export function windowElementId(id: WindowViewId): string {
  return `window-${id}`;
}

type ViewBarProps = {
  state: ViewState;
  onPick: (view: ViewId) => void;
  windowButtons: WindowButtons;
};

/**
 * The view bar: the five camera views, a hairline, then the floating window with its
 * window icon (docs/features/mission-control.md, "The view bar"). The selected camera view
 * has a Raised fill and a Moonlight underline; an open window's button is `aria-expanded`.
 */
export const ViewBar = memo(function ViewBar({ state, onPick, windowButtons }: ViewBarProps) {
  const barRef = useRef<HTMLElement>(null);

  // On a phone the bar scrolls sideways: keep the selected view in sight.
  useEffect(() => {
    const bar = barRef.current;
    const current = bar?.querySelector<HTMLElement>('[aria-current="true"]');
    if (!bar || !current || bar.scrollWidth <= bar.clientWidth) return;
    const left = current.offsetLeft - bar.clientWidth / 2 + current.offsetWidth / 2;
    bar.scrollTo({ left: Math.max(0, left) });
  }, [state.camera]);

  return (
    <nav ref={barRef} className="panel view-bar" aria-label="Views">
      {CAMERA_VIEWS.map((view) => (
        <button
          key={view.id}
          type="button"
          className="view-bar-item"
          aria-current={state.camera === view.id ? "true" : undefined}
          onClick={() => onPick(view.id)}
        >
          {view.name}
        </button>
      ))}
      <span className="view-bar-rule" aria-hidden="true" />
      {WINDOW_VIEWS.map((view) => (
        <button
          key={view.id}
          ref={(node) => {
            windowButtons.current[view.id] = node;
          }}
          type="button"
          className="view-bar-item"
          aria-expanded={state.window === view.id}
          aria-controls={state.window === view.id ? windowElementId(view.id) : undefined}
          onClick={() => onPick(view.id)}
        >
          {view.name}
          <AppWindow className="view-bar-icon" size={14} strokeWidth={1.8} aria-hidden="true" />
        </button>
      ))}
    </nav>
  );
});

/**
 * The camera view's one sentence, on a plate under the view bar, then any notices about the
 * link. The sentence is the first sentence of the view's entry in explain.ts.
 */
export const ViewSentence = memo(function ViewSentence({ camera, ref }: { camera: ViewState["camera"]; ref?: Ref<HTMLDivElement> }) {
  const view = cameraView(camera);
  return (
    <div ref={ref} className="view-sentence-stack">
      <p className="plate view-sentence" aria-live="polite">
        {firstSentence(explanations[view.term]?.text ?? "")} <Explain term={view.term} label={view.name} />
      </p>
      <NoticeStrip />
    </div>
  );
});
