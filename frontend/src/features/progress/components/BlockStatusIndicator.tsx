import { Badge, type BadgeIntent } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { BlockProgress } from '../types/progress.types';
import { statusLabel } from '../utils/progress-format';

const statusIntent: Record<BlockProgress['status'], BadgeIntent> = {
  NOT_STARTED: 'neutral',
  INCOMPLETE: 'info',
  COMPLETED: 'success',
};

export function BlockStatusIndicator({ block }: { block: BlockProgress }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge intent={statusIntent[block.status]}>{statusLabel(block.status)}</Badge>
      <span className="text-caption text-text-muted">
        {block.isRequired ? progressMessages.common.required : progressMessages.common.optional}
      </span>
    </div>
  );
}
