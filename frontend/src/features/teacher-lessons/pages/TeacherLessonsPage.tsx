import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card } from '../../../components';
import { useAuth } from '../../auth';
import { teacherCoursePaths } from '../../teacher-courses/teacher-courses.routes';
import { teacherLessonsMessages as messages } from '../teacher-lessons.messages';
import { teacherLessonPaths } from '../teacher-lessons.routes';
import { useTeacherLessons, useTeacherSections } from '../hooks/use-teacher-lessons';
import type { TeacherLessonStatus } from '../types/teacher-lessons.types';

const listQuery = {
  page: 1,
  pageSize: 100,
  includeDeleted: false as const,
  sortBy: 'position' as const,
  sortDirection: 'asc' as const,
};

const statusIntent: Record<TeacherLessonStatus, 'neutral' | 'warning' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
};

export default function TeacherLessonsPage() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const auth = useAuth();
  const sections = useTeacherSections(courseId);
  const lessons = useTeacherLessons(courseId, listQuery);
  const canCreate = auth.status === 'authenticated' && auth.permissions.includes('lessons.create');
  const sectionNames = new Map((sections.data ?? []).map((section) => [section.id, section.title]));

  return (
    <>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link className="text-body-sm text-action-primary-text" to={teacherCoursePaths.detail(courseId)}>
            ← Kurs
          </Link>
          <p className="mt-4 text-label-md text-brand-text">{messages.eyebrow}</p>
          <h1 className="type-heading-1 mt-2">{messages.title}</h1>
          <p className="mt-3 max-w-reading text-body-md text-text-secondary">{messages.description}</p>
        </div>
        {canCreate ? (
          <Link to={teacherLessonPaths.new(courseId)}>
            <Button>{messages.create}</Button>
          </Link>
        ) : null}
      </header>

      {lessons.isPending || sections.isPending ? <p className="mt-8" role="status">{messages.loading}</p> : null}
      {lessons.isError || sections.isError ? (
        <Card className="mt-8 border-danger-border bg-danger-bg" role="alert">
          <p className="text-body-md text-danger-text">{messages.error}</p>
          <Button className="mt-4" intent="secondary" onClick={() => { void lessons.refetch(); void sections.refetch(); }}>
            {messages.retry}
          </Button>
        </Card>
      ) : null}
      {lessons.data && lessons.data.items.length === 0 ? (
        <Card className="mt-8">
          <p className="text-body-md text-text-secondary">{messages.noLessons}</p>
        </Card>
      ) : null}
      {lessons.data && lessons.data.items.length > 0 ? (
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          {lessons.data.items.map((lesson) => (
            <Card className="flex h-full flex-col" key={lesson.id}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-label-sm text-text-muted">{messages.order}: {lesson.position}</p>
                  <h2 className="type-heading-3 mt-1 break-words">{lesson.title}</h2>
                </div>
                <Badge intent={statusIntent[lesson.status]}>{messages.status[lesson.status]}</Badge>
              </div>
              <p className="mt-3 text-body-sm text-text-secondary">
                {messages.sectionLabel}: {sectionNames.get(lesson.section.id) ?? lesson.section.title}
              </p>
              <p className="mt-1 text-body-sm text-text-secondary">
                {messages.typeLabel}: {messages.types[lesson.lessonType]}
                {lesson.isPreview ? ` · ${messages.preview}` : ''}
              </p>
              {lesson.summary ? <p className="mt-3 line-clamp-3 text-body-sm text-text-secondary">{lesson.summary}</p> : null}
              <div className="mt-auto pt-5">
                <Link className="no-underline" to={teacherLessonPaths.detail(courseId, lesson.id)}>
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
