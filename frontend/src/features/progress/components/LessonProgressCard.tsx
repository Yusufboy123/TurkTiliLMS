import { Link } from 'react-router-dom';
import { Card } from '../../../components';
import { progressMessages } from '../../../locales/uz-Latn/progress';
import type { LessonProgress } from '../types/progress.types';
import { progressPaths } from '../progress.routes';
import { LessonStatusBadge } from './LessonStatusBadge';
import { ProgressBar } from './ProgressBar';

interface LessonProgressCardProps {
  enrollmentId: string;
  lesson: LessonProgress;
}

export function LessonProgressCard({ enrollmentId, lesson }: LessonProgressCardProps) {
  const mastery = lesson.mastery;
  const isLocked = Boolean(mastery?.locked);
  const topicPassed = mastery?.previousTopicPercentage !== null && (mastery?.previousTopicPercentage ?? 0) >= (mastery?.previousPassingPercentage ?? 75);
  const vocabRequired = Boolean(mastery?.previousVocabularyRequired);
  const vocabPassed = mastery?.previousVocabularyPercentage !== null && (mastery?.previousVocabularyPercentage ?? 0) >= 75;

  const targetPath = isLocked && topicPassed && vocabRequired && !vocabPassed && mastery?.previousLessonId
    ? `${progressPaths.lesson(enrollmentId, mastery.previousLessonId)}#vocabulary`
    : isLocked && mastery?.previousLessonId
      ? progressPaths.lesson(enrollmentId, mastery.previousLessonId)
      : progressPaths.lesson(enrollmentId, lesson.id);

  return (
    <Card elevation="none">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h4 className="type-heading-4">{lesson.title}</h4>
        <LessonStatusBadge status={lesson.status} />
      </div>
      <div className="mt-4">
        <ProgressBar label={progressMessages.progress.lessonProgress} value={lesson.percentage} />
      </div>
      <p className="mt-3 text-caption text-text-muted">
        {lesson.completedEligibleBlocks}/{lesson.totalEligibleBlocks}{' '}
        {progressMessages.progress.blocks}
      </p>

      {isLocked && mastery && (
        <div className="mt-3 rounded-md border border-warning-border bg-warning-bg/40 p-2.5 text-caption text-warning-text">
          <p className="font-semibold">🔒 Qulflangan — talablar:</p>
          <div className="mt-1 space-y-0.5 font-medium">
            <p>
              {topicPassed
                ? `✓ Mavzu testi: ${mastery.previousTopicPercentage}%`
                : mastery.previousTopicPercentage === null
                  ? '✕ Mavzu testi: hali topshirilmagan'
                  : `✕ Mavzu testi: ${mastery.previousTopicPercentage}% — kamida ${mastery.previousPassingPercentage ?? 75}% kerak`}
            </p>
            {vocabRequired ? (
              <p>
                {vocabPassed
                  ? `✓ Lug‘at testi: ${mastery.previousVocabularyPercentage}%`
                  : mastery.previousVocabularyPercentage === null
                    ? '✕ Lug‘at testi: hali topshirilmagan'
                    : `✕ Lug‘at testi: ${mastery.previousVocabularyPercentage}% — kamida 75% kerak`}
              </p>
            ) : null}
          </div>
        </div>
      )}

      <Link
        className="mt-4 inline-flex min-h-target items-center text-button"
        to={targetPath}
      >
        {isLocked && topicPassed && vocabRequired && !vocabPassed
          ? 'Lug‘at o‘rganish va testga o‘tish →'
          : isLocked
            ? 'Oldingi darsga o‘tish →'
            : progressMessages.common.open}
      </Link>
    </Card>
  );
}
