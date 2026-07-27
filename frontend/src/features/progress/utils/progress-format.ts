import { progressMessages } from '../../../locales/uz-Latn/progress';
import type {
  BlockProgressState,
  CourseProgressState,
  EnrollmentStatus,
  LessonProgressState,
  ProgressUnavailableReason,
} from '../types/progress.types';

export type DisplayStatus =
  BlockProgressState | CourseProgressState | EnrollmentStatus | LessonProgressState;

export function formatProgressDate(value: string | null): string {
  if (!value) return '—';
  return new Intl.DateTimeFormat('uz-Latn-UZ', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function statusLabel(status: DisplayStatus): string {
  return progressMessages.status[status];
}

export function unavailableReasonLabel(reason: ProgressUnavailableReason): string | null {
  return reason ? progressMessages.unavailable[reason] : null;
}

export function boundedPercentage(value: number): number {
  return Math.min(100, Math.max(0, value));
}
