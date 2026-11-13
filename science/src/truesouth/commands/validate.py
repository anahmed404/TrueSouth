"""Measure validation evidence from stored data and read-only NASA references."""

from dataclasses import dataclass
from datetime import datetime, timezone
import hashlib
import io
import json
from pathlib import Path
import re
import tempfile

import numpy as np
from pyproj import CRS
import rasterio
from rasterio.windows import Window

from truesouth import paths
from truesouth.constants import EARTH_RADIUS_KM, SUN_RADIUS_KM
from truesouth.contracts import DataSource, DifferenceOverTime, Manifest, SiteMeta, Sites, Validation
from truesouth.dem import DemStore, EXPECTED_CRS
from truesouth.derived_io import read_series, read_system
from truesouth.ephemeris import compare_site, topocentric
from truesouth.frames import polar_stereo_forward, unit_vector
from truesouth.horizons import global_request, parse_global, parse_site, site_request
from truesouth.skyline import compute_skyline
from truesouth.validation import (ILLUMINATION_SOURCE, TERRAIN_SOURCE, compare_sunlight, compare_earth,
                                  compare_slope, compare_convergence, geometry_gates,
                                  measured_gate, unmeasured_gate, gate_checked_elsewhere,
                                  illumination_explanation, slope_explanation, convergence_explanation)

HORIZONS_SOURCE = 'https://ssd.jpl.nasa.gov/horizons/'


def add_arguments(parser):
    parser.add_argument('--generated-utc', help='output timestamp ending in Z; default: current UTC')


@dataclass(frozen=True)
class ReferencePixel:
    value: float
    detail: str
    pixel_m: float
    neighbour_min: float | None
    neighbour_max: float | None


def reference_pixel(path, lat, lon, pixel_m, *, slope=False):
    """Read one local pixel only. Reject unexpected metadata in untrusted TIFs.

    Rasterio's mask is applied before scaling. A half-open pixel footprint,
    rather than bilinear interpolation, answers "at the site's pixel".
    PAM is disabled so GDAL cannot write sidecars to the shared data root.
    """
    if not path.is_file():
        return None
    with rasterio.Env(GDAL_PAM_ENABLED='NO', GDAL_DISABLE_READDIR_ON_OPEN='EMPTY_DIR'):
        with rasterio.open(path, 'r') as ds:
            if not ds.crs or not CRS.from_user_input(ds.crs).equals(EXPECTED_CRS, ignore_axis_order=True):
                raise ValueError(f'{path.name}: unexpected projection')
            t = ds.transform
            if (ds.count != 1 or not np.isfinite(tuple(t)).all() or t.b != 0 or t.d != 0
                    or t.a != pixel_m or t.e != -pixel_m or ds.width <= 0 or ds.height <= 0):
                raise ValueError(f'{path.name}: unexpected raster geometry')
            scale, offset = ds.scales[0], ds.offsets[0]
            if not np.isfinite([scale, offset]).all() or scale <= 0 or ds.nodata is None:
                raise ValueError(f'{path.name}: missing or invalid scale, offset or no-data metadata')
            x, y = polar_stereo_forward(lat, lon)
            row, col = ds.index(float(x), float(y))
            if not (0 <= row < ds.height and 0 <= col < ds.width):
                return None
            r0, c0 = max(row-1, 0), max(col-1, 0)
            r1, c1 = min(row+2, ds.height), min(col+2, ds.width)
            raw = ds.read(1, window=Window(c0, r0, c1-c0, r1-r0), masked=True)
            scaled = np.ma.filled(np.ma.asarray(raw, dtype=float)*scale+offset, np.nan)
            local_r, local_c = row-r0, col-c0
            if not np.isfinite(scaled[local_r, local_c]):
                return None
            value = float(scaled[local_r, local_c])
            if not (0 <= value <= (90 if slope else 1)):
                raise ValueError(f'{path.name}: reference value outside its physical range')
            neighbours = np.array(scaled, copy=True)
            neighbours[local_r, local_c] = np.nan
            finite = neighbours[np.isfinite(neighbours)]
            finite = finite[(0 <= finite) & (finite <= (90 if slope else 1))]
            neighbour_min = float(np.min(finite)) if finite.size else None
            neighbour_max = float(np.max(finite)) if finite.size else None
            detail = f'{path.name}, pixel ({row}, {col}), scale={scale:g}, offset={offset:g}, no-data={ds.nodata:g}'
            if slope:
                unit = ds.units[0] or ds.tags(1).get('UNITTYPE')
                if unit and unit.lower() not in ('degree', 'degrees', 'deg'):
                    raise ValueError(f'{path.name}: unexpected slope unit {unit}')
                tags = {**ds.tags(), **ds.tags(1)}
                baseline = {k: v for k, v in tags.items() if 'baseline' in k.lower()}
                detail += (f'; units={unit}' if unit else '; file has no unit tag; NASA product 90 identifies degrees')
                detail += f'; NASA baseline metadata={baseline}' if baseline else '; NASA baseline not recorded in file metadata'
                detail += '; ours is a 160 m central difference. Pixel size alone does not establish the NASA baseline.'
            return ReferencePixel(value, detail, pixel_m, neighbour_min, neighbour_max)


