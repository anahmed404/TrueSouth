#!/bin/sh
set -eu
case "$TRUESOUTH_DOMAIN" in ''|*[!a-zA-Z0-9.-]*|.*|*..*|*.) echo "Invalid domain" >&2; exit 1;; esac
export TRUESOUTH_DOMAIN
envsubst '${TRUESOUTH_DOMAIN}' < /opt/truesouth/http.conf > /etc/nginx/conf.d/default.conf
if [ -s "/etc/letsencrypt/live/$TRUESOUTH_DOMAIN/fullchain.pem" ] && [ -s "/etc/letsencrypt/live/$TRUESOUTH_DOMAIN/privkey.pem" ]; then
  envsubst '${TRUESOUTH_DOMAIN}' < /opt/truesouth/tls.conf >> /etc/nginx/conf.d/default.conf
fi
nginx -t
# Reload renewed certificates periodically. Restart nginx after first issuance.
(while sleep 6h; do nginx -s reload || echo 'nginx reload failed' >&2; done) &
exec nginx -g 'daemon off;'
