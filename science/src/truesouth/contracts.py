from datetime import datetime
import math
from typing import Annotated, Literal

from pydantic import AfterValidator, BaseModel, ConfigDict, Field, RootModel, StringConstraints, field_validator, model_validator


def _valid_utc(value: str) -> str:
    """Check that a UTC timestamp is a real calendar time."""
    datetime.fromisoformat(value.replace("Z", "+00:00"))
    return value


Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=0, lt=360)]
UTC = Annotated[str, StringConstraints(pattern=r"^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?Z$"), AfterValidator(_valid_utc)]
CatalogId = Annotated[str, StringConstraints(pattern=r"^[a-z][a-z0-9]*(?:_[a-z0-9]+)*$")]
SiteId = Annotated[str, StringConstraints(pattern=r"^(?:[a-z][a-z0-9]*(?:_[a-z0-9]+)*|c_-?\d+\.\d{4}_\d+\.\d{4})$")]


class Contract(BaseModel):
    """Base for closed JSON contract objects."""

    model_config = ConfigDict(extra="forbid")


class TimeGrid(Contract):
    """UTC grid shared by all series."""

    start_utc: UTC = Field(description='First time grid timestamp in UTC.')
    step_s: int = Field(description='Time step in seconds.')
    count: int = Field(description='Number of hourly samples.')


class Manifest(Contract):
    """Version and shared time grid for derived data."""

    schema_version: Literal[1] = Field(description='Contract version.')
    generated_utc: UTC = Field(description='Generation timestamp in UTC.')
    time_grid: TimeGrid = Field(description='Shared UTC time grid.')
    observer_height_m: float = Field(description='Observer height in metres.')
    skyline_bins: int = Field(description='Number of skyline azimuth bins.')
    moon_radius_m: float = Field(description='Moon reference radius in metres.')


class Slope(Contract):
    """Site slope and measurement baseline."""

    deg: float = Field(description='Slope in degrees.')
    baseline_m: float = Field(description='Measurement baseline in metres.')
    source: str = Field(description='Slope data source.')


class CatalogSite(Contract):
    """Hand-entered site information, before pipeline processing."""

    id: SiteId = Field(description='Stable site identifier.')
    name: str = Field(description='Display name.')
    group: Literal['artemis', 'sunlit_peak', 'polar_lander', 'contrast'] = Field(description='Catalog group.')
    lat_deg: Latitude = Field(description='Latitude in degrees north.')
    lon_deg: Longitude = Field(description='East longitude in degrees.')
    description: str = Field(description='Plain-language site description.')
    source_url: str = Field(description='Source of site coordinates.')
    outcome: str | None = Field(description='Mission outcome, or null.')


class CatalogSites(RootModel[list[CatalogSite]]):
    """Array of hand-entered catalog sites."""

    root: list[CatalogSite] = Field(description='Ordered catalog site inputs.')


class NearbySun(Contract):
    """Range of mean sunlight at usable nearby map pixel centres (science.md §7.1)."""

    radius_m: float = Field(gt=0, strict=True, allow_inf_nan=False, description='Search radius in map metres.')
    points: int = Field(ge=1, strict=True, description='Number of usable pixel centres evaluated.')
    min: float = Field(ge=0, le=1, strict=True, description='Lowest mean sun_frac over the time grid.')
    max: float = Field(ge=0, le=1, strict=True, description='Highest mean sun_frac over the time grid.')

    @model_validator(mode='after')
    def ordered_range(self):
        if self.min > self.max:
            raise ValueError('nearby_sun min must be at most max')
        return self


class Site(Contract):
    """Catalog or custom site."""

    id: SiteId = Field(description='Stable lowercase snake_case catalog id or custom c_<lat>_<lon> id with four decimal places.')
    name: str = Field(description='Display name.')
    group: Literal['artemis', 'sunlit_peak', 'polar_lander', 'contrast'] = Field(description='Catalog group.')
    lat_deg: Latitude = Field(description='Latitude in degrees north.')
    lon_deg: Longitude = Field(description='East longitude in degrees, from 0 inclusive to 360 exclusive.')
    description: str = Field(description='Plain-language site description.')
    source_url: str = Field(description='Source of site coordinates.')
    outcome: str | None = Field(description='Mission outcome, or null.')
    terrain_tier: Literal['core80', 'wide240', 'sphere'] = Field(description='Terrain tier.')
    has_closeup: bool = Field(description='Whether a close-up DEM exists.')
    elevation_m: float | None = Field(description='Ground elevation in metres above reference sphere, or null.')
    slope: Slope | None = Field(description='Slope and measurement baseline, or null.')
    quickmap_url: str = Field(description='NASA Quickmap link.')
    moontrek_url: str = Field(description='NASA Moon Trek link.')
    variant_of: SiteId | None = Field(default=None, description='Listed site id for a best-lit variant, otherwise null.')
    offset_m: float | None = Field(default=None, ge=0, strict=True, allow_inf_nan=False, description='Distance from the listed point in map metres for a variant, otherwise null.')
    nearby_sun: NearbySun | None = Field(default=None, description='Range of nearby mean sunlight, or null; science.md §7.1.')

    @model_validator(mode='after')
    def variant_identity(self):
        if (self.variant_of is None) != (self.offset_m is None):
            raise ValueError('variant_of and offset_m must both be null or both set')
        if self.variant_of is not None and self.id != f'{self.variant_of}_best_lit':
            raise ValueError('variant id must equal <variant_of>_best_lit')
        return self


class Sites(RootModel[list[Site]]):
    """Array of catalog sites."""

    root: list[Site] = Field(description="Ordered array of Site objects.")


