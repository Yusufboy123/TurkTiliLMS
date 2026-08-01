# ADR-005: Dedicated Admin Dashboard Read Contract

- **Status:** Review Candidate
- **Date:** 2026-08-01
- **Decision owners:** Product, architecture, backend, database, security/privacy,
  frontend, and accessibility
- **Implementation status:** Contract only; not available at runtime

## Context

The platform already exposes separate user statistics, course statistics, and
paginated progress reporting. Certificate reads are resource-scoped and no
platform certificate aggregate exists. Audit records are persisted, but there
is no approved audit-read API or safe dashboard projection. The frontend has an
implemented `/admin/progress` route but no `/admin` dashboard route.

Building the dashboard by calling multiple existing endpoints would create a
client-side fan-out, inconsistent timestamps, excess payload, and pressure to
infer certificate or activity data. It would also couple web-only composition
to contracts that future mobile administration clients must share.

## Decision

### Use one dedicated aggregate endpoint

Module 9.4B will implement `GET /api/v1/admin/dashboard/summary`. The endpoint
returns a fixed, count-only DTO for users, courses, enrollments, progress, and
certificate lifecycle. It has no list, pagination, filter, or mutation
semantics.

### Require the full read capability set

The endpoint requires `ADMIN` and all of `users.read`,
`courses.view_statistics`, `progress.read`, and `certificates.course_read`.
Missing any capability fails with `ACCESS_DENIED`. Sections are never silently
omitted or replaced with nullable values.

`certificates.course_read` is reused as the currently approved equivalent for
administrative certificate status reads. A future certificate-management
contract may introduce a broader permission, but this decision neither adds nor
renames permissions.

### Read one consistent snapshot

All bounded aggregate queries and the minimized successful-access audit insert
execute inside one PostgreSQL `REPEATABLE READ` transaction. The response is
all-or-nothing. This prevents mixed section times, partial authorization
behavior, unaudited privileged reads, and UI decisions based on incomplete
data. Repositories select aggregate counts only and must not perform per-row or
per-certificate loops.

### Use canonical lifecycle sources

User and course soft-delete semantics remain explicit. Enrollment counts come
from `CourseEnrollment` lifecycle states. Average progress comes from canonical
progress roots. Certificate counts come only from `Certificate.status`; absence
of a certificate, completion events, and eligibility evidence are not
certificate lifecycle counts.

### Defer recent activity

The v1 summary contains no recent-activity list. `audit.read` alone is not a
safe disclosure contract. Event allowlisting, actor minimization, metadata
redaction, retention, pagination, and export step-up must be approved in a
future Audit Read module before `/admin/audit` or a dashboard projection is
implemented.

Successful access records `admin_dashboard.summary_read` with actor, time,
correlation ID, and existing minimized request context only. Counts, response
bodies, permissions, and raw headers are excluded. `audit.read` is not required
to create this event and is required only by a future audit-reading capability.

### Keep private data uncached

The API sends `Cache-Control: private, no-store` and is limited to 30 requests
per 60 seconds per authenticated user and privacy-safe client IP hash. The
limit reuses or extracts the existing cross-node PostgreSQL advisory-lock and
audit-counting pattern; process-local memory is rejected. A minimized
`admin_dashboard.summary_rate_slot_consumed` event records each accepted
attempt in a short `READ COMMITTED` limiter transaction before the separate
repeatable-read aggregate transaction. No schema or dependency is added. The
frontend may retain a private in-memory React Query result with a 30-second
stale time; no shared or persistent cache is allowed.

### Separate the route phases

- 9.4A defines and reviews the contract only.
- 9.4B implements the backend endpoint and activates its OpenAPI marker.
- 9.4C registers `/admin`, updates the admin home redirect, and implements the
  dashboard UI.
- Existing `/admin/progress` remains the admin landing destination until 9.4C.
- Quick navigation includes only registered routes for which the current
  session has permission. Proposed/deferred routes are not placeholder links.

## Consequences

### Positive

- All API-first clients receive one authoritative platform snapshot.
- The fixed DTO is small, private, bounded, and resistant to N+1 behavior.
- All-or-nothing authorization avoids permission inference and unstable client
  parsing.
- Certificate counts cannot drift from the immutable certificate lifecycle.
- Audit privacy is preserved until a deliberate read model exists.
- Frontend route claims match runtime reality.

### Costs

- Module 9.4B adds a small feature module instead of composing existing HTTP
  endpoints.
- Administrators missing one summary permission cannot see a partial dashboard.
- Recent activity and most quick-navigation destinations remain unavailable
  until their own contracts and pages are implemented.
- A repeatable-read snapshot costs one short transaction and must remain
  aggregate-only.
- The database-backed rate limiter adds a small bounded audit-write and count
  before each accepted dashboard request; Module 9.4B must verify its indexed
  plan and retention impact.

## Rejected alternatives

### Compose existing APIs in React

Rejected because responses are generated at different times, certificate
aggregation is unavailable, paginated progress data is excessive, and every
other client would need to duplicate composition logic.

### Return permission-filtered nullable sections

Rejected because the DTO becomes unstable, partial failures become ambiguous,
and omitted sections reveal permission differences.

### Infer certificates from completion or eligibility

Rejected because completion, eligibility, and certificate issuance are
separate authoritative lifecycles.

### Return raw recent audit rows

Rejected because audit metadata is not a dashboard-safe disclosure model.

### Add a dashboard aggregate table now

Rejected because current bounded counts are supported by canonical tables and
existing indexes. A schema change requires measured evidence and a separate
migration review.

## Approval and implementation gates

This ADR becomes accepted only after architecture, product, backend, frontend,
database, security/privacy, and accessibility review confirms the exact DTO,
permission set, snapshot semantics, route plan, and audit deferral.

Module 9.4B must not begin until that approval is recorded. Module 9.4C must not
begin until the 9.4B endpoint is implemented, tested, and marked implemented in
OpenAPI.

## References

- [Admin Dashboard Read Contract](../../ADMIN_DASHBOARD_READ_CONTRACT.md)
- [Admin Dashboard OpenAPI](../../openapi/admin-dashboard.v1.yaml)
- [Project Architecture](../../PROJECT_ARCHITECTURE.md)
- [Database Architecture](../../DATABASE_ARCHITECTURE.md)
- [Page Specifications](../page-specifications.md)
- [Page Inventory](../page-inventory.md)
