"""Horizons observer tables, with conventions established from each response.

See docs/science.md §3. Requests are serial, TLS-verified, cached unchanged,
and separated by at least two seconds. Parsing never needs the network.
"""
from truesouth.constants import MAX_SITE_LATITUDE_DEG


import csv
from dataclasses import dataclass
from datetime import datetime
import hashlib
import io
import json
import re
import ssl
import time

import httpx
import numpy as np
import truststore

from truesouth.constants import (
    MOON_RADIUS_M, OBSERVER_HEIGHT_M, TIME_GRID_COUNT, TIME_GRID_START_UTC, TIME_GRID_STEP_S,
)
from truesouth.paths import raw_dir

API_URL = 'https://ssd.jpl.nasa.gov/api/horizons.api'


@dataclass(frozen=True)
class ObserverTable:
    times: np.ndarray
    columns: dict[str, np.ndarray]
    frame: str
    longitude_positive: str


def time_grid():
    """The contract's UTC time grid (numpy datetime64 has no timezone metadata)."""
    start = np.datetime64(TIME_GRID_START_UTC.removesuffix('Z'), 's')
    return start + np.arange(TIME_GRID_COUNT) * np.timedelta64(TIME_GRID_STEP_S, 's')


def _request(start, stop):
    return {
        'format': 'json', 'EPHEM_TYPE': "'OBSERVER'", 'MAKE_EPHEM': "'YES'",
        'START_TIME': f"'{start}'", 'STOP_TIME': f"'{stop}'", 'STEP_SIZE': "'1h'",
        'TIME_TYPE': "'UT'", 'ANG_FORMAT': "'DEG'", 'CSV_FORMAT': "'YES'",
        'APPARENT': "'AIRLESS'", 'EXTRA_PREC': "'YES'",
    }


def global_request(start=None, stop=None):
    grid = time_grid()
    params = _request(start or str(grid[0]).replace('T', ' '),
                      stop or str(grid[-1]).replace('T', ' '))
    params.update(COMMAND="'301'", CENTER="'500@399'", QUANTITIES="'14,15,19,20'")
    return params


def site_request(body, lat_deg, lon_deg, *, ground_height_m=0, start=None, stop=None):
    """Use the same reference sphere and observer height as topocentric (§3.3)."""
    target = {'sun': '10', 'earth': '399'}[body]
    if not np.isfinite([lat_deg, lon_deg, ground_height_m]).all() or abs(lat_deg) > MAX_SITE_LATITUDE_DEG:
        raise ValueError('site coordinates must be finite and away from the exact poles')
    params = global_request(start, stop)
    altitude_km = (ground_height_m + OBSERVER_HEIGHT_M) / 1000
    params.update(COMMAND=f"'{target}'", CENTER="'coord@301'", COORD_TYPE="'GEODETIC'",
                  SITE_COORD=f"'{lon_deg % 360:.12g},{lat_deg:.12g},{altitude_km:.12g}'", QUANTITIES="'4'")
    return params


def fetch_response(params, label='observer', *, offline=False):
    """Return unchanged JSON, reusing a cache keyed by every request parameter.

    An interrupted transfer never becomes a cache hit. API refusals are saved too
    (with a separate suffix) so their actual diagnostic remains available.
    """
    key = hashlib.sha256(json.dumps(params, sort_keys=True).encode()).hexdigest()[:20]
    directory = raw_dir() / 'horizons'
    directory.mkdir(parents=True, exist_ok=True)
    path = directory / f'{label}-{key}.json'
    if path.exists():
        return path.read_text(encoding='utf-8')
    if offline:
        raise FileNotFoundError(f'No saved Horizons response: {path}')
    last_error = None
    with httpx.Client(verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT),
                      timeout=180, headers={'User-Agent': 'TrueSouth-science/1.0'}) as client:
        for attempt in range(4):
            time.sleep(2 * 2 ** attempt)
            try:
                response = client.get(API_URL, params=params)
                response.raise_for_status()
                payload = response.json()
                if payload.get('error') or '$$EOE' not in payload.get('result', ''):
                    path.with_suffix('.refused.json').write_text(response.text, encoding='utf-8', newline='\n')
                    raise ValueError(f"Horizons refused request: {payload.get('error', payload.get('result', 'no table'))}")
                temporary = path.with_suffix('.part')
                temporary.write_text(response.text, encoding='utf-8', newline='\n')
                temporary.replace(path)
                return response.text
            except (httpx.HTTPError, ValueError) as exc:
                last_error = exc
    raise RuntimeError(f'Horizons refused or failed after four attempts ({label}): {last_error}') from last_error


