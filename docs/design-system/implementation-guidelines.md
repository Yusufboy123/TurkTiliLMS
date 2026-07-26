# Frontend Implementation Guidelines

**Status:** Review candidate

This is implementation guidance only. It does not authorize application changes
or dependency installation.

## Required architecture

The frontend remains feature-based and API-first. Backend or Prisma types never
cross into the browser application.

```text
frontend/src/
├── app/
│   ├── providers/
│   ├── router/
│   └── shells/
├── components/
│   ├── primitives/
│   ├── layout/
│   ├── feedback/
│   └── domain/
├── features/
│   └── <feature>/
│       ├── api/
│       ├── components/
│       ├── hooks/
│       ├── pages/
│       ├── schemas/
│       ├── presenters/
│       └── types/
├── lib/
│   ├── accessibility/
│   ├── api/
│   ├── errors/
│   └── formatting/
├── styles/
│   ├── tokens.css
│   ├── globals.css
│   └── utilities.css
└── i18n/
    ├── config/
    └── locales/
```

Layer direction is page composition → feature → domain/layout/feedback →
primitive. A lower layer never imports a higher layer.

- **Primitives:** Domain-neutral control and presentation contracts.
- **Layout:** Shells, containers, stack, grid, and responsive regions.
- **Feedback:** Cross-feature loading, empty, failure, and notification states.
- **Domain:** Reusable LMS visual concepts without API orchestration.
- **Feature:** Queries, mutations, DTO mapping, policies, and feature
  orchestration.
- **Page composition:** Route-level layout, URL state, and feature assembly.

`ContentBlockRenderer` is a lesson-content feature registry/orchestrator. It is
not a primitive and belongs under `features/lesson-content`.

## Token layers

Use three layers:

1. Reference palette values.
2. Semantic purpose variables.
3. Rare component aliases derived from semantic variables.

Components consume layer 2 or 3. Arbitrary raw colors are prohibited in shared,
feature, and page code.

Approved exceptions are:

- externally supplied media pixels;
- generated course artwork already validated by the upload workflow;
- chart-series values defined by the documented semantic chart palette;
- browser/platform colors that cannot consume CSS variables.

Every exception must be named in a design PR and must not communicate status
without a semantic label.

## Exact CSS variable representation

Opaque semantic colors store space-separated RGB channels so Tailwind opacity
modifiers remain valid. Fixed-alpha colors use a separate RGB-channel variable
and opacity variable. CSS keywords such as `transparent`, shadows, and other
complete CSS values are not passed through the channel helper.

```css
:root {
  color-scheme: light;
  --color-bg-canvas: 248 249 251;
  --color-bg-surface: 255 255 255;
  --color-text-primary: 16 24 40;
  --color-border-decorative: 227 231 236;
  --color-border-control: 102 112 133;
  --color-border-control-hover: 71 84 103;
  --color-border-control-focus: 37 99 235;
  --color-placeholder: 102 112 133;
  --color-action-primary-bg: 196 0 0;
  --color-action-primary-text: 255 255 255;
  --color-action-primary-border: 196 0 0;
  --color-action-primary-hover-bg: 163 0 0;
  --color-action-primary-active-bg: 127 17 21;
  --color-focus-ring: 37 99 235;
  --color-scrim-rgb: 16 24 40;
  --opacity-scrim: 0.64;
  --color-media-control-bg-rgb: 16 24 40;
  --opacity-media-control-bg: 0.88;
}

[data-theme='dark'] {
  color-scheme: dark;
  --color-bg-canvas: 14 16 20;
  --color-bg-surface: 23 26 32;
  --color-text-primary: 247 248 250;
  --color-border-decorative: 43 48 58;
  --color-border-control: 152 162 179;
  --color-border-control-hover: 181 189 201;
  --color-border-control-focus: 96 165 250;
  --color-placeholder: 152 162 179;
  --color-action-primary-bg: 240 68 68;
  --color-action-primary-text: 16 24 40;
  --color-action-primary-border: 240 68 68;
  --color-action-primary-hover-bg: 250 102 102;
  --color-action-primary-active-bg: 255 138 138;
  --color-focus-ring: 96 165 250;
  --color-scrim-rgb: 0 0 0;
  --opacity-scrim: 0.72;
  --color-media-control-bg-rgb: 0 0 0;
  --opacity-media-control-bg: 0.88;
}
```

