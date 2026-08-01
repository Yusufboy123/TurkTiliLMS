# Turk Tili LMS Design System and UI/UX Specification

- **Version:** 1.0 revision candidate
- **Status:** Ready for final two-blocker re-review; approval pending
- **Default language:** Uzbek (Latin)
- **Architecture:** API-first, responsive, accessible, role-aware

## Purpose

This directory is the proposed source of truth for the future React UI. It
defines product language, tokens, accessibility, interaction, responsive
behavior, component boundaries, page contracts, and implementation quality
without changing application code.

The system serves visitors, students, teachers, administrators, future native
apps, and the Telegram bot through one backend contract. The graphical admin
experience must let a nonprogrammer owner manage normal content and operations
without source edits while security and infrastructure remain developer-owned.

## Principles

1. API contracts are authoritative; the browser does not infer business rules.
2. Uzbek Latin is first-class and all layouts support Turkish, English, and
   Russian.
3. WCAG 2.2 AA is a release requirement.
4. One semantic token and component language spans every role.
5. Role shells optimize tasks without creating separate products.
6. Progress motivates without invented percentages, streaks, or achievements.
7. Turkish red is restrained; neutral space preserves learning focus.
8. Owner configuration is typed and safe, never arbitrary code.

## Documentation precedence

When two documents conflict, the earlier source in this complete order wins:

1. Accepted ADRs
2. Product Decisions
3. Foundations
4. Accessibility
5. Art Direction
6. Content Guidelines
7. Personas and Information Architecture
8. Responsive Design
9. Components
10. Interaction Patterns
11. Progress Tracking UI
12. Page Specifications
13. Page Inventory
14. Implementation Guidelines
15. Component Inventory
16. Quality Checklist
17. Roadmap

Product Decisions records settled product scope; an architectural exception
still requires an accepted ADR. A page-specific rule may override a general
Responsive Design rule only when the page rule is explicit, cites the general
rule, has an Approved design-baseline status, and violates no higher-precedence
source. At the same precedence level, the more specific normative rule wins
only under those same conditions. Otherwise the conflict is unresolved and
blocks implementation and approval; reviewers may not choose the convenient
rule.

### Exceptions and ADRs

An exception must include owner, scope, rationale, accessibility/security
impact, validation evidence, expiry date, and removal/review issue. It is not
valid merely because a page implementation differs.

A new ADR is required when a change:

- reverses or materially extends an accepted architectural decision;
- creates a new cross-feature component or token strategy;
- changes role-shell or responsive navigation behavior;
- adds a UI dependency with cross-route impact;
- weakens an accessibility, security, privacy, or performance requirement;
- changes the owner-configurable boundary.

### Status vocabulary

- **Draft:** Incomplete; cannot override a normative reviewed source.
- **Review candidate:** Blocking findings are believed resolved; approval is
  pending independent strict review.
- **Contract-blocked:** Design intent may guide API/product work, but the item
  is not implementation-ready until its named contract is approved.
- **Partially Specified:** Some contract exists, but the named missing detail
  blocks implementation.
- **Deferred:** Outside current delivery scope and must not be implemented.
- **Approved design baseline:** All required documents are internally
  consistent, automated/document checks pass, product/security/accessibility
  decisions have owners, no blocking review finding remains, and approval is
  recorded.
- **Deprecated:** Retained for migration context only; it cannot guide new work.

Draft sections must begin with `**Status:** Draft` and name the unresolved
decision. This revision does **not** claim approved baseline status until the
next strict review records approval.

Only an Accepted ADR or an Approved design-baseline document is normative for
production implementation. Review candidates are provisional. Inventoried,
Contract-blocked, Partially Specified, and Deferred items cannot authorize
implementation.

## Document index

