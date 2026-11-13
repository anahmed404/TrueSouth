"""Build the scene's Moon, Earth and polar-cap images, and the site aprons."""
import os
import tempfile
import time
from datetime import datetime, timezone
from pathlib import Path

from pydantic import ValidationError

from truesouth.contracts import SceneMeta
from truesouth.paths import derived_dir, prepared_dir, raw_dir
from truesouth.scene_assets import build_scene, scene_inputs


def add_arguments(parser):
    parser.add_argument('--generated-utc', default=None, help='UTC timestamp ending in Z (default: now)')
    parser.add_argument('--force', action='store_true', help='rebuild even when the inputs are unchanged')


def sources():
    raw = raw_dir()
    prepared = prepared_dir()
    wide = prepared / 'LDEM_60S_240MPP_ADJ.npy'
    return {
        'moon_4k': raw / 'lroc_color_poles_4k.tif',
        'moon_8k': raw / 'lroc_color_poles_8k.tif',
        'moon_height': raw / 'ldem_4.tif',
        'earth': raw / 'world.topo.bathy.200403.3x5400x2700.jpg',
        'dem': prepared / 'LDEM_80S_80MPP_ADJ.npy',
        'wide': wide if wide.is_file() else None,
        'maps': derived_dir() / 'maps',
        'sites': derived_dir() / 'sites.json',
    }


def input_fingerprints(paths):
    files = [paths['moon_4k'], paths['moon_8k'], paths['moon_height'], paths['earth'], paths['dem'], Path(paths['dem']).with_suffix('.json')]
    if paths.get('wide'):
        files += [paths['wide'], Path(paths['wide']).with_suffix('.json')]
    maps = Path(paths['maps'])
    files += [maps / name for name in ('hillshade_4k.webp', 'hillshade_8k.webp', 'sunlight_4k.webp', 'earthvis_4k.webp', 'meta.json')]
    files.append(paths['sites'])
    return scene_inputs(files)


def is_current(scene_dir, fingerprints):
    """True when meta.json matches these inputs and every scene file is present."""
    path = Path(scene_dir) / 'meta.json'
    if not path.is_file():
        return False
    try:
        meta = SceneMeta.model_validate_json(path.read_text(encoding='utf-8'))
    except (ValidationError, OSError):
        return False
    if [item.model_dump() for item in meta.inputs] != [item.model_dump() for item in fingerprints]:
        return False
    for image in meta.images:
        if not image.file.startswith('scene/'):
            continue
        if not (Path(scene_dir) / image.file.removeprefix('scene/')).is_file():
            return False
    for apron in meta.aprons:
        apron_path = Path(scene_dir) / apron.file.removeprefix('scene/')
        if not apron_path.is_file() or apron_path.stat().st_size != apron.rows * apron.columns * 2:
            return False
    return True


def publish(target, stage):
    """Replace target with the completed stage directory. A failure puts the old one back."""
    target = Path(target)
    backup = stage.parent / 'old'
    if target.exists():
        os.replace(target, backup)
    try:
        os.replace(stage, target)
    except BaseException:
        if backup.exists() and not target.exists():
            os.replace(backup, target)
        raise


def run(args):
    paths = sources()
    fingerprints = input_fingerprints(paths)
    target = derived_dir() / 'scene'
    if not args.force and is_current(target, fingerprints):
        print('scene assets: up to date', flush=True)
        return 0
    stamp = args.generated_utc or datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
    parent = derived_dir()
    parent.mkdir(parents=True, exist_ok=True)
    started = time.perf_counter()
    try:
        with tempfile.TemporaryDirectory(prefix='.scene-', dir=parent) as temp:
            stage = Path(temp) / 'output'
            build_scene(stage, paths, stamp, fingerprints, production=True)
            publish(target, stage)
    except (FileNotFoundError, ValueError, RuntimeError, OSError) as exc:
        raise SystemExit(str(exc)) from exc
    elapsed = time.perf_counter() - started
    total = 0
    print(f'scene assets: built in {elapsed:.1f} s', flush=True)
    for path in sorted(target.rglob('*')):
        if path.is_file():
            size = path.stat().st_size
            total += size
            print(f'{path.relative_to(target).as_posix()} {size}', flush=True)
    print(f'scene total {total}', flush=True)
    return 0