class SeriesColumn(Contract):
    """One scaled Int16 series column."""

    name: Literal['sun_az', 'sun_el', 'sun_frac', 'sun_clear', 'earth_az', 'earth_el', 'earth_frac', 'earth_clear'] = Field(description='Series column name.')
    scale: float = Field(description='Decode as raw * scale + offset; angle units are degrees.')
    offset: float = Field(description='Decode as raw * scale + offset; angle units are degrees.')

    @model_validator(mode="after")
    def documented_scaling(self):
        expected_scale = 0.0001 if self.name.endswith("_frac") else 0.01
        expected_offset = 180.0 if self.name.endswith("_az") else 0.0
        if self.scale != expected_scale or self.offset != expected_offset:
            raise ValueError("Series column scale and offset must match its name")
        return self


class ColumnSunAz(SeriesColumn):
    """Documented sun_az column."""

    name: Literal['sun_az'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.01})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 180.0})


class ColumnSunEl(SeriesColumn):
    """Documented sun_el column."""

    name: Literal['sun_el'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.01})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0})


class ColumnSunFrac(SeriesColumn):
    """Documented sun_frac column."""

    name: Literal['sun_frac'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0001})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0})


class ColumnSunClear(SeriesColumn):
    """Documented sun_clear column."""

    name: Literal['sun_clear'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.01})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0})


class ColumnEarthAz(SeriesColumn):
    """Documented earth_az column."""

    name: Literal['earth_az'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.01})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 180.0})


class ColumnEarthEl(SeriesColumn):
    """Documented earth_el column."""

    name: Literal['earth_el'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.01})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0})


class ColumnEarthFrac(SeriesColumn):
    """Documented earth_frac column."""

    name: Literal['earth_frac'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0001})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0})


class ColumnEarthClear(SeriesColumn):
    """Documented earth_clear column."""

    name: Literal['earth_clear'] = Field(description='Column name.')
    scale: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.01})
    offset: float = Field(description='Decode as raw * scale + offset.', json_schema_extra={"const": 0.0})


class SeriesMeta(Contract):
    """Ordered series column encodings."""

    columns: tuple[ColumnSunAz, ColumnSunEl, ColumnSunFrac, ColumnSunClear, ColumnEarthAz, ColumnEarthEl, ColumnEarthFrac, ColumnEarthClear] = Field(description='Eight Int16 columns in documented order; value = raw * scale + offset.')

    @model_validator(mode="after")
    def documented_columns(self):
        expected = [("sun_az", 0.01, 180.0), ("sun_el", 0.01, 0.0), ("sun_frac", 0.0001, 0.0), ("sun_clear", 0.01, 0.0), ("earth_az", 0.01, 180.0), ("earth_el", 0.01, 0.0), ("earth_frac", 0.0001, 0.0), ("earth_clear", 0.01, 0.0)]
        if [(c.name, c.scale, c.offset) for c in self.columns] != expected:
            raise ValueError("Series columns must match documented order, scales and offsets")
        return self


class SkylineMeta(Contract):
    """Skyline metadata."""

    bins: int = Field(description='Number of skyline bins.')
    missing_samples: int = Field(description='Number of missing terrain samples.')
    max_range_km: float = Field(description='Maximum skyline distance in kilometres.')


class MeshMeta(Contract):
    """Terrain mesh dimensions."""

    size: int = Field(description='Vertices per side.')
    window_km: float = Field(description='Window width in kilometres.')


class SiteMeta(Contract):
    """Per-site derived file metadata."""

    site_id: SiteId = Field(description='Catalog id or c_<lat>_<lon> custom id.')
    series: SeriesMeta = Field(description='Column encodings for series.bin.')
    sun_radius_deg: float = Field(description='Average Sun angular radius in degrees.')
    earth_radius_deg: float = Field(description='Average Earth angular radius in degrees.')
    skyline: SkylineMeta = Field(description='Skyline dimensions.')
    terrain: MeshMeta | None = Field(description='Terrain mesh metadata, null if terrain.bin is absent.')
    closeup: MeshMeta | None = Field(description='Close-up mesh metadata, null if closeup.bin is absent.')


class Sourced(Contract):
    """A value supported by a published source."""

    kind: Literal['sourced'] = Field(description='Value is taken from a published source.')
    source_url: str = Field(description='URL of published source.')
    quote: str = Field(description='Supporting quotation.')


class Assumed(Contract):
    """A value chosen because no source is published."""

    kind: Literal['assumed'] = Field(description='Value is an assumption rather than a sourced claim.')
    reason: str = Field(description='Reason for the assumption.')


Provenance = Annotated[Sourced | Assumed, Field(discriminator="kind")]

PROFILE_FIELDS = ('duration_days', 'min_sun_fraction', 'ops_sun_el_min_deg', 'max_dark_h', 'relay_available', 'antenna_mask_deg', 'max_blackout_h', 'max_slope_deg', 'slope_ideal_deg', 'landing_sun_el_min_deg', 'landing_sun_el_max_deg', 'weights')


class ProfileProvenance(Contract):
    """Provenance for every mission profile value, including null values."""

    duration_days: Provenance = Field(description='Source or assumption for duration_days.')
    min_sun_fraction: Provenance = Field(description='Source or assumption for min_sun_fraction.')
    ops_sun_el_min_deg: Provenance = Field(description='Source or assumption for ops_sun_el_min_deg.')
    max_dark_h: Provenance = Field(description='Source or assumption for max_dark_h.')
    relay_available: Provenance = Field(description='Source or assumption for relay_available.')
    antenna_mask_deg: Provenance = Field(description='Source or assumption for antenna_mask_deg.')
    max_blackout_h: Provenance = Field(description='Source or assumption for max_blackout_h.')
    max_slope_deg: Provenance = Field(description='Source or assumption for max_slope_deg.')
    slope_ideal_deg: Provenance = Field(description='Source or assumption for slope_ideal_deg.')
    landing_sun_el_min_deg: Provenance = Field(description='Source or assumption for landing_sun_el_min_deg.')
    landing_sun_el_max_deg: Provenance = Field(description='Source or assumption for landing_sun_el_max_deg.')
    weights: Provenance = Field(description='Source or assumption for weights.')


