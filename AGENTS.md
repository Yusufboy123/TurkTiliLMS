# Turk Tili LMS Development Guide

## Authority and scope

This file is the permanent development guide for the entire Turk Tili LMS
repository. It applies to every human contributor, coding agent, automation,
frontend package, backend package, script, migration, and document inside this
repository.

Requirements in an active task take precedence when they are more specific.
They do not silently override security, data integrity, or quality requirements.
If a task conflicts with this guide, identify the conflict before implementation
and request a deliberate decision when the conflict cannot be resolved safely.

The keywords **MUST**, **MUST NOT**, **SHOULD**, **SHOULD NOT**, and **MAY** are
normative. “Current” describes what is implemented now; “target” describes the
required direction for future implementation.

Before changing code:

1. Read this file and the relevant documentation in `docs/`.
2. Inspect the affected feature, contracts, tests, and configuration.
3. Preserve unrelated user changes and existing architecture.
4. Define the smallest complete solution, including validation and failure
   behavior.
5. Prefer a durable design over a patch that merely hides a symptom.

No task is complete until its behavior, types, lint, tests, build, documentation,
security impact, and compatibility have been considered.

---

## 1. Project Vision

Turk Tili LMS is a scalable Turkish language learning platform built around one
authoritative backend and multiple clients:

- React web application
- Android application
- iOS application
- Telegram bot
- Future trusted integrations

The platform should provide structured courses, lessons, exercises,
assessments, dictionary tools, learning progress, teacher workflows,
notifications, statistics, certificates, and bounded AI assistance.

The project MUST remain API-first. PostgreSQL and server-side business logic are
never accessed directly by user-facing clients. Every client consumes stable,
versioned API contracts and receives the same authorization and business rules.

The default application language is **Uzbek written in the Latin script**.
Uzbek UI copy should be natural, respectful, concise, and consistent. The
system MUST be designed from the beginning to support additional interface and
content languages without redesigning domain models or client architecture.

The architecture should support growth without premature distribution.
A well-structured modular monolith is preferred until independent scaling,
ownership, reliability, or compliance requirements justify extracting a
service.

---

## 2. Development Principles

### 2.1 Non-negotiable principles

- Always preserve the API-first architecture.
- Always prefer scalable, maintainable, production-grade solutions.
- Never add a quick fix, temporary workaround, unexplained compatibility shim,
  or knowingly fragile implementation.
- Never leave commented-out alternatives, abandoned code, or unresolved
  placeholders in completed work.
- Follow SOLID principles and keep modules cohesive.
- Prefer composition over inheritance.
- Prefer reusable components and focused abstractions.
- Never duplicate business rules, validation logic, query logic, or UI
  behavior.
- Separate business logic from HTTP transport, database persistence, and
  presentation.
- Use feature-based architecture for product capabilities.
- Keep frontend and backend loosely coupled through explicit API contracts.
- Keep provider-specific code behind adapter interfaces.
- Make invalid states difficult to represent and impossible to persist when
  practical.
- Default to least privilege, deny by default, and fail safely.
- Optimize for readability and predictable behavior before cleverness.
- Delete obsolete code when a replacement is complete and verified.
- Do not expand the task into speculative functionality.

### 2.2 SOLID application

- **Single Responsibility:** A component, function, class, or module has one
  clear reason to change.
- **Open/Closed:** Extension should normally occur through composition,
  configuration, or adapters rather than repeated modification of stable core
  behavior.
- **Liskov Substitution:** Implementations of an interface must preserve its
  contract, error semantics, and invariants.
- **Interface Segregation:** Prefer narrow, capability-specific interfaces over
  broad service objects.
- **Dependency Inversion:** Domain services depend on abstractions, while
  Prisma, storage, queues, email, Telegram, and AI providers implement those
  abstractions.

### 2.3 Decision rules

- Solve root causes, not symptoms.
- Prefer explicit code to hidden convention when the convention is not
  established.
- Introduce a dependency only when it materially reduces risk or maintenance
  and cannot be satisfied cleanly by the existing stack.
- Record decisions that affect security, data ownership, API compatibility, or
  deployment as Architecture Decision Records.
- When requirements are ambiguous, choose the option that preserves data,
  compatibility, security, and future extensibility.

---

## 3. Technology Stack

### 3.1 Current frontend

- React
- Vite
- TypeScript
- React Router
- Tailwind CSS
- Axios

### 3.2 Current backend

- Node.js
- Express
- TypeScript
- REST API
- Prisma ORM
- PostgreSQL
- Zod for validation
- Helmet and CORS
- Pino HTTP for structured request logging

### 3.3 Current development tools

- npm workspaces
- ESLint
- Prettier
- Git

### 3.4 Stack governance

- Preserve npm workspaces and the existing package boundaries.
- Use the repository lockfile and npm; do not introduce another package manager.
- Do not replace a core framework or ORM without an approved architecture
  decision and migration plan.
- Pin or range dependencies consistently with the repository policy.
- Review release notes before major upgrades.
- Never add packages that duplicate an installed capability without a documented
  reason.
- Production infrastructure such as Redis, a queue, object storage, CDN, or a
  search engine must be introduced behind an abstraction and only when a feature
  requires it.

---

## 4. Folder Structure Rules

### 4.1 Repository boundaries

```text
TurkTiliLMS/
├── frontend/             Web client
├── backend/              REST API and server-side domain logic
├── docs/                 Architecture and operating documentation
├── package.json          Workspace orchestration
└── AGENTS.md             Repository development policy
```

- Frontend-only dependencies belong in `frontend/package.json`.
- Backend-only dependencies belong in `backend/package.json`.
- Root dependencies are limited to shared repository tooling.
- Generated build output, environment files, secrets, and local artifacts MUST
  NOT be committed.

