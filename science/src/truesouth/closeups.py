"""Bounded NASA 5 m ingestion and conservative complete-window coverage.

HTTP uses the pipeline's verified httpx client, never GDAL's TLS client. Rasterio
seeks through a small block cache; no complete range-read TIFF is kept on disk.
Only PreparedMap crops and a resumable provenance index survive ingestion.
"""
from collections import OrderedDict
from contextlib import contextmanager
import io
import json
from pathlib import Path
import re
import shutil
import time

import httpx

import numpy as np
from pyproj import CRS, Transformer

from .constants import CLOSEUP_WINDOW_KM, MOON_RADIUS_M
from .dem import EXPECTED_CRS, PreparedMap
from .frames import destination, polar_stereo_forward, polar_stereo_inverse, local_basis, unit_vector

PRODUCT = 'https://pgda.gsfc.nasa.gov/products/78'
VERSION = 1
BLOCK = 65536


class RangeFile(io.RawIOBase):
    """Seekable verified HTTP ranges, at most 4 MiB cached per open file."""
    def __init__(self, client, url, size, block_size=BLOCK):
        self.client, self.url, self.size = client, url, size
        self.block_size = block_size
        self.position = 0
        self.cache = OrderedDict()
        self.transferred = 0

    def readable(self):
        return True

    def seekable(self):
        return True

    def tell(self):
        return self.position

    def seek(self, offset, whence=0):
        position = offset if whence == 0 else self.position+offset if whence == 1 else self.size+offset
        if position < 0:
            raise ValueError('negative seek')
        self.position = position
        return position

    def read(self, size=-1):
        size = self.size-self.position if size < 0 else min(size, self.size-self.position)
        chunks = []
        while size > 0:
            block = self.position//self.block_size
            start = block*self.block_size
            end = min(start+self.block_size, self.size)-1
            if block not in self.cache:
                # Stream to refuse a server ignoring Range before reading its full body.
                for attempt in range(3):
                    try:
                        with self.client.stream('GET', self.url, headers={'Range':f'bytes={start}-{end}'}) as response:
                            response.raise_for_status()
                            if response.status_code != 206 or response.headers.get('content-range') != f'bytes {start}-{end}/{self.size}':
                                raise RuntimeError(f'{self.url}: server did not honour exact range')
                            data = response.read()
                        break
                    except httpx.TransportError:
                        if attempt == 2:
                            raise
                        print(f'{self.url}: retrying disconnected range {start}-{end}', flush=True)
                        time.sleep(attempt+1)
                if len(data) != end-start+1:
                    raise RuntimeError(f'{self.url}: truncated range')
                self.transferred += len(data)
                self.cache[block] = data
                if len(self.cache)*self.block_size > 4*1024*1024:
                    self.cache.popitem(last=False)
            self.cache.move_to_end(block)
            offset = self.position-start
            chunk = self.cache[block][offset:offset+size]
            chunks.append(chunk)
            size -= len(chunk)
            self.position += len(chunk)
        return b''.join(chunks)

    def readinto(self, buffer):
        data = self.read(len(buffer))
        buffer[:len(data)] = data
        return len(data)


def limits(sizes):
    if any(size > 150_000_000 for size in sizes):
        raise RuntimeError('Close-up download exceeds the 150 MB single-file limit; stop and report.')
    if sum(sizes) > 1_200_000_000:
        raise RuntimeError('Close-up downloads exceed the 1.2 GB total limit; stop and report.')


def discover(client):
    """Use every surface link published on the product page, including new maps."""
    from .commands.fetch_raw import Download
    response = client.get(PRODUCT)
    response.raise_for_status()
    urls = re.findall(r'https://pgda\.gsfc\.nasa\.gov/data/LOLA_5mpp/[^\s<>"\']+_5mpp_surf\.tif', response.text)
    if not urls:
        raise RuntimeError('No surface maps on NASA product 78')
    # Prefer the explicitly newer Site20v2 when it and Site20 both cover a point.
    return [Download('closeup', url, url.rsplit('/', 1)[1])
            for url in sorted(set(urls), key=lambda url: ('Site20v2/' not in url, url))]


