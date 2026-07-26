# Foundations

**Status:** Review candidate

This document is the normative source for visual tokens. Components consume
semantic tokens; feature and page code must not select raw palette values.

## Color architecture

### Reference palettes

Reference values are implementation details. They may be used only to define
semantic tokens, approved illustrations, or documented chart series.

| Reference   | Light value | Dark counterpart |
| ----------- | ----------- | ---------------- |
| `brand-50`  | `#FFF1F1`   | `#2B1113`        |
| `brand-100` | `#FFE0E0`   | `#431417`        |
| `brand-200` | `#FFC7C7`   | `#66171C`        |
| `brand-300` | `#FF9999`   | `#8E1A20`        |
| `brand-400` | `#F85F5F`   | `#C02A30`        |
| `brand-500` | `#E00000`   | `#F04444`        |
| `brand-600` | `#C40000`   | `#FA6666`        |
| `brand-700` | `#A30000`   | `#FF8A8A`        |
| `brand-800` | `#7F1115`   | `#FFB3B3`        |
| `brand-900` | `#571015`   | `#FFE0E0`        |

| Reference     | Light value | Dark counterpart |
| ------------- | ----------- | ---------------- |
| `neutral-0`   | `#FFFFFF`   | `#0E1014`        |
| `neutral-25`  | `#FCFCFD`   | `#12151A`        |
| `neutral-50`  | `#F8F9FB`   | `#171A20`        |
| `neutral-100` | `#F1F3F6`   | `#20242C`        |
| `neutral-200` | `#E3E7EC`   | `#2B303A`        |
| `neutral-300` | `#CBD1D9`   | `#3A414D`        |
| `neutral-400` | `#98A2B3`   | `#667085`        |
| `neutral-500` | `#667085`   | `#98A2B3`        |
| `neutral-600` | `#475467`   | `#B5BDC9`        |
| `neutral-700` | `#344054`   | `#D0D5DD`        |
| `neutral-800` | `#1D2939`   | `#EAECF0`        |
| `neutral-900` | `#101828`   | `#F7F8FA`        |

### Core semantic tokens

| Token                        | Light      | Dark      | Use                         |
| ---------------------------- | ---------- | --------- | --------------------------- |
| `color-bg-canvas`            | `#F8F9FB`  | `#0E1014` | Application background      |
| `color-bg-surface`           | `#FFFFFF`  | `#171A20` | Cards and controls          |
| `color-bg-subtle`            | `#F1F3F6`  | `#20242C` | Grouped content             |
| `color-bg-raised`            | `#FFFFFF`  | `#20242C` | Menus and dialogs           |
| `color-text-primary`         | `#101828`  | `#F7F8FA` | Body and headings           |
| `color-text-secondary`       | `#475467`  | `#B5BDC9` | Supporting text             |
| `color-text-muted`           | `#667085`  | `#98A2B3` | Nonessential metadata       |
| `color-text-inverse`         | `#FFFFFF`  | `#101828` | Text on strong actions      |
| `color-border-decorative`    | `#E3E7EC`  | `#2B303A` | Nonessential dividers only  |
| `color-border-control`       | `#667085`  | `#98A2B3` | Meaningful control boundary |
| `color-border-control-hover` | `#475467`  | `#B5BDC9` | Hovered control boundary    |
| `color-border-control-focus` | `#2563EB`  | `#60A5FA` | Focused control boundary    |
| `color-placeholder`          | `#667085`  | `#98A2B3` | Placeholder text            |
| `color-focus-ring`           | `#2563EB`  | `#60A5FA` | Universal focus ring        |
| `color-disabled-bg`          | `#F1F3F6`  | `#20242C` | Disabled surface            |
| `color-disabled-text`        | `#475467`  | `#B5BDC9` | Disabled readable content   |
| `color-disabled-border`      | `#667085`  | `#98A2B3` | Disabled control boundary   |
| `color-scrim-rgb`            | `16 24 40` | `0 0 0`   | Scrim RGB channels          |
| `opacity-scrim`              | `0.64`     | `0.72`    | Fixed scrim opacity         |
| `color-skeleton-bg`          | `#E3E7EC`  | `#2B303A` | Skeleton base               |
| `color-skeleton-shimmer`     | `#F8F9FB`  | `#3A414D` | Skeleton highlight          |

Decorative borders may be subtle because they do not communicate a control,
state, or required region boundary. Inputs, selects, unchecked checkboxes,
interactive cards, and other controls use `color-border-control`; shadow or
decorative border alone is never the only control boundary.

