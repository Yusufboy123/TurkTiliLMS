# ADR-002: Enrollment-Bound Progress Tracking Contract

- **Status:** Proposed for Module 8.1A approval
- **Date:** 2026-07-26
- **Decision owners:** Product, architecture, backend, frontend, security/privacy,
  and accessibility
- **Implementation status:** Contract only; no runtime or database implementation

## Context

Turk Tili LMS needs one authoritative progress contract for the React
application, future Android and iOS applications, and the Telegram bot. Existing
course, section, lesson, content-block, media, authentication, RBAC, and
enrollment modules already establish publication, ownership, and enrollment
lifecycle rules.

The original database blueprint describes lesson progress primarily by
`user_id + lesson_id` and includes video resume seconds. That blueprint predates
the implemented enrollment lifecycle and the Design System decision to exclude
video playback position from initial Module #8.

Module 8.1A formalizes policy and contracts only. It does not authorize Prisma
changes, migrations, permission seeding, runtime endpoints, frontend behavior,
or dependency installation.

## Problem

Progress must remain consistent across clients, concurrent requests,
re-enrollment, curriculum revisions, suspension, cancellation, and terminal
course completion. The platform also needs deterministic aggregates and resume
targets without allowing clients to infer business rules.

The contract must resolve:

- canonical progress identity;
- read, content-access, and mutation boundaries;
- completion and reopening semantics;
- curriculum and optimistic-concurrency versions;
- idempotent retry behavior;
- authoritative aggregate and resume rules;
- internal transition history;
- migration and approval sequencing.

## Decision

### Milestone boundaries

The delivery sequence is:

1. **Module 8.1A — Contract Approval:** documentation, ADR, OpenAPI, DTOs,
   policies, state machines, security, and testing contract only.
2. **Module 8.1B — Schema and Migration:** Prisma schema, additive migration,
   permission seed, environment preflight, backfill, and database tests.
3. **Module 8.2 — Backend Progress Engine:** repository, service, controller,
   presenter, policy, routes, and PostgreSQL concurrency behavior.
4. **Module 8.3 — Student Progress UI:** approved student contract integration.
5. **Module 8.4 — Teacher and Administrator Reporting:** scoped reporting;
   export remains separately gated.

No later milestone begins automatically.

### Canonical identity

Progress belongs to one enrollment lifecycle:

- lesson progress is unique by `enrollmentId + lessonId`;
- block progress is unique by `enrollmentId + blockId`;
- a cancelled enrollment followed by re-enrollment receives a new progress
  root;
- a suspended enrollment reactivated later keeps the same progress root.

`userId + lessonId` is not the canonical identity.

### Enrollment-state policy

- **ACTIVE:** permitted reads and capability-authorized progress mutations.
- **SUSPENDED:** progress is preserved and readable, but mutation and resume are
  unavailable.
- **CANCELLED:** a frozen historical snapshot is readable, but mutation and
  resume are unavailable.
- **COMPLETED:** canonical progress is terminal and frozen at 100 percent.
  Progress mutation and resume are unavailable.

Completed content may still be read under a separate content-access policy.
Reading completed content is a revisit (`Qayta ko‘rish`), not a progress reopen
(`Qayta ochish`), and changes no progress or activity state.

### Completion policy

- Eligible blocks may be explicitly completed by the owning student.
- Block state is sparse: no row is `NOT_STARTED`; `INCOMPLETE` represents a
  previously completed and reopened block; `COMPLETED` is current completion.
- Visits create no block-progress row.
- Required, visible, active blocks enter lesson denominators and prerequisites.
- Optional blocks may be completed or reopened but do not enter denominators or
  block lesson completion.
- Lesson completion is explicit and requires all currently eligible required
  blocks.
- A lesson with zero required blocks may be explicitly completed.
- Opening or visiting a lesson never completes it.
- Completing the final eligible lesson atomically completes the ACTIVE
  enrollment when at least one eligible lesson exists.
- Completed course progress cannot be reopened in v1.

Repeated identical completion or reopen operations return authoritative success
with `changed=false`.

### Versions

Three independent versions are required:

- `completionVersion` changes for completion, reopen, canonical aggregates, and
  automatic course completion;
- `activityVersion` changes for accepted last-visited lesson updates;
- course-owned `curriculumVersion` changes when published curriculum eligibility
  or deterministic order changes.

Completion mutations require `expectedCompletionVersion`,
`curriculumVersion`, and `Idempotency-Key`. Last-visited mutations require
`curriculumVersion` and `Idempotency-Key`; legitimate concurrent visits use
last-committed server order rather than rejecting stale activity versions.

### Curriculum changes

The curriculum version changes for these eligibility or deterministic-order
changes:

- section publish, unpublish, soft delete, restore, or reorder;
- lesson publish, archive, soft delete, restore, move, or reorder;
- block visibility, required flag, soft delete, restore, or reorder;
- addition of a section, lesson, or block that immediately enters the published
  eligible curriculum.

