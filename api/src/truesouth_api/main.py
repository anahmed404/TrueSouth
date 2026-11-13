"""Catalog-only HTTP API.

Serves `/api/health`, derived files at `/data/`, and the built web app at `/`.
Custom sites are a 501. The job queue and the sensitivity grid are not
registered: the web app never calls those URLs.
"""

from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, PlainTextResponse, Response

from truesouth_api.health import health_report
from truesouth_api.settings import derived_dir, prepared_dir, web_dist_dir
from truesouth_api.static import ASSET_CACHE, DATA_CACHE, SHELL_CACHE, file_response, safe_file, unsafe

CUSTOM_MESSAGE = "Custom sites are not available in this version."
NOT_FOUND = "Not found"
API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]


def _plain_missing() -> PlainTextResponse:
    return PlainTextResponse(NOT_FOUND, status_code=404)


def _json_missing() -> JSONResponse:
    return JSONResponse({"message": NOT_FOUND}, status_code=404)


def _serve_data(root: Path, relative: str) -> Response:
    found = safe_file(root, relative)
    if found is None:
        return _plain_missing()
    return file_response(found, DATA_CACHE)


def _serve_web(root: Path, relative: str) -> Response:
    if relative not in ("",):
        if unsafe(relative):
            return _plain_missing()
        found = safe_file(root, relative)
        if found is not None:
            cache = ASSET_CACHE if relative.startswith("assets/") else "public, max-age=3600"
            return file_response(found, cache)
        # A missing file with a suffix is a 404. Client routes have none,
        # so `/mission` and `/academy/sample` fall through to the shell.
        if "." in Path(relative).name:
            return _plain_missing()
    index = safe_file(root, "index.html")
    if index is None:
        return _plain_missing()
    return file_response(index, SHELL_CACHE)


def create_app(
    *,
    derived: Path | None = None,
    prepared: Path | None = None,
    web_dist: Path | None = None,
) -> FastAPI:
    derived_root = derived if derived is not None else derived_dir()
    prepared_root = prepared if prepared is not None else prepared_dir()
    web_root = web_dist if web_dist is not None else web_dist_dir()

    app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None, redirect_slashes=False)

    @app.middleware("http")
    async def refuse_traversal(request: Request, call_next):  # type: ignore[no-untyped-def]
        raw = request.scope.get("raw_path", b"").decode("latin-1", "replace")
        path = request.scope.get("path", "")
        if unsafe(raw) or unsafe(path):
            if path.startswith("/api"):
                return _json_missing()
            return _plain_missing()
        return await call_next(request)

    @app.get("/api/health")
    def health() -> JSONResponse:
        return JSONResponse(health_report(derived_root, prepared_root), headers={"Cache-Control": "no-store"})

    @app.api_route("/api/custom/{rest:path}", methods=["GET", "HEAD"])
    def custom_unavailable(rest: str) -> JSONResponse:
        return JSONResponse(status_code=501, content={"message": CUSTOM_MESSAGE})

    @app.api_route("/api/{rest:path}", methods=API_METHODS)
    def unknown_api(rest: str) -> JSONResponse:
        return _json_missing()

    @app.api_route("/data", methods=["GET", "HEAD"])
    @app.api_route("/data/{rest:path}", methods=["GET", "HEAD"])
    def derived_files(rest: str = "") -> Response:
        return _serve_data(derived_root, rest)

    @app.api_route("/", methods=["GET", "HEAD"])
    @app.api_route("/{rest:path}", methods=["GET", "HEAD"])
    def frontend(rest: str = "") -> Response:
        if rest == "api" or rest.startswith("api/"):
            return _json_missing()
        if rest == "data" or rest.startswith("data/"):
            return _plain_missing()
        return _serve_web(web_root, rest)

    return app


app = create_app()
