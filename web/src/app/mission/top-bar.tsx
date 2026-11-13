import { ChevronDown } from "lucide-react";
import { memo } from "react";
import { Link } from "react-router";
import { BrandMark } from "../../components/BrandMark";
import { Popover } from "../../components/Popover";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { profileTitle } from "./profile-fields";
import { ProfileEditor } from "./profile-editor";
import { formatLimit } from "./rules";
import { ShareButton } from "../../features/mission-control/share/share-button";
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
