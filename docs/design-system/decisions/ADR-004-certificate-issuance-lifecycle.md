# ADR-004: Immutable Certificate Issuance and Lifecycle

- **Status:** Review Candidate
- **Date:** 2026-07-28
- **Decision owners:** Product, architecture, backend, database, security,
  privacy/legal, storage operations, frontend, and accessibility
- **Implementation status:** Contract only; not available at runtime

## Context

Module 8.5 established that learning completion, certificate eligibility, and a
certificate are separate authoritative lifecycles. It implemented immutable
eligibility evidence and read-only eligibility/status views, but deliberately
blocked issuance. The repository has no approved contract for recent
authentication, certificate persistence, number allocation, immutable
artifacts, verification, revocation, or recovery.

The existing media module manages user-uploaded, soft-deletable and restorable
content. The existing idempotency record is actor/enrollment scoped but supports
only progress mutations. The current authenticated session also lacks an
explicit recent-authentication timestamp or single-use proof. Directly reusing
those runtime semantics would weaken the historical and security guarantees of
a credential.

## Decision

### Preserve domain separation

Progress remains authoritative for completion. Certificate Eligibility remains
authoritative for the immutable issuance decision. Certificate issuance
references exactly one eligible evaluation and never rewrites completion or
eligibility. Revocation changes only certificate validity.

### Persist a small lifecycle

`NOT_ISSUED` is derived from the absence of a certificate row. V1 persists only
`ISSUED` and `REVOKED`. The only transition is `ISSUED -> REVOKED`. A
certificate, its number, evidence, snapshots, template version, artifact, and
issuance attribution are immutable.

Reissue and `SUPERSEDED` are excluded from v1. A later contract must create a
new record, number, token, artifact, and explicit supersession relationship
without altering the old record.

### Require password-based step-up

Issuance and revocation require ADMIN role, the action permission, normal
session validation, and a short-lived single-use step-up proof. A successful
local-password login or password re-entry counts as recent authentication for
10 minutes. Challenges last 5 minutes; proofs last 2 minutes and bind user,
session, credential epoch, action, and target. Only hashes of opaque proofs are
stored. Logout, session replacement, account/RBAC loss, and password
change/reset invalidate outstanding authorization; protected transactions
revalidate all bindings and consume a proof atomically. Any future template
activation/retirement endpoint must adopt the same protected-action pattern
after separate approval.

MFA and external identity providers are deferred. The proof contract allows a
future typed verification method without changing protected actions.

### Use synchronous staged issuance

Issuance renders, stages, and finalizes a uniquely keyed PDF outside the
database transaction. A bounded SERIALIZABLE transaction revalidates the
session, proof, enrollment, progress root, exact eligible evidence, template,
duplicate guard, finalized checksum/size, and idempotency record; then
atomically persists certificate, artifact metadata, audit, proof consumption,
and replay result.

Compensation and an orphan reconciler remove only unreferenced staged/final
objects. PDF rendering never holds database locks.

### Make PDF the immutable private artifact

The canonical artifact is one private `application/pdf` object with trusted
size, SHA-256 checksum, and renderer version. Silent regeneration is forbidden
because renderer or asset changes may produce different bytes.

Certificate artifacts use a dedicated certificate record and private namespace.
They may reuse the media module's low-level safe storage mechanics, but they are
not `MediaFile` uploads and cannot use generic media deletion, restore, or
download routes.

### Use stable template versions and snapshots

One typed `STANDARD_COURSE_COMPLETION` template begins with locale `uz-Latn`.
Activation freezes the template version and approved asset references. Issuance
stores recipient, course, organization, locale, and issue-date snapshots. No
arbitrary HTML, CSS, JavaScript, executable expression, unrestricted JSON, or
remote asset is supported.

### Separate number from verification credential

The human-readable immutable number is
`TTL-{UTC_YEAR}-{10-digit global sequence}`. PostgreSQL is the allocation
authority; gaps are accepted and values are never reused.

Public verification uses a separate 256-bit random base64url token. Only its
SHA-256 hash is stored. The public response is privacy-limited and never exposes
internal IDs, emails, actor data, artifact paths, or the raw token.

### Promote existing idempotency to shared infrastructure

The existing physical `idempotency_records` table is promoted to shared mutation
infrastructure rather than introducing a parallel system. Its enrollment
foreign key moves from the Progress-owned root to `course_enrollments`, while
existing progress data, event relations, operations, and behavior remain
compatible. It gains issuance and revocation operations. Keys remain
actor-scoped and enrollment-scoped, fingerprint the canonical request, and
retain successful responses for 24 hours. Authentication and authorization are
revalidated before replay.

### Retain and revoke; never delete

Revocation is an audited immutable state transition. It retains certificate,
artifact, completion, and eligibility evidence. Student download is denied
after revocation; privileged administrative retrieval remains audited.

