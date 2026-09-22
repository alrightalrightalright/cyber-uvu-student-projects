# Operation Candlelight

Birthday Memory: application security assessment and remediation

Bryan GurrCYBR-4550 - M5: Exploring Bad CodeTrack B - Application Security

September 21, 2026 (Mountain Daylight Time)Version 1.0Classification: PUBLIC - synthetic lab data only

Assessment boundary: my own fork, localhost/127.0.0.1 and locally owned Docker containers. No public vulnerable deployment or third-party testing.

Release opinion: suitable for a controlled local demonstration; no public production release until the operating controls in this report are verified.

Fork: alrightalrightalright/cyber-uvu-student-projectsBranch: security-hardening-appsecProject: cybr-4550/threat_actors/birthday_memory

Baseline: 849911e | Pre-remediation threat model: c146613Implemented application: fc41f5b; subsequent evidence and documentation commits preserve the tested behavior.

# Executive summary

The original Birthday Memory application exposed its main functions without requiring a user to sign in. In a controlled local test, an anonymous caller could read the birthday list, change a record and delete a record. A request for ten records returned all 125 synthetic records. If the original application were made reachable with real personal information, a caller could copy contact details or damage the entire list without stealing a password.

The revised application requires login and gives each account its own private list. Tests confirmed that the owner can create, read, update and delete a birthday, while a second account cannot access that record. Database connections now verify an encrypted connection, and the application uses a limited database account rather than an administrative account. Record changes produce durable audit events. Input checks, request limits, smaller responses and restricted containers reduce additional opportunities for misuse.

Verification includes 23 passing API/database test groups, real browser checks and an encrypted backup restored into a separate test database. A deliberately weakened copy failed the ownership test, showing that the test can detect that regression. The original database image had 46 scanner advisory records; the hardened database image had none on the same vulnerability database snapshot. The final application image also had none after an unused build utility was removed. These counts describe scanner results, not proven attacks or a guarantee that the software is safe.

The local demonstration is ready, but the public-release decision is no-ship. The browser still uses HTTP restricted to this computer. Host disk encryption has been specified but not verified, backup keys remain on the lab host, and account recovery, central audit retention and operational monitoring need additional work. A host administrator or a fully compromised application remains a powerful threat.

The next investment should verify trusted browser HTTPS, encrypted storage and separate recovery-key custody, then establish account and monitoring procedures. Those operating controls matter more than cosmetic changes or a clean scanner summary. All assessment data was fictional; this work did not identify a real personal-data breach.

# Contents

Section | Page
--- | ---
Executive summary | 2
Scope, method and evidence boundaries | 4
Architecture and trust boundaries | 5
Assets and STRIDE analysis | 6
Risk method and prioritized findings | 7
F1: identity and private records | 8
F2: database trust and permissions | 9
F3: input and browser defenses | 10
F4: bounded work and error handling | 11
F5: accountable changes | 12
F6: containers and software inventory | 13
F7: storage and recoverability | 14
Verification and negative results | 15
Conditional legal and regulatory analysis | 16
Roadmap and effort estimates | 17
Ship/no-ship opinion | 18
Appendix A: original and login screenshots | 19
Appendix B: private-list screenshots | 20
Appendix C: raw evidence extracts | 21
Appendix D: sources and evidence index | 22-23
Appendix E: AI disclosure and defense plan | 24

The main report is 18 pages including cover and contents (15 substantive pages excluding those and the executive summary). Appendices occupy pages 19-24. Evidence paths are relative to the Birthday Memory project unless stated otherwise.

# Scope, method and evidence boundaries

## Authorized scope

Testing covered the local copy of the user-owned fork and its Birthday Memory React client, Express API and PostgreSQL database. Only synthetic names, reserved example.test addresses and fictional phone numbers were used. The original repository includes unrelated coursework; those folders were not assessed or changed. The selected policy is explicit: every account manages only its own birthdays.

## Sequence and tools

The original code was preserved at 849911e. Baseline evidence was committed as ff54a7e. A data-flow diagram, STRIDE analysis, asset inventory and roadmap were committed at c146613 before API changes. Remediation then proceeded from authentication/ownership to database restrictions, browser and request controls, containers, recovery and regression testing. Docker was cleanly reinstalled at the user's request before the lab.

Tool / environment | Purpose
--- | ---
Node.js 24.19.0; React/Express; PostgreSQL 16 Alpine | Run original and revised application
Docker Desktop 4.92.0; Engine 29.8.0; WSL2 | Owned local container environment
Node assertions, HTTP fetch, PostgreSQL queries | Repeatable positive and negative security tests
Playwright with installed Microsoft Edge | Real browser workflows and original screenshots
Trivy 0.74.0; npm audit; CycloneDX | Date-specific image/dependency inventory and advisory checks
Git history review; exact secret-content scan | Traceability and active-secret exposure check

