"""G1 uses real Horizons headers and exact printed values; no network."""

import json
from pathlib import Path

import numpy as np
import pytest

from truesouth.horizons import global_request, parse_global, parse_site, site_request

DATA = Path(__file__).parent / 'data'


def test_global_exact_values_and_header_conventions():
    table = parse_global((DATA / 'horizons_global.json').read_text(encoding='utf-8'))
    assert table.frame == 'MOON_ME'
    assert table.longitude_positive == 'east'
    assert len(table.times) == 73
    assert str(table.times[0]) == '2026-01-01T00:00:00'
    first = {name: values[0] for name, values in table.columns.items()}
    assert first == dict(subsolar_lat=-1.346422, subsolar_lon=32.519634,
                         subearth_lat=-6.556142, subearth_lon=358.716549,
                         earth_dist_km=0.00241343753005 * 149597870.700,
                         sun_dist_km=0.985323858740 * 149597870.700)
    assert table.columns['subearth_lon'][17] == 0.057672


def test_west_positive_header_copy_converts_once():
    # Horizons has no output-sign switch for lunar cartography. This deliberately
    # edited fixture changes the header and its two column descriptions together.
    response = (DATA / 'horizons_global_west.json').read_text(encoding='utf-8')
    table = parse_global(response)
    assert table.longitude_positive == 'west'
    assert table.columns['subearth_lon'][0] == pytest.approx(1.283451)
    assert table.columns['subsolar_lon'][0] == pytest.approx(327.480366)


def test_unknown_or_contradictory_conventions_fail():
    response = (DATA / 'horizons_global.json').read_text(encoding='utf-8')
    for broken in [response.replace('MOON_ME', 'UNKNOWN_FRAME'),
                   response.replace('{East-longitude positive}', '{unknown sign}', 1),
                   response.replace('to the EAST', 'to the WEST', 1)]:
        with pytest.raises(ValueError):
            parse_global(broken)


@pytest.mark.parametrize('body,az,el', [
    ('sun', 169.902062850, 0.809682737), ('earth', 136.144063227, 5.889668057),
])
def test_site_values_and_local_frame(body, az, el):
    table = parse_site((DATA / f'horizons_connecting_ridge_{body}.json').read_text(encoding='utf-8'))
    assert table.frame == 'MEAN_ME (high precision)'
    assert table.longitude_positive == 'east'
    assert table.columns['az_deg'][0] == az
    assert table.columns['el_deg'][0] == el
    assert len(table.times) == 73


def test_request_grid_is_inclusive_and_site_height_is_two_metres():
    request = global_request()
    assert request['STOP_TIME'] == "'2031-12-31 23:00:00'"
    assert request['QUANTITIES'] == "'14,15,19,20'"
    request = site_request('sun', -89.4555, 222.6192)
    assert request['SITE_COORD'] == "'222.6192,-89.4555,0.002'"
    assert request['APPARENT'] == "'AIRLESS'"
    assert request['CENTER'] == "'coord@301'"


def test_malformed_response_and_duplicate_times_fail():
    with pytest.raises(ValueError, match='refused'):
        parse_global(json.dumps({'error': 'No ephemeris meets criteria'}))
    response = (DATA / 'horizons_global.json').read_text(encoding='utf-8')
    with pytest.raises(ValueError, match='time'):
        parse_global(response.replace('2026-Jan-01 01:00,', '2026-Jan-01 00:00,'))
