import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Badge, Button, Card, FormField, Input, Select, Textarea } from '../../../components';
import { useAuth } from '../../auth';
import { teacherLessonsMessages as messages } from '../teacher-lessons.messages';
import { teacherLessonPaths } from '../teacher-lessons.routes';
import {
  useCreateTeacherBlock,
  useDuplicateTeacherLesson,
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
import { TeacherQuizPanel, TeacherQuizResultsPanel, TeacherVocabularyPanel } from './TeacherLessonLearningSections';
import { TeacherMediaUploadField } from '../components/TeacherMediaUploadField';
import type { TeacherMediaFile } from '../types/teacher-lessons.types';

const blockTypes: Array<Extract<TeacherLessonBlockType, 'TEXT' | 'VIDEO' | 'AUDIO' | 'IMAGE'>> = ['TEXT', 'VIDEO', 'AUDIO', 'IMAGE'];
const statusIntent: Record<TeacherLessonStatus, 'neutral' | 'warning' | 'success' | 'info'> = {
  DRAFT: 'neutral',
  IN_REVIEW: 'warning',
  PUBLISHED: 'success',
  ARCHIVED: 'info',
};

function BlockCard({
  block,
  canUpdate,
  canUpload,
  courseId,
  lessonId,
}: {
  block: TeacherContentBlock;
  canUpdate: boolean;
  canUpload: boolean;
  courseId: string;
  lessonId: string;
}) {
  const update = useUpdateTeacherBlock(courseId, lessonId);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(block.title ?? '');
  const [textContent, setTextContent] = useState(block.textContent ?? '');
  const [sourceUrl, setSourceUrl] = useState(block.sourceUrl ?? block.fileUrl ?? '');
  const [mediaFileId, setMediaFileId] = useState(block.mediaFileId);
  const [isRequired, setIsRequired] = useState(block.isRequired);
  const isText = block.blockType === 'TEXT';

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    update.mutate(
      {
        blockId: block.id,
        input: {
          title: title.trim() || null,
          ...(isText ? { textContent: textContent.trim() || null } : mediaFileId ? { mediaFileId } : { sourceUrl: sourceUrl.trim() || null }),
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
          {!isText && block.media?.previewUrl && block.media.category === 'IMAGE' ? <img alt={block.title ?? 'Dars rasmi'} className="mt-3 max-h-64 w-full rounded-md object-contain" src={block.media.previewUrl} /> : null}
          {!isText && block.media?.previewUrl && block.media.category === 'VIDEO' ? <video aria-label={block.title ?? 'Video dars materiali'} className="mt-3 aspect-video w-full rounded-md bg-black" controls src={block.media.previewUrl} /> : null}
          {!isText && block.media?.previewUrl && block.media.category === 'AUDIO' ? <audio aria-label={block.title ?? 'Audio dars materiali'} className="mt-3 w-full" controls src={block.media.previewUrl} /> : null}
          {!isText && block.media ? <p className="mt-2 break-all text-body-sm text-text-secondary">Biriktirilgan: {block.media.originalFileName}</p> : null}
          {!isText && !block.media && (block.sourceUrl || block.fileUrl) ? <a className="mt-3 block break-all text-body-sm text-action-primary-text" href={block.sourceUrl ?? block.fileUrl ?? undefined} rel="noreferrer" target="_blank">{block.sourceUrl ?? block.fileUrl}</a> : null}
          {canUpdate && (block.blockType === 'TEXT' || block.blockType === 'VIDEO' || block.blockType === 'AUDIO' || block.blockType === 'IMAGE') ? (
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
            <>
              {canUpload ? <TeacherMediaUploadField kind={block.blockType as 'AUDIO' | 'VIDEO' | 'IMAGE'} onUploaded={(media) => setMediaFileId(media.id)} /> : null}
              {!block.media && block.sourceUrl ? <FormField label={messages.mediaUrl}><Input onChange={(event) => setSourceUrl(event.target.value)} type="url" value={sourceUrl} /></FormField> : null}
              {!canUpload && !block.sourceUrl ? <p className="text-body-sm text-warning-text" role="alert">Fayl yuklash uchun ruxsat mavjud emas.</p> : null}
            </>
          )}
          <label className="flex min-h-target items-center gap-3 text-label-md">
            <input checked={isRequired} className="h-5 w-5 accent-action-primary" onChange={(event) => setIsRequired(event.target.checked)} type="checkbox" />
            {messages.required}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={update.isPending || (!isText && !mediaFileId && !sourceUrl.trim())} loading={update.isPending} size="sm" type="submit">{messages.save}</Button>
            <Button intent="secondary" onClick={() => setEditing(false)} size="sm">{messages.cancel}</Button>
          </div>
        </form>
      )}
    </Card>
  );
}

function NewBlockForm({ courseId, lessonId, canCreate, canUpload }: { courseId: string; lessonId: string; canCreate: boolean; canUpload: boolean }) {
  const create = useCreateTeacherBlock(courseId, lessonId);
  const [open, setOpen] = useState(false);
  const [blockType, setBlockType] = useState<(typeof blockTypes)[number]>('TEXT');
  const [title, setTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [mediaFileId, setMediaFileId] = useState<string | null>(null);
  const [isRequired, setIsRequired] = useState(true);

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    create.mutate(
      {
        blockType,
        ...(title.trim() ? { title: title.trim() } : {}),
        ...(blockType === 'TEXT' ? { textContent: textContent.trim() } : { mediaFileId: mediaFileId ?? undefined }),
        isRequired,
        isVisible: true,
      },
      { onSuccess: () => { setOpen(false); setTitle(''); setTextContent(''); setMediaFileId(null); } },
    );
  };

  const changeBlockType = (value: (typeof blockTypes)[number]) => {
    setBlockType(value);
    if (value === 'TEXT') setMediaFileId(null);
  };

  if (!canCreate) return null;
  return (
    <div className="mt-5">
      <Button intent="secondary" onClick={() => setOpen((value) => !value)}>{messages.addBlock}</Button>
      {open ? (
        <form className="mt-4 grid gap-4 rounded-lg border border-border-decorative p-4" onSubmit={submit}>
          <FormField label={messages.blockType} required>
            <Select onChange={(event) => changeBlockType(event.target.value as (typeof blockTypes)[number])} value={blockType}>
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
          ) : canUpload ? <TeacherMediaUploadField kind={blockType as 'AUDIO' | 'VIDEO' | 'IMAGE'} onUploaded={(media: TeacherMediaFile) => setMediaFileId(media.id)} /> : <p className="text-body-sm text-warning-text" role="alert">Fayl yuklash uchun ruxsat mavjud emas.</p>}
          <label className="flex min-h-target items-center gap-3 text-label-md">
            <input checked={isRequired} className="h-5 w-5 accent-action-primary" onChange={(event) => setIsRequired(event.target.checked)} type="checkbox" />
            {messages.required}
          </label>
          <div className="flex flex-wrap gap-2">
            <Button disabled={create.isPending || (blockType !== 'TEXT' && !mediaFileId)} loading={create.isPending} type="submit">{messages.save}</Button>
            <Button intent="secondary" onClick={() => setOpen(false)} type="button">{messages.cancel}</Button>
          </div>
        </form>
      ) : null}
    </div>
  );
}

