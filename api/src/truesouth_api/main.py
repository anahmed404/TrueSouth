"""Catalog files and on-demand custom sites."""

from contextlib import asynccontextmanager
from pathlib import Path

from truesouth.contracts import CustomSiteRequest, CustomSiteQueued, CustomSiteStatus
from truesouth_api.body_limit import CustomBodyLimit
from truesouth_api.jobs import Computer, Jobs, Rejected, START
from truesouth_api.settings import cache_dir

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.exception_handlers import http_exception_handler
from starlette.exceptions import HTTPException as StarletteHTTPException
from fastapi.responses import JSONResponse, PlainTextResponse, Response
from starlette.datastructures import Headers

from truesouth_api.health import health_report
from truesouth_api.settings import derived_dir, prepared_dir, web_dist_dir
from truesouth_api.static import ASSET_CACHE, DATA_CACHE, SHELL_CACHE, file_response, safe_file, unsafe

NOT_FOUND = "Not found"
API_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD"]


def _plain_missing() -> PlainTextResponse:
    return PlainTextResponse(NOT_FOUND, status_code=404)


def _json_missing() -> JSONResponse:
    return JSONResponse({"code": "not_found", "message": NOT_FOUND}, status_code=404)


def _serve_data(root: Path, relative: str, headers: Headers) -> Response:
    found = safe_file(root, relative)
    if found is None:
        return _plain_missing()
    return file_response(found, DATA_CACHE, headers)


def _serve_web(root: Path, relative: str, headers: Headers) -> Response:
    if relative not in ("",):
        if unsafe(relative) or any(part.startswith(".") for part in relative.split("/")):
            return _plain_missing()
        found = safe_file(root, relative)
        if found is not None:
            cache = ASSET_CACHE if relative.startswith("assets/") else "public, max-age=3600"
            return file_response(found, cache, headers)
        # A missing file with a suffix is a 404. Client routes have none,
        # so `/mission` and `/academy/sample` fall through to the shell.
        if "." in Path(relative).name:
            return _plain_missing()
    index = safe_file(root, "index.html")
    if index is None:
        return _plain_missing()
    return file_response(index, SHELL_CACHE, headers)


def create_app(
    *,
    derived: Path | None = None,
    prepared: Path | None = None,
    web_dist: Path | None = None,
    cache: Path | None = None,
    jobs: Jobs | None = None,
) -> FastAPI:
    derived_root = derived if derived is not None else derived_dir()
    prepared_root = prepared if prepared is not None else prepared_dir()
    web_root = web_dist if web_dist is not None else web_dist_dir()

    cache_root = cache if cache is not None else cache_dir()
    service = jobs or Jobs(cache_root, Computer(derived_root, prepared_root, cache_root))

    @asynccontextmanager
    async def lifespan(app):
        yield
        service.close()

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None, redirect_slashes=False)

    @app.exception_handler(StarletteHTTPException)
    async def parsing_error(request: Request, error: StarletteHTTPException):
        if request.url.path == '/api/sites/custom' and error.status_code == 400:
            return JSONResponse({'code': 'invalid_request', 'message': 'Please check the request fields.', 'fields': [{
                'field': 'body',
                'message': 'Send a JSON object with latitude, longitude and an optional name. Only these fields are allowed.',
            }]}, status_code=422)
        return await http_exception_handler(request, error)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request: Request, error: RequestValidationError):
        advice = {
            'lat_deg': 'Latitude must be a number from \u221290 to 90.',
            'lon_deg': 'Longitude must be a finite number.',
            'name': 'Name must be text of at most 120 characters.',
            'body': 'Send a JSON object with latitude, longitude and an optional name. Only these fields are allowed.',
        }
        fields = []
        for issue in error.errors():
            location = issue.get('loc', ())
            field = location[1] if len(location) > 1 and location[1] in advice else 'body'
            message = 'Latitude must be at least 0.001\u00b0 away from a pole.' if issue['type'] == 'pole_proximity' else advice[field]
            detail = {'field': field, 'message': message}
            if detail not in fields:
                fields.append(detail)
        return JSONResponse({'code': 'invalid_request', 'message': 'Please check the request fields.', 'fields': fields}, status_code=422)

    @app.middleware("http")
    async def refuse_traversal(request: Request, call_next):  # type: ignore[no-untyped-def]
        raw = request.scope.get("raw_path", b"").decode("latin-1", "replace")
        path = request.scope.get("path", "")
        if unsafe(raw) or unsafe(path):
            if path.startswith("/api"):
                return _json_missing()
            return _plain_missing()
        return await call_next(request)

    app.add_middleware(CustomBodyLimit)

    @app.get("/api/health")
    def health() -> JSONResponse:
        report = health_report(derived_root, prepared_root)
        report['custom_cache'] = {'size_bytes': service.budget.size(), 'limit_bytes': service.budget.limit_bytes}
        return JSONResponse(report, headers={"Cache-Control": "no-store"})

    @app.post('/api/sites/custom', response_model=CustomSiteQueued)
    def submit(request: Request, body: CustomSiteRequest):
        try:
            return service.submit(body, request.client.host if request.client else 'unknown')
        except Rejected as error:
            headers = {'Retry-After': str(error.retry)} if error.retry else {}
            return JSONResponse({'code': error.code, 'message': error.message}, status_code=error.status, headers=headers)

    @app.get('/api/sites/custom/{identity}', response_model=CustomSiteStatus)
    def custom_status(identity: str):
        state = service.status(identity)
        return state if state else JSONResponse({'code': 'not_ready', 'message': START}, status_code=404)

    @app.api_route('/api/custom/{identity}/{rest:path}', methods=['GET', 'HEAD'])
    def custom_files(request: Request, identity: str, rest: str):
        if service.cached(identity) is None:
            return JSONResponse({'code': 'not_ready', 'message': START}, status_code=404)
        if rest not in ('meta.json', 'series.bin', 'skyline.bin', 'terrain.bin'):
            return _json_missing()
        found = safe_file(cache_root, identity + '/' + rest)
        return file_response(found, DATA_CACHE, request.headers) if found else _json_missing()

    @app.api_route("/api/{rest:path}", methods=API_METHODS)
    def unknown_api(rest: str) -> JSONResponse:
        return _json_missing()

    @app.api_route("/data", methods=["GET", "HEAD"])
    @app.api_route("/data/{rest:path}", methods=["GET", "HEAD"])
    def derived_files(request: Request, rest: str = "") -> Response:
        return _serve_data(derived_root, rest, request.headers)

    @app.api_route("/", methods=["GET", "HEAD"])
    @app.api_route("/{rest:path}", methods=["GET", "HEAD"])
    def frontend(request: Request, rest: str = "") -> Response:
        if rest == "api" or rest.startswith("api/"):
            return _json_missing()
        if rest == "data" or rest.startswith("data/"):
            return _plain_missing()
        return _serve_web(web_root, rest, request.headers)

    return app


app = create_app()