### Action tokens

| Token                              | Light         | Dark          | Use                             |
| ---------------------------------- | ------------- | ------------- | ------------------------------- |
| `color-action-primary-bg`          | `#C40000`     | `#F04444`     | Primary default background      |
| `color-action-primary-text`        | `#FFFFFF`     | `#101828`     | Primary text-on-fill            |
| `color-action-primary-border`      | `#C40000`     | `#F04444`     | Primary border                  |
| `color-action-primary-hover-bg`    | `#A30000`     | `#FA6666`     | Primary hover background        |
| `color-action-primary-active-bg`   | `#7F1115`     | `#FF8A8A`     | Primary pressed background      |
| `color-action-secondary-bg`        | `#FFFFFF`     | `#171A20`     | Secondary default background    |
| `color-action-secondary-text`      | `#101828`     | `#F7F8FA`     | Secondary text                  |
| `color-action-secondary-border`    | `#667085`     | `#98A2B3`     | Secondary border                |
| `color-action-secondary-hover-bg`  | `#F1F3F6`     | `#2B303A`     | Secondary hover background      |
| `color-action-secondary-active-bg` | `#E3E7EC`     | `#3A414D`     | Secondary pressed background    |
| `color-action-tertiary-bg`         | `transparent` | `transparent` | Tertiary default background     |
| `color-action-tertiary-text`       | `#475467`     | `#B5BDC9`     | Tertiary default text           |
| `color-action-tertiary-border`     | `transparent` | `transparent` | Tertiary default border         |
| `color-action-tertiary-hover-bg`   | `#F1F3F6`     | `#2B303A`     | Tertiary hover background       |
| `color-action-tertiary-active-bg`  | `#E3E7EC`     | `#3A414D`     | Tertiary pressed background     |
| `color-action-danger-bg`           | `#B42318`     | `#FDA29B`     | Danger default background       |
| `color-action-danger-text`         | `#FFFFFF`     | `#101828`     | Danger text-on-fill             |
| `color-action-danger-border`       | `#B42318`     | `#FDA29B`     | Danger border                   |
| `color-action-danger-hover-bg`     | `#912018`     | `#FECDCA`     | Danger hover background         |
| `color-action-danger-active-bg`    | `#7A271A`     | `#FEE4E2`     | Danger pressed background       |
| `color-action-disabled-bg`         | `#F1F3F6`     | `#20242C`     | All disabled button backgrounds |
| `color-action-disabled-text`       | `#475467`     | `#B5BDC9`     | All disabled button labels      |
| `color-action-disabled-border`     | `#667085`     | `#98A2B3`     | All disabled button borders     |

#### Button mapping matrix

Button variants consume the aliases exactly as follows:

| Intent    | Default background          | Default/text-on-fill          | Border                          | Hover background                  | Pressed background                 | Focus               | Disabled               | Loading                       |
| --------- | --------------------------- | ----------------------------- | ------------------------------- | --------------------------------- | ---------------------------------- | ------------------- | ---------------------- | ----------------------------- |
| Primary   | `color-action-primary-bg`   | `color-action-primary-text`   | `color-action-primary-border`   | `color-action-primary-hover-bg`   | `color-action-primary-active-bg`   | Shared focus tokens | Shared disabled tokens | Retain current variant colors |
| Secondary | `color-action-secondary-bg` | `color-action-secondary-text` | `color-action-secondary-border` | `color-action-secondary-hover-bg` | `color-action-secondary-active-bg` | Shared focus tokens | Shared disabled tokens | Retain current variant colors |
| Tertiary  | `color-action-tertiary-bg`  | `color-action-tertiary-text`  | `color-action-tertiary-border`  | `color-action-tertiary-hover-bg`  | `color-action-tertiary-active-bg`  | Shared focus tokens | Shared disabled tokens | Retain current variant colors |
| Danger    | `color-action-danger-bg`    | `color-action-danger-text`    | `color-action-danger-border`    | `color-action-danger-hover-bg`    | `color-action-danger-active-bg`    | Shared focus tokens | Shared disabled tokens | Retain current variant colors |

Every action variant uses `color-focus-ring`, `focus-ring-width`, and
`focus-ring-offset`; focused borders use `color-border-control-focus`. Hover and
pressed states retain the variant’s default text and border unless the matrix
above supplies a replacement background. Loading retains the current
default/hover/pressed colors, keeps the visible label, uses a `currentColor`
spinner, sets `aria-busy="true"`, and blocks repeat activation without changing
opacity. Disabled actions always use the three `color-action-disabled-*`
aliases, expose the native disabled state, and have no hover, pressed, or
loading state.

