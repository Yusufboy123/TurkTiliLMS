import { Badge, type BadgeIntent } from '../../../components';
import type { LessonProgressState } from '../types/progress.types';
import { statusLabel } from '../utils/progress-format';

const statusIntent: Record<LessonProgressState, BadgeIntent> = {
  NOT_STARTED: 'neutral',
  IN_PROGRESS: 'info',
  READY_TO_COMPLETE: 'warning',
  COMPLETED: 'success',
};

export function LessonStatusBadge({ status }: { status: LessonProgressState }) {
  return <Badge intent={statusIntent[status]}>{statusLabel(status)}</Badge>;
}
