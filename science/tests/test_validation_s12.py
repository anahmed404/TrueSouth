"""S12 public comparisons: constructed series, with independent expected answers."""

import numpy as np
import pytest
from pydantic import ValidationError

from truesouth.contracts import Comparison
from truesouth.validation import compare_sunlight, compare_earth, compare_slope, compare_convergence


def test_r1_mean_disc_fraction_not_share_of_lit_hours():
    result = compare_sunlight('test_site', [0, .25, .75, 1], .8)
    assert result.ours == .5
    assert result.reference == .8
    assert result.outside_mark
    for phrase in ('surface', '18.6', '2 m', 'six years', '80 m'):
        assert phrase in result.explanation


def test_r2_counts_any_visible_earth_not_mean_disc_fraction():
    result = compare_earth('test_site', [0, .0001, .5, 1], .75)
    assert result.ours == .75
    assert not result.outside_mark
    assert result.explanation is None


@pytest.mark.parametrize('comparison,values,reference', [
    (compare_sunlight, [.8, .8], .7),
    (compare_earth, [1]*8+[0]*2, .7),
])
def test_difference_exactly_at_mark_is_not_outside(comparison, values, reference):
    result = comparison('test_site', values, reference)
    assert not result.outside_mark
    assert result.explanation is None


def test_r3_known_slope_and_baseline_explanation():
    exact = compare_slope('test_site', 10, 8, reference_detail='NASA baseline 80 m; ours 160 m.')
    assert not exact.outside_mark
    bad = compare_slope('test_site', 10, 7, reference_detail='NASA baseline 80 m; ours 160 m.')
    assert bad.outside_mark
    assert '80 m' in bad.explanation and '160 m' in bad.explanation


def test_r5_rms_at_matching_azimuths():
    # Coarse [0, 0, 0, 0], fine centres [0, 0.06, 0.08, 0]: RMS = .05.
    result = compare_convergence('test_site', np.zeros(4), [0, 99, .06, 99, .08, 99, 0, 99])
    assert result.ours == pytest.approx(.05)
    assert result.reference == 0
    assert not result.outside_mark
    outside = compare_convergence('test_site', np.zeros(4), np.ones(8))
    assert outside.ours == 1 and outside.outside_mark and outside.explanation


def test_outside_comparison_without_explanation_is_rejected():
    value = compare_sunlight('test_site', [0], 1).model_dump()
    for explanation in (None, '', '  '):
        with pytest.raises(ValidationError):
            Comparison.model_validate({**value, 'explanation': explanation})


@pytest.mark.parametrize('values', [[], [float('nan')], [1.1], [-.1]])
def test_invalid_fractions_are_not_published(values):
    with pytest.raises(ValueError):
        compare_sunlight('test_site', values, .5)
