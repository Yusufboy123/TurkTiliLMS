import { Link } from 'react-router-dom';
import { Button, Card } from '../../../components';
import { useStudentLessonQuiz } from '../hooks/use-student-player';
import type { StudentQuizAttempt } from '../types/student-player.types';

interface ResultModeViewProps {
  enrollmentId: string;
  lessonId: string;
  enabled: boolean;
  passingPercentage: number;
  nextLessonPath: string | null;
  onGoToLearn: () => void;
  onGoToPractice: () => void;
  onRetakeTest: () => void;
}

export function ResultModeView({
  enrollmentId,
  lessonId,
  enabled,
  passingPercentage,
  nextLessonPath,
  onGoToLearn,
  onGoToPractice,
  onRetakeTest,
}: ResultModeViewProps) {
  const { latestResult } = useStudentLessonQuiz(enrollmentId, lessonId, enabled);
  const result: StudentQuizAttempt | null | undefined = latestResult.data;

  if (latestResult.isPending) {
    return (
      <Card padding="lg" className="my-8 text-center">
        <p className="text-body-md text-text-secondary" role="status">Test natijalari hisoblanmoqda...</p>
      </Card>
    );
  }

  if (!result) {
    return (
      <Card padding="lg" className="my-8 text-center">
        <p className="text-body-md text-text-secondary">Natija topilmadi. Avval testni topshiring.</p>
        <Button className="mt-4" onClick={onGoToPractice}>Amaliyotga o‘tish</Button>
      </Card>
    );
  }

  const isPassed = result.percentage >= passingPercentage;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Result Overview Card */}
      <Card
        elevation="card"
        padding="lg"
        className={`border-t-4 text-center ${
          isPassed ? 'border-t-success-text bg-success-bg/10' : 'border-t-warning-border bg-warning-bg/10'
        }`}
      >
        <div className="mx-auto my-4 flex h-24 w-24 items-center justify-center rounded-full bg-surface shadow-card border border-border-decorative">
          <span className={`text-3xl font-extrabold ${isPassed ? 'text-success-text' : 'text-warning-text'}`}>
            {result.percentage}%
          </span>
        </div>

        <h2 className="type-heading-2 text-text-primary mb-1">
          {isPassed ? '🎉 Dars Muvaffaqiyatli O‘zlashtirildi!' : '⚠️ Talab Qilingan Ball To‘planmadi'}
        </h2>

        <p className="text-body-md text-text-secondary mb-4">
          {isPassed
            ? 'Tabriklaymiz! Siz 1-dars bo‘yicha kerakli mastery darajasiga erishdingiz.'
            : `O‘tish uchun kamida ${passingPercentage}% kerak. Qoidalarni takrorlab, yana bir bor urinib ko‘ring.`}
        </p>

        {/* Detailed Stats */}
        <div className="mx-auto my-6 grid max-w-md grid-cols-3 gap-3 rounded-lg bg-surface p-4 border border-border-decorative shadow-subtle text-center">
          <div>
            <p className="text-caption text-text-muted">Jami ball</p>
            <p className="text-heading-3 font-bold text-text-primary">{result.score} / {result.maxScore}</p>
          </div>
          <div>
            <p className="text-caption text-text-muted">To‘g‘ri</p>
            <p className="text-heading-3 font-bold text-success-text">{result.correctCount}</p>
          </div>
          <div>
            <p className="text-caption text-text-muted">Noto‘g‘ri</p>
            <p className="text-heading-3 font-bold text-danger-text">{result.incorrectCount}</p>
          </div>
        </div>

        {/* Pass / Fail Banner */}
        <div
          className={`mx-auto max-w-md rounded-lg p-3 text-body-sm font-semibold mb-6 ${
            isPassed
              ? 'bg-success-bg border border-success-border text-success-text'
              : 'bg-warning-bg border border-warning-border text-warning-text'
          }`}
        >
          {isPassed
            ? `✓ Mastery talabi: ${passingPercentage}% — Erishildi!`
            : `⚠️ Mastery talabi: ${passingPercentage}% — Sizda: ${result.percentage}%`}
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap justify-center gap-3 pt-2">
          {isPassed ? (
            <>
              {nextLessonPath ? (
                <Link
                  to={nextLessonPath}
                  className="inline-flex min-h-target items-center justify-center rounded-md bg-action-primary-bg px-6 py-3 text-button font-bold text-white shadow-card hover:bg-action-primary-hover no-underline visited:text-white"
                >
                  Keyingi darsga o‘tish ▶
                </Link>
              ) : null}
              <Button intent="secondary" onClick={onGoToLearn}>
                Nazariyani ko‘rish
              </Button>
              <Button intent="secondary" onClick={onGoToPractice}>
                Mashqlarni qayta ko‘rish
              </Button>
            </>
          ) : (
            <>
              <Button onClick={onGoToPractice}>
                Mashqlarni qayta ishlash
              </Button>
              <Button intent="secondary" onClick={onGoToLearn}>
                Nazariyani o‘rganish
              </Button>
              <Button intent="secondary" onClick={onRetakeTest}>
                Testni qayta topshirish
              </Button>
            </>
          )}
        </div>
      </Card>
    </div>
  );
}
