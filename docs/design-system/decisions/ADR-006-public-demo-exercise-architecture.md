# ADR-006: Public demo and reusable exercise architecture

- **Status:** Proposed
- **Date:** 2026-08-09
- **Decision owners:** Product, architecture, backend, frontend,
  security/privacy, accessibility, and content operations
- **Implementation status:** Module 9.5A contract only;
  `contract-only-not-available`

## Context

Turk Tili LMS needs an honest public landing page and one free interactive
lesson that demonstrates real learning value before registration or enrollment.
The current domain already has courses, sections, published lessons,
`isPreview`, lesson content blocks, managed media, enrollment access, and
progress. It does not have a reusable interactive exercise or anonymous attempt
domain.

A demo-specific hard-coded quiz would duplicate lesson content, make correct
answers inspectable, and create a dead-end implementation that cannot later
serve the authenticated Course Player. Reusing enrollment progress would invent
an enrollment for an anonymous visitor and contaminate progress, completion,
statistics, and certificate evidence. Storing graders or answer keys in public
lesson-block metadata would weaken type safety and risk leaking private data.

The decision must preserve the API-first modular monolith, backend authority,
safe owner administration, existing lesson publication/access rules, and a
future path from the demo to the real player without prematurely approving a
Prisma design.

## Decision

### 1. Use the canonical published preview lesson

`/demo/turk-alfabesi` resolves one configured slug to an existing
`Course -> Section -> Lesson` chain. Every ancestor must be currently public,
the lesson must be published and `isPreview=true`, and deleted, archived,
unpublished, or inconsistent resources fail closed. The demo is not a separate
content source and it does not make later lessons public.

The authority is an owner-managed, audited mapping with globally unique
normalized demo slug and exactly one lesson target, not a route constant or a
section slug (the current `CourseSection` has no slug). Enabling a mapping
atomically validates the public chain and exactly 12 active placements.

### 2. Introduce a reusable exercise aggregate beside content blocks

An exercise aggregate is a stable typed learning-activity identity. Its
immutable numbered revisions atomically contain a closed public presentation
and corresponding private grading definition, skill tags, points, feedback, and
first-class managed-media usages. A lesson-exercise placement has separate
identity and lifecycle and attaches an exact published revision (or reviewed
audio/text-equivalent pair) to a lesson in deterministic unique order. Existing
lesson content blocks remain the explanatory/media content boundary.

The server composes a delivery projection from safe lesson blocks and safe
exercise projections. A future player may expose a unified ordered `LessonItem`
union or staged items, but persistence shape and interleaving are deferred to
the schema phase. The domain concepts in this ADR are not Prisma model names.

The initial closed type registry is:

- `LETTER_CHOICE`
- `AUDIO_TO_LETTER`
- `AUDIO_TO_WORD`
- `MISSING_LETTER`
- `MATCHING`
- `WORD_ASSEMBLY`
- `MULTIPLE_CHOICE`
- `QUICK_ROUND`

Each type has a discriminated public payload, discriminated submitted response,
validator, and backend grader. `QUICK_ROUND` contains only bounded sub-prompts
using approved primitives; it cannot carry arbitrary executable schemas.
Every public exercise and sub-prompt schema is closed under OpenAPI 3.1 and
rejects undeclared private grading fields.

Revision lifecycle is `DRAFT -> IN_REVIEW -> PUBLISHED -> ARCHIVED`, with review
rejection returning to draft. Only drafts are editable; review submission
freezes the candidate; published/archived revisions are immutable; restore or
correction clones a new draft. Placement lifecycle is
`DRAFT -> ACTIVE -> ARCHIVED`, and restore also clones a draft. Archive is
restricted while active placements depend on a revision. Publication,
placement, order, mapping, presentation, and media-reference changes increment
the lesson curriculum revision and its strong public ETag.

