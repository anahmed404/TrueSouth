"""Serve one file from a root, or refuse the request.

`..`, a backslash, a null, and leftover percent-encodings of those are refused.
A directory is not a file, so it is not listed.
"""

from pathlib import Path
from urllib.parse import unquote

from fastapi.responses import FileResponse, Response

MEDIA_TYPES = {
    ".json": "application/json; charset=utf-8",
    ".bin": "application/octet-stream",
    ".webp": "image/webp",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".svg": "image/svg+xml",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json",
}

DATA_CACHE = "public, max-age=86400"
ASSET_CACHE = "public, max-age=31536000, immutable"
SHELL_CACHE = "no-cache"


def _dotdot(value: str) -> bool:
    return any(part == ".." for part in value.split("/"))


def unsafe(value: str) -> bool:
    """True when `value` could leave a serve root, including after decoding."""
    if "\x00" in value:
        return True
    current = value
    for _ in range(3):
        if "\\" in current or ":" in current or _dotdot(current):
            return True
        decoded = unquote(current)
        if decoded == current:
            return False
        current = decoded
    return "\\" in current or ":" in current or _dotdot(current)


def safe_file(root: Path, relative: str) -> Path | None:
    """A regular file inside `root`, or None when the path is refused or missing."""
    if relative == "" or relative.endswith("/") or unsafe(relative):
        return None
    relative = unquote(relative)
    if unsafe(relative) or relative.startswith(("/", "\\")):
        return None
    try:
        root_resolved = root.resolve()
        candidate = (root_resolved / relative).resolve()
        candidate.relative_to(root_resolved)
    except (OSError, ValueError):
        return None
    try:
        if not candidate.is_file():
            return None
    except OSError:
        return None
    return candidate


def media_type_for(path: Path) -> str:
    return MEDIA_TYPES.get(path.suffix.lower(), "application/octet-stream")


def file_response(path: Path, cache: str) -> Response:
    return FileResponse(path, media_type=media_type_for(path), headers={"Cache-Control": cache})
