"""The `truesouth` command: the pipeline steps of docs/architecture.md, "The pipeline".

Each step lives in `truesouth/commands/<step>.py` (see that package's docstring). A step
whose module does not exist yet exits non-zero and names the work package that builds it.
"""

import argparse
import importlib
import importlib.util
import json
from pathlib import Path

from pydantic.json_schema import models_json_schema

from .contracts import CONTRACT_MODELS

# Step name -> the work package in docs/build-plan.md that builds it.
COMMANDS = {
    'fetch-raw': 'S5',
    'prepare-dem': 'S5',
    'fetch-ephemeris': 'S4',
    'build-sites': 'S7 and S8',
    'build-maps': 'S9',
    'build-scene-assets': 'S16',
    'validate': 'S12',
    'build-worked-examples': 'S12',
    'build-fixtures': 'S2',
    'build-all': 'the pipeline steps it runs',
}


def step_module_name(command):
    """The module that implements a step, whether or not it exists yet."""
    return f"truesouth.commands.{command.replace('-', '_')}"


def is_built(command):
    """True when the step's module exists."""
    return importlib.util.find_spec(step_module_name(command)) is not None


def schema_bytes():
    _, schema = models_json_schema([(m, 'validation') for m in CONTRACT_MODELS], ref_template='#/$defs/{model}')
    schema['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
    schema['title'] = 'TrueSouthContracts'
    return (json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + '\n').encode('utf-8')


def export_schema():
    path = Path(__file__).resolve().parents[3] / 'web/src/contracts/schema.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(schema_bytes())


def main(argv=None):
    parser = argparse.ArgumentParser(prog='truesouth')
    sub = parser.add_subparsers(dest='command', required=True)
    sub.add_parser('export-schema', help='write web/src/contracts/schema.json from contracts.py')
    modules = {}
    for name, work_package in COMMANDS.items():
        if is_built(name):
            modules[name] = importlib.import_module(step_module_name(name))
            modules[name].add_arguments(sub.add_parser(name, help=(modules[name].__doc__ or '').strip().split('\n')[0]))
        else:
            sub.add_parser(name, help=f'not built yet ({work_package})')
    args = parser.parse_args(argv)
    if args.command == 'export-schema':
        export_schema()
        return 0
    if args.command not in modules:
        parser.exit(1, f'{args.command} is not built yet; {COMMANDS[args.command]} will build it.\n')
    return modules[args.command].run(args) or 0


if __name__ == '__main__':
    raise SystemExit(main())
