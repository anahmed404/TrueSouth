#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || { echo 'Create .env first' >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a
: "${TRUESOUTH_DOMAIN:?Set TRUESOUTH_DOMAIN}"
dc() { docker compose -f compose.prod.yaml "$@"; }
echo 'Using the configured local image; pull it first if using a registry.'
dc up -d --no-build
id=$(dc ps -q truesouth)
i=0
until [ "$(docker inspect -f '{{.State.Health.Status}}' "$id")" = healthy ]; do
  i=$((i + 1)); [ "$i" -lt 60 ] || { echo 'App did not become healthy' >&2; exit 1; }; sleep 2
done
echo 'Reloading nginx and checking HTTPS through the proxy'
dc exec -T nginx nginx -s reload
dc exec -T -e TRUESOUTH_DOMAIN="$TRUESOUTH_DOMAIN" truesouth python -c '
import http.client, os, socket, ssl
name = os.environ["TRUESOUTH_DOMAIN"]
connection = http.client.HTTPSConnection(name, timeout=10)
connection.sock = ssl.create_default_context().wrap_socket(socket.create_connection(("nginx", 443), timeout=10), server_hostname=name)
connection.request("GET", "/api/health", headers={"Host": name})
response = connection.getresponse()
body = response.read().decode()
if response.status != 200:
    raise SystemExit(f"Proxied health check failed: HTTP {response.status}: {body}")
print(body)
'