The exact hex values in [Foundations](./foundations.md) are converted
mechanically to RGB channels for opaque variables. The only fixed-alpha
semantic pairs in v1 are:

```css
background-color: rgb(var(--color-scrim-rgb) / var(--opacity-scrim));
background-color: rgb(var(--color-media-control-bg-rgb) / var(--opacity-media-control-bg));
```

Fixed-alpha aliases do not accept Tailwind opacity modifiers. Classes such as
`bg-scrim/50` and `bg-media-control/75` are prohibited; use the exact semantic
alias. Non-color tokens keep their natural CSS units.

## Exact Tailwind CSS 3.4 mapping

Tailwind defaults are extended, not replaced. The default screens remain
`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`, and `2xl: 1536px`.
The 320 px contract is unprefixed base CSS. There is no custom 375 px
breakpoint.

The dark-mode selector is `[data-theme="dark"]` on the root element. Tailwind
3.4.1 or later uses selector mode with that custom selector. The application
must set the attribute before paint when dark mode is implemented.

Exact documentation example:

```ts
import type { Config } from 'tailwindcss';

const channel = (variable: string) => `rgb(var(${variable}) / <alpha-value>)`;

const fixedAlpha = (rgbVariable: string, opacityVariable: string) =>
  `rgb(var(${rgbVariable}) / var(${opacityVariable}))`;

export default {
  darkMode: ['selector', '[data-theme="dark"]'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: channel('--color-bg-canvas'),
        surface: channel('--color-bg-surface'),
        subtle: channel('--color-bg-subtle'),
        raised: channel('--color-bg-raised'),
        text: {
          primary: channel('--color-text-primary'),
          secondary: channel('--color-text-secondary'),
          muted: channel('--color-text-muted'),
          inverse: channel('--color-text-inverse'),
        },
        placeholder: channel('--color-placeholder'),
        border: {
          decorative: channel('--color-border-decorative'),
          control: channel('--color-border-control'),
          'control-hover': channel('--color-border-control-hover'),
          'control-focus': channel('--color-border-control-focus'),
        },
        'action-primary-bg': channel('--color-action-primary-bg'),
        'action-primary-text': channel('--color-action-primary-text'),
        'action-primary-border': channel('--color-action-primary-border'),
        'action-primary-hover-bg': channel('--color-action-primary-hover-bg'),
        'action-primary-active-bg': channel('--color-action-primary-active-bg'),
        'action-secondary-bg': channel('--color-action-secondary-bg'),
        'action-secondary-text': channel('--color-action-secondary-text'),
        'action-secondary-border': channel('--color-action-secondary-border'),
        'action-secondary-hover-bg': channel('--color-action-secondary-hover-bg'),
        'action-secondary-active-bg': channel('--color-action-secondary-active-bg'),
        'action-tertiary-bg': 'transparent',
        'action-tertiary-text': channel('--color-action-tertiary-text'),
        'action-tertiary-border': 'transparent',
        'action-tertiary-hover-bg': channel('--color-action-tertiary-hover-bg'),
        'action-tertiary-active-bg': channel('--color-action-tertiary-active-bg'),
        'action-danger-bg': channel('--color-action-danger-bg'),
        'action-danger-text': channel('--color-action-danger-text'),
        'action-danger-border': channel('--color-action-danger-border'),
        'action-danger-hover-bg': channel('--color-action-danger-hover-bg'),
        'action-danger-active-bg': channel('--color-action-danger-active-bg'),
        'action-disabled-bg': channel('--color-action-disabled-bg'),
        'action-disabled-text': channel('--color-action-disabled-text'),
        'action-disabled-border': channel('--color-action-disabled-border'),
        link: {
          DEFAULT: channel('--color-link-default'),
          hover: channel('--color-link-hover'),
          active: channel('--color-link-active'),
          visited: channel('--color-link-visited'),
          focus: channel('--color-link-focus'),
        },
        nav: {
          hover: channel('--color-nav-hover-bg'),
          selected: channel('--color-nav-selected-bg'),
          'selected-text': channel('--color-nav-selected-text'),
          indicator: channel('--color-nav-selected-indicator'),
        },
        icon: {
          DEFAULT: channel('--color-icon-default'),
          muted: channel('--color-icon-muted'),
          brand: channel('--color-icon-brand'),
          success: channel('--color-icon-success'),
          warning: channel('--color-icon-warning'),
          danger: channel('--color-icon-danger'),
          info: channel('--color-icon-info'),
        },
        focus: channel('--color-focus-ring'),
        disabled: {
          bg: channel('--color-disabled-bg'),
          text: channel('--color-disabled-text'),
          border: channel('--color-disabled-border'),
        },
        skeleton: {
          bg: channel('--color-skeleton-bg'),
          shimmer: channel('--color-skeleton-shimmer'),
        },
        neutral: {
          bg: channel('--color-neutral-bg'),
          text: channel('--color-neutral-text'),
          border: channel('--color-neutral-border'),
        },
        success: {
          bg: channel('--color-success-bg'),
          text: channel('--color-success-text'),
          border: channel('--color-success-border'),
        },
        warning: {
          bg: channel('--color-warning-bg'),
          text: channel('--color-warning-text'),
          border: channel('--color-warning-border'),
        },
        danger: {
          bg: channel('--color-danger-bg'),
          text: channel('--color-danger-text'),
          border: channel('--color-danger-border'),
        },
        info: {
          bg: channel('--color-info-bg'),
          text: channel('--color-info-text'),
          border: channel('--color-info-border'),
        },
        scrim: fixedAlpha('--color-scrim-rgb', '--opacity-scrim'),
        media: {
          control: fixedAlpha('--color-media-control-bg-rgb', '--opacity-media-control-bg'),
          text: channel('--color-media-control-text'),
          unplayed: channel('--color-media-track-unplayed'),
          played: channel('--color-media-track-played'),
          buffered: channel('--color-media-track-buffered'),
          outline: channel('--color-media-track-outline'),
          thumb: channel('--color-media-thumb-bg'),
          'thumb-border': channel('--color-media-thumb-border'),
        },
        chart: {
          1: channel('--color-chart-series-1'),
          2: channel('--color-chart-series-2'),
          3: channel('--color-chart-series-3'),
          4: channel('--color-chart-series-4'),
          5: channel('--color-chart-series-5'),
          grid: channel('--color-chart-grid'),
        },
      },
      fontFamily: {
        sans: ['Inter', '"Segoe UI"', 'Arial', 'sans-serif'],
      },
      zIndex: {
        raised: '10',
        sticky: '20',
        dropdown: '30',
        drawer: '40',
        scrim: '45',
        modal: '50',
        popover: '60',
        toast: '70',
        tooltip: '80',
        'skip-link': '90',
      },
    },
  },
} satisfies Config;
```

