import { useLayoutEffect, useRef, useState } from "react";
import type { MissionProfile } from "../../../contracts/generated";
import { BodyIcon } from "../../../components/BodyIcon";
import { Explain } from "../../../components/Explain";
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

/**
 * "Why is it dark?": when the Sun is hidden at the current time, what hides it, from the
 * series and the skyline file; the same for Earth in a blackout. When the site is lit and
 * linked, one short line says so.
 */
export function WhyDarkCard({ scenario }: PanelProps) {
  const siteId = scenario.focusedSiteId ?? scenario.siteIds[0] ?? null;
  if (!siteId) return null;
  return <SiteWhyDark siteId={siteId} scenario={scenario} />;
}

function SiteWhyDark({ siteId, scenario }: { siteId: string; scenario: PanelProps["scenario"] }) {
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
  const sphere = isSphere(site);
  const profile = scenario.profile;
  const context = {
    skyline: skyline.status === "ready" ? (skyline.data as SkylineArrays) : null,
    features: features.status === "ready" ? features.data : [],
    sphere,
  };
  const sun = explainSun(bodyNow(series.data, "sun", hour), flags.data.lit[hour] === 1, {
    minFraction: profile.min_sun_fraction,
    minElDeg: profile.ops_sun_el_min_deg,
  }, context);
  const earth = explainEarth(bodyNow(series.data, "earth", hour), flags.data.link[hour] === 1, profile.relay_available, context);

  const shown = [sun, earth].filter((e) => !e.ok);
  if (shown.length === 0) {
    const words = wordExplanation(sun, ruleOf(profile));
    return (
      <section className="why why-ok" aria-label="Sunlight now">
        <BodyIcon body="sun" />
        <p>
          <span className="why-ok-word">Lit and linked.</span> {words.text}
        </p>
      </section>
    );
  }

  return <Reasons reasons={shown} profile={profile} />;
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

