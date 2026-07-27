import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { ResumeLearning } from '../types/progress.types';
import { ProgressEmptyState } from './ProgressEmptyState';
import { ResumeLearningCard } from './ResumeLearningCard';

export function ResumeLearningPanel({ resume }: { resume: ResumeLearning | null }) {
  return resume ? (
    <ResumeLearningCard resume={resume} />
  ) : (
    <ProgressEmptyState
      body={progressMessages.resume.unavailableBody}
      title={progressMessages.resume.unavailableTitle}
    />
  );
}
