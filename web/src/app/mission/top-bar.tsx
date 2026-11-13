import { Check, ChevronDown, Share2 } from "lucide-react";
import { memo, useEffect, useRef, useState } from "react";
import { Link } from "react-router";
import { BrandMark } from "../../components/BrandMark";
import { Button } from "../../components/Button";
import { Popover } from "../../components/Popover";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { profileTitle } from "./profile-fields";
import { ProfileEditor } from "./profile-editor";
import { formatLimit } from "./rules";
import { useScenario } from "./scenario-context";

/**
 * The Mission Control app bar: three floating blocks over the scene (brand and mode switch,
 * the profile picker, Share). The landing date lives in the bottom strip, with the timeline
 * it starts (`LandingDateControl`). It reads only the profile from the scenario, so moving
 * the current time does not re-render it.
 */
export const TopBar = memo(function TopBar() {
  return (
    <header className="shell-top">
      <div className="appbar-block appbar-brand">
        <BrandMark />
        <ModeSwitch current="mission" />
      </div>
      <div className="shell-top-spacer" />
      <ProfilePicker />
      <ShareButton />
    </header>
  );
});

/** Mission Control or Academy. A navigation, so each mode is a link. */
export function ModeSwitch({ current }: { current: "mission" | "academy" }) {
  return (
    <nav aria-label="Mode" className="seg seg-accent">
      <Link to="/mission" className="seg-option" aria-current={current === "mission" ? "page" : undefined}>
        Mission Control
      </Link>
      <Link to="/academy" className="seg-option" aria-current={current === "academy" ? "page" : undefined}>
        Academy
      </Link>
    </nav>
  );
}

function ProfilePicker() {
  const profile = useScenario((s) => s.profile);
  const changedCount = useScenario((s) => s.changedFields.length);
  const baseName = useScenario((s) => s.catalog.profiles.find((p) => p.id === s.basePresetId)?.name ?? s.basePresetId);
  const title = profileTitle(profile, changedCount, baseName);
  const duration = formatLimit(profile.duration_days, "d");

  return (
    <div className="field field-profile">
      <Popover
        label="Mission profile"
        width={440}
        align="end"
        trigger={(props) => (
          <button {...props} type="button" className="field-trigger" aria-label={`Mission profile: ${title}. Change`}>
            <span className="field-label">Mission profile</span>
            <span className="field-value field-value-clip">{title}</span>
            <ChevronDown className="field-icon" size={14} strokeWidth={1.8} aria-hidden="true" />
          </button>
        )}
      >
        {(close) => <ProfileEditor onChosen={close} />}
      </Popover>
      <span className="field-sub tabular" aria-label={`Duration ${duration}`}>
        {duration}
      </span>
      <ProvenanceTag provenance={profile.provenance.duration_days} />
    </div>
  );
}

/** Copies the address, which is always the current scenario. */
function ShareButton() {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    window.clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(window.location.href);
      setState("copied");
    } catch {
      setState("failed");
    }
    timer.current = window.setTimeout(() => setState("idle"), 2400);
  };

  return (
    <span className="share">
      <Button
        size="md"
        className="share-button"
        icon={state === "copied" ? <Check size={16} strokeWidth={2} aria-hidden="true" /> : <Share2 size={16} strokeWidth={1.8} aria-hidden="true" />}
        onClick={copy}
        aria-label="Share: copy a link to this scenario"
      >
        <span className="share-word">{state === "copied" ? "Copied" : "Share"}</span>
      </Button>
      <span className="sr-only" role="status">
        {state === "copied" ? "Link copied." : state === "failed" ? "Could not copy. The link is in the address bar." : ""}
      </span>
      {state === "failed" ? <span className="share-failed">Copy the address bar</span> : null}
    </span>
  );
}
