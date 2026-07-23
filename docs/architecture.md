# API-first architecture

## Decision

Turk Tili LMS uses a versioned REST API as the boundary between client
applications and server-side capabilities. The React application is the first
client, but it does not contain business rules or access the database directly.

```text
React web ───────┐
Android ─────────┤
iOS ─────────────┼── REST API /api/v1 ── services ── Prisma ── PostgreSQL
Telegram bot ────┘
```

## Why API-first

### One backend for every client

The web application, native mobile applications, and Telegram bot can reuse the
same endpoints. Validation and future learning rules remain consistent instead
of being reimplemented for each client.

### Independent delivery

Client applications can evolve independently from the backend as long as they
honor the published API contract. A frontend redesign does not require database
changes, and a new client does not require a second backend.

### Stable evolution through versioning

All routes begin with `/api/v1`. If a future breaking change is necessary, a
new API version can be introduced while existing clients continue using the
previous contract during migration.

### Clear security boundary

Database access is isolated behind the backend. Future authentication,
authorization, rate limiting, and audit logging can be implemented once and
applied consistently to every client.

### Testable modules

HTTP routing, controllers, services, and persistence are separate concerns.
This keeps future learning modules maintainable and makes each layer easier to
test when the testing phase begins.

## Backend module flow

Requests enter through versioned routes, are handled by controllers, and
delegate application work to services. Prisma will provide database access when
domain models are introduced.

```text
request → middleware → route → controller → service → Prisma → PostgreSQL
                                  ↓
                         centralized response/error handling
```

The initial repository intentionally contains no domain models. Authentication,
users, lessons, tests, and administration will be designed as separate modules
after their requirements are defined.
