from pathlib import Path

from truesouth import paths


def test_default_data_root_is_inside_the_repo(monkeypatch):
    monkeypatch.delenv(paths.DATA_ROOT_ENV, raising=False)
    root = paths.repo_root()
    assert (root / "science" / "src" / "truesouth" / "paths.py").is_file()
    assert paths.data_root() == root / "data"
    assert paths.raw_dir() == root / "data" / "raw"
    assert paths.prepared_dir() == root / "data" / "prepared"
    assert paths.cache_dir() == root / "data" / "cache"


def test_data_root_override_moves_only_uncommitted_data(monkeypatch, tmp_path):
    monkeypatch.setenv(paths.DATA_ROOT_ENV, str(tmp_path))
    assert paths.raw_dir() == Path(tmp_path).resolve() / "raw"
    assert paths.prepared_dir() == Path(tmp_path).resolve() / "prepared"
    assert paths.cache_dir() == Path(tmp_path).resolve() / "cache"
    # Committed data never follows the override.
    root = paths.repo_root()
    assert paths.catalog_dir() == root / "data" / "catalog"
    assert paths.derived_dir() == root / "data" / "derived"
    assert paths.fixtures_dir() == root / "data" / "fixtures"
