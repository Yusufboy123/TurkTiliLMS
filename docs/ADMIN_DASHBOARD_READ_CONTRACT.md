# Turk Tili LMS — Admin Dashboard Read Contract

- **Module:** 9.4A
- **Status:** Review Candidate
- **Implementation status:** Contract only; not available at runtime
- **Default language:** Uzbek (Latin)
- **API version:** v1

## 1. Purpose and authority

This document defines the canonical read contract for the first production
Admin Dashboard. It is authoritative for Module 9.4B backend runtime and Module
9.4C frontend implementation after architecture approval.

The dashboard is an operational overview, not an analytics warehouse, audit-log
browser, or replacement for resource-management pages. Every value is computed
by the backend from canonical records. Clients must not combine unrelated list
responses or infer missing metrics.

If this document conflicts with an accepted ADR, the accepted ADR wins. The
related decision record is
[ADR-005](./design-system/decisions/ADR-005-admin-dashboard-read-contract.md).

## 2. Scope

Module 9.4A defines:

- one fixed-size platform summary response;
- exact user, course, enrollment, progress, and certificate metrics;
- stable authorization, failure, privacy, freshness, and rate-limit behavior;
- a quick-navigation capability matrix based on real routes;
- the frontend route plan and the 9.4A/9.4B/9.4C delivery boundary.

Module 9.4A does not implement runtime code, routes, repositories, React pages,
Prisma changes, migrations, or permission seed changes.

## 3. Existing system and gaps

| Existing capability                       | Runtime status                         | Reusable authority                     | Dashboard gap                                                               |
| ----------------------------------------- | -------------------------------------- | -------------------------------------- | --------------------------------------------------------------------------- |
| `GET /api/v1/users/statistics`            | Implemented                            | User lifecycle and current role counts | Separate request and broader fields than the dashboard needs                |
| `GET /api/v1/courses/statistics`          | Implemented                            | Course lifecycle counts                | Separate request and includes detail breakdowns not needed on the dashboard |
| `GET /api/v1/progress`                    | Implemented                            | Enrollment counts and average progress | Paginated reporting payload is unnecessarily large for a summary            |
| Certificate read APIs                     | Implemented per enrollment/certificate | `Certificate.status` is authoritative  | No platform-wide certificate aggregate exists                               |
| `audit_logs` persistence and `audit.read` | Persistence/permission only            | Immutable audit evidence               | No approved safe audit-read projection or read endpoint exists              |
| `/admin/progress` frontend route          | Implemented                            | Admin progress reporting               | No `/admin` dashboard route exists                                          |

Calling the three existing statistics endpoints plus per-certificate reads would
create a client-side fan-out, inconsistent timestamps, unnecessary list data,
and an N+1 certificate query risk. A dedicated aggregate endpoint is therefore
required.

## 4. Canonical endpoint

### 4.1 Operation

```http
GET /api/v1/admin/dashboard/summary
```

- **Role:** `ADMIN`
- **Required permissions, all required:** `users.read`,
  `courses.view_statistics`, `progress.read`, and
  `certificates.course_read`
- **Request body:** none
- **Query parameters:** none
- **Pagination:** none; the response has a fixed schema and no collections
- **Implementation phase:** Module 9.4B
- **Current availability:** `contract-only-not-available`

`certificates.course_read` is the current approved certificate-read equivalent.
It already authorizes administrators to read permitted certificate status. A
future general certificate-management module may introduce a broader
`certificates.read` permission through governance, but Module 9.4A does not add
or silently reinterpret a permission.

### 4.2 Success envelope

```json
{
  "success": true,
  "message": "Administrator boshqaruv paneli xulosasi olindi.",
  "data": {
    "generatedAt": "2026-08-01T10:00:00.000Z",
    "users": {
      "total": 120,
      "active": 109,
      "suspended": 3,
      "deactivated": 6,
      "deleted": 2,
      "students": 102,
      "teachers": 14,
      "administrators": 4
    },
    "courses": {
      "total": 18,
      "draft": 4,
      "inReview": 2,
      "published": 10,
      "archived": 1,
      "deleted": 1
    },
    "enrollments": {
      "total": 480,
      "active": 350,
      "suspended": 10,
      "completed": 100,
      "cancelled": 20
    },
    "progress": {
      "trackedEnrollments": 430,
      "averageCompletionPercentage": 64
    },
    "certificates": {
      "total": 72,
      "issued": 68,
      "revoked": 4
    }
  }
}
```

