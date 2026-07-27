import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { RequireAuthentication } from './features/auth';
import { ProgressSkeleton } from './features/progress/components';
import { progressRouteSegments, progressPaths } from './features/progress/progress.routes';
import { StudentLayout } from './layouts/StudentLayout';
import { HomePage } from './pages/HomePage';

const StudentDashboardPage = lazy(() => import('./features/progress/pages/StudentDashboardPage'));
const ProgressOverviewPage = lazy(() => import('./features/progress/pages/ProgressOverviewPage'));
const CourseProgressPage = lazy(() => import('./features/progress/pages/CourseProgressPage'));
const CompletedCoursesPage = lazy(() => import('./features/progress/pages/CompletedCoursesPage'));
const ResumeLearningPage = lazy(() => import('./features/progress/pages/ResumeLearningPage'));
const LessonProgressPage = lazy(() => import('./features/progress/pages/LessonProgressPage'));

function App() {
  return (
    <Suspense
      fallback={
        <main className="mx-auto max-w-dashboard px-4 py-8">
          <ProgressSkeleton />
        </main>
      }
    >
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route element={<RequireAuthentication />}>
          <Route path={progressPaths.dashboard} element={<StudentLayout />}>
            <Route index element={<StudentDashboardPage />} />
            <Route path={progressRouteSegments.overview} element={<ProgressOverviewPage />} />
            <Route path={progressRouteSegments.completed} element={<CompletedCoursesPage />} />
            <Route path={progressRouteSegments.course} element={<CourseProgressPage />} />
            <Route path={progressRouteSegments.resume} element={<ResumeLearningPage />} />
          </Route>
          <Route path={progressPaths.lessonPattern} element={<LessonProgressPage />} />
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
