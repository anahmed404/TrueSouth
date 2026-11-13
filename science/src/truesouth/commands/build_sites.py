"""Build catalog skylines, series, slopes and terrain meshes.

A catalog site in the group ``sunlit_peak`` whose tier is ``core80`` also gets
the nearby range from placement.py, and a second site ``<id>_best_lit``.
``--only connecting_ridge`` builds that variant too. ``--only
connecting_ridge_best_lit`` is the same request: the variant is not a catalog
id, so the id selects its catalog parent and both records are published.
Any other ``<id>_best_lit`` whose parent is not a core80 sunlit peak is rejected
before a file is written. A site that leaves the group loses the variant record
and its folder. Candidate skylines are cached under the data-root cache
directory and the winning candidate is the variant's skyline and series.
"""

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

QUICKMAP_URL = 'https://quickmap.lroc.asu.edu/'
MOONTREK_URL = 'https://trek.nasa.gov/moon/'


def add_arguments(parser):
    parser.add_argument('--only', nargs='+', metavar='SITE_ID',
                        help='catalog ids to build (default: all). '
                             'An <id>_best_lit id selects that catalog site and refreshes its variant')
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


def _write_index(index, built):
    _write_model(index, Sites(root=[built[key] for key in sorted(built)]))


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


def _qualifies(site):
    return site.group == 'sunlit_peak' and site_tier(site.lat_deg).item() == 'core80'


def _variant_id(site):
    return f'{site.id}_best_lit'


def _catalog_match(site, previous):
    if previous is None:
        return False
    return all(getattr(previous, key) == value for key, value in site.model_dump().items())


def _files_current(target, site, newest_input):
    if site is None or not target.exists():
        return False
    files = [target/name for name in ('meta.json', 'series.bin', 'skyline.bin')]
    if not all(path.is_file() for path in files):
        return False
    if min(path.stat().st_mtime_ns for path in files) < newest_input:
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
    except (OSError, ValueError):
        return False


def _placement_settled(site, previous, built, output, newest_input):
    """True when the nearby range and the variant folder agree with this site."""
    variant_id = _variant_id(site)
    variant = built.get(variant_id)
    folder = output/'sites'/variant_id
    if _qualifies(site):
        if previous is None or previous.nearby_sun is None:
            return False
        if previous.variant_of is not None or previous.offset_m is not None:
            return False
        if variant is None or variant.variant_of != site.id or variant.nearby_sun != previous.nearby_sun:
            return False
        return _files_current(folder, variant, newest_input)
    if previous is not None and (previous.nearby_sun is not None or previous.variant_of is not None
                                 or previous.offset_m is not None):
        return False
    backup = folder.with_name('.'+variant_id+'.previous')
    return variant is None and not folder.exists() and not backup.exists()


def _select(all_sites, only):
    """Catalog sites for this run, in catalog order.

    ``--only <id>_best_lit`` selects ``<id>`` when that catalog site is a core80
    sunlit peak, and then the run publishes both records. It does not build a
    variant on its own.
    """
    by_id = {site.id: site for site in all_sites}
    if not only:
        return list(all_sites)
    wanted = []
    unknown = []
    for raw in only:
        if raw in by_id:
            wanted.append(raw)
        elif raw.endswith('_best_lit') and raw.removesuffix('_best_lit') in by_id:
            parent = by_id[raw.removesuffix('_best_lit')]
            if not _qualifies(parent):
                raise ValueError(f'{raw}: best-lit variants are produced for core80 '
                                 f'sunlit_peak sites; {parent.id} is not one')
            wanted.append(parent.id)
        else:
            unknown.append(raw)
    if unknown:
        raise ValueError('Unknown catalog site: '+', '.join(sorted(unknown)))
    chosen = set(wanted)
    return [site for site in all_sites if site.id in chosen]


def _derive(site_id, lat, lon, store, global_data, skyline=None, series=None, *, tier=None):
    """Terrain, slope and, unless they were supplied, skyline and series."""
    custom_tier = tier is not None
    tier = site_tier(lat).item() if tier is None else tier
    site_store = DemStore() if tier == 'sphere' else store
    ground = None
    slope = None
    mesh = None
    if tier != 'sphere':
        selected_map = site_store.core if tier == 'core80' else site_store.wide
        covered = (selected_map is not None and selected_map.contains(lat, lon)) if custom_tier else site_store.tiers(lat, lon).item() == tier
        if not covered:
            raise ValueError(f'{site_id}: prepared {tier} terrain unavailable at site')
        height, missing = site_store.sample(lat, lon)
        if missing:
            raise ValueError(f'{site_id}: site ground height is missing')
        ground = float(height)
        slope = polar_slope(site_store.core if tier == 'core80' else site_store.wide, lat, lon)
        mesh = terrain_mesh(site_store, lat, lon)
    if skyline is None:
        skyline = compute_skyline(site_store, lat, lon)
    if series is None:
        series = build_series(lat, lon, ground if ground is not None else 0., skyline.el_deg, global_data)
    meta = SiteMeta(site_id=site_id, series=SeriesMeta(columns=SeriesLayout().arrays),
                    sun_radius_deg=series.sun_radius_deg, earth_radius_deg=series.earth_radius_deg,
                    skyline=skyline.meta,
                    terrain=MeshMeta(size=mesh.size, window_km=mesh.window_km) if mesh else None,
                    closeup=None)
    return tier, ground, slope, mesh, skyline, series, meta