### 4.3 Field semantics

All counts are non-negative JSON-safe integers in the range `0` through
`9,007,199,254,740,991`. Module 9.4B must reject an out-of-range database result
as an internal integrity failure rather than round it. No success field is
nullable.

| Field                                  | Authoritative meaning                                                                                           |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `generatedAt`                          | Server-generated ISO 8601 UTC instant for the completed snapshot                                                |
| `users.total`                          | All persisted user rows, including soft-deleted users                                                           |
| `users.active`                         | Non-deleted users in `ACTIVE` state                                                                             |
| `users.suspended`                      | Non-deleted users in `SUSPENDED` state                                                                          |
| `users.deactivated`                    | Non-deleted users in `DEACTIVATED` state                                                                        |
| `users.deleted`                        | Users in `DELETED` state with `deletedAt` set                                                                   |
| `users.students`                       | Users with `deletedAt IS NULL`, status other than `DELETED`, and a current, unexpired `STUDENT` role assignment |
| `users.teachers`                       | Users with `deletedAt IS NULL`, status other than `DELETED`, and a current, unexpired `TEACHER` role assignment |
| `users.administrators`                 | Users with `deletedAt IS NULL`, status other than `DELETED`, and a current, unexpired `ADMIN` role assignment   |
| `courses.total`                        | All persisted course rows, including soft-deleted courses                                                       |
| `courses.draft`                        | Non-deleted courses in `DRAFT` state                                                                            |
| `courses.inReview`                     | Non-deleted courses in `IN_REVIEW` state                                                                        |
| `courses.published`                    | Non-deleted courses in `PUBLISHED` state                                                                        |
| `courses.archived`                     | Non-deleted courses in `ARCHIVED` state                                                                         |
| `courses.deleted`                      | Soft-deleted courses                                                                                            |
| `enrollments.total`                    | All course-enrollment rows                                                                                      |
| `enrollments.active`                   | Enrollments in `ACTIVE` state                                                                                   |
| `enrollments.suspended`                | Enrollments in `SUSPENDED` state                                                                                |
| `enrollments.completed`                | Enrollments in `COMPLETED` state                                                                                |
| `enrollments.cancelled`                | Enrollments in `CANCELLED` state                                                                                |
| `progress.trackedEnrollments`          | Enrollment progress-root rows across all enrollment lifecycle states                                            |
| `progress.averageCompletionPercentage` | Floor of the average canonical `coursePercentage` across progress-root rows; `0` when no roots exist            |
| `certificates.total`                   | All certificate rows; exactly `issued + revoked` in v1                                                          |
| `certificates.issued`                  | Certificate rows in `ISSUED` state                                                                              |
| `certificates.revoked`                 | Certificate rows in `REVOKED` state                                                                             |

`UserStatus` is a mutually exclusive enum. The current user-management service
maintains `status = DELETED` if and only if `deletedAt` is non-null, but the
database has no CHECK constraint pairing those fields. Module 9.4B must run a
release preflight for both mismatch directions and test the invariant. At
runtime, `active + suspended + deactivated + deleted` must equal `users.total`;
otherwise the all-or-nothing request fails with `INTERNAL_SERVER_ERROR` and a
safe operational integrity alert. It must not silently omit an inconsistent
row or rewrite user data.

Role counts exclude both forms of deleted identity. They are not mutually
exclusive because one user may hold more than one current role. Consequently,
their sum is not required to equal `users.total`.

Course deletion is orthogonal to the non-null lifecycle enum. A soft-deleted
course retains its historical lifecycle status but contributes only to
`courses.deleted`, not to a visible lifecycle bucket. Therefore
`draft + inReview + published + archived + deleted` must equal `courses.total`,
and historical soft-deleted courses remain included in `total` and `deleted`.

Course enrollments have no soft-delete column. Their four stored enum states are
mutually exclusive and exhaustive, so
`active + suspended + completed + cancelled` must equal `enrollments.total`.

