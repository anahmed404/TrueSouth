import { CalendarDays, ChevronDown, Share2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router";
import { BrandMark } from "../../components/BrandMark";
import { formatUtc } from "../../components/format";

type TopBarProps = {
  profileName: string;
  profileDurationDays: number;
  landingUtc: string;
};

/**
 * The Mission Control top bar: brand, mode switch, then three slots that are built later
 * with real data (the profile picker, the landing-date picker and share). The slots have
 * their final size and wording, drawn with a dashed edge and marked "placeholder".
 */
export function TopBar({ profileName, profileDurationDays, landingUtc }: TopBarProps) {
  return (
    <header className="shell-top">
      <BrandMark />
      <ModeSwitch current="mission" />
      <div className="shell-top-spacer" />
      <PlaceholderSlot label="Mission profile" icon={<ChevronDown size={14} strokeWidth={1.8} aria-hidden="true" />}>
        <span className="slot-value">{profileName}</span>
        <span className="slot-sub">{profileDurationDays} d</span>
      </PlaceholderSlot>
      <PlaceholderSlot label="Landing date" icon={<CalendarDays size={14} strokeWidth={1.8} aria-hidden="true" />}>
        <span className="slot-value tabular">
          {formatUtc(landingUtc, { withZone: false })} <small>UTC</small>
        </span>
      </PlaceholderSlot>
      <PlaceholderSlot label="Share" icon={<Share2 size={14} strokeWidth={1.8} aria-hidden="true" />} compact />
    </header>
  );
}

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

type PlaceholderSlotProps = {
  label: string;
  icon?: ReactNode;
  compact?: boolean;
  children?: ReactNode;
};

/** A top-bar control that is not built yet: final size, dashed edge, not interactive. */
function PlaceholderSlot({ label, icon, compact = false, children }: PlaceholderSlotProps) {
  return (
    <div className={compact ? "slot slot-compact" : "slot"} role="group" aria-label={`${label}, placeholder`}>
      {compact ? null : <span className="slot-label">{label}</span>}
      {children}
      {compact ? (
        <span className="slot-value-quiet">
          {icon}
          {label}
        </span>
      ) : (
        <span className="slot-icon">{icon}</span>
      )}
      <span className="slot-mark">placeholder</span>
    </div>
  );
}
