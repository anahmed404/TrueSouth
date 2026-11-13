"""Measured validation evidence (docs/validation.md; science.md §§2–8).

Comparisons are pure functions of decoded arrays and reference values. No profile
can change these measurements. An unavailable comparison is omitted by the command.
"""

from decimal import Decimal
import json

import numpy as np

from .contracts import Comparison, Gate

ILLUMINATION_SOURCE = 'https://pgda.gsfc.nasa.gov/products/69'
TERRAIN_SOURCE = 'https://pgda.gsfc.nasa.gov/products/90'
METHOD_DIFFERENCES = (
    'NASA uses an observer on the surface, 18.6 years and its own terrain grid; '
    'ours uses an observer 2 m above ground, six years and the 80 m map '
    '(240 m beyond its coverage). At sharp ridges, nearby pixels can have very '
    'different skylines (decision 0012). These differences do not establish the '
    'cause of this gap; it remains a reported discrepancy, without tuning.'
)


def _comparison(identifier, site_id, ours, reference, unit, source, mark, explanation):
    if not np.isfinite([ours, reference]).all():
        raise ValueError('comparison values must be finite')
    # Decimal text avoids labelling 0.8 - 0.7 > 0.1 because of binary roundoff.
    outside = abs(Decimal(str(float(ours))) - Decimal(str(float(reference)))) > Decimal(str(mark))
    return Comparison(id=identifier, site_id=site_id, ours=float(ours), reference=float(reference),
                      unit=unit, reference_source=source, investigate_above=mark,
                      outside_mark=outside, explanation=explanation if outside else None)


def _fractions(values):
    values = np.asarray(values, dtype=float)
    if values.ndim != 1 or not values.size or not np.isfinite(values).all() or np.any((values < 0) | (values > 1)):
        raise ValueError('fractions must be a nonempty finite vector in [0, 1]')
    return values


def compare_sunlight(site_id, sun_frac, reference):
    """R1: mean visible Sun disc, not the share of lit hours."""
    _fractions([reference])
    return _comparison('R1', site_id, np.mean(_fractions(sun_frac)), reference,
                       'fraction', ILLUMINATION_SOURCE, .1, METHOD_DIFFERENCES)


def compare_earth(site_id, earth_frac, reference):
    """R2: hours with any Earth visible, as NASA defines its map."""
    _fractions([reference])
    return _comparison('R2', site_id, np.mean(_fractions(earth_frac) > 0), reference,
                       'fraction', ILLUMINATION_SOURCE, .1, METHOD_DIFFERENCES)


def compare_slope(site_id, ours, reference, *, reference_detail):
    """R3: degrees from the polar-map method against NASA's slope pixel."""
    return _comparison('R3', site_id, ours, reference, 'deg', TERRAIN_SOURCE, 2.,
                       reference_detail + ' Different sampling and terrain resolution can '
                       'change a slope; this gap is published without adjustment.')


def compare_convergence(site_id, coarse, fine):
    """R5: RMS at shared bin centres; fine uses twice the bins and half the step."""
    coarse, fine = np.asarray(coarse, dtype=float), np.asarray(fine, dtype=float)
    if coarse.ndim != 1 or not coarse.size or fine.shape != (2*coarse.size,):
        raise ValueError('fine skyline must have twice as many bins')
    if not np.isfinite(coarse).all() or not np.isfinite(fine).all():
        raise ValueError('skyline elevations must be finite')
    rms = float(np.sqrt(np.mean((coarse - fine[::2])**2)))
    return _comparison('R5', site_id, rms, 0., 'deg', TERRAIN_SOURCE, .05,
                       'Doubling the bins and halving the ray step changes which terrain '
                       'sets a bin. The RMS at shared azimuths exceeds 0.05 degrees; '
                       'the production skyline has not been tuned to reduce the gap.')


def measured_gate(identifier, name, measured, limit, unit, samples, detail, *, passed=None):
    """Build a gate from measurements; callers may additionally require coverage."""
    return Gate(id=identifier, name=name, measured=measured, limit=limit, unit=unit,
                samples=samples, detail=detail,
                passed=measured <= limit if passed is None else passed)


def unmeasured_gate(identifier, name, limit, unit, reason):
    """The contract has no null measurement; never turn absence into a pass."""
    return measured_gate(identifier, name, 0., limit, unit, 0,
                         'Not measured: '+reason+'; measured=0 is a contract placeholder, not a result.',
                         passed=False)


