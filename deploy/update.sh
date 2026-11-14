#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
dc() { docker compose -f compose.prod.yaml "$@"; }
echo 'Using the configured local image; pull it first if using a registry.'
dc up -d --no-build
id=$(dc ps -q truesouth)
i=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$id")" = healthy ]; do
  i=$((i + 1)); [ "$i" -lt 60 ] || { echo 'App did not become healthy' >&2; exit 1; }; sleep 2
done
echo 'App health:'
dc exec -T truesouth python -c "import urllib.request; print(urllib.request.urlopen('http://127.0.0.1:8080/api/health').read().decode())"
