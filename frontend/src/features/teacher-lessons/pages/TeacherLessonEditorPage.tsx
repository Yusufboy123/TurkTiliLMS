import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, Card, FormField, Input, PermissionDeniedState, Select, Textarea } from '../../../components';
import { useAuth } from '../../auth';
import { teacherLessonsMessages as messages } from '../teacher-lessons.messages';
import { teacherLessonPaths } from '../teacher-lessons.routes';
import {
  useCreateTeacherLesson,
  useCreateTeacherSection,
  useReorderTeacherLesson,
  useTeacherLesson,
  useTeacherSections,
  useUpdateTeacherLesson,
} from '../hooks/use-teacher-lessons';
import type { TeacherLessonType } from '../types/teacher-lessons.types';

const lessonTypes: TeacherLessonType[] = ['TEXT', 'VIDEO', 'AUDIO', 'PDF', 'QUIZ', 'ASSIGNMENT', 'LIVE'];

export default function TeacherLessonEditorPage() {
  const { courseId = '', lessonId } = useParams<{ courseId: string; lessonId?: string }>();
  const isNew = !lessonId || lessonId === 'new';
  const auth = useAuth();
  const navigate = useNavigate();
  const sections = useTeacherSections(courseId);
  const lesson = useTeacherLesson(courseId, isNew ? '' : lessonId);
  const create = useCreateTeacherLesson(courseId);
  const update = useUpdateTeacherLesson(courseId, lessonId ?? '');
  const reorder = useReorderTeacherLesson(courseId, lessonId ?? '');
  const createSection = useCreateTeacherSection(courseId);
  const [title, setTitle] = useState('');
  const [summary, setSummary] = useState('');
  const [lessonType, setLessonType] = useState<TeacherLessonType>('TEXT');
  const [sectionId, setSectionId] = useState('');
  const [position, setPosition] = useState('1');
  const [isPreview, setIsPreview] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');

  useEffect(() => {
    if (!lesson.data || isNew) return;
    setTitle(lesson.data.title);
    setSummary(lesson.data.summary ?? '');
    setLessonType(lesson.data.lessonType);
    setSectionId(lesson.data.section.id);
    setPosition(String(lesson.data.position));
    setIsPreview(lesson.data.isPreview);
  }, [isNew, lesson.data]);

  useEffect(() => {
    if (isNew && !sectionId && sections.data?.[0]) setSectionId(sections.data[0].id);
  }, [isNew, sectionId, sections.data]);

  const canEdit = auth.status === 'authenticated' && auth.permissions.includes(isNew ? 'lessons.create' : 'lessons.update');
  const canCreateSection = auth.status === 'authenticated' && auth.permissions.includes('sections.create');
  const pending = create.isPending || update.isPending || reorder.isPending;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const numericPosition = Math.max(1, Number(position) || 1);
    if (isNew) {
      if (!sectionId) return;
      create.mutate(
        {
          sectionId,
          title: title.trim(),
          ...(summary.trim() ? { summary: summary.trim() } : {}),
          lessonType,
          position: numericPosition,
          isPreview,
        },
        { onSuccess: (created) => navigate(teacherLessonPaths.detail(courseId, created.id)) },
      );
      return;
    }
    update.mutate(
      {
        title: title.trim(),
        summary: summary.trim() || null,
        lessonType,
        isPreview,
      },
      {
        onSuccess: (updated) => {
          const changed = updated.section.id !== sectionId || updated.position !== numericPosition;
          if (changed) {
            reorder.mutate(
              { sectionId: sectionId || undefined, position: numericPosition },
              { onSuccess: () => navigate(teacherLessonPaths.detail(courseId, lessonId)) },
            );
          } else {
            navigate(teacherLessonPaths.detail(courseId, lessonId));
          }
        },
      },
    );
  };

  const submitSection = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sectionTitle.trim()) return;
    createSection.mutate(
      { title: sectionTitle.trim() },
      { onSuccess: (section) => { setSectionId(section.id); setSectionTitle(''); } },
    );
  };

  if (!canEdit) return <PermissionDeniedState />;
  if (!isNew && lesson.isPending) return <p role="status">{messages.loading}</p>;
  if (!isNew && lesson.isError) return <p className="text-danger-text" role="alert">{messages.detailError}</p>;
  if (sections.isPending) return <p role="status">{messages.loading}</p>;

  return (
    <Card className="mx-auto max-w-2xl" padding="lg">
      <Link className="text-body-sm text-action-primary-text" to={teacherLessonPaths.list(courseId)}>← {messages.title}</Link>
      <p className="mt-4 text-label-md text-brand-text">{messages.eyebrow}</p>
      <h1 className="type-heading-1 mt-2">{isNew ? messages.newTitle : messages.editTitle}</h1>

      {sections.data?.length === 0 && canCreateSection ? (
        <form className="mt-6 rounded-lg border border-warning-border bg-warning-bg p-4" onSubmit={submitSection}>
          <p className="text-body-sm text-warning-text">{messages.noSections}</p>
          <FormField className="mt-4" label={messages.sectionName} required>
            <Input onChange={(event) => setSectionTitle(event.target.value)} required value={sectionTitle} />
          </FormField>
          <Button className="mt-4" disabled={createSection.isPending || !sectionTitle.trim()} loading={createSection.isPending} type="submit">
            {createSection.isPending ? messages.sectionSaving : messages.createSection}
          </Button>
        </form>
      ) : null}

      <form className="mt-6 grid gap-5" onSubmit={submit}>
        <FormField label={messages.titleLabel} required>
          <Input onChange={(event) => setTitle(event.target.value)} required value={title} />
        </FormField>
        <FormField label={messages.summaryLabel}>
          <Textarea maxLength={2_000} onChange={(event) => setSummary(event.target.value)} value={summary} />
        </FormField>
        <FormField label={messages.sectionLabel} required>
          <Select disabled={!sections.data?.length} onChange={(event) => setSectionId(event.target.value)} required value={sectionId}>
            <option value="">{messages.sectionUnset}</option>
            {(sections.data ?? []).map((section) => <option key={section.id} value={section.id}>{section.position}. {section.title}</option>)}
          </Select>
        </FormField>
        <FormField label={messages.typeLabel} required>
          <Select onChange={(event) => setLessonType(event.target.value as TeacherLessonType)} value={lessonType}>
            {lessonTypes.map((type) => <option key={type} value={type}>{messages.types[type]}</option>)}
          </Select>
        </FormField>
        <FormField label={messages.positionLabel} required>
          <Input min={1} onChange={(event) => setPosition(event.target.value)} required type="number" value={position} />
        </FormField>
        <label className="flex min-h-target items-center gap-3 text-label-md">
          <input checked={isPreview} className="h-5 w-5 accent-action-primary" onChange={(event) => setIsPreview(event.target.checked)} type="checkbox" />
          {messages.previewLabel}
        </label>
        <div className="flex flex-wrap gap-3">
          <Button disabled={pending || !title.trim() || !sectionId} loading={pending} type="submit">{pending ? messages.saving : messages.save}</Button>
          <Link to={isNew ? teacherLessonPaths.list(courseId) : teacherLessonPaths.detail(courseId, lessonId ?? '')}>
            <Button intent="secondary" type="button">{messages.cancel}</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
