import { type HTMLAttributes } from 'react';
import { classNames } from '../../lib/class-names';

export interface SkeletonProps extends HTMLAttributes<HTMLDivElement> {
  label?: string;
  shape?: 'text' | 'rectangle' | 'circle';
}

const shapeClasses: Record<NonNullable<SkeletonProps['shape']>, string> = {
  text: 'h-4 rounded-sm',
  rectangle: 'min-h-12 rounded-md',
  circle: 'aspect-square rounded-full',
};

export function Skeleton({ className, label, shape = 'rectangle', ...props }: SkeletonProps) {
  return (
    <div
      {...props}
      aria-hidden={label ? undefined : true}
      aria-label={label}
      className={classNames(
        'skeleton overflow-hidden bg-skeleton-bg',
        shapeClasses[shape],
        className,
      )}
      role={label ? 'status' : undefined}
    />
  );
}