### 4.2 Frontend feature structure

New product functionality SHOULD use:

```text
frontend/src/
├── app/                  Bootstrap, providers, router, and global boundaries
├── features/
│   └── <feature>/
│       ├── api/          Feature-specific API functions
│       ├── components/   Feature presentation components
│       ├── hooks/        Feature orchestration hooks
│       ├── pages/        Route-level feature pages
│       ├── schemas/      Client input schemas
│       ├── types/        Feature-owned client types
│       └── index.ts      Public feature API
├── components/           Truly shared UI components
├── layouts/              Public, student, teacher, and admin layouts
├── lib/                  API client and framework-independent infrastructure
├── styles/               Global styles and design tokens
├── locales/              Translation resources
└── types/                Cross-feature types only
```

- Features may import shared infrastructure.
- Features MUST NOT import another feature's private files.
- Cross-feature behavior belongs in an explicit shared module or service only
  when it is genuinely shared.
- Barrel files expose a deliberate public API; they must not create circular
  dependencies.

### 4.3 Backend feature structure

Backend features SHOULD be cohesive modules:

```text
backend/src/
├── config/
├── infrastructure/
├── middlewares/
├── modules/
│   └── <domain>/
│       ├── <domain>.routes.ts
│       ├── <domain>.controller.ts
│       ├── <domain>.service.ts
│       ├── <domain>.repository.ts
│       ├── <domain>.schemas.ts
│       ├── <domain>.types.ts
│       └── index.ts
├── routes/
├── utils/
├── app.ts
└── server.ts
```

- Routes compose HTTP endpoints.
- Controllers translate HTTP input and output.
- Services own use cases, domain policy, and transaction boundaries.
- Repositories own persistence queries.
- Infrastructure adapters own external providers.
- Domain services MUST NOT depend on Express request or response objects.
- Controllers MUST NOT query Prisma directly.
- One module MUST NOT mutate another module's data by bypassing its service.

### 4.4 File placement

- Place code at the narrowest correct scope.
- Do not create a generic `helpers`, `common`, or `utils` dumping ground.
- Shared utilities must be small, domain-independent, and demonstrably reused.
- Colocate tests with the unit or feature unless the test spans multiple
  packages.
- Keep configuration centralized, validated, and environment-driven.

---

## 5. React Development Standards

### 5.1 Components

- Use function components and React hooks.
- Keep components focused on presentation and user interaction.
- Move reusable orchestration and side effects into feature hooks or services.
- Prefer composition and explicit props over oversized configuration objects.
- Never place authoritative business rules in React components.
- Avoid components that fetch, transform, validate, authorize, and render in one
  file.
- Extract a component when it is reused or when extraction creates a meaningful
  responsibility boundary, not merely to reduce line count.
- Use semantic HTML before building custom interactive elements.

### 5.2 State

Classify state before implementing it:

- Server state belongs in an API-aware caching or feature service layer.
- URL state belongs in route parameters or query parameters.
- Form state belongs near the form.
- Ephemeral UI state belongs near the component that owns it.
- Cross-application state requires an explicit, minimal provider.

Do not copy server state into multiple stores. Do not store derived values when
they can be computed safely. Do not persist credentials or sensitive profile
data in browser local storage.

### 5.3 Hooks and effects

- Hooks must have one clear responsibility.
- Follow the Rules of Hooks without exception.
- Dependencies must be complete; never silence dependency lint rules to hide a
  design problem.
- Use effects only to synchronize with external systems.
- Do not use effects for values that can be derived during render.
- Cancel obsolete requests and prevent stale response races.
- Cleanup subscriptions, timers, observers, and event listeners.

### 5.4 Routing

- Define routes in a central route registry or feature route exports.
- Use route-level lazy loading for substantial feature areas.
- Use layouts for shared navigation and role-specific shells.
- Route guards are user-experience controls only; backend authorization remains
  mandatory.
- Unknown routes must render an accessible not-found experience.
- Preserve useful state in the URL for filters, pagination, tabs, and deep
  links.

### 5.5 API use

- Components MUST NOT instantiate Axios or construct API base URLs.
- Use the shared Axios client and feature API functions.
- Normalize API errors before presentation.
- Show deliberate loading, empty, success, partial, offline, and error states.
- Prevent duplicate mutations caused by repeated clicks or retries.
- Use request cancellation when navigating away or replacing a query.

### 5.6 Reusability

- Shared UI components should be controlled by stable, typed props.
- Avoid domain-specific assumptions in generic components.
- Reusable components must support keyboard use, focus states, disabled states,
  errors, and responsive layouts.
- Do not create a second button, form control, modal, toast, or table pattern
  when a suitable shared primitive exists.

---

## 6. TypeScript Standards

### 6.1 Compiler discipline

- Keep strict TypeScript settings enabled.
- New code must pass `npm run typecheck`.
- Do not weaken compiler settings to make code compile.
- Do not use `// @ts-ignore` or `// @ts-nocheck`.
- `// @ts-expect-error` is allowed only when the expected error is documented,
  tested, and cannot be modeled safely.

### 6.2 Types

- Never use implicit `any`.
- Avoid explicit `any`; use `unknown` and narrow it.
- Prefer domain-specific types over primitive strings and numbers where mistakes
  would be costly.
- Use discriminated unions for state machines and result variants.
- Use interfaces for stable object contracts and types for unions,
  transformations, and composition.
- Prefer readonly data where mutation is unnecessary.
- Avoid broad type assertions. Assertions must follow runtime validation or an
  invariant that is obvious in the same scope.
- Avoid non-null assertions unless initialization is guaranteed by the platform
  and cannot be represented more safely.

### 6.3 Boundaries

