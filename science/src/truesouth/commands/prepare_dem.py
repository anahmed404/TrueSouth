"""Prepare downloaded elevation maps for memory-mapped sampling."""
from truesouth.dem import prepare_map
from truesouth.paths import raw_dir, prepared_dir


def add_arguments(parser):
    pass


def run(args):
    files = sorted(p for p in raw_dir().rglob('*') if p.is_file() and (p.name.upper().startswith('LDEM_') or p.name.lower().endswith('_surf.tif')) and p.suffix.lower() in ('.tif', '.tiff'))
    if not files:
        raise SystemExit('No raw elevation maps found; run fetch-raw first.')
    for path in files:
        output = prepared_dir() / (path.stem + '.npy')
        print(f"{path.name}: {'prepared' if prepare_map(path, output) else 'up to date'}")