The mapping above is the exact v1 naming contract. Parallel names such as
`grayBorder`, `redButton`, or `darkCard` are prohibited.

### Migration from existing raw colors

1. Inventory raw hex, RGB, named, and Tailwind palette classes in global CSS and
   JSX/TSX.
2. Assign each use a documented semantic purpose.
3. Add a missing semantic token only when no existing token fits.
4. Replace shared primitives first, then feature components, then pages.
5. Verify both themes and forced colors.
6. Add lint/static-search prevention for new raw values outside token files.
7. Record approved exceptions in the change description.

Migration is complete only when raw global colors and palette utilities no
longer drive product UI.

## Component implementation rules

- Public variants are typed and closed; API strings never become class names.
- Use state attributes such as `data-state`, `data-loading`,
  `data-orientation`, and `aria-invalid`.
- Pages do not recreate buttons, fields, dialogs, status, tables, or feedback.
- One `Button` primitive owns all button intents.
- `DataTable` is the shared tabular compound; `ResponsiveDataList` is its narrow
  representation. Do not introduce a second `Table` component.
- `Input` owns the native control. `FormField` owns label, description, error,
  and required state. `EmailField` and `PasswordField` exist only for distinct
  behavior.
- `IconButton` requires an accessible name. Tooltip use depends on whether the
  icon is self-evident in context.
- `Portal` and `FocusScope` are internal infrastructure contracts, not visual
  variants.

Avoid boolean variant combinations. Prefer discriminated contracts such as
`intent`, `size`, `density`, and `placement`.

## React and API boundaries

- Route pages orchestrate URL state and feature composition.
- Query/mutation hooks own request lifecycle; presentational components receive
  explicit view models.
- API DTOs are runtime-validated at the boundary and mapped to frontend view
  models.
