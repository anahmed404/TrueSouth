"""G2 at its unchanged 0.02° tolerance, against real three-day site tables."""

from pathlib import Path

import numpy as np
import pytest

from truesouth.constants import EARTH_RADIUS_KM, SUN_RADIUS_KM, TIME_GRID_COUNT
from truesouth.ephemeris import compare_site, load_global, topocentric
from truesouth.horizons import parse_global, parse_site

DATA = Path(__file__).parent / 'data'


@pytest.mark.parametrize('site,lat,lon', [
    ('connecting_ridge', -89.4555, 222.6192),
    ('apollo11', 0.67416, 23.47314),
    ('change4', -45.4561, 177.5885),
])
@pytest.mark.parametrize('body,radius', [('sun', SUN_RADIUS_KM), ('earth', EARTH_RADIUS_KM)])
def test_g2_saved_real_responses(site, lat, lon, body, radius):
    global_table = parse_global((DATA / 'horizons_global.json').read_text(encoding='utf-8'))
    reference = parse_site((DATA / f'horizons_{site}_{body}.json').read_text(encoding='utf-8'))
    np.testing.assert_array_equal(global_table.times, reference.times)
    assert len(reference.times) == 73
    columns = {name: values.astype('<f4') for name, values in global_table.columns.items()}
    prefix = 'subsolar' if body == 'sun' else 'subearth'
    predicted = topocentric(lat, lon, columns[f'{prefix}_lat'], columns[f'{prefix}_lon'],
                            columns[f'{body}_dist_km'], radius)
    report = compare_site(predicted, reference.columns, reference.times)
    assert report['az_max_deg'] <= 0.02, report
    assert report['el_max_deg'] <= 0.02, report
    assert report['sky_max_deg'] <= 0.02, report


def test_committed_global_ephemeris_is_loadable():
    columns = load_global()
    assert len(columns) == 6
    assert all(values.shape == (TIME_GRID_COUNT,) for values in columns.values())
    assert columns['subsolar_lon'][0] == np.float32(32.519634)
