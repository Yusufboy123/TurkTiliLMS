import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes, matchPath } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { shouldRetryQuery } from '../src/app/query-client';
import { mergeProgressMutation } from '../src/features/progress/hooks/use-progress-mutations';
import {
  enrollmentProgressQueryOptions,
  useEnrollmentProgress,
} from '../src/features/progress/hooks/use-progress-queries';
import { progressQueryKeys } from '../src/features/progress/hooks/progress-query-keys';
import { progressPaths } from '../src/features/progress/progress.routes';
import { StudentLayout } from '../src/layouts/StudentLayout';
import { courseProgressFixture, progressMutationFixture } from './progress-fixtures';

describe('progress React Query integration', () => {
  it('uses stable enrollment-scoped query keys', () => {
    const key = progressQueryKeys.enrollment(courseProgressFixture.enrollmentId);
    expect(key).toEqual(['progress', 'enrollment', courseProgressFixture.enrollmentId, 'detail']);
    expect(enrollmentProgressQueryOptions('').enabled).toBe(false);
  });

  it('renders a query hook from shared cache', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(
      progressQueryKeys.enrollment(courseProgressFixture.enrollmentId),
      courseProgressFixture,
    );

    function HookProbe() {
      const query = useEnrollmentProgress(courseProgressFixture.enrollmentId);
      return <p>{query.data?.course.title}</p>;
    }

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <HookProbe />
      </QueryClientProvider>,
    );
    expect(markup).toContain('Turk tili A1');
  });

  it('merges only authoritative mutation fields and the affected lesson', () => {
    const merged = mergeProgressMutation(courseProgressFixture, progressMutationFixture);
    expect(merged?.completionVersion).toBe(5);
    expect(merged?.sections[0].lessons[0].status).toBe('READY_TO_COMPLETE');
    expect(merged?.sections[0].lessons[0].percentage).toBe(100);
    expect(merged?.totalEligibleBlocks).toBe(courseProgressFixture.totalEligibleBlocks);
  });

  it('retries network and server failures but not client failures', () => {
    expect(shouldRetryQuery(0, { response: undefined })).toBe(true);
    expect(shouldRetryQuery(2, new Error('failure'))).toBe(false);
  });
});

describe('progress routing', () => {
  it('builds stable course, resume, and lesson routes', () => {
    const enrollmentId = courseProgressFixture.enrollmentId;
    const lessonId = courseProgressFixture.sections[0].lessons[0].id;

    expect(progressPaths.course(enrollmentId)).toBe(`/app/progress/${enrollmentId}`);
    expect(progressPaths.resume(enrollmentId)).toBe(`/app/progress/${enrollmentId}/resume`);
    expect(
      matchPath(progressPaths.lessonPattern, progressPaths.lesson(enrollmentId, lessonId)),
    ).toBeTruthy();
  });

  it('renders the responsive student navigation inside the student shell', () => {
    const markup = renderToStaticMarkup(
      <MemoryRouter initialEntries={[progressPaths.overview]}>
        <Routes>
          <Route path="/app" element={<StudentLayout />}>
            <Route path="progress" element={<p>Progress route</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );

    expect(markup).toContain('Talaba navigatsiyasi');
    expect(markup).toContain('Talaba mobil navigatsiyasi');
    expect(markup).toContain('Progress route');
  });
});
