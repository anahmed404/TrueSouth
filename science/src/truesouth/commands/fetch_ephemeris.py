"""Pull the global ephemeris and optionally run G2 against saved site tables."""

import json
from pathlib import Path
import time

import numpy as np

from truesouth.constants import EARTH_RADIUS_KM, SUN_RADIUS_KM
from truesouth.ephemeris import compare_site, load_global, topocentric, write_global
from truesouth.horizons import (
    fetch_response, global_request, parse_global, parse_site, site_request, time_grid,
)
from truesouth.paths import raw_dir


def add_arguments(parser):
    parser.add_argument('--check-sites', action='store_true', help='Run G2 at all catalog sites (Connecting Ridge first)')
    parser.add_argument('--only', nargs='+', metavar='SITE_ID', help='Check only these sites')
    parser.add_argument('--offline', action='store_true', help='Use saved raw responses; never contact Horizons')
    parser.add_argument('--report', type=Path, help='Write G2 JSON here (default: shared raw/horizons/g2-report.json)')


def _sites():
    # TEMPORARY S1 bridge: exact coordinates from docs/site-catalog.md tables.
    # Remove this list once truesouth.catalog is available on main.
    return [
        ('connecting_ridge', -89.4555, 222.6192),
        ('artemis_haworth', -86.7639, 337.2230),
        ('artemis_malapert', -85.9948, 359.7642),
        ('artemis_mouton', -85.4266, 31.7428),
        ('artemis_nobile_rim_1', -85.4381, 37.3667),
        ('artemis_nobile_rim_2', -83.9540, 58.8221),
        ('artemis_de_gerlache_rim_2', -88.2300, 295.3716),
        ('shackleton_rim', -89.7742, 203.4952),
        ('de_gerlache_rim', -88.6952, 291.7154),
        ('peak_near_shackleton', -88.74, 124.5),
        ('malapert_peak', -85.9756, 357.8876),
        ('chandrayaan3', -69.3741, 32.32),
        ('im1_odysseus', -80.13, 1.44),
        ('im2_athena', -84.7906, 29.1957),
        ('luna25_target', -69.545, 43.544),
        ('apollo11', 0.67416, 23.47314),
        ('apollo17', 20.1911, 30.7723),
        ('blue_ghost1', 18.5623, 61.8103),
        ('change4', -45.4561, 177.5885),
        ('change6', -41.6385, 206.0148),
    ]


def _check_grid(table):
    if not np.array_equal(table.times, time_grid()):
        raise ValueError('Horizons response does not cover the exact contract time grid')


def run(args):
    started = time.monotonic()
    table = parse_global(fetch_response(global_request(), 'global', offline=args.offline))
    _check_grid(table)
    write_global(table.columns)
    print(f'system.bin: {len(table.times)} UTC hours; {table.frame}; {table.longitude_positive}-positive', flush=True)
    if not args.check_sites:
        return 0
    sites = _sites()
    if args.only:
        unknown = set(args.only) - {site[0] for site in sites}
        if unknown:
            raise ValueError(f'Unknown catalog sites: {sorted(unknown)}')
        sites = [site for site in sites if site[0] in args.only]
    columns = load_global()  # G2 includes the shipped Float32 quantisation.
    report_path = args.report or raw_dir() / 'horizons' / 'g2-report.json'
    report = {
        'gate': 'G2', 'tolerance_deg': 0.02, 'count': len(table.times),
        'ground_height_m': 0, 'observer_height_m': 2,
        'catalog_source': 'TEMPORARY docs/site-catalog.md coordinates; S1 not yet on main',
        'comparison': 'science.md §3.3: azimuth separation at reference elevation, absolute elevation, full sky separation',
        'results': [],
    }
    print('site body az_max_deg az_rms_deg az_max_utc el_max_deg el_rms_deg el_max_utc sky_max_deg', flush=True)
    for site_id, lat, lon in sites:
        for body, radius in [('sun', SUN_RADIUS_KM), ('earth', EARTH_RADIUS_KM)]:
            reference = parse_site(fetch_response(site_request(body, lat, lon), f'{site_id}-{body}', offline=args.offline))
            _check_grid(reference)
            prefix = 'subsolar' if body == 'sun' else 'subearth'
            predicted = topocentric(lat, lon, columns[f'{prefix}_lat'], columns[f'{prefix}_lon'],
                                    columns[f'{body}_dist_km'], radius)
            result = {'site': site_id, 'body': body, **compare_site(predicted, reference.columns, table.times)}
            result['passed'] = max(result['az_max_deg'], result['el_max_deg']) <= 0.02
            report['results'].append(result)
            print(f"{site_id} {body} {result['az_max_deg']:.9f} {result['az_rms_deg']:.9f} {result['az_max_utc']} "
                  f"{result['el_max_deg']:.9f} {result['el_rms_deg']:.9f} {result['el_max_utc']} {result['sky_max_deg']:.9f}", flush=True)
            report['elapsed_s'] = time.monotonic() - started
            report['passed'] = all(item['passed'] for item in report['results'])
            report_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = report_path.with_suffix('.part')
            temporary.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
            temporary.replace(report_path)
    print(f"G2 {'PASS' if report['passed'] else 'FAIL'}; {report['elapsed_s']:.1f} s; report: {report_path}", flush=True)
    return 0 if report['passed'] else 1