def _table(response):
    try:
        payload = json.loads(response)
    except json.JSONDecodeError:
        payload = {'result': response}
    if payload.get('error'):
        raise ValueError(f"Horizons refused request: {payload['error']}")
    text = payload.get('result', '')
    if text.count('$$SOE') != 1 or text.count('$$EOE') != 1:
        raise ValueError('Horizons refused request or returned no observer table')
    header, remainder = text.split('$$SOE')
    body, footer = remainder.split('$$EOE')
    labels = next((line for line in reversed(header.splitlines()) if 'Date__(UT)' in line), None)
    if labels is None:
        raise ValueError('Expected UTC calendar timestamps in Horizons header')
    names = next(csv.reader([labels.strip()]))
    rows = list(csv.reader(io.StringIO(body.strip())))
    try:
        times = np.array([datetime.strptime(row[0].strip(), '%Y-%b-%d %H:%M') for row in rows], dtype='datetime64[s]')
        columns = {name.strip(): np.array([float(row[i]) for row in rows])
                   for i, name in enumerate(names) if i >= 3 and name.strip()}
    except (ValueError, IndexError) as exc:
        raise ValueError(f'Unexpected Horizons observer columns or time: {exc}') from exc
    if not len(times) or np.any(np.diff(times) != np.timedelta64(TIME_GRID_STEP_S, 's')):
        raise ValueError('Horizons time rows must be ordered, unique and hourly')
    if any(not np.isfinite(values).all() for values in columns.values()):
        raise ValueError('Horizons table values must be finite')
    return header, footer, times, columns


def _lunar_frame(header, which):
    match = re.search(rf'^{which} pole/equ\s*:\s*(.*?)\s*\{{(East|West)-longitude positive\}}', header, re.M)
    if not match:
        raise ValueError('Horizons header does not establish lunar frame and longitude sign')
    frame, sign = match.groups()
    if frame.strip() not in ('MOON_ME', 'MEAN_ME (high precision)'):
        raise ValueError(f'Unconfirmed lunar frame: {frame}')
    return frame.strip(), sign.lower()


def _lunar_sphere(header, which):
    radii = re.search(rf'^{which} radii\s*:\s*([\d.]+),\s*([\d.]+),\s*([\d.]+) km', header, re.M)
    if radii is None or any(float(value) != MOON_RADIUS_M / 1000 for value in radii.groups()):
        raise ValueError('Lunar reference sphere must have radius 1737.4 km')


def parse_global(response):
    header, footer, times, raw = _table(response)
    if not re.search(r'Target body name: Moon \(301\)', header) or not re.search(r'Center body name: Earth \(399\)', header):
        raise ValueError('Global table must target Moon from Earth centre')
    if 'Center-site name: GEOCENTRIC' not in header:
        raise ValueError('Global table must use Earth centre')
    frame, sign = _lunar_frame(header, 'Target')
    _lunar_sphere(header, 'Target')
    # Check the actual column definitions as well as the cartographic header.
    definitions = footer.split("'ObsSub-LON, ObsSub-LAT,' =")[-1]
    if len(re.findall(rf'longitude is\s+to the {sign.upper()} for this target', definitions)) != 2:
        raise ValueError('Sub-point column longitude definitions disagree with header')
    conversion = re.search(r'1 au=\s*([\d.]+) km', header)
    if conversion is None or footer.count('Units: AU and KM/S') != 2:
        raise ValueError('Horizons header must establish range units and AU conversion')
    au_km = float(conversion.group(1))
    try:
        columns = {
            'subsolar_lat': raw['SunSub-LAT'], 'subsolar_lon': raw['SunSub-LON'],
            'subearth_lat': raw['ObsSub-LAT'], 'subearth_lon': raw['ObsSub-LON'],
            'earth_dist_km': raw['delta'] * au_km, 'sun_dist_km': raw['r'] * au_km,
        }
    except KeyError as exc:
        raise ValueError(f'Missing global column {exc}') from exc
    for name in ('subsolar_lon', 'subearth_lon'):
        columns[name] = (columns[name] * (1 if sign == 'east' else -1)) % 360
    return ObserverTable(times, columns, frame, sign)


def parse_site(response):
    header, footer, times, raw = _table(response)
    if 'Center body name: Moon (301)' not in header:
        raise ValueError('Site table must be centred on Moon')
    frame, sign = _lunar_frame(header, 'Center')
    _lunar_sphere(header, 'Center')
    if 'Atmos refraction: NO (AIRLESS)' not in header or 'clockwise from north' not in footer:
        raise ValueError('Site table must establish airless, north-through-east azimuth')
    try:
        columns = {'az_deg': raw['Azimuth_(a-app)'], 'el_deg': raw['Elevation_(a-app)']}
    except KeyError as exc:
        raise ValueError(f'Missing airless apparent site column {exc}') from exc
    return ObserverTable(times, columns, frame, sign)