Every `EnrollmentProgressRoot` qualifies, including roots attached to ACTIVE,
SUSPENDED, COMPLETED, or CANCELLED enrollments and roots whose progress is
frozen. A frozen root contributes its stored frozen `coursePercentage` without
recalculation. PostgreSQL constraints keep that integer between 0 and 100 and
consistent with completed/eligible lesson counts. The average is calculated
from `EnrollmentProgressRoot.coursePercentage` at full database precision and
floored once to an integer. No roots produce `trackedEnrollments = 0` and
`averageCompletionPercentage = 0`. Any detected out-of-range or constraint-
inconsistent legacy value is an integrity failure; the client never repairs or
recomputes it.

The contract intentionally omits:

- locked-account counts, because temporary lockout is authentication security
  state rather than a stable platform health metric;
- email-verification and recent-signup counts, because they are not required by
  the initial dashboard;
- `activeLearners`, because the existing reporting field represents active
  enrollments rather than a proven unique-person count;
- `completedCourses`, because `enrollments.completed` already expresses the
  authoritative completed-enrollment count;
- `eligibleNotIssued`, because choosing the current eligibility evaluation
  across future policy versions and supersession is not approved for aggregate
  reporting.

## 5. Certificate aggregation

Certificate summary values come only from `certificates` grouped by
`CertificateLifecycleStatus`:

- `ISSUED` contributes to `issued`;
- `REVOKED` contributes to `revoked`;
- `total` equals their sum;
- no rows produce `{ total: 0, issued: 0, revoked: 0 }`.

Completion events, eligibility evaluations, artifact rows, and download history
must not be used to infer certificate state. The query returns counts only and
must never select or expose verification-token hashes, certificate IDs,
enrollment IDs, artifact keys, storage paths, checksums, renderer metadata,
revocation notes, or actor data.

Certificates have no soft-delete lifecycle, revoked rows remain in `total`, and
the unique `enrollmentId` constraint prevents more than one certificate row per
enrollment. Artifact presence is not a condition of the lifecycle aggregate;
the certificate row remains authoritative even during artifact integrity or
reconciliation work.

The existing `(course_id, status, issued_at)` certificate index supports
course-scoped reporting but does not lead with `status` for a platform-wide
grouping. Module 9.4B must use one aggregate query and verify its unfiltered
execution plan with representative data; it must not add per-course or
per-certificate loops. A new index or schema change is not required to define
this contract. If measured runtime plans miss the agreed latency budget,
implementation must stop for a separately reviewed additive index or aggregate
strategy.

## 6. Query and consistency architecture

Module 9.4B must implement a feature-owned Admin Dashboard repository, service,
controller, route, DTO/presenter, and validation boundary. It may reuse shared
policy utilities, but it must not call HTTP controllers or expose Prisma
records.

All aggregate reads, invariant checks, and the successful-access audit insert
execute inside one short PostgreSQL `REPEATABLE READ` transaction so every
section represents one consistent database snapshot and the privileged read is
auditable. Independent bounded aggregate queries or grouped counts may run
within that boundary; row-by-row loops and unbounded result sets are forbidden.
MVCC count/aggregate reads do not lock domain rows, and the transaction must not
perform network work or remain open while rendering the response.

The response is all-or-nothing. If any required section cannot be read, the
endpoint returns a stable error envelope and no partial statistics. This avoids
permission inference, mixed timestamps, and UI decisions based on incomplete
platform state.

## 7. Authorization model

The endpoint uses two mandatory boundaries:

1. route middleware requires an authenticated `ADMIN` and all four permissions;
2. the service repeats the role-and-permission policy for direct-call safety.

| Section              | Role    | Required permission        | Additional scope                           |
| -------------------- | ------- | -------------------------- | ------------------------------------------ |
| Users                | `ADMIN` | `users.read`               | Platform summary only; no user list or PII |
| Courses              | `ADMIN` | `courses.view_statistics`  | Platform counts                            |
| Enrollments/progress | `ADMIN` | `progress.read`            | Platform counts; no learner records        |
| Certificates         | `ADMIN` | `certificates.course_read` | Platform lifecycle counts only             |

Missing any required permission returns HTTP `403 ACCESS_DENIED`; the response
does not reveal which section or permission failed. Permission-filtered partial
sections are rejected because they create an unstable DTO and allow callers to
infer hidden capabilities from omitted data.

