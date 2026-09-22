# Verification map

Evidence was collected September 21, 2026 Mountain Daylight Time (some final timestamps are September 22 UTC). Original source: `849911e`. Threat model before remediation: `c146613`. Implementation: `fc41f5b`; later documentation/evidence commits do not change the tested API behavior. All data is synthetic.

| Control | Before | After and authorized success | Evidence |
|---|---|---|---|
| Identity and ownership | Anonymous create/list/update/delete succeeded | Anonymous CRUD returns 401; Alice CRUD succeeds; Bob cannot read/change/delete Alice's record | before/summary.json; after/security-tests.json and http-transcripts.json |
| Strict input | Wrong type and forged owner field accepted (201) | Wrong type, unknown owner, impossible date, bad contact fields and long names return 400; valid input 201 | same HTTP evidence |
| Bounded reads | Request limit=10 returned 125 records | limit=10 returns 10 with next-page metadata; limit=51 rejected; upcoming also capped | same HTTP evidence |
| Origin / CSRF | Wildcard CORS, no CSRF controls | Untrusted Origin 403; exact local origin + credential headers; valid owner writes succeed; bad CSRF 403 | same HTTP evidence |
| Errors | Health response disclosed connection address/port when DB stopped | Real stopped database and injected failure both return only 503 unavailable; restart recovers to 200; internal audit failure returns generic 500 | before/health-db-offline.json; after/security-tests.json; after/health-db-offline.json |
| Abuse controls | No limiter in original source; bounded seed requests all succeeded | Four calls at an injected threshold of three reach 429 for reads, writes and login | after/security-tests.json; production defaults remain 120/60/10 per minute |
| SQL injection | Literal probe returned no records | Same class of literal probe returns no records; parameterized queries retained | before/summary.json; after/security-tests.json; negative test only |
| Output encoding | Not established as an original exploitable XSS finding | Stored markup renders as text; browser records no created img handler or execution | after/literal-text-test.png; browser-tests.json |
| DB rights / TLS | App role superuser; TLS off; DB host port published with lab loopback override | App role CRUD works, administrative/audit operations denied; TLS connection succeeds, untrusted CA/plaintext fail; no DB host port | before/database-posture.txt; after/security-tests.json; runtime-posture.json |
| Audit | Original schema has only birthdays | C/U/D event with actor/target/time; audit failure rolls back; deletion event survives restart | after/audit-before-restart.txt, audit-after-restart.txt, audit-persistence.json |
| Containers | Original DB main process already postgres; weaker runtime defaults | App UID1000/DB UID70, read-only root filesystems, limits, dropped capabilities, no-new-privileges, healthy | before/database-processes.txt; after/runtime-posture.json, read-only-proof.json |
| Image inventory | PostgreSQL base: 46 advisory records | Hardened Postgres: 0. Initial app image: 9 in bundled npm; final app: 0. No original app container existed | dated Trivy JSON in before/ and after/ |
| Recovery | No original backup mechanism assessed | AES-256-GCM archive restored in separate DB; counts and content checksums match | after/backup-create.json and backup-restore.json |
| Secrets | Public disposable defaults in current baseline and historical source | Unique local secrets, excluded source/build context; no exact active-secret match in whole-fork working files or all reachable history; Gitleaks general scans also report zero findings | after/secret-history-check.json |

Paths in the table are relative to `security/evidence`. Full response bodies contain only synthetic data. Session cookies and CSRF tokens were omitted/redacted in recorded transcripts. Tests have 23 named groups, containing multiple assertions. Timeouts use an injected clock; limiter tests lower only thresholds in separate app instances. They are not load tests or real eight-hour waiting tests.

## Meaningful regression test

`server/tests/mutation.mjs` removes the list ownership predicate in a temporary source copy. The ordinary two-user test fails and the runner exits 1, as expected. `after/mutation-summary.json` records detection. The normal build passes the suite. No weakened code is deployed.

## Scanner interpretation

Both PostgreSQL scans used Trivy 0.74.0 and the same cached vulnerability database. Baseline severity counts: 1 critical, 21 high, 21 medium, 2 low, 1 unknown. The records belong to the unused gosu helper and its embedded Go dependencies. Removing that helper from a non-root runtime removes those scanner matches; it does not prove all 46 were reachable attacks. The original PostgreSQL process already ran non-root.

The initial app build had 4 high and 5 medium records inside npm's dependency tree. Removing unused npm from the final runtime yielded zero matches. npm remains in build stages. No original app image existed, so the app comparison is initial hardened build versus final hardened build, not an invented baseline container. Original and final root/client/server npm audits each reported zero advisories. CycloneDX SBOM has 144 component entries; its root/component structure is not a count of distinct application libraries.

Trivy warned that Alpine 3.24 was absent from its EOL list. No advisories reported is weaker than proof of full coverage. Base digest pinning also needs periodic refreshes. Lower image layers retain original utilities; this does not contain secrets but matters when interpreting deletion. No individual image CVE was exploited or proven API-reachable.

## Boundaries of proof

The original server was constrained to loopback with a harness before testing. No remote reachability was tested. Host disk encryption, off-host disaster recovery, a production HTTPS deployment, account recovery, MFA, RLS and full ASVS Level 2 compliance were not demonstrated. The at-rest storage specification meets the assignment's specification option, not an implementation claim. Audit writes can be bypassed by a fully compromised app using its existing DB grants; independent database auditing is future work.

The Windows ACL compatibility issue and browser sign-out overlay were corrected during verification. An interrupted synthetic test was cleaned up explicitly; `interrupted-test-cleanup.txt` records the affected row count. Test cleanup uses direct DB access and intentionally is not represented as a user-requested audited API deletion. The deletion-persistence example uses an actual API event for target 1.

## Method and target

The assessment follows scoped OWASP WSTG v4.2 configuration, authentication, authorization, session, input and error testing, combining source/configuration review with baseline probes and repeat verification. The declared target is ASVS 5.0.0 Level 2 because the future service holds private contact data and reusable accounts. This target is not an achieved compliance claim; all applicable L1/L2 controls have not been verified.

## Identical replay cases and limitations

The revised suite reuses BASE-07's exact array-valued name and unknown ownerId body (201 before, 400 after); BASE-05's exact Origin and limit=1 URL (200/* before, 403 after); BASE-02's limit=10&page=1 (125 before, 10 after); and BASE-09's days=366&limit=10 (125 before, 10 after). Authorized operations still succeed. Record-targeted identity probes use equivalent records because UUID IDs became integers. The rate test uses a threshold of three, not production load. Headers and configuration changes use actual response/configuration comparison; there is no invented HTTP exploit for a backup or image setting.

`node security/capture-outage.mjs` stops only the local Compose database, captures the real generic 503, starts it in a finally block and asserts 200 recovery without restarting the app. Its output is after/health-db-offline.json.

Gitleaks 8.30.1 scanned all 13 reachable commits and an export of 752 nonignored whole-fork files, using default rules and full redaction. Raw empty findings arrays and pinned-image metadata are in after/gitleaks-*.json. The independent exact-value scan covers the same whole-fork scope and unique historical blobs. Known original teaching defaults are not active credentials. Neither method is a universal guarantee; screenshots were reviewed separately.

The PDF appendix prints the complete recorded before/after HTTP transcripts and embeds Candlelight-raw-evidence.zip with all raw tools, scans, SBOM and screenshots. Cookies/passwords/CSRF values remain redacted. Report-only preparation instructions remain in the separate defense guide.