The baseline API and database were constrained to loopback with an explicit safety harness/Compose override. The original network configuration was reviewed, but reachability from another computer was not tested. This matters: findings establish missing application controls, not internet exposure of this host.

Raw transcripts, source references, container inspection, screenshot metadata and scanner output are preserved separately. Some final evidence uses September 22 UTC timestamps, which are still September 21 in the local Mountain time zone. No sustained denial-of-service, credential attack against outsiders or individual image-CVE exploitation was performed.

# Architecture and trust boundaries

The original design passed browser requests directly to unauthenticated CRUD routes and then to an overprivileged database connection. The proposed design was written before implementation. Figure 1 shows the resulting local trust boundaries; the full original/proposed Mermaid diagrams remain in security/threat-model.md.

Figure 1. Implemented local data flow. The browser link is HTTP on loopback; the application-to-database link verifies TLS.

## Where decisions are enforced

The server trusts its session store for the authenticated account, never an owner ID in the request body. Every birthday read and write includes the session owner in its SQL predicate. The database checks a separate runtime login over a private Docker network. It grants table operations without schema or role administration.

The trusted operator controls secret files, initial account creation, the private CA and backups. Only the application web port is published, on 127.0.0.1. PostgreSQL is reachable by the app on the internal database network and by the operator through its container. A Docker administrator is inside the trusted boundary, not a user whom non-root containers can reliably exclude.

The audit table shares the database volume but has separate grants. A normal mutation and its audit insert commit together. Backups leave that boundary only after encryption. The same-host key location is an explicit lab limitation; production custody must be separate.

# Assets and STRIDE analysis

Asset | Business consequence of loss or misuse
--- | ---
Names, birthdates, phone/email | Privacy loss, targeted scams and loss of confidence in record accuracy
Password hashes and active sessions | Account compromise; sessions are access credentials even with fictional records
DB passwords, CA/server keys, backup key | Bypass of application or storage protections
Audit events and backups | Loss of accountability or ability to recover
Source, image identity and lockfiles | Unreviewed changes or vulnerable supply-chain components

STRIDE is applied by boundary rather than treating every package advisory as an application exploit. Table 1 summarizes the pre-remediation model and where implementation addresses it.

Boundary | STRIDE threats | Control / remaining trust
--- | --- | ---
Client to API | Spoofing, tampering, disclosure, repudiation, DoS, elevation | Login, owner predicates, CSRF, bounds and audit; account compromise still matters
API to DB | Spoofed endpoint, excessive privileges, data tampering/disclosure | Verified TLS and minimal role; full app compromise still reaches permitted data
Container to host | Elevation, tampering, resource exhaustion | Non-root, read-only root, dropped capabilities and limits; host admin trusted
Secrets/storage/operator | Disclosure, tampering, recovery failure, repudiation | Restricted files and encrypted backups; disk encryption/key separation still release gates

Table 1. Condensed STRIDE coverage; the committed threat model contains the full boundary analysis.

Names and contact details would be personal information in a real deployment. Passwords are hashed; contact records are not field-encrypted. Audit events avoid copying contact fields, reducing both exposure and retention burden. Screenshots and transcripts use only fictional records, and active cookies/CSRF tokens are excluded from public evidence.

An attacker with only HTTP access should be stopped at authentication or ownership checks. An attacker who gains the runtime DB credential has broader table access than one user because optional row-level security was not implemented. This distinction drives the residual-risk decision.

# Risk method and prioritized findings

The matrix uses likelihood and impact on a 1-5 ordinal scale. Likelihood 1 means a difficult or uncommon prerequisite; 5 means a direct, repeatable intended-interface action if reachable. Impact 1 is minor inconvenience; 5 is broad disclosure or destructive control over the data. Products 1-4 are low, 5-9 moderate, 10-16 high, and 17-25 critical. These are analyst judgments, not measured probabilities or financial losses.

ID / issue | Before L x I | After L x I | Priority
--- | --- | --- | ---
F1 Anonymous read/change/delete; no owner policy | 5 x 5 = 25 | 2 x 5 = 10 | Critical
F2 Default secret, superuser app role, DB TLS off | 4 x 5 = 20 | 2 x 5 = 10 | Critical
F3 Loose validation and broad browser-origin policy | 4 x 3 = 12 | 2 x 3 = 6 | High
F4 Unbounded lists, absent throttling, health leak | 4 x 3 = 12 | 2 x 3 = 6 | High
F5 No durable actor-linked audit trail | 3 x 4 = 12 | 2 x 4 = 8 | High
F6 Container defaults and advisory-bearing utilities | 3 x 4 = 12 | 2 x 4 = 8 | High
F7 Storage/recovery controls not established | 3 x 5 = 15 | 3 x 5 = 15 | High / open

