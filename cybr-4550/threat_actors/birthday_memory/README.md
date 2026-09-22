# Birthday Memory: Operation Candlelight

**Bryan Gurr · CYBR-4550 · Track B: Application Security**

The original application let an anonymous caller read, change and delete birthday records. This branch adds login and private lists, then verifies the changes with actual database, HTTP and browser tests. It is a local security portfolio project using fictional data.

## Start here

- [Threat model prepared before implementation](security/threat-model.md)
- [Verification map and limitations](security/verification.md)
- [Report PDF](security/Operation-Candlelight-Bryan-Gurr.pdf)
- [Security posture and reporting](SECURITY.md)
- [Operating, backup and rotation procedures](security/operations.md)
- [Oral defense preparation](security/defense-guide.md)

## Run the secured lab

Requirements: Docker Desktop with Linux containers, Node.js 24, npm, Git and OpenSSL. Use this project's directory for all commands. The checked-in image digests and dependency lockfiles make the lab reproducible; scan results remain date-specific. The tested platform is Windows with Docker Desktop/WSL2, Linux amd64 containers and Microsoft Edge.

```sh
git clone --branch security-hardening-appsec https://github.com/alrightalrightalright/cyber-uvu-student-projects.git
cd cyber-uvu-student-projects/cybr-4550/threat_actors/birthday_memory
npm --prefix server ci --ignore-scripts
node deployment/setup.mjs
docker compose up --build -d
```

On Windows with Git for Windows, set `$env:OPENSSL = 'C:\Program Files\Git\usr\bin\openssl.exe'` in PowerShell before setup if OpenSSL is not on PATH. Setup refuses to overwrite an existing `.secrets` directory. It generates unique random passwords, a session key, a backup key and a short-lived lab certificate. It restricts Windows secret-folder access to the invoking account, SYSTEM and administrators (Unix uses restrictive file modes).

Open **http://127.0.0.1:4000**. Read your local `.secrets/demo-users.json` for Alice and Bob's generated login details. Never upload that file. The default Compose publishes only this loopback web port; PostgreSQL has no host port. Stop services with `docker compose down`; omit `-v` to preserve data. These commands initialize a new database; there is deliberately no automatic migration of the original unowned records.

The lab web connection is HTTP, so its cookie does not use `Secure`. PostgreSQL uses verified TLS. Production mode requires HTTPS key/certificate files and sets Secure cookies, but a production HTTPS deployment has not been validated here. Do not expose the provided local Compose configuration publicly.

## Verify

```sh
docker compose -f docker-compose.yml -f deployment/compose.test.yml run --rm tests
docker compose -f docker-compose.yml -f deployment/compose.test.yml run --rm tests node /tests/mutation.mjs
node security/secret-history-check.mjs
node security/capture-outage.mjs
node deployment/backup.mjs create
node deployment/backup.mjs verify-restore
```

The outage script briefly stops and restarts only the local Compose database and asserts generic errors and recovery. Tests use the real PostgreSQL database with synthetic users. They create and remove test birthdays, keep test audit records, and write redacted evidence to `security/evidence/after`. Stop normal use during a test/restore run. The mutation check intentionally removes one ownership filter only in a disposable source copy; success means the normal isolation test fails against that copy. It does not weaken the running app.

For browser checks, install Playwright outside the production dependency set and run `node security/browser-check.cjs`; set `PLAYWRIGHT_MODULE` to its module path if needed. The script uses installed Edge (`BROWSER_CHANNEL` can change that), saves four unedited screenshots and performs real login, UI creation, isolation, literal text rendering and logout. Use synthetic lab accounts only. `security/capture-runtime.ps1` captures container settings and verifies audit persistence and app recovery across a database restart.

## Design decisions

Server-side sessions fit a single browser application and support immediate logout without a token revocation system. Passwords use Argon2id; the runtime cannot create users or grant roles. A 15-minute idle timeout and eight-hour absolute limit constrain session exposure. All birthday queries enforce the session user's owner ID. Unknown records and other users' records share a 404 response.

Requests have an 8 KiB JSON cap. A list returns at most 50 records (25 by default), with explicit pages. The UI's search, calendar and totals describe the current page, which is labeled on screen. Per-IP controls allow 180 API requests, 120 reads, 60 writes and 10 login attempts per minute. These in-memory limits assume one app instance and reset on restart.

Audit inserts and record changes share a transaction. The app can append audit events but cannot read, update or delete them. This protects against ordinary misuse of the runtime role; a compromised application can still bypass its own audit path, and a database/host administrator remains trusted.

## Results and limits

See the [verification map](security/verification.md) for actual results, timestamps and file paths. The report follows scoped OWASP WSTG v4.2 testing and declares ASVS 5.0.0 Level 2 as its target, not achieved certification. Its appendices preserve complete HTTP transcripts and embed all raw evidence. Trivy found no remaining advisories in the final flattened runtime images on the captured database snapshot; this does not prove absence of vulnerabilities. Upstream disposable defaults remain in Git history. New active secrets are generated locally and are excluded from source and builds.

The biggest release gaps are browser HTTPS deployment validation, verified encryption for the host disk containing Docker data, separate backup-key custody, operator-managed account lifecycle, central audit retention and independent security review. The report recommends the lab for demonstration and **no public production release** until those gates are satisfied.

Original project: [hvaandres/cyber-uvu-student-projects](https://github.com/hvaandres/cyber-uvu-student-projects), source commit `849911eff1503f1aa25aa4a6fa3baa57b29ba41b`. AI helped with implementation, testing and drafting; observed evidence, including failed checks and their fixes, is distinguished from specifications and unverified assumptions.
