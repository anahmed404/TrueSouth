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
export const FAILED_LINE = "Could not compute this site.";
export const COMPUTING_LINE = "Still computing this site.";

/** "Dark: 31 h, limit 6 h" or "Score 81": the one reason a spot's label adds. */
export function spotReason(result: SiteResult): string {
  if (result.kind === "pending") return "Computing…";
  if (result.kind === "failed") return "Could not compute";
  if (result.kind === "none") return "No data";
  return railFact(result.evaluation);
}

/** A site's readout: the status, each broken rule with its measured value, and the score. */
export function siteReadout(name: string, when: string, result: SiteResult, profile: MissionProfile): Readout {
  const title = `${name} · ${when}`;
  if (result.kind === "pending") return { title, status: null, lines: [COMPUTING_LINE] };
  if (result.kind === "failed") return { title, status: null, lines: [FAILED_LINE] };
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

function names(list: readonly { name: string }[]): string {
  const all = list.map((s) => s.name);
  return all.length <= 1 ? (all[0] ?? "") : `${all.slice(0, -1).join(", ")} and ${all[all.length - 1]}`;
}

/**
 * "Any site" on a date, by the rule of `anySiteDays` (model.ts): GO as soon as any site is
 * known to be GO; while another site is still computing it says how many. CAUTION, NO-GO and
 * no data only once every site is known. A site that could not be computed is left out, and
 * the readout says so.
 */
export function anyReadout(when: string, sites: readonly { siteId: string; name: string; result: SiteResult }[]): Readout {
  const title = `Any site · ${when}`;
  const failed = sites.filter((s) => s.result.kind === "failed");
  const pending = sites.filter((s) => s.result.kind === "pending");
  const counted = sites.filter((s) => s.result.kind !== "failed");
  const go = counted.filter((s) => s.result.kind === "ready" && s.result.evaluation.status === "GO");
  const missing = failed.length === 0 ? [] : [`${names(failed)} could not be computed, so ${failed.length === 1 ? "it is" : "they are"} left out.`];
  if (go.length > 0 && pending.length > 0) {
    return { title, status: "GO", lines: [`GO: ${names(go)}. ${pending.length} more still computing.`, ...missing] };
  }
  if (pending.length > 0) {
    return { title, status: null, lines: [`Still computing ${pending.length} of ${sites.length} sites.`, ...missing] };
  }
  if (counted.length === 0) return { title, status: null, lines: [`Could not compute any site.`] };
  if (counted.every((s) => s.result.kind === "none")) return { title, status: null, lines: [NO_DATA_LINE, ...missing] };
  const best = bestSite(counted);
  const nameOf = (id: string) => sites.find((s) => s.siteId === id)?.name ?? id;
  if (!best) {
    const allNoGo = counted.every((s) => s.result.kind === "ready");
    return { title, status: "NO-GO", lines: [allNoGo ? "Every site is NO-GO on this date." : "No site is GO or CAUTION on this date.", ...missing] };
  }
  const score = scoreText(best.evaluation.score);
  if (best.evaluation.status === "GO") {
    return { title, status: "GO", lines: [`${go.length} of ${counted.length} GO. Best: ${nameOf(best.siteId)}, score ${score}.`, ...missing] };
  }
  return { title, status: "CAUTION", lines: [`No site is GO. Best: ${nameOf(best.siteId)}, CAUTION, score ${score}.`, ...missing] };
}

/** One line for a screen reader. */
export function readoutText(readout: Readout): string {
  return [readout.title, readout.status ?? "", ...readout.lines].filter(Boolean).join(". ").replace(/\.\./g, ".");
}