Matrix 1 places the original findings by likelihood and impact. After ratings describe future real-data use, not the harmlessness of this lab. F7 remains high because storage and off-host recovery are unverified. F1/F2 retain high impact despite reduced likelihood.

## Technical severity versus business risk

For F1, an illustrative CVSS v3.1 base vector is AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N, score 9.1 (critical). It models confidentiality/integrity loss through a reachable service without credentials; it deliberately does not claim a demonstrated service outage. Local loopback restriction changes exposure, not the missing check. The remaining findings use the matrix because environmental controls and grouped weaknesses do not map cleanly to a single CVSS vulnerability. FIRST separates technical scoring from organization-specific risk [5].

# F1: identity and private records

Finding: the baseline had no account concept or ownership column. Anonymous update returned 200 and deletion returned 204. An unauthenticated list response exposed all 125 seeded records. This is a confirmed control failure, not a scanner inference. Figure 2 in Appendix A shows the original UI without any login.

## Implementation and authentication choice

The app now uses express-session with connect-pg-simple rather than a self-designed token format. The browser receives a signed opaque session identifier; user identity and expiry information stay server-side. Password verification uses Argon2id with 19,456 KiB memory, two iterations and parallelism one, matching the selected OWASP minimum configuration [1]. The lab creates random initial credentials for two synthetic accounts.

Sessions suit one browser application and give logout a clear server-side revocation action. JWTs would add refresh/revocation and key-management decisions without a distributed-service requirement. API keys would make individual browser login and logout less natural. The cost is a database lookup/store dependency and a session table that must be protected.

Login regenerates the session identifier. Cookies are HttpOnly and SameSite=Strict. An idle timeout of 15 minutes limits exposure on unattended machines, while an absolute eight-hour limit prevents endless extension. These are project risk/usability choices; they are not claimed as universal compliance thresholds. Both are enforced on the server and tested with an injected clock [2,3].

## Authorization and proof

server/src/app.js requires a session on birthday routes. server/src/routes.js applies owner_id from that session to list, upcoming, update and delete SQL. Creation assigns the owner from the session, and strict schemas reject a client-supplied owner field. Other-user and nonexistent IDs both return 404, reducing record-existence disclosure.

Tests confirm anonymous CRUD is rejected with 401, Alice can perform legitimate CRUD, and Bob cannot list, modify or delete Alice's record. A temporary mutation removed the list owner predicate; the ordinary two-user test failed as expected. Figures 4 and 5 show independent browser accounts. Logout and idle/absolute expiry invalidate access.

Residual: there is no MFA or self-service recovery. Disabling an account requires deleting its active sessions. A full application compromise can bypass application-level ownership because DB row-level security is not implemented.

# F2: database trust and permissions

Finding: the baseline application used a publicly documented disposable password and a role with superuser, database-creation and role-creation flags. PostgreSQL reported TLS off. Original Compose published a database port; the lab safety override restricted it to loopback. These observations establish weak configuration, not an external compromise.

## Secret separation and least privilege

Setup generates unique 256-bit random secrets in an ignored local directory. Compose mounts them as files; source, environment examples and image layers contain no newly generated credentials. The runtime requires secret-file paths and has no hardcoded fallback. Historical public examples remain in Git history. The scoped history/working-file check found no exact matches for active passwords, session keys or private-key content; it is not a universal secret detector.

The database administrator owns schema and migrations. birthday_app can read account hashes, manage birthdays/sessions and append audit events, with only needed sequence usage. It cannot create tables/roles, change users, or read/update/delete audit events. Six denied operations returned SQLSTATE 42501, while ordinary authorized API writes worked. The runtime does not create schema at startup.

## Encrypted and authenticated database transport

The app loads the local CA and uses rejectUnauthorized=true with the postgres DNS name. The leaf certificate includes that DNS SAN. PostgreSQL rejects plaintext TCP and accepts the runtime role through TLS/SCRAM on the internal network. A valid connection reported TLSv1.3; connections without the trusted lab CA and with TLS disabled were rejected. Certificate verification is never globally disabled. PostgreSQL and node-postgres documentation explain the distinct roles of encryption, trust and configuration [4,6].

The DB service has no host-published port. A certificate private key is copied from its read-only secret mount into an owner-only temporary directory because PostgreSQL enforces key permissions. The CA signing key stays on the host and is not a runtime secret.

Residual and rotation: Compose secrets are file mounts, not a managed vault. Host/Docker administrators remain trusted, and Unix-socket administrative access is trusted inside the DB container. The runbook coordinates password changes with file replacement and app restart, invalidates sessions when rotating their key, and renews the 90-day DB certificate. Those procedures are specified; a full rotation drill was not performed.

