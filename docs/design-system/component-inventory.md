# Component Inventory

**Status:** Review candidate

Priority is P0 critical shell, P1 current core, P2 planned operations, and P3
future.

## Status definitions

- **Inventoried:** A canonical name and owner layer exist, but no usable public
  contract is defined.
- **Partially Specified:** Some behavior is defined, but at least one applicable
  typed API, state, validation, keyboard, focus, responsive, async, error, or
  accessibility contract is still missing. The missing contract is named here.
- **Specified:** [Components](./components.md) defines every applicable typed
  public API, state, validation, keyboard, focus, responsive, loading, empty,
  error, disabled, and accessibility behavior. This does not mean implemented.
- **Deferred:** Outside current delivery scope and must not be implemented.

## Primitives

| Component                                  | Priority | Status              | Remaining contract, if any                                      |
| ------------------------------------------ | -------: | ------------------- | --------------------------------------------------------------- |
| `Button`                                   |       P0 | Specified           | —                                                               |
| `IconButton`                               |       P0 | Partially Specified | Size, loading, disabled, focus, and pressed API                 |
| `SplitButton`                              |       P2 | Partially Specified | Disabled/loading coordination and narrow-layout behavior        |
| `MobileFloatingAction`                     |       P2 | Partially Specified | Placement, collision, and viewport/safe-area API                |
| `Input`, `FormField`                       |       P0 | Partially Specified | Complete typed props, event ownership, and state matrix         |
| `EmailField`, `PasswordField`              |       P0 | Partially Specified | Typed composition API and complete async/error states           |
| `Textarea`, `Select`                       |       P0 | Partially Specified | Typed API, validation, keyboard, and state details              |
| `SearchableSelect`, `MultiSelect`          |       P1 | Partially Specified | Combobox model, filtering, selection, async, and virtualization |
| `Checkbox`, `RadioGroup`, `Switch`         |    P0/P1 | Partially Specified | Group API, indeterminate/error, and keyboard/state matrices     |
| `DatePicker`                               |       P1 | Partially Specified | Locale/calendar model, parsing, range, and keyboard grid        |
| `FileUpload`                               |       P1 | Partially Specified | Queue, validation, retry, cancellation, and progress API        |
| `RichTextEditor`                           |       P1 | Partially Specified | Safe schema, toolbar, paste, keyboard, and error behavior       |
| `Tabs`, `Stepper`, `Pagination`            |    P0/P1 | Partially Specified | Typed API, overflow/reflow, focus, and URL-state ownership      |
| `Popover`, `Menu`, `Disclosure`, `Tooltip` |       P0 | Partially Specified | Typed trigger/content, controlled-state, and placement APIs     |
| `Portal`, `FocusScope`, `VisuallyHidden`   |       P0 | Partially Specified | Typed lifecycle, container, initial-focus, and restoration APIs |
| `SkipLink`                                 |       P0 | Specified           | —                                                               |

Separate `PrimaryButton`, `SecondaryButton`, `TertiaryButton`, `DangerButton`,
`TextInput`, `EmailInput`, and `Table` components are prohibited.

## Layout

| Component                                  | Priority | Status              | Remaining contract, if any                                             |
| ------------------------------------------ | -------: | ------------------- | ---------------------------------------------------------------------- |
| `PageContainer`, `Stack`, `Inline`, `Grid` |       P0 | Partially Specified | Typed spacing, alignment, wrapping, and responsive APIs                |
| `Divider`, `Surface`, `SectionHeader`      |       P0 | Partially Specified | Semantic element, heading-level, and visual-state APIs                 |
| `PublicNavbar`                             |       P0 | Partially Specified | Mobile disclosure, focus order, and capability-gated entries           |
| `DashboardSidebar`, `StudentCompactRail`   |       P0 | Partially Specified | Collapse, persistence, tooltip, keyboard, and overflow details         |
| `MobileBottomNavigation`                   |       P0 | Partially Specified | Item limits, overflow, safe-area, badge, and route-transition behavior |
| `Breadcrumbs`, `UserMenu`                  |       P0 | Partially Specified | Collapse/overflow and complete item/action APIs                        |
| `RoleSwitcher`                             |       P1 | Partially Specified | Typed role/destination API and pending/error behavior                  |

## Feedback

| Component                                                  | Priority | Status              | Remaining contract, if any                                      |
| ---------------------------------------------------------- | -------: | ------------------- | --------------------------------------------------------------- |
| `ValidationMessage`                                        |       P0 | Partially Specified | Typed severity, announcement, and ID ownership                  |
| `ErrorSummary`                                             |       P0 | Partially Specified | Typed error-item, focus timing, and dynamic-update API          |
| `FormFooter`                                               |       P1 | Partially Specified | Dirty, pending, error, and mobile sticky behavior               |
| `Toast`, `InlineAlert`, `Banner`                           |       P0 | Partially Specified | Typed action, duration/dismissal, queue, and live-region policy |
| `ConfirmationDialog`, `Modal`, `Drawer`                    |       P0 | Partially Specified | Typed size/action API and responsive composition details        |
| `StepUpAuthenticationDialog`                               |       P1 | Partially Specified | Challenge/proof DTO, typed action context, and provider states  |
| `LoadingSpinner`, `Skeleton`                               |       P0 | Partially Specified | Delay, size, labeling, and geometry API                         |
| `EmptyState`, `ErrorState`, `SuccessState`, `OfflineState` |    P0/P2 | Partially Specified | Typed action, data-preservation, announcement, and recovery API |