| Document                                                                    | Authority                                            |
| --------------------------------------------------------------------------- | ---------------------------------------------------- |
| [ADR-001](./decisions/ADR-001-semantic-tokens-and-role-shells.md)           | Semantic-token and role-shell architectural decision |
| [ADR-002](./decisions/ADR-002-progress-tracking-contract.md)                | Proposed Module #8 architecture; approval pending    |
| [ADR-003](./decisions/ADR-003-course-completion-certificate-eligibility.md) | Proposed completion/eligibility lifecycle decision   |
| [ADR-004](./decisions/ADR-004-certificate-issuance-lifecycle.md)            | Review Candidate certificate issuance decision       |
| [ADR-005](./decisions/ADR-005-admin-dashboard-read-contract.md)             | Review Candidate Admin Dashboard read decision       |
| [Foundations](./foundations.md)                                             | Normative tokens, contrast, type, layout, stack      |
| [Accessibility](./accessibility.md)                                         | Normative WCAG and acceptance contract               |
| [Components](./components.md)                                               | Component layers and public contracts                |
| [Interaction Patterns](./patterns.md)                                       | Cross-feature interaction and security UX            |
| [Page Specifications](./page-specifications.md)                             | Route-level implementation contracts                 |
| [Responsive Design](./responsive.md)                                        | Breakpoints, role navigation, player reflow          |
| [Content Guidelines](./content-guidelines.md)                               | Uzbek terminology and i18n                           |
| [Art Direction](./art-direction.md)                                         | Original visual identity and media composition       |
| [Product Decisions](./product-decisions.md)                                 | Settled v1 scope and approval dependencies           |
| [Progress Tracking UI](./progress-tracking-ui.md)                           | Module #8 presentation and contract gate             |
| [Implementation Guidelines](./implementation-guidelines.md)                 | Tailwind/React mapping and performance               |
| [Component Inventory](./component-inventory.md)                             | Canonical component names and ownership              |
| [Page Inventory](./page-inventory.md)                                       | Route status and traceability                        |
| [Personas and IA](./personas-and-information-architecture.md)               | Audiences and navigation model                       |
| [Quality Checklist](./quality-checklist.md)                                 | Release and review evidence                          |
| [Roadmap](./roadmap.md)                                                     | Dependency-aware delivery order                      |

Project-level contract review candidates:

- [Progress Tracking Contract](../PROGRESS_TRACKING_CONTRACT.md)
- [Progress Tracking OpenAPI](../openapi/progress-tracking.v1.yaml)
- [Course Completion and Certificate Eligibility Contract](../COURSE_COMPLETION_CERTIFICATE_ELIGIBILITY_CONTRACT.md)
- [Certificate Issuance and Lifecycle Contract](../CERTIFICATE_ISSUANCE_LIFECYCLE_CONTRACT.md)
- [Certificate Eligibility OpenAPI](../openapi/course-completion-certificate-eligibility.v1.yaml)
- [Admin Dashboard Read Contract](../ADMIN_DASHBOARD_READ_CONTRACT.md)
- [Admin Dashboard OpenAPI](../openapi/admin-dashboard.v1.yaml)

The existing `design-system-v1.0` Git tag does not override this directory's
status vocabulary or approval markers. Module 8.1A contract review may proceed.
Module 8.1B remains blocked until Module 8.1A approval is recorded, and Module
8.3 remains blocked until the contract gate, applicable Design System approval,
and accessibility/product requirements are accepted.

## Settled baseline decisions

- Inter only for v1, with Latin Extended and Cyrillic.
- Launch accounts are invitation-based or administrator-created; registration
  UI is capability-gated.
- Streaks and achievements are outside initial Module #8.
- Video playback position is a separate future media-engagement capability.
- Simple progress uses semantic HTML/CSS/SVG; no chart package yet.
- Owner brand editing is limited to logo, favicon, theme mode, and approved
  contrast-tested primary/accent presets.
- Retention defaults are proposals requiring legal/privacy approval before
  production.
- Student tablet navigation is a 72 px compact rail.
- The 320 px Course Player uses two action rows.
- Single-character global shortcuts are disabled by default.

Full rationale and approval dependencies are in
[Product Decisions](./product-decisions.md).

## Change workflow

1. Identify the authoritative document and affected lower-level consumers.
2. Record architectural change in an ADR when required.
3. Update normative rule, component/page contracts, inventories, and checklist
   in the same change.
4. Validate terminology, internal links, Markdown, contrast fixtures, and
   required-concept coverage.
5. Obtain accessibility, product, security/privacy, and engineering review as
   applicable.
6. Mark approval only after evidence is recorded.

Every future user-facing module is done only when its owner/admin interface,
permissions, validation, audit behavior, responsive/accessibility states,
OpenAPI contracts, and tests are accounted for.

## Scope boundary

This documentation does not authorize frontend/backend implementation, schema
changes, package installation, deployment, or migrations. Module #8 UI remains
blocked until the Module 8.1A OpenAPI and DTO contract gate is approved,
Module 8.2 matches it, and applicable Design System approval is recorded.
