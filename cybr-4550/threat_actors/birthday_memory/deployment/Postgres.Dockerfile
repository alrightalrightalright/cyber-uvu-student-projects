FROM postgres:16-alpine@sha256:721873c34ceb9f8d8fc265984940dc982404c105f19ad51be9fdc5970a6080ea
# The image always starts as postgres; the root-to-postgres helper is unused.
RUN rm /usr/local/bin/gosu
COPY deployment/postgres-entrypoint.sh /usr/local/bin/secure-entrypoint
COPY deployment/pg_hba.conf /etc/postgresql/pg_hba.conf
RUN chmod 755 /usr/local/bin/secure-entrypoint
USER postgres
ENTRYPOINT ["secure-entrypoint"]
CMD ["postgres", "-c", "ssl=on", "-c", "ssl_cert_file=/tmp/tls/server.crt", "-c", "ssl_key_file=/tmp/tls/server.key", "-c", "ssl_min_protocol_version=TLSv1.2", "-c", "hba_file=/etc/postgresql/pg_hba.conf", "-c", "password_encryption=scram-sha-256", "-c", "log_connections=on"]
