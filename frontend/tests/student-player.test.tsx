import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { progressApi } from '../src/features/progress/api/progress.api';
import { progressQueryKeys } from '../src/features/progress/hooks/progress-query-keys';
import LessonProgressPage from '../src/features/progress/pages/LessonProgressPage';
import StudentCoursePage from '../src/features/student-courses/pages/StudentCoursePage';
import { studentCoursesQueryKeys } from '../src/features/student-courses/hooks/student-courses-query-keys';
import { studentCoursesPaths } from '../src/features/student-courses/student-courses.routes';
import { studentPlayerApi } from '../src/features/student-player/api/student-player.api';
import { studentPlayerQueryKeys } from '../src/features/student-player/hooks/student-player-query-keys';
import { progressPaths } from '../src/features/progress/progress.routes';
import { ToastProvider } from '../src/components';
import { InteractivePracticePanel } from '../src/features/student-player';
import type { StudentEnrollmentPage } from '../src/features/student-courses/types/student-courses.types';
import { courseProgressFixture } from './progress-fixtures';

const mocks = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }));
vi.mock('../src/lib/api-client', () => ({ apiClient: mocks }));

const catalog = {
  items: [{ id: courseProgressFixture.course.id, title: courseProgressFixture.course.title, slug: courseProgressFixture.course.slug, shortDescription: 'A1 kurs', level: 'A1' as const, estimatedDurationMinutes: 60, publishedAt: '2026-07-01T00:00:00.000Z' }],
  pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};
const enrollmentPage: StudentEnrollmentPage = {
  items: [{
    id: courseProgressFixture.enrollmentId,
    courseId: courseProgressFixture.course.id,
    studentId: 'student-1',
    status: 'ACTIVE',
    enrolledAt: '2026-07-01T00:00:00.000Z',
    startedAt: null,
    completedAt: null,
    cancelledAt: null,
    suspendedAt: null,
    createdAt: '2026-07-01T00:00:00.000Z',
    updatedAt: '2026-07-01T00:00:00.000Z',
    course: courseProgressFixture.course,
  }],
  pagination: { page: 1, pageSize: 100, totalItems: 1, totalPages: 1 },
};
const lessonContent = {
  id: courseProgressFixture.sections[0].lessons[0].id,
  courseId: courseProgressFixture.course.id,
  title: 'Salomlashish',
  slug: 'salomlashish',
  summary: 'Qisqa kirish.',
  content: null,
  lessonType: 'VIDEO' as const,
  durationMinutes: 5,
  isPreview: false,
  publishedAt: '2026-07-02T00:00:00.000Z',
  section: { id: 'section-1', title: 'Kirish' },
};
const contentBlocks = [
  {
    id: 'block-video', mediaFileId: 'media-video', media: { id: 'media-video', originalFileName: 'lesson.mp4', mimeType: 'video/mp4', extension: 'mp4', category: 'VIDEO' as const, sizeBytes: '10', checksum: null, storageProvider: 'LOCAL' as const, downloadUrl: '/api/v1/media/media-video/download', previewUrl: '/api/v1/media/media-video/download', deletedAt: null }, blockType: 'VIDEO' as const, title: 'Video', description: null, position: 1, isRequired: true, textContent: null, sourceUrl: null, externalProvider: null, fileName: null, fileUrl: null, mimeType: 'video/mp4', fileSizeBytes: '10', durationSeconds: 30, thumbnailUrl: null,
  },
  {
    id: 'block-audio', mediaFileId: 'media-audio', media: { id: 'media-audio', originalFileName: 'lesson.mp3', mimeType: 'audio/mpeg', extension: 'mp3', category: 'AUDIO' as const, sizeBytes: '10', checksum: null, storageProvider: 'LOCAL' as const, downloadUrl: '/api/v1/media/media-audio/download', previewUrl: '/api/v1/media/media-audio/download', deletedAt: null }, blockType: 'AUDIO' as const, title: 'Audio', description: null, position: 2, isRequired: false, textContent: null, sourceUrl: null, externalProvider: null, fileName: null, fileUrl: null, mimeType: 'audio/mpeg', fileSizeBytes: '10', durationSeconds: 20, thumbnailUrl: null,
  },
  {
    id: 'block-text', mediaFileId: null, media: null, blockType: 'TEXT' as const, title: 'Matn', description: null, position: 3, isRequired: true, textContent: 'Merhaba!', sourceUrl: null, externalProvider: null, fileName: null, fileUrl: null, mimeType: null, fileSizeBytes: null, durationSeconds: null, thumbnailUrl: null,
  },
];

