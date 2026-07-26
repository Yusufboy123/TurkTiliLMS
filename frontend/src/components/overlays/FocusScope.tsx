import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
  type HTMLAttributes,
  type KeyboardEvent,
  type RefObject,
} from 'react';

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>(focusableSelector)).filter(
    (element) => !element.hidden && element.getAttribute('aria-hidden') !== 'true',
  );
}

export interface FocusScopeProps extends HTMLAttributes<HTMLDivElement> {
  active?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  returnFocusRef?: RefObject<HTMLElement | null>;
  restoreFocus?: boolean;
}

export const FocusScope = forwardRef<HTMLDivElement, FocusScopeProps>(function FocusScope(
  {
    active = true,
    children,
    initialFocusRef,
    onKeyDown,
    returnFocusRef,
    restoreFocus = true,
    tabIndex = -1,
    ...props
  },
  forwardedRef,
) {
  const scopeRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useImperativeHandle(forwardedRef, () => scopeRef.current as HTMLDivElement, []);

  useEffect(() => {
    if (!active) {
      return;
    }

    previousFocusRef.current =
      returnFocusRef?.current ??
      (document.activeElement instanceof HTMLElement ? document.activeElement : null);

    const frame = window.requestAnimationFrame(() => {
      const scope = scopeRef.current;
      const target =
        initialFocusRef?.current ?? (scope ? getFocusableElements(scope)[0] : null) ?? scope;
      target?.focus();
    });

    return () => {
      window.cancelAnimationFrame(frame);

      if (!restoreFocus) {
        return;
      }

      // Restoration runs after modal isolation cleanup so an invoking control
      // is never focused while its application root is still inert.
      queueMicrotask(() => {
        const previousFocus = previousFocusRef.current;
        if (previousFocus?.isConnected) {
          previousFocus.focus();
          return;
        }

        const fallback = document.querySelector<HTMLElement>(
          '[data-focus-fallback], main[tabindex="-1"], h1[tabindex="-1"]',
        );
        fallback?.focus();
      });
    };
  }, [active, initialFocusRef, restoreFocus, returnFocusRef]);

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);

    if (!active || event.defaultPrevented || event.key !== 'Tab' || !scopeRef.current) {
      return;
    }

    const focusable = getFocusableElements(scopeRef.current);
    if (focusable.length === 0) {
      event.preventDefault();
      scopeRef.current.focus();
      return;
    }

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return (
    <div {...props} onKeyDown={handleKeyDown} ref={scopeRef} tabIndex={tabIndex}>
      {children}
    </div>
  );
});
