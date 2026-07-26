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
See [Progress Tracking UI](./progress-tracking-ui.md).