This lesson-owned revision drives exercise snapshots and public projections; it
is not the course-owned `Course.curriculumVersion` used by Progress Tracking.
When Module 9.5F makes these exercises part of authenticated Course Player
eligibility or deterministic order, affected changes increment both revisions
atomically. Initial Course Player activation increments each affected published
course version so existing enrollment progress is not silently reinterpreted.

### 3. Separate public projection from private grading

The projection service selects only renderable fields. The grading definition
contains correct choice/pair/order, accepted normalization, and private
feedback rules and is available only to the grading service. Opaque choice and
tile IDs carry no semantic correctness. Graders reject any identifier outside
the immutable attempt snapshot.

Lesson-content audio, exercise-prompt audio, and terminal-feedback audio are
separate projections. Instructional and terminal audio may expose a reviewed
transcript; a pre-answer exercise prompt exposes only a non-answer-bearing
functional label. `TEXT_ALTERNATIVE` is a separately gradeable published
equivalent selected before snapshot creation, never a prompt transcript.

Correctness, points, streak, XP, completion, result totals, and per-skill
evidence are server-derived. No client DTO, lesson-block metadata, media
identity, or option order is an answer key.

### 4. Use a separate ephemeral anonymous attempt service

Starting the demo deep-snapshots the ordered closed public projections and
private grading definitions and creates a short-lived attempt. A pseudorandom
256-bit bearer capability is derived with a versioned managed secret, attempt
UUID, and stored random nonce. Persistence keeps the nonce/key version and token
digest, not the raw token. This permits bounded exact idempotent reconstruction
without raw-token idempotency storage. The non-secret UUID is never sufficient
authority. The client keeps the token in memory; refresh starts over.

The attempt service owns ordering, typed per-exercise submission policy, expected-version
concurrency, idempotency, retry lineage, reset, expiry, retention, and result
projection. It stores no PII or account/enrollment association. Demo evidence
cannot be promoted into enrollment progress, course completion, analytics, or
certificate evidence.

The dedicated `X-Demo-Attempt-Token` header avoids the shared client's ambient
Bearer authentication/refresh path. Creation, answer, retry, and reset require
idempotency keys with a 15-minute exact replay window. Reset retains only a
bounded replay-only check for its old digest/key/fingerprint; it cannot revive
the old attempt. Missing/malformed capability is `401`; unknown ID and a
well-formed nonmatching token are indistinguishable `404`; a matching expired,
abandoned, or revoked attempt is `410`.

Creation specifically requires a cryptographically random client-generated
UUIDv4 idempotency key. Because anonymous creation is scoped by demo slug and a
privacy-safe network HMAC, this unguessable key prevents unrelated clients on a
shared network from receiving each other's token-bearing replay. Later
capability-authorized commands retain the normal bounded idempotency-key format.

`absoluteExpiresAt` is creation plus two hours; `idleExpiresAt` is the lesser of
30 minutes after the last accepted mutation and the absolute deadline;
`effectiveExpiresAt` is their minimum. `GET`/`HEAD` never mutate version or
expiry. No keepalive exists in v1.

The closed lifecycle is `IN_PROGRESS -> COMPLETED`, reset from `IN_PROGRESS` to
`ABANDONED`, revocation from a reachable state to `REVOKED`, and deterministic
`EXPIRED` at `effectiveExpiresAt`. Retry leaves the parent `COMPLETED`; v1 has no
`SUPERSEDED` state.

### 5. Reveal feedback progressively

The first incorrect answer returns a learning hint without the correct answer.
A second incorrect answer terminally reveals only that exercise's correct
concept and explanation. A first-try correct answer earns full points; a
second-try correct answer earns half. Retry-all and retry-incorrect create new
attempts with fresh capabilities but select the same immutable parent snapshot
versions; reset alone selects the current curriculum. This balances instruction with
bounded resistance to bulk answer harvesting.

### 6. Deliver managed media through role-specific authorization