No automatic deletion occurs until legal/privacy owners approve an exact
retention and anonymization policy. That approval is a production activation
gate.

A separate one-to-one disclosure-control record can suppress the public
recipient name without mutating the certificate or artifact. The canonical PDF
is limited to 10 MiB. Public token URLs require no-referrer/noindex headers,
third-party-resource exclusion, and infrastructure log redaction.

## Consequences

### Positive

- Credentials remain reproducible and auditable without coupling to mutable
  profiles, courses, templates, or eligibility policy.
- Step-up proofs cannot be replayed across sessions, targets, or actions.
- Serializable transactions and database uniqueness prevent duplicate issuance
  and revocation races.
- Private artifacts are protected from generic media lifecycle operations.
- Human support can use readable numbers without making them verification
  secrets.
- API-first web, mobile, Telegram, and public verification consumers share one
  explicit contract.
- The small state machine avoids speculative expiry and reissue states.

### Costs

- Additive persistence is required for certificates, artifacts, templates,
  recent authentication, challenges/proofs, and idempotency operations.
- Issuance needs staged storage, compensation, orphan reconciliation, and
  integrity monitoring.
- A renderer and bundled-font dependency require separate security/license
  approval.
- Public verification creates privacy, abuse-control, and operational
  obligations.
- Reissue remains unavailable until a separate contract revision.
- Production cannot activate until retention/anonymization and durable storage
  policies are approved.

## Rejected alternatives

### Store a certificate boolean on enrollment

Rejected because it cannot retain number, artifact, evidence, template,
verification, actor, version, or revocation history.

### Use eligibility status as certificate status

Rejected because revoking a credential must not erase or change the valid
eligibility decision that supported issuance.

### Use certificate number or internal UUID for public verification

Rejected because readable numbers are enumerable and internal identifiers
should not become public credentials.

### Store the raw verification token

Rejected because database disclosure would immediately expose every public
verification credential.

### Reuse `MediaFile` directly

Rejected because upload ownership, soft delete, restore, generic download, and
category validation conflict with immutable private certificate artifacts.

### Render PDF inside a database transaction

Rejected because renderer/storage latency would hold locks, increase
serialization failures, and reduce availability.

### Regenerate missing artifacts from current data

Rejected because mutable profiles, course metadata, assets, fonts, and renderer
versions cannot guarantee the originally issued bytes.

### Use arbitrary HTML/CSS templates

Rejected because a non-programmer admin workflow must not permit code injection,
remote asset access, XSS, or unsafe HTML-to-PDF behavior.

### Support reissue in the first release

Rejected because supersession, public history, eligibility reuse, correction
policy, and retention require additional product and legal decisions.

### Put certificate operations in a new idempotency subsystem

Rejected because it duplicates concurrency, fingerprint, replay, retention, and
cleanup logic already represented by the shared enrollment-scoped record.

## Implementation sequence

1. **8.6A:** Approve this ADR, canonical contract, OpenAPI, database blueprint,
   and page contracts.
2. **8.6B:** Add schema/migration, disclosure control, permission seed,
   constraints, safe idempotency ownership/FK promotion, preflight, and
   PostgreSQL tests only.
3. **8.6C:** Implement step-up authentication and its frontend flow.
4. **8.6D:** Implement private artifact storage and typed PDF renderer
   foundation.
5. **8.6E:** Implement issuance, private reads/downloads, and frontend status
   integration.
6. **8.6F:** Implement public verification and administrative revocation.
7. **Future:** Contract and implement reissue/supersession and optional QR.

No phase begins automatically.

## Approval gates

This ADR becomes Accepted only after:

- architecture confirms consistency with ADR-002 and ADR-003;
- security approves step-up, idempotency replay, public verification, rate
  limiting, and artifact threat controls;
- database owners approve lock order, sequence allocation, constraints, and
  immutable history;
- product and brand approve number format, visible snapshots, template, and
  Uzbek Latin copy;
- privacy/legal approve retain-by-default private history, separate
  recipient-name suppression, public fields, and record-disclosure boundaries;
- storage operations approve private durable storage and recovery design;
- accessibility approves protected-action, download, revoked, and verification
  states;
- OpenAPI and database/page documentation contain no blocking contradiction.

Retention duration/anonymization and production storage operations may remain
post-contract operational gates, but must be resolved before production
activation.

## References

- [Canonical Certificate Issuance Contract](../../CERTIFICATE_ISSUANCE_LIFECYCLE_CONTRACT.md)
- [Certificate Eligibility Contract](../../COURSE_COMPLETION_CERTIFICATE_ELIGIBILITY_CONTRACT.md)
- [ADR-003](./ADR-003-course-completion-certificate-eligibility.md)
- [Certificate Eligibility OpenAPI](../../openapi/course-completion-certificate-eligibility.v1.yaml)
- [Database Architecture](../../DATABASE_ARCHITECTURE.md)
- [Page Specifications](../page-specifications.md)
