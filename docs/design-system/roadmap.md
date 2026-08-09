# Frontend Design-System Implementation Roadmap

**Status:** Review candidate

This dependency-driven roadmap does not authorize implementation or package
installation.

## Phase 0 — Approval gates

- Complete strict design-system re-review.
- Validate Uzbek terminology with a language editor.
- Approve original logo and art direction.
- Obtain legal/privacy approval for retention, privacy, and terms.
- Approve managed-content and support ownership.
- Record usability review of home, dashboard, and 320 px Course Player.

Inter-only typography, capability-gated registration, initial Module #8 scope,
video-position deferral, chart strategy, responsive navigation, and safe admin
branding are settled in [Product Decisions](./product-decisions.md).

## Phase 1 — Foundations

- Introduce semantic RGB-channel CSS variables and exact Tailwind 3.4 aliases.
- Migrate all raw UI/global colors to semantic tokens.
- Add type, spacing, radius, shadow, z-index, focus, and layout tokens.
- Load Inter Latin Extended and Cyrillic assets.
- Add contrast fixtures and raw-color prevention.
- Establish locale and error-code translation mapping.

Exit: light/dark semantic pairs pass calculated thresholds and no feature needs
raw product colors.

## Phase 2 — Accessible primitives

- Layout and surface primitives.
- Unified `Button`, `IconButton`, and `SplitButton`.
- `Input`, `FormField`, specialized behavioral fields, and validation.
- Overlay infrastructure: `Portal`, `FocusScope`, `Popover`, `Menu`,
  `Disclosure`.
- Feedback, `ErrorSummary`, `DataTable`, and `ResponsiveDataList`.

Exit: component contracts pass keyboard, focus, assistive-technology, 320 px,
long-locale, light/dark, and reduced-motion tests.

## Phase 3 — Shells and authentication

- Public shell and capability-gated registration entry.
- Student bottom nav, compact tablet rail, and desktop sidebar.
- Teacher/admin responsive shells and `RoleSwitcher`.
- Course-player shell.
- Login, recovery, forbidden, expired session.
- Define the step-up integration boundary. Do not implement the dialog,
  dedicated verification fallback, or protected-action return flow until the
  challenge, recent-auth, proof, expiry/error, return-context, and audit
  contracts are approved.

Exit: routing, focus, role context, protected-action return, and responsive shell
behavior are stable.

## Phase 4 — Public experience

- Home, catalog, and the contract-independent public/enrollment portions of
  course detail. Personalized progress and resume behavior wait for Phase 7.
- About, FAQ, Support only after content contracts.
- Privacy/Terms only after legal approval.
- Registration only when API capability and security review allow it.

Exit: the public journey meets release accessibility/performance budgets without
layout shift.

## Phase 5 — Contract-independent student learning

- Implement the contract-independent Course Player shell and responsive
  navigation.
- Implement feature-owned `ContentBlockRenderer`.
- Implement accessible media shells, transcripts, downloads, and fallbacks.
- Present existing enrollment lifecycle states without deriving progress.
- Exclude progress, completion, reopening, resume targets, aggregate
  percentages, progress mutations, streaks, achievements, and playback
  position.

A partially specified page or component does not authorize implementation of
its blocked behavior. The Course Player shell and lesson-content rendering may
proceed only where they consume already approved lesson, content-block, media,
and enrollment contracts.

Exit: an eligible student can navigate directly to and consume every supported
lesson-content type without client-derived progress or resume behavior.

## Phase 6A — Module 8.1A contract design and approval

Create and jointly approve, without runtime or database implementation:

- product policies and accepted ADR;
- OpenAPI operations and component schemas;
- exact student, teacher, and admin DTOs with nullability;
- pagination, enums, and stable error/HTTP mappings;
- concurrency and idempotency behavior;
- enrollment read policy and curriculum revision behavior;
- completion, reopening, timestamps, aggregates, and resume-target semantics;
- authorization/capability fields;
- logical data-model proposal;
- typed frontend DTO-to-view-model mapping;
- initial-loading, background-refresh, stale, mutation-pending, and rollback
  states.

No Prisma, migration, permission seed, runtime, package, or Module #8 frontend
change belongs to this phase.

Exit: the Module 8.1A ADR, product policy, contract specification, and OpenAPI
parse and lint; human product, architecture, security/privacy, accessibility,
and engineering approval is recorded.

## Phase 6B — Module 8.1B schema and migration

Only after Phase 6A approval:

- run the target-environment data and migration preflight;
- update Prisma schema;
- create an additive migration;
- seed approved permissions idempotently;
- execute the approved legacy backfill;
- verify database constraints, rollback strategy, and migration behavior.

Exit: schema validation/generation, migration deploy/status, backfill,
constraint, concurrency-foundation, and production-safety checks pass. No
progress endpoint or frontend behavior is implemented.

## Phase 6C — Module 8.2 backend progress engine

Only after Phase 6B:

- implement Repository → Service → Controller progress architecture;
- implement student progress reads and mutations from the approved OpenAPI;
- enforce service-level authorization and capabilities;
- implement serializable transactions, versions, idempotency, aggregates,
  resume selection, events, and enrollment completion integration;
