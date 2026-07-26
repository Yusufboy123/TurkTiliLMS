import {
  cloneElement,
  isValidElement,
  useId,
  useState,
  type ReactElement,
  type ReactNode,
} from 'react';
import { classNames } from '../../lib/class-names';

export interface TooltipProps {
  children: ReactElement<{ 'aria-describedby'?: string }>;
  className?: string;
  content: ReactNode;
  placement?: 'top' | 'bottom';
}

const placementClasses = {
  top: 'bottom-full left-1/2 mb-2 -translate-x-1/2',
  bottom: 'left-1/2 top-full mt-2 -translate-x-1/2',
};

export function Tooltip({ children, className, content, placement = 'top' }: TooltipProps) {
  const generatedId = useId();
  const tooltipId = `tooltip-${generatedId}`;
  const [isOpen, setIsOpen] = useState(false);

  if (!isValidElement(children)) {
    throw new Error('Tooltip bitta React elementini qabul qilishi kerak.');
  }

  const describedBy = [children.props['aria-describedby'], tooltipId].filter(Boolean).join(' ');

  return (
    <span
      className="relative inline-flex"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setIsOpen(false);
        }
      }}
      onFocus={() => setIsOpen(true)}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setIsOpen(false);
        }
      }}
      onMouseEnter={() => setIsOpen(true)}
      onMouseLeave={() => setIsOpen(false)}
    >
      {cloneElement(children, { 'aria-describedby': describedBy })}
      <span
        aria-hidden={!isOpen}
        className={classNames(
          'pointer-events-none absolute z-tooltip w-max max-w-tooltip rounded-sm bg-raised px-3 py-2 text-body-sm text-text-primary shadow-dropdown transition-opacity duration-fast motion-reduce:transition-none',
          isOpen ? 'opacity-100' : 'invisible opacity-0',
          placementClasses[placement],
          className,
        )}
        id={tooltipId}
        role="tooltip"
      >
        {content}
      </span>
    </span>
  );
}
