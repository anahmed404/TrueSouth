"""One module per pipeline step of the `truesouth` command.

To build a step, add `<step name with underscores>.py` here, for example
`fetch_ephemeris.py` for `truesouth fetch-ephemeris`, with two functions:

    def add_arguments(parser: argparse.ArgumentParser) -> None: ...
    def run(args: argparse.Namespace) -> int | None: ...

`truesouth.cli` finds the module by its name. Nobody edits `cli.py` to add a step, so
steps built in parallel never touch the same file. Keep the science in its own module
(`ephemeris.py`, `dem.py`, ...); the step module only parses arguments and calls it.
"""
