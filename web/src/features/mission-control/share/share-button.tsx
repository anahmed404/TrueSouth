import { Check, Share2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, IconButton } from "../../../components/Button";
import { useScenarioStore } from "../../../app/mission/scenario-context";
import { currentScenarioLink } from "./share-link";
import "./share.css";

type ShareState = { kind: "idle" } | { kind: "copied" } | { kind: "blocked"; link: string };

/** Writes text to the clipboard; false when the browser refuses or has no clipboard. */
async function writeClipboard(text: string): Promise<boolean> {
  try {
    if (!navigator.clipboard?.writeText) return false;
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * The app bar's Share control (docs/features/share-export.md, "Share a link"). It copies
 * the link to the current scenario, built from the store so it is never behind the
 * scrubber, and says so to screen readers. When the clipboard is blocked, a small field
 * under the button holds the link, selected, ready to copy by hand.
 */
export function ShareButton() {
  const store = useScenarioStore();
  const [state, setState] = useState<ShareState>({ kind: "idle" });
  const timer = useRef<number | undefined>(undefined);
  const fieldRef = useRef<HTMLInputElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const fieldId = useId();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  useEffect(() => {
    if (state.kind !== "blocked") return;
    fieldRef.current?.focus();
    fieldRef.current?.select();
  }, [state]);

  const copy = async () => {
    window.clearTimeout(timer.current);
    const link = currentScenarioLink(store.getState());
    if (await writeClipboard(link)) {
      setState({ kind: "copied" });
      timer.current = window.setTimeout(() => setState({ kind: "idle" }), 2400);
    } else {
      setState({ kind: "blocked", link });
    }
  };

  const closeFallback = () => {
    setState({ kind: "idle" });
    buttonRef.current?.focus();
  };

  return (
    <span className="share">
      <Button
        ref={buttonRef}
        size="md"
        className="share-button"
        icon={state.kind === "copied" ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Share2 size={16} strokeWidth={1.8} aria-hidden="true" />}
        onClick={copy}
        aria-label="Share: copy a link to this scenario"
        aria-expanded={state.kind === "blocked"}
        aria-controls={state.kind === "blocked" ? fieldId : undefined}
      >
        <span className="share-word">{state.kind === "copied" ? "Copied" : "Share"}</span>
      </Button>
      <span className="sr-only" role="status">
        {state.kind === "copied" ? "Link to this scenario copied." : state.kind === "blocked" ? "Could not copy. The link is selected in a field below the Share button: copy it by hand." : ""}
      </span>
      {state.kind === "blocked" ? (
        <span className="share-fallback panel" role="group" aria-label="Link to this scenario">
          <label htmlFor={fieldId} className="share-fallback-label">
            The browser blocked copying. Copy this link:
          </label>
          <span className="share-fallback-row">
            <input
              ref={fieldRef}
              id={fieldId}
              className="share-fallback-field"
              readOnly
              value={state.link}
              onFocus={(event) => event.currentTarget.select()}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.stopPropagation();
                  closeFallback();
                }
              }}
            />
            <IconButton label="Close" icon={<X size={16} strokeWidth={1.8} />} onClick={closeFallback} />
          </span>
        </span>
      ) : null}
    </span>
  );
}