class Weights(Contract):
    """Non-negative relative scoring weights."""

    slope: float = Field(description='Relative slope weight, dimensionless.', ge=0)
    power: float = Field(description='Relative power weight, dimensionless.', ge=0)
    comms: float = Field(description='Relative comms weight, dimensionless.', ge=0)


class MissionProfile(Contract):
    """Mission limits, preferences and provenance."""

    id: CatalogId = Field(description='Stable preset id.')
    name: str = Field(description='Profile display name.')
    based_on: str = Field(description='Mission on which the profile is based.')
    duration_days: float = Field(description='Mission duration in days.')
    min_sun_fraction: float = Field(description='Minimum visible Sun disc fraction, dimensionless.')
    ops_sun_el_min_deg: float | None = Field(description='Optional minimum operational Sun elevation in degrees.')
    max_dark_h: float = Field(description='Maximum continuous darkness in hours.')
    relay_available: bool = Field(description='Whether a communications relay is available.')
    antenna_mask_deg: float = Field(description='Minimum Earth clearance in degrees.')
    max_blackout_h: float = Field(description='Maximum continuous blackout in hours.')
    max_slope_deg: float = Field(description='Maximum site slope in degrees.')
    slope_ideal_deg: float = Field(description='Ideal site slope in degrees.')
    landing_sun_el_min_deg: float | None = Field(description='Optional minimum landing Sun elevation in degrees.')
    landing_sun_el_max_deg: float | None = Field(description='Optional maximum landing Sun elevation in degrees.')
    weights: Weights = Field(description='Relative scoring weights.')
    provenance: ProfileProvenance = Field(description='Source or assumption for each profile value.')


class Profiles(RootModel[list[MissionProfile]]):
    """Array of mission profiles."""

    root: list[MissionProfile] = Field(description="Ordered array of MissionProfile objects.")


class Feature(Contract):
    """IAU named feature for map labels."""

    name: str = Field(description='IAU feature name.')
    kind: Literal['crater', 'mountain'] = Field(description='Feature kind: crater or mountain.')
    iau_id: int = Field(description='IAU gazetteer feature id.')
    lat_deg: Latitude = Field(description='Latitude in degrees north.')
    lon_deg: Longitude = Field(description='East longitude in degrees.')
    diameter_km: float = Field(description='Diameter in kilometres.')


class Features(RootModel[list[Feature]]):
    """Array of named features."""

    root: list[Feature] = Field(description="Ordered array of Feature objects.")


class ArtemisRegion(Contract):
    """Artemis candidate region."""

    name: str = Field(description='Region name.')
    lat_deg: Latitude | None = Field(description='Centre latitude in degrees, or null if unpublished.')
    lon_deg: Longitude | None = Field(description='Centre east longitude in degrees, or null if unpublished.')
    size_km: float | None = Field(description='Region size in kilometres, or null if unpublished.')
    source_url: str = Field(description='Source URL.')


class ArtemisRegions(RootModel[list[ArtemisRegion]]):
    """Array of Artemis regions."""

    root: list[ArtemisRegion] = Field(description="Ordered array of ArtemisRegion objects.")


class MapLayer(Contract):
    """Map image and optional lookup grid."""

    files: list[str] = Field(description='Image file names.')
    lookup: str | None = Field(description='Lookup grid filename, or null.', default=None)
    lookup_size: int | None = Field(description='Lookup grid pixels per side, or null.', default=None)


class MapLayers(Contract):
    """Named map layers."""

    hillshade: MapLayer = Field(description='hillshade map layer.')
    sunlight: MapLayer = Field(description='sunlight map layer.')
    earthvis: MapLayer = Field(description='earthvis map layer.')


class MapMeta(Contract):
    """South-polar map metadata."""

    projection: Literal['south_polar_stereographic'] = Field(description='South polar stereographic projection.')
    half_width_m: float = Field(description='Distance from centre to edge in metres.')
    layers: MapLayers = Field(description='Image and lookup layers.')


class Gate(Contract):
    """Validation hard gate result. See docs/validation.md, "Hard gates"."""

    id: str = Field(description='Gate identifier, G1 to G11.')
    name: str = Field(description='Gate name, a plain sentence.')
    passed: bool | None = Field(
        description='Whether the gate passed. Null when this command did not measure the gate.',
    )
    measured: float | None = Field(
        description='Measured value in unit, or null when this command did not measure the gate. '
        'For most gates the largest difference found.',
    )
    limit: float = Field(description='Passing limit in unit.')
    unit: str = Field(description='Unit of measured value and limit.')
    samples: int = Field(ge=0, description='Number of samples compared. Zero when the gate was not measured here.')
    detail: str | None = Field(
        default=None,
        description='Optional plain sentence with the expected and measured values of a synthetic test, '
        'written by the pipeline from its own numbers. Null when there is nothing to add. '
        'When passed is null, a sentence saying where the gate is checked.',
    )

    @model_validator(mode='after')
    def unmeasured_pair(self):
        if (self.passed is None) != (self.measured is None):
            raise ValueError('passed and measured are both null when this command did not measure the gate')
        if self.passed is None:
            if self.samples != 0:
                raise ValueError('a gate that was not measured here has no samples')
            if not self.detail or not self.detail.strip() or '.' not in self.detail:
                raise ValueError('a gate that was not measured here needs a sentence saying where it is checked')
        return self


