import type { Site } from "../contracts/generated.ts";
import type { DecodedSeries } from "./decode/layouts.ts";
import { useCloseup, useSeries, useSites, useSkyline, useTerrain, type HookResult } from "./hooks.ts";

function availability(result: HookResult<unknown>): string {
  if (result.status === "loading") return "loading";
  if (result.status === "error") return `error: ${result.error}`;
  if (result.data === null) return "not available";
  return "loaded";
}

function formatDegrees(value: number | undefined): string {
  if (value === undefined) return "missing";
  if (!Number.isFinite(value)) return `${String(value)} deg`;
  return `${value.toFixed(2)} deg`;
}

function sunElevation(series: HookResult<DecodedSeries>, which: "first" | "last"): string {
  if (series.status === "error") return series.error;
  if (series.status !== "ready") return "loading";
  const values = series.data.sun_el;
  const index = which === "first" ? 0 : values.length - 1;
  return formatDegrees(values[index]);
}

function SiteDataCheck({ site }: { site: Site }) {
  const series = useSeries(site.id);
  const skyline = useSkyline(site.id);
  const terrain = useTerrain(site.id);
  const closeup = useCloseup(site.id);
  const length = series.status === "ready" ? String(series.data.sun_el.length) : availability(series);

  return (
    <section id={`data-check-${site.id}`}>
      <p>{site.id}</p>
      <p>tier: {site.terrain_tier}</p>
      <p>series: {availability(series)}</p>
      <p>skyline: {availability(skyline)}</p>
      <p>terrain: {availability(terrain)}</p>
      <p>close-up: {availability(closeup)}</p>
      <p>series length: {length}</p>
      <p>first sun elevation: {sunElevation(series, "first")}</p>
      <p>last sun elevation: {sunElevation(series, "last")}</p>
    </section>
  );
}

/** Plain text check. Not routed. Mount it by hand to see fixture sites load. */
export function DataCheck() {
  const sites = useSites();
  if (sites.status === "loading") return <p id="data-check">Loading sites.</p>;
  if (sites.status === "error") return <p id="data-check">Sites error: {sites.error}</p>;

  return (
    <div id="data-check">
      {sites.data.map((site) => (
        <SiteDataCheck key={site.id} site={site} />
      ))}
    </div>
  );
}
