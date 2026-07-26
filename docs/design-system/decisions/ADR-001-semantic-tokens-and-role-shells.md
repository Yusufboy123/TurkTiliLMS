# ADR-001: Semantic Tokens and Role-Aware Application Shells

- **Status:** Accepted for Design System v1.0
- **Date:** 2026-07-26

## Context

Turk Tili LMS must serve public visitors, students, teachers, and administrators
through one React application while remaining suitable for future mobile
clients. It needs a premium red-and-neutral identity, future dark mode,
multilingual layouts, accessible components, and bounded owner-managed design
settings.

Using raw Tailwind palette classes throughout features would couple components
to light mode and make safe theming difficult. Using one universal dashboard
shell would either overload students or underserve teacher/admin workflows.

## Decision

1. Define reference palette values and expose semantic tokens as the component
   styling contract.
2. Components consume semantic tokens, never raw brand values.
3. Implement separate public, student, teacher, admin, and course-player shells
   composed from the same accessible primitives.
4. Filter navigation by role and capability, while preserving server-side
   authorization.
5. Allow future owner-managed branding only through an allowlisted semantic
   subset.
6. Keep dark mode as a semantic-token override rather than a component fork.

## Consequences

### Positive

- Dark mode can be introduced without rewriting components.
- Contrast can be corrected centrally.
- Brand changes remain controlled.
- Student navigation stays simple.
- Teacher/admin workflows can use appropriate density.
- Components remain reusable across role shells.
- Unsafe arbitrary CSS is unnecessary.

### Costs

- Token governance and documentation are required.
- Designers and engineers must distinguish reference, semantic, and component
  tokens.
- Shared primitives need testing in multiple shells and locales.
- Role switching requires explicit route and navigation behavior.

## Rejected alternatives

### Raw Tailwind colors in feature code

Rejected because it creates visual drift, weakens contrast governance, and
couples components to one theme.

### One dashboard shell for every authenticated user

Rejected because students need a low-cognitive-load learning shell while
teacher and admin users need denser management navigation.

### Runtime arbitrary theme editor

Rejected because arbitrary CSS/JavaScript creates security, accessibility, and
maintenance risks.

## Verification

- Shared components contain no raw color values.
- Every shell passes keyboard and responsive review.
- Semantic token pairs pass contrast checks.
- Role/capability UI tests cover visible and unavailable navigation.
- Future dark-mode prototypes require only token and asset changes.
