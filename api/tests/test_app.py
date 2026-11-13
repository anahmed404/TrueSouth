"""Catalog API: health, derived files, and the built web app.

Path traversal is checked with FastAPI's test client. httpx removes a literal
`/data/../…` before the app sees it, so the encoded forms are what reach the
server. One extra in-process request sends the literal path uvicorn would.
"""

import asyncio
from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from truesouth_api.main import create_app

MARKER = b"TRUESOUTH_INDEX"
SECRET = b"TOP-SECRET-NOT-DATA"

MAP_FILES = (
    "meta.json",
    "hillshade_4k.webp",
    "hillshade_8k.webp",
    "sunlight_4k.webp",
    "earthvis_4k.webp",
    "sunlight_u8.bin",
    "earthvis_u8.bin",
)
PREPARED = (
    "LDEM_80S_80MPP_ADJ.npy",
    "LDEM_80S_80MPP_ADJ.json",
    "LDEM_60S_240MPP_ADJ.npy",
    "LDEM_60S_240MPP_ADJ.json",
)


def _write(path: Path, data: bytes | str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if isinstance(data, str):
        path.write_text(data, encoding="utf-8", newline="\n")
    else:
        path.write_bytes(data)


def _catalog(root: Path) -> None:
    _write(root / "manifest.json", '{"schema_version": 1}\n')
    _write(root / "sites.json", '[{"id": "ridge"}]\n')
    _write(root / "profiles.json", "[]\n")
    _write(root / "features.json", "[]\n")
    _write(root / "artemis_regions.json", "[]\n")
    _write(root / "system.bin", b"sys")
    _write(root / "validation.json", "{}\n")
    _write(root / "academy" / "worked_examples.json", "{}\n")
    for name, body in {
        "meta.json": b'{"site_id":"ridge"}',
        "series.bin": b"series-bytes",
        "skyline.bin": b"sky",
        "terrain.bin": b"terrain",
        "closeup.bin": b"close",
    }.items():
        _write(root / "sites" / "ridge" / name, body)
    for name in MAP_FILES:
        _write(root / "maps" / name, name.encode("ascii"))
    _write(root / "scene" / "moon_2k.webp", b"moon")
    _write(root / "scene" / "aprons" / "ridge.bin", b"apron")
    _write(root / "tiny.png", b"\x89PNG")
    _write(root / "tiny.jpg", b"\xff\xd8")


def _prepared(root: Path) -> None:
    for name in PREPARED:
        _write(root / name, b"map")


def _web(root: Path) -> None:
    _write(root / "index.html", "<!doctype html><title>TrueSouth</title>TRUESOUTH_INDEX")
    _write(root / "assets" / "app.js", "console.log('app')")


def _app(tmp_path: Path, *, fill: bool) -> FastAPI:
    derived = tmp_path / "derived"
    prepared = tmp_path / "prepared"
    web = tmp_path / "web"
    if fill:
        _catalog(derived)
        _prepared(prepared)
        _web(web)
    _write(tmp_path / "pyproject.toml", "name = 'secret'\n" + SECRET.decode("ascii"))
    return create_app(derived=derived, prepared=prepared, web_dist=web)


def _asgi_get(app: FastAPI, path: str) -> tuple[int, bytes, str]:
    """Send a path exactly as written, the way uvicorn does (no dot-segment removal)."""
    captured: dict[str, object] = {}

    async def receive() -> dict[str, object]:
        return {"type": "http.request", "body": b"", "more_body": False}

    async def send(message: dict[str, object]) -> None:
        if message["type"] == "http.response.start":
            captured["status"] = message["status"]
            captured["ctype"] = ""
            for key, value in message["headers"]:  # type: ignore[union-attr]
                if key.decode("latin-1").lower() == "content-type":
                    captured["ctype"] = value.decode("latin-1")
        elif message["type"] == "http.response.body":
            captured["body"] = bytes(captured.get("body", b"")) + message.get("body", b"")  # type: ignore[operator]

    scope = {
        "type": "http",
        "asgi": {"spec_version": "2.3", "version": "3.0"},
        "http_version": "1.1",
        "method": "GET",
        "scheme": "http",
        "path": path,
        "raw_path": path.encode("ascii"),
        "query_string": b"",
        "headers": [],
        "client": ("127.0.0.1", 123),
        "server": ("testserver", 80),
        "root_path": "",
    }
    asyncio.run(app(scope, receive, send))
    return int(captured["status"]), bytes(captured.get("body", b"")), str(captured.get("ctype", ""))


def test_health_everything_present(tmp_path: Path) -> None:
    response = TestClient(_app(tmp_path, fill=True)).get("/api/health")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("application/json")
    body = response.json()
    assert body["status"] == "ok"
    assert body["custom_sites"] == "available"
    assert body["sensitivity_grid"] == "not_available"
    assert "terrain maps" in body["message"]
    derived = body["derived"]
    for key in (
        "manifest",
        "sites",
        "profiles",
        "features",
        "artemis_regions",
        "system",
        "validation",
        "worked_examples",
    ):
        assert derived[key] is True, key
    for name in MAP_FILES:
        assert derived["maps"][name] is True
    assert derived["site_files"]["ridge"]["series.bin"] is True
    assert derived["site_files"]["ridge"]["closeup.bin"] is True
    assert derived["scene"] == ["aprons/ridge.bin", "moon_2k.webp"]
    for name in PREPARED:
        assert body["prepared_maps"][name] is True


def test_health_missing_files(tmp_path: Path) -> None:
    derived = tmp_path / "derived"
    _catalog(derived)
    (derived / "manifest.json").unlink()
    (derived / "sites" / "ridge" / "series.bin").unlink()
    app = create_app(derived=derived, prepared=tmp_path / "prepared", web_dist=tmp_path / "web")
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "incomplete"
    assert body["derived"]["manifest"] is False
    assert body["derived"]["site_files"]["ridge"]["series.bin"] is False
    assert body["derived"]["site_files"]["ridge"]["meta.json"] is True
    assert body["prepared_maps"]["LDEM_80S_80MPP_ADJ.npy"] is False
    assert "terrain maps" in body["message"]


def test_health_empty_folder(tmp_path: Path) -> None:
    derived = tmp_path / "derived"
    derived.mkdir()
    app = create_app(derived=derived, prepared=tmp_path / "missing-prepared", web_dist=tmp_path / "web")
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "empty"
    assert body["derived"]["manifest"] is False
    assert body["derived"]["sites"] is False
    assert body["derived"]["site_files"] == {}
    assert body["derived"]["scene"] is None
    assert all(value is False for value in body["prepared_maps"].values())
    assert body["custom_sites"] == "not_available"


def test_health_unreadable_sites_json_is_not_a_500(tmp_path: Path) -> None:
    derived = tmp_path / "derived"
    _catalog(derived)
    (derived / "sites.json").write_text("{not json", encoding="utf-8", newline="\n")
    app = create_app(derived=derived, prepared=tmp_path / "prepared", web_dist=tmp_path / "web")
    response = TestClient(app).get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "incomplete"
    assert response.json()["derived"]["sites_json_readable"] is False


def test_static_file_bytes_and_content_types(tmp_path: Path) -> None:
    client = TestClient(_app(tmp_path, fill=True))
    series = client.get("/data/sites/ridge/series.bin")
    assert series.status_code == 200
    assert series.content == b"series-bytes"
    assert series.headers["content-type"].startswith("application/octet-stream")
    assert series.headers["cache-control"] == "no-cache"

    meta = client.get("/data/sites/ridge/meta.json")
    assert meta.status_code == 200
    assert meta.json() == {"site_id": "ridge"}
    assert meta.headers["content-type"].startswith("application/json")

    webp = client.get("/data/maps/hillshade_4k.webp")
    assert webp.status_code == 200
    assert webp.headers["content-type"].startswith("image/webp")
    assert webp.content == b"hillshade_4k.webp"

    png = client.get("/data/tiny.png")
    assert png.status_code == 200
    assert png.content == b"\x89PNG"
    assert png.headers["content-type"].startswith("image/png")

    jpg = client.get("/data/tiny.jpg")
    assert jpg.status_code == 200
    assert jpg.content == b"\xff\xd8"
    assert jpg.headers["content-type"].startswith("image/jpeg")


def test_data_file_is_revalidated_not_reused(tmp_path: Path) -> None:
    """A rebuilt file keeps its name, so the browser asks each time and gets a 304 or the new bytes."""
    derived = tmp_path / "derived"
    client = TestClient(_app(tmp_path, fill=True))
    first = client.get("/data/sites/ridge/series.bin")
    etag = first.headers["etag"]

    again = client.get("/data/sites/ridge/series.bin", headers={"If-None-Match": etag})
    assert again.status_code == 304
    assert again.content == b""
    assert again.headers["etag"] == etag

    weak = client.get("/data/sites/ridge/series.bin", headers={"If-None-Match": f'W/{etag}, "other"'})
    assert weak.status_code == 304

    (derived / "sites" / "ridge" / "series.bin").write_bytes(b"rebuilt series bytes")
    changed = client.get("/data/sites/ridge/series.bin", headers={"If-None-Match": etag})
    assert changed.status_code == 200
    assert changed.content == b"rebuilt series bytes"
    assert changed.headers["etag"] != etag


def test_dot_files_are_refused(tmp_path: Path) -> None:
    derived = tmp_path / "derived"
    client = TestClient(_app(tmp_path, fill=True))
    (derived / ".secret").write_text("no", encoding="utf-8")
    (derived / "sites" / ".hidden").mkdir()
    (derived / "sites" / ".hidden" / "a.json").write_text("{}", encoding="utf-8")
    for url in ("/data/.secret", "/data/sites/.hidden/a.json", "/.env", "/.git/config"):
        response = client.get(url)
        assert response.status_code == 404, url
        assert "html" not in response.headers["content-type"], url


def test_missing_data_file_is_not_html(tmp_path: Path) -> None:
    response = TestClient(_app(tmp_path, fill=True)).get("/data/no-such-file.json")
    assert response.status_code == 404
    assert "html" not in response.headers["content-type"]
    assert response.text == "Not found"
    assert MARKER not in response.content


def test_data_directory_is_not_listed(tmp_path: Path) -> None:
    client = TestClient(_app(tmp_path, fill=True))
    for path in ("/data", "/data/", "/data/sites", "/data/sites/"):
        response = client.get(path)
        assert response.status_code == 404, path
        assert MARKER not in response.content
        assert b"ridge" not in response.content
        assert b"series.bin" not in response.content


def test_path_traversal_is_refused(tmp_path: Path) -> None:
    app = _app(tmp_path, fill=True)
    client = TestClient(app)
    secret = (tmp_path / "pyproject.toml").read_bytes()
    paths = [
        "/data/../pyproject.toml",
        "/data/%2e%2e/pyproject.toml",
        "/data/%2e%2e%2fpyproject.toml",
        "/data/..%2fpyproject.toml",
        "/data/%252e%252e/pyproject.toml",
        "/data/sites/../../pyproject.toml",
        "/data/%2E%2E/%2E%2E/pyproject.toml",
    ]
    for path in paths:
        response = client.get(path)
        assert response.status_code == 404, path
        assert secret not in response.content, path
        assert b"TOP-SECRET" not in response.content, path
        assert MARKER not in response.content, path
        assert "html" not in response.headers["content-type"], path

    status, body, ctype = _asgi_get(app, "/data/../pyproject.toml")
    assert status == 404
    assert secret not in body
    assert b"TOP-SECRET" not in body
    assert MARKER not in body
    assert "html" not in ctype


def test_client_routes_fall_back_to_index(tmp_path: Path) -> None:
    client = TestClient(_app(tmp_path, fill=True))
    for path in ("/", "/mission", "/academy/sample"):
        response = client.get(path)
        assert response.status_code == 200, path
        assert MARKER in response.content
        assert response.headers["content-type"].startswith("text/html")
    asset = client.get("/assets/app.js")
    assert asset.status_code == 200
    assert asset.content == b"console.log('app')"
    assert MARKER not in asset.content
    missing_asset = client.get("/assets/missing.js")
    assert missing_asset.status_code == 404
    assert MARKER not in missing_asset.content


def test_unknown_api_route_is_json_404(tmp_path: Path) -> None:
    response = TestClient(_app(tmp_path, fill=True)).get("/api/unknown")
    assert response.status_code == 404
    assert response.headers["content-type"].startswith("application/json")
    assert MARKER not in response.content


def test_custom_site_unknown_is_404(tmp_path: Path) -> None:
    client = TestClient(_app(tmp_path, fill=True))
    for path in (
        "/api/custom/c_-89.2000_130.5000/meta.json",
        "/api/custom/c_-89.2000_130.5000/series.bin",
    ):
        response = client.get(path)
        assert response.status_code == 404, path
        assert "POST /api/sites/custom" in response.json()["message"]
        assert "html" not in response.headers["content-type"]


def test_job_and_sensitivity_routes_are_not_registered(tmp_path: Path) -> None:
    client = TestClient(_app(tmp_path, fill=True))
    for path in ("/api/sites/custom/c_-89.2000_130.5000", "/api/sensitivity"):
        response = client.post(path)
        assert response.status_code == 404, path
        assert response.headers["content-type"].startswith("application/json")
        assert MARKER not in response.content