- Validate runtime data before treating it as a TypeScript type.
- API response types describe contracts; they do not prove runtime validity.
- Keep database types, domain types, and API DTOs conceptually separate.
- Do not expose Prisma-generated types as public API contracts.
- Shared types between packages require a deliberate shared contract package;
  do not import backend implementation files into the frontend.

### 6.4 Functions and errors

- Public functions and module exports should have intentional return types.
- Prefer small pure functions for transformations.
- Use named parameters through typed objects when argument order is ambiguous.
- Never throw strings or plain objects.
- Model expected business failures separately from unexpected programmer or
  infrastructure errors.

---

## 7. Tailwind CSS Standards

### 7.1 Design system

- Use Tailwind utilities and centralized theme tokens.
- Brand colors, typography, spacing, radii, shadows, and breakpoints should come
  from the theme rather than repeated arbitrary values.
- Extend existing tokens before introducing near-duplicates.
- Preserve the established red-and-white brand identity unless a product task
  intentionally changes it.
- Shared visual patterns belong in reusable React components, not copied class
  strings.

### 7.2 Class usage

- Keep class lists readable and organized consistently.
- Use a class composition utility when conditional variants become complex.
- Avoid inline styles unless a value is genuinely dynamic and cannot be modeled
  as a token.
- Avoid arbitrary values when an existing token communicates intent.
- Never use `!important` as a routine conflict-resolution tool.
- Do not add custom CSS for behavior already expressed clearly by Tailwind.

### 7.3 Responsive and state variants

- Build mobile-first using unprefixed base utilities.
- Add breakpoint overrides only when the layout requires them.
- Define hover, focus-visible, active, disabled, invalid, and loading states.
- Respect `prefers-reduced-motion`.
- Do not make essential information available only on hover.

---

## 8. Backend (Express) Standards

### 8.1 Application boundaries

- `app.ts` configures Express and middleware.
- `server.ts` owns process startup, listener lifecycle, and graceful shutdown.
- Feature routes are composed under the versioned router.
- Controllers remain thin and transport-focused.
- Services implement use cases and domain rules.
- Repositories encapsulate Prisma.
- Provider integrations use adapters.

### 8.2 Middleware order

Use a deliberate order:

1. Proxy and request identity configuration
2. Security headers
3. CORS
4. Correlation and request logging
5. Body parsing with strict size limits
6. Authentication
7. Route-specific validation and authorization
8. Versioned routes
9. Not-found handling
10. Central error handling

The exact order may vary only when its security and behavior are understood.

### 8.3 Server behavior

- API processes must remain stateless.
- Validate environment variables at startup and fail fast.
- Do not start in a partially configured state.
- Implement graceful shutdown for the HTTP listener and opened resources.
- Apply explicit request body limits and timeouts.
- Do not perform long-running work in the request process.
- Queue media, notification, statistics, certificate, and AI workloads.
- Health endpoints should distinguish basic process liveness from dependency
  readiness when production infrastructure is introduced.

### 8.4 Dependencies

- Do not pass Express objects into domain services.
- Do not use global mutable state for application data.
- Centralize database, queue, cache, and provider clients.
- External calls require timeouts, bounded retries, and observable failures.
- Retries are allowed only for safe or idempotent operations.

---

## 9. REST API Standards

### 9.1 Version and resources

- All public routes MUST live under `/api/v1` until a deliberate new version is
  introduced.
- Use plural resource nouns and standard HTTP methods where practical.
- Avoid action verbs in paths unless the operation is not naturally modeled as
  a resource transition.
- Keep URL paths lowercase and hyphen-separated.
- Resource identifiers exposed publicly should be non-sequential and difficult
  to enumerate.

### 9.2 HTTP semantics

- `GET` reads and has no side effects.
- `POST` creates a resource or starts a non-idempotent operation.
- `PUT` replaces a complete resource only when replacement semantics are valid.
- `PATCH` performs a partial update.
- `DELETE` removes or revokes according to documented lifecycle rules.
- Use status codes consistently and never return success for a failed operation.
- Return `201` with a resource location for successful creation when practical.
- Return `204` only when no response body is needed.

### 9.3 Contracts

- Request and response DTOs must be explicit and documented.
- Use ISO 8601 UTC timestamps.
- Use stable machine-readable error codes.
- Never expose stack traces, SQL, provider secrets, or internal exception
  details.
- Collection endpoints must use consistent pagination, filtering, and sorting.
- Prefer cursor pagination for large or rapidly changing collections.
- Clients must be able to ignore additive response fields.
- Publish and maintain an OpenAPI contract before external clients depend on a
  feature.

### 9.4 Compatibility

- Additive optional fields are normally backward-compatible.
- Removing fields, renaming fields, changing meanings, or making optional input
  required is breaking.
- Breaking changes require a new API version or an explicit migration period.
- Deprecations must be documented and observable.
- Mobile compatibility windows must account for old installed application
  versions.

### 9.5 Reliability

- Mutations that may be retried should accept idempotency keys.
- Webhooks and asynchronous callbacks must be authenticated, deduplicated, and
  replay-safe.
- Use correlation IDs in responses and logs.
- Rate-limit by route sensitivity, identity, and network source as appropriate.

---

## 10. Prisma Standards

### 10.1 Schema ownership

- Prisma is the backend persistence tool; it must never be imported by the
  frontend.
- Organize schema definitions by clear domain ownership if the Prisma version
  and toolchain support multi-file schemas; otherwise use documented sections.
- Model names are singular PascalCase.
- Field names are camelCase.
- Database table and column mapping should be consistent and intentional.
- Define relations, uniqueness, indexes, defaults, and referential actions
  explicitly.

### 10.2 Data access

