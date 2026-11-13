"""Where the API reads derived data, prepared maps, and the built web app.

Environment variables win. Otherwise look for the repository that contains
`web/` and `data/`. The production image sets the variables; it does not rely
on the source layout, because the package is installed into site-packages.
"""

import os
from pathlib import Path

DERIVED_ENV = "TRUESOUTH_DERIVED"
PREPARED_ENV = "TRUESOUTH_PREPARED"
WEB_DIST_ENV = "TRUESOUTH_WEB_DIST"
DATA_ROOT_ENV = "TRUESOUTH_DATA_ROOT"


def repo_root() -> Path:
    """The checkout that holds `web/` and `data/`, when this file still lives in it."""
    here = Path(__file__).resolve()
    for parent in here.parents:
        if (parent / "pyproject.toml").is_file() and (parent / "web").is_dir() and (parent / "data").is_dir():
            return parent
    return here.parents[3]


def derived_dir() -> Path:
    """Committed pipeline output, served at `/data/`."""
    override = os.environ.get(DERIVED_ENV)
    if override:
        return Path(override)
    return repo_root() / "data" / "derived"


def prepared_dir() -> Path:
    """Fast-read NASA maps. Catalog serving does not open them; health only looks."""
    override = os.environ.get(PREPARED_ENV)
    if override:
        return Path(override)
    data_root = os.environ.get(DATA_ROOT_ENV)
    if data_root:
        return Path(data_root) / "prepared"
    return repo_root() / "data" / "prepared"


def web_dist_dir() -> Path:
    """The built web app. Development uses Vite instead, so this may be absent."""
    override = os.environ.get(WEB_DIST_ENV)
    if override:
        return Path(override)
    return repo_root() / "web" / "dist"
