import argparse
import json
from pathlib import Path
from pydantic.json_schema import models_json_schema
from .contracts import CONTRACT_MODELS

COMMANDS = {'fetch-raw': 'S5', 'prepare-dem': 'S5', 'fetch-ephemeris': 'S4', 'build-sites': 'S7 and S8', 'build-maps': 'S9', 'validate': 'S12', 'build-worked-examples': 'S12', 'build-fixtures': 'S2', 'build-all': 'the pipeline steps it runs'}

def schema_bytes():
    _, schema = models_json_schema([(m, 'validation') for m in CONTRACT_MODELS], ref_template='#/$defs/{model}')
    schema['$schema'] = 'https://json-schema.org/draft/2020-12/schema'
    schema['title'] = 'TrueSouthContracts'
    return (json.dumps(schema, indent=2, sort_keys=True, ensure_ascii=False) + '\n').encode('utf-8')


def export_schema():
    path = Path(__file__).resolve().parents[3] / 'web/src/contracts/schema.json'
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(schema_bytes())

def main():
    parser = argparse.ArgumentParser(prog='truesouth')
    sub = parser.add_subparsers(dest='command', required=True)
    for name in (*COMMANDS, 'export-schema'):
        sub.add_parser(name)
    args = parser.parse_args()
    if args.command == 'export-schema':
        export_schema()
    else:
        parser.exit(1, f'{args.command} is not built yet; {COMMANDS[args.command]} will build it.\n')

if __name__ == '__main__':
    main()