def _stage_site(target, meta, series, skyline, mesh, *, site=None, publish=None, cancelled=None):
    if cancelled and cancelled():
        raise InterruptedError('site build interrupted')
    target.parent.mkdir(parents=True, exist_ok=True)
    staging = Path(tempfile.mkdtemp(dir=target.parent, prefix='.'+target.name+'.'))
    try:
        _write_model(staging/'meta.json', meta)
        write_series(staging/'series.bin', series.columns)
        write_skyline(staging/'skyline.bin', dict(zip(SkylineLayout().arrays, skyline.arrays, strict=True)),
                      SKYLINE_BINS)
        if mesh is not None:
            write_terrain(staging/'terrain.bin', mesh.arrays, mesh.size)
        # Validate the serialized artifacts before publishing any of them.
        SiteMeta.model_validate_json((staging/'meta.json').read_bytes())
        read_series(staging/'series.bin', TIME_GRID_COUNT)
        read_skyline(staging/'skyline.bin', SKYLINE_BINS)
        if mesh is not None:
            read_terrain(staging/'terrain.bin', mesh.size)
        if site is not None:
            _write_model(staging/'site.json', site)
        if cancelled and cancelled():
            raise InterruptedError('site build interrupted')
        (publish or _publish_site)(staging, target)
    finally:
        if staging.exists():
            shutil.rmtree(staging)


def _clear_placement(built, site_id):
    previous = built.get(site_id)
    if previous is None:
        return False
    if previous.nearby_sun is None and previous.variant_of is None and previous.offset_m is None:
        return False
    built[site_id] = previous.model_copy(update={'nearby_sun': None, 'variant_of': None, 'offset_m': None})
    return True


def _drop_variant(built, output, parent_id):
    variant_id = f'{parent_id}_best_lit'
    folder = output/'sites'/variant_id
    backup = folder.with_name('.'+variant_id+'.previous')
    removed = False
    if folder.exists():
        shutil.rmtree(folder)
        removed = True
    if backup.exists():
        shutil.rmtree(backup)
        removed = True
    if built.pop(variant_id, None) is not None:
        removed = True
    return removed


def _record(site, tier, ground, slope, nearby):
    return Site(**site.model_dump(), terrain_tier=tier, has_closeup=False, elevation_m=ground, slope=slope,
                quickmap_url=QUICKMAP_URL, moontrek_url=MOONTREK_URL, nearby_sun=nearby)


def build_site(site, store, global_data, target, *, tier=None, site_entry=False,
               publish=None, cancelled=None, parts=None, nearby=None):
    """Shared one-site derivation, record and atomic publication.

    The catalog may supply parts derived before placement was evaluated, so its
    listed point is computed only once. Custom callers supply neither parts nor
    nearby: they never evaluate placement, write the catalog index or build a variant.
    """
    if cancelled and cancelled():
        raise InterruptedError('site build interrupted')
    if parts is None:
        parts = _derive(site.id, site.lat_deg, site.lon_deg, store, global_data, tier=tier)
    tier, ground, slope, mesh, skyline, series, meta = parts
    derived = _record(site, tier, ground, slope, nearby)
    _stage_site(Path(target), meta, series, skyline, mesh,
                site=derived if site_entry else None, publish=publish, cancelled=cancelled)
    return derived


