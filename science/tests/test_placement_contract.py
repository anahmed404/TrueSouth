"""Backwards-compatible site fields for decision 0012."""

import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from truesouth.contracts import CatalogSite, Site


def old_site():
    record = json.loads((Path(__file__).parents[2] / 'data/fixtures/sites.json').read_text('utf-8'))[0]
    for key in ('variant_of', 'offset_m', 'nearby_sun'):
        record.pop(key, None)
    return record


def test_old_site_defaults_and_valid_variant():
    site = Site.model_validate(old_site())
    assert site.variant_of is None
    assert site.offset_m is None
    assert site.nearby_sun is None
    record = old_site() | dict(id='ridge_best_lit', variant_of='ridge', offset_m=0,
                              nearby_sun=dict(radius_m=160, points=1, min=0, max=1))
    variant = Site.model_validate(record)
    assert variant.nearby_sun.points == 1
    assert variant.offset_m == 0


@pytest.mark.parametrize('fields', [
    dict(variant_of='ridge'), dict(offset_m=10),
    dict(variant_of='ridge', offset_m=-1, id='ridge_best_lit'),
    dict(variant_of='ridge', offset_m=1, id='wrong_best_lit'),
    dict(variant_of='bad id', offset_m=1), dict(offset_m='far'),
    dict(variant_of='ridge', offset_m='80', id='ridge_best_lit'),
    dict(variant_of='ridge', offset_m=float('inf'), id='ridge_best_lit'),
    dict(nearby_sun='sunny'),
    *[dict(nearby_sun=dict(radius_m=160, points=3, min=.2, max=.8) | change)
      for change in (dict(radius_m=0), dict(radius_m=-1), dict(points=0),
                     dict(points=1.5), dict(min=-.1), dict(max=1.1),
                     dict(min=.9, max=.8), dict(extra=1), dict(radius_m=float('inf')),
                     dict(points=True), dict(min='0.2'), dict(max=float('nan')))],
])
def test_invalid_placement_fields(fields):
    with pytest.raises(ValidationError):
        Site.model_validate(old_site() | fields)


def test_catalog_does_not_accept_variant_fields():
    record = {key: value for key, value in old_site().items() if key in CatalogSite.model_fields}
    with pytest.raises(ValidationError, match='extra_forbidden'):
        CatalogSite.model_validate(record | dict(variant_of='ridge'))
