import { useId, useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react';
import { classNames } from '../../lib/class-names';
import { FocusScope } from './FocusScope';
import { Portal } from './Portal';
import { useModalIsolation } from './useModalIsolation';
import { useScrollLock } from './useScrollLock';

export type OverlaySurfaceKind = 'modal' | 'drawer-start' | 'drawer-end' | 'drawer-bottom';

export interface OverlaySurfaceProps {
  children: ReactNode;
  className?: string;
  description?: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  isOpen: boolean;
  kind: OverlaySurfaceKind;
  onClose: () => void;
  title: ReactNode;
}

const surfaceClasses: Record<OverlaySurfaceKind, string> = {
  modal:
    'h-full w-full rounded-none shadow-modal sm:m-auto sm:h-auto sm:max-h-[calc(100dvh-4rem)] sm:w-[calc(100%-2rem)] sm:max-w-reading sm:rounded-2xl',
  'drawer-start': 'mr-auto h-full w-[calc(100%-2rem)] max-w-drawer rounded-e-xl shadow-modal',
  'drawer-end': 'ml-auto h-full w-[calc(100%-2rem)] max-w-drawer rounded-s-xl shadow-modal',
  'drawer-bottom': 'mt-auto max-h-[calc(100dvh-2rem)] w-full rounded-t-xl shadow-modal',
};

export function OverlaySurface({
  children,
  className,
  description,
  initialFocusRef,
  isOpen,
  kind,
  onClose,
  title,
}: OverlaySurfaceProps) {
  const generatedId = useId();
  const titleId = `overlay-title-${generatedId}`;
  const descriptionId = description ? `overlay-description-${generatedId}` : undefined;
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const wasOpenRef = useRef(false);

  useLayoutEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      returnFocusRef.current =
        document.activeElement instanceof HTMLElement ? document.activeElement : null;
    }
    wasOpenRef.current = isOpen;
  }, [isOpen]);

  useScrollLock(isOpen);
  useModalIsolation(isOpen);

  if (!isOpen) {
    return null;
  }

  const isDrawer = kind !== 'modal';

  return (
    <Portal>
      <div
        className={classNames('fixed inset-0 flex bg-scrim', 'z-scrim')}
        data-overlay-kind={kind}
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) {
            onClose();
          }
        }}
      >
        <FocusScope
          active
          aria-describedby={descriptionId}
          aria-labelledby={titleId}
          aria-modal="true"
          className={classNames(
            'overflow-y-auto border border-border-decorative bg-raised p-6 text-text-primary outline-none transition-transform duration-slow motion-reduce:transition-none',
            isDrawer ? 'relative z-drawer' : 'relative z-modal',
            surfaceClasses[kind],
            className,
          )}
          initialFocusRef={initialFocusRef}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault();
              event.stopPropagation();
              onClose();
            }
          }}
          returnFocusRef={returnFocusRef}
          role="dialog"
        >
          <h2 className="type-heading-3" id={titleId}>
            {title}
          </h2>
          {description ? (
            <div className="mt-2 text-body-md text-text-secondary" id={descriptionId}>
              {description}
            </div>
          ) : null}
          <div className="mt-6">{children}</div>
        </FocusScope>
      </div>
    </Portal>
  );
}