Current explanatory lesson-block audio is served through the public demo-lesson
resource path only while it remains in the visible published projection.
Exercise-prompt and terminal-feedback audio use a separate attempt resource path
and require the matching capability plus an unexpired, non-revoked snapshot.
Terminal feedback additionally requires its exercise or sub-prompt to be
terminal, and its URL is not serialized earlier. This prevents a previously
observed feedback-media URL from revealing an answer to another attempt while
preserving in-flight snapshot media across ordinary placement changes.

Terminal-feedback media is answer-bearing by default: an active usage cannot
also be public lesson or prompt media, and one enabled demo mapping cannot reuse
it across exercise/sub-prompt grading contexts. Publication enforces this
cross-role and cross-context isolation before a snapshot can reference it.

The service enforces inspected MIME allowlists, single-range semantics, cache
validators, rate/bandwidth limits, and generic not-found behavior. It never
accepts an authored remote URL or reveals a storage path. Mapping/ancestor
unpublication and security withdrawal revoke both surfaces. V1 matches current
managed audio policy: MP3 and WAV only. Range applies to GET only; HEAD is
bodyless; authorized conditional requests return `304`. Public lesson media
uses `public, max-age=0, must-revalidate`; attempt media uses
`private, no-store`. The later media implementation adds provider-neutral
`stat` and `openRange` capabilities whose strong validator derives from managed
content identity/digest, length, MIME, and the relevant public revision or
attempt snapshot/state.

### 7. Keep acquisition and contact capability-gated

The landing page always promotes the free demo and may promote the public course
catalog. A teacher/contact action appears only when a typed server capability is
approved and enabled. The action requests information or placement guidance; it
does not promise automatic placement, enrollment, group availability, or a
response time. Provider-specific Telegram, phone, WhatsApp, and form behavior
belongs to later adapters and workflows.

### 8. Deliver in sequential modules

- 9.5A: contract, ADR, OpenAPI, and documentation only.
- 9.5B: approved additive schema/migration and operational content boundaries.
- 9.5C: public and typed admin APIs for exercise/revision/placement/mapping,
  projection, attempts, graders, media usage/delivery, audit, limits, and cleanup.
- 9.5D: landing/demo frontend and secure graphical owner administration for
  exercises, revisions, placements, mapping, landing content, localization,
  media attachment/usage, validation, preview, lifecycle, restore, and reorder.
- 9.5E: contact/placement request capability.
- 9.5F: authenticated Course Player integration and separately approved
  progress semantics.

No phase is implicitly authorized by approval of the preceding contract.

### 9. Preserve immutable snapshots across ordinary curriculum changes

Attempt snapshots deep-copy the exact public presentation, private grader,
point/skill rules, locale/audio variant, media usage, placement order, and
curriculum revision. `ALL` retry copies every parent snapshot item;
`INCORRECT_ONLY` copies only terminal incorrect items; neither silently upgrades
versions. Reset creates a current standard 12-item snapshot.

Ordinary placement/revision archival affects only new attempts. Disabling the
demo mapping or making its course/section/lesson non-public revokes active
attempts, as does an explicit exercise/media security withdrawal. Public media
always requires current reachable publication. Existing attempts otherwise
remain coherent without mutable current-version lookups.

Published exercise revisions, active placements, and unexpired snapshots are
first-class managed-media usages with `Restrict` deletion and owner-visible
usage reporting. The authenticated Course Player later reuses the same
aggregate, revisions, placements, graders, projection, scoring, and media usage;
only its authorization/evidence adapter differs from the anonymous attempt.

## Consequences

### Positive

- The demo uses genuine course content and publication rules.
- The same exercise capability can later support enrolled learning without
  copying a hard-coded demo engine.
- Correct answers and scoring remain behind a typed server boundary.
- Anonymous use does not create accounts, enrollments, invasive tracking, or
  polluted progress evidence.
- Each exercise type can be independently validated, graded, tested, localized,
  and rendered accessibly.
