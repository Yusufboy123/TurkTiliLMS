import { useParams } from 'react-router-dom';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import {
  ProgressError,
  ProgressPageHeader,
  ProgressRefreshStatus,
  ProgressSkeleton,
  ResumeLearningPanel,
} from '../components';
import { useResumeTarget } from '../hooks/use-progress-queries';

export default function ResumeLearningPage() {
  const { enrollmentId = '' } = useParams();
  const resume = useResumeTarget(enrollmentId);

  if (resume.isPending) return <ProgressSkeleton cards={1} />;
  if (resume.isError && !resume.data) {
    return <ProgressError error={resume.error} onRetry={() => void resume.refetch()} />;
  }

  return (
    <>
      <ProgressPageHeader title={progressMessages.resume.title} />
      <ProgressRefreshStatus
        error={resume.error}
        isError={resume.isError}
        isFetching={resume.isFetching}
      />
      <ResumeLearningPanel resume={resume.data ?? null} />
    </>
  );
}
