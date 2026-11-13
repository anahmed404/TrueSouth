"""Build the polar map images and lookup grids."""
import json
import os
import tempfile
from pathlib import Path

import numpy as np
import rasterio
from PIL import Image
from pyproj import CRS

from truesouth import maps
from truesouth.contracts import MapMeta
from truesouth.dem import EXPECTED_CRS, PreparedMap
from truesouth.derived_io import write_map_lookup
from truesouth.paths import derived_dir, prepared_dir, raw_dir

HALF_WIDTH = 304000


def add_arguments(parser):
    pass


def read_visibility(path):
    with rasterio.open(path) as src:
        if not src.crs or not CRS.from_user_input(src.crs).equals(EXPECTED_CRS, ignore_axis_order=True):
            raise ValueError(f'unexpected projection in {path}')
        t = src.transform
        if t.b != 0 or t.d != 0 or t.a <= 0 or t.e >= 0:
            raise ValueError(f'unsupported raster orientation in {path}')
        raw = src.read(1, masked=True)
        a = raw.astype('float32').filled(np.nan)
        a = a * src.scales[0] + src.offsets[0]
        if np.any((a[np.isfinite(a)] < 0) | (a[np.isfinite(a)] > 1.000001)):
            raise ValueError(f'visibility outside [0, 1] in {path}')
        return np.minimum(a, 1), tuple(t)


def image(path, pixels, alpha=None):
    if alpha is None:
        im = Image.fromarray(pixels, mode='L')
    else:
        im = Image.fromarray(np.dstack((pixels, pixels, pixels, alpha)), mode='RGBA')
    im.save(path, format='WEBP', quality=80, method=4, exact=True)


def make_hillshade(dem, size, path, half_width):
    m = dem.meta
    transform = (m['pixel_x'], 0, m['origin_x'], 0, m['pixel_y'], m['origin_y'])
    result = np.zeros((size, size), dtype=np.uint8)
    pixel = 2 * half_width / size
    for start in range(0, size, 256):
        stop = min(size, start + 256)
        lo, hi = max(0, start-1), min(size, stop+1)
        z = maps.sample_grid(dem.data, transform, size, half_width, lo, hi)
        shade = maps.hillshade(z, pixel)[start-lo:stop-lo]
        result[start:stop] = np.nan_to_num(shade * 255, nan=0).astype(np.uint8)
    image(path, result)


def core_mask(core, core_t, wide_t):
    def mask(start, stop, width):
        x = wide_t[2] + (np.arange(width) + .5) * wide_t[0]
        y = wide_t[5] + (np.arange(start, stop) + .5) * wide_t[4]
        c = np.floor((x - core_t[2]) / core_t[0]).astype(int)
        r = np.floor((y - core_t[5]) / core_t[4]).astype(int)
        inside = (r[:, None] >= 0) & (r[:, None] < core.shape[0]) & (c[None, :] >= 0) & (c[None, :] < core.shape[1])
        return inside & np.isfinite(core[np.clip(r, 0, core.shape[0]-1)[:, None], np.clip(c, 0, core.shape[1]-1)[None, :]])
    return mask


def make_visibility(core, ct, wide, wt, name, folder, image_size, lookup_size, half_width):
    sums = np.zeros(lookup_size**2, dtype=np.float64)
    counts = np.zeros(lookup_size**2, dtype=np.uint32)
    maps.accumulate_lookup(core, ct, lookup_size, half_width, sums, counts)
    if wide is not None:
        maps.accumulate_lookup(wide, wt, lookup_size, half_width, sums, counts, core_mask(core, ct, wt))
    values = maps.lookup_mean(sums, counts, lookup_size)
    write_map_lookup(folder / f'{name}_u8.bin', maps.encode_lookup(values), lookup_size)
    pixels = np.zeros((image_size, image_size), dtype=np.uint8)
    alpha = np.zeros_like(pixels)
    for start in range(0, image_size, 256):
        stop = min(image_size, start + 256)
        a = maps.sample_grid(core, ct, image_size, half_width, start, stop)
        if wide is not None:
            b = maps.sample_grid(wide, wt, image_size, half_width, start, stop)
            a = np.where(np.isfinite(a), a, b)
        valid = np.isfinite(a)
        pixels[start:stop] = np.where(valid, np.nan_to_num(a) * 255, 0).astype(np.uint8)
        alpha[start:stop] = valid.astype(np.uint8) * 255
    image(folder / f'{name}_4k.webp', pixels, alpha)


def build(folder, image_size=4096, hill_size=8192, lookup_size=2048, half_width=HALF_WIDTH):
    dem = PreparedMap(prepared_dir() / 'LDEM_80S_80MPP_ADJ.npy')
    make_hillshade(dem, image_size, folder / 'hillshade_4k.webp', half_width)
    make_hillshade(dem, hill_size, folder / 'hillshade_8k.webp', half_width)
    layers = {'hillshade': {'files': ['hillshade_4k.webp', 'hillshade_8k.webp']}}
    for name, suffix in [('sunlight', ''), ('earthvis', '_EARTH')]:
        core, ct = read_visibility(raw_dir() / f'AVGVISIB_85S_060M_201608{suffix}.TIF')
        wide_path = raw_dir() / f'AVGVISIB_75S_120M_201608{suffix}.TIF'
        wide, wt = read_visibility(wide_path) if wide_path.is_file() else (None, None)
        make_visibility(core, ct, wide, wt, name, folder, image_size, lookup_size, half_width)
        layers[name] = {'files': [f'{name}_4k.webp'], 'lookup': f'{name}_u8.bin', 'lookup_size': lookup_size}
    meta = MapMeta(projection='south_polar_stereographic', half_width_m=half_width, layers=layers)
    (folder / 'meta.json').write_text(json.dumps(meta.model_dump(exclude_none=True), indent=2) + '\n', encoding='utf-8', newline='\n')


def run(args):
    parent = derived_dir()
    parent.mkdir(parents=True, exist_ok=True)
    target = parent / 'maps'
    with tempfile.TemporaryDirectory(prefix='.maps-', dir=parent) as temp:
        temp = Path(temp)
        output = temp / 'output'
        output.mkdir()
        build(output)
        backup = temp / 'old'
        if target.exists():
            os.replace(target, backup)
        try:
            os.replace(output, target)
        except BaseException:
            if backup.exists():
                os.replace(backup, target)
            raise
