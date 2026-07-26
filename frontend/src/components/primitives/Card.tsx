import { forwardRef, type HTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  elevation?: 'none' | 'subtle' | 'card';
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const elevationClasses: Record<NonNullable<CardProps['elevation']>, string> = {
  none: '',
  subtle: 'shadow-subtle',
  card: 'shadow-card',
};

const paddingClasses: Record<NonNullable<CardProps['padding']>, string> = {
  none: '',
  sm: 'p-3',
  md: 'p-4',
  lg: 'p-6',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, elevation = 'card', padding = 'md', ...props },
  ref,
) {
  return (
    <div
      {...props}
      className={classNames(
        'rounded-lg border border-border-decorative bg-surface text-text-primary',
        elevationClasses[elevation],
        paddingClasses[padding],
        className,
      )}
      ref={ref}
    />
  );
});
