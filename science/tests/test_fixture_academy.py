from datetime import datetime, timedelta
import json
from pathlib import Path

import numpy as np
import pytest

from truesouth.derived_io import read_series, read_skyline

ROOT = Path(__file__).resolve().parents[2]
FIX = ROOT / 'data' / 'fixtures'


def test_academy_examples_follow_fixture_series():
    examples = json.loads((FIX / 'academy/worked_examples.json').read_text())
    real = json.loads((ROOT / 'data/derived/academy/worked_examples.json').read_text())
    assert examples.keys() == real.keys()
    # Optional values can be null in either dataset; non-null values share their type.
    for key in examples:
        if examples[key] is not None and real[key] is not None:
            assert type(examples[key]) is type(real[key]), key
    manifest = json.loads((FIX / 'manifest.json').read_text())
    grid = manifest['time_grid']
    parse = lambda value: datetime.fromisoformat(value.replace('Z', '+00:00'))
    start = parse(grid['start_utc'])
    landing = parse(examples['story.landing_utc'])
    end = parse(examples['story.month_end_utc'])
    assert end == landing + timedelta(hours=720)
    first = int((landing - start).total_seconds() / 3600)
    assert 0 <= first and first + 720 < grid['count']
    site = examples['story.site_id']
    series = read_series(FIX / 'sites' / site / 'series.bin', grid['count'])
    month = slice(first, first + 720)
    sun = series['sun_el'][month]
    assert examples['l1.sun_el_max_deg'] == pytest.approx(np.max(sun))
    assert parse(examples['l1.example_utc']) == start + timedelta(hours=first + int(np.argmax(sun)))
    assert examples['l4.earth_el_max_deg'] == pytest.approx(np.max(series['earth_el'][month]))
    assert examples['l4.earth_up_pct'] == pytest.approx(100 * np.count_nonzero(series['earth_frac'][month] > 0) / 720)
    assert 40 < examples['l4.earth_up_pct'] < 80
    assert examples['l4.link_pct_mask1'] == pytest.approx(100 * np.count_nonzero(series['earth_clear'][month] >= 1) / 720)
    assert np.ptp(np.unwrap(np.radians(series['sun_az'][month]))) > 2 * np.pi
    assert np.max(np.abs(sun)) < 5
    site2 = examples['l2.site_id']
    s2 = read_series(FIX / 'sites' / site2 / 'series.bin', grid['count'])
    sky = read_skyline(FIX / 'sites' / site2 / 'skyline.bin', manifest['skyline_bins'])
    hour = int((parse(examples['l2.example_utc']) - start).total_seconds() / 3600)
    az = s2['sun_az'][hour]
    bin_index = int(np.floor(az * manifest['skyline_bins'] / 360 + .5)) % manifest['skyline_bins']
    assert examples['l2.sun_el_deg'] == pytest.approx(s2['sun_el'][hour])
    assert examples['l2.ridge_el_deg'] == pytest.approx(sky['el_deg'][bin_index])
    assert examples['l2.sun_frac'] == pytest.approx(s2['sun_frac'][hour])
    assert s2['sun_el'][hour] > 0 and s2['sun_frac'][hour] < .5
