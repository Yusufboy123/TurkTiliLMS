import axios from 'axios';
import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../../../components';
import { ProgressError, ProgressSkeleton } from '../../progress/components';
import { ProgressBar } from '../../progress/components';
import { useEnrollmentProgress } from '../../progress/hooks/use-progress-queries';
import { progressPaths } from '../../progress/progress.routes';
import { studentCoursesMessages as messages } from '../student-courses.messages';
import { studentCoursesPaths } from '../student-courses.routes';
import { useStudentCourses, latestEnrollmentsByCourse } from '../hooks/use-student-courses';
import type { EnrollmentStatus, CatalogCourse, StudentEnrollment } from '../types/student-courses.types';

const statusIntent: Record<EnrollmentStatus, 'success' | 'warning' | 'danger'> = {
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  CANCELLED: 'danger',
  COMPLETED: 'success',
};

function enrollmentErrorMessage(error: unknown): string {
  if (!axios.isAxiosError<{ code?: string }>(error)) return messages.enrollmentError;
  if (!error.response) return messages.networkError;
  switch (error.response.data?.code) {
    case 'ALREADY_ENROLLED':
      return 'Siz bu kursga allaqachon yozilgansiz.';
    case 'COURSE_NOT_ENROLLABLE':
      return 'Bu kursga hozir yozilish mumkin emas.';
    case 'ENROLLMENT_SUSPENDED':
      return messages.suspended;
    case 'ENROLLMENT_COMPLETED':
      return messages.completed;
    default:
      return messages.enrollmentError;
  }
}

function date(value: string) {
  return new Intl.DateTimeFormat('uz-Latn-UZ', { dateStyle: 'medium' }).format(new Date(value));
}

function StudentCatalogCourseCard({ course, currentEnrollment, isPending, onEnroll, enrollmentError }: { course: CatalogCourse; currentEnrollment: StudentEnrollment | undefined; isPending: boolean; onEnroll: () => void; enrollmentError?: string }) {
  const canReadProgress = currentEnrollment?.status === 'ACTIVE' || currentEnrollment?.status === 'COMPLETED';
  const progress = useEnrollmentProgress(canReadProgress ? currentEnrollment?.id ?? '' : '');
  const isActive = currentEnrollment?.status === 'ACTIVE';
  const isCompleted = currentEnrollment?.status === 'COMPLETED';
  const isSuspended = currentEnrollment?.status === 'SUSPENDED';
  const canStart = Boolean(currentEnrollment && (isActive || isCompleted));
  const accessExpired = currentEnrollment?.accessActive === false;
  const activeLabel = progress.data && progress.data.percentage > 0 ? messages.continue : messages.start;
  return <Card className="flex h-full flex-col" padding="lg"><div className="flex flex-wrap items-start justify-between gap-3"><h2 className="type-heading-3 break-words">{course.title}</h2>{currentEnrollment ? <Badge intent={statusIntent[currentEnrollment.status]}>{messages.status[currentEnrollment.status]}</Badge> : <Badge intent="neutral">{messages.notEnrolled}</Badge>}</div><p className="mt-3 text-body-sm text-text-secondary">{messages.level}: {course.level}</p><p className="mt-3 min-h-12 text-body-md text-text-secondary">{course.shortDescription ?? messages.noDescription}</p>{canReadProgress && progress.data ? <div className="mt-4"><ProgressBar label="Kurs jarayoni" value={progress.data.percentage} /></div> : null}{course.estimatedDurationMinutes ? <p className="mt-3 text-caption text-text-muted">{messages.duration}: {course.estimatedDurationMinutes} {messages.minutes}</p> : null}{currentEnrollment?.accessExpiresAt ? <p className="mt-3 text-caption text-text-muted">Kirish muddati: {accessExpired ? 'tugagan' : `${currentEnrollment.daysRemaining} kun qoldi`} ({date(currentEnrollment.accessExpiresAt)})</p> : null}<div className="mt-auto pt-6">{canStart && currentEnrollment && !accessExpired ? <Link className="inline-flex min-h-target w-full items-center justify-center rounded-md bg-action-primary px-4 py-3 text-button text-white no-underline visited:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" to={studentCoursesPaths.course(course.id)}>{isCompleted ? messages.viewResult : activeLabel}</Link> : accessExpired ? <p className="text-body-sm text-danger-text">Kursga kirish muddati tugagan.</p> : isSuspended ? <p className="text-body-sm text-warning-text">{messages.suspended}</p> : <Button disabled={isPending} loading={isPending} onClick={onEnroll} width="full">{messages.enroll}</Button>}{enrollmentError ? <p className="mt-3 text-body-sm text-danger-text" role="alert">{enrollmentError}</p> : null}{currentEnrollment ? <p className="mt-3 text-caption text-text-muted">{messages.state}: {messages.status[currentEnrollment.status]}. {currentEnrollment.status === 'COMPLETED' ? messages.completed : `Yozilgan sana: ${date(currentEnrollment.enrolledAt)}`}</p> : null}</div></Card>;
}

export default function StudentCoursesPage() {
  const { catalog, enrollments, enrollment } = useStudentCourses();
  const error = catalog.error ?? enrollments.error;
  const isLoading = catalog.isPending || enrollments.isPending;
  const enrollmentByCourse = latestEnrollmentsByCourse(enrollments.data?.items ?? []);

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="type-heading-1">{messages.title}</h1>
          <p className="mt-3 max-w-reading text-body-md text-text-secondary">
            {messages.description}
          </p>
        </div>
        <Link className="inline-flex min-h-target items-center text-button" to={progressPaths.dashboard}>
          {messages.backToDashboard}
        </Link>
      </header>

      {isLoading ? <ProgressSkeleton cards={3} /> : null}
      {error ? (
        <div className="mt-8">
          <ProgressError
            error={error}
            onRetry={() => {
              void catalog.refetch();
              void enrollments.refetch();
            }}
          />
        </div>
      ) : null}
      {!error && catalog.data && enrollments.data && catalog.data.items.length === 0 ? (
        <div className="mt-8">
          <Card className="py-10 text-center" elevation="none">
            <h2 className="type-heading-3">{messages.emptyTitle}</h2>
            <p className="mx-auto mt-2 max-w-reading text-body-sm text-text-secondary">
              {messages.emptyBody}
            </p>
          </Card>
        </div>
      ) : null}
      {!error && catalog.data && enrollments.data && catalog.data.items.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {catalog.data.items.map((course) => {
            const currentEnrollment = enrollmentByCourse.get(course.id);
            const isPending = enrollment.isPending && enrollment.variables === course.id;
            return <StudentCatalogCourseCard key={course.id} course={course} currentEnrollment={currentEnrollment} enrollmentError={enrollment.isError && enrollment.variables === course.id ? enrollmentErrorMessage(enrollment.error) : undefined} isPending={isPending} onEnroll={() => enrollment.mutate(course.id)} />;
          })}
        </div>
      ) : null}
    </>
  );
}
