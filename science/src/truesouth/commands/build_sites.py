"""Build catalog skylines, series, slopes and terrain meshes."""

from datetime import datetime, timezone
import json
from pathlib import Path
import shutil
import tempfile
from time import perf_counter

from truesouth import catalog, paths
from truesouth.constants import (MOON_RADIUS_M, OBSERVER_HEIGHT_M, SKYLINE_BINS,
                                 TIME_GRID_COUNT, TIME_GRID_START_UTC, TIME_GRID_STEP_S)
from truesouth.contracts import (Manifest, TimeGrid, Site, Sites, SiteMeta,
                                 SeriesLayout, SeriesMeta, SkylineLayout, MeshMeta)
from truesouth.dem import DemStore, site_tier
from truesouth.derived_io import write_series, write_skyline, read_series, read_skyline, write_terrain, read_terrain
from truesouth.ephemeris import load_global
from truesouth.series import build_series
from truesouth.skyline import compute_skyline
from truesouth.slope import polar_slope
from truesouth.terrain_mesh import terrain_mesh


def add_arguments(parser):
    parser.add_argument('--only', nargs='+', metavar='SITE_ID',
                        help='build only these catalog ids (default: all)')
    parser.add_argument('--force', action='store_true', help='recompute even current sites')
    parser.add_argument('--generated-utc',
                        help='manifest timestamp ending in Z; default: current UTC time. '
                             'This is the only clock time stored in the dataset.')


