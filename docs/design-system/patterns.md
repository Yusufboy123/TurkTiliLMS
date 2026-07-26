# Interaction and Experience Patterns

**Status:** Review candidate

## Progressive disclosure

Show the minimum information required to make the current decision. Advanced
filters, raw audit details, permission matrices, upload metadata, and diagnostic
information live behind labeled disclosures or dedicated screens. Disclosure
never hides a blocker or destructive consequence.

## Action hierarchy

- One primary action per task region.
- Secondary actions support the task without competing.
- Tertiary actions are low-emphasis.
- Danger styling is reserved for destructive consequences.
- A `SplitButton` uses the safest/common action as the main target and
  permission-filtered alternatives in its menu.
- Unavailable actions are hidden when unauthorized and disabled with a reason
  when contextually unavailable.

## Loading and perceived performance

- Under approximately 400 ms: no spinner.
- Predictable initial layout: skeleton matching final geometry.
- Unknown duration: delayed labeled spinner.
- Background refresh: preserve current content and show a subtle status; do not
  replace content with initial skeletons.
- Long operation: progress when measurable, otherwise status and safe exit.

Skeleton shimmer stops under reduced motion. Loading UI does not invent values.

## Mutations and optimistic behavior

Optimism is allowed only for reversible local presentation with a clear server
reconciliation rule. It is prohibited for permissions, destructive actions,
enrollment lifecycle, publishing, certificate state, and authoritative progress
percentages.

A progress completion mutation may display a local pending state on the
activated block/lesson. Aggregate percentage, completed count, course
completion, and next-lesson state update only from the authoritative response.
Failure restores the prior state and announces the reason.

## Error recovery

- Field failure appears by the field and in `ErrorSummary` after submission.
- Region failure preserves unaffected content and offers in-context
  `Qayta urinib ko‘rish`.
- Page failure provides a safe next destination.
- Authentication expiration preserves safe local form input, returns through
  login, and revalidates the original action.
- Unexpected errors may show a safe reference ID, never stack traces, SQL,
  filesystem paths, tokens, or permission internals.
- Destructive writes never retry automatically.

## Empty states

Distinguish:

1. no data yet;
2. no search/filter results;
3. no permission;
4. unavailable or deferred capability;
5. recoverable load failure.

Empty-state art follows [Art Direction](./art-direction.md) and never replaces
the explanatory text or available action.

## Destructive actions

Soft deletion and restoration are preferred. A confirmation names the object,
impact, dependencies, recovery path, and irreversible portions.

- Routine reversible deletion uses a confirmation dialog.
- High-risk deletion/anonymization may require typed confirmation.
- Action locks while pending.
- Success updates the originating context and offers restoration when valid.
- Failure retains context and provides retry only when safe.
- Backend authorization, validation, and audit remain authoritative.

## Step-up authentication

### Protected actions

Step-up verification is required before:

- role or permission changes;
- administrator creation;
- any privilege escalation;
- account deletion or anonymization;
- initiating a password reset for another user;
- broad session revocation;
- security-sensitive system setting changes;
- large personal-data exports;
- future certificate revocation.

The API decides whether recent verification is required. The UI may preflight
but never bypasses an API challenge.

### Verification assumption

V1 assumes current-password or recent-auth verification. Future MFA may replace
or supplement it without changing the protected-action contract. The UX assumes
a 10-minute recent-auth window; backend policy is authoritative and configurable
outside the admin-editable business settings.

### Flow

1. User initiates a protected action.
2. UI preserves only a nonsecret action descriptor and opens
   `StepUpAuthenticationDialog`; provider redirects use a dedicated route.
3. The flow states why identity confirmation is needed without revealing hidden
   permissions.
4. After successful verification, the app refetches the target and displays a
   fresh final confirmation.
5. The protected request carries the server-issued short-lived proof.
6. Success returns to the originating screen, restores logical focus, and shows
   an auditable result.

Cancellation makes no change and returns focus to the trigger. Wrong
verification, rate limiting, network failure, and expired login retain only safe
context, associate errors with the verification field, and never disclose which
credential or permission detail matched. After timeout, target/context change,
role change, or session expiration, the proof is discarded and the original
action is not replayed automatically.

The backend audits challenge outcome and protected action separately, excluding
passwords, codes, tokens, and sensitive export content.

## Motion

| Token            | Duration | Use                        |
| ---------------- | -------: | -------------------------- |
| `motion-instant` |    `0ms` | Reduced-motion replacement |
| `motion-fast`    |  `120ms` | Hover/focus                |
| `motion-base`    |  `180ms` | Disclosure/menu            |
| `motion-slow`    |  `240ms` | Dialog/drawer              |

Use standard ease-out for entry and ease-in for exit. Motion confirms spatial or
state relationships; it does not delay work. Progress animates only between two
authoritative values. No parallax or large celebratory motion is part of v1.

## Dark mode

Dark mode swaps semantic CSS variables under `[data-theme="dark"]`. Component
classes remain unchanged. User choice may be light, dark, or system; theme mode
is owner-configurable only within those choices and approved color presets.
Media, focus, errors, charts, and disabled states require independent dark-mode
verification.

## Offline and retry

- A persistent banner states connection status and unsent-write impact.
- Cached content is labeled with last-updated time where staleness matters.
- Completion, publish, permission, and destructive actions are unavailable
  offline unless a future synchronization contract explicitly supports them.
- Automatic retries are limited to safe idempotent reads with backoff.
- User-entered form content survives recoverable network failure.
- Reconnection triggers background refresh; it does not silently replay
  destructive or authorization-sensitive requests.

## Permission-aware UI

The frontend renders capabilities supplied by authenticated API contracts.
Hidden controls are not a security boundary. Direct URL access, stale role
context, and privilege changes resolve through API authorization and a safe
access-denied page. Nontechnical users see role names and consequences, not raw
permission keys.

## Security-sensitive admin content

The owner may edit business content and approved theme settings through typed,
validated forms. The UI must never expose secrets, database URLs, JWT/API keys,
server credentials, arbitrary CSS, arbitrary JavaScript, or a general-purpose
code editor.