- Prisma queries belong in repositories or dedicated persistence adapters.
- Select only fields required by the use case.
- Avoid unbounded queries.
- Detect and eliminate N+1 access patterns.
- Do not return raw Prisma records directly from controllers.
- Map persistence results to domain objects or response DTOs.
- Use transactions for operations that must succeed or fail atomically.
- Keep transactions short; never wait on email, storage, AI, or other network
  providers inside a database transaction.

### 10.3 Migrations

- Every schema change requires a reviewed migration.
- Never edit a migration that has been applied in a shared environment.
- Never use `prisma db push` as the production migration strategy.
- Migration names must describe the domain change.
- Data migrations must be restartable, observable, and safe for existing data.
- Destructive changes require backup, compatibility, and rollback or
  forward-fix planning.
- Apply expand-and-contract migrations for zero-downtime breaking changes.

### 10.4 Client lifecycle

- Use one managed Prisma client per application process.
- Disconnect cleanly during shutdown where required.
- Do not create a new client per request.
- Set connection pool behavior according to the deployment environment.
- Never log full query parameters containing personal or secret data.

---

## 11. PostgreSQL Standards

### 11.1 Data integrity

- Enforce critical invariants with database constraints in addition to
  application validation.
- Use foreign keys for real relational integrity.
- Use unique constraints for uniqueness guarantees.
- Use check constraints for stable, database-level invariants.
- Choose explicit delete behavior; do not rely on accidental cascades.
- Prefer normalized relational data for core domains.
- Use JSONB only for data that is genuinely flexible and not routinely joined,
  constrained, or queried by stable fields.

### 11.2 Types and timestamps

- Store timestamps in UTC using timezone-aware types.
- Use precise numeric types for scores, money, or values where floating-point
  rounding is unacceptable.
- Use text lengths and constraints based on domain rules, not arbitrary limits.
- Preserve Unicode.
- Treat locale-aware search and Turkish casing as explicit concerns.

### 11.3 Query performance

- Add indexes based on real query paths and measured plans.
- Composite index order must match filtering and sorting behavior.
- Every list query must be bounded.
- Review query plans for slow or high-volume operations.
- Avoid offset pagination for very large changing datasets.
- Remove redundant indexes that increase write cost without serving queries.

### 11.4 Operations

- Production databases must use managed backups and point-in-time recovery.
- Test restore procedures.
- Use least-privilege database roles.
- Do not run application traffic with an owner or superuser account.
- Keep development, staging, and production data isolated.
- Never copy production personal data into lower environments without approved
  anonymization.

---

## 12. Authentication Rules

Authentication is not currently implemented. When introduced, it must be
designed as a complete identity and session system, not a token-only shortcut.

### 12.1 Credentials

- Hash passwords with Argon2id using reviewed parameters and unique salts.
- Never store, log, transmit back to clients, or recover plaintext passwords.
- Enforce reasonable password length and breached-password controls without
  arbitrary composition rules.
- Password reset and verification tokens must be random, single-use,
  short-lived, and stored as hashes.
- Authentication responses must not reveal whether an account exists.

### 12.2 Sessions and tokens

- Use short-lived signed access tokens.
- Use opaque refresh tokens stored as hashes and rotated on every use.
- Detect refresh-token reuse and revoke the affected session family.
- The web client should keep refresh credentials in secure, `HttpOnly`,
  `SameSite` cookies.
- Mobile clients must use platform secure storage.
- Never store authentication tokens in URLs or browser local storage.
- Support viewing and revoking individual sessions.
- Support global revocation after password or security changes.

### 12.3 Abuse protection

- Rate-limit sign-in, verification, recovery, and refresh operations.
- Apply progressive delays or temporary lockouts without enabling trivial
  denial-of-service against known accounts.
- Audit security-sensitive authentication events.
- Require recent authentication for high-risk actions.
- Support multi-factor authentication for administrators and future high-risk
  roles.

### 12.4 External identities

- External identity providers and Telegram linking must use verified provider
  identifiers.
- A mutable username is never an identity key.
- Linking must require proof of both the platform session and external identity.
- Users must be able to inspect and revoke linked identities.

---

## 13. RBAC Rules

### 13.1 Roles

The initial roles are:

- Admin
- Teacher
- Student

A user may receive one or more roles only through an audited assignment process.
Role names must not be scattered through controller conditions.

### 13.2 Permissions

- Define permissions as explicit actions such as `courses.create`,
  `courses.publish`, `assessments.grade`, or `certificates.issue`.
- Roles map to permissions.
- Services check required permissions and resource policies.
- Default authorization is deny.
- The backend is authoritative.
- Frontend navigation and route guards must mirror permissions for usability but
  never replace backend enforcement.

### 13.3 Resource policies

Role permission alone may be insufficient. Authorization must also evaluate:

- Resource ownership
- Course or class assignment
- Enrollment status
- Organization or tenant scope if introduced
- Content publication state
- Time-bound grants
- The student's ownership of private progress data
- Administrative impersonation or elevated-session state

Object-level checks are mandatory for every resource identifier supplied by a
client.

### 13.4 Auditing

Audit role changes, permission changes, content publication, grading overrides,
student-data access by privileged users, account suspension, certificate
revocation, and data exports.

---

## 14. Security Rules

### 14.1 Baseline

- Follow OWASP guidance relevant to web, API, mobile, and file-upload systems.
- Apply defense in depth.
- Use least privilege for users, services, databases, storage, and CI.
- Validate all data crossing a trust boundary.
- Treat client state, provider callbacks, files, AI output, and retrieved
  content as untrusted.
- Fail closed when authorization or security state is uncertain.

### 14.2 Secrets

- Never commit secrets, credentials, private keys, tokens, or real passwords.
- Keep only documented placeholder values in `.env.example`.
- Use a managed secrets store in deployed environments.
- Rotate exposed or suspicious credentials immediately.
- Do not put secrets in source code, images, URLs, logs, analytics, or error
  responses.