def inspect_map(src):
    """Read and validate the actual raster; GDAL resolves PixelIsPoint transforms."""
    if not src.crs or not projection_matches(src.crs):
        raise ValueError(f'unexpected close-up projection: {src.crs}; expected {EXPECTED_CRS}')
    t = src.transform
    if not (t.b == t.d == 0 and np.isclose(t.a, 5) and np.isclose(t.e, -5)):
        raise ValueError(f'unsupported close-up pixel grid: {t}')
    return dict(origin_x=t.c, origin_y=t.f, pixel_x=t.a, pixel_y=t.e,
                projection=src.crs.to_wkt(), shape=[src.height, src.width],
                scale=src.scales[0], offset=src.offsets[0],
                nodata='NaN' if src.nodata is not None and np.isnan(src.nodata) else src.nodata,
                registration=src.tags().get('AREA_OR_POINT', 'Area'),
                block_shape=list(src.block_shapes[0]), tiled=src.profile.get('tiled', False))


def projection_matches(value):
    """Legacy GMT names/axis labels differ; require the same numerical projection.

    Check both radii and the forward transformation across the polar cap. This
    accepts NASA's unnamed spherical datum without accepting a different scale,
    meridian, hemisphere, false origin or reference radius (science.md §2.3).
    """
    crs = CRS.from_user_input(value)
    if not crs.is_projected or not np.isclose(crs.ellipsoid.semi_major_metre, MOON_RADIUS_M, rtol=0, atol=1e-6) or not np.isclose(crs.ellipsoid.semi_minor_metre, MOON_RADIUS_M, rtol=0, atol=1e-6):
        return False
    lat = np.repeat([-89., -85., -80.], 4)
    lon = np.tile([0., 90., 180., 270.], 3)
    x, y = Transformer.from_crs(crs.geodetic_crs, crs, always_xy=True).transform(lon, lat)
    expected_x, expected_y = polar_stereo_forward(lat, lon)
    return bool(np.allclose(x, expected_x, rtol=0, atol=1e-5) and np.allclose(y, expected_y, rtol=0, atol=1e-5))


def envelope(lat, lon, window_km=CLOSEUP_WINDOW_KM):
    """Densified square perimeter in the local frame; projected bounds in metres."""
    half = window_km*500
    axis = np.linspace(-half, half, 129)
    e = np.concatenate([axis, axis, np.full(129, -half), np.full(129, half)])
    n = np.concatenate([np.full(129, -half), np.full(129, half), axis, axis])
    vlat, vlon = destination(lat, lon, np.degrees(np.arctan2(e, n)), np.hypot(e, n))
    x, y = polar_stereo_forward(vlat, vlon)
    return float(x.min()), float(y.min()), float(x.max()), float(y.max())


def _indices(meta, bounds):
    left, bottom, right, top = bounds
    # Include every bilinear neighbour across the entire projected envelope,
    # rather than only the 257 sampled mesh vertices (which could miss holes).
    c0 = int(np.floor((left-meta['origin_x'])/meta['pixel_x']-.5))
    c1 = int(np.ceil((right-meta['origin_x'])/meta['pixel_x']-.5))
    r0 = int(np.floor((top-meta['origin_y'])/meta['pixel_y']-.5))
    r1 = int(np.ceil((bottom-meta['origin_y'])/meta['pixel_y']-.5))
    return r0, r1, c0, c1


def window_covered(terrain, lat, lon, window_km=CLOSEUP_WINDOW_KM):
    r0, r1, c0, c1 = _indices(terrain.meta, envelope(lat, lon, window_km))
    height, width = terrain.data.shape
    return (0 <= r0 <= r1 < height and 0 <= c0 <= c1 < width
            and bool(np.isfinite(terrain.data[r0:r1+1, c0:c1+1]).all()))


def crop_map(src, output, centre, *, source, width_m=4000):
    """Small native-grid crop, decoded scale/offset, nodata/NaN preserved."""
    from rasterio.windows import Window
    x, y = polar_stereo_forward(*centre)
    half = width_m/2
    r0, r1, c0, c1 = _indices(source, (x-half, y-half, x+half, y+half))
    r0, c0 = max(0, r0), max(0, c0)
    r1, c1 = min(src.height-1, r1), min(src.width-1, c1)
    if r1 < r0 or c1 < c0:
        raise ValueError('crop outside map')
    window = Window(c0, r0, c1-c0+1, r1-r0+1)
    values = src.read(1, window=window, masked=True).astype('float32').filled(np.nan)
    values = values*source['scale']+source['offset']
    t = src.window_transform(window)
    meta = {**source, 'origin_x':t.c, 'origin_y':t.f, 'shape':list(values.shape),
            'missing_count':int(np.count_nonzero(~np.isfinite(values))), 'centre':list(centre)}
    output = Path(output)
    output.parent.mkdir(parents=True, exist_ok=True)
    temporary = output.with_suffix('.tmp.npy')
    np.save(temporary, values)
    temporary.replace(output)
    _json(output.with_suffix('.json'), meta)


