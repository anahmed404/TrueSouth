import { ArrowUpRight } from "lucide-react";
import { ProvenanceTag } from "../../components/ProvenanceTag";
import { Tip } from "../../components/Tip";
import type { SettingsProvenance } from "./rules";

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * The sourced or assumed tag of a row that one or more profile settings feed. One setting
 * draws the usual `ProvenanceTag`. Several draw one tag, sourced only if every setting is
 * sourced, whose tip names each setting with its source or its reason.
 */
export function SettingsTag({ settings }: { settings: SettingsProvenance }) {
  const [only] = settings.parts;
  if (!only) return null;
  if (settings.parts.length === 1) return <ProvenanceTag provenance={only.provenance} />;

  const sourced = settings.kind === "sourced";
  return (
    <Tip
      interactive
      content={
        <>
          <span className="tip-title">
            {sourced ? "Sourced: every setting behind this has a source" : "Assumed: a setting behind this is assumed"}
          </span>
          <span className="tip-settings">
            {settings.parts.map((part) =>
              part.provenance.kind === "sourced" ? (
                <span key={part.field}>
                  {part.label}: sourced,{" "}
                  <a className="tip-link" href={part.provenance.source_url} target="_blank" rel="noreferrer">
                    {hostOf(part.provenance.source_url)}
                    <ArrowUpRight size={11} strokeWidth={2} aria-hidden="true" />
                  </a>
                </span>
              ) : (
                <span key={part.field}>
                  {part.label}: assumed. {part.provenance.reason}
                </span>
              ),
            )}
          </span>
        </>
      }
    >
      {(trigger) => (
        <button {...trigger} type="button" className={sourced ? "tag tag-sourced" : "tag tag-assumed"}>
          {sourced ? "sourced" : "assumed"}
        </button>
      )}
    </Tip>
  );
}
