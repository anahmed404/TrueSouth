import { AppWindow } from "lucide-react";
import { memo, useEffect, useId, useRef, type Ref, type RefObject } from "react";
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

/** The camera view's one sentence: the first sentence of its entry in explain.ts. */
export function viewSentence(camera: ViewState["camera"]): string {
  return firstSentence(explanations[cameraView(camera).term]?.text ?? "");
}

/**
 * The view bar: the four camera views, the current view's "About" button, a hairline, then
 * the floating windows with their window icon (docs/features/mission-control.md, "The view
 * bar"). The selected camera view has a Raised fill and a Moonlight underline; an open
 * window's button is `aria-expanded`.
 *
 * The view's sentence is not drawn on screen: it is the "About" button's text and the current
 * tab's accessible description, and it is read out politely when the view changes.
 */
export const ViewBar = memo(function ViewBar({ state, onPick, windowButtons }: ViewBarProps) {
  const barRef = useRef<HTMLElement>(null);
  const descriptionId = `view-description-${useId()}`;
  const current = cameraView(state.camera);

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
      {CAMERA_VIEWS.map((view) =>
        state.camera === view.id ? (
          <span key={view.id} className="view-bar-current">
            <button
              type="button"
              className="view-bar-item"
              aria-current="true"
              aria-describedby={descriptionId}
              onClick={() => onPick(view.id)}
            >
              {view.name}
            </button>
            <span className="view-bar-about">
              <Explain term={current.term} label={current.name} />
            </span>
          </span>
        ) : (
          <button key={view.id} type="button" className="view-bar-item" onClick={() => onPick(view.id)}>
            {view.name}
          </button>
        ),
      )}
      <p id={descriptionId} className="sr-only" aria-live="polite">
        {viewSentence(state.camera)}
      </p>
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
 * Any notices about the link, under the view bar. The view's sentence used to sit here on a
 * plate; it now lives in the view bar's "About" button, so the scene keeps the room.
 */
export const ViewNotices = memo(function ViewNotices({ ref }: { ref?: Ref<HTMLDivElement> }) {
  return (
    <div ref={ref} className="view-notices">
      <NoticeStrip />
    </div>
  );
});
