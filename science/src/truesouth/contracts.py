from datetime import datetime
from typing import Annotated, Literal
from pydantic import BaseModel, Field, RootModel, StringConstraints, field_validator, model_validator

Latitude = Annotated[float, Field(ge=-90, le=90)]
Longitude = Annotated[float, Field(ge=0, lt=360)]
UTC = Annotated[str, StringConstraints(pattern=r'^\d{4}-\d\d-\d\dT\d\d:\d\d(?::\d\d(?:\.\d+)?)?Z$')]

class Contract(BaseModel):
    @field_validator('*', mode='after')
    @classmethod
    def valid_dates(cls, value, info):
        if info.field_name.endswith('_utc') and isinstance(value, str):
            datetime.fromisoformat(value.replace('Z', '+00:00'))
        return value

class TimeGrid(Contract):
    start_utc: UTC
    step_s: int
    count: int

class Manifest(Contract):
    schema_version: Literal[1]
    generated_utc: UTC
    time_grid: TimeGrid
    observer_height_m: float
    skyline_bins: int
    moon_radius_m: float

class Slope(Contract):
    deg: float
    baseline_m: float
    source: str

class Site(Contract):
    id: str
    name: str
    group: Literal['artemis', 'sunlit_peak', 'polar_lander', 'contrast']
    lat_deg: Latitude
    lon_deg: Longitude
    description: str
    source_url: str
    outcome: str | None
    terrain_tier: Literal['core80', 'wide240', 'sphere']
    has_closeup: bool
    elevation_m: float | None
    slope: Slope | None
    quickmap_url: str
    moontrek_url: str

class Sites(RootModel[list[Site]]): pass

class SeriesColumn(Contract):
    name: str
    scale: float
    offset: float

class SeriesMeta(Contract):
    columns: list[SeriesColumn]

class SkylineMeta(Contract):
    bins: int
    missing_samples: int
    max_range_km: float

class MeshMeta(Contract):
    size: int
    window_km: float

class SiteMeta(Contract):
    site_id: str
    series: SeriesMeta
    sun_radius_deg: float
    earth_radius_deg: float
    skyline: SkylineMeta
    terrain: MeshMeta | None
    closeup: MeshMeta | None

class Sourced(Contract):
    kind: Literal['sourced']
    source_url: str
    quote: str

class Assumed(Contract):
    kind: Literal['assumed']
    reason: str

class Weights(Contract):
    slope: float = Field(ge=0)
    power: float = Field(ge=0)
    comms: float = Field(ge=0)

PROFILE_FIELDS = ('duration_days', 'min_sun_fraction', 'ops_sun_el_min_deg', 'max_dark_h', 'relay_available', 'antenna_mask_deg', 'max_blackout_h', 'max_slope_deg', 'slope_ideal_deg', 'landing_sun_el_min_deg', 'landing_sun_el_max_deg', 'weights')
class MissionProfile(Contract):
    id: str
    name: str
    based_on: str
    duration_days: float
    min_sun_fraction: float
    ops_sun_el_min_deg: float | None
    max_dark_h: float
    relay_available: bool
    antenna_mask_deg: float
    max_blackout_h: float
    max_slope_deg: float
    slope_ideal_deg: float
    landing_sun_el_min_deg: float | None
    landing_sun_el_max_deg: float | None
    weights: Weights
    provenance: dict[str, Sourced | Assumed]

    @model_validator(mode='after')
    def provenance_complete(self):
        if set(PROFILE_FIELDS) - self.provenance.keys():
            raise ValueError('Every profile value requires provenance')
        return self

class Profiles(RootModel[list[MissionProfile]]): pass
class Feature(Contract):
    name: str
    kind: str
    lat_deg: Latitude
    lon_deg: Longitude
    diameter_km: float
class Features(RootModel[list[Feature]]): pass
class ArtemisRegion(Contract):
    name: str
    lat_deg: Latitude | None
    lon_deg: Longitude | None
    size_km: float | None
    source_url: str
class ArtemisRegions(RootModel[list[ArtemisRegion]]): pass
class MapLayer(Contract):
    files: list[str]
    lookup: str | None = None
    lookup_size: int | None = None
class MapLayers(Contract):
    hillshade: MapLayer
    sunlight: MapLayer
    earthvis: MapLayer
