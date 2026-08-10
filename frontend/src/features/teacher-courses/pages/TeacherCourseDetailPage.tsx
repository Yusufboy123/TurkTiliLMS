import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card } from '../../../components';
import { useAuth } from '../../auth';
import { teacherCoursesMessages as messages } from '../teacher-courses.messages';
import { teacherCoursePaths } from '../teacher-courses.routes';
import { teacherLessonPaths } from '../../teacher-lessons/teacher-lessons.routes';
import {
  useTeacherCourse,
  useTeacherCourseEnrollments,
  useUpdateTeacherCourseStatus,
} from '../hooks/use-teacher-courses';
import type { TeacherCourseStatus } from '../types/teacher-courses.types';
import TeacherCourseEditorPage from './TeacherCourseEditorPage';

const statusIntent: Record<TeacherCourseStatus, 'neutral' | 'warning' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
};

export default function TeacherCourseDetailPage() {
  const { courseId = '' } = useParams<{ courseId: string }>();
  const auth = useAuth();
  const course = useTeacherCourse(courseId);
  const enrollments = useTeacherCourseEnrollments(courseId);
  const status = useUpdateTeacherCourseStatus(courseId);
  const [editing, setEditing] = useState(false);
  const canUpdate = auth.status === 'authenticated' && auth.permissions.includes('courses.update');
  const canSubmitReview = auth.status === 'authenticated' && auth.permissions.includes('courses.submit_review');
  const canPublish = auth.status === 'authenticated' && auth.permissions.includes('courses.publish');
  const current = course.data?.status;
  const canEdit = canUpdate && (current === 'DRAFT' || current === 'IN_REVIEW');
  const transition = (next: TeacherCourseStatus) => status.mutate(next);

  if (editing) return <TeacherCourseEditorPage />;
  if (course.isPending) return <p role="status">{messages.loading}</p>;
  if (course.isError || !course.data) return <p className="text-danger-text" role="alert">{messages.notFound}</p>;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-body-sm text-action-primary-text" to={teacherCoursePaths.list}>← {messages.title}</Link>
          <h1 className="type-heading-1 mt-3 break-words">{course.data.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge intent={statusIntent[course.data.status]}>{messages.status[course.data.status]}</Badge>
            <span className="text-body-sm text-text-secondary">{messages.levelLabel}: {course.data.level ?? messages.levelUnset}</span>
          </div>
        </div>
        {canEdit ? <Button intent="secondary" onClick={() => setEditing(true)}>Tahrirlash</Button> : null}
      </header>

      <Card>
        <h2 className="type-heading-3">Tafsilotlar</h2>
        {course.data.shortDescription ? <p className="mt-3 text-body-md text-text-secondary">{course.data.shortDescription}</p> : null}
        {course.data.description ? <p className="mt-4 whitespace-pre-wrap text-body-md">{course.data.description}</p> : null}
        {!course.data.shortDescription && !course.data.description ? <p className="mt-3 text-body-md text-text-secondary">Tavsif kiritilmagan.</p> : null}
      </Card>

      <Card>
        <h2 className="type-heading-3">Umumiy ma’lumot</h2>
        <p className="mt-3 text-body-md text-text-secondary">{messages.enrollments}: {enrollments.data?.pagination.totalItems ?? '—'}</p>
      </Card>

      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="type-heading-3">{messages.lessons}</h2>
            <p className="mt-3 text-body-md text-text-secondary">Darslarni ko‘ring va boshqaring.</p>
          </div>
          <Link className="no-underline" to={teacherLessonPaths.list(courseId)}>
            <Button intent="secondary">{messages.lessons}</Button>
          </Link>
        </div>
      </Card>

      {(canSubmitReview || canPublish) && current ? (
        <Card>
          <h2 className="type-heading-3">{messages.statusLabel}</h2>
          <div className="mt-4 flex flex-wrap gap-3">
            {current === 'DRAFT' && canSubmitReview ? <Button disabled={status.isPending} loading={status.isPending} onClick={() => transition('IN_REVIEW')}>{messages.action.submitReview}</Button> : null}
            {current === 'IN_REVIEW' && canSubmitReview ? <Button disabled={status.isPending} intent="secondary" onClick={() => transition('DRAFT')}>{messages.action.returnDraft}</Button> : null}
            {current === 'IN_REVIEW' && canPublish ? <Button disabled={status.isPending} loading={status.isPending} onClick={() => transition('PUBLISHED')}>{messages.action.publish}</Button> : null}
            {current === 'PUBLISHED' && canPublish ? <Button disabled={status.isPending} intent="secondary" onClick={() => transition('ARCHIVED')}>{messages.action.archive}</Button> : null}
            {current === 'ARCHIVED' && canUpdate ? <Button disabled={status.isPending} intent="secondary" onClick={() => transition('DRAFT')}>{messages.action.returnDraft}</Button> : null}
          </div>
        </Card>
      ) : null}
    </div>
  );
}