# F3: input and browser defenses

Finding: the original API accepted a wrong input type and an unknown owner field with 201, and it returned wildcard CORS. Those are confirmed behaviors. The assessment does not claim that wildcard CORS by itself bypasses authentication or that the original app had exploitable stored XSS.

Control | Implemented behavior and reason
--- | ---
Strict request schemas | Names are strings with length/control-character bounds; dates must be real and within policy; contact fields have limits; unknown fields rejected
Output handling | Store data as text; React text interpolation encodes it at rendering; no dangerous HTML sink introduced
Exact CORS allowlist | Only the two explicit local origins receive credentialed CORS; a disallowed Origin receives 403
CSRF protection | Mutation requests need a session-bound unpredictable token; sign-in is protected and rotates the token/session
CSP and framing | Helmet policy restricts scripts to same origin, blocks objects and sets frame-ancestors none
Other response headers | nosniff blocks content-type guessing; no-store reduces private response caching; x-powered-by removed

Tests rejected a number in a name field, forged owner_id, an impossible leap-day date, an 81-character name and invalid contact values. A valid birthday continued to save. A missing, forged or non-ASCII CSRF token received 403 rather than an internal comparison error. Allowed-origin reads succeeded; untrusted-origin reads failed.

The browser test stored a small img/onerror string as a synthetic name. The UI rendered the characters literally, created no img element with an event handler and did not set the test marker. Figure 6 documents this negative result. SQL values remain parameterized; the literal injection-search probe returned no rows before and after. Neither test establishes that every possible injection is impossible.

CORS governs cooperating browsers; it does not replace login for scripts or command-line clients. SameSite and CSRF protections complement each other. CSP permits inline styles for the existing visual design, which is a narrower defense than a fully strict style policy. HSTS and Secure cookies are disabled in the explicit loopback HTTP mode and enabled/configured for the production HTTPS path, which remains unvalidated here.

# F4: bounded work and error handling

Finding: asking for limit=10 returned 125 records in the original app. Source review found no request throttling. The bounded baseline seed sequence succeeded, but it was not a denial-of-service test. Separately, stopping the original DB caused the health route to reveal an internal address and port in its response.

## Work limits and normal use

List and upcoming endpoints now return explicit pages: 25 rows by default and no more than 50. SQL applies LIMIT and OFFSET after owner filtering; upcoming dates are calculated in SQL before the cap, including February 29 handling. A request for 51 is rejected rather than silently ignored. The UI labels its page and makes clear that search, calendar and statistics describe the displayed records.

Boundary | Limit / rationale
--- | ---
All API requests | 180 per minute per IP, to cap aggregate request churn
Birthday reads / writes | 120 reads and 60 mutations per minute per IP
Sign-in | 10 attempts per minute per IP; at most two active password hashes
Payload and database | 8 KiB JSON body; pool maximum 10; five-second statement timeout and six-second query timeout
Container resources | One CPU each; app 256 MiB, DB 512 MiB; PID limit 100

Four controlled requests at a test threshold of three produced 429 for reads, writes and sign-in. This checks limiter behavior without a flood; production values remain those above. Pagination was checked with more than one page of fake records, nonoverlapping page IDs and a capped upcoming response. Owner operations still succeeded below the thresholds.

## Errors and operational visibility

Client responses are generic: malformed/oversized requests use 400/413, internal failures use 500 with a request ID, and a failed DB health check uses 503 unavailable. Server logs retain a request ID, error code/type and stack frames without request bodies, SQL detail fields, passwords or cookies. An injected audit failure returned a generic error and rolled back its data change.

Residual: limiters are per-process memory stores and reset on restart. Shared IPs can affect legitimate users, while distributed callers can evade a per-IP budget. Limits, timeouts and container caps reduce cost; no sustained-load resilience claim is made. Future multi-instance deployment needs a shared limiter and capacity testing.

# F5: accountable changes

Finding: the original public schema had only the birthday table. It lacked a durable application-level record connecting each create, update or delete to an authenticated actor. This makes disputed changes harder to investigate and restore accurately.

## Transaction design

A normal mutation starts a database transaction, changes only an owner-matching row, then appends an audit event. The event contains actor_id, action, target_id, occurred_at and request_id. The record change and audit insert commit together. On failure, the transaction rolls back. Contact values, passwords and session tokens are excluded from audit payloads.

Observed event for target 1 | UTC timestamp | Actor
--- | --- | ---
create | 2026-09-21 19:37:55.790905 | 1
update | 2026-09-21 19:37:55.866809 | 1
delete | 2026-09-21 19:37:56.587534 | 1

