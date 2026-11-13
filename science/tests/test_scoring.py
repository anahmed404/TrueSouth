import numpy as np
import pytest

from truesouth.contracts import MissionProfile, PROFILE_FIELDS, Weights
from truesouth.scoring import hour_flags, evaluate, slip_sweep, countdowns


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