## Shared display and learning domain

| Component                                                     | Priority | Status              | Remaining contract, if any                                         |
| ------------------------------------------------------------- | -------: | ------------------- | ------------------------------------------------------------------ |
| `Card`, `Badge`, `Avatar`, `Timeline`, `MetadataRow`          |    P0/P1 | Partially Specified | Typed variants, content slots, fallback, and responsive API        |
| `DataTable`, `ResponsiveDataList`                             |       P1 | Partially Specified | Typed columns/rows/actions and complete loading/empty/error API    |
| `ProgressBar`, `CircularProgress`, `StatusIndicator`          |    P0/P2 | Partially Specified | Value/label API, unknown state, animation, and non-color rendering |
| `CourseCard`, `LessonCard`, `StatisticCard`, `ProgressCard`   |    P0/P1 | Partially Specified | View models, actions, states, and localization overflow            |
| `CourseProgressHeader`, `LessonNavigation`, `LessonSidebar`   |       P1 | Partially Specified | Module #8 DTO mapping, navigation edge states, and responsive API  |
| `VideoPlayerShell`, `AudioPlayer`                             |       P1 | Partially Specified | Media events, errors, captions/transcript, and control API         |
| `DocumentViewer`                                              |       P1 | Partially Specified | Viewer fallback, download, error, and keyboard behavior            |
| `VocabularyCard`                                              |       P2 | Partially Specified | Dictionary DTO, audio/image, favorite, and error states            |
| `CompletionButton`, `ContinueLearningCard`, `SectionProgress` |       P1 | Partially Specified | Module #8 mutation/read DTOs and concurrency states                |
| `LessonStatusIndicator`, `LockedLessonState`                  |       P1 | Partially Specified | Module #8 status mapping and accessible explanation API            |
| `EnrollmentStatusCard`                                        |       P1 | Partially Specified | View model, allowed actions, and lifecycle error states            |

## Teacher and admin domain

| Component                                                           | Priority | Status              | Remaining contract, if any                                        |
| ------------------------------------------------------------------- | -------: | ------------------- | ----------------------------------------------------------------- |
| `CourseBuilderSidebar`, `SortableSectionList`, `SortableLessonList` |       P1 | Partially Specified | Typed tree model, conflict, keyboard reorder, and persistence API |
| `ContentBlockEditor`, `PublishChecklist`                            |       P1 | Partially Specified | Block editor registry, validation, workflow, and failure API      |
| `StudentProgressDataTable`, `AnalyticsSummaryCards`                 |    P1/P2 | Partially Specified | Module #8/statistics DTOs, privacy scope, and metric definitions  |
| `UserManagementDataTable`, `RoleBadge`                              |       P1 | Partially Specified | Row/action DTO, role fallback, bulk, and lifecycle states         |
| `PermissionMatrix`                                                  |       P1 | Partially Specified | Dependency rules, protected roles, step-up, and conflict API      |
| `AuditTimeline`                                                     |       P1 | Partially Specified | Redacted event DTO, pagination, filtering, and detail behavior    |
| `SystemHealthCard`                                                  |       P2 | Partially Specified | Safe health DTO, refresh, stale, degraded, and permission states  |
| `DestructiveActionConfirmation`                                     |       P1 | Partially Specified | Impact model, typed confirmation, step-up, and failure behavior   |

## Feature orchestration

| Component                   | Priority | Status              | Remaining contract, if any                                           |
| --------------------------- | -------: | ------------------- | -------------------------------------------------------------------- |
| `ContentBlockRenderer`      |       P1 | Partially Specified | Typed renderer registry, view model, loading/error, and fallback API |
| `EnrollmentManagementPanel` |       P1 | Partially Specified | Typed orchestration API and full async/conflict presentation         |

Module #8 progress mutation belongs in a future `useProgressMutation` feature
hook or service, not in the component inventory. It remains contract-blocked
and may not be exported as a component.

Feature orchestrators may not be re-exported from the primitive component
package.

## Governance

Before adding a name:

1. Prove composition cannot satisfy the need.
2. Select exactly one layer and owner.
3. Define a typed public API and responsive behavior.
4. Define keyboard, focus, accessible-name, async, and error contracts.
5. Add it here and update [Components](./components.md).
6. Reject synonyms for an existing component.