## 8. Recent activity decision

Recent administrative activity is **deferred** and is not present in the v1
summary DTO.

Although `audit_logs` and `audit.read` exist, the repository has no approved
read endpoint, event allowlist, safe actor projection, metadata-redaction
contract, dashboard retention window, or pagination policy. Returning raw
`beforeSummary`, `afterSummary`, or `metadata` would create unnecessary privacy
and secret-disclosure risk.

A future audit-read contract must separately define a bounded allowlist,
localized event category, minimized actor display, timestamp, retention, export
step-up, and stable redaction rules. Until then, `/admin/audit` remains deferred
and `audit.read` is not required by this endpoint.

Every successful summary read writes `admin_dashboard.summary_read` with the
actor, occurrence time, request correlation ID, and the existing minimized
network/user-agent context. It uses subject type `admin_dashboard` and no
subject identifier. The audit record must not copy counts, the response body,
permissions, tokens, or raw request headers. If the audit insert fails, the
summary transaction fails and no success response is returned. Authentication,
authorization, and rate-limit denials remain covered by their existing
security/operational logging rather than creating an attacker-controlled audit
row for every rejected request.

## 9. HTTP behavior

### 9.1 Rate limit

The operation is limited to 30 accepted attempts per 60 seconds for the tuple of
authenticated user ID and privacy-safe client IP hash. The limit must be shared
across API nodes; the default process-memory `express-rate-limit` store is not
sufficient.

Module 9.4B must reuse or extract the repository's proven PostgreSQL advisory-
lock plus `audit_logs` counting pattern without adding a package or schema. A
short `READ COMMITTED` limiter transaction must:

1. acquire a transaction-scoped advisory lock for
   `admin-dashboard:summary:<userId>:<ipHash>`;
2. use database time and count `admin_dashboard.summary_rate_slot_consumed`
   events for the same actor/IP tuple in the preceding 60 seconds;
3. reject at 30 without inserting another slot; otherwise insert one minimized
   slot event before releasing the lock.

The slot event contains actor, occurrence time, privacy-safe IP hash, and
correlation ID only. It has subject type `admin_dashboard`, no subject ID, and
no metadata, user-agent, permission, count, or response copy. It is separate
from the atomic successful-read event because a failed attempt still consumes a
rate slot. Rate-limit persistence failure fails closed without running the
aggregate.

The IP hash must use the existing normalized `ipKeyGenerator(request.ip)` input
and project hashing approach. Module 9.4B must not parse forwarded headers
directly. Because the baseline has no explicit Express `trust proxy` setting,
the immediate peer address is the safe fallback; production proxy topology must
be explicitly configured and tested before trusting forwarded client IPs.

Successful and limited responses return the standard draft-8 `RateLimit` and
`RateLimit-Policy` headers. Exceeding the limit returns HTTP 429 with
`RATE_LIMIT_EXCEEDED` and `Retry-After`.

### 9.2 Caching and staleness

Responses use `Cache-Control: private, no-store`. Shared proxies and browsers
must not persist admin statistics. Module 9.4C may use the existing private
React Query cache with a 30-second stale time, refetch on explicit retry, and no
optimistic updates. The backend remains authoritative.

### 9.3 Stable responses

| HTTP | Code                      | Meaning                                                                                 |
| ---: | ------------------------- | --------------------------------------------------------------------------------------- |
|  200 | —                         | Complete snapshot returned                                                              |
|  401 | `AUTHENTICATION_REQUIRED` | No authenticated session is available                                                   |
|  401 | `INVALID_ACCESS_TOKEN`    | The supplied access token is invalid or expired and refresh did not recover the session |
|  403 | `ACCESS_DENIED`           | Role or at least one required permission is missing                                     |
|  429 | `RATE_LIMIT_EXCEEDED`     | Read limit exceeded                                                                     |
|  500 | `INTERNAL_SERVER_ERROR`   | Safe unexpected failure; no section or infrastructure detail is exposed                 |

No `404`, `409`, or `422` response is defined because this fixed aggregate has
no resource identifier, query parameters, or request body.

## 10. Privacy and security

- Return counts only; never return user names, emails, profile fields, or user
  identifiers.
