"""Check and download NASA raw files, resuming interrupted downloads."""
import ssl
import time
from dataclasses import dataclass
from pathlib import Path

import httpx
import truststore
from truesouth.paths import raw_dir

POLAR = 'https://pgda.gsfc.nasa.gov/data/LOLA_20mpp/'
CLOSE = 'https://pgda.gsfc.nasa.gov/data/LOLA_5mpp/'
LIGHT = 'https://pgda.gsfc.nasa.gov/data/MoonIllumination/'
SITES = ('Site01', 'Site04', 'Site07', 'Site11', 'Site23', 'Site20v2', 'Site06', 'DM2', 'SL2', 'Haworth')

@dataclass(frozen=True)
class Download:
    group: str
    url: str
    name: str

FILES = [Download('terrain', POLAR+n, n) for n in ('LDEM_80S_80MPP_ADJ.TIF', 'LDEM_60S_240MPP_ADJ.TIF')]
FILES += [Download('slope', POLAR+'LDSM_80S_80MPP_ADJ.TIF', 'LDSM_80S_80MPP_ADJ.TIF')]
for site in SITES:
    for group, suffix in (('closeup', 'surf'), ('slope', 'slp')):
        name = f'{site}_final_adj_5mpp_{suffix}.tif'
        FILES.append(Download(group, CLOSE+site+'/'+name, name))
for res in ('85S_060M', '75S_120M'):
    for suffix in ('', '_EARTH'):
        name = f'AVGVISIB_{res}_201608{suffix}.TIF'
        FILES.append(Download('visibility', LIGHT+name, name))
SVS = 'https://svs.gsfc.nasa.gov/vis/a000000/a004700/a004720/'
# moon_2k.webp is a resize of the 4K map. Nothing in the pipeline reads the 2K TIFF.
for name in ('lroc_color_poles_4k.tif', 'lroc_color_poles_8k.tif', 'ldem_4.tif'):
    FILES.append(Download('texture', SVS + name, name))
FILES.append(Download('texture', 'https://assets.science.nasa.gov/content/dam/science/esd/eo/images/bmng/bmng-topography-bathymetry/march/world.topo.bathy.200403.3x5400x2700.jpg', 'world.topo.bathy.200403.3x5400x2700.jpg'))

def check(client, files):
    sizes, errors = {}, []
    for item in files:
        try:
            response = client.head(item.url)
            response.raise_for_status()
            length = int(response.headers['content-length'])
            if 'text/html' in response.headers.get('content-type', '') or length <= 0:
                raise ValueError('response is not a data file')
            sizes[item.name] = length
            print(f'{item.name}: {length} bytes', flush=True)
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            errors.append(f'{item.name}: {exc}')
            print(f'{item.name}: ERROR {exc}', flush=True)
    if errors:
        raise RuntimeError('Raw file checks failed: ' + '; '.join(errors))
    return sizes

def download(client, item, size, directory):
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    target = directory / item.name
    part = target.with_name(target.name + '.part')
    if target.exists() and target.stat().st_size == size:
        print(f'{item.name}: already complete', flush=True)
        return
    start = part.stat().st_size if part.exists() else 0
    if start > size:
        raise RuntimeError(f'{part}: partial file exceeds expected size')
    if start == size:
        part.replace(target)
        return
    began = time.monotonic()
    with client.stream('GET', item.url, headers={'Range': f'bytes={start}-'} if start else {}) as response:
        response.raise_for_status()
        if start and (response.status_code != 206 or not response.headers.get('content-range', '').startswith(f'bytes {start}-')):
            raise RuntimeError(f'{item.name}: server did not honour resume range')
        # Refuse anything that is not the rest of this file before a byte is written: an error
        # page, or a body whose length is not what remains. A wrong body kept as a .part file
        # would otherwise be extended on the next run and renamed into place once the byte
        # count matched.
        if 'text/html' in response.headers.get('content-type', ''):
            raise RuntimeError(f'{item.name}: server sent a web page, not the file')
        announced = response.headers.get('content-length')
        if announced is not None and int(announced) != size - start:
            raise RuntimeError(f'{item.name}: size mismatch: server offers {announced} bytes, expected {size - start}')
        with part.open('ab' if start else 'wb') as f:
            last = began
            for chunk in response.iter_bytes(1024 * 1024):
                f.write(chunk)
                now = time.monotonic()
                if now-last >= 5:
                    print(f'{item.name}: {f.tell()}/{size} bytes, {(f.tell()-start)/max(now-began, .001):.0f} B/s', flush=True)
                    last = now
    got = part.stat().st_size
    if got > size:
        # More bytes than the file has: the partial file cannot be trusted. Start again next run.
        part.unlink()
        raise RuntimeError(f'{item.name}: size mismatch: got {got}, expected {size}; partial file removed')
    if got < size:
        # The connection ended early. The bytes so far are the file's own; the next run resumes.
        raise RuntimeError(f'{item.name}: size mismatch: got {got} of {size} bytes; run again to resume')
    print(f'{item.name}: complete, {(size-start)/max(time.monotonic()-began, .001):.0f} B/s', flush=True)
    part.replace(target)

def add_arguments(parser):
    parser.add_argument('--group', choices=['terrain', 'closeup', 'slope', 'visibility', 'texture'], action='append', help='select one or more groups (default: all)')
    parser.add_argument('--check-only', action='store_true', help='check URLs and sizes without downloading')

def run(args):
    groups = args.group or ['terrain', 'closeup', 'slope', 'visibility', 'texture']
    files = [f for f in FILES if f.group in groups and f.group != 'closeup']
    try:
        with httpx.Client(verify=truststore.SSLContext(ssl.PROTOCOL_TLS_CLIENT), follow_redirects=True, timeout=httpx.Timeout(60, connect=30)) as client:
            if 'closeup' in groups:
                from truesouth import paths
                from truesouth.closeups import discover, fetch_closeups
                from truesouth.contracts import Sites
                sites = Sites.model_validate_json((paths.derived_dir()/'sites.json').read_bytes()).root
                fetch_closeups(client, discover(client), sites, raw_dir()/'closeups',
                               paths.prepared_dir()/'closeups', check_only=args.check_only)
            sizes = check(client, files)
            if not args.check_only:
                for item in files:
                    download(client, item, sizes[item.name], raw_dir())
    except (RuntimeError, httpx.HTTPError, OSError) as exc:
        raise SystemExit(str(exc)) from exc