class Comparison(Contract):
    """Reported validation comparison. See docs/validation.md, "Reported comparisons"."""

    id: str = Field(description='Comparison identifier, R1 to R6.')
    site_id: SiteId = Field(description='Site identifier.')
    ours: float = Field(description='Our measured value in unit.')
    reference: float = Field(description='Reference value in unit.')
    unit: str = Field(description='Unit of both values and of investigate_above.')
    reference_source: str = Field(description='Reference source URL.')
    investigate_above: float = Field(
        ge=0,
        description='The "investigate when" mark from docs/validation.md, in unit: the largest difference '
        'between ours and reference that needs no explanation.',
    )
    outside_mark: bool = Field(description='True when the difference between ours and reference is above investigate_above.')
    explanation: str | None = Field(
        description='Our best plain-language explanation. Required when outside_mark is true; null otherwise or when none is needed.',
    )

    @model_validator(mode='after')
    def outside_mark_is_explained(self):
        if self.outside_mark and not (self.explanation and self.explanation.strip()):
            raise ValueError('a comparison outside its investigate mark needs an explanation')
        return self


class DifferenceOverTime(Contract):
    """Gate G2 at one site for one body: the largest difference in each step of the time grid."""

    site_id: SiteId = Field(description='Site identifier.')
    body: Literal['sun', 'earth'] = Field(description='The body whose direction was compared with JPL Horizons.')
    start_utc: UTC = Field(description='UTC time of the first step.')
    step_h: int = Field(ge=1, description='Length of one step in hours; 24 gives one value per day.')
    max_difference_deg: list[float] = Field(
        description='Largest difference on the sky in degrees within each step, in time order.',
    )


class DataSource(Contract):
    """One NASA product the results rest on."""

    name: str = Field(description='Product name.')
    url: str = Field(description='Link to the product.')
    used_for: str = Field(description='What TrueSouth uses it for, in a plain phrase.')


class Validation(Contract):
    """Hard gates and reported comparisons: everything the validation page shows."""

    generated_utc: UTC = Field(description='When the validation was last run, in UTC.')
    gates: list[Gate] = Field(description='Hard gate results.')
    comparisons: list[Comparison] = Field(description='Reported comparisons.')
    g2_over_time: list[DifferenceOverTime] = Field(
        description='Gate G2 over time, for the chart on the validation page. Empty until the check has been run.',
    )
    sources: list[DataSource] = Field(description='Every NASA product used, with its link.')