`opacity-disabled` applies only to optional decorative content inside a disabled
component; it must never reduce the label, focus indication, or meaningful
boundary contrast.

### Link tokens

| Token                | Light     | Dark      | Use                          |
| -------------------- | --------- | --------- | ---------------------------- |
| `color-link-default` | `#175CD3` | `#84CAFF` | Inline link                  |
| `color-link-hover`   | `#1849A9` | `#B2DDFF` | Hovered link                 |
| `color-link-active`  | `#194185` | `#D1E9FF` | Active link                  |
| `color-link-visited` | `#6941C6` | `#D6BBFB` | Visited public-content link  |
| `color-link-focus`   | `#175CD3` | `#84CAFF` | Focused link plus focus ring |

Visited styling is limited to public-content links. Application navigation and
action links do not expose browsing history through a visited color.

### Selection, navigation, and icons

| Token                          | Light     | Dark      | Use                   |
| ------------------------------ | --------- | --------- | --------------------- |
| `color-nav-hover-bg`           | `#F1F3F6` | `#20242C` | Navigation hover      |
| `color-nav-selected-bg`        | `#FFF1F1` | `#431417` | Selected destination  |
| `color-nav-selected-text`      | `#7F1115` | `#FFE0E0` | Selected label        |
| `color-nav-selected-indicator` | `#C40000` | `#F04444` | Current-page bar/icon |
| `color-icon-default`           | `#475467` | `#B5BDC9` | Functional icon       |
| `color-icon-muted`             | `#667085` | `#98A2B3` | Supporting icon       |
| `color-icon-brand`             | `#A30000` | `#FF8A8A` | Brand emphasis        |
| `color-icon-success`           | `#067647` | `#6CE9A6` | Success icon          |
| `color-icon-warning`           | `#B54708` | `#FEC84B` | Warning icon          |
| `color-icon-danger`            | `#B42318` | `#FDA29B` | Danger icon           |
| `color-icon-info`              | `#175CD3` | `#84CAFF` | Information icon      |

Selected/current navigation always combines background or indicator, label
weight, and `aria-current`; red alone never communicates selection or danger.

### Feedback tokens

| Intent  | Light background | Light text | Light border | Dark background | Dark text | Dark border |
| ------- | ---------------- | ---------- | ------------ | --------------- | --------- | ----------- |
| Neutral | `#F1F3F6`        | `#475467`  | `#CBD1D9`    | `#20242C`       | `#B5BDC9` | `#3A414D`   |
| Success | `#ECFDF3`        | `#067647`  | `#ABEFC6`    | `#102A1D`       | `#6CE9A6` | `#176B45`   |
| Warning | `#FFFAEB`        | `#B54708`  | `#FEDF89`    | `#2D230B`       | `#FEC84B` | `#7A4E0B`   |
| Danger  | `#FEF3F2`        | `#B42318`  | `#FECDCA`    | `#321314`       | `#FDA29B` | `#7A271A`   |
| Info    | `#EFF8FF`        | `#175CD3`  | `#B2DDFF`    | `#10243A`       | `#84CAFF` | `#175CD3`   |

Implement these as `color-{intent}-{bg|text|border}`. The `Intent token` column
in the status table maps exactly to these rows. Status text is always paired
with a label and, where compact, an icon or shape.

### Media and chart tokens

| Token                        | Light      | Dark      | Use                             |
| ---------------------------- | ---------- | --------- | ------------------------------- |
| `color-media-control-bg-rgb` | `16 24 40` | `0 0 0`   | Control-bar RGB channels        |
| `opacity-media-control-bg`   | `0.88`     | `0.88`    | Fixed control-bar opacity       |
| `color-media-control-text`   | `#FFFFFF`  | `#FFFFFF` | Control label/icon              |
| `color-media-track-unplayed` | `#101828`  | `#101828` | Unplayed timeline segment       |
| `color-media-track-played`   | `#E00000`  | `#F04444` | Played timeline segment         |
| `color-media-track-buffered` | `#FFFFFF`  | `#FFFFFF` | Buffered timeline segment       |
| `color-media-track-outline`  | `#98A2B3`  | `#98A2B3` | Track boundary against controls |
| `color-media-thumb-bg`       | `#FFFFFF`  | `#FFFFFF` | Explicit current-position thumb |
| `color-media-thumb-border`   | `#101828`  | `#101828` | Thumb boundary                  |
| `color-chart-series-1`       | `#175CD3`  | `#84CAFF` | Series 1                        |
| `color-chart-series-2`       | `#067647`  | `#6CE9A6` | Series 2                        |
| `color-chart-series-3`       | `#B54708`  | `#FEC84B` | Series 3                        |
| `color-chart-series-4`       | `#6941C6`  | `#D6BBFB` | Series 4                        |
| `color-chart-series-5`       | `#C40000`  | `#FF8A8A` | Series 5                        |
| `color-chart-grid`           | `#CBD1D9`  | `#3A414D` | Chart grid                      |

