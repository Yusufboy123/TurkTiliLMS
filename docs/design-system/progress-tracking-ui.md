# Progress Tracking UI — Module #8 Preparation

**Status:** Module 8.1A contract review candidate; frontend implementation blocked

This document specifies presentation behavior. The proposed backend and API
contract is now defined by
[Progress Tracking Contract](../PROGRESS_TRACKING_CONTRACT.md),
[ADR-002](./decisions/ADR-002-progress-tracking-contract.md), and
[Progress Tracking OpenAPI](../openapi/progress-tracking.v1.yaml). These
artifacts remain review candidates and authorize no backend, database, package,
or frontend implementation until the approval gate is recorded.

## V1 scope

The UI prepares for:

- block and lesson completion;
- section and course aggregate progress;
- resume learning and last visited lesson;
- completion timestamps and completed courses;
- student self views;
- teacher/admin permitted reporting.

V1 explicitly excludes:

- streaks and achievements;
- video playback position/watch progress;
- client-inferred canonical progress;
- a chart package.

Future-compatible layout space may exist, but excluded features do not render
fake, local, disabled, or teaser values.

## Terminology

- Student navigation: `Jarayonim`.
- Course label: `Kurs jarayoni`.
- Teacher/admin reporting: `O‘zlashtirish`.
- Technical module name: `Progress Tracking`.

## Presentation model

The frontend maps approved API DTOs into explicit view models:

- `CourseProgressViewModel`
- `SectionProgressViewModel`
- `LessonProgressViewModel`
- `BlockProgressViewModel`
- `ResumeLearningViewModel`
- `CompletedCourseViewModel`
- `StudentProgressSummaryViewModel`
- `ProgressMutationViewModel`

No component receives Prisma records or derives business state from unrelated
DTO fields.

Every aggregate displays:

- numeric percentage;
- completed and eligible totals;
- textual state;
- API-provided update/completion time where available.

Simple displays use semantic HTML, CSS, or accessible SVG. No chart dependency
is approved.

## Course progress

Course cards and headers show `Kurs jarayoni`, textual completed/total values,
percentage, and the appropriate next action. A progress bar exposes min, max,
current value, and text.

- `0%`: not started.
- `1–99%`: in progress.
- `100%`: completed only when the authoritative API declares course completion.
- Unknown/stale: display last confirmed value with a visible refresh state; do
  not infer.

Adding or removing curriculum may change authoritative totals. The UI explains
that course content changed when the API returns a curriculum/version conflict.

## Section and lesson presentation

A section row includes title, completed/eligible lessons, percentage, and
expanded lesson list. A lesson includes status icon and text, completion time
when supplied, and lock/unavailability reason.

Completion:

- is idempotent from the user’s perspective;
- uses `Tugallash`;
- enters local `Tasdiqlanmoqda…` while pending;
- is confirmed only by the returned authoritative DTO;
- may expose `Qayta ochish` only if the approved contract permits reopening.

Reopening never locally subtracts percentages. It sends the mutation and waits
for authoritative aggregates.

## Resume learning and last visited lesson

`Kursni davom ettirish` uses the API-provided resume target. The client must not
choose a target by sorting incomplete lessons.

The card includes:

- course and lesson title;
- section/position context;
- last confirmed activity time;
- current authoritative course percentage;
- unavailable reason if enrollment/course state changed.

Last visited lesson is presentation metadata, not completion. The Module 8.1A
candidate defines an idempotent last-visited mutation for ACTIVE enrollment.
Opening a lesson never marks it or its blocks complete.

## Enrollment-state behavior

### Active

Read and permitted mutation controls are available. Capability flags from the
API determine complete/reopen availability.

### Suspended

Mutation controls are replaced by
`O‘qish jarayoni vaqtincha to‘xtatilgan.` Confirmed progress remains readable,
but mutation, activity recording, and resume are unavailable. A suspension
response during mutation wins over the local pending state.

### Cancelled

Mutation controls are removed. The frozen historical snapshot remains readable
to the owning student and authorized scoped viewers. Activity recording and
resume are unavailable. Copy uses `Kursdan chiqilgan`.

### Completed

Canonical completion is terminal and read-only in v1. Content may remain
available through separate content-access capabilities. Revisiting content uses
`Qayta ko‘rish`, changes no progress or activity state, and is not a
`Qayta ochish` transition. Certificate UI appears only after a future
certificate eligibility DTO confirms it.

## Mutation and reconciliation contract

The frontend never optimistically recalculates percentage, completed counts,
course completion, next lesson, or section totals.

1. User activates completion/reopen.
2. Only the affected control/row shows a local pending state and blocks duplicate
   activation.
3. Existing aggregate values remain visible and labeled as last confirmed.
4. Success replaces all affected values from the authoritative response.
5. Failure rolls the local state back, preserves the last confirmed aggregate,
   announces the failure, and provides a safe retry when eligible.

### Concurrent enrollment change

If suspension or cancellation occurs while a mutation is pending, the server
response or subsequent authoritative refetch removes mutation capability. The
client does not queue or replay the completion. The state explanation receives
focus only when action is otherwise impossible; routine refresh does not steal
focus.

