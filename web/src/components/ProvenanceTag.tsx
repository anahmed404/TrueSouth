import { ArrowUpRight } from "lucide-react";
import type { Assumed, Sourced } from "../contracts/generated";
import { Tip } from "./Tip";

export type Provenance = Sourced | Assumed;

type ProvenanceTagProps = {
  provenance: Provenance;
};

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Where a mission number comes from, quietly:
 * - sourced: a solid grey pill that links to the source; hover or focus shows the quote;
 * - assumed: a dashed grey pill; hover or focus shows the reason.
 * The two differ by outline and word, never by colour.
 */
export function ProvenanceTag({ provenance }: ProvenanceTagProps) {
  if (provenance.kind === "sourced") {
    return (
      <Tip
        content={
          <>
            <span className="tip-quote">“{provenance.quote}”</span>
            <span className="tip-meta">Source: {hostOf(provenance.source_url)}. Opens in a new tab.</span>
          </>
        }
      >
        {(trigger) => (
          <a
            {...trigger}
            href={provenance.source_url}
            target="_blank"
            rel="noreferrer"
            className="tag tag-sourced"
          >
            sourced
            <ArrowUpRight size={11} strokeWidth={2} aria-hidden="true" />
          </a>
        )}
      </Tip>
    );
  }

  return (
    <Tip
      content={
        <>
          <span className="tip-title">Assumed</span>
          <span>{provenance.reason}</span>
        </>
      }
    >
      {(trigger) => (
        <button {...trigger} type="button" className="tag tag-assumed">
          assumed
        </button>
      )}
    </Tip>
  );
}