class WorkedExamples(Contract):
    """Flat worked-example values keyed by full dotted lesson key; every key is required."""

    l1_sun_el_max_deg: float = Field(description='l1.sun_el_max_deg: degrees.', alias='l1.sun_el_max_deg')
    l1_sun_el_min_deg: float = Field(description='l1.sun_el_min_deg: degrees.', alias='l1.sun_el_min_deg')
    l1_site_lat_deg: float = Field(description='l1.site_lat_deg: degrees.', alias='l1.site_lat_deg')
    l1_example_utc: UTC = Field(description='l1.example_utc: UTC timestamp.', alias='l1.example_utc')
    l1_example_subsolar_lat: float = Field(description='l1.example_subsolar_lat: degrees.', alias='l1.example_subsolar_lat')
    l1_example_subsolar_lon: float = Field(description='l1.example_subsolar_lon: degrees.', alias='l1.example_subsolar_lon')
    l1_example_sun_az: float = Field(description='l1.example_sun_az: degrees.', alias='l1.example_sun_az')
    l1_example_sun_el: float = Field(description='l1.example_sun_el: degrees.', alias='l1.example_sun_el')
    l2_example_utc: UTC = Field(description='l2.example_utc: UTC timestamp.', alias='l2.example_utc')
    l2_sun_el_deg: float = Field(description='l2.sun_el_deg: degrees.', alias='l2.sun_el_deg')
    l2_sun_az_deg: float = Field(description='l2.sun_az_deg: degrees.', alias='l2.sun_az_deg')
    l2_ridge_dist_km: float = Field(description='l2.ridge_dist_km: kilometres.', alias='l2.ridge_dist_km')
    l2_ridge_rise_m: float = Field(description='l2.ridge_rise_m: metres.', alias='l2.ridge_rise_m')
    l2_site_id: str = Field(description='l2.site_id: site identifier.', alias='l2.site_id')
    l2_site_name: str = Field(description='l2.site_name: text.', alias='l2.site_name')
    l2_ridge_el_deg: float = Field(description='l2.ridge_el_deg: degrees.', alias='l2.ridge_el_deg')
    l2_ridge_feature: str = Field(description='l2.ridge_feature: text.', alias='l2.ridge_feature')
    l2_sun_frac: float = Field(description='l2.sun_frac: dimensionless.', alias='l2.sun_frac')
    l3_drop_at_20km_m: float = Field(description='l3.drop_at_20km_m: metres.', alias='l3.drop_at_20km_m')
    l3_drop_at_60km_m: float = Field(description='l3.drop_at_60km_m: metres.', alias='l3.drop_at_60km_m')
    l3_drop_at_130km_m: float = Field(description='l3.drop_at_130km_m: metres.', alias='l3.drop_at_130km_m')
    l3_example_bin_az: float = Field(description='l3.example_bin_az: degrees.', alias='l3.example_bin_az')
    l3_example_dist_km: float = Field(description='l3.example_dist_km: kilometres.', alias='l3.example_dist_km')
    l3_example_height_m: float = Field(description='l3.example_height_m: metres.', alias='l3.example_height_m')
    l3_example_el_flat_deg: float = Field(description='l3.example_el_flat_deg: degrees.', alias='l3.example_el_flat_deg')
    l3_example_el_true_deg: float = Field(description='l3.example_el_true_deg: degrees.', alias='l3.example_el_true_deg')
    l4_earth_el_max_deg: float = Field(description='l4.earth_el_max_deg: degrees.', alias='l4.earth_el_max_deg')
    l4_earth_el_min_deg: float = Field(description='l4.earth_el_min_deg: degrees.', alias='l4.earth_el_min_deg')
    l4_earth_up_pct: float = Field(description='l4.earth_up_pct: percent.', alias='l4.earth_up_pct')
    l4_link_pct_by_mask: list[float] = Field(min_length=21, max_length=21, description='l4.link_pct_by_mask: percent, one share for each mask from 0 degrees to 10 degrees in steps of 0.5 degrees.', alias='l4.link_pct_by_mask')
    l4_link_pct_mask0: float = Field(description='l4.link_pct_mask0: percent.', alias='l4.link_pct_mask0')
    l4_link_pct_mask1: float = Field(description='l4.link_pct_mask1: percent.', alias='l4.link_pct_mask1')
    l4_link_pct_mask5: float = Field(description='l4.link_pct_mask5: percent.', alias='l4.link_pct_mask5')
    l4_mask_for_15pct_deg: float = Field(description='l4.mask_for_15pct_deg: degrees.', alias='l4.mask_for_15pct_deg')
    l4_example_utc: UTC = Field(description='l4.example_utc: UTC timestamp.', alias='l4.example_utc')
    l4_example_earth_az: float = Field(description='l4.example_earth_az: degrees.', alias='l4.example_earth_az')
    l4_example_earth_el: float = Field(description='l4.example_earth_el: degrees.', alias='l4.example_earth_el')
    l4_example_earth_clear: float = Field(description='l4.example_earth_clear: degrees.', alias='l4.example_earth_clear')
    l5_slope_10m_deg: float | None = Field(description='l5.slope_10m_deg: degrees, or null when the 10 m method is not defined.', alias='l5.slope_10m_deg')
    l5_slope_100m_deg: float | None = Field(description='l5.slope_100m_deg: degrees, or null when the close-up fit is absent.', alias='l5.slope_100m_deg')
    l5_slope_160m_deg: float = Field(description='l5.slope_160m_deg: degrees.', alias='l5.slope_160m_deg')
    l5_example_site: str = Field(description='l5.example_site: text.', alias='l5.example_site')
    l5_plane_a: float | None = Field(description='l5.plane_a: dimensionless, or null when the close-up fit is absent.', alias='l5.plane_a')
    l5_plane_b: float | None = Field(description='l5.plane_b: dimensionless, or null when the close-up fit is absent.', alias='l5.plane_b')
    l6_site_a: str = Field(description='l6.site_a: text.', alias='l6.site_a')
    l6_site_b: str | None = Field(description='l6.site_b: text, or null when no second site passes every veto.', alias='l6.site_b')
    l6_a_score: float = Field(description='l6.a_score: dimensionless.', alias='l6.a_score')
    l6_b_score: float | None = Field(description='l6.b_score: dimensionless, or null when site B was not selected.', alias='l6.b_score')
    l6_example_metrics_sun_fraction_mean: float = Field(description='l6.example_metrics.sun_fraction_mean: dimensionless.', alias='l6.example_metrics.sun_fraction_mean')
    l6_example_metrics_lit_fraction: float = Field(description='l6.example_metrics.lit_fraction: dimensionless.', alias='l6.example_metrics.lit_fraction')
    l6_example_metrics_longest_dark_h: float = Field(description='l6.example_metrics.longest_dark_h: hours.', alias='l6.example_metrics.longest_dark_h')
    l6_example_metrics_link_fraction: float = Field(description='l6.example_metrics.link_fraction: dimensionless.', alias='l6.example_metrics.link_fraction')
    l6_example_metrics_longest_blackout_h: float = Field(description='l6.example_metrics.longest_blackout_h: hours.', alias='l6.example_metrics.longest_blackout_h')
    l6_example_metrics_landing_sun_el_deg: float = Field(description='l6.example_metrics.landing_sun_el_deg: degrees.', alias='l6.example_metrics.landing_sun_el_deg')
    l6_example_metrics_landing_lit: bool = Field(description='l6.example_metrics.landing_lit: boolean.', alias='l6.example_metrics.landing_lit')
    l6_example_utilities_slope: float = Field(description='l6.example_utilities.slope: dimensionless.', alias='l6.example_utilities.slope')
    l6_example_utilities_power: float = Field(description='l6.example_utilities.power: dimensionless.', alias='l6.example_utilities.power')
    l6_example_utilities_comms: float = Field(description='l6.example_utilities.comms: dimensionless.', alias='l6.example_utilities.comms')
    l6_example_score: float = Field(description='l6.example_score: dimensionless.', alias='l6.example_score')
    l7_go_date: UTC = Field(description='l7.go_date: UTC timestamp.', alias='l7.go_date')
    l7_slip_date: UTC = Field(description='l7.slip_date: UTC timestamp.', alias='l7.slip_date')
    l7_slip_vetoes: list[str] = Field(description='l7.slip_vetoes: list of text identifiers.', alias='l7.slip_vetoes')
    l7_slip_blackout_h: float = Field(description='l7.slip_blackout_h: hours.', alias='l7.slip_blackout_h')
    l7_next_go_date: UTC = Field(description='l7.next_go_date: UTC timestamp.', alias='l7.next_go_date')
    l7_alt_site: str | None = Field(description='l7.alt_site: text, or null when no polar catalog site is GO on the slipped date.', alias='l7.alt_site')
    l8_candidates: list[str] = Field(description='l8.candidates: list of text identifiers.', alias='l8.candidates')
    l8_region_overlap_site_id: str = Field(description='l8.region_overlap.site_id: text.', alias='l8.region_overlap.site_id')
    l8_region_overlap_region_name: str | None = Field(description='l8.region_overlap.region_name: text, or null when official region outlines are absent.', alias='l8.region_overlap.region_name')
    l8_region_overlap_overlaps: bool | None = Field(description='l8.region_overlap.overlaps: boolean, or null when official region outlines are absent.', alias='l8.region_overlap.overlaps')
    story_landing_utc: UTC = Field(description='story.landing_utc: UTC timestamp.', alias='story.landing_utc')
    story_month_end_utc: UTC = Field(description='story.month_end_utc: UTC timestamp, exclusive end of the story month.', alias='story.month_end_utc')
    story_profile_id: str = Field(description='story.profile_id: profile identifier.', alias='story.profile_id')
    story_site_id: str = Field(description='story.site_id: site identifier.', alias='story.site_id')
    story_window_end_utc: UTC = Field(description='story.window_end_utc: UTC timestamp, exclusive end of the mission window.', alias='story.window_end_utc')

    @model_validator(mode='after')
    def lessons_and_mask(self):
        """Lessons 1 to 4 and the story are never null. The mask is the first share below 15 percent."""
        nullable = {
            'l5.slope_10m_deg', 'l5.slope_100m_deg', 'l5.plane_a', 'l5.plane_b',
            'l6.site_b', 'l6.b_score', 'l7.alt_site',
            'l8.region_overlap.region_name', 'l8.region_overlap.overlaps',
        }
        values = self.model_dump(by_alias=True)
        missing = [key for key, value in values.items() if value is None and key not in nullable]
        if missing:
            raise ValueError('lessons 1 to 4 and the story cannot be null: ' + ', '.join(missing))
        shares = self.l4_link_pct_by_mask
        if len(shares) != 21 or any(not math.isfinite(share) for share in shares):
            raise ValueError('l4.link_pct_by_mask must be 21 finite percentages')
        below = next((index * 0.5 for index, share in enumerate(shares) if share < 15), None)
        if below is None or self.l4_mask_for_15pct_deg != below:
            raise ValueError('l4.mask_for_15pct_deg must be the first mask whose share is below 15 percent')
        return self