### 14.3 HTTP and browser security

- Use HTTPS outside local development.
- Keep Helmet enabled with reviewed policies.
- Configure CORS with an explicit allowlist.
- Protect cookie-authenticated mutations against CSRF.
- Prevent XSS by using React escaping and sanitizing approved rich text.
- Add Content Security Policy appropriate to deployed asset and media sources.
- Set secure cookie attributes.
- Enforce body, parameter, and header limits.

### 14.4 Abuse and data protection

- Apply rate limits based on endpoint risk.
- Minimize personal data collection and retention.
- Encrypt managed data at rest and in transit.
- Redact sensitive fields from logs.
- Protect data exports and administrative operations with stronger controls.
- Define retention and deletion behavior before collecting a new data category.
- Never expose private object-storage URLs permanently.

### 14.5 Dependency and supply-chain security

- Keep the lockfile committed.
- Review dependency provenance and maintenance.
- Run dependency, secret, and container scans in CI.
- Do not execute unreviewed install scripts or remote code.
- Respond to vulnerabilities according to severity and exposure.

---

## 15. Error Handling Rules

### 15.1 Error categories

Errors must distinguish:

- Validation failure
- Authentication failure
- Authorization failure
- Resource not found
- Conflict or invalid state transition
- Rate limit exceeded
- External provider failure
- Unexpected internal failure

Expected business failures should use typed application errors with stable error
codes. Unexpected errors should be captured by the centralized handler.

### 15.2 API errors

- Return a consistent error envelope.
- Include a stable machine-readable code.
- Include a safe localized or localizable message strategy.
- Include field-level validation details when safe.
- Include a request or correlation ID.
- Never expose stack traces, SQL, filesystem paths, tokens, or provider internals
  in production.
- Preserve the original cause internally without leaking it publicly.

### 15.3 Handling behavior

- Controllers should pass failures to centralized handling.
- Do not catch an error merely to ignore it.
- Catch only when adding context, converting to a domain failure, compensating,
  or controlling a retry.
- Retries require bounded attempts, backoff, and idempotency.
- Partial failure must be represented explicitly.
- Frontend errors should provide recovery actions where possible.

---

## 16. Logging Rules

### 16.1 Structured logging

- Use structured Pino logging for backend production code.
- Avoid `console.log` in feature implementation.
- Log events with consistent names and structured fields.
- Include correlation ID, operation, outcome, duration, and safe identifiers.
- Worker jobs must carry the initiating correlation context when available.
- Use appropriate levels: debug, info, warn, and error.

### 16.2 Prohibited log data

Never log:

- Passwords or password hashes
- Access or refresh tokens
- Authorization or cookie headers
- Reset or verification tokens
- Full payment information
- Private file URLs
- AI provider credentials
- Raw personal content unless explicitly approved and protected
- Full request bodies by default

### 16.3 Operational value

- Log state transitions and external dependency outcomes.
- Avoid duplicate logs at every layer for the same failure.
- Log unexpected errors once at the boundary that owns reporting.
- Attach stack traces to protected error logs, not public responses.
- Use metrics rather than high-volume logs for counters and latency trends.
- Audit logs and operational logs serve different purposes and must not be
  conflated.

---

## 17. Validation Rules

### 17.1 Trust boundaries

Validate:

- Environment variables at startup
- Route parameters
- Query parameters
- Request bodies
- Request headers used by business logic
- File metadata and file signatures
- Webhook payloads and signatures
- Queue messages
- Cached data
- External provider responses
- AI inputs and structured outputs

### 17.2 Zod usage

- Use Zod schemas at TypeScript runtime boundaries.
- Infer input types from schemas when appropriate.
- Keep transport schemas close to the owning feature.
- Normalize only when normalization is a documented domain rule.
- Reject unknown sensitive fields where mass assignment is a risk.
- Do not use a TypeScript assertion as a substitute for validation.

### 17.3 Validation layers

- Client validation provides fast feedback.
- API validation is mandatory and authoritative.
- Domain validation protects business invariants.
- Database constraints protect persistent integrity.

These layers complement rather than replace one another. Validation messages
shown to users must be localizable.

---

## 18. File Upload Rules

### 18.1 Architecture

- Large files must upload directly to S3-compatible object storage using
  short-lived presigned authorization.
- API processes must not buffer large uploads in memory or rely on local disk.
- The server generates storage keys.
- Original filenames are metadata, never trusted paths.
- New uploads remain quarantined until validation and malware scanning complete.

### 18.2 Validation

- Validate ownership, purpose, declared type, actual signature, extension, and
  size.
- Maintain an allowlist of accepted formats per feature.
- Verify checksums when practical.
- Reject polyglot, malformed, executable, or suspicious files.
- Strip unsafe metadata where the format permits.
- Image processing must guard against decompression bombs.

### 18.3 Access and lifecycle

- Store authorization policy independently from object location.
- Private files require short-lived signed downloads or authorized streaming.
- Do not expose storage buckets publicly for protected content.
- Track upload, scan, processing, ready, rejected, and deleted states.
- Clean abandoned multipart uploads and quarantined failures.
- Replacing an asset must preserve referential integrity and audit history.
- File deletion should be asynchronous and retryable when external storage is
  involved.

---

## 19. Video Module Rules

### 19.1 Processing

- Upload originals through the file-upload architecture.
- Scan and validate before processing.
- Transcode asynchronously through a worker or managed media provider.
- Produce adaptive bitrate streams, preferably HLS.
- Generate thumbnails, duration, dimensions, codec metadata, and processing
  diagnostics.
- Represent processing state explicitly.
- Preserve originals only according to documented retention policy.

