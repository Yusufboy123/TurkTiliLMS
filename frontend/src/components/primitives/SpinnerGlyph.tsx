import { classNames } from '../../lib/class-names';

export type SpinnerGlyphSize = 'sm' | 'md' | 'lg';

export interface SpinnerGlyphProps {
  className?: string;
  size?: SpinnerGlyphSize;
}

const sizeClasses: Record<SpinnerGlyphSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-5 w-5 border-2',
  lg: 'h-8 w-8 border-2',
};

export function SpinnerGlyph({ className, size = 'md' }: SpinnerGlyphProps) {
  return (
    <span
      aria-hidden="true"
      className={classNames(
        'spinner inline-block shrink-0 rounded-full border-current border-r-transparent',
        sizeClasses[size],
        className,
      )}
    />
  );
}