Initial progress visualization uses semantic HTML, CSS, or accessible SVG; no
chart dependency is approved. Series must also use labels, direct values,
patterns, or distinct marker shapes.

Media timelines use all of these mandatory non-color distinctions:

- unplayed is a 4 px solid track with a 1 px
  `color-media-track-outline` boundary;
- buffered is a 6 px dashed segment;
- played is an 8 px solid segment;
- an explicit 16 px circular thumb with `color-media-thumb-border` marks the
  current position;
- elapsed time, total duration, and seek value are available as visible text
  and programmatic slider values.

The three segment colors are never replaced by color-only differentiation.
Forced-colors mode uses system colors while preserving thickness, dash, thumb,
and textual distinctions.

### Central status-to-token mapping

Features must import one centralized status mapping rather than choosing colors.

| Domain     | State        | Intent token |
| ---------- | ------------ | ------------ |
| Course     | Draft        | neutral      |
| Course     | Review       | warning      |
| Course     | Approved     | info         |
| Course     | Published    | success      |
| Course     | Archived     | neutral      |
| Lesson     | Draft        | neutral      |
| Lesson     | Published    | success      |
| Lesson     | Locked       | warning      |
| Lesson     | Completed    | success      |
| Enrollment | Active       | success      |
| Enrollment | Suspended    | warning      |
| Enrollment | Cancelled    | neutral      |
| Enrollment | Completed    | success      |
| Media      | Processing   | info         |
| Media      | Ready        | success      |
| Media      | Failed       | danger       |
| Media      | Deleted      | neutral      |
| Progress   | Not started  | neutral      |
| Progress   | In progress  | info         |
| Progress   | Pending sync | warning      |
| Progress   | Completed    | success      |

Unknown API states render a neutral “Holat noma’lum” fallback and telemetry;
they must not be silently mapped to success.

### Calculated contrast matrix

Ratios below were calculated from the exact sRGB hex pairs shown. They are
normative regression fixtures, not estimates.