Table 2. Actual administrative query of the API-generated audit records. Full request UUIDs are preserved in the evidence files.

The app role can insert audit records but cannot select, update or delete them. The administrative query in Table 2 showed all three events, including deletion after the birthday row was gone. A restart comparison found identical audit rows, and the app recovered its DB connection without being restarted. The stored volume, not container memory, carries the audit trail.

The regression suite also injects an audit-insert failure. The API returns 500 and a follow-up search finds no newly created birthday. This tests the property that a normal user-facing write does not silently succeed without its audit event.

## Limits of accountability

This design resists an ordinary client and prevents the runtime role from rewriting existing audit entries. It does not make the database tamper-proof: a superuser can alter the table, and a fully compromised app can issue permitted birthday SQL without calling its audit wrapper. A production design should evaluate database-side auditing and an independently controlled append-only destination, with alerts and retention.

The automated fixture cleanup uses direct database access and is labeled as test cleanup, not a user action. One interrupted test left synthetic rows that were explicitly removed and recorded. That distinction avoids pretending every administrative lab operation passed through the application audit flow.

# F6: containers and software inventory

The original app did not have a deployed application container to scan. The database container provided the actual before/after image comparison. Its server process already ran as postgres; a default exec shell being root is not evidence that the database process was root.

Image / snapshot | Critical | High | Medium | Low / other
--- | --- | --- | --- | ---
Original PostgreSQL base | 1 | 21 | 21 | 2 / 1
Hardened PostgreSQL | 0 | 0 | 0 | 0 / 0
Initial hardened app build | 0 | 4 | 5 | 0 / 0
Final hardened app image | 0 | 0 | 0 | 0 / 0

Table 3. Trivy advisory-record counts. The app rows compare two implementation builds, not an invented original app container.

The 46 PostgreSQL records were in the unused gosu privilege-switching helper and its embedded dependencies. The hardened image always starts as postgres, so the helper was removed. The initial application image had nine records inside bundled npm. npm is required during build but not to execute node in production, so it was removed from the final stage. No individual advisory was exploited or demonstrated reachable through the API.

The app image separates the client build, production dependency installation and final runtime. Base images are pinned by SHA-256 digest. Secret directories, environment files, Git metadata and evidence are excluded from build context. It runs as UID 1000; PostgreSQL runs as UID 70. Runtime inspection confirmed read-only roots, dropped capabilities, no-new-privileges, bounded CPU/memory/PIDs and healthy containers. A write to /app failed with EROFS. Docker documents how multi-stage builds keep build artifacts out of final stages [7].

The final CycloneDX SBOM contains 144 component entries. It supports identifying affected software when a new advisory appears, deciding which image to rebuild and communicating dependency exposure to a reviewer. It is an inventory rather than a security certificate. Original and final root/client/server npm audits each reported zero advisories, despite the original authorization failure.

Limitations: Trivy warned that Alpine 3.24 was missing from its EOL list. Zero matches do not prove comprehensive coverage. Deleted utilities remain in lower base-image layers, although absent from the merged runtime. Digest pinning requires deliberate security updates.

# F7: storage and recoverability

The assignment allows at-rest protection to be implemented or concretely specified. This report uses both: backups are encrypted and tested; live volume/disk protection is specified and remains a release gate. PostgreSQL contact fields and its data volume are plaintext to a process that can access the storage. Password hashing and transport TLS do not change that fact.

## Implemented backup protection

A PostgreSQL custom-format dump is encrypted in memory using AES-256-GCM before an archive reaches disk. The archive has a fresh 12-byte nonce and authentication tag, and the 32-byte key is stored in the restricted secret directory. Sessions are excluded. Windows ACLs restrict secrets and backups to the invoking account, SYSTEM and administrators; this still trusts the host.

The final recovery test authenticated/decrypted the archive, restored it into birthday_restore_check, and compared row counts plus ordered-content checksums for users, birthdays and audit events. It matched one synthetic birthday, two users and 161 accumulated test audit events, then removed the separate restore database. The live database was not overwritten. This validates a logical restore on the same host, not a full disaster-recovery exercise.

## Concrete production storage specification

Before storing real records, identify the host volume holding Docker Desktop's data VHDX. Require BitLocker XTS-AES-256 on that volume and any separate backup disk, with completed encryption/protection status captured using Get-BitLockerVolume. On Linux, use a managed LUKS2-encrypted data volume. Keep recovery keys in a separately controlled vault, test recovery after approval, and verify the actual DB disk rather than only the source folder.