- pass unit, route, PostgreSQL concurrency, security, and contract tests.

Exit: Module 8.2 runtime matches the approved OpenAPI and all backend,
PostgreSQL, compatibility, and production-error checks pass.

## Phase 7 — Module 8.3 student frontend integration

Only after Phase 6C and applicable Design System approval:

- implement Student Dashboard progress and resume regions;
- implement My Courses progress and completed-course states;
- integrate Course Player completion, reopening, resume, authoritative
  aggregates, and mutation reconciliation;
- implement `Jarayonim`;
- map approved DTOs into course/section/lesson/block progress view models.

Exit: authoritative progress and resume behavior render without client-owned
business rules, and frontend contract, accessibility, concurrency, and
reconciliation tests pass.

## Phase 8 — Teacher operations

- Course list, creation, and builder.
- Accessible reorder and content-block editing.
- Teacher Media after reuse/quota policy.
- Publish checklist, preview, and enrollment management.
- Module 8.4 teacher `O‘zlashtirish` only through the approved Module 8.1A
  reporting boundary and after Module 8.3.
- Settings after preference contracts.

Exit: normal teacher operations require no source edits.

## Phase 9 — Admin operations

- Module 9.4A defines and approves the fixed Admin Dashboard read contract,
  permissions, privacy boundary, route inventory, and OpenAPI without runtime
  work.
- Module 9.4B implements the approved Admin Dashboard backend aggregate and
  activates the OpenAPI operation without frontend work.
- Module 9.4C implements `/admin`, the role-aware redirect, summary UI, and only
  real permission-allowed quick links after Module 9.4B is verified.
- User lifecycle and step-up protected actions only after the step-up contract
  is approved.
- Roles/permission matrix after API/conflict policy.
- Course/enrollment/media management.
- Audit and permission-controlled export.
- Module 8.4 admin `O‘zlashtirish` only through the approved Module 8.1A
  reporting boundary and after Module 8.3.
- Typed safe business/brand settings.

Exit: every owner-managed module has graphical UI, permission, validation,
audit, destructive confirmation, and tests.

The three Admin Dashboard phases are sequential. Contract-only or partially
specified items do not authorize blocked backend or frontend behavior. The
existing `/admin/progress` route remains the admin landing destination until
Module 9.4C is complete.

## Phase 9.5 — Public landing, demo lesson, and reusable exercises

This stream is sequential and independently gated from the Admin Dashboard:

- **9.5A — Contract:** specify the public landing, one canonical published
  `Türk Alfabesi` preview, eight typed exercise kinds, server grading,
  short-lived anonymous attempts, results/skills, reachable public audio,
  threat model, page behavior, ADR, and OpenAPI. No schema or runtime work.
- **9.5B — Persistence foundation:** only after approval, add the reviewed
  exercise aggregate/revision/placement, demo mapping, private grading, media
  usage, attempt snapshot/idempotency/expiry cleanup, permissions, typed owner
  settings, and seed foundation through additive schema/migration work. No
  endpoint or frontend activation.
- **9.5C — Public/admin backend runtime:** implement public projection, isolated
  attempts, typed graders, idempotency/concurrency, result/retry/reset, shared
  limits, cleanup, media delivery/usage reporting, and typed authorized/audited
  exercise revision, placement, mapping, preview, publish/archive, restore, and
  reorder APIs.
- **9.5D — Public/admin frontend:** implement `/` and
  `/demo/turk-alfabesi`, typed renderers, feedback/results, and secure graphical
  owner editors for landing content, exercises/revisions, localization,
  placement/reorder, demo mapping, media attachment/usage, validation, preview,
  publication/archive, and restore. Include responsive/accessibility behavior
  and only activated 9.5C contracts; never expose a generic code/JSON editor.
- **9.5E — Contact/placement request:** separately approve and implement typed
  channel capabilities, privacy/retention, provider adapters, owner workflow,
  abuse controls, and honest request status. Do not claim automatic placement.
- **9.5F — Course Player reuse:** integrate the reusable exercise capability
  into enrolled lessons only after authenticated attempt, progress, completion,
  and analytics semantics are separately approved. Anonymous evidence is never
  promoted.

Exit: one accessible public demo uses canonical published lesson content and
server-authoritative exercises without exposing answer keys, broadening later
lesson access, or contaminating enrollment progress. Approval or completion of
one subphase does not authorize the next.

## Phase 10 — Hardening

- Full four-locale review.
- Dark-mode and forced-colors validation.
- Release Core Web Vitals and bundle budgets.
- Browser/assistive-technology matrix.
- Visual regression and duplicate-component audit.
- Offline/retry and form-preservation verification.
- Art rights/cultural review.

## Intentional future work

- Streaks and achievements.
- Video playback-position/media engagement.
- Notifications.
- Broad teacher/system analytics.
- Module 8.5A: approve the completion and certificate-eligibility contract.
- Module 8.5B: add the approved eligibility schema, migration, permission seed,
  preflight, and evidence-safe backfill.
- Module 8.5C: implement eligibility evaluation, approved read APIs, and
  read-only completion/eligibility UI.
- Module 8.6: separately approve and implement certificate issuance,
  revocation, templates, artifacts, verification, and delivery.
- Public registration, if later approved.
