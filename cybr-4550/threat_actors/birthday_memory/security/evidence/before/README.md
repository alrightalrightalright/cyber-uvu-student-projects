# Original application baseline

Captured September 21, 2026 against the user's own fork and local containers. Source commit: `849911eff1503f1aa25aa4a6fa3baa57b29ba41b`. The original application source, dependency lockfiles, and configuration are recoverable from that commit and were not modified during these tests.

## Safety adjustments

The database port was overridden to `127.0.0.1:5544:5432`; the original Compose file publishes `5544:5432` without a host IP. A Node preload wrapper restricted the original API listener to `127.0.0.1:4000` without editing the application source. Vite was started with `--host 127.0.0.1` on port 5173. See `listeners.json` and `compose-ps.json`. These adjustments mean this assessment does **not** prove reachability from another machine.

The seed data consists of fictional numbered `Testperson` records with reserved `.test` email addresses and fictional 555-01xx telephone numbers. The upstream seed script was not executed. No real personal records were used.

## Evidence index

- `http-transcripts.json` and `.txt`: timestamped actual requests and responses, including seed creation, anonymous CRUD, ignored page limit, permissive CORS, input-type behavior, and a negative SQL-injection probe.
- `summary.json`: concise results derived from those transcripts.
- `app-before.png` and `app-before-capture.json`: genuine Playwright screenshot of the original running UI and capture metadata. No login was performed. The screenshot was not edited.
- `database-posture.txt`: actual application role attributes, TLS setting, public tables, and record count.
- `database-processes.txt`: the PostgreSQL server runs as `postgres`; a default `docker exec` shell runs as root. Do not claim that PostgreSQL's main process is root.
- `health-db-offline.json`: actual 503 health response when only the lab database was temporarily stopped. The database was restarted afterward.
- `container-host-config.json`: original runtime defaults with the loopback safety override.
- `image-digest.json`: immutable identity of the baseline image actually used.
- `postgres-trivy.json`: Trivy 0.74.0 scan of that image; scanner findings have not been individually exploited or proven reachable.
- `*-npm-audit.json`: audit results for the original lockfiles; all three report zero advisories at capture time. Zero advisories does not establish that the application is secure.
- `environment.txt`: capture date, Node version, and Docker client/engine versions.

The baseline password was the upstream disposable lab default and was used only for this loopback lab. It must not be reused in the hardened deployment. The baseline container will be stopped after evidence capture. Historical example credentials remain visible in upstream Git history; that is distinct from exposing new live credentials.

## Limitations

The single SQL-injection query returned zero rows and did not alter the database. This supports only the tested negative case, together with the source review of parameterized queries. The baseline's 125 successful seed writes are a bounded functional test, not a volumetric denial-of-service test. No other host, repository, or service was attacked.
