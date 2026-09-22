# Operation Candlelight: defense preparation

Bryan Gurr · Track B · Use these as rehearsal notes, not a claim that a defense happened.

## Before recording

Open the report, the project README, `server/src/app.js`, `server/src/routes.js`, `server/src/db.js`, `deployment/schema.sql` and `security/evidence/after`. Start the local app. Keep `.secrets` files off camera: sign in before recording or hide the password entry. Use only synthetic data. Leave enough time to explain a result rather than spending the whole recording scrolling through output.

Canvas mentions a 10-15-minute defense, a Teams video in the Homework channel of `CYBR-4550-X01 | 2026 Fall - Full Term`, and a scheduling/sign-up checklist. Confirm with the instructor if both steps are required. You chose to post the track declaration yourself.

## Explain the work to a CFO

The original app let someone who could reach it copy or alter the whole birthday list without signing in. I added accounts and private lists, then tested that the right person can still use the app and another account cannot touch their records. I also limited the database account, protected its connection and added an audit trail and tested backups. I would demonstrate it locally now, but I would not put real customer information on a public version until HTTPS, storage protection and operational procedures are verified.

## Why sessions instead of JWTs or API keys?

This is one browser app. Server-side sessions give it a familiar login and immediate logout by deleting the server record. JWTs would add refresh, signing-key and revocation decisions without a distributed-service need. API keys are awkward as individual browser credentials. The tradeoff is that the app relies on a protected session store and must consider CSRF. The cookie is HttpOnly and SameSite Strict; changes also require a session-bound CSRF token. Loopback HTTP cannot honestly claim the production Secure-cookie protection.

## Show authentication and authorization separately

Authentication answers which account is signed in. Show the password verification, session regeneration and `authenticated` middleware in `server/src/app.js`. Authorization answers whether that account may act on this record. Show `owner_id` conditions in `server/src/routes.js` and assignment of new ownership from `req.session.user.id`. The client is never allowed to choose an owner. Demonstrate Alice's own success, Bob's empty list and Bob's rejected update/delete.

## Defend the expiration values

Fifteen minutes without activity limits exposure from unattended machines; eight hours is an absolute session lifetime even with continued activity. Those are explicit project choices, not a regulation. The server enforces both. Tests advance an injected clock rather than claiming someone waited eight hours. Logout deletes the session immediately. Disabling an account requires the operator to remove active sessions as well as disable login.

## Is a removed password still in Git history?

Yes: the upstream disposable default is still present in historical README/configuration content. Removing it from the current configuration does not erase that history. The hardened deployment generates unique active passwords and never uses that old default. `secret-history-check.json` records scoped reachable-history and working-file checks against the actual generated credentials/private-key content, without printing the secrets. This is an exact-match check, not proof that no imaginable secret exists. If a real credential had leaked, revocation would come before history cleanup.

## What does non-root prevent?

The app runs as UID1000 and the database as UID70. Dropped capabilities, no-new-privileges and read-only root filesystems reduce what a compromised process can change. Show the runtime JSON and EROFS proof. A host administrator still controls Docker and storage; non-root does not fix an authorization bug or stop all container escapes. Also be precise: the original PostgreSQL server already ran as postgres. The original default exec shell being root was not proof that the server process was root.

## Demonstrate a meaningful regression test

The normal suite passes 23 test groups. Run the mutation command from the README or show `mutation-summary.json`: it removes the list ownership condition only in a disposable copy. The existing two-user test fails, and the child exits 1 as expected. The mutation wrapper reports success because it detected the intended regression. This is stronger evidence than a test that merely checks whether the source contains a particular string. Do not edit the running app to demonstrate the flaw.

## Why not call every scanner match an exploit?

The database scan had 46 advisory records associated with unused gosu and its dependencies. The initial app image had nine in bundled npm. Removing unused runtime tools reduced matches to zero; it did not demonstrate that those records were all exploitable through the API. Trivy also warned about its Alpine EOL metadata. The original npm dependency audits were clean even though anonymous CRUD worked. Software inventories and application behavior answer different questions.

## Biggest residual risk

The trusted host and a fully compromised app remain powerful. Database records are not field-encrypted, host disk encryption has not been verified and the backup key is still on the lab host. Optional database row-level security and an independent audit destination were not implemented. This is acceptable for fictional data on a loopback lab; it is not an acceptance of those risks for a public PII service.

## Backup and audit proof

Show `backup-restore.json`: a separately restored database matched counts and content checksums. This is a same-host logical restore, not a timed disaster-recovery guarantee. Show the create/update/delete audit for target 1 and the identical before/after restart files. Explain that audit insertion is in the same transaction as the normal mutation, so the injected audit failure rolls back the birthday. An administrator or compromised app can still bypass the application wrapper; independent DB auditing is future work.

## Regulatory answer

Do not say a birthday automatically invokes HIPAA, GDPR, PCI DSS or CCPA. First establish who operates the service, whose data it holds, where people are located, business thresholds and health/payment context. The report cites official sources and distinguishes conditional duties. This test used fictional data and identified no real breach. A real incident requires evidence preservation and an applicability/notification assessment with the responsible privacy/legal owner.

## AI use and the surprising result

Codex helped develop the threat model, code, tests, evidence and report. Results were checked with actual HTTP/database/browser tests, mutation testing, scanner outputs, a history check and a real restore. A browser test caught a sign-out button hidden by the decorative background, and a Windows compatibility problem in permission setup was fixed and retested. A useful surprise to discuss is that clean npm audit output did not prevent the app's most direct risk: missing identity and ownership checks. Use your own words and be ready to point to the evidence.

## A 13-minute rehearsal

- Minutes 0-2: scope, original misuse and business consequences.
- Minutes 2-5: private-list demo and the authentication/authorization code.
- Minutes 5-7: session tradeoffs and expiry.
- Minutes 7-9: TLS, least privilege, audit and container proof.
- Minutes 9-11: security regression and deliberate mutation result.
- Minutes 11-13: recovery, residual risk, conditional legal analysis and AI disclosure.
- Leave up to two minutes for questions or clarification.