export default function TeacherLessonDetailPage() {
  const { courseId = '', lessonId = '' } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();
  const auth = useAuth();
  const lesson = useTeacherLesson(courseId, lessonId);
  const blocks = useTeacherLessonBlocks(courseId, lessonId);
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<'content' | 'vocabulary' | 'quiz' | 'results'>('content');
  const canUpdate = auth.status === 'authenticated' && auth.permissions.includes('lessons.update');
  const canCreateBlock = auth.status === 'authenticated' && auth.permissions.includes('lesson_blocks.create');
  const canUpload = auth.status === 'authenticated' && auth.permissions.includes('media.upload');
  const canDuplicate = auth.status === 'authenticated' && auth.permissions.includes('lessons.create');
  const duplicate = useDuplicateTeacherLesson(courseId);

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
        <div className="flex flex-wrap gap-2">
          <Link className="inline-flex min-h-target items-center justify-center rounded-md border border-border-decorative px-4 py-2 text-button text-text-primary transition-colors hover:bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus" to={teacherLessonPaths.preview(courseId, lessonId)}>{messages.previewAsStudent}</Link>
          {canDuplicate ? <Button disabled={duplicate.isPending} intent="secondary" loading={duplicate.isPending} onClick={() => duplicate.mutate(lessonId, { onSuccess: (copied) => navigate(teacherLessonPaths.detail(courseId, copied.id)) })}>{messages.duplicate}</Button> : null}
          {canUpdate && lesson.data.status !== 'PUBLISHED' && lesson.data.status !== 'ARCHIVED' ? (
            <Button intent="secondary" onClick={() => setEditing(true)}>{messages.editTitle}</Button>
          ) : null}
        </div>
      </header>

      <div aria-label="Dars bo‘limlari" className="flex gap-1 overflow-x-auto border-b border-border-decorative pb-px" role="tablist">
        {([['content', 'Kontent'], ['vocabulary', 'Lug‘atlar'], ['quiz', 'Test'], ['results', 'Natijalar']] as const).map(([value, label]) => (
          <button aria-selected={tab === value} className={`min-h-target shrink-0 rounded-t-lg border-b-2 px-4 py-3 text-button transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus motion-reduce:transition-none ${tab === value ? 'border-action-primary-bg bg-nav-selected-bg text-nav-selected-text' : 'border-transparent text-text-secondary hover:bg-subtle hover:text-text-primary'}`} key={value} onClick={() => setTab(value)} role="tab" type="button">{label}</button>
        ))}
      </div>

      {tab === 'content' ? <>
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
            {blocks.data.items.map((block) => <BlockCard block={block} canUpdate={auth.status === 'authenticated' && auth.permissions.includes('lesson_blocks.update')} canUpload={canUpload} courseId={courseId} key={block.id} lessonId={lessonId} />)}
          </div>
        ) : null}
          <NewBlockForm canCreate={canCreateBlock} canUpload={canUpload} courseId={courseId} lessonId={lessonId} />
      </Card>
      </> : null}
      {tab === 'vocabulary' ? <TeacherVocabularyPanel canUpdate={canUpdate} courseId={courseId} lessonId={lessonId} /> : null}
      {tab === 'quiz' ? <TeacherQuizPanel canUpdate={canUpdate} courseId={courseId} lessonId={lessonId} /> : null}
      {tab === 'results' ? <TeacherQuizResultsPanel courseId={courseId} lessonId={lessonId} /> : null}
    </div>
  );
}
