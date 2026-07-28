# Certificate Eligibility Database Foundation

- **Module:** 8.5B
- **Foundation version:** 1.0.0
- **Runtime status:** Database foundation only
- **Authoritative contract:**
  [Course Completion and Certificate Eligibility Contract](./COURSE_COMPLETION_CERTIFICATE_ELIGIBILITY_CONTRACT.md)
- **Architecture decision:**
  [ADR-003](./design-system/decisions/ADR-003-course-completion-certificate-eligibility.md)

## Scope

Module 8.5B installs additive persistence for typed certificate-eligibility
policies and immutable enrollment-scoped evidence. It does not evaluate
eligibility, expose REST endpoints, issue or revoke certificates, or create
certificate artifacts.

Progress Tracking remains authoritative for course completion. The database
foundation never treats a current curriculum recount or a displayed percentage
as historical completion evidence.

## Persistence model

### `certificate_eligibility_policies`

The policy table stores immutable typed versions. V1 permits exactly:

- policy code `COURSE_COMPLETION_ONLY`;
- policy version `1`;
- assessment rule `NONE`;
- no attendance requirement;
- no manual-approval requirement.

The standard seed creates this policy idempotently. It verifies an existing
record rather than updating it.

### `certificate_eligibility_evaluations`

An evaluation records:

- one enrollment and its trusted course;
- one immutable policy version;
- one canonical completion and curriculum version;
- completion timestamp, lesson counts, and percentage;
- evaluation version and timestamp;
- system or user evaluator attribution;
- optional supersession linkage reserved for a later approved reevaluation
  contract.

Student identity is reached through the enrollment relation and is not copied
into evidence. Profile names, email addresses, tokens, raw activity, JSON
metadata, certificate artifacts, and client-calculated values are prohibited.

`NOT_COMPLETED` is derived and has no evaluation row. The v1 database accepts
only `ELIGIBLE` evidence whose completed and eligible lesson counts are equal
and positive and whose course percentage is exactly `100`.

### `certificate_eligibility_reasons`

Reason codes are normalized and constrained to the fixed contract vocabulary.
V1 eligible evidence cannot contain a reason. The table exists so a later
approved typed policy can extend the persistence contract without introducing
unrestricted JSON.

## Database-enforced invariants

- UUID primary keys and restrictive foreign keys preserve historical evidence.
- Composite enrollment-course integrity prevents evidence from being attached
  to the wrong course.
- Every evaluation requires an existing enrollment progress root.
- Policy code/version is unique.
- Evaluation version is unique within an enrollment.
- One enrollment, policy, and canonical completion version cannot produce
  duplicate evidence.
- Versions are positive.
- V1 evidence is `ELIGIBLE`, has more than zero eligible lessons, has equal
  completed and eligible lesson counts, and has percentage `100`.
- Evaluation cannot predate completion.
- Evaluator type and actor nullability are consistent.
- A row cannot supersede itself.
- Policy, evaluation, and reason rows reject update and delete operations.
- Eligible evidence rejects reason insertion.

## Transaction-enforced invariants for Module 8.5C

PostgreSQL `CHECK` constraints cannot validate mutable state in another table.
The future Module 8.5C serializable transaction must therefore verify:

- enrollment status is `COMPLETED`;
- enrollment completion timestamp matches the frozen snapshot;
- the progress root is frozen;
- the referenced completion version and curriculum version equal the root;
- exactly one matching `COURSE_COMPLETED` event exists;
- event snapshot counters equal the progress root;
- the selected policy is the approved active policy for the operation;
- evaluator authorization and any future supersession relation are valid.

No Module 8.5C behavior is implemented by this foundation.

## Migration safety and preflight

Migration:

`20260728120000_add_certificate_eligibility_foundation`

Before deployment, run the read-only
`backend/prisma/migrations/20260728120000_add_certificate_eligibility_foundation/preflight.sql`
against the exact target database using an operator-approved PostgreSQL client
that displays result sets.

The preflight reports:

- relation, enum-type, and function-name collisions;
- completed enrollment count;
- missing or unfrozen progress roots;
- invalid aggregate snapshots or versions;
- missing or ambiguous matching completion events;
- completion/freeze timestamp mismatches;
- the count of deterministic backfill candidates.

Any nonzero inconsistency count requires data-owner review. It does not authorize
automatic repair.

## Historical evidence and backfill

The schema migration creates no policy or eligibility rows. The standard seed
creates only the fixed v1 policy and permissions; it creates no evaluations.

Historical eligibility evidence must not be inferred from current lessons or
current course content. A future separately reviewed, idempotent data migration
may evaluate an existing completed enrollment only when all of these facts
already exist and agree:

1. enrollment status is `COMPLETED` and `completed_at` is non-null;
2. its progress root exists and `frozen_at` equals `completed_at`;
3. percentage is `100`;
4. eligible lesson count is positive;
5. completed and eligible lesson counts are equal;
6. completion and curriculum versions are positive;
7. exactly one `COURSE_COMPLETED` event matches the enrollment, versions,
   counters, percentage, and completion timestamp.

The future backfill must:

- run in bounded batches and serializable transactions;
- use database time as `evaluated_at`;
- attribute the decision to `SYSTEM`;
- reference the seeded immutable v1 policy;
- rely on the snapshot uniqueness constraint for safe reruns;
- report inconsistent rows without changing them;
- emit an approved audit record outside the evidence row.

If any required fact is missing, no evaluation is created. Operators must not
manufacture progress roots, completion events, timestamps, counts, versions, or
percentages.

## Rollback boundary

The migration includes an operator-reviewed `rollback.sql` aid. It is suitable
only before Module 8.5C writes eligibility evidence. Once evidence is referenced,
a reviewed forward fix or evidence-preserving recovery plan is required.
The aid refuses to run when an eligibility evaluation exists; it never treats
an operator warning as sufficient authorization to destroy immutable evidence.

## Permission seed

The existing RBAC seed adds only the approved identifiers:

- `certificate_eligibility.self_read`;
- `certificate_eligibility.course_read`;
- `certificates.self_read`;
- `certificates.course_read`;
- `certificates.issue`;
- `certificates.revoke`.

Student receives the two self-read permissions. Teacher receives the two
course-read permissions. Admin receives all six through the existing explicit
admin grant convention. These grants do not activate routes or runtime
capabilities.