### 19.2 Delivery

- Deliver protected learning video through signed CDN URLs or playback tokens.
- Do not expose permanent private object URLs.
- Support range requests or adaptive streaming as required by the player.
- Refresh expiring playback authorization without losing the learner's place.
- Captions and transcripts are first-class, localized assets.
- Media players must be keyboard accessible.

### 19.3 Progress

- Video progress is domain data and must be validated by the backend.
- Clients should report bounded checkpoints, not every playback tick.
- Progress updates should be idempotent and monotonic where the product rule
  requires it.
- Completion policy must account for duration, seeking, lesson state, and
  plausible activity.
- Never trust a client-provided “completed” flag without server policy.

---

## 20. Dictionary Module Rules

### 20.1 Domain model direction

The dictionary must support:

- Turkish headwords and normalized search forms
- Meanings in one or more explanation languages
- Part of speech and grammatical metadata
- Example sentences and translations
- Pronunciation audio and phonetic guidance
- Inflection or morphology information
- Topics, levels, synonyms, antonyms, and related entries
- Student saved vocabulary and learning status
- Editorial draft, review, published, and archived states

### 20.2 Turkish language handling

- Handle dotted `i` and dotless `ı` correctly.
- Use Unicode normalization consistently.
- Do not apply English-only lowercasing rules to Turkish search.
- Preserve original spelling and diacritics.
- Make fuzzy matching and typing-variation behavior explicit and testable.
- Separate search normalization from displayed content.

### 20.3 Search and editorial rules

- Start with measured PostgreSQL full-text or trigram capabilities.
- Introduce a dedicated search provider only when requirements justify it.
- Hide the search implementation behind a dictionary search interface.
- Stable entry identifiers must survive editorial updates.
- Published changes require attribution and moderation.
- Student favorites must not break when an entry is revised.
- Dictionary content and UI translations are distinct concerns.

---

## 21. AI Module Rules

### 21.1 Scope

AI assistance may explain vocabulary and grammar, practice conversation,
retrieve approved learning material, suggest review activities, and help
teachers draft content. It is not an unrestricted database agent and must not
be the sole authority for grading, certification, disciplinary, or
administrative decisions.

### 21.2 Architecture

- All AI access goes through the backend.
- Provider SDKs remain behind a provider-neutral adapter.
- Authenticate, authorize, validate, rate-limit, and meter every request.
- Retrieve only content the requesting user may access.
- Version system instructions, prompt templates, output schemas, and evaluation
  criteria.
- Use asynchronous jobs for long-running generation.
- Validate structured output before use.

### 21.3 Safety and privacy

- Do not send secrets or unnecessary personal data to AI providers.
- Treat user input and retrieved text as untrusted.
- Defend against prompt injection and unauthorized retrieval.
- Apply content safety appropriate to learners and age requirements.
- Clearly identify AI-generated content.
- Require teacher review before publishing AI-generated learning material.
- Provide feedback and abuse-reporting paths.
- Define retention and provider-training settings before storing conversations.

### 21.4 Reliability and cost

- Apply per-user and per-role quotas.
- Set timeouts and token limits.
- Track safe usage metadata, latency, model, prompt version, and cost.
- Provide graceful failure when the provider is unavailable.
- Cache only when privacy and correctness permit it.
- Evaluate educational quality and hallucination risk before expanding a use
  case.

---

## 22. Testing Rules

### 22.1 General requirements

- Every bug fix must include a regression test when technically feasible.
- Every new business rule must have unit tests.
- Every API endpoint must have request validation, authorization, success, and
  relevant failure coverage.
- Critical database behavior requires integration tests against PostgreSQL.
- Important user journeys require end-to-end coverage.
- Tests must be deterministic, isolated, readable, and parallel-safe.
- Do not use production services or production data in tests.

### 22.2 Test layers

- **Unit tests:** Pure functions, services, policies, validation, scoring, and
  transformations.
- **Component tests:** React rendering, interaction, accessibility, and error
  states.
- **Integration tests:** Express routes, Prisma repositories, transactions,
  queues, and provider adapters.
- **Contract tests:** OpenAPI compatibility and external provider boundaries.
- **End-to-end tests:** Authentication, learning, assessment, and
  role-sensitive critical flows.
- **Security tests:** Authorization boundaries, validation abuse, upload
  restrictions, rate limits, and token lifecycle.

### 22.3 Preferred tooling direction

When testing dependencies are introduced, prefer:

- Vitest for TypeScript unit and component execution
- React Testing Library for user-centered component tests
- Supertest for Express HTTP integration
- A disposable PostgreSQL database or container for repository tests
- Playwright for critical browser journeys

Tool adoption requires normal dependency review.

### 22.4 Test quality

- Assert behavior, not private implementation detail.
- Avoid broad snapshots for dynamic interfaces.
- Use factories or builders for readable test data.
- Freeze time where time affects behavior.
- Mock network providers at adapter boundaries, not internal business logic.
- Test locale-sensitive Turkish behavior explicitly.
- Include accessibility checks in reusable component coverage.
- Coverage percentage never substitutes for meaningful assertions.

### 22.5 Required quality commands

Run the relevant commands after implementation:

```text
npm run typecheck
npm run lint
npm run build
```

Run the repository test command when testing is configured. Run Prisma schema
validation after schema work and execute applicable migrations in a disposable
environment.

---

## 23. Git Commit Rules

### 23.1 Commit content

- Each commit should represent one coherent change.
- Do not mix refactoring, dependency upgrades, formatting, and features without
  a clear reason.
- Never commit secrets, `.env` files, build output, logs, or local editor
  metadata.
- Review the staged diff before committing.
- Preserve authorship and do not rewrite shared history without explicit
  coordination.
