import json
import subprocess
import sys
from pathlib import Path

import pytest
from pydantic import ValidationError
from truesouth.contracts import Manifest, CustomSiteRequest, MissionProfile


def test_manifest_example():
    Manifest.model_validate({"schema_version": 1, "generated_utc": "2026-11-14T09:00:00Z", "time_grid": {"start_utc": "2026-01-01T00:00:00Z", "step_s": 3600, "count": 52584}, "observer_height_m": 2.0, "skyline_bins": 1440, "moon_radius_m": 1737400})


def test_invalid_values():
    with pytest.raises(ValidationError):
        CustomSiteRequest(lat_deg=0, lon_deg=360, name="x")
    with pytest.raises(ValidationError):
        Manifest.model_validate({"schema_version": 1, "generated_utc": "2026-11-14T09:00:00+00:00", "time_grid": {"start_utc": "2026-01-01T00:00:00Z", "step_s": 3600, "count": 52584}, "observer_height_m": 2, "skyline_bins": 1440, "moon_radius_m": 1737400})
    with pytest.raises(ValidationError):
        MissionProfile.model_validate({})


def test_cli_and_schema():
    from truesouth.cli import COMMANDS, export_schema
    from truesouth.contracts import CONTRACT_MODELS
    export_schema()
    p = Path('web/src/contracts/schema.json')
    first = p.read_bytes()
    export_schema()
    assert first == p.read_bytes()
    assert set(json.loads(first)['$defs']) == {m.__name__ for m in CONTRACT_MODELS}
    help_text = subprocess.check_output([sys.executable, '-m', 'truesouth.cli', '--help'], text=True)
    for command in COMMANDS:
        assert command in help_text
        assert subprocess.run([sys.executable, '-m', 'truesouth.cli', command], capture_output=True).returncode != 0

def test_documented_examples():
    from truesouth.contracts import SiteMeta, MapMeta, CustomSiteQueued, SensitivityRequest, SensitivityResponse
    from truesouth.contracts import SERIES_COLUMNS
    SiteMeta.model_validate({'site_id':'connecting_ridge','series':{'columns':[c.model_dump() for c in SERIES_COLUMNS]},'sun_radius_deg':0.266,'earth_radius_deg':0.95,'skyline':{'bins':1440,'missing_samples':0,'max_range_km':300},'terrain':{'size':257,'window_km':20},'closeup':{'size':257,'window_km':2}})
    MapMeta.model_validate({'projection':'south_polar_stereographic','half_width_m':304000,'layers':{'hillshade':{'files':['hillshade_4k.webp','hillshade_8k.webp']},'sunlight':{'files':['sunlight_4k.webp'],'lookup':'sunlight_u8.bin','lookup_size':2048},'earthvis':{'files':['earthvis_4k.webp'],'lookup':'earthvis_u8.bin','lookup_size':2048}}})
    CustomSiteRequest.model_validate({'lat_deg':-89.2,'lon_deg':130.5,'name':'My site'})
    CustomSiteQueued.model_validate({'site_id':'c_-89.2000_130.5000','status':'queued','position_in_queue':1})
    SensitivityRequest.model_validate({'lat_deg':-89.45,'lon_deg':222.6,'landing_utc':'2028-03-14T00:00:00Z','duration_days':10,'min_sun_fraction':0.5,'antenna_mask_deg':1.0})
    SensitivityResponse.model_validate({'size':9,'spacing_m':250,'sun_fraction_mean':[.81]*81,'link_fraction':[.44]*81,'centre_full_method':{'sun_fraction_mean':.80,'link_fraction':.43},'centre_fast_method':{'sun_fraction_mean':.81,'link_fraction':.44}})


def test_profile_requires_each_provenance():
    from truesouth.contracts import PROFILE_FIELDS
    data = dict(id='x', name='x', based_on='x', duration_days=10, min_sun_fraction=.5, ops_sun_el_min_deg=None, max_dark_h=6, relay_available=False, antenna_mask_deg=1, max_blackout_h=12, max_slope_deg=10, slope_ideal_deg=5, landing_sun_el_min_deg=None, landing_sun_el_max_deg=None, weights={'slope':.4,'power':.35,'comms':.25}, provenance={k:{'kind':'assumed','reason':'test'} for k in PROFILE_FIELDS})
    MissionProfile.model_validate(data)
    del data['provenance']['duration_days']
    with pytest.raises(ValidationError):
        MissionProfile.model_validate(data)

def test_error_and_latitude():
    from truesouth.contracts import ErrorResponse
    ErrorResponse.model_validate({'error': {'code': 'invalid_coordinates', 'message': 'Invalid coordinates.'}})
    with pytest.raises(ValidationError):
        CustomSiteRequest(lat_deg=-91, lon_deg=0, name='bad')