Draft content edits that cannot affect the published eligible curriculum do not
change the version.

ACTIVE enrollments follow the current version. SUSPENDED enrollments reconcile
against the current version before reactivation or a later mutation. CANCELLED
and COMPLETED snapshots remain frozen.

### Aggregate and resume ownership

The backend owns every canonical count, percentage, completion decision, and
resume target. Percentages are integers from 0 to 100 and use floor rounding.
The frontend never recalculates or rounds them.

Resume returns a lesson target only. Video playback seconds, block offsets, and
media watch percentages are excluded from v1.

### Concurrency and idempotency

Future implementation uses:

- PostgreSQL `SERIALIZABLE` transactions;
- lock order enrollment → course → progress root → affected lesson/block
  progress;
- completion-version optimistic concurrency;
- curriculum-version verification;
- actor-scoped idempotency stored atomically with the mutation;
- bounded retry only for genuine serialization or confirmed unique races.

Authentication, authorization, ownership, enrollment state, and resource scope
are revalidated before any replay response is returned.

### Progress events

An internal fixed-column `ProgressEvent` record remains part of v1 for:

- completion and reopen history;
- stable audit reasoning;
- terminal completion evidence;
- transaction reconstruction support.

It is not an analytics warehouse, public event stream, transactional outbox, or
unlimited metadata store. Unrestricted JSON metadata is rejected.

### Frontend server state

Axios remains the HTTP transport. React Query is the proposed shared
server-state standard for Module 8.3 and future API-heavy frontend modules.
Frontend Zod is proposed for runtime contract validation. Neither may be
installed until engineering approval and bundle-budget verification.

Frontend code maps validated DTOs to view models and never imports backend
implementation or Prisma types.

## Rejected alternatives

### User-and-lesson canonical identity

Rejected because it merges separate enrollment lifecycles and cannot represent
fresh progress after cancelled re-enrollment.

### Video playback position in core progress

Rejected because playback position is a separate future media-engagement
capability and must not determine v1 completion.

### One progress version

Rejected because routine last-visited updates would create false completion
conflicts across tabs and clients.

### Client-calculated aggregates or resume targets

Rejected because publication, visibility, enrollment state, curriculum
revision, and future lock rules are backend-owned.

### Precreating every block-progress row

Rejected because it creates write amplification for untouched content and every
curriculum addition.

### Deleting block state on reopen

Rejected because it would make reopened state indistinguishable from untouched
state without reading event history.

### Unrestricted event metadata

Rejected because it weakens schema validation, privacy minimization, indexing,
and retention governance.

### Custom Module #8-only frontend cache

Rejected because query lifecycle, stale data, invalidation, and mutation
reconciliation are shared server-state concerns.

## Consequences

### Positive

- Web, mobile, and Telegram clients receive identical progress semantics.
- Re-enrollment history remains isolated and auditable.
- Completion and visit activity do not create unnecessary version conflicts.
- Curriculum changes produce explicit conflicts and deterministic refresh.
- Completed and cancelled historical percentages do not drift.
- API capabilities prevent frontend permission inference.
- Sparse block state limits storage without losing reopen state.

### Costs

- Module 8.1B requires several related tables and a curriculum-version field.
- Existing curriculum mutation services will need version-bump integration.
- Automatic course completion needs a transaction-aware enrollment lifecycle
  integration boundary.
- Fixed-column progress events require schema review for new event types.
- Legacy cancelled/completed data may not contain enough history for an exact
  historical snapshot.
- React Query and frontend Zod require later dependency approval.

## Superseded legacy assumptions

Upon acceptance of this ADR, these older blueprint assumptions are superseded
for Module #8:

- canonical uniqueness by `user_id + lesson_id`;
- optional enrollment identity on canonical lesson progress;
- video `resume_position_seconds` in core progress;
- one generic progress version;
- streak, mastery, or playback progress in initial Module #8.

The legacy references remain useful as historical planning context only and
must not guide Module 8.1B.

## Approval gates

This ADR becomes accepted only after:

- product approves completion, reopen, content-access, cancelled-read, and
  legacy-data policies;
- architecture/backend/database owners approve the data and transaction model;
- security/privacy approves access boundaries and records unresolved retention;
- accessibility approves capability-driven UI and announcement requirements;
- OpenAPI parses and lints, examples match the documented DTOs, and no blocking
  contradiction remains.

Until then, its status remains proposed and Module 8.1B is blocked.

## Contract references

- [Progress Tracking Contract](../../PROGRESS_TRACKING_CONTRACT.md)
- [Progress Tracking OpenAPI](../../openapi/progress-tracking.v1.yaml)
- [Progress Tracking UI](../progress-tracking-ui.md)
- [Product Decisions](../product-decisions.md)
- [Roadmap](../roadmap.md)