def _atomic_bytes(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.'+path.name, delete=False) as file:
        temporary = Path(file.name)
        file.write(data)
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def _write_model(path, model):
    data = json.dumps(model.model_dump(mode='json'), indent=2, ensure_ascii=False, allow_nan=False)
    _atomic_bytes(path, (data+'\n').encode('utf-8'))


def _recover_site(target):
    # Windows cannot replace a nonempty directory. The old complete site is
    # renamed to a backup before publishing the staged complete directory.
    # Recover that backup after an interruption between these two renames.
    backup = target.with_name('.'+target.name+'.previous')
    if backup.exists():
        if not target.exists():
            backup.rename(target)
        else:
            shutil.rmtree(backup)
    return backup


def _publish_site(staging, target):
    backup = _recover_site(target)
    if target.exists():
        target.rename(backup)
    try:
        staging.rename(target)
    except BaseException:
        if backup.exists():
            backup.rename(target)
        raise
    if backup.exists():
        shutil.rmtree(backup)


def _current(target, site, previous, newest_input):
    if previous is None or any(getattr(previous, key) != value
                               for key, value in site.model_dump().items()):
        return False
    files = [target/name for name in ('meta.json', 'series.bin', 'skyline.bin')]
    if not all(p.is_file() for p in files):
        return False
    if min(p.stat().st_mtime_ns for p in files) < newest_input:
        return False
    try:
        meta = SiteMeta.model_validate_json(files[0].read_bytes())
        tier = site_tier(site.lat_deg).item()
        terrain = target/'terrain.bin'
        if tier == 'sphere':
            if meta.terrain is not None or terrain.exists():
                return False
        else:
            if meta.terrain is None or not terrain.is_file() or terrain.stat().st_mtime_ns < newest_input:
                return False
            read_terrain(terrain, meta.terrain.size)
        return (meta.site_id == site.id and meta.skyline.bins == SKYLINE_BINS
                and files[1].stat().st_size == TIME_GRID_COUNT*8*2
                and files[2].stat().st_size == SKYLINE_BINS*5*4)
    except ValueError:
        return False


def run(args):
    """Read prepared maps only; publish validated complete site directories.

    Incremental checks conservatively include both prepared map/sidecar pairs,
    system.bin, catalog sites, and Python pipeline sources. A newly available
    map therefore invalidates earlier skylines too. No build-state fields are
    added to the contracts. With --force and a fixed --generated-utc the
    complete output is byte-reproducible. No terrain or network downloads occur.
    """
    all_sites = catalog.load_sites()
    requested = set(args.only or [s.id for s in all_sites])
    unknown = requested - {s.id for s in all_sites}
    if unknown:
        raise ValueError('Unknown catalog site: '+', '.join(sorted(unknown)))
    selected = [s for s in all_sites if s.id in requested]
    # Validate the complete catalog before changing any output.
    catalog.load_profiles()
    catalog.load_features()
    catalog.load_artemis_regions()
    manifest = Manifest(schema_version=1,
        generated_utc=args.generated_utc or datetime.now(timezone.utc).isoformat(timespec='seconds').replace('+00:00', 'Z'),
        time_grid=TimeGrid(start_utc=TIME_GRID_START_UTC, step_s=TIME_GRID_STEP_S, count=TIME_GRID_COUNT),
        observer_height_m=OBSERVER_HEIGHT_M, skyline_bins=SKYLINE_BINS, moon_radius_m=MOON_RADIUS_M)
    output = paths.derived_dir()
    global_data = load_global(output/'system.bin')
    index = output/'sites.json'
    built = {s.id: s for s in Sites.model_validate_json(index.read_bytes()).root} if index.exists() else {}
    core = paths.prepared_dir()/'LDEM_80S_80MPP_ADJ.npy'
    wide = paths.prepared_dir()/'LDEM_60S_240MPP_ADJ.npy'
    terrain_needed = any(site_tier(s.lat_deg).item() != 'sphere' for s in selected)
    store = DemStore(core if core.exists() else None, wide if wide.exists() else None) if terrain_needed else DemStore()
    inputs = [output/'system.bin', paths.catalog_dir()/'sites.json',
              *Path(__file__).resolve().parents[1].rglob('*.py')]
    if terrain_needed:
        inputs += [p for map_path in (core, wide) for p in (map_path, map_path.with_suffix('.json')) if p.exists()]
    newest_input = max(p.stat().st_mtime_ns for p in inputs)
    print('Close-up meshes are not built yet; has_closeup=false and closeup=null.')
    print('Quickmap and Moon Trek links use documented home pages; exact site link formats await MC9.')
    for site in selected:
        started = perf_counter()
        target = output/'sites'/site.id
        target.parent.mkdir(parents=True, exist_ok=True)
        _recover_site(target)
        if not args.force and _current(target, site, built.get(site.id), newest_input):
            print(f'{site.id}: up to date')
            continue
        tier = site_tier(site.lat_deg).item()
        site_store = DemStore() if tier == 'sphere' else store
        ground = None
        slope = None
        mesh = None
        if tier != 'sphere':
            if site_store.tiers(site.lat_deg, site.lon_deg).item() != tier:
                raise ValueError(f'{site.id}: prepared {tier} terrain unavailable at site')
            height, missing = site_store.sample(site.lat_deg, site.lon_deg)
            if missing:
                raise ValueError(f'{site.id}: site ground height is missing')
            ground = float(height)
            slope = polar_slope(site_store.core if tier == 'core80' else site_store.wide,
                                site.lat_deg, site.lon_deg)
            mesh = terrain_mesh(site_store, site.lat_deg, site.lon_deg)
        skyline = compute_skyline(site_store, site.lat_deg, site.lon_deg)
        series = build_series(site.lat_deg, site.lon_deg, ground if ground is not None else 0.,
                              skyline.el_deg, global_data)
        meta = SiteMeta(site_id=site.id, series=SeriesMeta(columns=SeriesLayout().arrays),
                        sun_radius_deg=series.sun_radius_deg, earth_radius_deg=series.earth_radius_deg,
                        skyline=skyline.meta,
                        terrain=MeshMeta(size=mesh.size, window_km=mesh.window_km) if mesh else None,
                        closeup=None)
        derived_site = Site(**site.model_dump(), terrain_tier=tier, has_closeup=False,
                            elevation_m=ground, slope=slope,
                            quickmap_url='https://quickmap.lroc.asu.edu/',
                            moontrek_url='https://trek.nasa.gov/moon/')
        staging = Path(tempfile.mkdtemp(dir=target.parent, prefix='.'+site.id+'.'))
        try:
            _write_model(staging/'meta.json', meta)
            write_series(staging/'series.bin', series.columns)
            write_skyline(staging/'skyline.bin', dict(zip(SkylineLayout().arrays, skyline.arrays)), SKYLINE_BINS)
            if mesh is not None:
                write_terrain(staging/'terrain.bin', mesh.arrays, mesh.size)
            # Validate the serialized artifacts before publishing any of them.
            SiteMeta.model_validate_json((staging/'meta.json').read_bytes())
            read_series(staging/'series.bin', TIME_GRID_COUNT)
            read_skyline(staging/'skyline.bin', SKYLINE_BINS)
            if mesh is not None:
                read_terrain(staging/'terrain.bin', mesh.size)
            _publish_site(staging, target)
        finally:
            if staging.exists():
                shutil.rmtree(staging)
        built[site.id] = derived_site
        _write_model(index, Sites(root=[built[key] for key in sorted(built)]))
        print(f'{site.id}: built in {perf_counter()-started:.6f} s; tier={tier}; ground_m={ground}')
    for name in ('profiles.json', 'features.json', 'artemis_regions.json'):
        _atomic_bytes(output/name, (paths.catalog_dir()/name).read_bytes())
    _write_model(output/'manifest.json', manifest)