class CustomSiteRequest(Contract):
    """Request to compute a custom site."""

    lat_deg: Latitude = Field(description='Latitude in degrees north.')
    lon_deg: float = Field(allow_inf_nan=False, description='Finite east longitude; normalised to [0, 360).')
    name: Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)] = Field(default='Custom site', description='Optional display name, trimmed and length limited.')

    @field_validator('lon_deg')
    @classmethod
    def normalise_longitude(cls, value):
        return value % 360



class CustomSiteQueued(Contract):
    """Custom site job submission response."""

    site_id: SiteId = Field(description='Custom id c_<lat>_<lon>, coordinates rounded to four decimal places.')
    status: Literal['queued', 'running', 'ready', 'failed'] = Field(description='Job status.')
    position_in_queue: int = Field(description='Position in queue.')


class ErrorDetail(Contract):
    """Structured API error."""

    code: Literal['invalid_coordinates', 'date_outside_time_grid', 'rate_limited', 'queue_full', 'terrain_unavailable', 'not_found', 'computation_failed'] = Field(description='Stable error code.')
    message: str = Field(description='Plain-language error message.')


class ErrorResponse(Contract):
    """API error envelope."""

    error: ErrorDetail = Field(description='Error code and message.')


class CustomSiteStatus(Contract):
    """Custom site job status."""

    site_id: SiteId = Field(description='Custom id c_<lat>_<lon>, with four decimal places.')
    status: Literal['queued', 'running', 'ready', 'failed'] = Field(description='Job status.')
    site: Site | None = Field(description='Completed site, or null.')
    error: ErrorDetail | None = Field(description='Error code and message, or null.')


class SensitivityRequest(Contract):
    """Request for a local sensitivity grid."""

    lat_deg: Latitude = Field(description='Latitude in degrees north.')
    lon_deg: Longitude = Field(description='East longitude in degrees.')
    landing_utc: UTC = Field(description='Landing time in UTC.')
    duration_days: float = Field(description='Mission duration in days.')
    min_sun_fraction: float = Field(description='Minimum Sun fraction, dimensionless.')
    antenna_mask_deg: float = Field(description='Antenna mask clearance in degrees.')


class SensitivityCentre(Contract):
    """Centre point results."""

    sun_fraction_mean: float = Field(description='Mean Sun disc fraction, dimensionless.')
    link_fraction: float = Field(description='Share of hours with a link, dimensionless.')


class SensitivityResponse(Contract):
    """Sensitivity grid, row-major with row 0 north."""

    size: int = Field(description='Grid width and height in points.')
    spacing_m: float = Field(description='Grid spacing in metres.')
    sun_fraction_mean: list[float] = Field(description='Mean Sun fraction, row-major, row 0 north; size × size values.')
    link_fraction: list[float] = Field(description='Link fraction, row-major, row 0 north; size × size values.')
    centre_full_method: SensitivityCentre = Field(description='Centre evaluated using full skyline.')
    centre_fast_method: SensitivityCentre = Field(description='Centre evaluated using fast skyline.')

    @model_validator(mode="after")
    def validate_grid(self):
        if self.size <= 0 or len(self.sun_fraction_mean) != self.size ** 2 or len(self.link_fraction) != self.size ** 2:
            raise ValueError("Each sensitivity array must contain size * size values")
        return self