VISIBILITY_MAPS = (('85S_060M', 60), ('75S_120M', 120))


def visibility_path(raw_dir, body, name):
    suffix = '' if body == 'sun' else '_EARTH'
    return raw_dir/f'AVGVISIB_{name}_201608{suffix}.TIF'


def visibility_reference(raw_dir, body, lat, lon):
    for name, pixel in VISIBILITY_MAPS:
        result = reference_pixel(visibility_path(raw_dir, body, name), lat, lon, pixel)
        if result is not None:
            return result
    return None


def visibility_skip_reason(raw_dir, body, lat, lon):
    """Name every average-visibility map this command actually opened or looked for."""
    present, missing = [], []
    for name, _pixel in VISIBILITY_MAPS:
        path = visibility_path(raw_dir, body, name)
        (present if path.is_file() else missing).append(path.name)
    if not present:
        return 'reference file missing'
    reason = 'reference pixel is no-data or outside '+' and '.join(present)
    if missing:
        reason += '; not on disk: '+' and '.join(missing)
    return reason


def other_visibility(raw_dir, body, lat, lon, pixel_m):
    """The other published resolution at this point, when that map has data there."""
    for name, pixel in VISIBILITY_MAPS:
        if pixel == pixel_m:
            continue
        result = reference_pixel(visibility_path(raw_dir, body, name), lat, lon, pixel)
        if result is not None:
            return result
    return None


def _period(detail):
    detail = detail.strip()
    return detail if detail.endswith('.') else detail+'.'


def slope_reference(raw_dir, lat, lon):
    return reference_pixel(raw_dir/'LDSM_80S_80MPP_ADJ.TIF', lat, lon, 80, slope=True)


def saved_response(directory, parameters, label):
    """Same cache key as Horizons, with no mkdir, writes, fetching or fallback."""
    key = hashlib.sha256(json.dumps(parameters, sort_keys=True).encode()).hexdigest()[:20]
    path = directory/f'{label}-{key}.json'
    return path.read_text(encoding='utf-8') if path.is_file() else None


def parser_gate(response):
    """G1: compare every parsed numeric field with the printed CSV values.

    The independent CSV reader uses numpy rather than the Horizons parser's
    extraction code. Distances use the AU conversion printed in the header.
    """
    if response is None:
        return unmeasured_gate('G1', 'Horizons parser preserves saved values', 0., 'difference',
                               'saved global Horizons response missing')
    table = parse_global(response)
    text = json.loads(response)['result']
    header, body = text.split('$$SOE')
    body = body.split('$$EOE')[0]
    labels = next(line.strip().split(',') for line in reversed(header.splitlines()) if 'Date__(UT)' in line)
    labels = [x.strip() for x in labels]
    au_km = float(re.search(r'1 au=\s*([\d.]+) km', header).group(1))
    errors = []
    for key, column in (('subsolar_lat', 'SunSub-LAT'), ('subsolar_lon', 'SunSub-LON'),
                        ('subearth_lat', 'ObsSub-LAT'), ('subearth_lon', 'ObsSub-LON'),
                        ('earth_dist_km', 'delta'), ('sun_dist_km', 'r')):
        printed = np.loadtxt(io.StringIO(body), delimiter=',', usecols=labels.index(column), ndmin=1)
        if key.endswith('_dist_km'):
            printed *= au_km
        if key.endswith('_lon'):
            printed = printed*(1 if table.longitude_positive == 'east' else -1) % 360
        errors.append(float(np.max(np.abs(table.columns[key]-printed))))
    return measured_gate('G1', 'Horizons parser preserves saved values', max(errors), 0., 'difference',
                         len(table.times)*6, f'Compared six columns with printed CSV values; frame {table.frame}, '
                         f'header and both column definitions confirmed {table.longitude_positive}-positive. '
                         f'Maximum difference {max(errors):.12g}.')