Use daily encrypted backups with proposed 30-day retention, a separate offline/immutable copy and weekly restore checks. Proposed RPO is 24 hours and RTO four hours, subject to a timed whole-host restoration drill. These are targets, not achieved service guarantees. Backup keys must move to separately managed custody; the lab's same-host key placement does not protect against full host compromise.

Define when contact records and audit metadata expire, how deleted records age out of backups and who can restore them. A full restore must recreate restricted grants and an empty session table because the archive excludes ACLs and sessions. The small lab utility buffers at most 64 MiB and is not a production backup platform.

Residual: host encryption status, off-host recovery, key-loss recovery and timed RTO remain unverified. A live administrator or compromised application can still access plaintext records even after disk encryption.

# Verification and negative results

The final automated suite passed 23 of 23 named test groups. Groups contain multiple assertions against the production application code and a real PostgreSQL instance. Tests run in separate local app instances; explicit injections change time or selected thresholds to keep verification bounded. Browser checks additionally exercise the deployed app at 127.0.0.1:4000.

Verification family | Actual result
--- | ---
Identity and ownership | Anonymous CRUD 401; correct login and owner CRUD succeed; cross-user access rejected
Session and CSRF | ID rotates, logout invalidates, idle/absolute expiry reject; bad CSRF 403
Input, CORS, headers, bounds | Invalid payloads rejected; approved origin works; caps and 429 verified
Database and audit | Least-privilege denials, verified TLS, rollback on audit failure, durable deletion entry
Browser | Login gate, UI creation, account isolation, literal markup and logout succeed
Mutation check | Removing ownership only in temporary source causes the real isolation test to fail
Recovery/runtime | Encrypted restore matches; EROFS write denied; audit survives restart; app reconnects

## Evidence that prevented false findings

The SQL injection probe returned no rows in both versions, consistent with parameterized queries. It is recorded as a negative test, not a confirmed vulnerability. The original PostgreSQL process was non-root. npm audits returned zero advisories even before remediation. The scanner's gosu and npm records were not claimed to be remote API exploits. The health endpoint leak was separated from the original generic error middleware.

Browser verification found that the visual background covered the newly placed sign-out button. The UI layout was corrected and the real click test rerun. A Windows PowerShell compatibility problem in ACL setup was also corrected; the final backup creation/restore test passed. These observations are implementation feedback rather than findings against the original application.

The after evidence includes redacted request/response transcripts, named assertions, screenshots with UTC capture metadata, runtime inspection and raw scanner JSON. Appendix C shows selected raw excerpts. It does not include active credentials or claim that a full eight hours elapsed for the injected-clock test. No independent ASVS certification or comprehensive penetration test is claimed.

# Conditional legal and regulatory analysis

This local exercise used fictional information. No actual breach, affected person or notification obligation was identified. Legal applicability in a future deployment depends on the operator, location, people served, scale, data uses and incident facts. The following is a scoped analysis of those conditions, not a finding that all listed rules apply.

Framework | Condition and assessment
--- | ---
GDPR | Article 3 concerns EU establishment or specified offering/monitoring of people in the Union. If applicable, assess Article 32 security and Articles 33/34 risk-based notice duties; the 72-hour supervisory notice rule has an exception and qualifiers. None of the jurisdictional facts is established here. [8]
Utah UCPA | The current cited statute requires Utah business/targeting, at least $25m revenue and specified volume/sale thresholds; it includes higher-education and personal/household exemptions. A student exercise at a Utah university does not establish applicability. [9]
California CCPA/CPRA | Covered-business status depends on California activity, applicable thresholds and other conditions. Names/contact data alone do not establish that status. Review current thresholds and data-sharing practices before launch. [10]
HIPAA | Applies to covered entities/business associates and protected health information in the relevant context. A birthday/contact list is not automatically a HIPAA system; no covered relationship or health-care context is shown. [11]
PCI DSS | Relevant to cardholder/sensitive authentication data or systems that could affect the cardholder environment. No payment flow or such relationship was identified in this project. It is a payment-security standard, not a universal privacy statute. [12]

For a real incident, determine whose information was involved, residence/jurisdiction, exact data elements, access/exfiltration evidence, encryption/key compromise and contractual duties. Preserve logs, contain exposure, involve the responsible privacy/legal owner and assess applicable state breach-notification laws. FTC guidance supports an organized response rather than a blanket notification claim [13].

Security engineering is still appropriate where a particular statute does not apply. Private lists, minimized collection, usable deletion, limited retention and protected recovery copies reduce foreseeable harm. The operator must make actual privacy and retention decisions before accepting real contacts.

# Roadmap and effort estimates

The order follows reachable harm and control dependencies. Estimates below are planning ranges for a small experienced team after this lab, not measured hours already spent. An independent reviewer should refine them against the deployment environment. The original pre-code priorities are preserved in the threat-model commit.

