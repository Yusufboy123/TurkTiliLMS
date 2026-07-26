# Product Decisions for V1

**Status:** Review candidate

These decisions settle the implementation-blocking questions from the first
design-system review. Reversing an architectural decision requires an ADR.

## Typography

**Decision:** Use Inter only for v1. Font delivery must include Latin Extended
and Cyrillic support. A second display font is not approved.

**Reason:** One complete family reduces loading, fallback, and multilingual
layout risk while hierarchy remains available through weight and scale.

## Public registration

**Decision:** Launch accounts are invitation-based or administrator-created.
Registration UI is controlled by an API capability/configuration response and
is absent when disabled. The client does not infer availability.

**Future change:** Public self-registration requires abuse prevention,
verification, consent, privacy, support, and OpenAPI review.

## Streaks and achievements

**Decision:** Exclude streaks and achievements from initial Module #8. No fake,
locally inferred, disabled teaser, or placeholder metric is displayed.

**Future compatibility:** Navigation and DTOs must not reserve meaningless
fields. Add the feature through a later contract and product-behavior review.

## Video playback position

**Decision:** Exclude playback position from core Module #8. It is a separate
future media-engagement capability and cannot determine canonical completion
without a later policy.

## Progress Tracking v1 policies

**Status:** Accepted architecture direction; Module 8.1A approval record pending.

The detailed contract is in
[Progress Tracking Contract](../PROGRESS_TRACKING_CONTRACT.md), and the
architectural rationale is in
[ADR-002](./decisions/ADR-002-progress-tracking-contract.md).

**Identity:** Canonical progress belongs to one enrollment lifecycle. Lesson and
block progress use enrollment-scoped identity. Cancelled re-enrollment receives
a new progress root; suspended reactivation keeps the existing root.

**Enrollment state:** Only ACTIVE enrollment permits progress mutation.
SUSPENDED progress remains readable but has no mutation or resume target.
CANCELLED progress is frozen, historical, and read-only. COMPLETED progress is
terminal, frozen at 100 percent, and has no mutation or resume target.

**Content access:** Content access is separate from progress mutation. A
completed learner may receive content revisit capability without changing last
visit, activity, completion, aggregate, resume, or canonical state. Use
`Qayta ko‘rish` for a revisit and reserve `Qayta ochish` for a progress-state
transition.

**Completion:** Eligible blocks may be completed manually. Lesson completion is
explicit and requires all eligible required blocks. Optional blocks may be
completed but do not enter denominators or prerequisites. A lesson with zero
required blocks may be explicitly completed. Opening a lesson never completes
it.

**Reopen:** Blocks and lessons may reopen only while the enrollment is ACTIVE
and course progress is not terminal. Completed course progress cannot reopen in
v1.

**Course completion:** Completing all eligible lessons atomically completes the
ACTIVE enrollment only when at least one eligible lesson exists. No separate
course-completion button exists.

**Curriculum:** ACTIVE and SUSPENDED progress follows the current published
curriculum version. CANCELLED and COMPLETED snapshots remain frozen. Stale
curriculum mutations fail and require authoritative refresh.

**Versions:** Completion state, visit activity, and curriculum use separate
`completionVersion`, `activityVersion`, and `curriculumVersion` concepts.

**Resume:** Resume is a backend-selected lesson target. Clients do not sort
incomplete lessons and receive no playback seconds or block offsets.

**Retention:** The 24-hour idempotency, 13-month detailed-event, and canonical
completion retention periods remain proposals until privacy/legal approval.

**Legacy data:** Module 8.1B requires a target-environment preflight. Historical
snapshots must not be invented when the original curriculum cannot be
reconstructed.

## Charts

**Decision:** Initial simple progress displays use semantic HTML, CSS, and
accessible SVG. Do not add a chart package.

**Review trigger:** A dependency may be proposed only when comparative
visualization needs cannot be met accessibly within the component and bundle
budgets.

## Admin-editable brand settings

**Decision:** The graphical admin panel may manage only:

- logo;
- favicon;
- theme mode;
- approved, contrast-tested primary/accent presets.

Arbitrary CSS, JavaScript, token strings, font URLs, and layout code are
prohibited. Presets are allowlisted and pass the same contrast fixtures as the
default theme.

## Data retention

**Proposed defaults:**

- detailed learning activity: 13 months;
- admin/security audit: 24 months;
- canonical completion: retained as legally and product-required.

**Approval dependency:** These are not production policy until legal and privacy
owners approve purpose, jurisdiction, deletion/anonymization behavior, backup
handling, export, and user-notice requirements. The admin panel must not expose
unapproved retention controls.

## Responsive and accessibility decisions

- Below 768 px student navigation is bottom navigation.
- From 768–1023 px it is a 72 px compact icon rail.
- At 1024 px and above it is an expanded/collapsible sidebar.
- The 320 px Course Player uses a full-width completion row plus a second
  previous/next row.
- Global single-character shortcuts are disabled by default; scoped/remappable
  behavior follows [Accessibility](./accessibility.md).

## Module #8 gate

Progress UI implementation remains blocked until OpenAPI, DTOs, nullability,
pagination, enums, error codes, concurrency, idempotency, enrollment read
behavior, view-model mapping, and loading/mutation states are jointly approved.
Module 8.1A provides review candidates for these artifacts but does not approve
implementation. See [Progress Tracking UI](./progress-tracking-ui.md),
[Progress Tracking Contract](../PROGRESS_TRACKING_CONTRACT.md), and
[Progress Tracking OpenAPI](../openapi/progress-tracking.v1.yaml).
