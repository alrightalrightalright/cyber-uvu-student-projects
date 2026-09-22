# Security posture

This is an educational local deployment. Use fictional records. The supported assessment branch is `security-hardening-appsec`; upstream/default branches may contain intentionally vulnerable code.

Authentication, owner-scoped authorization, CSRF checks, exact-origin CORS, request bounds, PostgreSQL TLS verification and non-root containers are implemented. Runtime database rights are limited. Audit events record actor, action, target and time, and ordinary mutations fail if auditing fails.

Known limitations: the provided browser entry point is HTTP on loopback; disk encryption is specified rather than verified; backup keys remain on the same lab host; no MFA, self-service account recovery, account lockout, centralized audit sink, multi-instance limiter or formal ASVS assessment is provided. Administrative Unix-socket access inside the DB container is trusted. A host/Docker administrator or full application compromise can defeat some controls. Dependency scans are point-in-time inventory checks, not reachability proofs.

## Reporting an issue

Use the fork's GitHub private vulnerability-reporting feature if it is enabled. Otherwise ask the maintainer through the repository's available contact channel how to share a sensitive report; do not put credentials, personal data or live exploit material into a public issue. Public issues may contain a sanitized description, affected version and request for a private reporting channel. No particular private-reporting feature or mailbox is claimed to be configured.

Include the branch/commit, expected and actual behavior, a minimal local reproduction using synthetic data, and impact. Do not test other people's infrastructure. No response-time or bug-bounty promise is made.

If a live credential is exposed, revoke or rotate it first, invalidate affected sessions, preserve evidence securely and then coordinate source/history cleanup. Deleting a file or rewriting history is not a substitute for revocation. [Operating procedures](security/operations.md) explain rotation and release gates.