class MapMeta(Contract):
    projection: Literal['south_polar_stereographic']
    half_width_m: float
    layers: MapLayers
class Gate(Contract):
    id: str
    name: str
    passed: bool
    measured: float
    limit: float
    unit: str
    samples: int
class Comparison(Contract):
    id: str
    site_id: str
    ours: float
    reference: float
    unit: str
    reference_source: str
class Validation(Contract):
    generated_utc: UTC
    gates: list[Gate]
    comparisons: list[Comparison]
class WorkedExamples(RootModel[dict[str, dict[str, object]]]): pass
class CustomSiteRequest(Contract):
    lat_deg: Latitude
    lon_deg: Longitude
    name: str
class CustomSiteQueued(Contract):
    site_id: str
    status: Literal['queued', 'running', 'ready', 'failed']
    position_in_queue: int
class CustomSiteStatus(Contract):
    site_id: str
    status: Literal['queued', 'running', 'ready', 'failed']
    site: Site | None
    error: str | None
class SensitivityRequest(Contract):
    lat_deg: Latitude
    lon_deg: Longitude
    landing_utc: UTC
    duration_days: float
    min_sun_fraction: float
    antenna_mask_deg: float
class SensitivityCentre(Contract):
    sun_fraction_mean: float
    link_fraction: float
class SensitivityResponse(Contract):
    size: int
    spacing_m: float
    sun_fraction_mean: list[float]
    link_fraction: list[float]
    centre_full_method: SensitivityCentre
    centre_fast_method: SensitivityCentre
class ErrorDetail(Contract):
    code: Literal['invalid_coordinates', 'date_outside_time_grid', 'rate_limited', 'queue_full', 'terrain_unavailable', 'not_found']
    message: str
class ErrorResponse(Contract):
    error: ErrorDetail

# docs/data-contracts.md: binary layouts, little endian and array-major.
SERIES_COLUMNS = tuple(SeriesColumn(name=n, scale=s, offset=o) for n,s,o in [
    ('sun_az', .01, 180), ('sun_el', .01, 0), ('sun_frac', .0001, 0), ('sun_clear', .01, 0),
    ('earth_az', .01, 180), ('earth_el', .01, 0), ('earth_frac', .0001, 0), ('earth_clear', .01, 0)])
BINARY_LAYOUTS = {
    'series': {'dtype': 'int16', 'byte_order': 'little', 'arrays': [c.model_dump() for c in SERIES_COLUMNS]},
    'skyline': {'dtype': 'float32', 'byte_order': 'little', 'arrays': ['el_deg', 'dist_km', 'lat_deg', 'lon_deg', 'height_m']},
    'terrain': {'dtype': 'float32', 'byte_order': 'little', 'arrays': ['east_km', 'north_km', 'up_km', 'slope_deg'], 'row_order': 'north_to_south', 'column_order': 'west_to_east'},
    'closeup': {'dtype': 'float32', 'byte_order': 'little', 'arrays': ['east_km', 'north_km', 'up_km', 'slope_deg'], 'row_order': 'north_to_south', 'column_order': 'west_to_east'},
    'system': {'dtype': 'float32', 'byte_order': 'little', 'arrays': ['subsolar_lat', 'subsolar_lon', 'subearth_lat', 'subearth_lon', 'earth_dist_km', 'sun_dist_km']},
    'map_lookup': {'dtype': 'uint8', 'byte_order': 'little', 'scale': 1/255, 'missing': 255},
}
class BinaryLayouts(Contract):
    layouts: dict[str, object] = BINARY_LAYOUTS

CONTRACT_MODELS = (BinaryLayouts, TimeGrid, Manifest, Slope, Site, Sites, SeriesColumn, SeriesMeta, SkylineMeta, MeshMeta, SiteMeta, Sourced, Assumed, Weights, MissionProfile, Profiles, Feature, Features, ArtemisRegion, ArtemisRegions, MapLayer, MapLayers, MapMeta, Gate, Comparison, Validation, WorkedExamples, CustomSiteRequest, CustomSiteQueued, CustomSiteStatus, SensitivityRequest, SensitivityCentre, SensitivityResponse, ErrorDetail, ErrorResponse)
