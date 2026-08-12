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
import { AdminActivityPage, adminActivityPaths } from './features/admin-activity';
import { ProgressSkeleton } from './features/progress/components';
import { progressRouteSegments, progressPaths } from './features/progress/progress.routes';
import { progressReportingPaths } from './features/progress-reporting/progress-reporting.routes';
import { AdminUserDetailPage, AdminUsersPage, adminUsersPaths } from './features/admin-users';
import { ReportingLayout } from './layouts/ReportingLayout';
import { StudentLayout } from './layouts/StudentLayout';
import { PublicLandingPage, TurkAlphabetDemoPage } from './features/public-demo';
import { StudentCoursePage, StudentCoursesPage, studentCoursesPaths } from './features/student-courses';
import {
  StudentOnboardingPage,
  StudentProfileGate,
  studentProfilePaths,
} from './features/student-profile';
import {
  TeacherGroupDetailPage,
  TeacherGroupsPage,
  teacherGroupPaths,
} from './features/teacher-groups';
import {
  TeacherStudentDetailPage,
  TeacherStudentsPage,
  teacherStudentPaths,
} from './features/teacher-students';
import {
  TeacherCourseDetailPage,
  TeacherCourseEditorPage,
  TeacherCoursesPage,
  teacherCoursePaths,
} from './features/teacher-courses';
import {
  TeacherLessonDetailPage,
  TeacherLessonEditorPage,
  TeacherLessonPreviewPage,
  TeacherLessonsPage,
  teacherLessonPaths,
} from './features/teacher-lessons';
import { StudentBookmarksPage, studentProductivityPaths } from './features/student-productivity';

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
const RegisterPage = lazy(() => import('./features/auth/register/RegisterPage'));
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
        <Route path="/" element={<PublicLandingPage />} />
        <Route path="/demo/turk-alfabesi" element={<TurkAlphabetDemoPage />} />
        <Route element={<RequireGuest />}>
          <Route path={authPaths.login} element={<LoginPage />} />
          <Route path={authPaths.register} element={<RegisterPage />} />
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
              <RequireAuthorization
                permissions={['progress.course.read']}
                roles={['ADMIN', 'TEACHER']}
              />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route path={teacherStudentPaths.list} element={<TeacherStudentsPage />} />
              <Route
                path={teacherStudentPaths.detailPattern}
                element={<TeacherStudentDetailPage />}
              />
            </Route>
          </Route>
          <Route
            element={
              <RequireAuthorization permissions={['courses.read']} roles={['ADMIN', 'TEACHER']} />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route path={teacherCoursePaths.list} element={<TeacherCoursesPage />} />
              <Route path={teacherCoursePaths.new} element={<TeacherCourseEditorPage />} />
              <Route path={teacherCoursePaths.detailPattern} element={<TeacherCourseDetailPage />} />
            </Route>
          </Route>
          <Route
            element={
              <RequireAuthorization
                permissions={['sections.read', 'lessons.read']}
                roles={['ADMIN', 'TEACHER']}
              />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route path={teacherLessonPaths.listPattern} element={<TeacherLessonsPage />} />
              <Route path={teacherLessonPaths.newPattern} element={<TeacherLessonEditorPage />} />
              <Route path={teacherLessonPaths.previewPattern} element={<TeacherLessonPreviewPage />} />
              <Route path={teacherLessonPaths.detailPattern} element={<TeacherLessonDetailPage />} />
            </Route>
          </Route>
          <Route
            element={
              <RequireAuthorization permissions={['progress.self_read']} roles={['STUDENT']} />
            }
          >
            <Route element={<StudentProfileGate />}>
              <Route path={studentProfilePaths.onboarding} element={<StudentLayout />}>
                <Route index element={<StudentOnboardingPage />} />
              </Route>
              <Route path={progressPaths.dashboard} element={<StudentLayout />}>
                <Route index element={<StudentDashboardPage />} />
                <Route path={progressRouteSegments.overview} element={<ProgressOverviewPage />} />
                <Route path={progressRouteSegments.completed} element={<CompletedCoursesPage />} />
                <Route path={progressRouteSegments.course} element={<CourseProgressPage />} />
                <Route path={progressRouteSegments.resume} element={<ResumeLearningPage />} />
              </Route>
              <Route path={studentProductivityPaths.bookmarks} element={<StudentLayout />}>
                <Route index element={<StudentBookmarksPage />} />
              </Route>
              <Route path={progressPaths.lessonPattern} element={<LessonProgressPage />} />
            </Route>
          </Route>
          <Route
            element={
              <RequireAuthorization
                permissions={['enrollments.self_create', 'enrollments.self_read']}
                roles={['STUDENT']}
              />
            }
          >
            <Route element={<StudentProfileGate />}>
              <Route path={studentCoursesPaths.list} element={<StudentLayout />}>
                <Route index element={<StudentCoursesPage />} />
                <Route path={studentCoursesPaths.coursePattern.replace('/app/courses/', '')} element={<StudentCoursePage />} />
              </Route>
            </Route>
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
            element={
              <RequireAuthorization
                permissions={['groups.read', 'groups.create', 'groups.update_members']}
                roles={['ADMIN', 'TEACHER']}
              />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route path={teacherGroupPaths.list} element={<TeacherGroupsPage />} />
              <Route path={teacherGroupPaths.detailPattern} element={<TeacherGroupDetailPage />} />
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
          <Route element={<RequireAuthorization permissions={['audit.read']} roles={['ADMIN']} />}>
            <Route element={<ReportingLayout />}>
              <Route path={adminActivityPaths.list} element={<AdminActivityPage />} />
            </Route>
          </Route>
          <Route
            element={
              <RequireAuthorization
                permissions={['users.read', 'roles.assign']}
                roles={['ADMIN']}
              />
            }
          >
            <Route element={<ReportingLayout />}>
              <Route path={adminUsersPaths.list} element={<AdminUsersPage />} />
              <Route path={adminUsersPaths.detailPattern} element={<AdminUserDetailPage />} />
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