def direction_evidence(site_id, body, predicted, reference, times, step_h=24):
    """G2 summary plus daily maxima of full direction separation on the sky."""
    result = compare_site(predicted, reference, times)
    raw = np.abs((predicted.az_deg-reference['az_deg']+180) % 360-180)
    chord = np.linalg.norm(unit_vector(predicted.el_deg, predicted.az_deg)
                           - unit_vector(reference['el_deg'], reference['az_deg']), axis=-1)
    sky = np.degrees(2*np.arcsin(np.clip(chord/2, 0, 1)))
    i = int(np.argmax(raw))
    result.update(raw_max_deg=float(raw[i]), raw_max_utc=str(times[i])+'Z',
                  raw_above_mark=int(np.count_nonzero(raw > .02)), samples=len(raw))
    daily = np.maximum.reduceat(sky, np.arange(0, len(sky), step_h))
    return result, DifferenceOverTime(site_id=site_id, body=body, start_utc=str(times[0])+'Z',
                                     step_h=step_h, max_difference_deg=daily.tolist())


def directions_gate(sites, system, times, directory):
    reports, charts, missing = [], [], []
    for site in sites:
        for body, radius in (('sun', SUN_RADIUS_KM), ('earth', EARTH_RADIUS_KM)):
            response = saved_response(directory, site_request(body, site.lat_deg, site.lon_deg), f'{site.id}-{body}')
            if response is None:
                missing.append(f'{site.id}/{body}')
                continue
            reference = parse_site(response)
            if not np.array_equal(reference.times, times):
                raise ValueError(f'{site.id}/{body}: Horizons response has a different time grid')
            prefix = 'subsolar' if body == 'sun' else 'subearth'
            predicted = topocentric(site.lat_deg, site.lon_deg, system[prefix+'_lat'], system[prefix+'_lon'],
                                    system[body+'_dist_km'], radius)
            report, chart = direction_evidence(site.id, body, predicted, reference.columns, times)
            report.update(site_id=site.id, body=body)
            reports.append(report)
            charts.append(chart)
            print('G2 '+site.id+' '+body+' '+json.dumps(report, sort_keys=True))
    if not reports:
        return unmeasured_gate('G2', 'Sun and Earth directions match JPL Horizons', .02, 'deg',
                               'saved site responses missing: '+', '.join(missing)), charts
    maximum = max(max(r['az_max_deg'], r['el_max_deg']) for r in reports)
    detail = ['Compared directions from stored Float32 system.bin at ground height 0 plus 2 m '
              '(science section 3.3); each azimuth sky angle and elevation is gated at 0.02 deg.']
    for name in ('az', 'el', 'sky', 'raw'):
        worst = max(reports, key=lambda r: r[name+'_max_deg'])
        samples = sum(r['samples'] for r in reports)
        rms = (float(np.sqrt(sum(r[name+'_rms_deg']**2*r['samples'] for r in reports)/samples))
               if name != 'raw' else None)
        detail.append(f'{name}: max {worst[name+"_max_deg"]:.12g} deg at {worst["site_id"]}/{worst["body"]} '
                      f'{worst[name+"_max_utc"]}'+(f', RMS {rms:.12g} deg.' if rms is not None else '.'))
    detail.append(f'Raw compass azimuth is diagnostic only: {sum(r["raw_above_mark"] for r in reports)} '
                  'site/body hours above 0.02 deg; daily chart uses full sky separation.')
    if missing:
        detail.append('Incomplete coverage; missing responses: '+', '.join(missing)+'.')
    return measured_gate('G2', 'Sun and Earth directions match JPL Horizons', maximum, .02, 'deg',
                         sum(r['samples'] for r in reports), ' '.join(detail),
                         passed=not missing and maximum <= .02), charts


