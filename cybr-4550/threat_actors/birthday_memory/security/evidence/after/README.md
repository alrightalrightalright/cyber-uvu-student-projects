# Hardened evidence index

Captured September 21, 2026 Mountain time; final timestamps extend into September 22 UTC. Implementation code is committed at `fc41f5b`. Documentation, evidence and secret-check coverage were finalized afterward without changing the tested HTTP application behavior.

- `security-tests.json`: 23/23 final test groups passed. `http-transcripts.json` records their requests/responses with credentials, cookies and CSRF tokens omitted/redacted. The harness uses the real database and production code, but injects time and small rate thresholds where labeled.
- `mutation-summary.json` and `mutation/`: the deliberately weakened temporary source copy failed the expected ownership assertion. These intentional failures do not describe the deployed app.
- `browser-tests.json` and four PNGs: real Edge/Playwright login, UI create, account isolation, output encoding and logout checks; screenshots are unedited, with actual capture times in the JSON.
- `runtime-posture.json` and `read-only-proof.json`: actual image IDs, process identities, healthy status, resource settings, port bindings and EROFS denial. `audit-persistence.json` also confirms reconnection after a DB restart without restarting the app.
- `audit-before-restart.txt` and `audit-after-restart.txt`: identical actual C/U/D events for target 1 across a database restart. Source UTC timestamps and actor/action/target/request IDs are preserved.
- `backup-create.json` and `backup-restore.json`: encrypted archive metadata and successful separate-database restore with counts and ordered-content checksums. The archive and keys are private and are not committed. The absolute private archive path in metadata identifies a location, not its contents.
- `postgres-trivy.json`, `app-initial-build-trivy.json`, `app-trivy.json`: full scan outputs. Original PostgreSQL comparison is in `../before/postgres-trivy.json`. The application initial-build scan predates removal of unused npm; there was no original application-container baseline. Final app scan matches the final runtime image.
- `app-sbom.cdx.json`: 144 CycloneDX component entries, including OS/runtime inventory. SBOM generation is separate from vulnerability scanning.
- `root-npm-audit.json`, `client-npm-audit.json`, `server-npm-audit.json`: final lockfile audits with zero reported advisories.
- `secret-history-check.json`: exact generated-password/key checks over nonignored whole-fork files and unique blobs across all reachable history. Historical disposable defaults are listed; history is not claimed to be sanitized.
- `interrupted-test-cleanup.txt`: explicit removal of synthetic fixture leftovers from an interrupted run. Direct fixture cleanup is not an audited application action.

See `../../verification.md` for paired before/after cases and limitations. Vulnerability counts are scanner records, not independently demonstrated reachable exploits. The Trivy Alpine EOL-list warning is disclosed. No real personal data or active session material belongs in this directory.

- `health-db-offline.json`: real database stop, generic 503 and 200 recovery without app restart.
- `gitleaks-history.json`, `gitleaks-working.json`, `gitleaks-summary.json`: general whole-fork/history scans, zero matches, pinned tool identity, scope and limitations.