- Return no course, enrollment, learner, certificate, actor, or audit record
  identifiers.
- Never expose raw audit metadata or before/after snapshots.
- Never expose verification tokens or hashes, artifact/storage metadata,
  checksums, renderer details, session details, or credential state.
- Do not log the full response body.
- Preserve correlation IDs in operational logs while redacting credentials.
- Treat the deployment as one platform scope; do not claim tenant isolation.
  A future tenant model requires explicit tenant keys and scoped aggregates.
- Bound query count and duration; apply database/request timeouts in Module
  9.4B.

## 11. Frontend routes and quick navigation

Route status describes current runtime reality at the Module 9.4A baseline.

| Route                 | Runtime status | Role and permissions                                            | Owning phase/module                                     |
| --------------------- | -------------- | --------------------------------------------------------------- | ------------------------------------------------------- |
| `/admin`              | Proposed       | `ADMIN` plus all summary permissions                            | Module 9.4C after 9.4B                                  |
| `/admin/progress`     | Existing       | `ADMIN`, `progress.read`                                        | Module 8.4                                              |
| `/admin/users`        | Proposed       | `ADMIN`, `users.read`                                           | Future User Management UI                               |
| `/admin/courses`      | Proposed       | `ADMIN`, course read/management permissions                     | Future Course Management UI                             |
| `/admin/enrollments`  | Proposed       | `ADMIN`, enrollment management permissions                      | Future Enrollment Management UI and collection contract |
| `/admin/certificates` | Proposed       | `ADMIN`, future certificate collection-read permission/contract | Future Certificate Management UI                        |
| `/admin/audit`        | Deferred       | `ADMIN`, `audit.read`; step-up for large personal-data export   | Future safe Audit Read module                           |

The Module 9.4C dashboard may render a quick-navigation card only when both are
true:

1. the authenticated session contains the destination permission; and
2. the destination route is registered and implemented.

At the 9.4A baseline, only `/admin/progress` satisfies both conditions. Proposed
or deferred destinations are not links, disabled promises, or placeholder
pages. The current post-login admin destination remains `/admin/progress` until
Module 9.4C registers `/admin` and updates the role-aware redirect.

The route capability matrix is frontend-owned presentation derived from the
authenticated session and the registered route table. It is not returned by
the summary API and does not replace backend authorization.

## 12. Frontend behavior contract

After Module 9.4B is implemented, Module 9.4C may add `/admin` with:

- initial loading without stale metric flash;
- a zero-data state that renders valid zero counts, not an error;
- one complete success state using the exact DTO;
- a safe retryable error state with no partial cards;
- permission-denied and expired-session behavior through existing guards;
- semantic headings, accessible status labels, keyboard-operable real links,
  and responsive card reflow from 320 CSS pixels;
- localized Uzbek Latin labels and number formatting;
- no client-derived or unsupported metrics.

## 13. Phase split

1. **Module 9.4A — Admin Dashboard Read Contract:** documentation, ADR,
   OpenAPI, route inventory, security, and exact DTO only.
2. **Module 9.4B — Admin Dashboard Backend Runtime:** repository → service →
   controller → route, authorization, bounded snapshot query, tests, and
   OpenAPI activation. No frontend dashboard.
3. **Module 9.4C — Admin Dashboard Frontend:** `/admin`, role-aware redirect,
   React Query read integration, summary cards, real quick links, accessibility,
   and frontend tests.
4. **Future modules:** graphical user, course, enrollment, certificate, and
   audit management pages where no implemented route currently exists.

No phase begins automatically. Module 9.4B requires architecture approval of
this contract; Module 9.4C requires an implemented and verified 9.4B API.

## 14. Acceptance criteria for contract approval

- The OpenAPI operation and this document use identical fields, nullability,
  authorization, rate limit, errors, and implementation markers.
- Certificate counts derive only from `Certificate` lifecycle rows.
- Recent activity is absent until a safe audit-read contract is approved.
- No route is described as implemented unless it exists in the frontend route
  table.
- No Prisma change, migration, permission seed, package, or runtime code is
  required by Module 9.4A.
- Architecture, backend, frontend, security/privacy, and product reviewers
  approve the contract before Module 9.4B starts.