def prepared_geometry(directory, name, data, site, pixel):
    """Shared synthetic construction used by the gate runner and offline tests.

    Writes only to the caller's temporary directory, never to NASA data folders.
    Pixel centres and metadata are the same public interface as PreparedMap.
    """
    from .frames import polar_stereo_forward
    x, y = polar_stereo_forward(*site)
    path = directory / (name+'.npy')
    np.save(path, np.asarray(data, dtype=np.float32))
    path.with_suffix('.json').write_text(json.dumps(dict(
        origin_x=float(x-data.shape[1]*pixel/2), origin_y=float(y+data.shape[0]*pixel/2),
        pixel_x=pixel, pixel_y=-pixel, source='synthetic geometry'))+'\n', encoding='utf-8', newline='\n')
    return path


def geometry_gates(directory):
    """G3–G9, measured afresh on the same constructions as the geometry tests.

    No saved passing numbers are used. All numeric operations over pixels, bins
    and hours are vectorised; loops enumerate independent geometries only.
    """
    from pyproj import CRS, Transformer
    from .constants import MOON_RADIUS_M as R, OBSERVER_HEIGHT_M as H
    from .dem import DemStore, PreparedMap, EXPECTED_CRS
    from .discs import visible_fraction
    from .frames import (destination, polar_stereo_forward, polar_stereo_inverse,
                         map_scale_factor, local_basis, unit_vector)
    from .skyline import compute_skyline
    from .slope import polar_slope, closeup_slope
    from .series import encode_series, decode_series
    gates = []
    lat, lon = np.meshgrid(np.linspace(-90, -60, 31), np.arange(0, 360, 10))
    geographic = CRS.from_proj4(f'+proj=longlat +R={R} +no_defs')
    forward = Transformer.from_crs(geographic, EXPECTED_CRS, always_xy=True)
    inverse = Transformer.from_crs(EXPECTED_CRS, geographic, always_xy=True)
    x, y = polar_stereo_forward(lat, lon)
    px, py = forward.transform(lon, lat)
    ilat, ilon = polar_stereo_inverse(px, py)
    rlon, rlat = inverse.transform(px, py)
    ax, ay = forward.transform(ilon, ilat)
    rx, ry = forward.transform(rlon, rlat)
    error = float(max(np.max(np.hypot(x-px, y-py)), np.max(np.hypot(ax-rx, ay-ry))))
    gates.append(measured_gate('G3', 'Projection agrees with pyproj', error, .01, 'm', 2*lat.size,
                              f'Forward and inverse positions on a 31 by 36 grid; largest error {error:.12g} m.'))
    site = (-89., 0.)
    flat = DemStore(prepared_geometry(directory, 'flat', np.zeros((151, 151)), site, 80))
    result = compute_skyline(flat, *site)
    expected = -np.degrees(np.arccos(R/(R+H)))
    error = float(np.max(np.abs(result.el_deg-expected)))
    gates.append(measured_gate('G4', 'Flat terrain gives the spherical horizon dip', error, .001, 'deg', 1440,
                              f'Expected {expected:.12g} deg in every bin; maximum error {error:.12g} deg.'))
    def wall(distance, height, pixel, label):
        point = destination(*site, 0., distance)
        peak = np.zeros((3, 3))
        peak[1, 1] = height
        return DemStore(prepared_geometry(directory, label+'_ground', np.zeros((11, 11)), site, 80),
                        prepared_geometry(directory, label+'_peak', peak, point, pixel))
    errors, details = [], []
    for distance, height in ((4000., 100.), (60000., 3000.)):
        actual = compute_skyline(wall(distance, height, 240, str(int(distance))), *site)
        # Independent straight sight-line geometry, science.md §4.
        gamma = distance/R
        expected = float(np.degrees(np.arctan2((R+height)*np.cos(gamma)-(R+H),
                                               (R+height)*np.sin(gamma))))
        errors.append(abs(float(actual.el_deg[0])-expected))
        details.append(f'{distance/1000:g} km wall: expected {expected:.12g}, measured {actual.el_deg[0]:.12g} deg')
    gates.append(measured_gate('G5', 'Near and far walls have the expected elevation', max(errors), .001, 'deg', 2,
                              '; '.join(details)+'.'))
    errors = []
    for pixel in (80, 240):
        distance = pixel/np.tan(np.radians(.25))
        point = destination(*site, 0., distance)
        peak = np.zeros((3, 3))
        peak[1, 1] = 1000
        peak_path = prepared_geometry(directory, f'switch_{pixel}', peak, point, pixel)
        ground = prepared_geometry(directory, f'switch_ground_{pixel}', np.zeros((11, 11)), site,
                                   240 if pixel == 80 else 80)
        store = DemStore(peak_path, ground) if pixel == 80 else DemStore(ground, peak_path)
        near, far = compute_skyline(store, *site), compute_skyline(store, *site, bins=720)
        errors.append(abs(float(near.el_deg[0]-far.el_deg[0])))
    gates.append(measured_gate('G6', 'Near and far methods agree at their switch', max(errors), .02, 'deg', 2,
                              f'80 m switch error {errors[0]:.12g}; 240 m switch error {errors[1]:.12g} deg.'))
    d = np.unique(np.r_[np.linspace(-1, 1, 2001), [-1, -.5, 0, .5, 1]])
    expected = (np.arccos(d)-d*np.sqrt(1-d*d))/np.pi
    errors = []
    for radius in (.262, .271, .90, 1.02):
        for height in (-3., 0., 2.):
            actual = visible_fraction(np.zeros(d.size), height-d*radius, radius, np.full(1440, height))
            errors.append(float(np.max(np.abs(actual-expected))))
    gates.append(measured_gate('G7', 'Disc fractions agree with exact flat-skyline geometry', max(errors), .005,
                              'fraction', 12*d.size, f'Four radii, three skyline heights, {d.size} offsets; '
                              f'maximum fraction error {max(errors):.12g}.'))
    errors = []
    for site in ((-89.9, 222.6192), (-85., 29.1957)):
        for az in (0., 90., 45.):
            for pixel in (80, 240):
                rr, cc = np.indices((11, 11))
                x, y = (cc-5)*pixel, (5-rr)*pixel
                longitude, bearing = np.radians(site[1]), np.radians(az)
                run = ((np.sin(bearing)*np.cos(longitude)+np.cos(bearing)*np.sin(longitude))*x
                       +(-np.sin(bearing)*np.sin(longitude)+np.cos(bearing)*np.cos(longitude))*y)
                z = np.tan(np.radians(10))/map_scale_factor(site[0])*run
                terrain = PreparedMap(prepared_geometry(directory, f'plane_{site[0]}_{az}_{pixel}', z, site, pixel))
                errors.append(abs(polar_slope(terrain, *site).deg-10))
            # The close-up construction uses true local metres and an intercept.
            rr, cc = np.indices((29, 29))
            sx, sy = polar_stereo_forward(*site)
            lat, lon = polar_stereo_inverse(sx+(cc-14)*5, sy+(14-rr)*5)
            east_hat, north_hat, _ = local_basis(*site)
            position = R*unit_vector(lat, lon)
            east, north = position@east_hat, position@north_hat
            z = 1200+np.tan(np.radians(10))*(east*np.sin(np.radians(az))+north*np.cos(np.radians(az)))
            errors.append(abs(closeup_slope(east, north, z).deg-10))
    gates.append(measured_gate('G8', 'Both slope methods recover a ten-degree plane', max(errors), .001, 'deg',
                              len(errors), f'Expected 10 deg on polar 160/480 m and close-up 100 m baselines; '
                              f'maximum error {max(errors):.12g} deg.'))
    # Incommensurate sampling exercises rounding, wrap and the full encoded ranges.
    t = np.linspace(0, 1, 10007)
    columns = {body+suffix: values for body in ('sun', 'earth') for suffix, values in (
        ('_az', t*359.999), ('_el', t*180-90), ('_clear', t*200-100), ('_frac', t))}
    decoded = decode_series(encode_series(columns), len(t))
    angle_error = max(float(np.max(np.abs(decoded[k]-v))) for k, v in columns.items() if not k.endswith('_frac'))
    fraction_error = max(float(np.max(np.abs(decoded[k]-v))) for k, v in columns.items() if k.endswith('_frac'))
    gates.append(measured_gate('G9', 'Series encoding preserves the stated precision', angle_error, .005, 'deg',
                              8*len(t), f'Angle error {angle_error:.12g} deg (limit 0.005); '
                              f'fraction error {fraction_error:.12g} (limit 0.00005).',
                              passed=angle_error <= .005 and fraction_error <= .00005))
    return gates