| Purpose                          | Foreground / background |     Ratio |
| -------------------------------- | ----------------------- | --------: |
| Primary text, light              | `#101828` / `#FFFFFF`   | `17.75:1` |
| Secondary text, light            | `#475467` / `#FFFFFF`   |  `7.69:1` |
| Muted/placeholder/control, light | `#667085` / `#FFFFFF`   |  `4.97:1` |
| Primary text, dark               | `#F7F8FA` / `#171A20`   | `16.40:1` |
| Secondary/control hover, dark    | `#B5BDC9` / `#171A20`   |  `9.20:1` |
| Muted/placeholder/control, dark  | `#98A2B3` / `#171A20`   |  `6.77:1` |
| Primary button text, light       | `#FFFFFF` / `#C40000`   |  `6.27:1` |
| Primary button text, dark        | `#101828` / `#F04444`   |  `4.75:1` |
| Danger button text, light        | `#FFFFFF` / `#B42318`   |  `6.57:1` |
| Danger button text, dark         | `#101828` / `#FDA29B`   |  `9.14:1` |
| Focus ring, light surface        | `#2563EB` / `#FFFFFF`   |  `5.17:1` |
| Focus ring, dark canvas          | `#60A5FA` / `#0E1014`   |  `7.49:1` |
| Link default, light              | `#175CD3` / `#FFFFFF`   |  `5.99:1` |
| Link hover, light                | `#1849A9` / `#FFFFFF`   |  `8.19:1` |
| Link active, light               | `#194185` / `#FFFFFF`   |  `9.83:1` |
| Link visited, light              | `#6941C6` / `#FFFFFF`   |  `6.62:1` |
| Link default, dark               | `#84CAFF` / `#171A20`   |  `9.85:1` |
| Link hover, dark                 | `#B2DDFF` / `#171A20`   | `12.18:1` |
| Link active, dark                | `#D1E9FF` / `#171A20`   | `13.95:1` |
| Link visited, dark               | `#D6BBFB` / `#171A20`   | `10.26:1` |
| Selected navigation, light       | `#7F1115` / `#FFF1F1`   |  `9.58:1` |
| Selected navigation, dark        | `#FFE0E0` / `#431417`   | `12.58:1` |
| Success text/background, light   | `#067647` / `#ECFDF3`   |  `5.40:1` |
| Success text/background, dark    | `#6CE9A6` / `#102A1D`   | `10.10:1` |
| Warning text/background, light   | `#B54708` / `#FFFAEB`   |  `5.20:1` |
| Warning text/background, dark    | `#FEC84B` / `#2D230B`   | `10.01:1` |
| Danger text/background, light    | `#B42318` / `#FEF3F2`   |  `6.05:1` |
| Danger text/background, dark     | `#FDA29B` / `#321314`   |  `8.73:1` |
| Info text/background, light      | `#175CD3` / `#EFF8FF`   |  `5.57:1` |
| Info text/background, dark       | `#84CAFF` / `#10243A`   |  `8.89:1` |
| Media played/buffered, light     | `#E00000` / `#FFFFFF`   |  `5.04:1` |
| Media played/unplayed, light     | `#E00000` / `#101828`   |  `3.52:1` |
| Media buffered/unplayed, light   | `#FFFFFF` / `#101828`   | `17.75:1` |
| Media played/buffered, dark      | `#F04444` / `#FFFFFF`   |  `3.74:1` |
| Media played/unplayed, dark      | `#F04444` / `#101828`   |  `4.75:1` |
| Media buffered/unplayed, dark    | `#FFFFFF` / `#101828`   | `17.75:1` |

Acceptance thresholds are `4.5:1` for normal text, `3:1` for large text, and
`3:1` for meaningful control boundaries and graphics against adjacent colors.
Every theme preset must pass automated contrast fixtures before approval.
Decorative borders are exempt only when no information or boundary depends on
them.

## Typography

Inter is the only v1 product font:

```text
Inter, "Segoe UI", Arial, sans-serif
```

Self-hosted or trusted CDN files must include Latin Extended and Cyrillic glyph
subsets. CI visual text fixtures cover Uzbek Latin, Turkish, English, and
Russian. Font weights are 400, 500, 600, and 700; essential content never uses
thin weights.

| Token        | Mobile size/line | Desktop size/line | Weight |
| ------------ | ---------------- | ----------------- | -----: |
| `display-lg` | 40/48            | 64/72             |    700 |
| `display-sm` | 34/42            | 48/56             |    700 |
| `heading-1`  | 30/38            | 40/48             |    700 |
| `heading-2`  | 26/34            | 32/40             |    700 |
| `heading-3`  | 22/30            | 24/32             |    600 |
| `heading-4`  | 18/26            | 20/28             |    600 |
| `body-lg`    | 18/28            | 18/28             |    400 |
| `body-md`    | 16/24            | 16/24             |    400 |
| `body-sm`    | 14/20            | 14/20             |    400 |
| `label-md`   | 14/20            | 14/20             |    500 |
| `label-sm`   | 12/16            | 12/16             |    600 |
| `caption`    | 12/16            | 12/16             |    400 |
| `button`     | 14/20            | 14/20             |    600 |

Display headings use `-0.02em`; body, labels, and buttons use normal spacing.
Translated or user-generated text must not be truncated only to preserve a
fixed card height.

## Spacing and sizing

The spacing system uses a 4 px base: `0`, `2`, `4`, `8`, `12`, `16`, `20`,
`24`, `32`, `40`, `48`, `64`, `80`, `96`, and `128` px. Named tokens follow
Tailwind-compatible keys `0`, `0.5`, `1`, `2`, `3`, `4`, `5`, `6`, `8`, `10`,
`12`, `16`, `20`, `24`, and `32`.

Minimum interactive size is 44 × 44 px. Compact visual controls may be smaller
only when their interactive hit area remains 44 × 44 px and does not overlap.

## Radius and elevation

| Token         | Value    | Use                 |
| ------------- | -------- | ------------------- |
| `radius-none` | `0`      | Tables and dividers |
| `radius-sm`   | `6px`    | Badges              |
| `radius-md`   | `8px`    | Inputs              |
| `radius-lg`   | `12px`   | Buttons and cards   |
| `radius-xl`   | `16px`   | Drawers             |
| `radius-2xl`  | `24px`   | Dialogs             |
| `radius-3xl`  | `32px`   | Marketing regions   |
| `radius-full` | `9999px` | Pills and avatars   |