# Binary encodings from docs/data-contracts.md; every array is little-endian.

SERIES_COLUMNS = tuple(SeriesColumn(name=n, scale=s, offset=o) for n, s, o in [('sun_az', 0.01, 180), ('sun_el', 0.01, 0), ('sun_frac', 0.0001, 0), ('sun_clear', 0.01, 0), ('earth_az', 0.01, 180), ('earth_el', 0.01, 0), ('earth_frac', 0.0001, 0), ('earth_clear', 0.01, 0)])


class SeriesLayout(Contract):
    """Series file: column-major Int16 arrays."""

    dtype: Literal['int16'] = Field(description='Signed 16-bit integers.', default="int16")
    byte_order: Literal['little'] = Field(description='Little-endian byte order.', default="little")
    arrays: tuple[ColumnSunAz, ColumnSunEl, ColumnSunFrac, ColumnSunClear, ColumnEarthAz, ColumnEarthEl, ColumnEarthFrac, ColumnEarthClear] = Field(description='Column arrays in documented order; decode raw * scale + offset.', default_factory=lambda: tuple(cls.model_validate(column.model_dump()) for cls, column in zip((ColumnSunAz, ColumnSunEl, ColumnSunFrac, ColumnSunClear, ColumnEarthAz, ColumnEarthEl, ColumnEarthFrac, ColumnEarthClear), SERIES_COLUMNS)))

    @model_validator(mode="after")
    def documented_columns(self):
        expected = [("sun_az", 0.01, 180.0), ("sun_el", 0.01, 0.0), ("sun_frac", 0.0001, 0.0), ("sun_clear", 0.01, 0.0), ("earth_az", 0.01, 180.0), ("earth_el", 0.01, 0.0), ("earth_frac", 0.0001, 0.0), ("earth_clear", 0.01, 0.0)]
        if [(c.name, c.scale, c.offset) for c in self.arrays] != expected:
            raise ValueError("Series columns must match documented order, scales and offsets")
        return self


class SkylineLayout(Contract):
    """Skyline file: five Float32 arrays."""

    dtype: Literal['float32'] = Field(description='32-bit floating point.', default="float32")
    byte_order: Literal['little'] = Field(description='Little-endian byte order.', default="little")
    arrays: tuple[Literal['el_deg'], Literal['dist_km'], Literal['lat_deg'], Literal['lon_deg'], Literal['height_m']] = Field(description='Ordered skyline arrays: degrees, kilometres, degrees, degrees, metres.', default=('el_deg', 'dist_km', 'lat_deg', 'lon_deg', 'height_m'))


class TerrainLayout(Contract):
    """Terrain or close-up file: four Float32 arrays."""

    dtype: Literal['float32'] = Field(description='32-bit floating point.', default="float32")
    byte_order: Literal['little'] = Field(description='Little-endian byte order.', default="little")
    arrays: tuple[Literal['east_km'], Literal['north_km'], Literal['up_km'], Literal['slope_deg']] = Field(description='Ordered position in kilometres and slope in degrees.', default=('east_km', 'north_km', 'up_km', 'slope_deg'))
    row_order: Literal['north_to_south'] = Field(description='Row 0 is the northern edge.', default="north_to_south")
    column_order: Literal['west_to_east'] = Field(description='Column 0 is the western edge.', default="west_to_east")


class SystemLayout(Contract):
    """Global ephemeris file: six Float32 arrays."""

    dtype: Literal['float32'] = Field(description='32-bit floating point.', default="float32")
    byte_order: Literal['little'] = Field(description='Little-endian byte order.', default="little")
    arrays: tuple[Literal['subsolar_lat'], Literal['subsolar_lon'], Literal['subearth_lat'], Literal['subearth_lon'], Literal['earth_dist_km'], Literal['sun_dist_km']] = Field(description='Ordered sub-point latitudes and longitudes in degrees and distances in kilometres.', default=('subsolar_lat', 'subsolar_lon', 'subearth_lat', 'subearth_lon', 'earth_dist_km', 'sun_dist_km'))


class MapLookupLayout(Contract):
    """Uint8 map lookup grid with the same orientation as the images."""

    dtype: Literal['uint8'] = Field(description='Unsigned 8-bit integers.', default="uint8")
    byte_order: Literal['little'] = Field(description='Little-endian byte order.', default="little")
    scale: float = Field(description='Decode valid values as raw / 255.', default=1 / 255, json_schema_extra={"const": 1 / 255})
    missing: Literal[255] = Field(description='255 means no data.', default=255)
    row_order: Literal['top_to_bottom'] = Field(description='Row 0 is the top; +y is up.', default="top_to_bottom")
    column_order: Literal['left_to_right'] = Field(description='Column 0 is left; +x is right.', default="left_to_right")

    @model_validator(mode="after")
    def validate_scale(self):
        if self.scale != 1 / 255:
            raise ValueError("Lookup scale must equal 1 / 255")
        return self


