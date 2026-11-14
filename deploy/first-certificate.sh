#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
[ -f .env ] || { echo 'Create .env first' >&2; exit 1; }
set -a
# shellcheck disable=SC1091
. ./.env
set +a
: "${TRUESOUTH_DOMAIN:?Set TRUESOUTH_DOMAIN}"
staging=''
case "${1:-}" in --staging) staging=--staging;; '') :;; *) echo 'Usage: first-certificate.sh [--staging]' >&2; exit 1;; esac
dc() { docker compose -f compose.prod.yaml "$@"; }
image=${TRUESOUTH_IMAGE:-truesouth:custom}
if ! docker image inspect "$image" >/dev/null 2>&1; then
  echo "Image $image is missing; build, pull or load it before requesting a certificate." >&2
  exit 1
fi
echo 'Starting the app and HTTP challenge server'
dc up -d --no-build truesouth nginx
# Keep the staging and production lineages separate, so staging never blocks issuance.
name="$TRUESOUTH_DOMAIN"
[ -z "$staging" ] || name="$TRUESOUTH_DOMAIN-staging"
set -- certonly --webroot -w /var/www/acme --non-interactive --agree-tos --keep-until-expiring --cert-name "$name" -d "$TRUESOUTH_DOMAIN"
if [ -n "${LETSENCRYPT_EMAIL:-}" ]; then set -- "$@" --email "$LETSENCRYPT_EMAIL"; else set -- "$@" --register-unsafely-without-email; fi
if [ -n "$staging" ]; then set -- "$@" "$staging"; fi
echo 'Requesting certificate'
dc run --rm --no-deps --entrypoint certbot certbot "$@"
if [ -z "$staging" ]; then echo 'Enabling HTTPS'; dc restart nginx; fi
dc up -d certbot