- Generated files are committed only when repository policy requires them.

### 23.2 Commit messages

Use Conventional Commits:

```text
<type>(optional-scope): concise imperative summary
```

Allowed common types:

- `feat` — user-visible capability
- `fix` — defect correction
- `refactor` — behavior-preserving restructure
- `perf` — measured performance improvement
- `test` — test-only change
- `docs` — documentation
- `build` — build or dependency change
- `ci` — pipeline change
- `chore` — maintenance not covered above

Rules:

- Use an imperative, present-tense summary.
- Keep the subject concise and specific.
- Explain motivation and important tradeoffs in the body.
- Reference issues or ADRs when applicable.
- Mark breaking changes explicitly.
- Do not use vague messages such as “update”, “fix stuff”, or “changes”.

---

## 24. Branch Naming Rules

Use lowercase, hyphen-separated branch names:

```text
<type>/<ticket-or-domain>-<short-description>
```

Examples:

- `feat/dictionary-search`
- `fix/auth-refresh-reuse`
- `docs/api-versioning`
- `refactor/course-repository`
- `chore/upgrade-eslint`

Allowed prefixes:

- `feat/`
- `fix/`
- `refactor/`
- `perf/`
- `test/`
- `docs/`
- `chore/`
- `hotfix/` only for genuine production emergencies

Avoid personal names, ambiguous labels, uppercase letters, spaces, and branches
that combine unrelated work. A hotfix still requires tests, review, and a
durable root-cause correction.

---

## 25. Naming Conventions

### 25.1 General

- Names must communicate domain intent.
- Avoid unexplained abbreviations.
- Use one term consistently across UI, API, services, and documentation.
- Prefer positive booleans such as `isPublished` or `canGrade`.
- Include units in names where ambiguity exists, such as `timeoutMs`.
- Do not use generic names such as `data`, `item`, `manager`, or `helper` when a
  domain name is available.

### 25.2 TypeScript and React

- Components, classes, types, interfaces, and enums: `PascalCase`
- Variables, functions, hooks, fields, and methods: `camelCase`
- Hooks: `useSomething`
- Constants with true global immutable meaning: `UPPER_SNAKE_CASE`
- React component files: `PascalCase.tsx`
- Hooks: `use-something.ts` or the existing repository convention
- Other feature files: lowercase kebab-case with role suffixes
- Event handlers: `handleAction`
- Callback props: `onAction`

Do not prefix interfaces with `I`.

### 25.3 Backend

- Route modules: `<domain>.routes.ts`
- Controllers: `<domain>.controller.ts`
- Services: `<domain>.service.ts`
- Repositories: `<domain>.repository.ts`
- Validation schemas: `<domain>.schemas.ts`
- Middleware: `<purpose>.middleware.ts`
- Error codes: stable `UPPER_SNAKE_CASE`
- Permission names: lowercase resource and action, such as `courses.publish`

### 25.4 Database and API

- API paths: lowercase plural nouns with hyphens
- JSON fields: `camelCase`
- Query parameters: `camelCase`
- Prisma models: singular `PascalCase`
- Prisma fields: `camelCase`
- Database naming mappings: use one documented convention consistently
- Environment variables: `UPPER_SNAKE_CASE`
- Translation keys: stable hierarchical names, not source sentences

---

## 26. Performance Rules

### 26.1 Measure first

- Do not optimize from intuition alone.
- Establish a baseline and measure the affected path.
- Document performance-sensitive tradeoffs.
- Correct N+1 queries, unbounded operations, repeated serialization, and
  avoidable network waterfalls.
- Never trade correctness, security, or accessibility for unmeasured speed.

### 26.2 Frontend

- Split substantial routes and features.
- Keep the initial bundle focused on the first user journey.
- Avoid unnecessary rerenders and unstable provider values.
- Memoize only when measurement or expensive computation justifies it.
- Use responsive images and modern formats.
- Lazy-load below-the-fold media.
- Reserve media dimensions to prevent layout shift.
- Cancel obsolete network requests.
- Cache server state according to freshness and privacy requirements.
- Target Core Web Vitals in the “good” range on representative mobile devices.

### 26.3 Backend

- Bound every collection query and request body.
- Use indexes that match observed query patterns.
- Select only required database fields.
- Use connection pooling appropriate to the runtime.
- Keep API nodes stateless and horizontally scalable.
- Move CPU-heavy and long-running work to workers.
- Cache only when invalidation, tenant scope, authorization, and staleness are
  defined.
- Apply timeouts to database and external calls.
- Use compression only when beneficial for the payload and deployment edge.

### 26.4 Media and AI

- Stream or deliver large files through object storage and CDN.
- Use adaptive video delivery.
- Limit upload, transcode, and AI concurrency.
- Enforce quotas and cost budgets.
- Do not cache personalized AI output without explicit privacy review.

---

## 27. Responsive Design Rules

- Use mobile-first layout and styling.
- Support a minimum practical width of 320 CSS pixels.
- Test representative phone, tablet, laptop, and wide desktop widths.
- Design for content reflow, not specific device models.
- Avoid fixed dimensions that clip translated text or user settings.
- Navigation, tables, forms, media, dialogs, and dashboards require deliberate
  small-screen behavior.
- Touch targets should be at least 44 by 44 CSS pixels where practical.
- Do not rely on hover for essential actions.
- Keep primary actions reachable without horizontal scrolling.
- Use responsive typography with controlled line length.
- Forms should use suitable mobile input types and autocomplete metadata.
- On-screen keyboard behavior must not hide required fields or actions.
- Test landscape orientation for media and assessment experiences.

Responsive behavior is part of feature acceptance, not a later polish phase.

---

## 28. Accessibility Rules

The web application should meet **WCAG 2.2 AA**.

