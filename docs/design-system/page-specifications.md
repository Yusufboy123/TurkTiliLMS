# Page Specifications

**Status:** Review candidate

## Shared page contract

Every specified route has a unique document title, one `h1`, a named main
landmark, route-change focus placement, permission-aware action hierarchy,
localized copy, and 320 px through wide-screen behavior. Initial loading,
background refresh, empty, no-results, error, forbidden, offline, conflict,
pending, and success states are included when applicable.

The API remains authoritative for authentication, authorization, lifecycle,
content access, and capabilities. Pages consume response DTOs/view models, not
persistence records.

### Route loading and bundle boundaries

Every route is lazy at the smallest stable feature boundary and renders its
page-level loading/error boundary inside the owning shell:

| Boundary       | Routes                                                                                                                |
| -------------- | --------------------------------------------------------------------------------------------------------------------- |
| Public core    | `/`, `/courses`, and `/courses/:slug`; course detail may lazy-load media preview                                      |
| Authentication | `/login`, recovery routes, capability-gated registration, and dedicated step-up each use auth-owned chunks            |
| Student shell  | `/app` destinations are route-level chunks inside one student shell                                                   |
| Course Player  | `/learn/:enrollmentId/lessons/:lessonId` is an isolated player chunk; heavy media/document viewers load by block type |
| Teacher shell  | Dashboard, courses/builder, enrollment, media, progress, analytics, and settings are feature-route chunks             |
| Admin shell    | Dashboard and every management domain are separate feature-route chunks                                               |

