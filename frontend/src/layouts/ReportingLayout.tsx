import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { SkipLink } from '../components';
import { classNames } from '../lib/class-names';
import { authPaths, SessionActions, useAuth } from '../features/auth';
import { adminDashboardPaths, canAccessAdminDashboard } from '../features/admin-dashboard';
import { progressReportingPaths } from '../features/progress-reporting/progress-reporting.routes';
import { useOnlineStatus } from '../hooks/use-online-status';
import { progressReportingMessages } from '../locales/uz-Latn/progress-reporting';
import { teacherDashboardMessages } from '../locales/uz-Latn/teacher-dashboard';
import { adminDashboardMessages } from '../locales/uz-Latn/admin-dashboard';
import { teacherGroupPaths } from '../features/teacher-groups';
import { teacherStudentPaths } from '../features/teacher-students';
import { teacherCoursePaths } from '../features/teacher-courses';
import { adminUsersPaths } from '../features/admin-users';
import { adminActivityPaths } from '../features/admin-activity';
import { NotificationBell } from '../features/notifications';
import { questionAnswerPaths } from '../features/question-answers';

const reportingNavLinkClass = ({ isActive }: { isActive: boolean }) =>
  classNames(
    'relative inline-flex min-h-target items-center rounded-lg px-3 py-2 text-button no-underline transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    isActive
      ? 'bg-nav-selected text-nav-selected-text visited:text-nav-selected-text'
      : 'text-text-secondary visited:text-text-secondary hover:bg-nav-hover hover:text-text-primary',
  );

export function ReportingLayout() {
  const auth = useAuth();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const isAdmin = auth.status === 'authenticated' && auth.roles.includes('ADMIN');
  const canViewAdminDashboard = auth.status === 'authenticated' && canAccessAdminDashboard(auth);
  const isAdminUsersViewActive = (view: 'all' | 'teachers' | 'students') =>
    location.pathname === adminUsersPaths.list &&
    (view === 'all'
      ? !location.search
      : location.search === `?role=${view === 'teachers' ? 'TEACHER' : 'STUDENT'}`);
  const adminUsersNavClass = (view: 'all' | 'teachers' | 'students') =>
    reportingNavLinkClass({ isActive: isAdminUsersViewActive(view) });

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />
      <header className="border-b border-border-decorative bg-surface">
        <nav
          aria-label={
            isAdmin
              ? adminDashboardMessages.navigation
              : progressReportingMessages.navigation.teacher
          }
          className="mx-auto flex min-h-16 max-w-dashboard items-center justify-between gap-4 px-4 md:px-6"
        >
          <Link
            className="flex min-h-target items-center gap-3 rounded-lg px-2 text-heading-4 font-semibold text-text-primary no-underline visited:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            to={isAdmin ? adminDashboardPaths.dashboard : authPaths.teacherHome}
          >
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-action-primary-bg text-button text-action-primary-text shadow-subtle">T</span>
            <span>Turk Tili LMS</span>
          </Link>
          {isAdmin ? (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <Link
                className={adminUsersNavClass('all')}
                to={adminUsersPaths.list}
                aria-current={isAdminUsersViewActive('all') ? 'page' : undefined}
              >
                Foydalanuvchilar
              </Link>
              <Link
                className={adminUsersNavClass('teachers')}
                to={adminUsersPaths.teachers}
                aria-current={isAdminUsersViewActive('teachers') ? 'page' : undefined}
              >
                O‘qituvchilar
              </Link>
              <Link
                className={adminUsersNavClass('students')}
                to={adminUsersPaths.students}
                aria-current={isAdminUsersViewActive('students') ? 'page' : undefined}
              >
                Talabalar
              </Link>
              <NavLink
                className={reportingNavLinkClass}
                to={teacherGroupPaths.list}
              >
                Guruhlar
              </NavLink>
              <NavLink
                className={reportingNavLinkClass}
                to={teacherCoursePaths.list}
              >
                Kurslar
              </NavLink>
              <NavLink
                className={reportingNavLinkClass}
                to={teacherStudentPaths.list}
              >
                Talabalar
              </NavLink>
              {canViewAdminDashboard ? (
                <NavLink
                  className={reportingNavLinkClass}
                  end
                  to={adminDashboardPaths.dashboard}
                >
                  {adminDashboardMessages.navigation}
                </NavLink>
              ) : null}
              {auth.status === 'authenticated' && auth.permissions.includes('audit.read') ? (
                <NavLink className={reportingNavLinkClass} to={adminActivityPaths.list}>
                  Faoliyat tarixi
                </NavLink>
              ) : null}
              <NavLink
                className={reportingNavLinkClass}
                to={progressReportingPaths.admin}
              >
                {progressReportingMessages.title.admin}
              </NavLink>
              <NotificationBell />
            </div>
          ) : (
            <div className="flex flex-wrap items-center justify-end gap-1">
              <NavLink
                className={reportingNavLinkClass}
                end
                to={authPaths.teacherHome}
              >
                {teacherDashboardMessages.navigation}
              </NavLink>
              <NavLink
                className={reportingNavLinkClass}
                to={teacherGroupPaths.list}
              >
                Guruhlar
              </NavLink>
              <NavLink
                className={reportingNavLinkClass}
                to={teacherCoursePaths.list}
              >
                Kurslar
              </NavLink>
              <NavLink
                className={reportingNavLinkClass}
                to={teacherStudentPaths.list}
              >
                Talabalar
              </NavLink>
              <NavLink className={reportingNavLinkClass} to={questionAnswerPaths.teacher}>
                Talabalar savollari
              </NavLink>
              <NotificationBell />
            </div>
          )}
        </nav>
      </header>
      {!isOnline ? (
        <p
          className="border-b border-warning-border bg-warning-bg px-4 py-3 text-center text-body-sm text-warning-text"
          role="status"
        >
          {progressReportingMessages.common.offline}
        </p>
      ) : null}
      <main
        className="mx-auto max-w-dashboard px-4 py-8 md:px-6 lg:px-8"
        id="main-content"
        tabIndex={-1}
      >
        <SessionActions className="mb-6" />
        <Outlet />
      </main>
    </div>
  );
}
