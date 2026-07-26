# Module 8.1B — Progress Tracking Schema and Migration

- **Status:** Implementation complete; architecture review pending
- **Migrations:** `20260726190508_add_progress_tracking_schema`,
  `20260726191634_allow_progress_idempotency_retention`
- **Contract authority:** [Progress Tracking Contract](../PROGRESS_TRACKING_CONTRACT.md)
- **Architecture decision:**
  [ADR-002](../design-system/decisions/ADR-002-progress-tracking-contract.md)
- **Runtime status:** Not implemented

## Scope

Module 8.1B translates the approved Module 8.1A logical model into an additive
PostgreSQL and Prisma schema. It adds storage, constraints, indexes, and
permission catalog entries only. It does not create endpoints, services,
repositories, controllers, frontend behavior, or historical progress.

## Additive changes

- Add `courses.curriculum_version` with a positive default of `1`.
- Add enrollment-scoped `enrollment_progress_roots`.
- Add `lesson_progress`.
- Add sparse `block_progress`; a missing row means `NOT_STARTED`.
- Add append-only `progress_events` with fixed columns.
- Add actor-scoped `idempotency_records`.
- Add the approved enums, indexes, foreign keys, and database checks.
- Add approved progress permissions through the idempotent seed.
- Set the nullable event-to-idempotency relation to `ON DELETE SET NULL` so
  bounded replay cleanup cannot delete durable progress history.

No existing table, column, enum, index, constraint, or user-owned row is
removed. Existing course rows receive `curriculum_version = 1`; no progress
record is created.

## Environment preflight

Before deploying to any nonlocal environment:

1. Identify the database, schema, environment owner, and maintenance window.
2. Confirm backup completion and perform a restore drill.
3. Run `prisma migrate status` and resolve drift before deployment.
4. Run
   [`preflight.sql`](../../backend/prisma/migrations/20260726190508_add_progress_tracking_schema/preflight.sql)
   against the exact target.
5. Confirm that no target-name collision or legacy progress table exists.
6. Review enrollment-state counts and lifecycle validity.
7. Review lesson/block eligibility counts with the product and data owners.
8. Confirm that adding a nonnull integer default to `courses` fits the measured
   lock and maintenance budget.
9. Dry-run migration, verification, and rollback against a sanitized copy.

The repository cannot prove whether an arbitrary target contains production,
demo, or development data. That classification must be recorded by the
environment owner.

## Backfill strategy

There is no physical legacy progress table in the migration history at the
Module 8.1B baseline. Therefore:

- existing courses receive only the deterministic `curriculum_version = 1`;
- existing ACTIVE, SUSPENDED, CANCELLED, and COMPLETED enrollments receive no
  progress root;
- lesson, block, event, and idempotency tables remain empty;
- no completion percentage, timestamp, last-visited lesson, or historical event
  is inferred;
- Module 8.2 may create a root only when its approved runtime use case requires
  one;
- any externally discovered legacy progress requires a separate approved data
  mapping and additive migration.

In particular, a pre-existing COMPLETED enrollment is not enough evidence to
reconstruct lesson/block history or the curriculum at completion. Fabricating
that history is prohibited.

## Constraint boundary

PostgreSQL `CHECK` constraints enforce same-row invariants:

- positive/nonnegative versions;
- nonnegative counts and completed counts not exceeding totals;
- exact floor-rounded course percentage;
- paired last-visited fields;
- persisted state/completion timestamp consistency;
- fixed event shape, transition, and terminal snapshot requirements;
- idempotency key, fingerprint, response status, result-version, and expiry
  validity.

PostgreSQL `CHECK` constraints cannot safely validate another table. Module 8.2
must validate inside its serializable transaction that:

- enrollment, lesson, block, and last-visited lesson belong to the same course;
- content is currently eligible;
- the supplied curriculum version equals the course version;
- enrollment status and actor capabilities permit the operation;
- event actor, event target, and idempotency record describe the same request.

Foreign keys preserve referenced history with `RESTRICT`. The nullable event
actor and idempotency-record references use `SET NULL`: approved
hard-delete/anonymization and bounded idempotency cleanup must not erase
progress history.

## Verification

After deployment:

1. Run `prisma migrate status`.
2. Run
   [`verification.sql`](../../backend/prisma/migrations/20260726190508_add_progress_tracking_schema/verification.sql).
3. Confirm all five progress tables are empty.
4. Run Prisma validation and generation.
5. Run the migration/constraint integration suite.
6. Run the idempotent permission seed and verify role assignments.

## Rollback

Prisma has no automatic down-migration mechanism. The provided
[`rollback.sql`](../../backend/prisma/migrations/20260726190508_add_progress_tracking_schema/rollback.sql)
is safe only before Module 8.2 writes progress data and only with explicit
operator approval.

Once progress exists, do not run the rollback script. Prefer a reviewed forward
fix or a data-preserving recovery migration. Migration tests exercise rollback
only inside a disposable isolated PostgreSQL schema.

## Module 8.2 gate

Module 8.2 remains blocked until architecture review approves:

- the physical schema and database constraints;
- migration/preflight/rollback evidence;
- permission assignments;
- content-module curriculum-version bump integration;
- transaction and repository implementation plans.