- Axios uses the shared client and centralized authentication/error policies.
- Components never inspect JWTs or infer permissions from hidden navigation.
- Route middleware remains a convenience; the API is authoritative.
- Server state is not copied into local state unless an edited draft requires
  it.
- Mutations invalidate the smallest relevant query set.

## Responsive implementation

- Write base styles for the 320 px contract.
- Add `sm`, `md`, `lg`, `xl`, or `2xl` only when content requires a structural
  change.
- Student navigation is bottom navigation below 768 px, a 72 px icon rail from
  768–1023 px, and an expanded/collapsible sidebar at 1024 px and above.
- Use container queries for the optional third course-player region.
- Preserve DOM and reading order across layouts.
- Use logical properties and safe-area insets.
- CSS truncation requires an accessible route to the full value.

## Asset and font rules

- Inter v1 files must contain Latin Extended and Cyrillic subsets; use
  `font-display: swap`.
- SVG is preferred for interface icons and brand marks.
- Raster images provide `width` and `height`, `srcset`, and `sizes`.
- Serve AVIF when supported, then WebP, with a compatible fallback.
- Only the single above-the-fold LCP image may use eager loading and
  `fetchpriority="high"`.
- Below-fold images and heavyweight media viewers load lazily.
- User SVG is never injected unsanitized.

## Loading, retry, and offline behavior

- Skeletons represent predictable initial layout only; repeated background
  refresh keeps existing content and shows a subtle nonblocking status.
- Indeterminate spinners are delayed approximately 400 ms to avoid flicker.
- Recoverable failures show an inline retry near the failed region.
- Offline state distinguishes cached reads, unsent writes, and unavailable
  actions.
- Safe form input and uploaded-file queue metadata survive recoverable server or
  network failures.
- Destructive mutations never retry automatically.

## Measurable performance contract

### Release-blocking targets

Measured at p75 for the public home, catalog, login, student dashboard, and
course-player routes on representative production traffic:

- LCP ≤ 2.5 seconds.
- INP ≤ 200 milliseconds.
- CLS ≤ 0.1.
- No image without intrinsic dimensions.
- Initial JavaScript, gzip: public route ≤ 180 KB; authenticated shell plus
  route ≤ 250 KB; course player shell ≤ 280 KB excluding streamed media.
- Any single lazy route/component chunk ≤ 100 KB gzip unless an approved ADR
  records why it cannot be split.

A new dependency must report route-level gzip cost. Exceeding a blocking budget
requires correction or a time-bounded ADR exception.

### Web Vitals measurement method

Production real-user monitoring is authoritative once a route/device segment
has at least 200 eligible page visits in the rolling previous 28 calendar days.
Report the p75 separately for mobile and desktop; do not combine device classes
or hide a failing route in a site-wide aggregate. Record measurement window,
sample count, route, device class, app version, and consent/sampling exclusions.

Until a segment reaches that sample floor, release evidence uses five
cold-cache runs in the current stable Chrome with a fixed mobile profile:
4× CPU slowdown, 1.6 Mbps downstream, 750 Kbps upstream, and 150 ms round-trip
latency. Report the sorted-run p75 for each route and the tool/browser version.
This laboratory fallback is temporary evidence, not a substitute for later
real-user monitoring. A failed eligible production p75 cannot be replaced by a
passing lab result.

### Aspirational targets

- TTFB ≤ 800 ms at p75.
- Public route initial CSS ≤ 50 KB gzip.
- Repeat navigation uses cached shells and avoids full-screen loading.
- Background progress refresh produces no visible layout shift.

Aspirational misses are tracked but do not alone block release.

## Validation and testing

Every primitive requires:

- type/API tests;
- keyboard and focus tests;
- accessible-name and state tests;
- light/dark visual coverage;
- 320, 768, 1024, and 1536 px layout coverage;
- loading, empty, error, disabled, and long-localized-text coverage where
  applicable.

Release verification also includes automated accessibility, calculated token
contrast fixtures, bundle analysis, Core Web Vitals monitoring, and the manual
assistive-technology matrix in
[Accessibility](./accessibility.md).

## Implementation constraints

- Do not hardcode owner-editable business content.
- Admin theme controls accept only approved contrast-tested presets.
- Arbitrary CSS and JavaScript are prohibited.
- Do not introduce a chart package for initial progress displays.
- Do not implement Module #8 frontend behavior until its contracts meet the
  approval gate in [Progress Tracking UI](./progress-tracking-ui.md).
