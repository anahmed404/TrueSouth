import copy
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from truesouth import contracts as c


def test_schema_matches_fresh_export_before_writing(tmp_path):
    from truesouth.cli import schema_bytes
    committed = Path('web/src/contracts/schema.json').read_bytes()
    fresh = schema_bytes()
    assert committed == fresh == schema_bytes()
    defs = json.loads(fresh)['$defs']
    assert set(defs['ProfileProvenance']['required']) == set(c.PROFILE_FIELDS)
    assert defs['ProfileProvenance']['additionalProperties'] is False
    assert defs['MissionProfile']['additionalProperties'] is False


def test_profile_provenance_is_closed_and_discriminated():
    fields = {key: {'kind': 'assumed', 'reason': 'Not published'} for key in c.PROFILE_FIELDS}
    fields['duration_days'] = {'kind': 'sourced', 'source_url': 'https://science.nasa.gov/mission/viper/lunar-operations/', 'quote': 'approximately 100-day mission'}
    p = c.ProfileProvenance.model_validate(fields)
    assert p.model_dump() == fields
    for mutate in (lambda d: d.pop('duration_days'), lambda d: d.update(unknown={'kind': 'assumed', 'reason': 'x'}), lambda d: d['duration_days'].pop('quote')):
        invalid = copy.deepcopy(fields)
        mutate(invalid)
        with pytest.raises(ValidationError):
            c.ProfileProvenance.model_validate(invalid)


@pytest.mark.parametrize('timestamp', ['2026-02-31T00:00:00Z', '2026-01-01T00:00:00z', '2026-01-01T00:00:00+00:00'])
def test_bad_times(timestamp):
    with pytest.raises(ValidationError):
        c.TimeGrid(start_utc=timestamp, step_s=3600, count=1)


@pytest.mark.parametrize('lat,lon', [(90.0001, 0), (-90.0001, 0), (0, float('inf')), (0, float('nan'))])
def test_bad_coordinates(lat, lon):
    with pytest.raises(ValidationError):
        c.CustomSiteRequest(lat_deg=lat, lon_deg=lon, name='test')


@pytest.mark.parametrize('lat', [-90, 90])
def test_boundary_coordinates(lat):
    with pytest.raises(ValidationError):
        c.CustomSiteRequest(lat_deg=lat, lon_deg=0, name='test')


def test_extra_fields_rejected():
    with pytest.raises(ValidationError):
        c.CustomSiteRequest(lat_deg=0, lon_deg=0, name='test', naem='typo')


def test_series_columns_are_fixed():
    columns = [x.model_dump() for x in c.SERIES_COLUMNS]
    c.SeriesMeta(columns=columns)
    for invalid in ([dict(columns[0], name='made_up'), *columns[1:]], columns[::-1], [dict(columns[0], scale=1), *columns[1:]]):
        with pytest.raises(ValidationError):
            c.SeriesMeta(columns=invalid)


def test_binary_layout_rejects_invented_dtype_or_array():
    valid = c.BinaryLayouts().model_dump()
    for field, value in [('dtype', 'int32'), ('arrays', ['invented'])]:
        invalid = copy.deepcopy(valid)
        invalid['skyline'][field] = value
        with pytest.raises(ValidationError):
            c.BinaryLayouts.model_validate(invalid)


def test_sensitivity_response_length():
    centre = {'sun_fraction_mean': .8, 'link_fraction': .4}
    with pytest.raises(ValidationError):
        c.SensitivityResponse(size=9, spacing_m=250, sun_fraction_mean=[.8], link_fraction=[.4] * 81, centre_full_method=centre, centre_fast_method=centre)


def test_feature_iau_id_round_trip():
    feature = {'name': 'Shackleton', 'kind': 'crater', 'iau_id': 5450, 'lat_deg': -89.67, 'lon_deg': 129.78, 'diameter_km': 20.92}
    assert c.Feature.model_validate(feature).model_dump() == feature


