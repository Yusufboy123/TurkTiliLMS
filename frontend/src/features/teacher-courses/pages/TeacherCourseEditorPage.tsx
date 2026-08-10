import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, FormField, Input, PermissionDeniedState, Select, Textarea } from '../../../components';
import { useAuth } from '../../auth';
import { teacherCoursesMessages as messages } from '../teacher-courses.messages';
import { teacherCoursePaths } from '../teacher-courses.routes';
import { useCreateTeacherCourse, useTeacherCourse, useUpdateTeacherCourse } from '../hooks/use-teacher-courses';
import type { TeacherCourseLevel } from '../types/teacher-courses.types';

const levels: TeacherCourseLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export default function TeacherCourseEditorPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const isNew = !courseId || courseId === 'new';
  const auth = useAuth();
  const navigate = useNavigate();
  const course = useTeacherCourse(isNew ? '' : courseId);
  const create = useCreateTeacherCourse();
  const update = useUpdateTeacherCourse(courseId ?? '');
  const [title, setTitle] = useState('');
  const [shortDescription, setShortDescription] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState<TeacherCourseLevel | ''>('');

  useEffect(() => {
    if (!course.data || isNew) return;
    setTitle(course.data.title);
    setShortDescription(course.data.shortDescription ?? '');
    setDescription(course.data.description ?? '');
    setLevel(course.data.level ?? '');
  }, [course.data, isNew]);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isNew) {
      create.mutate(
        {
          title: title.trim(),
          ...(shortDescription.trim() ? { shortDescription: shortDescription.trim() } : {}),
          ...(description.trim() ? { description: description.trim() } : {}),
          ...(level ? { level } : {}),
        },
        { onSuccess: (created) => navigate(teacherCoursePaths.detail(created.id)) },
      );
    } else {
      update.mutate(
        {
          title: title.trim(),
          shortDescription: shortDescription.trim() || null,
          description: description.trim() || null,
          level: level || null,
        },
        { onSuccess: () => navigate(teacherCoursePaths.detail(courseId)) },
      );
    }
  };

  const pending = create.isPending || update.isPending;
  const canEdit = auth.status === 'authenticated' && auth.permissions.includes(isNew ? 'courses.create' : 'courses.update');
  if (!canEdit) return <PermissionDeniedState />;
  if (!isNew && course.isPending) return <p role="status">{messages.loading}</p>;
  if (!isNew && course.isError) {
    return <p className="text-danger-text" role="alert">{messages.detailError}</p>;
  }

  return (
    <Card className="mx-auto max-w-2xl" padding="lg">
      <p className="text-label-md text-brand-text">{messages.eyebrow}</p>
      <h1 className="type-heading-1 mt-2">{isNew ? messages.newTitle : messages.editTitle}</h1>
      <form className="mt-6 grid gap-5" onSubmit={submit}>
        <FormField label={messages.titleLabel} required>
          <Input onChange={(event) => setTitle(event.target.value)} required value={title} />
        </FormField>
        <FormField label={messages.shortDescriptionLabel}>
          <Textarea maxLength={500} onChange={(event) => setShortDescription(event.target.value)} value={shortDescription} />
        </FormField>
        <FormField label={messages.descriptionLabel}>
          <Textarea maxLength={20_000} onChange={(event) => setDescription(event.target.value)} value={description} />
        </FormField>
        <FormField label={messages.levelLabel}>
          <Select onChange={(event) => setLevel(event.target.value as TeacherCourseLevel | '')} value={level}>
            <option value="">{messages.levelUnset}</option>
            {levels.map((item) => <option key={item} value={item}>{item}</option>)}
          </Select>
        </FormField>
        <FormField description="Holat faqat mavjud lifecycle amallari orqali o‘zgaradi." label={messages.statusLabel}>
          <Input readOnly value={isNew ? messages.status.DRAFT : course.data ? messages.status[course.data.status] : ''} />
        </FormField>
        <div className="flex flex-wrap gap-3">
          <Button disabled={pending || !title.trim()} loading={pending} type="submit">{pending ? messages.saving : messages.save}</Button>
          <Link to={isNew ? teacherCoursePaths.list : teacherCoursePaths.detail(courseId ?? '')}>
            <Button intent="secondary" type="button">{messages.cancel}</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
