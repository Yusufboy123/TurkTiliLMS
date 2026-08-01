import { boundedPercentage } from '../utils/progress-format';

interface ProgressBarProps {
  ariaLabel?: string;
  label: string;
  value: number;
}

export function ProgressBar({ ariaLabel, label, value }: ProgressBarProps) {
  const percentage = boundedPercentage(value);

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-4 text-label-sm">
        <span className="text-text-secondary">{label}</span>
        <span className="text-text-primary">{percentage}%</span>
      </div>
      <progress
        aria-label={ariaLabel ?? label}
        className="h-2 w-full overflow-hidden rounded-full accent-action-primary-bg"
        max={100}
        value={percentage}
      >
        {percentage}%
      </progress>
    </div>
  );
}
