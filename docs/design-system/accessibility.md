# Accessibility Specification

**Status:** Review candidate

## Standard

Turk Tili LMS targets WCAG 2.2 AA for public, student, teacher, and admin
experiences. Native HTML is preferred. ARIA supplements semantics; it does not
replace them.

## Perceivable content

### Contrast

- Normal text and placeholder text meet at least 4.5:1.
- Large text meets at least 3:1.
- Focus indicators, meaningful graphics, and interactive control boundaries
  meet at least 3:1 against adjacent colors.
- Decorative dividers may be subtler only when no boundary or state depends on
  them.
- Status, selection, progress, and chart series are never communicated by color
  alone.
- Light and dark theme presets must pass automated contrast fixtures using the
  exact pairs in [Foundations](./foundations.md).

### Reflow and text

- At 320 CSS px and 400% zoom, content has no two-dimensional scrolling except
  an approved `PermissionMatrix` or genuinely comparative data matrix.
- Approved matrices have a visible scrolling instruction, sticky row/column
  context, keyboard access, and a non-matrix summary.
- Text can resize to 200% without loss of content, action, or focus visibility.
- Uzbek Latin, Turkish, English, and Russian fixtures test expansion, long
  words, apostrophes, dotted/dotless I, and Cyrillic.
- Text is not embedded in images except an approved brand mark.

### Media

- Prerecorded video has synchronized captions for all spoken dialogue and
  meaningful sounds.
- Caption review confirms no omitted instruction, speaker ambiguity, or
  meaning-changing timing drift; timing should remain within one second of the
  corresponding audio during normal playback.
- A complete transcript conveys the same spoken and meaningful audio
  information and identifies speakers where needed.
- Audio-only learning content has a complete transcript.
- Player controls are keyboard accessible and have visible focus.
- Autoplay with sound is prohibited.
- PDF/document content has an accessible download alternative and, where it is
  core learning content, an accessible HTML or remediated-document route.

## Operable interaction

### Keyboard

All functions are available without a pointer. Release journeys include login,
course discovery, resume, lesson completion, profile editing, teacher course
editing, user administration, and step-up authentication.

- No keyboard trap is permitted.
- Escape closes dismissible overlays and restores focus.
- Drag-and-drop always has keyboard move commands and announcements.
- DOM order remains meaningful when responsive layout changes.

#### Course-player shortcuts

Global single-character shortcuts are disabled by default.

- `Alt+ArrowLeft` and `Alt+ArrowRight` may navigate lessons after conflict
  testing and must respect browser/OS reservations.
- Single-character actions such as `C`, `[` or `]` may run only when the player
  root has focus **and** the user has explicitly enabled or remapped them.
- Shortcuts never trigger while focus is in an input, textarea, select,
  contenteditable editor, captions/transcript control, search field, dialog, or
  menu.
- A “Klaviatura yorliqlari” disclosure lists current mappings, scope, and a
  disable/reset action.
- Conflicting user, browser, OS, or assistive-technology shortcuts are rejected
  during remapping with a plain-language explanation.
- Shortcut state is a user preference and never changes authorization.

Release acceptance: no global single-character shortcut fires under default
settings or while typing in any excluded context.

### Focus

- Every focus indicator is at least 2 CSS px and at least 3:1 against adjacent
  colors.
- Focus order follows task and reading order.
- Opening a modal/drawer moves focus according to its documented initial-focus
  policy; closing/cancelling restores focus to the invoking control.
- If the invoking control is removed, focus moves to the nearest stable heading
  or page container.
- Route changes move focus to the page heading after navigation is announced.
- Sticky regions cannot hide the focused element.
- Forced-colors mode retains an outline fallback.

### Touch and pointer

- All standalone targets are at least 44 × 44 CSS px.
- An inline text link in a paragraph is the only size exception; it must have
  adequate line height and spacing.
- Compact controls may look smaller only if their nonoverlapping hit area is
  44 × 44 px.
- Gestures have single-pointer alternatives.
- Hover-only content is also available by keyboard and touch.

