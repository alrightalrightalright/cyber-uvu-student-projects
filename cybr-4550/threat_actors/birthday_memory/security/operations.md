# Operating and release procedures

## Secrets and account lifecycle

Setup creates random database passwords and session keys rather than committing defaults. Docker Compose secrets are local file mounts, not an encrypted vault. `.gitignore` and `.dockerignore` exclude `.secrets`, backups and environment files. Setup restricts host file permissions; an authorized host administrator can still read files and Docker memory. The lab CA private key is never mounted into either running service.

The role `birthday_admin` owns schema and migration operations. `birthday_app` has no superuser, database-creation or role-creation authority. It has SELECT on users, CRUD on birthdays/sessions, INSERT on audit events and only the needed sequence access. It cannot create users or change hashes. Administrative local Unix sockets are trusted inside the database container; TCP accepts only the app role using TLS and SCRAM. Docker access is therefore an administrative security boundary.

Account creation is an operator responsibility. Generate a random initial password, hash with the implementation's Argon2id parameters, and insert the username/hash using an administrative parameterized query. Deliver the password through a private channel. This lab intentionally has no registration/reset UI. For account disablement, set `users.enabled=false` and delete all matching sessions in the same administrative transaction; existing sessions otherwise remain valid until expiry. Require a reviewed enrollment/reset process and preferably an identity provider with MFA before public use.

## Rotation runbook (specified; not a claim of a completed rotation drill)

1. Quiesce writes and take a verified encrypted backup. Record who approved the change without recording credentials.
2. Generate a new random app database password in a restricted file. Through the database's local administrative connection, change `birthday_app` using a parameterized administrative operation. Avoid passwords in shell arguments/history. Replace `.secrets/db-app-password` atomically, restart the app to replace pooled connections, test login and CRUD, then confirm the old password fails. Keep the outage short; roll back the password and file together if verification fails.
3. Rotate the session secret file and truncate the session table through the administrator connection. Restart the app; confirm old cookies receive 401 and new sign-in succeeds. This forces every account to sign in again.
4. Rotate the admin password separately. `POSTGRES_PASSWORD_FILE` initializes only an empty cluster; editing that file alone does not change an existing role password. Update the role and restricted file together and update the initialization SQL for future empty deployments. Treat that SQL as a secret too.
5. Renew the 90-day DB server certificate before expiry. Keep SAN `DNS:postgres`, sign with the trusted CA, replace key/cert secret files and restart PostgreSQL so its private tmpfs copy refreshes. Verify trust, hostname and expiry; test app reconnection. To replace the CA, distribute the new trust root and coordinate server replacement; do not disable verification.
6. Rotate backup keys with versioned protected custody. Preserve the old key until every retained archive that needs it expires or is re-encrypted and restored successfully. Never destroy the only recovery key.

## At-rest protection specification

**Implemented:** unique secrets, restrictive host secret/backup folder permissions, no secret image copies, encrypted backup archives (AES-256-GCM), and a restore exercise. PostgreSQL columns and its Docker volume are plaintext to a process that can read the underlying storage. Password hashing is not PII encryption. No claim is made that this host's BitLocker state has been verified.

**Required before storing real PII:** enable BitLocker with XTS-AES-256 on the Windows volume that actually stores Docker Desktop's data VHDX and on any separate backup volume; use TPM plus an organization-approved recovery process. Identify the VHDX location in Docker Desktop, verify encryption completion and protection status with `Get-BitLockerVolume`, and retain redacted evidence. On a Linux host, use an equivalently managed LUKS2-encrypted block volume. Keep recovery keys in a separate organization-managed vault with restricted roles and logged access, and test boot/recovery after an approved change. Do not merely encrypt the source folder while leaving the Docker data disk unprotected.

Disk encryption mitigates offline disk loss; it does not prevent a signed-in host administrator, database superuser or compromised app from accessing live data. Set a PII retention policy: minimize optional phone/email collection; delete records when no longer needed; specify backup expiry so deleted records do not survive indefinitely. Audit metadata needs its own retention/access policy.

## Backups and recovery

`node deployment/backup.mjs create` produces `.backups/birthday-backup.aesgcm`; the binary format is `BM01`, 12-byte random nonce, 16-byte GCM tag, then ciphertext. A custom-format PostgreSQL dump is encrypted in memory before being written. The key is 32 random bytes in `.secrets/backup-key`. Sessions are excluded so restored backups do not resurrect browser sessions. The tool limits dump buffering to 64 MiB; use a reviewed streaming implementation for larger deployments. This is a small lab utility, not an audited backup product.

`node deployment/backup.mjs verify-restore` authenticates/decrypts the archive in memory, creates a separate `birthday_restore_check` database, restores it and compares row counts and ordered content checksums with the live users, birthdays and audit tables. It then drops only that named temporary database. It refuses if that database already exists. Freeze writes during this exercise. This demonstrates a logical restore on the same host, not disaster recovery after host/key loss.

Proposed production policy: daily encrypted backups, 30-day retention, weekly restore tests, a separate offline/immutable copy and separate key vault. Target RPO 24 hours and RTO four hours, subject to a timed full-host restore drill; these are proposed objectives, not measured service guarantees. A full restore must recreate the restricted role/grants and an empty session table, since archives intentionally omit ACLs and sessions. Recover keys separately, restore to isolated infrastructure, validate counts/content and owner isolation, rotate passwords/session secrets, and only then reopen service.

## Container and release gates

The app filesystem is read-only except a small tmpfs; PostgreSQL additionally needs its data volume and socket/TLS tmpfs. Both run non-root with all capabilities dropped, no-new-privileges, one CPU, PID limit 100, and memory caps of 256 MiB (app)/512 MiB (DB). The DB network is internal and has no published host port. App image builds are staged and pinned by digest. npm and gosu are removed from final runtime filesystems because they are unused; base-image lower layers still contain their original bytes. This is attack-surface reduction in the merged runtime, not secret erasure from image history.

Before public deployment: deploy and validate trusted browser HTTPS with Secure cookies; adjust the health check for HTTPS; verify disk encryption and separate backup-key custody; implement account lifecycle, centralized audit retention and monitoring; decide whether RLS/independent DB auditing is required; validate distributed rate limits if scaling; repeat fresh image/dependency scans; obtain independent review and run the full regression suite. The default local image health check uses HTTP and is not a production HTTPS configuration.

No GitHub-hosted attack tests or public vulnerable deployment are included. Security CI is optional follow-on work; local evidence is the basis of this assessment.
