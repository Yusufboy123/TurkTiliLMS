import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card } from '../../../components';
import { ProgressBar, ProgressError, ProgressSkeleton } from '../../progress/components';
import { useEnrollmentProgress } from '../../progress/hooks/use-progress-queries';
import { progressPaths } from '../../progress/progress.routes';
import { useStudentCourses, latestEnrollmentsByCourse } from '../hooks/use-student-courses';
import { studentCoursesMessages as messages } from '../student-courses.messages';

export default function StudentCoursePage() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const { catalog, enrollments } = useStudentCourses();
  const enrollment = latestEnrollmentsByCourse(enrollments.data?.items ?? []).get(courseId);
  const progress = useEnrollmentProgress(enrollment?.id ?? '');
  const course = catalog.data?.items.find((item) => item.id === courseId);

  if (catalog.isPending || enrollments.isPending) return <ProgressSkeleton cards={3} />;
  if (catalog.isError || enrollments.isError) {
    return <ProgressError error={catalog.error ?? enrollments.error} onRetry={() => { void catalog.refetch(); void enrollments.refetch(); }} />;
  }
  if (!enrollment) {
    return (
      <Card role="alert">
        <h1 className="type-heading-2">Kursga kirish cheklangan</h1>
        <p className="mt-3 text-body-md text-text-secondary">Bu kursni o‘rganish uchun avval enrollment kerak.</p>
        <Link className="mt-5 inline-flex no-underline" to="/app/courses">
          <Button>{messages.title}</Button>
        </Link>
      </Card>
    );
  }
  if (progress.isPending) return <ProgressSkeleton cards={4} />;
  if (progress.isError && !progress.data) return <ProgressError error={progress.error} onRetry={() => void progress.refetch()} />;

  const data = progress.data;
  const flattened = data.sections.flatMap((section) => section.lessons);
  const nextLesson = data.resumeTarget?.lesson ?? flattened.find((lesson) => lesson.status !== 'COMPLETED');
  const statusLabel = enrollment.status === 'SUSPENDED' ? 'Kurs vaqtincha to‘xtatilgan.' : enrollment.status === 'CANCELLED' ? 'Enrollment bekor qilingan.' : data.capabilities.unavailableReason === 'ACCESS_EXPIRED' ? 'Kursga kirish muddati tugagan.' : null;

  return (
    <div className="grid gap-8">
      <header className="rounded-2xl border border-border-decorative bg-surface p-5 shadow-card sm:p-6">
        <Link className="text-body-sm text-action-primary-text" to="/app/courses">← {messages.title}</Link>
        <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="type-heading-1">{course?.title ?? data.course.title}</h1>
            <p className="mt-2 text-body-md text-text-secondary">Daraja: {course?.level ?? '—'}</p>
          </div>
          <Badge intent={data.status === 'COMPLETED' ? 'success' : 'info'}>{data.status === 'COMPLETED' ? 'Yakunlangan' : `${data.percentage}%`}</Badge>
        </div>
        <div className="mt-5 max-w-reading"><ProgressBar label="Kurs jarayoni" value={data.percentage} /></div>
        {statusLabel ? <p className="mt-4 rounded-md border border-warning-border bg-warning-bg p-4 text-body-sm text-warning-text" role="status">{statusLabel}</p> : null}
      </header>

      {data.status === 'COMPLETED' ? (
        <Card className="border-success-border bg-success-bg"><h2 className="type-heading-3">Kurs yakunlandi</h2><p className="mt-2 text-body-md text-success-text">Barcha mavjud darslar tugatilgan.</p></Card>
      ) : nextLesson && !statusLabel ? (
        <Card className="border-info-border bg-info-bg">
          <p className="text-label-sm text-info-text">Davom ettirish</p>
          <h2 className="type-heading-3 mt-2">{nextLesson.title}</h2>
          <Link className="mt-5 inline-flex no-underline" to={progressPaths.lesson(enrollment.id, nextLesson.id)}>
            <Button>{data.resumeTarget ? 'Davom ettirish' : 'Darsni boshlash'}</Button>
          </Link>
        </Card>
      ) : null}

      <section aria-labelledby="student-course-lessons-heading">
        <h2 className="type-heading-2" id="student-course-lessons-heading">Darslar</h2>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {data.sections.map((section) => (
            <div className="contents" key={section.id}>
              {section.lessons.map((lesson) => (
                <Card className="flex h-full flex-col" key={lesson.id} padding="lg">
                  <div className="flex items-start justify-between gap-3"><h3 className="type-heading-4 break-words">{lesson.title}</h3><Badge intent={lesson.mastery?.locked ? 'neutral' : lesson.status === 'COMPLETED' ? 'success' : 'neutral'}>{lesson.mastery?.locked ? '🔒 Qulflangan' : lesson.status === 'COMPLETED' ? 'O‘zlashtirildi ✓' : `${lesson.percentage}%`}</Badge></div>
                  <p className="mt-3 text-body-sm text-text-secondary">{lesson.completedEligibleBlocks}/{lesson.totalEligibleBlocks} material</p>
                  {lesson.mastery?.locked ? <p className="mt-3 text-body-sm text-text-secondary">{lesson.mastery.previousLessonTitle ? `Avval ${lesson.mastery.previousLessonTitle} darsini o‘zlashtiring.` : 'Avval oldingi darsni o‘zlashtiring.'}</p> : null}
                  <div className="mt-auto pt-5">{data.capabilities.canAccessCourseContent && lesson.capabilities.canAccessLesson !== false ? <Link className="inline-flex min-h-target items-center text-button" to={progressPaths.lesson(enrollment.id, lesson.id)}>Darsni ochish</Link> : lesson.mastery?.locked ? <span className="text-body-sm text-text-muted">Avvalgi dars talab qilinadi</span> : <span className="text-body-sm text-text-muted">Kirish yopiq</span>}</div>
                </Card>
              ))}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
