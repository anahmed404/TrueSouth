"""Build the Academy's worked examples from stored derived data."""

import json
from pathlib import Path
import sys
import tempfile

from truesouth import paths
from truesouth.contracts import WorkedExamples
from truesouth.worked_examples import MissingSelection, build_examples, render_table


def add_arguments(parser):
    parser.add_argument('--derived', type=Path, default=None, help='derived data directory; default data/derived')


def write_examples(path, model):
    """Validate the JSON bytes, then replace the destination. A failed rule never calls this."""
    content = (json.dumps(model.model_dump(by_alias=True, mode='json'), indent=2, sort_keys=True,
                          ensure_ascii=False, allow_nan=False) + '\n').encode('utf-8')
    WorkedExamples.model_validate_json(content)
    path.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.NamedTemporaryFile(dir=path.parent, prefix='.' + path.name, delete=False) as file:
        temporary = Path(file.name)
    try:
        temporary.write_bytes(content)
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)
    return content


def run(args):
    root = args.derived if args.derived is not None else paths.derived_dir()
    try:
        model = build_examples(root)
    except MissingSelection as exc:
        print(str(exc), file=sys.stderr)
        return 1
    path = root / 'academy' / 'worked_examples.json'
    write_examples(path, model)
    print(render_table(model), end='')
    return 0