def write_validation(path, report):
    """Validate bytes before atomically replacing the destination."""
    content = (json.dumps(report.model_dump(mode='json'), indent=2, ensure_ascii=False,
                          allow_nan=False)+'\n').encode('utf-8')
    Validation.model_validate_json(content)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.'+path.name, delete=False) as file:
        temporary = Path(file.name)
    try:
        temporary.write_bytes(content)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def run(args):
    output, raw, prepared = paths.derived_dir(), paths.raw_dir(), paths.prepared_dir()
    manifest = Manifest.model_validate_json((output/'manifest.json').read_bytes())
    sites = sorted(Sites.model_validate_json((output/'sites.json').read_bytes()).root, key=lambda s: s.id)
    grid = manifest.time_grid
    if grid.step_s != 3600:
        raise ValueError('validation needs an hourly time grid')
    times = np.datetime64(grid.start_utc.removesuffix('Z'), 's')+np.arange(grid.count)*np.timedelta64(grid.step_s, 's')
    system = read_system(output/'system.bin', grid.count)
    gates = [parser_gate(saved_response(raw/'horizons', global_request(), 'global'))]
    gate, charts = directions_gate(sites, system, times, raw/'horizons')
    gates.append(gate)
    comparisons, not_run = [], []
    covered = {'R1': [], 'R2': []}
    for site in sites:
        if site.terrain_tier == 'sphere':
            for identifier in ('R1', 'R2'):
                not_run.append((identifier, site.id, 'sphere-tier site outside the polar reference maps'))
            continue
        meta = SiteMeta.model_validate_json((output/'sites'/site.id/'meta.json').read_bytes())
        if meta.site_id != site.id:
            raise ValueError(f'{site.id}: metadata belongs to {meta.site_id}')
        series = read_series(output/'sites'/site.id/'series.bin', grid.count)
        for identifier, body, compare in (('R1', 'sun', compare_sunlight), ('R2', 'earth', compare_earth)):
            ref = visibility_reference(raw, body, site.lat_deg, site.lon_deg)
            if ref is None:
                not_run.append((identifier, site.id, visibility_skip_reason(raw, body, site.lat_deg, site.lon_deg)))
            else:
                comparison = compare(site.id, series[body+'_frac'], ref.value)
                if comparison.outside_mark:
                    other = other_visibility(raw, body, site.lat_deg, site.lon_deg, ref.pixel_m)
                    explanation = illumination_explanation(
                        ref.pixel_m, ref.value, ref.neighbour_min, ref.neighbour_max,
                        None if other is None else other.pixel_m, None if other is None else other.value,
                        comparison.ours)
                else:
                    # Keep the pixel's own provenance on an in-mark result.
                    explanation = _period(ref.detail)
                comparisons.append(comparison.model_copy(update={'explanation': explanation}))
                covered[identifier].append(site.id)
        if site.terrain_tier == 'core80':
            ref = slope_reference(raw, site.lat_deg, site.lon_deg)
            if ref is None:
                reason = ('reference file missing' if not (raw/'LDSM_80S_80MPP_ADJ.TIF').is_file()
                          else 'reference pixel is no-data or outside the map')
                not_run.append(('R3', site.id, reason))
            elif site.slope is None:
                not_run.append(('R3', site.id, 'our slope is not assessed'))
            elif site.slope.baseline_m != 160:
                raise ValueError(f'{site.id}: R3 needs the stored 160 m polar-map slope')
            else:
                detail = _period(ref.detail)
                comparison = compare_slope(site.id, site.slope.deg, ref.value, reference_detail=detail)
                if comparison.outside_mark:
                    explanation = slope_explanation(ref.value, ref.neighbour_min, ref.neighbour_max, comparison.ours)
                else:
                    explanation = detail
                comparisons.append(comparison.model_copy(update={'explanation': explanation}))
    chosen = [s for s in sites if s.group == 'sunlit_peak'][:3]
    core, wide = prepared/'LDEM_80S_80MPP_ADJ.npy', prepared/'LDEM_60S_240MPP_ADJ.npy'
    if chosen:
        if not core.is_file() or not wide.is_file():
            # Synthetic trees may have only core terrain; each selected site must be covered.
            print('R5: prepared map coverage will be checked for each selected site.')
        store = DemStore(core if core.is_file() else None, wide if wide.is_file() else None)
        for site in chosen:
            if str(store.tiers(site.lat_deg, site.lon_deg).item()) == 'sphere':
                not_run.append(('R5', site.id, 'prepared terrain missing at site'))
                continue
            print(f'R5 {site.id}: recomputing 1440 bins and 2880 bins with half the step', flush=True)
            coarse = compute_skyline(store, site.lat_deg, site.lon_deg)
            fine = compute_skyline(store, site.lat_deg, site.lon_deg, bins=2880, step_scale=.5)
            comparison = compare_convergence(site.id, coarse.el_deg, fine.el_deg)
            if comparison.outside_mark:
                comparison = comparison.model_copy(update={'explanation': convergence_explanation(
                    coarse.el_deg, fine.el_deg, coarse.dist_km, fine.dist_km, comparison.investigate_above)})
            comparisons.append(comparison)
    if len(chosen) < 3:
        not_run.append(('R5', None, f'only {len(chosen)} sunlit_peak sites available; need three'))
    not_run.extend([('R4', None, 'close-up reference maps are not downloaded'),
                    ('R6', None, 'the sensitivity grid is not built in this version')])
    with tempfile.TemporaryDirectory(prefix='truesouth-validation-') as directory:
        gates.extend(geometry_gates(Path(directory)))
    gates.extend([
        gate_checked_elsewhere(
            'G10', 'TypeScript scoring matches the Python reference', 1e-9, 'difference',
            'Not measured by this command. It is checked by pnpm --dir web test against the shared scoring fixture.'),
        gate_checked_elsewhere(
            'G11', 'Generated TypeScript types are current', 0., 'difference',
            'Not measured by this command. It is checked by pnpm --dir web gen:types followed by a clean diff.'),
    ])
    print('R5 selection: first three sunlit_peak ids in sites.json, sorted by id.')
    for identifier, ids in covered.items():
        print(identifier+' covered sites: '+', '.join(ids))
    print('comparison site ours reference difference outside_mark')
    for c in sorted(comparisons, key=lambda c: (c.id, c.site_id)):
        print(f'{c.id} {c.site_id} {c.ours:.12g} {c.reference:.12g} {c.ours-c.reference:.12g} {c.outside_mark}')
    print('Not run')
    for identifier, site_id, reason in sorted(not_run, key=lambda r: (r[0], r[1] or '')):
        print(f'{identifier}'+(f' {site_id}' if site_id else '')+': '+reason)
    for g in gates:
        passed = 'null' if g.passed is None else str(g.passed)
        measured = 'null' if g.measured is None else f'{g.measured:.12g}'
        print(f'{g.id} passed={passed} measured={measured} {g.unit} samples={g.samples}: {g.detail}')
    sources = [DataSource(name='JPL Horizons', url=HORIZONS_SOURCE, used_for='G1 parser and G2 directions'),
               DataSource(name='LOLA 80 m and 240 m polar terrain', url=TERRAIN_SOURCE,
                          used_for='terrain behind the series and R5 skyline convergence'),
               DataSource(name='LOLA average sunlight and Earth visibility, 60 m and 120 m', url=ILLUMINATION_SOURCE,
                          used_for='R1 and R2 pixel references')]
    if any(c.id == 'R3' for c in comparisons):
        sources.append(DataSource(name='LOLA 80 m slope map', url=TERRAIN_SOURCE, used_for='R3 slope reference'))
    report = Validation(generated_utc=args.generated_utc or datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
                        gates=sorted(gates, key=lambda g: int(g.id[1:])),
                        comparisons=sorted(comparisons, key=lambda c: (c.id, c.site_id)),
                        g2_over_time=charts, sources=sources)
    write_validation(output/'validation.json', report)
    # An actual failed hard gate is a failed run, but still publish its evidence.
    # A gate this command did not measure has passed null, so it is not a failure.
    return int(any(g.passed is False and g.samples > 0 for g in gates))