Shared primitives are not duplicated into feature chunks. Route boundaries
must meet the exact gzip budgets in
[Implementation Guidelines](./implementation-guidelines.md#measurable-performance-contract).

## Public pages

### Home — Specified

**Purpose and hierarchy:** Announcement → public header → outcome-led hero →
course categories → featured courses → benefits → verified statistics → how it
works → teacher trust → consented testimonials → FAQ → final action → footer.

**Actions:** Primary `O‘rganishni boshlash` routes to the server-provided
capability: registration only when enabled, otherwise login/invitation guidance.
Secondary `Kurslarni ko‘rish`.

**States/access:** Public. Dynamic course/statistic failures remain local.
Authenticated visitors receive a valid role destination. Owner manages visible
sections through typed admin content; legal/security copy remains controlled.

**Responsive/accessibility:** One-column hero below 1024 px; stacked actions at
320 px; one eager intrinsic-size LCP image. No auto-rotating testimonial.
Disclosures, announcement dismissal, landmarks, and artwork text alternatives
follow the shared contracts.

### Course catalog — Specified

**Hierarchy:** Heading → labeled search → primary filters → result count/sort →
course cards → pagination → support. Desktop filter rail begins at 1024 px;
below it filters use a drawer.

**States:** Initial card skeletons, background refresh, URL-persisted filters,
no results with clear-filter action, local retry, and hidden unavailable
courses. Public DTO only; authenticated enrollment state may personalize the
action.

**Accessibility:** Filter fieldsets, announced result count, current pagination,
stable image dimensions, and no status communicated by color alone.

### Course detail — Partially Specified

**Hierarchy:** Identity/outcome → state-aware enrollment/continue card → trust
metadata → outcomes → curriculum → teacher → prerequisites → FAQ.

**Actions:** `Kursga yozilish`, `Kursni davom ettirish`, or a noninteractive
completed state from API capability. Enrollment pending prevents duplicate
activation.

**Responsive/access:** Public published data; preview only when permitted.
Desktop has a 360 px sticky decision card; mobile has a focus-safe sticky action.
Unpublished/missing resolves safely without revealing hidden content.

**Missing dependency:** The personalized Module #8 progress and authoritative
resume-target DTO is not approved. The public course content remains defined,
but the state-aware continue experience is not implementation-ready.

### Login — Specified

**Hierarchy/action:** Focused 420 px email/password form, recovery path,
`Kirish`, and registration/invitation path only when capability permits.

**States/security:** Generic invalid-credential copy; expired-session reason;
safe intended-route return; password cleared after security-sensitive failure;
rate-limit and network states. Authenticated users redirect only to an
authorized destination.

**Accessibility:** Autocomplete, visible labels, password reveal, Caps Lock
guidance, `ErrorSummary`, no time-limited interaction.

### Registration — Specified but capability-gated

Launch policy is invitation/admin-created accounts. The route and all entry
points are absent when the API capability is disabled. If enabled later, the
page contains account fields, visible password rules, terms/privacy
acknowledgement, verification guidance, error summary, and safe
account-enumeration behavior. Enabling it requires the product/security review
in [Product Decisions](./product-decisions.md).

### Forgot and reset password — Specified

Forgot password uses a labeled email field and always returns neutral
nonenumerating guidance. Reset password handles valid, expired, used, malformed,
pending, and success token states; paste/password managers are allowed; new
password requirements are visible before entry. Both retain safe input and
offer a clear path to login.

### Step-up verification — Partially Specified

The dedicated `/verify-action` route is the fallback for redirect providers,
recovery, or flows that cannot safely fit a dialog. It:

- explains identity verification without exposing hidden permission details;
- renders the provider-authorized method;
- supports cancel and safe return;
- handles failure, rate limit, timeout, session expiry, and inaccessible target;
- discards proof when action context changes;
- returns to a fresh confirmation of the original protected action.

It follows the same focus, form-error, secret-retention, timeout, and audit
contract as `StepUpAuthenticationDialog`.

Logout, session replacement, password change/reset, account deactivation, or
authorization loss discards the local challenge/proof and returns to a safe
reauthentication state. Passwords and raw proofs are never persisted in browser
storage, URLs, analytics, or error telemetry.

**Approval dependency:** Module 8.6A now defines the password-based challenge,
ten-minute recent-auth determination, five-minute challenge, two-minute
single-use proof, user/session/action/target binding, verification and expiry
errors, allowlisted continuation context, rate limits, and audit events in the
[Certificate Issuance and Lifecycle Contract](../CERTIFICATE_ISSUANCE_LIFECYCLE_CONTRACT.md).
That contract is a Review Candidate. The route remains Partially Specified and
must not be implemented until Module 8.6A architecture approval.

### Managed public content — Partially Specified

| Page    | Minimum page contract                                                        | Blocking decision                    |
| ------- | ---------------------------------------------------------------------------- | ------------------------------------ |
| About   | Managed heading, mission, teaching approach, trust evidence, contact action  | Content schema and approval workflow |
| FAQ     | Searchable categorized disclosures, no-results state, support action         | Content/search contract              |
| Support | Supported channels, availability, request guidance, privacy notice           | Channel ownership and SLA            |
| Privacy | Version/effective date, contents navigation, readable legal content, contact | Legal text/version approval          |
| Terms   | Version/effective date, contents navigation, readable legal content, contact | Legal text/version approval          |

These pages use one 720 px reading column, print cleanly, support deep links to
headings, and never ship placeholder legal or support commitments.

### Public certificate verification — Partially Specified

`/verify/certificates/:verificationToken` uses a focused public shell with the
platform identity, one `h1`, verification status, certificate number, approved
recipient-name disclosure, course and organization snapshots, issue date, and
optional revoked date/reason code. Valid and revoked results use text plus icon,
not color alone. Unknown and malformed tokens share one generic not-found state.
An approved recipient-name suppression returns a valid status with the name
omitted rather than exposing mutable profile data.

The page does not expose internal IDs, email, enrollment data, actor data,
artifact access, audit detail, or the raw token in its title, telemetry, or
visible debug output. It is excluded from search indexing, sets
`Referrer-Policy: no-referrer`, loads no third-party resources or analytics,
never forwards the token-bearing route into telemetry, supports retry after
network failure, and uses a single 720 px reading column down to 320 px.

**Approval dependency:** The route, privacy DTO, 256-bit token, hash-only
storage, rate limit, revoked projection, no-store caching, and QR deferral are
defined by the Module 8.6A Review Candidate. Implementation remains blocked
until Module 8.6A architecture and privacy-disclosure approval.

## Student pages

### Student dashboard — Partially Specified

**Hierarchy:** Greeting → dominant resume-learning card → current courses →
compact recent learning summary → next permitted action. Initial v1 excludes
streaks, achievements, and fake recommendations.

**States/access:** Student self data only. New student receives catalog/onboarding
guidance. Suspended/cancelled state replaces mutation actions with explanations.
Partial failures keep successful regions usable. Cached offline content is
labeled.

**Responsive/accessibility:** Resume appears immediately after heading at
320 px. Student navigation follows bottom-nav/compact-rail/sidebar rules.
Progress values have equivalent text and use authoritative data only.

**Missing dependency:** The Module #8 resume target, current progress, recent
activity, and enrollment-state DTOs are not approved.

### My courses — Partially Specified

Heading → Active/Completed/Other tabs → filters → course records. Active course
offers `Kursni davom ettirish`; completed is read-only; suspended and cancelled
use canonical labels. Cards become a list at 320 px. Tabs become a select only
when tested translations cannot fit. No active courses links to catalog.

**Missing dependency:** Module #8 course progress, completed-course, and
authoritative resume-target DTOs are not approved.

### Course Player — Partially Specified

**Desktop/container layout:** Compact progress header; optional 320 px curriculum
rail; centered lesson region; optional 360 px notes/inspector only when the
player container is at least 1280 px and the lesson region remains at least
720 px. Otherwise supporting regions are drawers.

**320 px layout:** 56 px top bar with Back, truncated course identity, and
curriculum trigger. Lesson content follows. Sticky actions use a full-width
completion row and a second equal `Oldingi`/`Keyingi` row with 44 × 44 px minimum
targets. Extra actions use a labeled overflow menu. The player-owned sticky
region replaces the global student bottom navigation, uses logical inline
padding, and adds `env(safe-area-inset-bottom)` to its bottom padding.

**Exit:** The top-bar Back control is always present and returns to the last
authorized course/curriculum destination; when safe history is unavailable it
routes to `/app/courses`. The global bottom navigation is not mounted on this
route.

**Behavior:** Use API-provided resume target and curriculum order. Completion
shows local pending only; aggregates update from authoritative response.
Individual media failure remains local. Suspension/cancellation removes
mutation controls. Curriculum conflicts refetch without local merge.

**Content:** Captions/transcripts, no autoplay, accessible download fallback,
meaningful image alt, external-link destination, file type/size, and safe
unknown-block state.

**Keyboard/accessibility:** No default global single-character shortcut.
Scoped/remappable shortcuts and excluded typing contexts follow
[Accessibility](./accessibility.md). Focus-safe sticky controls, current lesson
announcement, semantic headings, and non-color states are release requirements.

**Missing dependency:** Module #8 completion, reopening, resume target, conflict,
and aggregate-refresh response DTOs are not approved.

### Jarayonim — Partially Specified

Heading → resume-learning → active course progress → completed courses →
filter/sort when needed. It displays no streak or achievement region. Initial,
background-refresh, mutation-pending, stale, enrollment-state, and conflict
behavior is specified in
[Progress Tracking UI](./progress-tracking-ui.md). Implementation remains
blocked until Module #8 contract approval.

### Profile — Specified

Identity summary → editable profile → account activity/session entry points.
Primary `O‘zgarishlarni saqlash`. States: dirty, saving, saved, field error,
conflict, and unsaved-navigation confirmation. Role/status are read-only.
Password and sessions use dedicated secure flows.

### Student settings — Partially Specified

Categorized locale, notification, theme, and accessibility preferences.
Immediate switches are used only for safely reversible settings; grouped changes
use a form footer. Locale updates document language; system reduced-motion is
respected by default. Owner-configurable themes are approved presets only.

**Missing dependency:** Typed locale, theme, accessibility, and notification
preference read/write DTOs and capability behavior are not approved.

### Achievements and notifications — Deferred

No routes, navigation, fake counters, or placeholder data ship until their
module contracts are approved.

### Certificate detail — Partially Specified

`/app/certificates/:certificateId` presents the authenticated student's own
certificate snapshot, issued or revoked status, certificate number, course,
organization, issue date, and server-provided capabilities. An issued
certificate offers `Sertifikatni yuklab olish`; a revoked certificate removes
student download and explains that the credential is invalid.

Loading, background refresh, offline-stale, not found, forbidden, revoked,
artifact unavailable, and download failure are distinct. Download never exposes
a provider URL or storage path. Success/failure is announced once; focus moves
to the updated status heading. At 320 px, actions stack and long certificate
numbers wrap without horizontal page scroll.

**Approval dependency:** The private detail/download DTOs, ownership policy,
artifact delivery headers, revoked-download behavior, and React Query
invalidation are defined by the Module 8.6A Review Candidate. Implementation
remains blocked until Module 8.6A approval and the 8.6E runtime contract is
available.

## Teacher pages

### Dashboard — Partially Specified

Assigned-course summary → draft/review blockers → recent actionable learning
signals → media issues → quick actions. No assigned courses explains
administrator assignment. Analytics failure does not block course work.

**Missing dependency:** The Module #8 teacher-scoped learning-signal response,
privacy minimization, and authorization contract is not approved.

### Course list and creation — Specified

Course list provides create → status tabs → search/filter/sort →
`DataTable`/`ResponsiveDataList`. Scope is API-authoritative. Creation is a
Basics → Audience/level → Teacher/access → Review stepper with preserved back
navigation, error summary, and an explicit draft-creation policy.

### Course builder — Specified

Structure rail → editor → contextual inspector. Mobile separates regions into
screens/drawers. It covers setup, curriculum, block editor, preview, and publish
checklist; saving/conflict, workflow states, missing media, validation,
permission change, and offline restriction are visible. Reorder has keyboard
controls and live announcements.

### Enrollment list — Specified

Course context → summary → URL filters → paginated
`StudentProgressDataTable`-style enrollment records → detail. Teacher scope,
student minimization, lifecycle confirmation, conflict handling, and audited
permission-controlled export are mandatory.

### O‘zlashtirish views — Partially Specified

Course list and student detail hierarchy, enrollment state, authoritative
percent/counts, last activity, completion time, pagination, and accessible
table/list representation are defined. No override or motivational inference is
allowed. Implementation is blocked by Module #8 response and authorization
contracts.

### Teacher Media — Partially Specified

Upload/reuse search → category/status filters → media records → detail/replace/
soft-delete actions. File validation and per-file progress/error are defined by
shared components. Quotas, ownership transfer, cross-course reuse, and retention
policy require approval before this page becomes Specified.

### Teacher Analytics — Deferred

No broad analytics page ships until Statistics contracts, privacy minimization,
metric definitions, and accessible visualization needs are approved.

### Teacher Settings — Partially Specified

Self profile, locale, theme, notifications, and session entry points are
anticipated. Exact notification and session DTOs remain blocking.

### Teacher certificate detail — Partially Specified

`/teacher/courses/:courseId/certificates/:certificateId` is a read-only,
course-scoped status surface linked from progress reporting. It shows only the
management DTO fields permitted to an assigned teacher and never renders issue,
revoke, reissue, or artifact-download controls.

**Approval dependency:** The course-scoped read DTO, assignment check, audit
event, and teacher download prohibition are defined by the Module 8.6A Review
Candidate. Implementation remains blocked until Module 8.6A approval and the
8.6E runtime contract is available.

## Admin pages

### Dashboard — Partially Specified

The `/admin` page is governed by the Module 9.4A
[Admin Dashboard Read Contract](../ADMIN_DASHBOARD_READ_CONTRACT.md). Its first
release contains only server-authoritative user, course, enrollment, progress,
and certificate lifecycle summary cards. It does not display recent audit
activity, pending moderation, background-operation state, or unsupported
analytics.

Only registered, implemented routes for which the authenticated administrator
has permission may appear as quick links. At the Module 9.4A baseline,
`/admin/progress` is the only such destination. Proposed and deferred routes
must not render as live or disabled promises. No secret, infrastructure
credential, personal-data list, audit metadata, certificate token/hash, or
artifact/storage field is displayed.

The page must provide initial loading, valid zero-data, complete success,
retryable error, permission-denied, and expired-session states. Cards reflow
from 320 CSS pixels, use semantic headings and localized number formatting, and
never derive new metrics in the browser.

**Blocking dependency:** Module 9.4A architecture approval and Module 9.4B
implementation of `GET /api/v1/admin/dashboard/summary` are required before
Module 9.4C may register and implement `/admin` or change the admin post-login
redirect.

### Users and user detail — Partially Specified

List: create → search/filter → selection context → `DataTable`/responsive
records. Detail: identity/status → profile → roles → sessions/activity → audit
history → danger zone. Account lifecycle uses confirmation, soft restoration
where valid, audit, and stable conflict states.

Role changes, administrator creation, privilege escalation, another user’s
password reset, broad session revocation, and deletion/anonymization invoke
step-up authentication. Passwords, reset/session tokens, JWTs, raw credentials,
and unnecessary IP data never render.

**Missing dependency:** Step-up protected-action dependency: challenge API;
recent-auth determination; short-lived proof contract; proof binding to the
protected action; verification and expiry errors; return-to-action context; and
audit events.

### Course moderation — Specified

Submission summary → linked checklist → semantic preview → teacher/content
metadata → decision. Approve/publish requires eligibility; return-for-changes
requires a reason. Concurrent workflow changes refetch safely and decisions are
audited.

### Enrollment management/detail — Specified

Statistics/filter → paginated records → detail → permitted lifecycle transition.
States include eligibility change, conflict, active, suspended, cancelled, and
completed. Explanations never expose database constraints.

### Audit log — Partially Specified

Date/action/actor/subject filters → read-only timeline/data records → safe detail
drawer. Sensitive values are redacted. Export requires dedicated permission,
and large personal-data export requires step-up. Audit records cannot be edited
or deleted from this UI.

**Missing dependency:** Step-up protected-action dependency for large
personal-data export: challenge API; recent-auth determination; short-lived
proof contract; proof binding to the export action; verification and expiry
errors; return-to-action context; and audit events.

### Admin Roles and Permission Matrix — Partially Specified

Roles show name, description, assignment count, and allowed actions. The matrix
groups human-readable capabilities with sticky context, change summary, and
keyboard operation. Every change requires least privilege, confirmation,
step-up, and audit. Exact assignment dependencies, protected roles, API DTOs,
and conflict rules remain blocking.

### Admin Courses — Partially Specified

A unified search/filter/list and moderation entry are defined. Bulk workflow
rules and cross-owner reassignment remain unresolved; only the specified
moderation page may ship first.

### Admin Media — Partially Specified

Global media search, owner/category/status filters, safe preview, soft delete,
restore, and reference visibility are intended. Global quota, orphan cleanup,
retention, and cross-owner policy remain blocking.

### Admin O‘zlashtirish — Partially Specified

Permission-filtered aggregate → course/student filters → paginated records →
read-only detail/export. Large export requires step-up and audit. It is blocked
until Module #8, privacy minimization, and export contracts are approved.

### System Analytics — Deferred

No route ships until metric definitions, retention, privacy, performance, and
accessible visualization contracts are approved.

### Admin Settings — Partially Specified

Typed categories may manage logo, favicon, theme mode, approved contrast-tested
presets, and safe business settings. Security-sensitive changes use step-up and
audit. Secrets, infrastructure settings, arbitrary CSS/JavaScript, code, and
unvalidated key/value editing are prohibited. Exact typed schemas and
environment-owned boundary must be approved before implementation.

### Admin certificate detail and actions — Partially Specified

`/admin/courses/:courseId/certificates/:certificateId` presents immutable
snapshot, evidence and template references, lifecycle version, artifact
availability, and capability-driven actions. Issuance begins from an eligible
enrollment detail and shows recipient, course, evidence, and template snapshots
before explicit confirmation. Revocation uses a danger confirmation with typed
reason, optional bounded note, and expected version. Both protected actions
invoke step-up and return to a fresh confirmation; neither trusts page-derived
eligibility.

Administrators with the dedicated download permission may retrieve issued or
revoked artifacts for an audited operational purpose. The UI offers no delete,
restore, arbitrary template code, reissue, PDF edit, or QR action in the initial
release.

**Approval dependency:** The issue/revoke/download API, step-up contract,
idempotency behavior, immutable lifecycle, capability matrix, confirmations,
error catalog, and audit events are defined by the Module 8.6A Review Candidate.
Implementation remains blocked until Module 8.6A approval and the relevant
8.6C–8.6F runtime phase is available.