def _json(path, value):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix('.tmp.json')
    temp.write_text(json.dumps(value, indent=2, allow_nan=False)+'\n', encoding='utf-8')
    temp.replace(path)


def _crop_candidates(src, info, candidates, prepared, index, name):
    for site in candidates:
        if index['sites'].get(site.id, {}).get('covered'):
            continue
        output = prepared/f'{site.id}.npy'
        reused = False
        for key, entry in index['sites'].items():
            if key == site.id or entry.get('file') != name or not entry.get('covered'):
                continue
            existing = prepared/f'{key}.npy'
            if not existing.is_file():
                continue
            terrain = PreparedMap(existing)
            # Nearby variants can share the already fetched native crop, with
            # enough extra margin for the complete ±160 m agreement lag search.
            if window_covered(terrain, site.lat_deg, site.lon_deg, window_km=2.4):
                shutil.copyfile(existing, output)
                _json(output.with_suffix('.json'), {**terrain.meta, 'centre':[site.lat_deg, site.lon_deg]})
                reused = True
                del terrain
                break
            del terrain
        if not reused:
            crop_map(src, output, (site.lat_deg, site.lon_deg), source={**info, 'source':name})
        covered = window_covered(PreparedMap(output), site.lat_deg, site.lon_deg)
        index['sites'][site.id] = dict(file=name, covered=covered,
                                      reason='complete valid window' if covered else 'nodata in window envelope')
        if not covered:
            output.unlink()
            output.with_suffix('.json').unlink()


def _candidates(info, sites):
    result = []
    for site in sites:
        r0, r1, c0, c1 = _indices(info, envelope(site.lat_deg, site.lon_deg))
        if 0 <= r0 <= r1 < info['shape'][0] and 0 <= c0 <= c1 < info['shape'][1]:
            result.append(site)
    return result


@contextmanager
def _raster(client, item, size, raw, *, allow_download=True, block_size=BLOCK):
    """HTTP range first; a whole-file fallback is deleted before returning."""
    import rasterio
    from .commands.fetch_raw import download
    reader = RangeFile(client, item.url, size, block_size)
    try:
        reader.read(1)
    except RuntimeError:
        if not allow_download:
            raise RuntimeError(f'{item.name}: ranges unsupported; cannot inspect without a full download')
        limits([size])
        raw.mkdir(parents=True, exist_ok=True)
        target = raw/item.name
        download(client, item, size, raw)
        try:
            with rasterio.open(target) as src:
                yield src, lambda: size
        finally:
            target.unlink(missing_ok=True)
        return
    def opener(path, mode='r'):
        if str(path) != item.url:
            raise FileNotFoundError(path)
        reader.seek(0)
        return reader
    try:
        with rasterio.open(item.url, opener=opener) as src:
            yield src, lambda: reader.transferred
    finally:
        reader.close()