def run(args):
    """Read prepared maps only; publish validated complete site directories.

    Incremental checks conservatively include both prepared map/sidecar pairs,
    system.bin, catalog sites, and Python pipeline sources. A newly available
    map therefore invalidates earlier skylines too. No build-state fields are
    added to the contracts. With --force and a fixed --generated-utc the
    complete output is byte-reproducible. No terrain or network downloads occur.
    A best-lit variant is up to date when its catalog site's inputs are and its
    own folder still matches those inputs. Removing the site from sunlit_peak,
    or from the core80 tier, deletes the variant.
    """
    from truesouth.placement import build_variant
    from truesouth.placement_cache import CandidateCache

    all_sites = catalog.load_sites()
    selected = _select(all_sites, args.only)
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
    built = {site.id: site for site in Sites.model_validate_json(index.read_bytes()).root} if index.exists() else {}
    core = paths.prepared_dir()/'LDEM_80S_80MPP_ADJ.npy'
    wide = paths.prepared_dir()/'LDEM_60S_240MPP_ADJ.npy'
    terrain_needed = any(site_tier(site.lat_deg).item() != 'sphere' for site in selected)
    store = DemStore(core if core.exists() else None, wide if wide.exists() else None) if terrain_needed else DemStore()
    inputs = [output/'system.bin', paths.catalog_dir()/'sites.json',
              *Path(__file__).resolve().parents[1].rglob('*.py')]
    if terrain_needed:
        inputs += [path for map_path in (core, wide) for path in (map_path, map_path.with_suffix('.json')) if path.exists()]
    newest_input = max(path.stat().st_mtime_ns for path in inputs)
    cache = None
    if core.is_file() and any(_qualifies(site) for site in selected):
        cache = CandidateCache(store, global_data, paths.prepared_dir(), output/'system.bin',
                               compute_skyline, build_series)
    print('Close-up meshes are not built yet; has_closeup=false and closeup=null.')
    print('Quickmap and Moon Trek links use documented home pages; exact site link formats await MC9.')
    for site in selected:
        started = perf_counter()
        target = output/'sites'/site.id
        target.parent.mkdir(parents=True, exist_ok=True)
        _recover_site(target)
        _recover_site(output/'sites'/_variant_id(site))
        previous = built.get(site.id)
        files_ok = _catalog_match(site, previous) and _files_current(target, previous, newest_input)
        if not args.force and files_ok and _placement_settled(site, previous, built, output, newest_input):
            print(f'{site.id}: up to date')
            continue
        parts = None
        if args.force or not files_ok:
            parts = _derive(site.id, site.lat_deg, site.lon_deg, store, global_data)
        placement = winner = None
        if _qualifies(site):
            if cache is None:
                raise ValueError(f'{site.id}: prepared core80 terrain unavailable at site')
            placement, winner = cache.evaluate(site)
            print(f'{site.id}: placement {placement.nearby_sun.points} points, '
                  f'{cache.misses} computed, {cache.hits} from cache')
            cache.hits = cache.misses = 0
        nearby = None if placement is None else placement.nearby_sun
        if parts is not None:
            tier, ground, slope, mesh, skyline, series, meta = parts
            derived = build_site(site, store, global_data, target, parts=parts, nearby=nearby)
            built[site.id] = derived
            _write_index(index, built)
            print(f'{site.id}: built in {perf_counter()-started:.6f} s; tier={tier}; ground_m={ground}')
        elif nearby is not None and (previous.nearby_sun != nearby or previous.variant_of is not None
                                     or previous.offset_m is not None):
            built[site.id] = previous.model_copy(update={'nearby_sun': nearby, 'variant_of': None, 'offset_m': None})
            _write_index(index, built)
        if placement is not None:
            variant_started = perf_counter()
            fields = build_variant(site, placement)
            variant_target = output/'sites'/fields['id']
            current = built.get(fields['id'])
            same_point = (current is not None and current.lat_deg == fields['lat_deg']
                          and current.lon_deg == fields['lon_deg'] and current.offset_m == fields['offset_m']
                          and current.nearby_sun == nearby and current.variant_of == site.id)
            if args.force or not same_point or not _files_current(variant_target, current, newest_input):
                tier, ground, slope, mesh, skyline, series, meta = _derive(
                    fields['id'], fields['lat_deg'], fields['lon_deg'], store, global_data,
                    skyline=winner.skyline, series=winner.series)
                record = Site(**{**fields, 'nearby_sun': nearby}, terrain_tier=tier, has_closeup=False,
                              elevation_m=ground, slope=slope, quickmap_url=QUICKMAP_URL, moontrek_url=MOONTREK_URL)
                _stage_site(variant_target, meta, series, skyline, mesh)
                built[fields['id']] = record
                _write_index(index, built)
                print(f"{fields['id']}: built in {perf_counter()-variant_started:.6f} s; "
                      f'tier={tier}; ground_m={ground}')
        else:
            changed = _clear_placement(built, site.id)
            changed = _drop_variant(built, output, site.id) or changed
            if changed:
                _write_index(index, built)
                print(f'{_variant_id(site)}: removed')
    if not args.only:
        qualifying = {site.id for site in all_sites if _qualifies(site)}
        changed = False
        for variant_id in [key for key in built if key.endswith('_best_lit')]:
            parent_id = variant_id.removesuffix('_best_lit')
            if parent_id in qualifying:
                continue
            changed = _drop_variant(built, output, parent_id) or changed
            changed = _clear_placement(built, parent_id) or changed
        if changed:
            _write_index(index, built)
    for name in ('profiles.json', 'features.json', 'artemis_regions.json'):
        _atomic_bytes(output/name, (paths.catalog_dir()/name).read_bytes())
    _write_model(output/'manifest.json', manifest)