def test_worked_examples_flat_aliases_and_nested_rejection():
    from types import UnionType
    from typing import get_args, get_origin
    def sample(field):
        if 'utc' in field.alias or field.alias.endswith('_date'):
            return '2028-01-01T00:00:00Z'
        annotation = field.annotation
        origin = get_origin(annotation)
        if origin is UnionType:
            remaining = [item for item in get_args(annotation) if item is not type(None)]
            annotation = remaining[0]
            origin = get_origin(annotation)
        if annotation is str:
            return 'example'
        if annotation is bool:
            return True
        if origin is list and get_args(annotation) == (str,):
            return ['example']
        if origin is list:
            return [20.0] * 13 + [14.0] + [10.0] * 7
        return 1.0
    flat = {field.alias: sample(field) for field in c.WorkedExamples.model_fields.values()}
    flat['l4.mask_for_15pct_deg'] = 6.5
    example = {'l1.sun_el_max_deg': 2.0, 'l1.sun_el_min_deg': .72, 'l3.drop_at_20km_m': 115.1}
    flat.update(example)
    assert c.WorkedExamples.model_validate(flat).model_dump(by_alias=True).items() >= example.items()
    with pytest.raises(ValidationError):
        c.WorkedExamples.model_validate({'l1': {'sun_el_max_deg': 2.0}})

def test_viper_preset_round_trips_with_sourced_and_assumed_provenance():
    provenance = {name: {'kind': 'assumed', 'reason': 'Not published; team assumption.'} for name in c.PROFILE_FIELDS}
    operations = 'https://science.nasa.gov/mission/viper/lunar-operations/'
    provenance.update({
        'duration_days': {'kind': 'sourced', 'source_url': operations, 'quote': 'approximately 100-day mission'},
        'max_dark_h': {'kind': 'sourced', 'source_url': operations, 'quote': 'cannot endure more than 50 hours of continuous darkness'},
        'relay_available': {'kind': 'sourced', 'source_url': operations, 'quote': 'VIPER relies on NASA’s Deep Space Network'},
        'max_blackout_h': {'kind': 'sourced', 'source_url': 'https://science.nasa.gov/wp-content/uploads/2024/08/viper-pip-final.pdf', 'quote': 'Loss of Signal (LOS) period, for up to 18 days'},
        'max_slope_deg': {'kind': 'sourced', 'source_url': 'https://ntrs.nasa.gov/api/citations/20220008301/downloads/2022-06-02-spaceops-viper-planning.pdf', 'quote': '15 deg slope limit'},
    })
    profile = {'id': 'viper', 'name': 'VIPER', 'based_on': 'VIPER', 'duration_days': 100, 'min_sun_fraction': .5, 'ops_sun_el_min_deg': None, 'max_dark_h': 50, 'relay_available': False, 'antenna_mask_deg': 1, 'max_blackout_h': 432, 'max_slope_deg': 15, 'slope_ideal_deg': 5, 'landing_sun_el_min_deg': None, 'landing_sun_el_max_deg': None, 'weights': {'slope': .4, 'power': .35, 'comms': .25}, 'provenance': provenance}
    assert c.MissionProfile.model_validate(profile).model_dump(mode='json') == profile
    invalid = copy.deepcopy(profile)
    invalid['duration_day'] = 100
    with pytest.raises(ValidationError):
        c.MissionProfile.model_validate(invalid)


