"""G7: independent circular-segment geometry, without terrain or network."""

import numpy as np
import pytest

from truesouth.discs import visible_fraction


@pytest.mark.parametrize('radius', [.262, .271, .90, 1.02])
@pytest.mark.parametrize('height', [-3., 0., 2.])
def test_g7_flat_skyline(radius, height):
    d = np.unique(np.r_[np.linspace(-1, 1, 2001), [-1, -.5, 0, .5, 1]])
    expected = (np.arccos(d) - d * np.sqrt(1 - d*d)) / np.pi
    actual = visible_fraction(np.zeros(d.size), height - d*radius, radius,
                              np.full(1440, height))
    error = np.max(np.abs(actual - expected))
    print(f'G7 radius={radius} height={height}: {error:.12g}')
    assert error <= .005


def test_clear_hidden_and_zenith():
    with np.errstate(divide='raise', invalid='raise'):
        actual = visible_fraction([0, 90, 180, 270], [10, -10, 90, -90],
                                  .95, np.full(1440, 2.))
    np.testing.assert_array_equal(actual, [1, 0, 1, 0])


def test_step_under_disc_centre_and_wrap():
    # Boundary halfway between bin centres. H=-2 on the left, +2 on
    # the right, centre H=0. Each paired strip contributes one full chord;
    # the middle strip contributes half a chord: exactly half the disc.
    skyline = np.full(1440, -2.)
    skyline[721:] = 2.
    assert visible_fraction(180.125, 0., .266, skyline) == pytest.approx(.5)
    wrapped = np.roll(skyline, -720)
    assert visible_fraction(.125, 0., .266, wrapped) == pytest.approx(.5)
    az = np.array([359.9, 0., .1])
    np.testing.assert_allclose(visible_fraction(az, .1, .95, wrapped),
                               visible_fraction(az + 180, .1, .95, skyline), atol=1e-12)


def test_azimuth_offsets_expand_with_elevation():
    # Rotate an identical local skyline to the expanded offsets at e=60°.
    # cos(60°)=1/2, so twice the azimuth span gives identical disc geometry.
    az = np.arange(1440) / 4
    low = .4 * (az - 180) + .1
    high = .2 * (az - 180) + 60.1
    assert visible_fraction(180, 60, .95, high) == pytest.approx(
        visible_fraction(180, 0, .95, low), abs=1e-12)
