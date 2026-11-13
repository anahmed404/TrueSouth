"""Disk cache for one sunlit-peak candidate's skyline and series.

The directory name is a content hash of everything that can change a
candidate mean: the prepared maps (array and sidecar), ``system.bin``,
the placement rule's parameters, the contract version, and the bytes of
every module under ``truesouth``. The file name is the site and the 80 m
pixel. A missing file is computed. A file that does not load, or whose
checksum, format, site or pixel disagrees, is computed again and replaced.
Nothing here is written under ``data/derived``.
"""

import hashlib
import os
import tempfile
from dataclasses import dataclass
from pathlib import Path
from typing import get_args

import numpy as np

from truesouth import paths
from truesouth.constants import (DISC_STRIPS, OBSERVER_HEIGHT_M, SKYLINE_BINS, TIME_GRID_COUNT,
                                 TIME_GRID_START_UTC, TIME_GRID_STEP_S)
from truesouth.contracts import Manifest, SeriesLayout, SkylineLayout
from truesouth.placement import RADIUS_M, evaluate_placement
from truesouth.series import Series
from truesouth.skyline import Skyline

FORMAT = 2
SERIES_NAMES = tuple(column.name for column in SeriesLayout().arrays)
SKY_NAMES = tuple(SkylineLayout().arrays)


@dataclass(frozen=True)
class CandidateProduct:
    """One candidate's unquantised series and skyline, kept for the winner."""

    mean: float
    skyline: Skyline
    series: Series


def package_root():
    """The ``truesouth`` package directory, not a single module."""
    import truesouth
    return Path(truesouth.__file__).resolve().parent


def package_sources(root=None):
    """Every ``truesouth`` module, sorted by relative path.

    Deliberately broad. A needless recomputation costs an hour. A stale hit
    costs a wrong published number. Hashing only ``skyline.py``, ``series.py``
    and ``placement.py`` would reuse a mean after the observer height, the
    disc rule, or anything those modules import had changed.
    """
    root = package_root() if root is None else Path(root)
    files = [path for path in root.rglob('*.py') if path.is_file() and '__pycache__' not in path.parts]
    return sorted(files, key=lambda path: path.relative_to(root).as_posix())


def _label(path, root):
    """Stable name. A file outside the package keeps its own name."""
    path = Path(path).resolve()
    try:
        return path.relative_to(Path(root).resolve()).as_posix()
    except ValueError:
        return path.as_posix()


def rule_material():
    """Parameters and the contract version, written into the key explicitly.

    The module bytes already contain these numbers. Repeating them makes a
    version or a rule change visible in the key even when someone compares
    fingerprints by eye.
    """
    version = get_args(Manifest.model_fields['schema_version'].annotation)[0]
    return (f'schema={version};radius_m={RADIUS_M};observer_m={OBSERVER_HEIGHT_M};'
            f'bins={SKYLINE_BINS};disc_strips={DISC_STRIPS};'
            f'start={TIME_GRID_START_UTC};step_s={TIME_GRID_STEP_S};count={TIME_GRID_COUNT}')


def input_files(prepared, system_path, sources=None):
    """Map, ephemeris and source entries, as ``(label, path)``, in fingerprint order."""
    files = []
    for name in ('LDEM_80S_80MPP_ADJ.npy', 'LDEM_60S_240MPP_ADJ.npy'):
        array = Path(prepared) / name
        if not array.is_file():
            continue
        files.append((array.name, array))
        sidecar = array.with_suffix('.json')
        if sidecar.is_file():
            files.append((sidecar.name, sidecar))
    system = Path(system_path)
    files.append((system.name, system))
    root = package_root()
    for path in package_sources() if sources is None else sources:
        files.append((_label(path, root), Path(path)))
    missing = [str(path) for _, path in files if not path.is_file()]
    if missing:
        raise FileNotFoundError('placement cache input missing: ' + ', '.join(missing))
    return files


def _sha256(path):
    digest = hashlib.sha256()
    with Path(path).open('rb') as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b''):
            digest.update(block)
    return digest.hexdigest()


def fingerprint(files):
    """Content hash of ``(label, path)`` entries, plus the rule and contract version.

    Labels are included so two files cannot be swapped. ``files`` may also be
    bare paths; a bare path is labelled with its name.
    """
    digest = hashlib.sha256()
    digest.update(f'placement-cache-v{FORMAT}\0'.encode())
    digest.update(rule_material().encode())
    digest.update(b'\0')
    for item in files:
        if isinstance(item, tuple):
            label, path = item
        else:
            label, path = Path(item).name, item
        digest.update(str(label).encode())
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
        print('placement cache: hashing maps, ephemeris, the rule and every truesouth module', flush=True)
        self.fingerprint = fingerprint(input_files(prepared, system_path))
        self.folder = paths.cache_dir() / 'placement' / self.fingerprint
        print(f'placement cache: {self.folder}', flush=True)
        self.hits = 0
        self.misses = 0

    def evaluate(self, site):
        """Return ``(placement, winner)``. The winner's skyline was not recomputed."""
        products = {}

        def mean_for_point(point):
            product = self._load(site, point)
            if product is None:
                self.misses += 1
                print(f'{site.id}: candidate r{point.row} c{point.col} computing '
                      f'({self.misses} to compute)', flush=True)
                product = self._compute(point)
                self._store(site, point, product)
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

    def _path(self, site, point):
        # Site coordinates live in the entry. The pixel's own lat/lon is not
        # enough: a result computed for another listed point must not be read.
        return self.folder / f'{site.id}_{point.row}_{point.col}.npz'

    def _compute(self, point):
        ground, missing = self.store.sample(point.lat_deg, point.lon_deg)
        if missing or not np.isfinite(ground):
            raise ValueError('candidate ground is missing; cannot place observer')
        skyline = self.compute_skyline(self.store, point.lat_deg, point.lon_deg)
        series = self.build_series(point.lat_deg, point.lon_deg, float(ground), skyline.el_deg,
                                   self.global_data)
        mean = float(np.mean(series.columns['sun_frac']))
        return CandidateProduct(mean, skyline, series)

    def _store(self, site, point, product):
        self.folder.mkdir(parents=True, exist_ok=True)
        arrays = {
            'format': np.int64(FORMAT),
            'site_lat_deg': np.float64(site.lat_deg),
            'site_lon_deg': np.float64(site.lon_deg),
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
            temporary.replace(self._path(site, point))
        finally:
            temporary.unlink(missing_ok=True)

    def _load(self, site, point):
        path = self._path(site, point)
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
            if float(arrays['site_lat_deg']) != site.lat_deg or float(arrays['site_lon_deg']) != site.lon_deg:
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
