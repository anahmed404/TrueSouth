"""`GET /api/health`. A missing file is a fact in the report, never an exception."""

import json
from pathlib import Path

# Files the catalog app reads. Optional ones stay in the report and do not
# change `status` on their own: sphere sites have no terrain, close-ups are not
# built yet, and validation, worked examples, and scene images may be absent.
TOP_LEVEL = {
    "manifest": "manifest.json",
    "sites": "sites.json",
    "profiles": "profiles.json",
    "features": "features.json",
    "artemis_regions": "artemis_regions.json",
    "system": "system.bin",
    "validation": "validation.json",
    "worked_examples": "academy/worked_examples.json",
}
MAP_FILES = (
    "meta.json",
    "hillshade_4k.webp",
    "hillshade_8k.webp",
    "sunlight_4k.webp",
    "earthvis_4k.webp",
    "sunlight_u8.bin",
    "earthvis_u8.bin",
)
SITE_FILES = ("meta.json", "series.bin", "skyline.bin", "terrain.bin", "closeup.bin")
# A catalog site can be served from these three. Terrain and close-up are not
# required: a sphere site has neither, and close-ups are a later package.
REQUIRED_SITE_FILES = ("meta.json", "series.bin", "skyline.bin")
# `prepare-dem` writes these two polar maps and a JSON sidecar for each.
PREPARED_MAPS = (
    "LDEM_80S_80MPP_ADJ.npy",
    "LDEM_80S_80MPP_ADJ.json",
    "LDEM_60S_240MPP_ADJ.npy",
    "LDEM_60S_240MPP_ADJ.json",
)

UNAVAILABLE = "Custom sites need the terrain maps, which are not installed on this server."


def _is_file(path: Path) -> bool:
    try:
        return path.is_file()
    except OSError:
        return False


def _is_dir(path: Path) -> bool:
    try:
        return path.is_dir()
    except OSError:
        return False


def _has_files(root: Path) -> bool:
    try:
        if not root.is_dir():
            return False
        for path in root.rglob("*"):
            try:
                if path.is_file():
                    return True
            except OSError:
                continue
        return False
    except OSError:
        return False


def _site_ids(path: Path) -> list[str] | None:
    """Ids from a readable sites.json, or None when the file is missing or not that list."""
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError, ValueError):
        return None
    if not isinstance(data, list):
        return None
    ids: list[str] = []
    for item in data:
        if not isinstance(item, dict):
            return None
        site_id = item.get("id")
        if not isinstance(site_id, str) or site_id == "":
            return None
        if site_id not in ids:
            ids.append(site_id)
    return ids


def _site_dirs(root: Path) -> list[str]:
    sites = root / "sites"
    if not _is_dir(sites):
        return []
    names: list[str] = []
    try:
        children = list(sites.iterdir())
    except OSError:
        return []
    for child in children:
        try:
            if child.is_dir():
                names.append(child.name)
        except OSError:
            continue
    return names


def _present_map(directory: Path, names: tuple[str, ...]) -> dict[str, bool]:
    found = {name: _is_file(directory / name) for name in names}
    if not _is_dir(directory):
        return found
    try:
        children = list(directory.iterdir())
    except OSError:
        return found
    for child in sorted(children, key=lambda path: path.name):
        try:
            if child.is_file() and child.name not in found:
                found[child.name] = True
        except OSError:
            continue
    return found


def _scene_files(root: Path) -> list[str] | None:
    scene = root / "scene"
    if not _is_dir(scene):
        return None
    names: list[str] = []
    try:
        children = list(scene.iterdir())
    except OSError:
        return names
    for child in children:
        try:
            if child.is_file():
                names.append(child.name)
            elif child.is_dir():
                # One folder down: the aprons live in scene/aprons/.
                names.extend(f"{child.name}/{inner.name}" for inner in child.iterdir() if inner.is_file())
        except OSError:
            continue
    return sorted(names)


def health_report(derived: Path, prepared: Path) -> dict[str, object]:
    """Which catalog files and prepared maps are on disk, plus what this version refuses."""
    files = {key: _is_file(derived / relative) for key, relative in TOP_LEVEL.items()}
    listed = _site_ids(derived / "sites.json")
    readable = listed is not None
    ids = list(listed or [])
    for name in _site_dirs(derived):
        if name not in ids:
            ids.append(name)
    sites: dict[str, dict[str, bool]] = {}
    for site_id in ids:
        folder = derived / "sites" / site_id
        sites[site_id] = {name: _is_file(folder / name) for name in SITE_FILES}

    catalog_ok = files["manifest"] and readable and all(
        all(sites[site_id][name] for name in REQUIRED_SITE_FILES) for site_id in (listed or [])
    )
    if not _has_files(derived):
        status = "empty"
    elif catalog_ok:
        status = "ok"
    else:
        status = "incomplete"

    available = all(_is_file(prepared / name) for name in PREPARED_MAPS)
    return {
        "status": status,
        "custom_sites": "available" if available else "not_available",
        "sensitivity_grid": "not_available",
        "message": ("Custom sites are available. Sensitivity grids are not available in this version." if available else UNAVAILABLE),
        "derived": {
            **files,
            "sites_json_readable": readable,
            "maps": _present_map(derived / "maps", MAP_FILES),
            "site_files": sites,
            "scene": _scene_files(derived),
        },
        "prepared_maps": _present_map(prepared, PREPARED_MAPS),
    }