### 28.1 Structure and interaction

- Use semantic HTML.
- Preserve a logical heading hierarchy.
- Every interactive element must be keyboard accessible.
- Use native buttons, links, inputs, and dialogs before custom equivalents.
- Maintain visible focus indicators.
- Manage focus deliberately after navigation, dialogs, errors, and dynamic
  updates.
- Provide a skip link in application shells.
- Do not use positive `tabindex`.

### 28.2 Content and visuals

- Text and interactive controls must meet contrast requirements.
- Do not communicate meaning with color alone.
- Images require meaningful alternative text or empty alt text when decorative.
- Icons used as controls require accessible names.
- Forms require programmatic labels, instructions, and associated errors.
- Status updates should use appropriate live regions without excessive
  announcements.
- Respect reduced motion.
- Support browser zoom and text enlargement.

### 28.3 Learning media

- Videos require captions.
- Important audio content requires transcripts or equivalent content.
- Media controls must be keyboard accessible.
- Timed assessments require accessible extensions or accommodations.
- Drag-and-drop interactions need keyboard alternatives.
- Speaking or listening tasks require documented accommodation behavior.

Automated checks are useful but do not replace keyboard and screen-reader
review of critical journeys.

---

## 29. Internationalization Rules

### 29.1 Default locale

- The default application language is Uzbek in the Latin script.
- Use the BCP 47 locale `uz-Latn` where a full locale identifier is required.
- Default copy must use consistent Uzbek Latin orthography.
- Do not mix Cyrillic and Latin Uzbek unintentionally.
- Turkish learning content and Uzbek interface text are separate language
  dimensions.

### 29.2 No hardcoded user-facing copy

- New user-facing text must use stable translation keys.
- Do not use an English or Uzbek sentence itself as the key.
- Validation, empty, error, confirmation, email, push, Telegram, certificate,
  and AI interface messages must be localizable.
- When modifying a legacy component with hardcoded copy, migrate the affected
  copy into the localization system as part of the complete change.
- Developer logs and machine-readable error codes remain language-neutral.

### 29.3 Locale behavior

- Resolve locale in a documented order: explicit user preference, client
  preference, device or browser preference, then platform default.
- Keep fallback behavior deterministic.
- Use locale-aware date, time, number, plural, and list formatting.
- Store timestamps in UTC and localize only for presentation.
- Avoid concatenating translated sentence fragments.
- Use interpolation with named variables.
- Design for text expansion and future right-to-left layouts.
- Do not encode locale assumptions in CSS dimensions.

### 29.4 Content translations

Interface translations and learning-content translations must use separate
models and workflows. Translatable domain content should track:

- Locale
- Source content identity and version
- Draft, review, and published status
- Translator or reviewer attribution
- Staleness when the source changes
- Explicit fallback behavior

The user's interface language, explanation language, and target learning
language must remain separate preferences.

### 29.5 Turkish-aware behavior

- Turkish search, casing, collation, and pronunciation rules must be tested.
- Do not assume the interface locale is the same as the language being learned.
- Preserve Turkish characters accurately through API, database, search, export,
  and media workflows.

---

## 30. Implementation Workflow

Every future task should follow this workflow.

### 30.1 Discovery

1. Read the request, this guide, and relevant architecture documents.
2. Inspect the affected feature and all call sites.
3. Identify API, database, security, localization, accessibility, and mobile
   compatibility impacts.
4. Check for reusable components and existing patterns before adding new ones.
5. Confirm that no unrelated user changes will be overwritten.

### 30.2 Design

1. Define the feature boundary and owning module.
2. Define or update the API contract before coupling clients to behavior.
3. Define validation, authorization, errors, logging, and audit requirements.
4. Define data invariants and migration strategy.
5. Define loading, empty, error, offline, responsive, and accessible states.
6. Use an ADR when the decision affects long-term architecture.

### 30.3 Implementation

1. Implement the domain behavior independently of transport and presentation.
2. Add persistence through repositories.
3. Add validated and authorized API endpoints.
4. Add frontend feature APIs, orchestration, and reusable presentation.
5. Add localization keys from the beginning.
6. Add tests at the appropriate layers.
7. Remove replaced code and avoid parallel legacy paths.

### 30.4 Verification

1. Run focused tests during development.
2. Run TypeScript checks.
3. Run ESLint.
4. Run formatting checks.
5. Run production builds.
6. Validate Prisma and migrations when applicable.
7. Exercise the changed API or user journey.
8. Review responsive, keyboard, locale, permission, and failure behavior.
9. Review the final diff for secrets, duplication, and unintended changes.

---

## 31. Definition of Done

A task is complete only when all applicable statements are true:

- The implementation satisfies the full requirement rather than a partial
  demonstration.
- The solution follows API-first and feature-based architecture.
- Business logic is separate from presentation and transport.
- No duplicated logic or avoidable component duplication was introduced.
- Types are strict and runtime boundaries are validated.
- Authentication and authorization are enforced server-side where relevant.
- Security, privacy, and audit implications are addressed.
- Error handling and structured logging are intentional.
- User-facing copy is Uzbek Latin by default and localizable.
- Responsive and accessibility behavior is verified.
- Tests cover new rules and regressions.
- Type checks, lint, tests, formatting, and builds pass.
- Database migrations are safe and reviewed when applicable.
- API compatibility and mobile or Telegram consumers are considered.
- Documentation is updated when contracts or architecture change.
- No secrets, temporary workarounds, dead code, or unexplained TODOs remain.
- The final change set contains no unrelated modifications.

Enterprise-grade does not mean adding maximum complexity. It means delivering
the simplest complete solution with clear boundaries, safe data behavior,
observable operations, deliberate compatibility, and a maintainable path for
future growth.
