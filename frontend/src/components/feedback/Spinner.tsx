import { useEffect, useState } from 'react';
import { SpinnerGlyph, type SpinnerGlyphSize } from '../primitives/SpinnerGlyph';

export type SpinnerSize = SpinnerGlyphSize;

export interface SpinnerProps {
  className?: string;
  decorative?: boolean;
  delayMs?: number;
  label?: string;
  size?: SpinnerSize;
}

export function Spinner({
  className,
  decorative = false,
  delayMs = 400,
  label = 'Yuklanmoqda',
  size = 'md',
}: SpinnerProps) {
  const [isVisible, setIsVisible] = useState(delayMs === 0);

  useEffect(() => {
    if (delayMs === 0) {
      setIsVisible(true);
      return;
    }

    setIsVisible(false);
    const timer = window.setTimeout(() => setIsVisible(true), delayMs);
    return () => window.clearTimeout(timer);
  }, [delayMs]);

  if (!isVisible) {
    return null;
  }

  if (decorative) {
    return <SpinnerGlyph className={className} size={size} />;
  }

  return (
    <span aria-label={label} className="inline-flex" role="status">
      <SpinnerGlyph className={className} size={size} />
    </span>
  );
}
