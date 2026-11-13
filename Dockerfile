# Catalog-only TrueSouth.
# Node builds the web app. uv installs truesouth-api from uv.lock.
# The final image serves that app, the API, and data/derived on port 8080.
# The science package is not installed: this server does not run the pipeline.

FROM node:22-bookworm-slim AS web
WORKDIR /src/web
ENV CI=true
ENV COREPACK_ENABLE_DOWNLOAD_PROMPT=0
COPY web/package.json web/pnpm-lock.yaml ./
RUN npm install -g pnpm@11.10.0 --fetch-timeout=600000 --fetch-retries=5 \
    && pnpm config set fetch-timeout 600000 \
    && pnpm config set fetch-retries 5 \
    && pnpm config set network-concurrency 4 \
    && i=0 \
    && until pnpm install --frozen-lockfile; do \
         i=$((i+1)); \
         if [ "$i" -ge 4 ]; then exit 1; fi; \
         echo "pnpm install attempt $i failed, retrying"; \
         sleep 5; \
       done
COPY web/ ./
RUN pnpm build

FROM ghcr.io/astral-sh/uv:0.11.6 AS uvbin

FROM python:3.12-slim-bookworm AS python
COPY --from=uvbin /uv /usr/local/bin/uv
WORKDIR /app
COPY pyproject.toml uv.lock ./
COPY api/pyproject.toml api/pyproject.toml
COPY api/src api/src
COPY science/pyproject.toml science/pyproject.toml
ENV UV_LINK_MODE=copy \
    UV_NO_MANAGED_PYTHON=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_HTTP_TIMEOUT=600
RUN uv sync --frozen --no-dev --no-editable --package truesouth-api \
    --no-managed-python --python /usr/local/bin/python3

FROM python:3.12-slim-bookworm
RUN useradd --uid 10001 --create-home --shell /usr/sbin/nologin truesouth
WORKDIR /app
COPY --from=python --chown=truesouth:truesouth /app/.venv /app/.venv
COPY --from=web --chown=truesouth:truesouth /src/web/dist /app/web/dist
COPY --chown=truesouth:truesouth data/derived /app/data/derived
ENV PATH="/app/.venv/bin:$PATH" \
    VIRTUAL_ENV=/app/.venv \
    TRUESOUTH_DERIVED=/app/data/derived \
    TRUESOUTH_PREPARED=/app/data/prepared \
    TRUESOUTH_WEB_DIST=/app/web/dist \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1
USER truesouth
EXPOSE 8080
HEALTHCHECK --interval=5s --timeout=3s --start-period=10s --retries=6 \
    CMD ["python", "-c", "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8080/api/health')"]
CMD ["uvicorn", "truesouth_api.main:app", "--host", "0.0.0.0", "--port", "8080"]
