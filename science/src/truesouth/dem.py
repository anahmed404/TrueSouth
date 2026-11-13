"""Prepared lunar DEMs and vectorized terrain sampling (science.md ?2.3)."""
import json
from pathlib import Path

import numpy as np
import rasterio
from pyproj import CRS
from rasterio.windows import Window

from .constants import MOON_RADIUS_M
from .frames import polar_stereo_forward

EXPECTED_CRS = CRS.from_proj4(f"+proj=stere +lat_0=-90 +lat_ts=-90 +lon_0=0 +a={MOON_RADIUS_M} +b={MOON_RADIUS_M} +units=m")

def site_tier(latitude):
    """Classify sites by latitude, as specified in docs/site-catalog.md."""
    lat = np.asarray(latitude)
    return np.where(lat <= -80, 'core80', np.where(lat <= -60, 'wide240', 'sphere'))


def prepare_map(source, output):
    """Convert one raster to a memory-mappable float32 array and metadata."""
    source, output = Path(source), Path(output)
    sidecar = output.with_suffix(".json")
    size = source.stat().st_size
    if output.exists() and sidecar.exists():
        try:
            old = json.loads(sidecar.read_text(encoding="utf-8"))
            if old["source_size"] == size and old["source_mtime_ns"] == source.stat().st_mtime_ns:
                return False
        except (ValueError, KeyError, OSError):
            pass
    output.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(source) as src:
        if not src.crs or not CRS.from_user_input(src.crs).equals(EXPECTED_CRS, ignore_axis_order=True):
            raise ValueError(f"unexpected projection in {source}: {src.crs}; expected lunar south polar stereographic")
        t = src.transform
        if t.b != 0 or t.d != 0 or t.a <= 0 or t.e >= 0:
            raise ValueError(f"unsupported raster orientation: {t}")
        temp = output.with_suffix('.tmp.npy')
        arr = np.lib.format.open_memmap(temp, mode='w+', dtype='float32', shape=(src.height, src.width))
        missing = 0
        scale, offset = src.scales[0], src.offsets[0]
        for row in range(0, src.height, 512):
            window = Window(0, row, src.width, min(512, src.height-row))
            data = src.read(1, window=window, masked=True).astype('float32')
            values = data.filled(np.nan) * scale + offset
            missing += int(np.count_nonzero(~np.isfinite(values)))
            arr[row:row+values.shape[0]] = values
        arr.flush()
        del arr
        meta = dict(origin_x=t.c, origin_y=t.f, pixel_x=t.a, pixel_y=t.e,
                    projection=src.crs.to_wkt(), nodata=('NaN' if src.nodata is not None and np.isnan(src.nodata) else src.nodata), shape=[src.height, src.width],
                    source=source.name, source_size=size, source_mtime_ns=source.stat().st_mtime_ns,
                    scale=scale, offset=offset, missing_count=missing)
    temp.replace(output)
    sidecar.write_text(json.dumps(meta, indent=2, allow_nan=False) + "\n", encoding='utf-8', newline='\n')
    return True


class PreparedMap:
    def __init__(self, path):
        self.path = Path(path)
        self.meta = json.loads(self.path.with_suffix('.json').read_text(encoding='utf-8'))
        self.data = np.load(self.path, mmap_mode='r')

    def coordinates(self, lat, lon):
        x, y = polar_stereo_forward(lat, lon)
        m = self.meta
        return (y-m['origin_y'])/m['pixel_y'] - .5, (x-m['origin_x'])/m['pixel_x'] - .5

    def contains(self, lat, lon):
        row, col = self.coordinates(lat, lon)
        return np.isfinite(row) & np.isfinite(col) & (row >= -1e-8) & (col >= -1e-8) & (row <= self.data.shape[0]-1+1e-8) & (col <= self.data.shape[1]-1+1e-8)

    def sample(self, lat, lon):
        row, col = self.coordinates(lat, lon)
        valid = self.contains(lat, lon)
        r = np.clip(np.where(valid, row, 0), 0, self.data.shape[0]-1)
        c = np.clip(np.where(valid, col, 0), 0, self.data.shape[1]-1)
        r = np.where(np.abs(r - np.round(r)) < 1e-8, np.round(r), r)
        c = np.where(np.abs(c - np.round(c)) < 1e-8, np.round(c), c)
        r0, c0 = np.floor(r).astype(int), np.floor(c).astype(int)
        r1, c1 = np.minimum(r0+1, self.data.shape[0]-1), np.minimum(c0+1, self.data.shape[1]-1)
        fr, fc = r-r0, c-c0
        result = np.zeros_like(r, dtype=float)
        for rr, cc, weight in ((r0,c0,(1-fr)*(1-fc)), (r0,c1,(1-fr)*fc), (r1,c0,fr*(1-fc)), (r1,c1,fr*fc)):
            v = self.data[rr,cc]
            result += np.where(weight == 0, 0, v * weight)
        return np.where(valid, result, np.nan)


class DemStore:
    def __init__(self, core=None, wide=None):
        self.core = PreparedMap(core) if core else None
        self.wide = PreparedMap(wide) if wide else None

    def tiers(self, lat, lon):
        lat, lon = np.broadcast_arrays(lat, lon)
        tiers = np.full(lat.shape, 'sphere', dtype='<U7')
        if self.wide: tiers = np.where(self.wide.contains(lat, lon), 'wide240', tiers)
        if self.core: tiers = np.where(self.core.contains(lat, lon), 'core80', tiers)
        return tiers

    def sample(self, lat, lon):
        lat, lon = np.broadcast_arrays(lat, lon)
        tiers = self.tiers(lat, lon)
        heights = np.full(lat.shape, np.nan)
        if self.wide: heights = np.where(tiers == 'wide240', self.wide.sample(lat, lon), heights)
        if self.core: heights = np.where(tiers == 'core80', self.core.sample(lat, lon), heights)
        return heights, int(np.count_nonzero(~np.isfinite(heights)))
