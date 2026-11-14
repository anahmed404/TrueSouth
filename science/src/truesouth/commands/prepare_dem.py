"""Prepare the downloaded polar elevation maps for memory-mapped sampling."""
from truesouth.dem import prepare_map
from truesouth.paths import prepared_dir, raw_dir


def add_arguments(parser):
    parser.add_argument('--group', choices=['terrain', 'closeup'], default='terrain',
                        help='closeup crops are already prepared by fetch-raw --group closeup')


def run(args):
    """Convert each polar terrain map (`LDEM_*.TIF`) in the raw folder.

    Close-up DEMs (`*_surf.tif`) are in their own projection and are prepared by a later
    work package (S8), so they are skipped here. Partly downloaded `.part` files are ignored.
    One refused map does not stop the others; the step exits non-zero if any was refused.
    """
    if args.group == 'closeup':
        import json
        from truesouth.closeups import window_covered
        from truesouth.dem import PreparedMap
        index = prepared_dir()/'closeups/index.json'
        if not index.is_file():
            raise SystemExit('Run fetch-raw --group closeup first; it prepares crops before discarding each source.')
        state = json.loads(index.read_text())
        for key, entry in state['sites'].items():
            if entry['covered']:
                terrain = PreparedMap(index.parent/f'{key}.npy')
                if not window_covered(terrain, *state['centres'][key]):
                    raise SystemExit(f'{key}: crop no longer covers its complete window; refetch')
            print(f"{key}: {entry['reason']}")
        return
    rasters = sorted(p for p in raw_dir().rglob('*') if p.is_file() and p.suffix.lower() in ('.tif', '.tiff'))
    maps = [p for p in rasters if p.name.upper().startswith('LDEM_')]
    skipped = [p for p in rasters if p.name.lower().endswith('_surf.tif')]
    if not maps:
        raise SystemExit('No polar elevation maps found; run fetch-raw --group terrain first.')
    refused = []
    for path in maps:
        output = prepared_dir() / (path.stem + '.npy')
        try:
            print(f"{path.name}: {'prepared' if prepare_map(path, output) else 'up to date'}")
        except ValueError as exc:
            refused.append(path.name)
            print(f'{path.name}: REFUSED: {exc}')
    for path in skipped:
        print(f'{path.name}: skipped (close-up DEMs are prepared by a later step)')
    if refused:
        raise SystemExit('Refused: ' + ', '.join(refused))
