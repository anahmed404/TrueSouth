import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { MissionProfile } from "../../../contracts/generated";
import { BodyIcon } from "../../../components/BodyIcon";
import { Explain } from "../../../components/Explain";
import { Popover } from "../../../components/Popover";
import { SegmentedControl } from "../../../components/SegmentedControl";
import { cx } from "../../../components/format";
import { useFeatures, useManifest, useSeries, useSites, useSkyline } from "../../../data/hooks";
import type { DecodedSeries } from "../../../data/decode/layouts";
import { useHourFlags } from "../../../lib/scoring";
import { utcToHourIndex } from "../../../lib/time";
import type { PanelProps } from "../../panel";
import { settingsProvenance, type SettingsProvenance } from "../rules";
import { SettingsTag } from "../settings-tag";
import { isSphere } from "../site-status";
import {
  explainEarth,
  explainSun,
  formatBearing,
  formatDistance,
  formatHeight,
  litShare,
  shortReason,
  wordExplanation,
  type BodyNow,
  type Explanation,
  type SkylineArrays,
} from "./why-dark";

function bodyNow(series: DecodedSeries, body: "sun" | "earth", hour: number): BodyNow {
  const pick = (values: Float64Array) => values[hour] ?? Number.NaN;
  return body === "sun"
    ? { azDeg: pick(series.sun_az), elDeg: pick(series.sun_el), frac: pick(series.sun_frac), clearDeg: pick(series.sun_clear) }
    : { azDeg: pick(series.earth_az), elDeg: pick(series.earth_el), frac: pick(series.earth_frac), clearDeg: pick(series.earth_clear) };
}

/** The card's data for the current hour: the reasons to show (empty when lit and linked). */
type WhyDark = { shown: Explanation[]; sun: Explanation; profile: MissionProfile };

/**
 * What hides the Sun or Earth at the current time, from the series and the skyline file, or
 * null until the data has loaded (or with no site). Shared by the card and its one-line plate.
 */
function useWhyDark(siteId: string, scenario: PanelProps["scenario"]): WhyDark | null {
  const manifest = useManifest();
  const sites = useSites();
  const features = useFeatures();
  const flags = useHourFlags(siteId, scenario.profile);
  const series = useSeries(siteId);
  const skyline = useSkyline(siteId);
  if (manifest.status !== "ready" || flags.status !== "ready" || series.status !== "ready") return null;

  let hour: number;
  try {
    hour = utcToHourIndex(manifest.data.time_grid, scenario.currentUtc);
  } catch {
    return null;
  }
  const site = sites.status === "ready" ? (sites.data.find((s) => s.id === siteId) ?? null) : null;
  const profile = scenario.profile;
  const context = {
    skyline: skyline.status === "ready" ? (skyline.data as SkylineArrays) : null,
    features: features.status === "ready" ? features.data : [],
    sphere: isSphere(site),
  };
  const sun = explainSun(bodyNow(series.data, "sun", hour), flags.data.lit[hour] === 1, {
    minFraction: profile.min_sun_fraction,
    minElDeg: profile.ops_sun_el_min_deg,
  }, context);
  const earth = explainEarth(bodyNow(series.data, "earth", hour), flags.data.link[hour] === 1, profile.relay_available, context);
  return { shown: [sun, earth].filter((e) => !e.ok), sun, profile };
}

/**
 * "Why is it dark?": when the Sun is hidden at the current time, what hides it, from the
 * series and the skyline file; the same for Earth in a blackout. When the site is lit and
 * linked, one short line says so, or nothing with `hideWhenLit`.
 */
export function WhyDarkCard({ scenario, hideWhenLit = false }: PanelProps & { hideWhenLit?: boolean }) {
  const siteId = focusedOrFirst(scenario);
  return siteId ? <SiteWhyDarkCard siteId={siteId} scenario={scenario} hideWhenLit={hideWhenLit} /> : null;
}

function focusedOrFirst(scenario: PanelProps["scenario"]): string | null {
  return scenario.focusedSiteId ?? scenario.siteIds[0] ?? null;
}

function SiteWhyDarkCard({ siteId, scenario, hideWhenLit }: { siteId: string; scenario: PanelProps["scenario"]; hideWhenLit: boolean }) {
  const why = useWhyDark(siteId, scenario);
  if (!why) return null;
  if (why.shown.length === 0) {
    if (hideWhenLit) return null;
    const words = wordExplanation(why.sun, ruleOf(why.profile));
    return (
      <section className="why why-ok" aria-label="Sunlight now">
        <BodyIcon body="sun" />
        <p>
          <span className="why-ok-word">Lit and linked.</span> {litShare(why.sun.now.frac) ?? words.text}
        </p>
      </section>
    );
  }
  return <Reasons reasons={why.shown} profile={why.profile} />;
}

/**
 * The card folded to one line, for over the scene: on a dark or blackout hour, the short
 * reason for the Sun and for Earth, and a button that opens the full card above it. Nothing
 * on a lit, linked hour. `extra` is put under the full card (for example a way to Lander's eye).
 */
export function WhyDarkLine({ scenario, extra }: PanelProps & { extra?: (close: () => void) => ReactNode }) {
  const siteId = focusedOrFirst(scenario);
  return siteId ? <SiteWhyDarkLine siteId={siteId} scenario={scenario} extra={extra} /> : null;
}

