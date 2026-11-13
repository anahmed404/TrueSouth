import { describeEvaluation, railFact, scoreText } from "../../../app/mission/rules";
import type { MissionProfile } from "../../../contracts/generated";
import { GO_SCORE_THRESHOLD, type Status } from "../../../lib/scoring";
import { bestSite, type SiteResult } from "./model";

/**
 * The words for a site on a landing date: the hover readout of a strip and a spot, the
 * strips' `aria-valuetext` and the spot labels. Built from the same rule descriptions as the
 * focused-site panel (app/mission/rules.ts), so the words agree with it.
 */
export type Readout = { title: string; status: Status | null; lines: string[] };

export const NO_DATA_LINE = "No data: the mission window runs past the end of 2031.";

/** "Dark: 31 h, limit 6 h" or "Score 81": the one reason a spot's label adds. */
export function spotReason(result: SiteResult): string {
  if (result.kind === "pending") return "Working out…";
  if (result.kind === "none") return "No data";
  return railFact(result.evaluation);
}

/** A site's readout: the status, each broken rule with its measured value, and the score. */
export function siteReadout(name: string, when: string, result: SiteResult, profile: MissionProfile): Readout {
  const title = `${name} · ${when}`;
  if (result.kind === "pending") return { title, status: null, lines: ["Still working out this date."] };
  if (result.kind === "none") return { title, status: null, lines: [NO_DATA_LINE] };
  const e = result.evaluation;
  const view = describeEvaluation(e, profile);
  const lines: string[] = [];
  for (const rule of view.broken) lines.push(`${rule.name}: ${rule.valueLabel}, ${rule.limitText}.`);
  if (e.status === "NO-GO") lines.push(`Score ${scoreText(e.score)} not used.`);
  else if (e.status === "CAUTION") lines.push(`Every rule passes. Score ${scoreText(e.score)}, under the ${GO_SCORE_THRESHOLD} needed for GO.`);
  else lines.push(`Every rule passes. Score ${scoreText(e.score)}.`);
  return { title, status: e.status, lines };
}

/** "Any site" on a date: the best status, how many sites are GO, and the best site. */
export function anyReadout(when: string, sites: readonly { siteId: string; name: string; result: SiteResult }[]): Readout {
  const title = `Any site · ${when}`;
  if (sites.some((s) => s.result.kind === "pending")) return { title, status: null, lines: ["Still working out this date."] };
  if (sites.every((s) => s.result.kind === "none")) return { title, status: null, lines: [NO_DATA_LINE] };
  const best = bestSite(sites);
  const go = sites.filter((s) => s.result.kind === "ready" && s.result.evaluation.status === "GO").length;
  const nameOf = (id: string) => sites.find((s) => s.siteId === id)?.name ?? id;
  if (!best) return { title, status: "NO-GO", lines: ["Every site is NO-GO on this date."] };
  const score = scoreText(best.evaluation.score);
  if (best.evaluation.status === "GO") {
    return { title, status: "GO", lines: [`${go} of ${sites.length} GO. Best: ${nameOf(best.siteId)}, score ${score}.`] };
  }
  return { title, status: "CAUTION", lines: [`No site is GO. Best: ${nameOf(best.siteId)}, CAUTION, score ${score}.`] };
}

/** One line for a screen reader. */
export function readoutText(readout: Readout): string {
  return [readout.title, readout.status ?? "", ...readout.lines].filter(Boolean).join(". ").replace(/\.\./g, ".");
}