| Token               | Value                              |
| ------------------- | ---------------------------------- |
| `shadow-subtle`     | `0 1px 2px rgb(16 24 40 / 0.05)`   |
| `shadow-card`       | `0 4px 12px rgb(16 24 40 / 0.07)`  |
| `shadow-dropdown`   | `0 12px 28px rgb(16 24 40 / 0.14)` |
| `shadow-modal`      | `0 24px 64px rgb(16 24 40 / 0.22)` |
| `shadow-navigation` | `0 8px 24px rgb(16 24 40 / 0.08)`  |

Elevation never replaces a meaningful control boundary.

## Focus and disabled state

| Token                     | Value              |
| ------------------------- | ------------------ |
| `focus-ring-width`        | `2px`              |
| `focus-ring-color`        | `color-focus-ring` |
| `focus-ring-offset`       | `2px`              |
| `focus-ring-offset-color` | `color-bg-surface` |
| `opacity-disabled`        | `0.56`             |

The ring remains visible in forced-colors mode through an outline fallback.
Disabled controls retain programmatic state, never rely on opacity alone, and
must not present hover or active styling.

## Breakpoints

The 320 px design is the unprefixed base layout. No `xs` or 375 px screen is
added: fluid spacing and wrapping handle widths from 320–639 px.

| Tailwind key |      Minimum width | Contract                                         |
| ------------ | -----------------: | ------------------------------------------------ |
| Base         | `320px` test floor | Unprefixed mobile layout                         |
| `sm`         |            `640px` | Large mobile/small window enhancement            |
| `md`         |            `768px` | Compact student rail begins                      |
| `lg`         |           `1024px` | Desktop sidebar and multi-column shell           |
| `xl`         |           `1280px` | Wide content/player enhancement                  |
| `2xl`        |           `1536px` | Extra-wide constraints, never font scaling alone |

These extend Tailwind 3.4 defaults; they do not replace the default screen map.

## Layout

| Token                         | Specification                    |
| ----------------------------- | -------------------------------- |
| Public text width             | `720px`                          |
| Standard content max          | `1200px`                         |
| Wide dashboard max            | `1440px`                         |
| Marketing max                 | `1280px`                         |
| Mobile gutter                 | `16px`                           |
| Tablet gutter                 | `24px`                           |
| Desktop gutter                | `32px`                           |
| Wide desktop gutter           | `48px`                           |
| Dashboard sidebar             | `256px` expanded; `72px` compact |
| Teacher builder rail          | `288px`                          |
| Course player curriculum rail | `320px`                          |
| Optional inspector            | `360px`                          |
| Public navigation             | `72px`                           |
| Dashboard top bar             | `64px`                           |
| Mobile top bar                | `56px`                           |
| Mobile bottom navigation      | `64px` plus safe area            |

The course player may show its optional third region only when the player
container, not viewport, is at least `1280px` wide and the central lesson region
remains at least `720px`. Otherwise the third region is a drawer.

## Layer and overlay stack

| Token         | Value | Content                              |
| ------------- | ----: | ------------------------------------ |
| `z-base`      |   `0` | Normal flow                          |
| `z-raised`    |  `10` | Raised card                          |
| `z-sticky`    |  `20` | Sticky page controls                 |
| `z-dropdown`  |  `30` | Menu/listbox                         |
| `z-drawer`    |  `40` | Drawer panel                         |
| `z-scrim`     |  `45` | Modal/drawer scrim                   |
| `z-modal`     |  `50` | Modal/dialog                         |
| `z-popover`   |  `60` | Popover above modal when owned by it |
| `z-toast`     |  `70` | Toast region                         |
| `z-tooltip`   |  `80` | Tooltip                              |
| `z-skip-link` |  `90` | Focused skip link                    |

Portals mount into one application overlay root. Nested overlays require an
explicit component contract; arbitrary z-index values are prohibited.

## Iconography

Lucide React is the recommended v1 family. Default stroke is 2 px and sizes are
16, 20, 24, and 32–48 px for decorative empty states. Functional icons have a
visible label or accessible name; decorative icons are hidden from assistive
technology. An `IconButton` always has an accessible name. A tooltip is
recommended when the meaning is not obvious, not universally required.