- Media access is least-privilege and revokes automatically when preview
  reachability changes.
- Contact conversion remains honest and operationally manageable.

### Costs and constraints

- The schema phase must model versioned public/private definitions, placement,
  immutable snapshots, expiry cleanup, and transactions carefully.
- A shared atomic rate limiter and cleanup mechanism are production
  prerequisites; process memory is not sufficient.
- Public exercises cannot completely prevent answer discovery. The design
  limits bulk harvesting but prioritizes useful feedback over secrecy.
- Refresh intentionally loses an in-memory anonymous attempt. Persistent resume
  would require a separately reviewed browser credential design.
- Owner administration needs typed editors and preview/version workflows rather
  than a generic JSON or code editor.
- Real Course Player progress integration remains a distinct policy and cannot
  be inferred from demo scoring.

## Rejected alternatives

### Hard-code the demo in React

Rejected because it duplicates domain content, exposes scoring logic, bypasses
publication/media policy, cannot be owner-managed safely, and is not reusable by
other clients.

### Add exercise-shaped values to generic lesson-block metadata

Rejected because the existing public projection intentionally omits metadata;
mixing presentation and answer definitions in an untyped JSON field creates
leakage, validation, versioning, and administration risks.

### Add many exercise variants directly to the lesson content-block enum

Rejected for 9.5A because content delivery and graded interaction have different
privacy, snapshot, mutation, concurrency, and lifecycle responsibilities. A
stable composed delivery projection preserves reuse without prematurely
expanding persistence.

### Reuse enrollment progress for anonymous visitors

Rejected because there is no authorized enrollment, it would pollute progress
and completion evidence, and it could accidentally affect statistics or
certificate eligibility.

### Grade entirely in the browser

Rejected because answer keys become public, results are forgeable, and scoring
would diverge across web, mobile, Telegram, and future clients.

### Persist the attempt token in a cookie or browser storage

Rejected for v1. Cookies introduce ambient authority and CSRF policy; browser
storage extends the theft and telemetry surface. A memory-only capability is a
deliberate privacy/security tradeoff for an 8–12 minute demo.

### Use public object-storage URLs or arbitrary remote audio URLs

Rejected because reachability cannot be revoked reliably, storage topology
leaks, author input can become an SSRF/tracking/open-redirect vector, and content
inspection/range/rate policy would be inconsistent.

### Create one generic answer JSON schema and grader

Rejected because invalid states would be easy to represent and every renderer
and grader would need unsafe runtime guessing. Closed discriminated unions keep
validation, accessibility, scoring, and evolution explicit.

## Approval gates

This ADR may become Accepted only after:

1. product and Turkish-language review of the 12-exercise sequence, feedback,
   retry scoring, XP terminology, and honest conversion copy;
2. architecture approval of exercise ownership, versioning, placement,
   projection, attempt isolation, and future player boundary;
3. security/privacy approval of capability handling, 30-minute idle/2-hour
   absolute lifetime, 24-hour deletion, HMAC network keys, rate limits, media
   policy, and logging;
4. accessibility approval of audio alternatives, keyboard matching/assembly,
   live regions, focus, reduced motion, zoom, and 320 px layouts;
5. API approval of
   [public-demo.v1.yaml](../../openapi/public-demo.v1.yaml); and
6. content-operations approval of typed owner management and publication.

Acceptance of this ADR does not activate an API operation or authorize schema,
migration, seed, package, runtime, frontend, deployment, contact-provider, or
Course Player work.

## References

- [Public Landing and Demo Lesson Contract](../../PUBLIC_LANDING_DEMO_LESSON_CONTRACT.md)
- [Project Architecture](../../PROJECT_ARCHITECTURE.md)
- [Page Inventory](../page-inventory.md)
- [Page Specifications](../page-specifications.md)
- [Design-System Roadmap](../roadmap.md)
- [Public Demo OpenAPI](../../openapi/public-demo.v1.yaml)
