import { Check, Share2, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { Button, IconButton } from "../../../components/Button";
import { Popover, type PopoverHandle } from "../../../components/Popover";
import { useScenarioStore } from "../../../app/mission/scenario-context";
import { currentScenarioLink } from "./share-link";
import "./share.css";

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
 * scrubber, and says so to screen readers.
 *
 * When the clipboard is blocked, the link opens selected in the shell's popover (the same
 * top layer as the profile editor), so no panel covers it. Escape or a click outside
 * closes it, focus returns to Share, and the shell's Escape order (a popover before the
 * window) keeps an open Compare window open.
 */
export function ShareButton() {
  const store = useScenarioStore();
  const [copied, setCopied] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [link, setLink] = useState("");
  const timer = useRef<number | undefined>(undefined);
  const popover = useRef<PopoverHandle>(null);
  const fieldId = useId();
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    window.clearTimeout(timer.current);
    const next = currentScenarioLink(store.getState());
    setLink(next);
    if (await writeClipboard(next)) {
      setBlocked(false);
      popover.current?.close();
      setCopied(true);
      timer.current = window.setTimeout(() => setCopied(false), 2400);
    } else {
      setCopied(false);
      setBlocked(true);
      popover.current?.open();
    }
  };

  return (
    <span className="share">
      <Popover
        label="Link to this scenario"
        width={420}
        align="end"
        className="share-fallback"
        handleRef={popover}
        trigger={({ popoverTarget: _toggle, ...props }) => (
          <Button
            {...props}
            size="md"
            className="share-button"
            icon={copied ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Share2 size={16} strokeWidth={1.8} aria-hidden="true" />}
            onClick={copy}
            aria-label="Share: copy a link to this scenario"
          >
            <span className="share-word">{copied ? "Copied" : "Share"}</span>
          </Button>
        )}
      >
        {(close) => (
          <div className="share-fallback-body">
            <label htmlFor={fieldId} className="share-fallback-label">
              The browser blocked copying. Copy this link:
            </label>
            <span className="share-fallback-row">
              <input
                id={fieldId}
                data-autofocus
                className="share-fallback-field"
                readOnly
                value={link}
                onFocus={(event) => event.currentTarget.select()}
              />
              <IconButton label="Close" icon={<X size={16} strokeWidth={1.8} />} onClick={close} />
            </span>
          </div>
        )}
      </Popover>
      <span className="sr-only" role="status">
        {copied ? "Link to this scenario copied." : blocked ? "Could not copy. The link is selected in a box under the Share button: copy it by hand." : ""}
      </span>
    </span>
  );
}
