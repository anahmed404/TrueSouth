import numpy as np
import pytest

from truesouth.contracts import MissionProfile, PROFILE_FIELDS, Weights
from truesouth.scoring import hour_flags, evaluate, slip_sweep, countdowns, window_length


def profile(**changes):
    values = dict(id="test", name="Test", based_on="Test", duration_days=4 / 24,
                  min_sun_fraction=.5, ops_sun_el_min_deg=None, max_dark_h=4,
                  relay_available=False, antenna_mask_deg=1, max_blackout_h=4,
                  max_slope_deg=10, slope_ideal_deg=5, landing_sun_el_min_deg=None,
                  landing_sun_el_max_deg=None, weights=dict(slope=2, power=3, comms=5),
                  provenance={key: dict(kind="assumed", reason="test") for key in PROFILE_FIELDS})
    values.update(changes)
    return MissionProfile(**values)


def series(sun, earth=None, el=None):
    sun = np.array(sun, dtype=float)
    n = len(sun)
    return dict(sun_frac=sun, sun_el=np.array(el if el is not None else [2]*n),
                earth_clear=np.array(earth if earth is not None else [2]*n),
                sun_az=np.zeros(n), sun_clear=np.zeros(n), earth_az=np.zeros(n),
                earth_el=np.zeros(n), earth_frac=np.zeros(n))


def test_thresholds():
    s = series([.499, .5, .501], [.999, 1, 1.001], [5.999, 6, 6.001])
    lit, link = hour_flags(s, profile(ops_sun_el_min_deg=6))
    assert lit.tolist() == [False, True, True]
    assert link.tolist() == [False, True, True]
    assert hour_flags(s, profile(relay_available=True))[1].all()


def test_window_length_and_end():
    s = series([1]*240 + [0])
    p = profile(duration_days=10)
    assert evaluate(s, p, 0, 5).metrics.lit_fraction == 1
    assert evaluate(s, p, 1, 5).metrics.lit_fraction == 239/240
    assert evaluate(s, p, 2, 5) is None


@pytest.mark.parametrize("flags,expected", [([1,1,1,1],0), ([0,0,1,1],2),
    ([1,1,0,0],2), ([0,1,0,0],2), ([0,0,0,0],4)])
def test_runs(flags, expected):
    # §9 measures runs over the window; the fifth sample is outside it.
    s = series(flags + [0], [2 if x else 0 for x in flags] + [0])
    m = evaluate(s, profile(), 0, 5).metrics
    assert m.longest_dark_h == expected
    assert m.longest_blackout_h == expected


def test_vetoes_and_utilities():
    s = series([1, 1, 0, 0], [2, 2, 0, 0], [4, 4, 4, 4])
    p = profile(max_dark_h=2, max_blackout_h=2, landing_sun_el_min_deg=4,
                landing_sun_el_max_deg=4)
    e = evaluate(s, p, 0, 10)
    assert not any(v.triggered for v in e.vetoes.values())
    assert e.utilities.slope == 0
    assert e.utilities.power == 0 and e.utilities.comms == 0
    p = p.model_copy(update=dict(max_dark_h=1, max_blackout_h=1,
        landing_sun_el_min_deg=5, landing_sun_el_max_deg=3))
    e = evaluate(s, p, 0, 11)
    for name, measured, limit in [("slope",11,10), ("darkness",2,1),
        ("blackout",2,1), ("landing_sun_low",4,5), ("landing_sun_high",4,3)]:
        assert e.vetoes[name].triggered
        assert (e.vetoes[name].measured, e.vetoes[name].limit) == (measured, limit)
    assert e.status == "NO-GO"
    assert evaluate(series([0,1,1,1]), profile(max_dark_h=0), 0, 5).vetoes["darkness"].triggered
    assert evaluate(series([0,1,1,1]), profile(), 0, 5).vetoes["landing_dark"].triggered


def test_score_relay_and_slope():
    s = series([1,1,1,1], [0,0,0,0])
    p = profile(relay_available=True, weights=dict(slope=2, power=3, comms=5))
    e = evaluate(s, p, 0, 7.5)
    # (2 * .5 + 3 * 1 + 5 * 1) / 10 = .9
    assert e.utilities.slope == .5 and e.utilities.comms == 1
    assert e.score == 90 and e.status == "GO"
    assert not e.vetoes["blackout"].triggered
    assert evaluate(s, p, 0, 5).utilities.slope == 1
    e = evaluate(s, p, 0, None)
    assert e.utilities.slope is None and e.score == 100
    p = p.model_copy(update=dict(weights=Weights(slope=0, power=7, comms=3)))
    # No terrain slope is needed; .7 * 1 + .3 * 0 = .7.
    p = p.model_copy(update=dict(relay_available=False))
    e = evaluate(s, p, 0, None)
    assert e.score == 70 and e.status == "GO"
    p = p.model_copy(update=dict(weights=Weights(slope=0, power=6, comms=4)))
    assert evaluate(s, p, 0, None).status == "CAUTION"


