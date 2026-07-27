import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { ToastProvider } from '../src/components';
import {
  BlockStatusIndicator,
  CompletedCourseCard,
  LessonProgressCard,
  LessonStatusBadge,
  ProgressBar,
  ProgressCard,
  ProgressEmptyState,
  ProgressError,
  ProgressRing,
  ProgressSkeleton,
  ProgressStatistics,
  ProgressSummary,
  ResumeLearningCard,
} from '../src/features/progress/components';
import LessonProgressPage from '../src/features/progress/pages/LessonProgressPage';
import ProgressOverviewPage from '../src/features/progress/pages/ProgressOverviewPage';
import { progressQueryKeys } from '../src/features/progress/hooks/progress-query-keys';
import {
  completedCoursesFixture,
  courseProgressFixture,
  progressSummaryFixture,
} from './progress-fixtures';

function withinRouter(node: React.ReactNode) {
  return renderToStaticMarkup(<MemoryRouter>{node}</MemoryRouter>);
}

describe('progress presentation components', () => {
  it('renders accessible linear and circular progress with equivalent text', () => {
    const markup = renderToStaticMarkup(
      <>
        <ProgressBar label="Kurs jarayoni" value={45} />
        <ProgressRing label="Turk tili A1" value={45} />
      </>,
    );

    expect(markup).toContain('<progress');
    expect(markup).toContain('value="45"');
    expect(markup).toContain('role="progressbar"');
    expect(markup).toContain('aria-valuenow="45"');
    expect(markup).toContain('45%');
  });

  it('renders status meaning as text rather than color alone', () => {
    const lesson = courseProgressFixture.sections[0].lessons[0];
    const markup = renderToStaticMarkup(
      <>
        <LessonStatusBadge status={lesson.status} />
        <BlockStatusIndicator block={lesson.blocks[0]} />
      </>,
    );

    expect(markup).toContain('Jarayonda');
    expect(markup).toContain('Majburiy');
  });

  it('renders all student progress card variants from authoritative DTO values', () => {
    const lesson = courseProgressFixture.sections[0].lessons[0];
    const markup = withinRouter(
      <>
        <ProgressCard progress={courseProgressFixture} />
        <ProgressSummary progress={courseProgressFixture} />
        <LessonProgressCard enrollmentId={courseProgressFixture.enrollmentId} lesson={lesson} />
        <ResumeLearningCard resume={courseProgressFixture.resumeTarget!} />
        <CompletedCourseCard course={completedCoursesFixture.items[0]} />
        <ProgressStatistics activeCourseCount={1} completedCourseCount={1} />
      </>,
    );

    expect(markup).toContain('Turk tili A1');
    expect(markup).toContain('Salomlashish');
    expect(markup).toContain('Turk tili kirish kursi');
    expect(markup).toContain('O‘qishni davom ettiring');
  });

  it('renders loading, empty, and retryable error states accessibly', () => {
    const markup = renderToStaticMarkup(
      <>
        <ProgressSkeleton cards={1} />
        <ProgressEmptyState body="Hali ma’lumot yo‘q." title="Bo‘sh holat" />
        <ProgressError error={new Error('failure')} onRetry={() => undefined} />
      </>,
    );

    expect(markup).toContain('role="status"');
    expect(markup).toContain('Bo‘sh holat');
    expect(markup).toContain('role="alert"');
    expect(markup).toContain('Qayta urinish');
  });
});

describe('progress page integration', () => {
  it('renders the overview from React Query cache without calculating progress locally', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(progressQueryKeys.summary(5), progressSummaryFixture);

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter>
          <ProgressOverviewPage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(markup).toContain('Jarayonim');
    expect(markup).toContain('Turk tili A1');
    expect(markup).not.toContain('streak');
  });

  it('renders the lesson progress route from the enrollment-scoped query cache', () => {
    const client = new QueryClient({
      defaultOptions: { queries: { staleTime: Infinity, retry: false } },
    });
    client.setQueryData(
      progressQueryKeys.enrollment(courseProgressFixture.enrollmentId),
      courseProgressFixture,
    );

    const markup = renderToStaticMarkup(
      <QueryClientProvider client={client}>
        <MemoryRouter
          initialEntries={[
            `/learn/${courseProgressFixture.enrollmentId}/lessons/${courseProgressFixture.sections[0].lessons[0].id}`,
          ]}
        >
          <ToastProvider>
            <Routes>
              <Route
                element={<LessonProgressPage />}
                path="/learn/:enrollmentId/lessons/:lessonId"
              />
            </Routes>
          </ToastProvider>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    expect(markup).toContain('Salomlashish');
    expect(markup).toContain('Salomlashish videosi');
    expect(markup).toContain('Materialni tugallash');
    expect(markup).not.toContain('Talaba mobil navigatsiyasi');
  });
});