Stage / owner | Action and acceptance evidence | Effort
--- | --- | ---
Completed / developer | Login, owner filters, strict validation, CSRF/CORS, bounded queries, transactional audit; 23-group suite plus browser and mutation checks | Implemented
Completed / operator | Verified DB TLS, limited role, local secrets, isolated DB, hardened images, encrypted logical restore | Implemented
Before real data / platform owner | Trusted browser HTTPS, Secure-cookie and health-check tests; verify encryption of Docker/backup storage and separate recovery-key custody | 1-2 days
Before public release / app owner | Account enrollment/disable/reset procedure; MFA/identity-provider decision; central audit sink, alert ownership and retention | 2-4 days
Before public release / independent reviewer | Review authorization coverage and DB grants; repeat adversarial tests; close release-blocking findings | 1-2 days
Within 30 days / operations | Off-host restore drill, measured RTO/RPO, retention policy, incident contacts and credential/certificate rotation drill | 1-2 days
Before scaling / engineering | Shared rate-limit store, capacity tests, stronger CSP and optional RLS/database auditing; secret/dependency/image CI | 2-5 days

Do not prioritize an optional CI badge above transport, storage and account operations. CI could gate new high/critical image findings and dependency/secret checks, but security attacks should remain inside the authorized local lab. All exceptions need an owner, an expiry date and a documented reason.

The backup procedure has a successful local test; disaster recovery requires separate infrastructure and keys. The certificate has a finite life; pinning an image does not make it permanently current. Track renewal dates and periodically rescan/rebuild approved digests. Treat the report as a dated assessment that must be revisited after meaningful changes.

# Ship / no-ship opinion

Decision: ship the controlled local demonstration; do not ship the supplied Compose configuration as a public service. The evidence supports the intended local private-list policy. It does not support claims about production browser transport, independently protected live storage or a complete account/incident operation.

## What the assessment establishes

Anonymous access and cross-account record misuse are blocked in the tested paths while owner operations remain usable. The database verifies TLS, denies excessive runtime privileges and retains audit events across restart. The normal mutation path fails closed when auditing fails. Container settings reduce privilege and writable surface. The encrypted backup restores accurately in a separate database. A test that survives only because it mirrors the implementation would be weak; here, deliberately removing ownership caused a meaningful failure.

## Largest remaining risk

A host/Docker administrator or fully compromised application can still reach sensitive data and recovery material. Live disk encryption is not verified, backup-key custody is on the same host and database ownership checks remain in the app rather than optional RLS. These trust assumptions are acceptable for fictional local demonstration data, but require explicit review before real PII is collected.

## Release acceptance checklist

The accountable owner should require: trusted browser HTTPS and Secure-cookie proof; evidence of encrypted DB/backup storage and separate recovery keys; tested account disable/reset procedures; central audit monitoring and retention; a timed off-host restore; refreshed scans and independent code/configuration review. The owner must also establish which privacy and contractual duties apply. A clean vulnerability count is not a substitute for these gates.

The practical lesson is that a usable app with zero npm advisories can still expose its whole purpose through missing access control. Fixing identity and ownership first removes the most direct path to harm. The rest of the work makes that fix more defensible, observable and recoverable.

This report is intended to be reviewed and understood by Bryan Gurr before submission. The Canvas track declaration and the oral defense remain student actions. The report does not claim that a declaration, upload or recorded defense has already been completed.

# Appendix A: original and login views

![Figure 2. Original app, no login performed. Captured 2026-09-21 19:15:16 UTC; synthetic baseline data. See Section F1.](evidence/before/app-before.png)

![Figure 3. Revised app presents a sign-in gate to an anonymous browser. Original unedited screenshot; exact timestamp in browser-tests.json.](evidence/after/login-after.png)

# Appendix B: private-list views

![Figure 4. Alice signed in and saved a synthetic birthday through the UI. Screenshot metadata records the actual capture time.](evidence/after/alice-private-list.png)