describe('student lesson player', () => {
  it('reuses catalog content and completion APIs', async () => {
    mocks.get
      .mockResolvedValueOnce({ data: { data: lessonContent } })
      .mockResolvedValueOnce({ data: { data: contentBlocks } });
    mocks.post.mockResolvedValueOnce({ data: { data: { changed: true } } });
    await studentPlayerApi.getLesson('turk-tili-a1', 'salomlashish');
    await studentPlayerApi.getBlocks('turk-tili-a1', 'salomlashish');
    await progressApi.completeLesson(courseProgressFixture.enrollmentId, lessonContent.id, { expectedCompletionVersion: 4, curriculumVersion: 3 }, 'player-key');
    expect(mocks.get).toHaveBeenNthCalledWith(1, '/catalog/courses/turk-tili-a1/lessons/salomlashish');
    expect(mocks.get).toHaveBeenNthCalledWith(2, '/catalog/courses/turk-tili-a1/lessons/salomlashish/blocks');
    expect(mocks.post).toHaveBeenCalledWith(`/me/enrollments/${courseProgressFixture.enrollmentId}/progress/lessons/${lessonContent.id}/complete`, { expectedCompletionVersion: 4, curriculumVersion: 3 }, { headers: { 'Idempotency-Key': 'player-key' } });
  });

  it('renders enrolled course progress and canonical lesson navigation', () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(studentCoursesQueryKeys.catalog(), catalog);
    client.setQueryData(studentCoursesQueryKeys.enrollments(), enrollmentPage);
    client.setQueryData(progressQueryKeys.enrollment(courseProgressFixture.enrollmentId), courseProgressFixture);
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[studentCoursesPaths.course(courseProgressFixture.course.id)]}>
          <Routes><Route path={studentCoursesPaths.coursePattern} element={<StudentCoursePage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(markup).toContain('Turk tili A1');
    expect(markup).toContain('Salomlashish');
    expect(markup).toContain(progressPaths.lesson(courseProgressFixture.enrollmentId, courseProgressFixture.sections[0].lessons[0].id));
    expect(markup).toContain('Davom ettirish');
  });

  it('does not open a course when the student has no enrollment', () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(studentCoursesQueryKeys.catalog(), catalog);
    client.setQueryData(studentCoursesQueryKeys.enrollments(), { ...enrollmentPage, items: [], pagination: { ...enrollmentPage.pagination, totalItems: 0 } });
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[studentCoursesPaths.course(courseProgressFixture.course.id)]}>
          <Routes><Route path={studentCoursesPaths.coursePattern} element={<StudentCoursePage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(markup).toContain('Kursga kirish cheklangan');
    expect(markup).not.toContain('Salomlashish');
  });

  it('renders TEXT, VIDEO, and AUDIO blocks with accessible media controls', () => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });
    client.setQueryData(progressQueryKeys.enrollment(courseProgressFixture.enrollmentId), courseProgressFixture);
    client.setQueryData(studentPlayerQueryKeys.lesson(courseProgressFixture.course.slug, lessonContent.slug), lessonContent);
    client.setQueryData(studentPlayerQueryKeys.blocks(courseProgressFixture.course.slug, lessonContent.slug), contentBlocks);
    client.setQueryData(['student-media-url', 'media-video'], { url: '/api/v1/media/student/media-video?token=video-token' });
    client.setQueryData(['student-media-url', 'media-audio'], { url: '/api/v1/media/student/media-audio?token=audio-token' });
    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[progressPaths.lesson(courseProgressFixture.enrollmentId, lessonContent.id)]}>
          <ToastProvider><Routes><Route path={progressPaths.lessonPattern} element={<LessonProgressPage />} /></Routes></ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(markup).toContain('Merhaba!');
    expect(markup).toContain('<video');
    expect(markup).toContain('<audio');
    expect(markup).toContain('aria-label="Video"');
    expect(markup).toContain('aria-label="Audio"');
    expect(markup).toContain('Matn');
  });

  it('renders reusable interactive practice controls for each supported type', () => {
    const markup = renderToStaticMarkup(<QueryClientProvider client={new QueryClient()}><InteractivePracticePanel enabled enrollmentId="enrollment-1" lessonId="lesson-1" blocks={[{
      ...contentBlocks[2],
      interactivePractice: [
        { id: 'mc', type: 'MULTIPLE_CHOICE', prompt: 'Tanlang', options: ['A', 'B'], explanation: 'Izoh', stage: 1 },
        { id: 'tf', type: 'TRUE_FALSE', prompt: 'To‘g‘rimi?', options: ['To‘g‘ri', 'Noto‘g‘ri'], explanation: 'Izoh', stage: 2 },
        { id: 'missing', type: 'MISSING_WORD', prompt: 'Yozing', explanation: 'Izoh', stage: 3 },
        { id: 'classify', type: 'CLASSIFY', prompt: 'Tasniflang', options: ['Qalin', 'Ingichka'], explanation: 'Izoh', stage: 4 },
      ],
    }]} /></QueryClientProvider>);
    expect(markup).toContain('Qoidani amalda sinab ko‘ring');
    expect(markup).toContain('Tanlang');
    expect(markup).toContain('Yozing');
    expect(markup.match(/Javobni tekshirish/g)?.length).toBe(4);
    expect(markup).toContain('type="radio"');
    expect(markup).toContain('aria-label="Mashq 3 javobi"');
  });
});
