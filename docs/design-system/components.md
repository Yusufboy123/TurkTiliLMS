# Component System

**Status:** Review candidate

## Component layers

Components have one owner layer:

1. **Primitives:** Domain-neutral controls and semantics.
2. **Layout:** Containers, shells, and responsive regions.
3. **Feedback:** Loading, empty, error, and status communication.
4. **Domain:** Reusable course, enrollment, user, and media presentation.
5. **Feature:** API-aware workflow composition and registries.
6. **Page composition:** Route-specific assembly; never a reusable library.

Dependencies flow downward. Domain components may compose primitives, layout,
and feedback. Feature components may compose all lower layers. A primitive may
not know about courses, roles, API DTOs, or routes.

## Universal contract

Every interactive component defines:

- visible, hover, active, focus-visible, disabled, loading, success, and error
  behavior as applicable;
- keyboard interaction and focus ownership;
- accessible name, description, role, and state;
- 44 × 44 px minimum target;
- 320 px, long-text, zoom, reduced-motion, light, and dark behavior;
- controlled and uncontrolled behavior only where both are justified;
- no raw API error, permission identifier, stack trace, or persistence record.

## Primitive contracts

### Button

There is one `Button` primitive.

```text
intent: primary | secondary | tertiary | danger
size: sm | md | lg
width: auto | full
loading: boolean
disabled: boolean
iconPlacement: none | start | end
```

