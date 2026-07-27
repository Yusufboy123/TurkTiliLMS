# ADR-003: Separate Completion, Eligibility, and Certificate Lifecycles

- **Status:** Proposed for Module 8.5A approval
- **Date:** 2026-07-27
- **Decision owners:** Product, architecture, progress, backend, database,
  security/privacy, frontend, and accessibility
- **Implementation status:** Contract only

## Context

Progress Tracking v1 already makes course completion terminal,
enrollment-scoped, backend-authoritative, and atomic with the final eligible
lesson completion. The architecture blueprint anticipates certificates, but no
approved contract previously defined when completion becomes certificate
eligibility or how an issued certificate relates to that decision.

Treating completion, eligibility, and certificate issuance as one status would
couple independent concerns:

- completion is learning evidence owned by Progress Tracking;
- eligibility is a policy decision over immutable evidence;
- a certificate is a separately issued and revocable credential.

The platform must also preserve historical decisions when curriculum, course
metadata, learner profiles, or eligibility policies change.

## Decision

### Separate authoritative lifecycles

Course completion, certificate eligibility, and certificate lifecycle are
orthogonal.

- Progress Tracking remains the only authority for course completion.
- Certificate Eligibility consumes the frozen completion snapshot and creates a
  versioned evidence decision.
- A future Certificate module issues or revokes a certificate by referencing an
  immutable eligible evaluation.
- `CERTIFIED` is a composite UI label, not a stored eligibility state.

Certificate revocation does not rewrite course completion or erase the
eligibility evidence used at issuance.

### Completion-only v1 policy

The sole v1 eligibility policy is `COURSE_COMPLETION_ONLY`, version `1`.

Assessment scores, attendance, manual approval, AI decisions, and client
activity are not eligibility inputs. Adding any of them requires a typed policy
variant, contract review, policy version, evidence definition, and migration
plan.

### Immutable versioned evidence

Eligibility evidence is enrollment-scoped and records the canonical completion
and policy versions needed to reproduce the decision. It excludes mutable
profile snapshots, raw activity, assessment answers, unrestricted JSON, and
certificate artifacts.

New completions should create eligibility evidence in the same serializable
transaction as terminal course completion. Existing completed enrollments may
be backfilled only when their frozen evidence is internally complete.

### Historical stability

Curriculum changes, course archival, profile edits, and prospective policy
updates do not silently recalculate completed eligibility or issued
certificates. Re-enrollment is evaluated independently.

### No expiry in v1

The v1 certificate lifecycle is `NOT_ISSUED -> ISSUED -> REVOKED`. Expiry,
renewal, reissue, public verification, and artifact generation require later
contracts.

### Capability-driven, API-first clients

Web, mobile, iOS, Android, Telegram, and future clients consume the same
versioned REST DTOs and backend capabilities. They do not infer eligibility
from a progress percentage or completion badge.

## Consequences

### Positive

- Progress completion retains one authoritative algorithm.
- Eligibility decisions remain reproducible and auditable.
- Certificate revocation cannot corrupt learning history.
- Policy evolution does not silently invalidate historical achievements.
- Each enrollment lifecycle has independent evidence.
- Clients receive explicit states and permissions.
- Future assessment policies can be added without redefining course completion.

### Costs

- Module 8.5B requires additive policy/evidence persistence rather than a
  boolean on the enrollment.
- The progress completion transaction needs a reviewed integration boundary in
  Module 8.5C.
- Legacy completed enrollments require evidence preflight before backfill.
- Certificate issuance remains blocked until step-up, template, numbering, and
  artifact contracts are approved.

## Rejected alternatives

### Infer eligibility whenever percentage is 100

Rejected because a displayed aggregate is not sufficient evidence of the
terminal enrollment transition, frozen snapshot, curriculum version, or policy
version.

### Store `isCertificateEligible` on the enrollment

Rejected because a boolean cannot retain policy version, evidence, reason,
evaluation history, or future supersession.

### Combine `ELIGIBLE`, `CERTIFIED`, and `REVOKED` in one state column

Rejected because certificate revocation and eligibility are independent. The
combined model would either erase evidence or make valid transitions
ambiguous.

### Recalculate historical eligibility from current curriculum

Rejected because completed progress is frozen and current course content may no
longer match the curriculum used at completion.

### Add generic JSON policy rules

Rejected because core certification policy must be typed, validated,
queryable, auditable, and safe for a non-programmer admin workflow.

### Let administrators manually override completion

Rejected because it would bypass the canonical progress engine. A future manual
eligibility-review policy, if approved, must remain separate from course
completion.

## Implementation sequence

1. **Module 8.5A:** Approve contract, ADR, and documentation-only OpenAPI.
2. **Module 8.5B:** Additive schema, migration, permission seed, preflight,
   backfill plan, and database tests.
3. **Module 8.5C:** Eligibility evaluation, read APIs, authorization, audit, and
   read-only frontend states.
4. **Module 8.6:** Separately approved certificate issuance, revocation,
   template, numbering, artifact, verification, and delivery work.

No milestone begins automatically.

## Approval gates

This ADR becomes accepted only when:

- product accepts completion-only v1 eligibility;
- progress and backend owners approve the transaction boundary;
- database owners approve immutable versioned evidence;
- security approves permissions, object scope, and step-up dependencies;
- privacy approves evidence and audit retention;
- accessibility approves the frontend status contract;
- OpenAPI and the canonical contract contain no blocking contradiction.

## References

- [Canonical Contract](../../COURSE_COMPLETION_CERTIFICATE_ELIGIBILITY_CONTRACT.md)
- [Documentation-only OpenAPI](../../openapi/course-completion-certificate-eligibility.v1.yaml)
- [Progress Tracking Contract](../../PROGRESS_TRACKING_CONTRACT.md)
- [Progress Tracking ADR](./ADR-002-progress-tracking-contract.md)
- [Progress Tracking UI](../progress-tracking-ui.md)
