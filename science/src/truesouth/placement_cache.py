"""Disk cache for one sunlit-peak candidate's skyline and series.

The directory name is a content hash of the inputs that decide the result:
the prepared maps (array and sidecar), ``system.bin``, and the Python
sources of the skyline, series and placement code. The file name is the
80 m pixel. A missing file is computed. A file that does not load, or whose
checksum disagrees, is computed again and replaced. Nothing here is written
under ``data/derived``.
"""

import hashlib
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from truesouth import paths
from truesouth.constants import SKYLINE_BINS, TIME_GRID_COUNT
from truesouth.contracts import SeriesLayout, SkylineLayout
from truesouth.placement import evaluate_placement
from truesouth.series import Series
from truesouth.skyline import Skyline

FORMAT = 1
SERIES_NAMES = tuple(column.name for column in SeriesLayout().arrays)
SKY_NAMES = tuple(SkylineLayout().arrays)


@dataclass(frozen=True)
class CandidateProduct:
    """One candidate's unquantised series and skyline, kept for the winner."""

    mean: float
    skyline: Skyline
    series: Series


def source_paths():
    """The three sources whose text changes a candidate's result."""
    from truesouth import placement, series, skyline
    return [Path(skyline.__file__), Path(series.__file__), Path(placement.__file__)]


def input_files(prepared, system_path):
    """Existing map, ephemeris and source files, in fingerprint order."""
    files = []
    for name in ('LDEM_80S_80MPP_ADJ.npy', 'LDEM_60S_240MPP_ADJ.npy'):
        array = Path(prepared) / name
        if not array.is_file():
            continue
        files.append(array)
        sidecar = array.with_suffix('.json')
        if sidecar.is_file():
            files.append(sidecar)
    files.append(Path(system_path))
    files.extend(source_paths())
    missing = [path for path in files if not path.is_file()]
    if missing:
        raise FileNotFoundError('placement cache input missing: '
                                + ', '.join(str(path) for path in missing))
    return files


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def fingerprint(files):
    """Content hash. Names are included so two files cannot be swapped."""
    digest = hashlib.sha256()
    digest.update(f'placement-cache-v{FORMAT}\0'.encode())
    for path in files:
        digest.update(Path(path).name.encode())
        digest.update(b'\0')
        digest.update(_sha256(path).encode())
        digest.update(b'\0')
    return digest.hexdigest()


def _checksum(arrays):
    digest = hashlib.sha256()
    for name in sorted(arrays):
        values = np.ascontiguousarray(arrays[name])
        digest.update(name.encode())
        digest.update(str(values.dtype).encode())
        digest.update(str(values.shape).encode())
        digest.update(values.tobytes())
    return digest.hexdigest()


class CandidateCache:
    """Compute each pixel once per input fingerprint, and remember the winner."""

    def __init__(self, store, global_data, prepared, system_path, compute_skyline, build_series):
        self.store = store
        self.global_data = global_data
        self.compute_skyline = compute_skyline
        self.build_series = build_series
        print('placement cache: hashing maps, ephemeris and sources', flush=True)
        self.fingerprint = fingerprint(input_files(prepared, system_path))
        self.folder = paths.cache_dir() / 'placement' / self.fingerprint
        print(f'placement cache: {self.folder}', flush=True)
        self.hits = 0
        self.misses = 0

    def evaluate(self, site):
        """Return ``(placement, winner)``. The winner's skyline was not recomputed."""
        products = {}

        def mean_for_point(point):
            product = self._load(point)
            if product is None:
                self.misses += 1
                print(f'{site.id}: candidate r{point.row} c{point.col} computing '
                      f'({self.misses} to compute)', flush=True)
                product = self._compute(point)
                self._store(point, product)
                print(f'{site.id}: candidate r{point.row} c{point.col} mean {product.mean:.6f}', flush=True)
            else:
                self.hits += 1
            products[(point.row, point.col)] = product
            return product.mean

        placement = evaluate_placement(site, self.store, mean_for_point=mean_for_point)
        if placement is None:
            return None, None
        point = placement.best.point
        return placement, products[(point.row, point.col)]

    def _path(self, point):
        return self.folder / f'{point.row}_{point.col}.npz'

    def _compute(self, point):
        ground, missing = self.store.sample(point.lat_deg, point.lon_deg)
        if missing or not np.isfinite(ground):
            raise ValueError('candidate ground is missing; cannot place observer')
        skyline = self.compute_skyline(self.store, point.lat_deg, point.lon_deg)
        series = self.build_series(point.lat_deg, point.lon_deg, float(ground), skyline.el_deg,
                                   self.global_data)
        mean = float(np.mean(series.columns['sun_frac']))
        return CandidateProduct(mean, skyline, series)

    def _store(self, point, product):
        self.folder.mkdir(parents=True, exist_ok=True)
        arrays = {
            'format': np.int64(FORMAT),
            'row': np.int64(point.row),
            'col': np.int64(point.col),
            'lat_deg': np.float64(point.lat_deg),
            'lon_deg': np.float64(point.lon_deg),
            'offset_m': np.float64(point.offset_m),
            'mean': np.float64(product.mean),
            'missing_samples': np.int64(product.skyline.missing_samples),
            'max_range_km': np.float64(product.skyline.max_range_km),
            'sun_radius_deg': np.float64(product.series.sun_radius_deg),
            'earth_radius_deg': np.float64(product.series.earth_radius_deg),
        }
        for name in SKY_NAMES:
            arrays['sky_'+name] = np.ascontiguousarray(getattr(product.skyline, name), dtype=np.float64)
        for name in SERIES_NAMES:
            arrays['series_'+name] = np.ascontiguousarray(product.series.columns[name], dtype=np.float64)
        arrays['checksum'] = np.array(_checksum(arrays))
        fd, name = tempfile.mkstemp(prefix='.placement-', suffix='.npz', dir=self.folder)
        os.close(fd)
        temporary = Path(name)
        try:
            np.savez_compressed(temporary, **arrays)
            temporary.replace(self._path(point))
        finally:
            temporary.unlink(missing_ok=True)

    def _load(self, point):
        path = self._path(point)
        if not path.is_file():
            return None
        try:
            with np.load(path, allow_pickle=False) as data:
                arrays = {key: data[key].copy() for key in data.files}
            checksum = str(arrays.pop('checksum'))
            if checksum != _checksum(arrays):
                return None
            if int(arrays['format']) != FORMAT:
                return None
            if int(arrays['row']) != point.row or int(arrays['col']) != point.col:
                return None
            if float(arrays['lat_deg']) != point.lat_deg or float(arrays['lon_deg']) != point.lon_deg:
                return None
            sky = [np.ascontiguousarray(arrays['sky_'+name], dtype=np.float64) for name in SKY_NAMES]
            if any(values.shape != (SKYLINE_BINS,) for values in sky):
                return None
            columns = {}
            for name in SERIES_NAMES:
                values = np.ascontiguousarray(arrays['series_'+name], dtype=np.float64)
                if values.shape != (TIME_GRID_COUNT,) or not np.isfinite(values).all():
                    return None
                columns[name] = values
            mean = float(arrays['mean'])
            if not np.isfinite(mean) or not 0 <= mean <= 1:
                return None
            skyline = Skyline(*sky, int(arrays['missing_samples']), float(arrays['max_range_km']),
                              np.full(SKYLINE_BINS, 'none', dtype='<U4'))
            series = Series(columns, float(arrays['sun_radius_deg']), float(arrays['earth_radius_deg']))
            return CandidateProduct(mean, skyline, series)
        except Exception:
            return None
