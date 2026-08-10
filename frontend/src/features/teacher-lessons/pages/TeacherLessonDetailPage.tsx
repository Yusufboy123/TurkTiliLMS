import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField, Input, Select, Textarea } from '../../../components';
import { useAuth } from '../../auth';
import { teacherLessonsMessages as messages } from '../teacher-lessons.messages';
import { teacherLessonPaths } from '../teacher-lessons.routes';
import {
  useCreateTeacherBlock,
  useTeacherLesson,
  useTeacherLessonBlocks,
  useUpdateTeacherBlock,
} from '../hooks/use-teacher-lessons';
import type {
  TeacherContentBlock,
  TeacherLessonBlockType,
  TeacherLessonStatus,
} from '../types/teacher-lessons.types';
import TeacherLessonEditorPage from './TeacherLessonEditorPage';

const blockTypes: Array<Extract<TeacherLessonBlockType, 'TEXT' | 'VIDEO' | 'AUDIO'>> = ['TEXT', 'VIDEO', 'AUDIO'];
const statusIntent: Record<TeacherLessonStatus, 'neutral' | 'warning' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
};

function BlockCard({
  block,
  canUpdate,
  courseId,
  lessonId,
}: {
  block: TeacherContentBlock;
  canUpdate: boolean;
  courseId: string;
  lessonId: string;
}) {
  const update = useUpdateTeacherBlock(courseId, lessonId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(block.title ?? '');
  const [textContent, setTextContent] = useState(block.textContent ?? '');
  const [sourceUrl, setSourceUrl] = useState(block.sourceUrl ?? block.fileUrl ?? '');
  const [isRequired, setIsRequired] = useState(block.isRequired);
  const isText = block.blockType === 'TEXT';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate(
      {
        blockId: block.id,
        input: {
          title: title.trim() || null,
          ...(isText ? { textContent: textContent.trim() || null } : { sourceUrl: sourceUrl.trim() || null }),
          isRequired,
        },
      },
      { onSuccess: () => setEditing(false) },
    );
  };

  return (
    <Card className="h-full" padding="sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm text-text-muted">{messages.blockTypes[block.blockType as 'TEXT' | 'VIDEO' | 'AUDIO'] ?? block.blockType} · {block.position}</p>
          <h3 className="type-heading-4 mt-1 break-words">{block.title ?? 'Kontent bloki'}</h3>
        </div>
        <Badge intent={block.isVisible ? 'success' : 'neutral'}>{block.isVisible ? messages.visible : 'Yashirin'}</Badge>
      </div>
      {!editing ? (
        <>
          {isText && block.textContent ? <p className="mt-3 whitespace-pre-wrap text-body-sm text-text-secondary">{block.textContent}</p> : null}
          {!isText && (block.sourceUrl || block.fileUrl) ? (
            <a className="mt-3 block break-all text-body-sm text-action-primary-text" href={block.sourceUrl ?? block.fileUrl ?? undefined} rel="noreferrer" target="_blank">
              {block.sourceUrl ?? block.fileUrl}
            </a>
          ) : null}
          {canUpdate && (block.blockType === 'TEXT' || block.blockType === 'VIDEO' || block.blockType === 'AUDIO') ? (
            <Button className="mt-4" intent="secondary" onClick={() => setEditing(true)} size="sm">{messages.editBlock}</Button>
          ) : null}
        </>
      ) : (
        <form className="mt-4 grid gap-4" onSubmit={submit}>
          <FormField label={messages.titleLabel}>
            <Input onChange={(event) => setTitle(event.target.value)} value={title} />
          </FormField>
          {isText ? (
            <FormField label={messages.textContent} required>
              <Textarea onChange={(event) => setTextContent(event.target.value)} required value={textContent} />
            </FormField>
          ) : (
            <FormField label={messages.mediaUrl} required>
              <Input onChange={(event) => setSourceUrl(event.target.value)} required type="url" value={sourceUrl} />
            </FormField>
          )}
          <label className="flex min-h-target items-center gap-3 text-label-md">
            <input checked={isRequired} className="h-5 w-5 accent-action-primary" onChange={(event) => setIsRequired(event.target.checked)} type="checkbox" />
            {messages.required}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={update.isPending} loading={update.isPending} size="sm" type="submit">{messages.save}</Button>
            <Button intent="secondary" onClick={() => setEditing(false)} size="sm">{messages.cancel}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function NewBlockForm({ courseId, lessonId, canCreate }: { courseId: string; lessonId: string; canCreate: boolean }) {
  const create = useCreateTeacherBlock(courseId, lessonId);
  const [open, setOpen] = useState(false);
  const [blockType, setBlockType] = useState<(typeof blockTypes)[number]>('TEXT');
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [isRequired, setIsRequired] = useState(true);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      {
        blockType,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(blockType === 'TEXT' ? { textContent: textContent.trim() } : { sourceUrl: sourceUrl.trim() }),
        isRequired,
        isVisible: true,
      },
      { onSuccess: () => { setOpen(false); setTitle(''); setTextContent(''); setSourceUrl(''); } },
    );
  };

  if (!canCreate) return null;
  return (
    <div className="mt-5">
      <Button intent="secondary" onClick={() => setOpen((value) => !value)}>{messages.addBlock}</Button>
      {open ? (
        <form className="mt-4 grid gap-4 rounded-lg border border-border-decorative p-4" onSubmit={submit}>
          <FormField label={messages.blockType} required>
            <Select onChange={(event) => setBlockType(event.target.value as (typeof blockTypes)[number])} value={blockType}>
              {blockTypes.map((type) => <option key={type} value={type}>{messages.blockTypes[type]}</option>)}
            </Select>
          </FormField>
          <FormField label={messages.titleLabel}>
            <Input onChange={(event) => setTitle(event.target.value)} value={title} />
          </FormField>
          {blockType === 'TEXT' ? (
            <FormField label={messages.textContent} required>
              <Textarea onChange={(event) => setTextContent(event.target.value)} required value={textContent} />
            </FormField>
          ) : (
            <FormField label={messages.mediaUrl} required>
              <Input onChange={(event) => setSourceUrl(event.target.value)} required type="url" value={sourceUrl} />
            </FormField>
          )}
          <label className="flex min-h-target items-center gap-3 text-label-md">
            <input checked={isRequired} className="h-5 w-5 accent-action-primary" onChange={(event) => setIsRequired(event.target.checked)} type="checkbox" />
            {messages.required}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={create.isPending} loading={create.isPending} type="submit">{messages.save}</Button>
            <Button intent="secondary" onClick={() => setOpen(false)} type="button">{messages.cancel}</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default function TeacherLessonDetailPage() {
  const { courseId = '', lessonId = '' } = useParams<{ courseId: string; lessonId: string }>();
  const auth = useAuth();
  const lesson = useTeacherLesson(courseId, lessonId);
  const blocks = useTeacherLessonBlocks(courseId, lessonId);
  const [editing, setEditing] = useState(false);
  const canUpdate = auth.status === 'authenticated' && auth.permissions.includes('lessons.update');
  const canCreateBlock = auth.status === 'authenticated' && auth.permissions.includes('lesson_blocks.create');

  if (editing) return <TeacherLessonEditorPage />;
  if (lesson.isPending) return <p role="status">{messages.loading}</p>;
  if (lesson.isError || !lesson.data) return <p className="text-danger-text" role="alert">{messages.notFound}</p>;

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link className="text-body-sm text-action-primary-text" to={teacherLessonPaths.list(courseId)}>← {messages.title}</Link>
          <h1 className="type-heading-1 mt-3 break-words">{lesson.data.title}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Badge intent={statusIntent[lesson.data.status]}>{messages.status[lesson.data.status]}</Badge>
            <span className="text-body-sm text-text-secondary">{messages.typeLabel}: {messages.types[lesson.data.lessonType]}</span>
            <span className="text-body-sm text-text-secondary">{messages.order}: {lesson.data.position}</span>
            {lesson.data.isPreview ? <span className="text-body-sm text-text-secondary">{messages.preview}</span> : null}
          </div>
        </div>
        {canUpdate && lesson.data.status !== 'PUBLISHED' && lesson.data.status !== 'ARCHIVED' ? (
          <Button intent="secondary" onClick={() => setEditing(true)}>{messages.editTitle}</Button>
        ) : null}
      </header>

      <Card>
        <h2 className="type-heading-3">Tafsilotlar</h2>
        {lesson.data.summary ? <p className="mt-3 text-body-md text-text-secondary">{lesson.data.summary}</p> : null}
        {lesson.data.content ? <p className="mt-4 whitespace-pre-wrap text-body-md">{lesson.data.content}</p> : null}
        {!lesson.data.summary && !lesson.data.content ? <p className="mt-3 text-body-md text-text-secondary">Tavsif kiritilmagan.</p> : null}
      </Card>

      <Card>
        <h2 className="type-heading-3">{messages.blocks}</h2>
        {blocks.isPending ? <p className="mt-4" role="status">{messages.loading}</p> : null}
        {blocks.isError ? <p className="mt-4 text-danger-text" role="alert">Kontent bloklarini yuklab bo‘lmadi.</p> : null}
        {blocks.data && blocks.data.items.length === 0 ? <p className="mt-4 text-body-md text-text-secondary">{messages.noBlocks}</p> : null}
        {blocks.data && blocks.data.items.length > 0 ? (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {blocks.data.items.map((block) => <BlockCard block={block} canUpdate={auth.status === 'authenticated' && auth.permissions.includes('lesson_blocks.update')} courseId={courseId} key={block.id} lessonId={lessonId} />)}
          </div>
        ) : null}
        <NewBlockForm canCreate={canCreateBlock} courseId={courseId} lessonId={lessonId} />
      </Card>
    </div>
  );
}
