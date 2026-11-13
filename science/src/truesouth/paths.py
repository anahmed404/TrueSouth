"""Where the pipeline reads and writes files. See docs/architecture.md, "Repo layout".

Committed data (`data/catalog`, `data/derived`, `data/fixtures`) always lives in the
repository. Large uncommitted data (`raw`, `prepared`, `cache`) lives under the data root,
which is `<repo>/data` unless the environment variable `TRUESOUTH_DATA_ROOT` names another
folder. Several checkouts of the repo (git worktrees, the API container) can then share one
copy of the NASA downloads instead of fetching hundreds of megabytes each.
"""

import os
from pathlib import Path

DATA_ROOT_ENV = "TRUESOUTH_DATA_ROOT"


def repo_root() -> Path:
    """The repository root: the folder that holds `science/`, `web/` and `data/`."""
    return Path(__file__).resolve().parents[3]


def data_root() -> Path:
    """The folder that holds `raw/`, `prepared/` and `cache/`."""
    override = os.environ.get(DATA_ROOT_ENV)
    return Path(override).expanduser().resolve() if override else repo_root() / "data"


def raw_dir() -> Path:
    """NASA downloads and saved Horizons responses, unchanged. Never committed."""
    return data_root() / "raw"


def prepared_dir() -> Path:
    """Raw data converted for fast reading. Never committed."""
    return data_root() / "prepared"


def cache_dir() -> Path:
    """Custom sites computed by the API. Never committed."""
    return data_root() / "cache"


def catalog_dir() -> Path:
    """Hand-edited inputs: sites, profiles, features, Artemis regions. Committed."""
    return repo_root() / "data" / "catalog"


def derived_dir() -> Path:
    """What the pipeline produces and the web app reads. Committed."""
    return repo_root() / "data" / "derived"


def fixtures_dir() -> Path:
    """The small synthetic dataset in the derived-data formats. Committed."""
    return repo_root() / "data" / "fixtures"
