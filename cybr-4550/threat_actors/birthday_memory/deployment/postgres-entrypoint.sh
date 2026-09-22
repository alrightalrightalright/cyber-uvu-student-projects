#!/bin/sh
set -eu
umask 077
mkdir -p /tmp/tls
cp /run/secrets/db_tls_cert /tmp/tls/server.crt
cp /run/secrets/db_tls_key /tmp/tls/server.key
chmod 600 /tmp/tls/server.key
exec /usr/local/bin/docker-entrypoint.sh "$@"
