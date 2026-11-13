"""Serve one file from a root, or refuse the request.

`..`, a backslash, a null, and leftover percent-encodings of those are refused.
A directory is not a file, so it is not listed. A name that starts with a dot is
refused. A request that already holds the current copy gets a 304.
"""

from pathlib import Path
from urllib.parse import unquote

from fastapi.responses import FileResponse, Response
from starlette.datastructures import Headers

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
    ".ttf": "font/ttf",
    ".ico": "image/x-icon",
    ".txt": "text/plain; charset=utf-8",
    ".map": "application/json",
}

# Derived files are rebuilt in place under the same names, so a browser must ask before it
# reuses a copy. The answer is a 304 with no body when nothing changed.
DATA_CACHE = "no-cache"
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
    if any(part.startswith(".") for part in relative.split("/")):
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


def _same_copy(if_none_match: str, etag: str) -> bool:
    wanted = etag.removeprefix("W/")
    held = [tag.strip().removeprefix("W/") for tag in if_none_match.split(",")]
    return "*" in held or wanted in held


def file_response(path: Path, cache: str, request_headers: Headers | None = None) -> Response:
    """The file, or a 304 when the request names the copy the server would send."""
    response = FileResponse(
        path,
        media_type=media_type_for(path),
        headers={"Cache-Control": cache},
        stat_result=path.stat(),
    )
    etag = response.headers.get("etag")
    held = request_headers.get("if-none-match") if request_headers is not None else None
    if etag and held and _same_copy(held, etag):
        return Response(status_code=304, headers={"ETag": etag, "Cache-Control": cache})
    return response
