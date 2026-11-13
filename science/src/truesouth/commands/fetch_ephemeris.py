"""Pull the global ephemeris and optionally run G2 against saved site tables."""

import json
from pathlib import Path
import time

import numpy as np

from truesouth.catalog import load_sites
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
    sites = [(site.id, site.lat_deg, site.lon_deg) for site in sorted(
        load_sites(), key=lambda site: site.id != 'connecting_ridge')]
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
        'catalog_source': 'truesouth.catalog.load_sites',
        'comparison': 'science.md §3.3: azimuth separation at reference elevation, absolute elevation, full sky separation',
        'expected_comparisons': 2 * len(sites), 'complete': False, 'passed': False,
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
            report['complete'] = len(report['results']) == report['expected_comparisons']
            report['passed'] = report['complete'] and all(item['passed'] for item in report['results'])
            report_path.parent.mkdir(parents=True, exist_ok=True)
            temporary = report_path.with_suffix('.part')
            temporary.write_text(json.dumps(report, indent=2) + '\n', encoding='utf-8', newline='\n')
            temporary.replace(report_path)
    print(f"G2 {'PASS' if report['passed'] else 'FAIL'}; {report['elapsed_s']:.1f} s; report: {report_path}", flush=True)
    return 0 if report['passed'] else 1
