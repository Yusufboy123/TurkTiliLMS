# Design and UI Release Quality Checklist

**Status:** Review candidate

## Documentation governance

- [ ] Higher-precedence documents are satisfied.
- [ ] New architectural exceptions have an ADR, owner, evidence, and expiry.
- [ ] Draft or partial sections do not claim implementation approval.
- [ ] Page/component inventory status matches the actual contract.
- [ ] Terminology matches `Jarayonim`, `Kurs jarayoni`, `O‘zlashtirish`, and
      technical `Progress Tracking`.
- [ ] Internal Markdown links and formatting pass.

## Visual tokens

- [ ] Components use semantic tokens; no unapproved raw colors exist.
- [ ] Decorative borders are not used as meaningful control boundaries.
- [ ] Automated contrast fixtures calculate every critical light/dark pair in
      Foundations and fail below 4.5:1 normal text or 3:1 large text,
      meaningful graphics, control boundaries, and focus indicators.
- [ ] Every owner-selectable theme preset passes the same fixtures.
- [ ] Focus ring is at least 2 px and at least 3:1.
- [ ] Fixed-alpha scrim and media-control utilities use their RGB plus fixed
      opacity variables; Tailwind opacity modifiers cannot alter them.
- [ ] Primary, secondary, tertiary, and danger actions use the complete
      default/hover/pressed/focus/disabled/loading mapping without raw colors.
- [ ] Status uses centralized token mapping plus text/icon/shape.
- [ ] Dark mode, forced colors, disabled, skeleton, scrim, links, media, and
      charts use documented tokens.
- [ ] Media fixtures verify played/buffered, played/unplayed, and
      buffered/unplayed contrast in both themes and preserve
      8 px solid/6 px dashed/4 px outlined geometry, thumb, and value text.

## Component architecture

- [ ] One `Button` primitive owns primary/secondary/tertiary/danger variants.
- [ ] `Input` + `FormField` own general fields; specialized fields add behavior.
- [ ] `DataTable` and `ResponsiveDataList` are the only shared data patterns.
- [ ] `MobileFloatingAction` naming is consistent.
- [ ] `IconButton` has an accessible name; tooltip is used when meaning is not
      obvious.
- [ ] Overlay components compose `Portal` and `FocusScope`.
- [ ] `ContentBlockRenderer` remains a feature registry/orchestrator.
- [ ] Primitive/layout/feedback/domain/feature/page dependency direction passes.

## Responsive behavior

- [ ] Unprefixed design passes at 320 px.
- [ ] Student nav is bottom nav below 768 px, 72 px rail at 768–1023 px, and
      sidebar at 1024 px or above.
- [ ] Course Player has a full-width completion row and separate previous/next
      row at 320 px; every target is at least 44 × 44 px.
- [ ] Course Player does not mount global mobile bottom navigation; its
      safe-area-aware sticky actions and persistent authorization-safe Back exit
      work at 320 px and with long translations.
- [ ] Optional third player region follows container width and preserves a
      720 px lesson region.
- [ ] No two-dimensional page scrolling exists at 320 px/400% zoom except an
      approved complex matrix with an accessible alternative.
- [ ] Uzbek, Turkish, English, and Russian long-text fixtures pass.
- [ ] Sticky regions, safe areas, virtual keyboard, and focused controls pass.

## Accessibility release gate

- [ ] Automated scans report zero critical or serious violations.
- [ ] Critical keyboard journeys complete without traps.
- [ ] No default global single-character shortcut fires.
- [ ] Player shortcuts never fire in input, editor, captions/transcript, search,
      menu, or dialog contexts.
- [ ] Modal/drawer initial focus and focus restoration pass, including removed
      triggers.
- [ ] Every field has a visible label and associated description/error.
- [ ] Failed forms focus a linked `ErrorSummary`.
- [ ] Async loading/save/upload/completion/offline outcomes are announced.
- [ ] No status, selection, chart, or progress meaning depends on color alone.
- [ ] Captions include all dialogue/meaningful sounds and pass timing review.
- [ ] Transcripts provide equivalent information and speaker identification.
- [ ] Touch targets pass the 44 × 44 px rule and do not overlap.
- [ ] Reduced-motion mode removes nonessential motion and skeleton shimmer.
- [ ] Chrome+NVDA, Firefox+NVDA, Edge+Narrator, Safari+VoiceOver (macOS/iOS),
      and Chrome+TalkBack journeys are recorded.

## State and recovery completeness

- [ ] Initial loading is distinct from background refresh.
- [ ] Empty, no results, forbidden, offline, stale, conflict, and unexpected
      failure states are deliberate.
- [ ] Recoverable failure preserves safe form input and file queue metadata.
- [ ] Retry is in context; destructive actions never retry automatically.
- [ ] Server/permission errors do not expose internals.
- [ ] Unknown API enums render a safe labeled fallback and telemetry.
- [ ] Progress pending state does not recalculate aggregate percentages.

## Security and admin safety

- [ ] Route UI and direct feature calls rely on API-authoritative authorization.
- [ ] Protected admin actions invoke step-up authentication.
- [ ] Step-up handles cancel, timeout, failed verification, session expiry,
      context change, safe return, accessible error, and audit.
- [ ] Sensitive permission details, secrets, tokens, stack traces, and filesystem
      paths never render.
- [ ] Destructive actions name impact and require confirmation.
- [ ] Large personal-data exports require permission, step-up, scope review, and
      audit.
- [ ] Admin theme settings accept only logo, favicon, theme mode, and approved
      contrast-tested presets; arbitrary CSS/JavaScript is impossible.

## Performance release gate

- [ ] LCP ≤ 2.5 s at p75 on defined key routes.
- [ ] INP ≤ 200 ms at p75.
- [ ] CLS ≤ 0.1 at p75.
- [ ] RUM evidence uses a rolling 28-day route/device segment with at least 200
      eligible visits, or the documented five-run cold-cache lab fallback.
- [ ] Public initial JS ≤ 180 KB gzip.
- [ ] Authenticated shell + route initial JS ≤ 250 KB gzip.
- [ ] Course Player shell ≤ 280 KB gzip excluding streamed media.
- [ ] Individual lazy route/component chunks ≤ 100 KB gzip or have an approved
      time-bounded ADR.
- [ ] Images have intrinsic dimensions, `srcset`, `sizes`, and modern formats.
- [ ] Only one above-fold LCP image is eager/high-priority; below-fold images
      and heavy viewers are lazy.
- [ ] Skeletons mirror predictable initial geometry and do not reappear for
      background refresh.

The TTFB ≤ 800 ms p75 and public CSS ≤ 50 KB gzip targets are aspirational;
misses are tracked but do not alone block release.

## Module #8 gate

- [ ] Approved OpenAPI schemas and exact response DTOs exist.
- [ ] Nullability, pagination, state enums, and stable error codes are complete.
- [ ] Concurrency and idempotency contracts are complete.
- [ ] Suspended/cancelled read behavior is explicit.
- [ ] Typed DTO-to-view-model mapping is reviewed.
- [ ] Initial loading, background refresh, and mutation pending are distinct.
- [ ] No streak, achievement, or playback-position behavior leaked into v1.

## Delivery evidence

- [ ] TypeScript, lint, unit, integration, contract, and production build checks
      pass when implementation exists.
- [ ] Visual regression covers light/dark, long text, and required viewports.
- [ ] Bundle report and real-user Web Vitals are attached.
- [ ] Accessibility defects name severity, owner, and retest.
- [ ] Owner-manageable user-facing modules include admin UI, permission,
      validation, audit, and tests.