class ApronLayout(Contract):
    """Surrounding-terrain apron: one little-endian uint16 grid.

    A finite value decodes as ``raw / scale - offset_m`` (step 0.5 m). The value
    65535 is no height, never a real elevation. Row 0 is north and column 0 is west,
    the same axes as ``terrain.bin``.
    """

    dtype: Literal['uint16'] = Field(description='Unsigned 16-bit integers.', default='uint16')
    byte_order: Literal['little'] = Field(description='Little-endian byte order.', default='little')
    offset_m: float = Field(description='Decode a finite value as raw / scale - offset_m.', default=12000.0, json_schema_extra={'const': 12000.0})
    scale: float = Field(description='Decode a finite value as raw / scale - offset_m.', default=2.0, json_schema_extra={'const': 2.0})
    missing: Literal[65535] = Field(description='65535 means no height.', default=65535)
    row_order: Literal['north_to_south'] = Field(description='Row 0 is the northern edge.', default='north_to_south')
    column_order: Literal['west_to_east'] = Field(description='Column 0 is the western edge.', default='west_to_east')

    @model_validator(mode='after')
    def fixed_encoding(self):
        if self.offset_m != 12000.0 or self.scale != 2.0:
            raise ValueError('apron values are (height_m + 12000) * 2')
        return self


SceneEncoding = Literal['webp_q82_m6', 'webp_q80_m6', 'webp_q85_m6', 'webp_q92_m6', 'webp_lossless_m6', 'webp_lossless', 'webp_q80_m4', 'png_grey8', 'jpeg_q84_progressive']
SceneOrientation = Literal['equirectangular_lon0_center_north_up', 'south_polar_stereographic_x_right_y_up']


class SceneImage(Contract):
    """One image the scene draws, with the operation that made it."""

    file: str = Field(min_length=1, description='Path under /data/, such as scene/moon_4k.webp or maps/hillshade_4k.webp.')
    width_px: int = Field(gt=0, description='Width in pixels.')
    height_px: int = Field(gt=0, description='Height in pixels.')
    encoding: SceneEncoding = Field(description='Encoder settings. Lossy WebP names are quality and method.')
    orientation: SceneOrientation = Field(description='Pixel axes.')
    source: str = Field(min_length=1, description='Source file or derived product.')
    operation: str = Field(min_length=1, description='Resize, crop, split, re-encode, or slope, in plain language.')
    credit: str = Field(min_length=1, description='Credit line for the source.')
    optional: bool = Field(default=False, description='True when the scene can load without this file.')


class SceneApronFile(Contract):
    """One site's apron file."""

    site_id: SiteId = Field(description='Catalog site id. Sphere-tier sites have no apron.')
    file: str = Field(min_length=1, description='Path under /data/, scene/aprons/<site_id>.bin.')
    rows: int = Field(gt=1, description='Rows. Row 0 is the northern edge.')
    columns: int = Field(gt=1, description='Columns. Column 0 is the western edge.')
    window_m: float = Field(gt=0, description='Width and height of the square, in metres.')

    @model_validator(mode='after')
    def square_named_for_the_site(self):
        if self.rows != self.columns:
            raise ValueError('an apron grid is square')
        if not self.file.endswith(f'{self.site_id}.bin'):
            raise ValueError('apron file name must end with the site id')
        return self


class SceneInput(Contract):
    """A file the scene build read, so a second run can skip unchanged work."""

    name: str = Field(min_length=1, description='File name.')
    bytes: int = Field(ge=0, description='Size in bytes.')
    sha256: str = Field(pattern=r'^[0-9a-f]{64}$', description='SHA-256 of the file content, in hex.')


class SceneMeta(Contract):
    """scene/meta.json: every scene file, its pixels, encoding, orientation and source."""

    schema_version: Literal[1] = Field(description='Contract version.', default=1)
    generated_utc: UTC = Field(description='Generation timestamp in UTC.')
    images: list[SceneImage] = Field(description='Moon, Earth and polar-cap images, including maps the scene reads in place.')
    aprons: list[SceneApronFile] = Field(description='One apron for each non-sphere site. The 20 km patch is terrain.bin, not repeated here.')
    apron: ApronLayout = Field(description='Shared apron encoding.', default_factory=ApronLayout)
    inputs: list[SceneInput] = Field(description='Input fingerprints for the up-to-date check.', default_factory=list)

    @model_validator(mode='after')
    def unique_entries(self):
        files = [image.file for image in self.images]
        if not files:
            raise ValueError('scene meta lists at least one image')
        if len(files) != len(set(files)):
            raise ValueError('scene image files must be unique')
        ids = [apron.site_id for apron in self.aprons]
        if len(ids) != len(set(ids)):
            raise ValueError('scene apron sites must be unique')
        apron_files = [apron.file for apron in self.aprons]
        if len(apron_files) != len(set(apron_files)):
            raise ValueError('scene apron files must be unique')
        return self


class BinaryLayouts(Contract):
    """Binary formats, with ordered arrays and orientation."""

    series: SeriesLayout = Field(description='Per-site series encoding.', default_factory=SeriesLayout)
    skyline: SkylineLayout = Field(description='Skyline encoding.', default_factory=SkylineLayout)
    terrain: TerrainLayout = Field(description='Terrain mesh encoding.', default_factory=TerrainLayout)
    closeup: TerrainLayout = Field(description='Close-up mesh encoding.', default_factory=TerrainLayout)
    system: SystemLayout = Field(description='Global ephemeris encoding.', default_factory=SystemLayout)
    map_lookup: MapLookupLayout = Field(description='Map lookup encoding.', default_factory=MapLookupLayout)
    apron: ApronLayout = Field(description='Surrounding-terrain apron encoding.', default_factory=ApronLayout)


BINARY_LAYOUTS = BinaryLayouts().model_dump(mode="json")

CONTRACT_MODELS = tuple(
    value
    for value in list(globals().values())
    if isinstance(value, type)
    and issubclass(value, BaseModel)
    and value not in (BaseModel, RootModel, Contract)
    and value.__module__ == __name__
    and not value.__name__.startswith("RootModel[")
)
