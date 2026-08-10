import { Link } from 'react-router-dom';
import { Badge, Button, Card } from '../../../components';
import { useAuth } from '../../auth';
import { ProgressEmptyState } from '../../progress';
import { teacherCoursesMessages as messages } from '../teacher-courses.messages';
import { teacherCoursePaths } from '../teacher-courses.routes';
import { useTeacherCourses } from '../hooks/use-teacher-courses';
import type { TeacherCourseStatus } from '../types/teacher-courses.types';

const query = {
  page: 1,
  pageSize: 50,
  deleted: 'exclude' as const,
  sortBy: 'updatedAt' as const,
  sortDirection: 'desc' as const,
};

const statusIntent: Record<TeacherCourseStatus, 'neutral' | 'warning' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
};

export default function TeacherCoursesPage() {
  const auth = useAuth();
  const courses = useTeacherCourses(query);
  const canCreate = auth.status === 'authenticated' && auth.permissions.includes('courses.create');

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-label-md text-brand-text">{messages.eyebrow}</p>
          <h1 className="type-heading-1 mt-2">{messages.title}</h1>
          <p className="mt-3 max-w-reading text-body-md text-text-secondary">{messages.description}</p>
        </div>
        {canCreate ? (
          <Link to={teacherCoursePaths.new}>
            <Button>{messages.create}</Button>
          </Link>
        ) : null}
      </header>

      {courses.isPending ? <p className="mt-8" role="status">{messages.loading}</p> : null}
      {courses.isError ? (
        <Card className="mt-8 border-danger-border bg-danger-bg" role="alert">
          <p className="text-body-md text-danger-text">{messages.error}</p>
          <Button className="mt-4" intent="secondary" onClick={() => void courses.refetch()}>
            {messages.retry}
          </Button>
        </Card>
      ) : null}
      {courses.data && courses.data.items.length === 0 ? (
        <div className="mt-8">
          <ProgressEmptyState body={messages.noCourses} title={messages.noCourses} />
        </div>
      ) : null}
      {courses.data && courses.data.items.length > 0 ? (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {courses.data.items.map((course) => (
            <Card className="flex h-full flex-col" key={course.id}>
              <div className="flex items-start justify-between gap-3">
                <h2 className="type-heading-3 break-words">{course.title}</h2>
                <Badge intent={statusIntent[course.status]}>{messages.status[course.status]}</Badge>
              </div>
              <p className="mt-3 text-body-sm text-text-secondary">
                {messages.levelLabel}: {course.level ?? messages.levelUnset}
              </p>
              {course.shortDescription ? (
                <p className="mt-3 line-clamp-3 text-body-sm text-text-secondary">
                  {course.shortDescription}
                </p>
              ) : null}
              <div className="mt-auto pt-5">
                <Link className="no-underline" to={teacherCoursePaths.detail(course.id)}>
                  <Button intent="secondary" width="full">{messages.open}</Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      ) : null}
    </>
  );
}