## Understandable interfaces

### Structure and landmarks

- One `h1` names each route.
- Heading levels follow content hierarchy.
- Public pages provide header, navigation, main, and footer landmarks.
- Application shells provide labeled navigation and main landmarks.
- Skip links are the first focusable elements.

### Forms and errors

- Every control has a visible persistent label.
- Help and error text are connected with `aria-describedby`.
- Invalid state uses `aria-invalid`; required state is both visible and
  programmatic.
- Failed submission focuses `ErrorSummary`, whose links move to each field.
- Errors name the problem and correction without exposing internals.
- Recoverable failure preserves safe user input.
- Step-up verification errors do not reveal whether a hidden role, permission,
  or identity matched.

### Async announcements

- Initial loading has a programmatic label but is not repeatedly announced.
- Save, upload, completion, reorder, retry, offline, and background-refresh
  outcomes use a polite live region.
- Destructive failure or an expired session may use an assertive alert when
  immediate action is required.
- Progress announcements use the authoritative API value and do not announce
  speculative percentages.
- Toasts never become the sole record of a failure or required next action.

## Component semantics

| Component         | Required semantics                                                      |
| ----------------- | ----------------------------------------------------------------------- |
| `Button`          | Native button; loading/disabled state; label retained                   |
| `IconButton`      | Native button and mandatory accessible name                             |
| `DataTable`       | Caption, scoped headers, sort state, selected-row labels                |
| `ProgressBar`     | Native `progress` or min/max/now plus textual value                     |
| `Dialog`          | Name, description, modal semantics, focus scope/restoration             |
| `Drawer`          | Dialog semantics when modal; labeled complementary region when nonmodal |
| `Menu`            | Menu button, roving focus, Escape, typeahead                            |
| `Disclosure`      | Button, `aria-expanded`, `aria-controls`                                |
| `Tabs`            | Tablist/tab/tabpanel relationships and keyboard model                   |
| `ErrorSummary`    | Focusable summary heading and links to invalid fields                   |
| `StatusIndicator` | Visible text plus icon/shape; never color alone                         |

## Reduced motion

When `prefers-reduced-motion: reduce` is active:

- nonessential animation and parallax are removed;
- skeleton shimmer becomes static;
- progress changes update without tweening;
- drawers, dialogs, and route transitions complete effectively immediately;
- no required state is communicated only through animation.

Release acceptance checks both preferences and confirms no flashing content
exceeds accessibility thresholds.

## Test matrix

Use the latest two supported stable browser versions at release unless the
browser/AT pairing imposes a stricter supported combination.

| Platform | Browser | Assistive technology | Required scope                             |
| -------- | ------- | -------------------- | ------------------------------------------ |
| Windows  | Chrome  | NVDA                 | All critical student/admin journeys        |
| Windows  | Firefox | NVDA                 | All critical student/admin journeys        |
| Windows  | Edge    | Narrator             | Login, navigation, forms, dialog, player   |
| macOS    | Safari  | VoiceOver            | Public, student, teacher critical journeys |
| iOS      | Safari  | VoiceOver            | Public, student player, forms, bottom nav  |
| Android  | Chrome  | TalkBack             | Public, student player, forms, bottom nav  |

Keyboard-only testing runs in Chrome, Firefox, Edge, and Safari. Automated
testing runs on every changed route but does not replace manual AT checks.

## Release acceptance criteria

- Zero critical or serious automated accessibility violations.
- All critical keyboard journeys complete without traps.
- Focus indicators meet the 2 px and 3:1 requirements.
- 320 px reflow passes except approved complex matrices.
- No status, progress, or action is communicated by color alone.
- Modal/drawer focus entry and restoration pass.
- Every form error is associated and represented in `ErrorSummary`.
- Caption/transcript completeness review passes for every published media item.
- Async status changes have verified screen-reader announcements.
- Every required target passes 44 × 44 px checks.
- Reduced-motion behavior passes.
- Default single-character shortcut suppression passes.
- The browser/assistive-technology matrix records pass, defect, owner, and
  retest evidence.