![Figure 5. Independent Bob session has an empty private list. Alice's birthday is not visible. These views illustrate the cross-account assertions in Section F1.](evidence/after/bob-private-list.png)

# Appendix C: selected raw evidence

Complete machine-readable outputs remain in security/evidence. These extracts are intentionally small; the source files carry the full timestamps, response headers and assertion names.

Source | Recorded output
--- | ---
before/summary.json | unauthenticatedUpdate: 200; unauthenticatedDelete: 204; requestedLimit: 10; actualReturned: 125; corsAllowOrigin: *
after/security-tests.json | passed: 23; total: 23; capturedAt: 2026-09-22T00:38:05.487Z
after/mutation-summary.json | childExitCode: 1; detected: true; failed test: Other user cannot list, change or delete owner record
after/read-only-proof.json | writeDenied: true; code: EROFS
after/backup-restore.json | matched: true; audit_events: 161 rows; birthdays: 1 rows; users: 2 rows

![Figure 6. Stored markup appears as literal name text. The browser test also asserts no img[onerror] element and no execution marker. This is a negative XSS test, not proof against every payload.](evidence/after/literal-text-test.png)

# Appendix D: technical sources

Official sources consulted September 21, 2026 local time. Inline numbers identify supporting references; local observations are supported by the separate evidence files, not by these documentation pages.

[1] OWASP. Password Storage Cheat Sheet.https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html

[2] OWASP. Session Management Cheat Sheet.https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html

[3] Express. express-session middleware documentation.https://expressjs.com/en/resources/middleware/session/

[4] PostgreSQL 16. Secure TCP/IP Connections with SSL.https://www.postgresql.org/docs/16/ssl-tcp.html

[5] FIRST. CVSS v3.1 Specification Document.https://www.first.org/cvss/v3.1/specification-document

[6] node-postgres. SSL connection configuration.https://node-postgres.com/features/ssl

[7] Docker. Multi-stage builds.https://docs.docker.com/build/building/multi-stage/

OWASP ASVS categories informed coverage for authentication, sessions, authorization, communication and logging [14]. This project has not completed the entire ASVS Level 2 verification set. Source guidance does not replace the local tests.

# Appendix D: legal sources and evidence

[8] European Union. Regulation (EU) 2016/679, Articles 3, 32-34.https://eur-lex.europa.eu/eli/reg/2016/679/oj/eng

[9] Utah Code 13-61-102. Applicability; version effective May 1, 2024, superseded January 1, 2027.https://le.utah.gov/xcode/Title13/Chapter61/C13-61-S102_2024050120240501.pdf

[10] California Department of Justice. California Consumer Privacy Act.https://www.oag.ca.gov/privacy/ccpa

[11] U.S. HHS. Covered Entities and Business Associates.https://www.hhs.gov/hipaa/for-professionals/covered-entities/index.html

[12] PCI Security Standards Council. PCI Data Security Standard.https://www.pcisecuritystandards.org/standards/pci-dss/

[13] Federal Trade Commission. Data Breach Response: A Guide for Business.https://www.ftc.gov/business-guidance/resources/data-breach-response-guide-business

[14] OWASP. ASVS 5.0.0, English verification chapters. Used as a coverage reference, not a certification.https://github.com/OWASP/ASVS/tree/v5.0.0/5.0/en

Primary assessment evidence: security/evidence/before contains original transcripts, screenshot, environment, DB posture and Trivy/npm outputs. security/evidence/after contains regression/browser outputs, runtime and audit proof, backup evidence, history check, final scans and app-sbom.cdx.json. security/verification.md maps each claim to those files. The final repository includes the PDF, source report text and operating/defense guides.

# Appendix E: AI disclosure and defense plan

## Assistance and validation

OpenAI Codex assisted with reading the assignment, identifying risks, creating the threat model, writing and revising application/configuration/test code, operating the local lab, collecting evidence and drafting this report. The user selected Track B, private per-user lists, the report name and local browser testing, and authorized a clean Docker reinstall. The student should review and understand the submitted work; AI involvement is not hidden.

Validation used real HTTP/database results, explicit assertions, unedited browser screenshots, an intentionally removed ownership predicate, raw image/dependency scans, Git history checks and a restored encrypted archive. Failed browser interaction and Windows ACL compatibility checks led to changes and reruns. The PDF was rendered for visual inspection. No fabricated screenshots, exploit outcomes, legal applicability, individual CVE exploitation or real-data breach is claimed.

## Suggested 10-15 minute walkthrough

Time | Demonstration / explanation
--- | ---
0:00-2:00 | Explain the original anonymous exposure and its business effect; state local/synthetic scope
2:00-5:00 | Show login, Alice record and Bob isolation; separate authentication middleware from owner SQL
5:00-7:00 | Explain server-side sessions, 15-minute idle/eight-hour absolute expiry and logout
7:00-9:00 | Show TLS/role denials, deletion audit and non-root/read-only container evidence
9:00-11:00 | Run/read the regression suite and mutation result; explain scanner limitations
11:00-13:00 | Show backup recovery proof, history/default distinction and largest residual risk
13:00-15:00 | State conditional legal duties, no-ship gates and AI validation; allow questions

The separate defense-guide.md contains prompts and code locations for rehearsal. The live Canvas directions mention both a Teams Homework-channel recording and a sign-up/scheduling checklist. Confirm the instructor's expectation if those conflict. The student must post their own chosen-track declaration, upload the report and complete their own defense; none is represented as already submitted.