function SiteWhyDarkLine({
  siteId,
  scenario,
  extra,
}: {
  siteId: string;
  scenario: PanelProps["scenario"];
  extra?: (close: () => void) => ReactNode;
}) {
  const why = useWhyDark(siteId, scenario);
  if (!why || why.shown.length === 0) return null;
  const rule = ruleOf(why.profile);
  return (
    <div className="plate why-line">
      <p className="why-line-text">
        {why.shown.map((explanation, index) => (
          <span key={explanation.body} className="why-line-reason">
            {index > 0 ? <span className="why-line-sep" aria-hidden="true" /> : null}
            <BodyIcon body={explanation.body} size={14} />
            <span className="why-line-words">{shortReason(explanation, rule)}</span>
          </span>
        ))}
      </p>
      <Popover
        label={why.shown[0]?.body === "sun" ? "Why is it dark?" : "Why is there no link?"}
        width={800}
        align="end"
        placement="above"
        trigger={(props) => (
          <button {...props} type="button" className="btn btn-secondary btn-sm why-line-more">
            Why?
          </button>
        )}
      >
        {(close) => (
          <div className="why-pop">
            <Reasons reasons={why.shown} profile={why.profile} />
            {extra ? extra(close) : null}
          </div>
        )}
      </Popover>
    </div>
  );
}

/** Two reasons sit side by side only when each gets at least this much width. */
const SIDE_BY_SIDE_PX = 2 * 340 + 24 + 2 * 16;

/**
 * One reason, or two. Two sit side by side when there is room; otherwise a two-item
 * switch shows the Sun's reason or the Earth's, so the card never grows to two stacked
 * reasons and crowds the view above it.
 */
function Reasons({ reasons, profile }: { reasons: Explanation[]; profile: MissionProfile }) {
  const ref = useRef<HTMLElement>(null);
  const [width, setWidth] = useState(0);
  const [pick, setPick] = useState<"sun" | "earth">("sun");
  useLayoutEffect(() => {
    const node = ref.current;
    if (!node) return;
    setWidth(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) setWidth(Math.round(entry.contentRect.width));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const two = reasons.length > 1;
  const sideBySide = two && width >= SIDE_BY_SIDE_PX;
  const chosen = reasons.find((r) => r.body === pick) ?? reasons[0];
  const visible = !two || sideBySide ? reasons : chosen ? [chosen] : [];

  return (
    <section ref={ref} className={cx("why", sideBySide && "why-two")} aria-label="Why it is dark">
      {two && !sideBySide ? (
        <SegmentedControl
          label="Explain"
          className="why-switch"
          value={chosen?.body ?? "sun"}
          onChange={setPick}
          options={[
            { value: "sun", label: "Why is it dark?" },
            { value: "earth", label: "Why is there no link?" },
          ]}
        />
      ) : null}
      {visible.map((explanation) => (
        <Reason key={explanation.body} explanation={explanation} profile={profile} titled={!two || sideBySide} />
      ))}
    </section>
  );
}

function ruleOf(profile: MissionProfile) {
  return { minFraction: profile.min_sun_fraction, minElDeg: profile.ops_sun_el_min_deg, antennaMaskDeg: profile.antenna_mask_deg };
}

function ruleTag(profile: MissionProfile, explanation: Explanation): SettingsProvenance {
  if (explanation.body === "earth") return settingsProvenance(profile, ["antenna_mask_deg"]);
  if (explanation.cause === "too_low") return settingsProvenance(profile, ["ops_sun_el_min_deg"]);
  return settingsProvenance(profile, ["min_sun_fraction"]);
}

function Reason({ explanation, profile, titled }: { explanation: Explanation; profile: MissionProfile; titled: boolean }) {
  const words = wordExplanation(explanation, ruleOf(profile));
  const { blocker, feature } = explanation;
  const sun = explanation.body === "sun";
  return (
    <div className="why-reason">
      <div className="why-text">
        {titled ? (
          <h3 className="why-title">
            <BodyIcon body={explanation.body} />
            {sun ? "Why is it dark?" : "Why is there no link?"}
          </h3>
        ) : null}
        <p className="why-sentence">
          {words.text}
          {words.rule ? (
            <>
              {" "}
              {words.rule} <SettingsTag settings={ruleTag(profile, explanation)} />.
            </>
          ) : null}{" "}
          {words.verdict ? <span className="why-verdict">{words.verdict}</span> : null}
        </p>
      </div>
      {blocker ? (
        <p className="why-blocker">
          <Explain term="blocker">Blocker</Explain> <b className="tabular">{formatDistance(blocker.distKm)}</b> away, bearing{" "}
          <b className="tabular">{formatBearing(blocker.bearingDeg)}</b>,{" "}
          <Explain term="blocker_height" label="Blocker height">
            <b className="tabular">{formatHeight(blocker.heightM)}</b> above the reference sphere
          </Explain>
          {feature ? (
            <>
              , at the {feature.kind} <b>{feature.name}</b>
            </>
          ) : null}
          .
        </p>
      ) : explanation.cause === "terrain" || explanation.cause === "below_horizon" ? (
        <p className="why-blocker">No blocker is stored for this direction.</p>
      ) : null}
    </div>
  );
}