def test_sweep_matches_single():
    rng = np.random.default_rng(17)
    s = series(rng.random(50), rng.uniform(0,2,50), rng.uniform(0,10,50))
    p = profile()
    results = slip_sweep(s, p, 6)
    for i, result in enumerate(results):
        assert result == evaluate(s, p, i, 6)


def test_countdowns():
    s = series([1, .75, .25, 0, 1], [2, 1.5, .5, 0, 2])
    # The .5 and 1 thresholds are crossed halfway between hours 1 and 2.
    c = countdowns(s, profile(), 0)
    assert c.sunset == 1.5 and c.earthset == 1.5
    c = countdowns(s, profile(), 3)
    assert c.sunrise == .5 and c.earthrise == .5
    c = countdowns(s, profile(), 4)
    assert c.sunset is None and c.earthset is None


def test_utilities_and_missing_limits():
    # Half sun on average, one dark hour out of a four-hour allowance: .5 * .75.
    s = series([1, .5, .5, 0], [2, 2, 0, 2], [4, 4, 4, 4])
    e = evaluate(s, profile(), 0, 5)
    assert e.utilities.power == .375
    # Three linked hours and one-hour blackout: .75 * .75.
    assert e.utilities.comms == .5625
    assert not e.vetoes['landing_sun_low'].triggered
    assert not e.vetoes['landing_sun_high'].triggered
    assert e.vetoes['landing_sun_low'].limit is None
    e = evaluate(series([0, 0, 0, 0]), profile(), 0, None)
    assert e.utilities.power == 0
    assert e.status == 'NO-GO'


def test_veto_boundary_and_zero_limit():
    p = profile(max_dark_h=1, max_blackout_h=1)
    s = series([1,0,1,1], [2,0,2,2])
    assert not evaluate(s, p, 0, 10).vetoes['darkness'].triggered
    assert not evaluate(s, p, 0, 10).vetoes['blackout'].triggered
    assert evaluate(s, p, 0, 10.001).vetoes['slope'].triggered
    relay = evaluate(s, profile(relay_available=True, max_blackout_h=0), 0, 5)
    assert relay.metrics.longest_blackout_h == 0 and relay.utilities.comms == 1
    assert not relay.vetoes['blackout'].triggered


@pytest.mark.parametrize("days, expected", [(10, 240), (6.5, 156), (2.5/24, 3), (.5/24, 1)])
def test_window_length_rounds_halves_up(days, expected):
    assert window_length(days) == expected


def test_window_length_rejects_zero():
    with pytest.raises(ValueError):
        window_length(.49 / 24)


def test_separate_flag_columns():
    # Fraction crosses at hour 1, elevation at hour 2, clearance at hour 3.
    s = series([0,1,1,1], [0,0,0,2], [0,0,7,7])
    lit, link = hour_flags(s, profile(ops_sun_el_min_deg=6))
    assert lit.tolist() == [False, False, True, True]
    assert link.tolist() == [False, False, False, True]


def test_high_score_does_not_override_veto():
    # Relay and full sun give 100 points, but an 11 degree slope exceeds 10.
    e = evaluate(series([1]*4), profile(relay_available=True,
        weights=dict(slope=0, power=1, comms=1)), 0, 11)
    assert e.score == 100 and e.vetoes['slope'].triggered and e.status == 'NO-GO'


@pytest.mark.parametrize("ideal", [10, 11])
def test_invalid_slope_profile_even_without_slope(ideal):
    with pytest.raises(ValueError):
        evaluate(series([1]*4), profile(slope_ideal_deg=ideal), 0, None)


def test_elevation_sunset_and_two_condition_sunrise():
    p = profile(ops_sun_el_min_deg=6)
    # The disc remains full; elevation crosses 6 halfway from 8 to 4.
    c = countdowns(series([1,1], [2,2], [8,4]), p, 0)
    assert c.sunset == .5
    # Disc rises through .5 at 1/4 h; elevation reaches 6 at 3/4 h.
    c = countdowns(series([.25,1.25], [2,2], [3,7]), p, 0)
    assert c.sunrise == .75


