"""docs/validation.md's example validates, and a comparison outside its mark needs an explanation."""
import json
from pathlib import Path

import pytest
from pydantic import ValidationError

from truesouth.contracts import Comparison, Validation

ROOT = Path(__file__).resolve().parents[2]


def documented_example():
    doc = (ROOT / 'docs/validation.md').read_text(encoding='utf-8')
    section = doc.split('## `validation.json`', 1)[1]
    return json.loads(section.split('```json', 1)[1].split('```', 1)[0])


def test_documented_example_validates():
    example = Validation.model_validate(documented_example())
    assert example.gates[0].id == 'G2'
    assert example.comparisons[0].outside_mark is False
    assert example.g2_over_time[0].body == 'earth'
    assert example.sources[0].url.startswith('https://')


def test_comparison_outside_its_mark_needs_an_explanation():
    base = documented_example()['comparisons'][0]
    outside = {**base, 'ours': 0.60, 'outside_mark': True}
    with pytest.raises(ValidationError):
        Comparison.model_validate({**outside, 'explanation': None})
    with pytest.raises(ValidationError):
        Comparison.model_validate({**outside, 'explanation': '   '})
    Comparison.model_validate({**outside, 'explanation': 'NASA averages 18.6 years; we average 6.'})


def test_validation_rejects_unknown_fields_and_missing_parts():
    example = documented_example()
    with pytest.raises(ValidationError):
        Validation.model_validate({**example, 'g2_differences': []})
    for key in ('g2_over_time', 'sources', 'gates', 'comparisons'):
        with pytest.raises(ValidationError):
            Validation.model_validate({k: v for k, v in example.items() if k != key})
