import { boundedPercentage } from '../utils/progress-format';

interface ProgressRingProps {
  label: string;
  size?: 'sm' | 'md';
  value: number;
}

export function ProgressRing({ label, size = 'md', value }: ProgressRingProps) {
  const percentage = boundedPercentage(value);
  const dimensions = size === 'sm' ? 'h-20 w-20' : 'h-28 w-28';

  return (
    <div
      aria-label={`${label}: ${percentage}%`}
      aria-valuemax={100}
      aria-valuemin={0}
      aria-valuenow={percentage}
      className={`grid shrink-0 place-items-center rounded-full ${dimensions}`}
      role="progressbar"
      style={{
        background: `conic-gradient(rgb(var(--color-icon-brand)) ${percentage}%, rgb(var(--color-bg-subtle)) 0)`,
      }}
    >
      <span className="grid h-4/5 w-4/5 place-items-center rounded-full bg-surface text-heading-4 font-semibold text-text-primary">
        {percentage}%
      </span>
    </div>
  );
}