def fetch_closeups(client, files, sites, raw, prepared, *, check_only=False):
    """HEAD all files first, inspect extents, then fetch just candidate crops.

    Index checkpoints make a completed source resumable without GETs. Changed
    sizes, centres or ingestion version invalidate the checkpoint. The total
    size limit applies to candidate full files even when only ranges are read.
    """
    from .commands.fetch_raw import check
    raw, prepared = Path(raw), Path(prepared)
    index_path = prepared/'index.json'
    centres = {s.id:[s.lat_deg, s.lon_deg] for s in sites}
    previous = json.loads(index_path.read_text()) if index_path.exists() else {}
    index = previous if previous.get('version') == VERSION and previous.get('centres') == centres else dict(version=VERSION, centres=centres, files={}, sites={})
    for key, entry in list(index['sites'].items()):
        if entry.get('covered') and not all((prepared/f'{key}{suffix}').is_file() for suffix in ('.npy', '.json')):
            index['files'].get(entry.get('file'), {})['complete'] = False
            del index['sites'][key]
    sizes = check(client, files)
    if sizes:
        limits([max(sizes.values())])
    infos = {}
    needed = []
    for item in files:
        old = index['files'].get(item.name, {})
        if old.get('size') != sizes[item.name]:
            for key, entry in list(index['sites'].items()):
                if entry.get('file') == item.name:
                    del index['sites'][key]
        complete = old.get('size') == sizes[item.name] and old.get('complete')
        crops_present = all((prepared/f'{key}.npy').is_file() and (prepared/f'{key}.json').is_file()
                            for key, entry in index['sites'].items()
                            if entry.get('file') == item.name and entry.get('covered'))
        if old.get('size') == sizes[item.name] and old.get('projection'):
            infos[item.name] = {**old, 'complete':bool(complete and crops_present)}
        else:
            # A server without ranges is only permitted when the whole possible
            # set passes the budget before *any* full file is downloaded.
            try:
                with _raster(client, item, sizes[item.name], raw, allow_download=False) as (src, count):
                    info = inspect_map(src)
                    info.update(size=sizes[item.name], url=item.url, metadata_bytes=count())
            except RuntimeError as exc:
                if 'ranges unsupported' not in str(exc):
                    raise
                if check_only:
                    raise
                limits(list(sizes.values()))
                with _raster(client, item, sizes[item.name], raw) as (src, count):
                    info = inspect_map(src)
                    info.update(size=sizes[item.name], url=item.url, metadata_bytes=count())
                    _crop_candidates(src, info, _candidates(info, sites), prepared, index, item.name)
                    info.update(complete=True, crop_bytes=0, full_download_bytes=count())
                index['files'][item.name] = info
                _json(index_path, index)
            infos[item.name] = info
        info = infos[item.name]
        candidates = _candidates(info, sites)
        if candidates:
            needed.append((item, candidates))
        print(f"{item.name}: grid {info['shape']}, blocks {info['block_shape']}; candidates {[s.id for s in candidates]}", flush=True)
    limits([sizes[item.name] for item, _ in needed])
    if check_only:
        return infos
    index['files'].update(infos)
    _json(index_path, index)
    for item, candidates in needed:
        info = infos[item.name]
        if info.get('complete'):
            continue
        if all(index['sites'].get(s.id, {}).get('covered') for s in candidates):
            info.update(complete=True, crop_bytes=0)
            continue
        with _raster(client, item, sizes[item.name], raw, block_size=1024*1024) as (src, count):
            _crop_candidates(src, info, candidates, prepared, index, item.name)
            info['crop_bytes'] = count()
        print(f"{item.name}: {info['crop_bytes']} bytes transferred for crops; no full TIFF retained", flush=True)
        info['complete'] = True
        index['files'][item.name] = info
        _json(index_path, index)
    for item in files:
        index['files'][item.name] = {**infos[item.name], 'complete':True}
    for site in sites:
        index['sites'].setdefault(site.id, dict(file=None, covered=False, reason='no map contains the whole window'))
    _json(index_path, index)
    return index