def test_documented_validation_example_and_api_error_detail():
    # The validation.json example itself is checked against docs/validation.md in
    # test_validation_contract.py; here a hand-built one must round-trip unchanged.
    example = {
        'generated_utc': '2026-11-14T09:00:00Z',
        'gates': [{'id': 'G2', 'name': 'Horizons check', 'passed': True, 'measured': .011, 'limit': .02,
                   'unit': 'deg', 'samples': 2103360, 'detail': None}],
        'comparisons': [{'id': 'R1', 'site_id': 'connecting_ridge', 'ours': .83, 'reference': .86,
                         'unit': 'fraction', 'reference_source': 'https://pgda.gsfc.nasa.gov/products/69',
                         'investigate_above': .1, 'outside_mark': False, 'explanation': None}],
        'g2_over_time': [{'site_id': 'connecting_ridge', 'body': 'sun', 'start_utc': '2026-01-01T00:00:00Z',
                          'step_h': 24, 'max_difference_deg': [.0002, .0002]}],
        'sources': [{'name': 'JPL Horizons', 'url': 'https://ssd.jpl.nasa.gov/horizons/',
                     'used_for': 'Sun and Earth positions'}],
    }
    assert c.Validation.model_validate(example).model_dump(exclude_unset=True) == example
    status = {'site_id': 'c_-89.2000_130.5000', 'status': 'failed', 'site': None, 'error': {'code': 'terrain_unavailable', 'message': 'Terrain unavailable.'}}
    assert c.CustomSiteStatus.model_validate(status).model_dump(exclude_unset=True) == status


def test_documented_worked_example_subset():
    from pydantic import TypeAdapter
    example = {'l1.sun_el_max_deg': 2.0, 'l1.sun_el_min_deg': .72, 'l3.drop_at_20km_m': 115.1}
    fields = {field.alias: field for field in c.WorkedExamples.model_fields.values()}
    for key, value in example.items():
        assert TypeAdapter(fields[key].annotation).validate_python(value) == value


def test_models_have_descriptions_and_closed_schema():
    from truesouth.cli import schema_bytes
    defs = json.loads(schema_bytes())['$defs']
    for model in c.CONTRACT_MODELS:
        assert model.__doc__
        assert all(field.description for field in model.model_fields.values())
        if issubclass(model, c.Contract):
            assert defs[model.__name__]['additionalProperties'] is False


def test_site_ids_and_lookup_orientation():
    from pydantic import TypeAdapter
    adapter = TypeAdapter(c.SiteId)
    assert adapter.validate_python('connecting_ridge') == 'connecting_ridge'
    assert adapter.validate_python('c_-89.2000_130.5000') == 'c_-89.2000_130.5000'
    for invalid in ['Connecting Ridge', 'SITE', 'bad-name']:
        with pytest.raises(ValidationError):
            adapter.validate_python(invalid)
    layout = c.MapLookupLayout()
    assert (layout.missing, layout.scale, layout.row_order, layout.column_order) == (255, 1 / 255, 'top_to_bottom', 'left_to_right')
    with pytest.raises(ValidationError):
        c.MapLookupLayout(scale=0.5)

def test_every_documented_contract_json_example():
    import re
    text = Path('docs/data-contracts.md').read_text(encoding='utf-8')
    blocks = re.findall(r'```json\s*\n(.*?)\n```', text, flags=re.S)
    assert len(blocks) == 8
    # The status example uses a pseudocode placeholder in place of a site entry.
    blocks[5] = re.sub(r'"site": \{[^}]*\}', '"site": null', blocks[5])
    examples = [json.loads(block) for block in blocks]
    models = [c.Manifest, c.SiteMeta, c.MapMeta, c.CustomSiteRequest, c.CustomSiteQueued, c.CustomSiteStatus, c.SensitivityRequest]
    for model, example in zip(models, examples[:7], strict=True):
        model.model_validate(example)
    # Fill the response's explicitly documented 81-value arrays in place of ellipses.
    response = examples[7]
    response['sun_fraction_mean'] = [0.81, 0.79] + [0.8] * 79
    response['link_fraction'] = [0.44] * 81
    c.SensitivityResponse.model_validate(response)

def test_individual_series_column_rejects_wrong_scaling():
    with pytest.raises(ValidationError):
        c.SeriesColumn(name='sun_az', scale=1, offset=180)
