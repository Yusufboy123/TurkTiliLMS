import { NavLink, Outlet } from 'react-router-dom';
import { SkipLink } from '../components';
import { authPaths, SessionActions, useAuth } from '../features/auth';
import { adminDashboardPaths, canAccessAdminDashboard } from '../features/admin-dashboard';
import { progressReportingPaths } from '../features/progress-reporting/progress-reporting.routes';
import { useOnlineStatus } from '../hooks/use-online-status';
import { progressReportingMessages } from '../locales/uz-Latn/progress-reporting';
import { teacherDashboardMessages } from '../locales/uz-Latn/teacher-dashboard';
import { adminDashboardMessages } from '../locales/uz-Latn/admin-dashboard';

export function ReportingLayout() {
  const auth = useAuth();
  const isOnline = useOnlineStatus();
  const isAdmin = auth.status === 'authenticated' && auth.roles.includes('ADMIN');
  const canViewAdminDashboard = auth.status === 'authenticated' && canAccessAdminDashboard(auth);

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
          <span className="type-heading-4">Turk Tili LMS</span>
          {isAdmin ? (
            <div className="flex flex-wrap items-center justify-end gap-1">
              {canViewAdminDashboard ? (
                <NavLink
                  className="rounded-md px-3 py-2 text-button text-action-secondary-text no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                  to={adminDashboardPaths.dashboard}
                >
                  {adminDashboardMessages.navigation}
                </NavLink>
              ) : null}
              <NavLink
                className="rounded-md px-3 py-2 text-button text-action-secondary-text no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
                to={progressReportingPaths.admin}
              >
                {progressReportingMessages.title.admin}
              </NavLink>
            </div>
          ) : (
            <NavLink
              className="rounded-md px-3 py-2 text-button text-action-secondary-text no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
              to={authPaths.teacherHome}
            >
              {teacherDashboardMessages.navigation}
            </NavLink>
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