def agreement(terrain, core, lat, lon, ground_m):
    """Uncorrected 5 m vs 80 m heights and horizontal cross-correlation.

    Average source pixels by area onto actual core grid cells. Compare cells
    whose centres lie in the local 2 km window; do not bilinearly upsample the
    80 m map to claim more observations. The lag search samples the area means
    at 10 m offsets in projected X/Y over ±160 m (science.md §13).
    """
    from affine import Affine
    from rasterio.warp import reproject, Resampling
    from scipy.ndimage import map_coordinates
    r0, r1, c0, c1 = _indices(core.meta, envelope(lat, lon))
    r0, c0 = max(0, r0), max(0, c0)
    r1, c1 = min(core.data.shape[0]-1, r1), min(core.data.shape[1]-1, c1)
    rows, cols = np.mgrid[r0:r1+1, c0:c1+1]
    x = core.meta['origin_x']+(cols+.5)*core.meta['pixel_x']
    y = core.meta['origin_y']+(rows+.5)*core.meta['pixel_y']
    vlat, vlon = polar_stereo_inverse(x, y)
    vectors = unit_vector(vlat, vlon)
    east, north, up = local_basis(lat, lon)
    a, b = vectors@east, vectors@north
    angle = np.arctan2(np.hypot(a, b), vectors@up)
    factor = MOON_RADIUS_M*angle/np.maximum(np.hypot(a, b), 1e-30)
    mask = (np.abs(a*factor) <= 1000) & (np.abs(b*factor) <= 1000)
    coarse = np.asarray(core.data[r0:r1+1, c0:c1+1], dtype=float)
    m = terrain.meta
    # Reproject average separately for the zero-lag measurement. For correlation,
    # use 5 m samples of an 80 m box filter, linearly interpolated at trial lags.
    target = np.full(coarse.shape, np.nan, dtype='float64')
    src_t = Affine(m['pixel_x'], 0, m['origin_x'], 0, m['pixel_y'], m['origin_y'])
    dst_t = Affine(core.meta['pixel_x'], 0, core.meta['origin_x']+c0*core.meta['pixel_x'],
                   0, core.meta['pixel_y'], core.meta['origin_y']+r0*core.meta['pixel_y'])
    reproject(np.asarray(terrain.data), target, src_transform=src_t, src_crs=EXPECTED_CRS,
              dst_transform=dst_t, dst_crs=EXPECTED_CRS, src_nodata=np.nan,
              dst_nodata=np.nan, resampling=Resampling.average, num_threads=1)
    valid = mask & np.isfinite(target) & np.isfinite(coarse)
    if np.count_nonzero(valid) < 25:
        raise ValueError('fewer than 25 valid 80 m comparison cells')
    diff = target[valid]-coarse[valid]
    from scipy.ndimage import uniform_filter
    # uniform_filter propagates NaN along rows. Crops may contain holes outside
    # the required window; use a separate weight array to preserve local means.
    data = np.asarray(terrain.data, dtype=float)
    weights = uniform_filter(np.isfinite(data).astype(float), size=16, mode='constant', cval=0)
    sums = uniform_filter(np.nan_to_num(data), size=16, mode='constant', cval=0)
    smoothed = np.where(weights > 1-1e-8, sums, np.nan)
    # For an even 16-pixel box scipy centres it half a source pixel to the
    # negative index direction; add .5 to sample the mean at (x,y).
    rr = (y-m['origin_y'])/m['pixel_y']-.5+.5
    cc = (x-m['origin_x'])/m['pixel_x']-.5+.5
    reference = coarse[valid]-coarse[valid].mean()
    norm = np.linalg.norm(reference)
    best = (-np.inf, 0, 0)
    zero_correlation = None
    if norm > 1e-6:
        for dy in range(-160, 161, 10):
            for dx in range(-160, 161, 10):
                shifted = map_coordinates(smoothed, [rr+dy/m['pixel_y'], cc+dx/m['pixel_x']],
                                          order=1, mode='constant', cval=np.nan)[valid]
                if not np.isfinite(shifted).all():
                    continue
                shifted -= shifted.mean()
                divisor = norm*np.linalg.norm(shifted)
                corr = float(reference@shifted/divisor) if divisor else -np.inf
                if dx == dy == 0:
                    zero_correlation = corr
                if corr > best[0]:
                    best = (corr, dx, dy)
    height = float(terrain.sample(lat, lon))
    result = dict(height_5m_m=height, ground_m=ground_m, centre_difference_m=height-ground_m,
                  mean_m=float(diff.mean()), rms_m=float(np.sqrt(np.mean(diff**2))), cells=int(valid.sum()),
                  offset_x_m=best[1] if np.isfinite(best[0]) else None,
                  offset_y_m=best[2] if np.isfinite(best[0]) else None,
                  correlation=best[0] if np.isfinite(best[0]) else None, zero_correlation=zero_correlation)
    failures = []
    if abs(result['centre_difference_m']) > 10:
        failures.append('centre difference >10 m')
    if abs(result['mean_m']) > 5 or result['rms_m'] > 10:
        failures.append('mean >5 m or RMS >10 m')
    if np.isfinite(best[0]) and np.hypot(best[1], best[2]) > 40:
        failures.append('detected horizontal offset >40 m')
    result.update(accepted=not failures, reason='; '.join(failures) if failures else 'agreement accepted')
    return result


def mesh_for_site(directory, site, core, ground_m):
    """Optional close-up, uniformly registered to unchanged polar-map ground."""
    from .terrain_mesh import closeup_mesh
    path = Path(directory)/f'{site.id}.npy'
    if not path.is_file() or core is None or ground_m is None:
        return None
    terrain = PreparedMap(path)
    if not window_covered(terrain, site.lat_deg, site.lon_deg):
        return None
    measured = agreement(terrain, core, site.lat_deg, site.lon_deg, ground_m)
    report = path.parent/'agreement.json'
    results = json.loads(report.read_text()) if report.exists() else {}
    results[site.id] = measured
    _json(report, results)
    if not measured['accepted']:
        print(f"{site.id}: close-up refused: {measured['reason']}")
        return None
    correction = ground_m-measured['height_5m_m']
    class Registered:
        def sample(self, lat, lon):
            return terrain.sample(lat, lon)+correction
    mesh = closeup_mesh(Registered(), site.lat_deg, site.lon_deg)
    if mesh.missing_count or not all(np.isfinite(a).all() for a in mesh.arrays.values()):
        raise ValueError(f'{site.id}: unexpected missing close-up vertices')
    return mesh
