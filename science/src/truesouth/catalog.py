"""Read and validate the hand-edited catalog inputs."""

import json
from pathlib import Path
from typing import TypeVar

from pydantic import BaseModel, ValidationError

from truesouth import paths
from truesouth.contracts import ArtemisRegion, CatalogSite, Feature, MissionProfile

T = TypeVar('T', bound=BaseModel)


def _load(filename: str, model: type[T], directory: Path | None) -> list[T]:
    path = (directory if directory is not None else paths.catalog_dir()) / filename
    try:
        data = json.loads(path.read_text(encoding='utf-8'))
    except (OSError, UnicodeError, json.JSONDecodeError) as exc:
        raise ValueError(f'{path}: {exc}') from exc
    if not isinstance(data, list):
        raise ValueError(f'{path}: expected an array')
    result = []
    for index, entry in enumerate(data):
        try:
            result.append(model.model_validate(entry))
        except ValidationError as exc:
            label = (entry.get('id') or entry.get('name') or index) if isinstance(entry, dict) else index
            raise ValueError(f'{path}: entry {label}: {exc}') from exc
    return result


def load_sites(directory: Path | None = None) -> list[CatalogSite]:
    return _load('sites.json', CatalogSite, directory)


def load_profiles(directory: Path | None = None) -> list[MissionProfile]:
    return _load('profiles.json', MissionProfile, directory)


def load_features(directory: Path | None = None) -> list[Feature]:
    return _load('features.json', Feature, directory)


def load_artemis_regions(directory: Path | None = None) -> list[ArtemisRegion]:
    return _load('artemis_regions.json', ArtemisRegion, directory)