- `primary` is the single highest-emphasis action in a region.
- `secondary` has a meaningful control border.
- `tertiary` is text/neutral and retains a visible focus target.
- `danger` is reserved for destructive consequences.
- Every variant consumes the exact default, hover, pressed, focus, disabled,
  and loading aliases in the
  [Foundations Button mapping matrix](./foundations.md#button-mapping-matrix).
  Button guidance and implementations may not introduce raw colors or derive
  interaction states with opacity.
- Loading retains the label, adds progress semantics, and blocks duplicate
  activation. It keeps the current variant colors and uses a
  `currentColor` progress indicator.
- Disabled and loading are distinct states. Disabled uses the shared disabled
  background, text, and border aliases and has no hover or pressed response.
- An icon cannot replace the accessible label in `Button`.

`IconButton` is the specialized icon-only wrapper. Its accessible name is
mandatory. A tooltip is recommended when meaning is not obvious, but is not
required when an adjacent visible label or universally understood context makes
the action clear.

`SplitButton` is a compound containing one `Button` plus a separate
`IconButton` menu trigger. Each target is independently focusable and the menu
follows the `Menu` contract.

`MobileFloatingAction` is the only floating-action name. It uses `Button`
semantics, never covers bottom navigation, and is allowed only when the same
action is also available in reading order.

### Input and FormField

`Input` owns the native input element, input mode, value, disabled/read-only
state, and `aria-invalid`. `FormField` owns the visible label, optional/required
text, description, validation message, and ID associations.

- Placeholder text is supplementary, never the only label or instruction.
- `EmailField` composes `FormField` and `Input` only to add email normalization,
  autocomplete, and input-mode behavior.
- `PasswordField` exists because it adds reveal state, Caps Lock guidance,
  password-manager compatibility, and security rules.
- Do not create `TextInput`, `EmailInput`, or visual-only field variants.
- `ErrorSummary` receives an ordered list of errors with field IDs, moves focus
  only after a failed submission, and links each item to the invalid field.

Other primitives include `Textarea`, `Select`, `SearchableSelect`,
`MultiSelect`, `Checkbox`, `RadioGroup`, `Switch`, `DatePicker`, `FileUpload`,
`RichTextEditor`, and `FormFooter`. All compose `FormField` where a field label
or error is required.

### Overlay and disclosure infrastructure

| Component        | Contract                                                                                                                                                    |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Portal`         | Mounts into the single overlay root; preserves ownership IDs and never selects arbitrary z-index values.                                                    |
| `FocusScope`     | Traps focus only for modal surfaces, restores focus to the invoking control, supports initial-focus policy, and handles a removed trigger safely.           |
| `Popover`        | Nonmodal anchored surface; closes on Escape/outside interaction, returns focus when dismissal follows keyboard activation, and repositions within viewport. |
| `Menu`           | Menu-button semantics, roving focus, Arrow/Home/End navigation, Escape close, typeahead, disabled items, and no form controls inside.                       |
| `Disclosure`     | Button with `aria-expanded`/`aria-controls`; collapsed content is removed from navigation and reading order.                                                |
| `VisuallyHidden` | Hides content visually without removing it from accessibility APIs; never hides focusable content.                                                          |
| `Tooltip`        | Supplementary, noninteractive text on hover and focus; never contains required instructions or actions.                                                     |
| `SkipLink`       | First focusable page control; remains visually hidden until focused, then moves focus to the named main landmark without changing authorization or routing. |

`Modal`, `ConfirmationDialog`, `Drawer`, and
`StepUpAuthenticationDialog` compose `Portal` and `FocusScope`; they do not
implement separate focus-trap behavior.

### SkipLink

```text
targetId: string
label: string = "Asosiy kontentga o‘tish"
```

`SkipLink` renders a native same-page anchor and is the first focusable control
in every shell. It is visually hidden only while unfocused. On keyboard
activation it targets the existing named main landmark, updates focus there,
and preserves a visible focus indicator; the main landmark may use
`tabIndex="-1"` only for this programmatic focus. It has no disabled, loading,
empty, or error variant. A missing target is a development error caught by a
component test, not a silent no-op.

### RoleSwitcher

`RoleSwitcher` appears only for users with more than one active role. It changes
the presentation context, not authorization. It:

- names the current role and available roles;
- uses a `Menu` on desktop and a labeled sheet on narrow screens;
- redirects to the selected role’s valid landing page;
- announces the context change;
- does not persist or grant a role;
- omits unauthorized roles instead of showing disabled permission details.

## Layout components

`PageContainer`, `Stack`, `Inline`, `Grid`, `Surface`, `Divider`,
`SectionHeader`, `PublicNavbar`, `DashboardSidebar`, `StudentCompactRail`,
`MobileBottomNavigation`, `Breadcrumbs`, and role shells own layout only.

Student shell navigation is fixed:

- below 768 px: labeled bottom navigation;
- 768–1023 px: 72 px icon rail with accessible labels/tooltips;
- 1024 px and above: expanded/collapsible sidebar.

## Navigation components

`Tabs`, `Stepper`, `Pagination`, `UserMenu`, and `Breadcrumbs` expose semantic
navigation. Current destinations use `aria-current` and the centralized
selected-state tokens. Major filter/tab state is URL-addressable.

The public registration entry is capability-gated and absent when invitations
or admin-created accounts are the only launch path.

## Data display

`DataTable` is the single shared tabular compound. It owns caption, headers,
sorting state, selection, bulk-action context, pagination handoff, and row
actions. `ResponsiveDataList` is its deliberate narrow-screen companion, not a
second table implementation. Routine CRUD data changes to labeled record cards
below 768 px; only approved comparative matrices may scroll in two dimensions.

Other shared display components include `Card`, `CourseCard`, `LessonCard`,
`StatisticCard`, `ProgressCard`, `Badge`, `Avatar`, `Timeline`, `ProgressBar`,
`CircularProgress`, `StatusIndicator`, and `MetadataRow`.

Status components receive a stable domain state and use the single mapping in
[Foundations](./foundations.md). Unknown values fail to a labeled neutral state.

## Feedback components

| Component        | Required behavior                                                               |
| ---------------- | ------------------------------------------------------------------------------- |
| `Toast`          | Brief nonessential result; pauses on hover/focus; never the only recovery path. |
| `InlineAlert`    | Persistent contextual result with optional action.                              |
| `Banner`         | Page/system scope; dismissal persistence explicit.                              |
| `LoadingSpinner` | Delayed for short waits; labeled.                                               |
| `Skeleton`       | Initial predictable geometry only; no shimmer under reduced motion.             |
| `EmptyState`     | Distinguishes no data, no results, no permission, and unavailable feature.      |
| `ErrorState`     | Plain-language error, safe reference ID, and in-context retry.                  |
| `OfflineState`   | States cached/unsent impact and available retry.                                |
| `ErrorSummary`   | Submission-level focus target and field links.                                  |

Async results use live regions appropriate to urgency and never steal focus.

## Domain components

### Learning

`CourseProgressHeader`, `LessonNavigation`, `LessonSidebar`,
`VideoPlayerShell`, `AudioPlayer`, `DocumentViewer`, `VocabularyCard`,
`CompletionButton`, `ContinueLearningCard`, `SectionProgress`,
`LessonStatusIndicator`, `LockedLessonState`, and `EnrollmentStatusCard` are
domain presentation.

At 320 px the player action region has two rows:

1. full-width `Tugallash`/pending action;
2. two equal 44 px-minimum previous/next controls using icons plus short visible
   labels `Oldingi` and `Keyingi`, with full accessible names.

Long alternative actions move to the lesson overflow menu or curriculum drawer.
Three long translated labels never share one row.

`VideoPlayerShell` and `AudioPlayer` use the fixed-alpha media-control surface
and the played, buffered, unplayed, outline, thumb, and thumb-border aliases
from [Foundations](./foundations.md#media-and-chart-tokens). Timeline meaning must
remain visible without color: played is an 8 px solid segment, buffered is a
6 px dashed segment, and unplayed is a 4 px solid outlined segment. The 16 px
thumb has its own boundary. Elapsed time, duration, and current seek value are
visible and programmatically associated with the accessible slider. Forced
Colors preserves segment geometry, dash pattern, thumb, value text, focus, and
operability.

### Teacher and admin

Teacher domain components include `CourseBuilderSidebar`,
`SortableSectionList`, `SortableLessonList`, `ContentBlockEditor`,
`PublishChecklist`, and `StudentProgressDataTable`. Keyboard move commands and
live announcements are mandatory; drag-and-drop is never the only reorder path.

Admin domain components include `UserManagementDataTable`, `RoleBadge`,
`PermissionMatrix`, `AuditTimeline`, `SystemHealthCard`, and
`DestructiveActionConfirmation`.

## Feature components

`ContentBlockRenderer` is a registry/orchestrator owned by the lesson-content
feature:

- dispatches stable block types to typed domain renderers;
- validates its frontend view model at the API boundary;
- applies media access and completion capability rules;
- renders a safe unsupported-block state;
- never infers completion or media compatibility from filenames.

Other API-aware workflows, such as enrollment management and progress mutation,
also remain in feature folders.

## Step-up authentication component

`StepUpAuthenticationDialog` is the default short-flow container. A dedicated
page is used when the verification provider redirects, recovery is required, or
the task cannot safely fit in a modal.

The component contract:

- explains that identity must be verified without naming hidden permissions;
- assumes current-password or recent-auth verification at launch and remains
  extensible to MFA; it does not choose the authentication method;
- uses an API-authoritative recent-auth window, with 10 minutes as the v1 UX
  assumption;
- offers `Bekor qilish`, which closes the flow without changing data;
- handles wrong verification, rate limit, expired session, and network failure
  with associated, focusable errors;
- after success, returns to a fresh confirmation of the original action;
- if context or target changed, discards the authorization and requires the
  action to be reviewed again;
- never retains passwords, codes, or tokens in logs or browser storage.

The step-up result and protected action are separately audited by the backend.
Further behavior is defined in [Interaction Patterns](./patterns.md).
