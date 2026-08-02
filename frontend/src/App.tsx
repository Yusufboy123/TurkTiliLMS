import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import {
  authPaths,
  RequireAuthentication,
  RequireAuthorization,
  RequireGuest,
} from './features/auth';
import {
  adminDashboardPaths,
  adminDashboardRequiredPermissions,
  adminDashboardRequiredRoles,
} from './features/admin-dashboard';
import { ProgressSkeleton } from './features/progress/components';
import { progressRouteSegments, progressPaths } from './features/progress/progress.routes';
import { progressReportingPaths } from './features/progress-reporting/progress-reporting.routes';
import { ReportingLayout } from './layouts/ReportingLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { HomePage } from './pages/HomePage';

const StudentDashboardPage = lazy(() => import('./features/progress/pages/StudentDashboardPage'));
const ProgressOverviewPage = lazy(() => import('./features/progress/pages/ProgressOverviewPage'));
const CourseProgressPage = lazy(() => import('./features/progress/pages/CourseProgressPage'));
const CompletedCoursesPage = lazy(() => import('./features/progress/pages/CompletedCoursesPage'));
const ResumeLearningPage = lazy(() => import('./features/progress/pages/ResumeLearningPage'));
const LessonProgressPage = lazy(() => import('./features/progress/pages/LessonProgressPage'));
const TeacherCourseProgressPage = lazy(
  () => import('./features/progress-reporting/pages/TeacherCourseProgressPage'),
);
const AdminProgressPage = lazy(
  () => import('./features/progress-reporting/pages/AdminProgressPage'),
);
const ProgressReportingDetailPage = lazy(
  () => import('./features/progress-reporting/pages/ProgressReportingDetailPage'),
);
const LoginPage = lazy(() => import('./features/auth/pages/LoginPage'));
const TeacherDashboardPage = lazy(
  () => import('./features/teacher-dashboard/pages/TeacherDashboardPage'),
);
const AdminDashboardPage = lazy(
  () => import('./features/admin-dashboard/pages/AdminDashboardPage'),
);

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
        <Route element={<RequireGuest />}>
          <Route path={authPaths.login} element={<LoginPage />} />
        </Route>
        <Route element={<RequireAuthentication />}>
          <Route
            element={
              <RequireAuthorization
                permissions={['courses.read', 'progress.course.read']}
                roles={['TEACHER']}
              />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route path={authPaths.teacherHome} element={<TeacherDashboardPage />} />
            </Route>
          </Route>
          <Route
            element={
              <RequireAuthorization permissions={['progress.self_read']} roles={['STUDENT']} />
            }
          >
            <Route path={progressPaths.dashboard} element={<StudentLayout />}>
              <Route index element={<StudentDashboardPage />} />
              <Route path={progressRouteSegments.overview} element={<ProgressOverviewPage />} />
              <Route path={progressRouteSegments.completed} element={<CompletedCoursesPage />} />
              <Route path={progressRouteSegments.course} element={<CourseProgressPage />} />
              <Route path={progressRouteSegments.resume} element={<ResumeLearningPage />} />
            </Route>
            <Route path={progressPaths.lessonPattern} element={<LessonProgressPage />} />
          </Route>
          <Route
            element={
              <RequireAuthorization
                permissions={['progress.course.read']}
                roles={['ADMIN', 'TEACHER']}
              />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route
                path={progressReportingPaths.teacherCoursePattern}
                element={<TeacherCourseProgressPage />}
              />
              <Route
                path={progressReportingPaths.teacherEnrollmentPattern}
                element={<ProgressReportingDetailPage />}
              />
            </Route>
          </Route>
          <Route
            element={<RequireAuthorization permissions={['progress.read']} roles={['ADMIN']} />}
          >
            <Route element={<ReportingLayout />}>
              <Route path={progressReportingPaths.admin} element={<AdminProgressPage />} />
              <Route
                path={progressReportingPaths.adminEnrollmentPattern}
                element={<ProgressReportingDetailPage admin />}
              />
            </Route>
          </Route>
          <Route
            element={
              <RequireAuthorization
                permissions={[...adminDashboardRequiredPermissions]}
                roles={[...adminDashboardRequiredRoles]}
              />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route path={adminDashboardPaths.dashboard} element={<AdminDashboardPage />} />
            </Route>
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default App;