### Curriculum revision conflict

If the response reports a curriculum/version conflict, the client:

- discards the pending visual state;
- retains the last confirmed aggregate as stale;
- refetches course structure and progress;
- announces `Kurs tarkibi yangilandi. Jarayon qayta yuklandi.`;
- never applies a local merge across curriculum versions.

### Idempotency and concurrency

Completion mutations require an idempotency key, `expectedCompletionVersion`,
and `curriculumVersion`. Last-visited mutations require an idempotency key and
`curriculumVersion`; they update a separate `activityVersion`. A repeated
identical operation resolves to the same authoritative state. A stale
completion or curriculum version is not silently retried as a write; refresh
and user review occur first.

## Loading model

### Initial loading

When no confirmed data exists, render geometry-matching skeletons with one
programmatic loading label. Do not render `0%` as a placeholder.

### Background refresh

Keep confirmed content visible, show a subtle refresh status, and announce only
the result or a meaningful state change. Background refresh never replays a
mutation or resets scroll/focus.

### Mutation pending

Pending is local to the activated item. The action label remains visible,
duplicate activation is blocked, and aggregate values do not animate.

## Student `Jarayonim` page

Hierarchy:

1. page heading and concise summary;
2. resume-learning card;
3. active course progress list;
4. completed courses;
5. filter/sort controls when counts justify them.

States include initial loading, background refresh, no enrollments, no matching
filter, unavailable API, offline confirmed data, suspended enrollment,
cancelled-read policy, and partial unknown future state.

The page does not contain streak or achievement sections in v1.

## Course player

The player shows compact authoritative `Kurs jarayoni`, section/lesson context,
and one completion control. At 320 px, the completion control occupies its own
first row; previous/next controls occupy the second row as specified in
[Responsive Design](./responsive.md).

Course-player keyboard rules follow
[Accessibility](./accessibility.md). No global single-character shortcut is
enabled by default.

## Teacher and admin reporting

Teacher `O‘zlashtirish` is limited to assigned/owned course scope. Admin views
are permission-filtered. The UI displays:

- student display identity appropriate to the role;
- enrollment state;
- authoritative percentage and completed/eligible counts;
- last confirmed activity;
- completed timestamp when supplied;
- pagination, search, and stable filters from the contract.

No view reveals session tokens, password state, private audit payloads, or
unnecessary staff identifiers. Exports require permission, clear scope,
step-up authentication for large personal-data exports, and audit.

## Accessible progress

- All visuals have equivalent text.
- Updates from successful mutations use a polite live region.
- Color is supplemental to label and icon/shape.
- SVG has an accessible name and textual data alternative.
- Teacher comparisons have a semantic list/table representation.
- Reduced motion disables aggregate tweening.

## Failure mapping

The eventual contract must map stable error codes to Uzbek Latin messages. At a
minimum it must distinguish:

- authentication/invalid token;
- forbidden scope;
- enrollment not active;
- course or lesson unavailable;
- block/lesson not eligible;
- curriculum/version conflict;
- invalid transition;
- idempotency conflict;
- validation failure;
- rate limit;
- unexpected service failure.

The UI does not invent exact codes before contract approval.

## Module #8 contract approval gate

Frontend implementation is blocked until all artifacts below are reviewed and
approved together:

- [ADR-002](./decisions/ADR-002-progress-tracking-contract.md);
- [Progress Tracking Contract](../PROGRESS_TRACKING_CONTRACT.md);
- [Progress Tracking OpenAPI](../openapi/progress-tracking.v1.yaml);
- OpenAPI operation and component schemas;
- exact self, teacher, and admin response DTOs;
- nullability for every field;
- pagination shape and maximum/default limits;
- stable course/section/lesson/block/enrollment state enums;
- stable error-code catalog and HTTP mapping;
- `completionVersion`, `activityVersion`, and `curriculumVersion` behavior;
- idempotency-key generation, scope, replay, and expiry contract;
- suspended and cancelled read behavior;
- reopen policy and completion timestamp semantics;
- curriculum-revision behavior;
- typed frontend DTO-to-view-model mapping;
- initial-loading, background-refresh, and stale-data states;
- item-level mutation-pending and rollback states;
- authorization/capability fields that avoid client inference.

Module 8.1A approval means OpenAPI parses and lints, examples match the
documented DTOs, internal links and formatting pass, security/privacy and other
named human reviews are recorded, and no blocking ambiguity remains. Runtime
example matching and runtime contract tests are required again in Module 8.2.
Until 8.1A approval, these documents remain proposals. Module 8.3 remains
blocked until the implemented Module 8.2 contract tests also pass and applicable
Design System approval is recorded.

## Future compatibility

- Quiz, assignment, and certificate milestones require their own approved
  contracts.
- Streaks and achievements may be considered after Module #8; no locally inferred
  streak is allowed.
- Video playback position is a separate future media-engagement capability and
  does not determine core Module #8 completion.
- Future native apps and the Telegram bot consume the same authoritative REST
  contract and must not calculate different progress rules.
