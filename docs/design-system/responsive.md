# Responsive Design Specification

**Status:** Review candidate

## Mobile-first contract

The unprefixed layout is tested at 320 px and works fluidly through 639 px.
Tailwind breakpoints remain `sm: 640`, `md: 768`, `lg: 1024`, `xl: 1280`, and
`2xl: 1536` px. There is no 375 px breakpoint.

Responsive changes respond to content pressure. Browser zoom and narrow desktop
windows receive the same usable reflow as mobile devices.

## Student navigation

This rule is settled and normative:

| Viewport          | Navigation                                                                   |
| ----------------- | ---------------------------------------------------------------------------- |
| Below 768 px      | Labeled bottom navigation, 3–5 primary destinations, safe-area padding       |
| 768–1023 px       | Fixed 72 px compact icon rail; every item has an accessible name and tooltip |
| 1024 px and above | 256 px expanded/collapsible sidebar; collapsed width is 72 px                |

`Jarayonim` is the student progress destination. Continue-learning is contextual
content, not a permanent bottom-nav item unless usability evidence supports
replacing a lower-priority destination. Teacher and admin shells use a
drawer below 1024 px and sidebar at 1024 px or above.

## Width contracts

### 320–639 px

- One main column and 16 px gutters.
- Full-width primary action where practical.
- Filters and secondary page actions move into a drawer or overflow menu.
- Routine `DataTable` content becomes `ResponsiveDataList` cards.
- Modal tasks use a full-height sheet when the keyboard would otherwise obscure
  actions.
- Sticky controls account for the active shell navigation and safe-area inset.
  On Course Player routes, player actions replace the global bottom navigation.

### 640–767 px

- Remains the mobile shell.
- Cards may form two columns only when each card remains readable with localized
  text.
- Forms may place short related controls inline.

### 768–1023 px

- Student compact rail is mandatory.
- Dashboard uses up to four columns; forms may use two.
- Routine data may remain cards; tables are allowed only for at most four
  essential columns without horizontal scrolling.
- Supporting panels are drawers.

### 1024–1279 px

- Desktop role sidebar is available.
- Dashboard uses up to eight columns.
- Teacher builder may use a 288 px rail plus main canvas.
- Course curriculum is a drawer unless the player container can preserve a
  minimum 720 px lesson region.

### 1280 px and above

- Dashboard uses a 12-column grid.
- Course player may show 320 px curriculum plus the fluid lesson region.
- The optional third player region is governed by its container, not viewport.

### 1536 px and above

- Content remains max-width constrained.
- Secondary data columns may appear.
- Empty space is preserved; type does not scale merely because width increased.

## Course player

### 320 px tested composition

1. A 56 px top bar contains Back, truncated course title, and the curriculum
   drawer trigger.
2. The lesson heading and content blocks remain in document order.
3. The player-owned sticky action region replaces the global student bottom
   navigation and uses two rows:
   - row 1: full-width `Tugallash`, `Qayta ochish`, or local pending state;
   - row 2: two equal previous/next controls with icons, visible short labels
     `Oldingi` and `Keyingi`, and full accessible names.
4. Less frequent actions move into a labeled overflow menu.
5. The region adds `env(safe-area-inset-bottom)` to its bottom padding. Its
   inline padding and controls use logical properties so translated and RTL
   layouts remain safe.
6. All targets are at least 44 × 44 px, and sticky regions cannot cover focused
   content.

The global bottom navigation is not mounted on Course Player routes at any
viewport. The top-bar Back control is the persistent exit: it returns to the
last authorized course/curriculum destination, or `/app/courses` when no safe
history entry exists. Browser Back remains available and follows the same
authorization-safe fallback.

Three long translated action labels are never placed in one horizontal row.

### Tablet

- Student compact rail remains visible; only the mobile global bottom
  navigation is replaced by player-owned actions.
- Curriculum opens as a drawer.
- Player actions may use one row only when translated labels fit without
  truncation; otherwise the 320 px two-row contract remains.
- Media controls wrap or use an accessible overflow menu.

### Desktop and container query

- At player-container width below 1024 px: central lesson region only;
  curriculum and notes are drawers.
- At player-container width 1024–1279 px: curriculum may be visible if the
  lesson region remains at least 720 px.
- At player-container width 1280 px or above: an optional 360 px third region
  may appear only if curriculum is 320 px and the central region still remains
  at least 720 px.
- When that condition fails, notes/inspector returns to a drawer even on a wide
  viewport.

## Data and forms

- `DataTable` becomes labeled record cards below 768 px unless it is an approved
  comparative matrix.
- Sorting and bulk selection remain available through labeled controls.
- Filters use a drawer below 768 px and an inline toolbar above it.
- Forms are one column by default. Two columns are reserved for short,
  semantically related fields at 768 px or above.
- Validation messages remain immediately after their field.
- Sticky form footers never cover errors or the software keyboard.

## Dialogs and drawers

- Below 640 px, complex dialogs become full-height sheets.
- At 640 px and above, dialogs are centered and width-constrained.
- Confirmation dialogs stay compact but may become bottom sheets on narrow
  screens.
- Focus behavior and restoration do not change by breakpoint.

## Long text and localization

The same layout must handle Uzbek Latin, Turkish, English, and Russian.

- Navigation labels may wrap to two lines in cards but not in bottom navigation;
  bottom-nav labels use approved short translations.
- Buttons grow vertically and wrap to two lines before text is truncated.
- Headings wrap naturally; line clamps are prohibited for primary page or lesson
  titles.
- Long unbroken user data uses `overflow-wrap: anywhere`.
- File names and identifiers may use middle truncation only when the full value
  is available on focus/activation and to assistive technology.
- Badges use full status terms; they may move to a new row.
- A translation that cannot fit after allowed wrapping triggers content/design
  review, not font-size reduction below the token scale.

## Sticky and safe-area rules

- Sticky controls use the documented z-index stack.
- Bottom controls include `env(safe-area-inset-bottom)`.
- Only one sticky action region occupies an edge.
- Content padding equals the occupied sticky region plus at least 16 px.
- Virtual keyboard behavior is tested on iOS and Android.

## Responsive acceptance set

Each critical route is tested at 320, 640, 768, 1024, 1280, and 1536 px, plus
200% and 400% zoom. The Course Player additionally tests:

- all four supported language fixtures;
- open curriculum drawer;
- captions/transcript;
- loading, error, suspended, cancelled, and pending completion states;
- browser/software keyboard and safe-area behavior;
- third-region container thresholds.