def test_relay_has_no_earth_events():
    # A clearance crossing at half an hour does not change the relay link.
    s = series([1,1,1], [2,0,2])
    c = countdowns(s, profile(relay_available=True), 0)
    assert c.earthset is None and c.earthrise is None


def test_sunset_uses_earliest_crossing_and_includes_current_hour():
    p = profile(ops_sun_el_min_deg=6)
    # Disc passes until 1/4 h; elevation passes until 3/4 h.
    c = countdowns(series([.75,-.25], [2,2], [9,5]), p, 0)
    assert c.sunset == .25
    # At the threshold now, declining values cross immediately: 0 h.
    c = countdowns(series([.5,0], [1,0]), profile(), 0)
    assert c.sunset == 0 and c.earthset == 0


@pytest.mark.parametrize('fraction', [.7, 7000 * .0001])
def test_a1_every_identical_one_hour_window_is_exactly_seventy_and_go(fraction):
    s = series([fraction] * 16, [1] * 16, [1] * 16)
    p = profile(duration_days=1/24, weights=dict(slope=0, power=1, comms=0))
    sweep = slip_sweep(s, p, None)
    for i in range(16):
        result = evaluate(s, p, i, None)
        assert result.score == 70 and result.status == 'GO'
        assert result == sweep[i] == sweep[0]


@pytest.mark.parametrize('seed', [7, 83, 2026])
def test_translated_windows_have_bit_identical_results(seed):
    rng = np.random.default_rng(seed)
    n = 37
    window = series(rng.integers(0, 10001, n) * .0001,
                    rng.integers(-100, 301, n) * .01,
                    rng.integers(-200, 501, n) * .01)
    p = profile(duration_days=n/24, max_dark_h=17, max_blackout_h=11,
                ops_sun_el_min_deg=1, weights=dict(slope=3, power=7, comms=2))
    expected = evaluate(window, p, 0, 6)
    for offset in (0, 1, 15, 1024, 50000):
        # Long full-Sun prefixes made floating prefix subtraction lose low bits.
        translated = {k: np.concatenate((np.full(offset, 1. if k == 'sun_frac' else 90.), v))
                      for k, v in window.items()}
        result = evaluate(translated, p, offset, 6)
        assert result == expected
        assert result.metrics.sun_fraction_mean.hex() == expected.metrics.sun_fraction_mean.hex()
        assert result.score.hex() == expected.score.hex()
        if offset in (0, 50000):
            assert slip_sweep(translated, p, 6)[offset] == expected


def test_arithmetic_residue_cannot_flip_veto_or_utility_breakpoints():
    s = series([.7, 0], [1, 0], [2, 2])
    p = profile(duration_days=2/24, max_dark_h=1-2e-13, max_blackout_h=1-2e-13,
                landing_sun_el_min_deg=2+2e-13, landing_sun_el_max_deg=2-2e-13)
    boundary = evaluate(s, p, 0, 10+2e-13)
    assert not any(v.triggered for v in boundary.vetoes.values())
    assert boundary.utilities.slope == boundary.utilities.power == boundary.utilities.comms == 0
    assert evaluate(s, p, 0, 10+2e-11).vetoes['slope'].triggered
    ideal = evaluate(series([1, 1]), profile(duration_days=2/24), 0, 5+2e-13)
    assert ideal.utilities.slope == 1
    zero = evaluate(series([.7]), profile(duration_days=1/24, max_dark_h=2e-13), 0, 5)
    assert zero.utilities.power == .7
    flags = hour_flags(series([.5], [1], [2]), profile(min_sun_fraction=.5+2e-13,
                       ops_sun_el_min_deg=2+2e-13, antenna_mask_deg=1+2e-13))
    assert flags[0].tolist() == flags[1].tolist() == [True]
    c = countdowns(series([.5, 0], [1, 0]), profile(min_sun_fraction=.5+2e-13), 0)
    assert c.sunset == c.earthset == 0


def test_exact_seventy_uses_all_three_weights():
    p = profile(duration_days=1/24, relay_available=True, slope_ideal_deg=0,
                weights=dict(slope=1, power=1, comms=1))
    result = evaluate(series([.6]), p, 0, 5)
    assert result.utilities.slope == .5 and result.utilities.power == .6
    assert result.utilities.comms == 1 and result.score == 70 and result.status == 'GO'
