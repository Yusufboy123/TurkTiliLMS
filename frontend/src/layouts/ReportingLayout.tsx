import { useState } from 'react';
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

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  classNames(
    'relative inline-flex min-h-[2.25rem] items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium no-underline transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
    isActive
      ? 'bg-nav-selected text-nav-selected-text visited:text-nav-selected-text after:absolute after:inset-x-0 after:bottom-[-1px] after:h-0.5 after:bg-nav-selected-indicator after:rounded-t-full'
      : 'text-text-secondary visited:text-text-secondary hover:bg-nav-hover hover:text-text-primary',
  );

/* ── Mobile drawer ─────────────────────────────────────────────────── */
function MobileNavDrawer({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  if (!open) return null;
  return (
    <>
      {/* backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40"
        aria-hidden="true"
        onClick={onClose}
      />
      {/* panel */}
      <nav
        aria-label="Mobil navigatsiya"
        className="fixed inset-y-0 left-0 z-50 flex w-72 flex-col gap-1 overflow-y-auto border-r border-border-decorative bg-surface p-4 shadow-xl"
      >
        <div className="mb-4 flex items-center justify-between">
          <span className="text-base font-bold tracking-tight text-text-primary">Turk Tili LMS</span>
          <button
            aria-label="Menyuni yopish"
            className="rounded-md p-1.5 text-text-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus"
            onClick={onClose}
          >
            <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {children}
      </nav>
    </>
  );
}

export function ReportingLayout() {
  const auth = useAuth();
  const location = useLocation();
  const isOnline = useOnlineStatus();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isAdmin = auth.status === 'authenticated' && auth.roles.includes('ADMIN');
  const canViewAdminDashboard = auth.status === 'authenticated' && canAccessAdminDashboard(auth);
  const canAudit = auth.status === 'authenticated' && auth.permissions.includes('audit.read');

  const isAdminUsersViewActive = (view: 'all' | 'teachers' | 'students') =>
    location.pathname === adminUsersPaths.list &&
    (view === 'all'
      ? !location.search
      : location.search === `?role=${view === 'teachers' ? 'TEACHER' : 'STUDENT'}`);

  const adminUsersNavClass = (view: 'all' | 'teachers' | 'students') =>
    navLinkClass({ isActive: isAdminUsersViewActive(view) });

  /* shared nav items */
  const adminNavItems = (
    <>
      <Link className={adminUsersNavClass('all')} to={adminUsersPaths.list} aria-current={isAdminUsersViewActive('all') ? 'page' : undefined}>
        Foydalanuvchilar
      </Link>
      <NavLink className={navLinkClass} to={teacherGroupPaths.list}>Guruhlar</NavLink>
      <NavLink className={navLinkClass} to={teacherCoursePaths.list}>Kurslar</NavLink>
      <NavLink className={navLinkClass} to={teacherStudentPaths.list}>Talabalar</NavLink>
      {canViewAdminDashboard && (
        <NavLink className={navLinkClass} end to={adminDashboardPaths.dashboard}>
          {adminDashboardMessages.navigation}
        </NavLink>
      )}
      {canAudit && (
        <NavLink className={navLinkClass} to={adminActivityPaths.list}>Faoliyat</NavLink>
      )}
      <NavLink className={navLinkClass} to={progressReportingPaths.admin}>
        {progressReportingMessages.title.admin}
      </NavLink>
    </>
  );

  const teacherNavItems = (
    <>
      <NavLink className={navLinkClass} end to={authPaths.teacherHome}>
        {teacherDashboardMessages.navigation}
      </NavLink>
      <NavLink className={navLinkClass} to={teacherGroupPaths.list}>Guruhlar</NavLink>
      <NavLink className={navLinkClass} to={teacherCoursePaths.list}>Kurslar</NavLink>
      <NavLink className={navLinkClass} to={teacherStudentPaths.list}>Talabalar</NavLink>
      <NavLink className={navLinkClass} to={questionAnswerPaths.teacher}>Savollar</NavLink>
    </>
  );

  const activeItems = isAdmin ? adminNavItems : teacherNavItems;
  const homeLink = isAdmin ? adminDashboardPaths.dashboard : authPaths.teacherHome;
  const navLabel = isAdmin ? adminDashboardMessages.navigation : progressReportingMessages.navigation.teacher;
  const roleLabel = isAdmin ? 'Admin' : "O'qituvchi";

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />

      {/* ── HEADER ───────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border-decorative bg-surface/95 shadow-sm backdrop-blur-md">
        <nav
          aria-label={navLabel}
          className="mx-auto flex h-14 max-w-dashboard items-center justify-between gap-4 px-4 md:px-6"
        >
          {/* brand */}
          <Link
            className="flex shrink-0 items-center gap-2.5 rounded-md font-bold text-text-primary no-underline visited:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            to={homeLink}
          >
            <span aria-hidden="true" className="grid h-8 w-8 place-items-center rounded-md bg-action-primary-bg text-xs font-extrabold text-action-primary-text shadow-sm">
              T
            </span>
            <span className="hidden text-sm tracking-tight sm:block">Turk Tili LMS</span>
            <span className="ml-1 hidden rounded-full bg-subtle px-2 py-0.5 text-xs font-semibold text-text-muted lg:inline-block">
              {roleLabel}
            </span>
          </Link>

          {/* desktop nav */}
          <div className="hidden min-w-0 flex-1 items-center justify-center gap-0.5 md:flex">
            {activeItems}
          </div>

          {/* right side */}
          <div className="flex shrink-0 items-center gap-2">
            <NotificationBell />
            {/* mobile hamburger */}
            <button
              aria-label="Menyuni ochish"
              className="rounded-md p-2 text-text-muted hover:bg-subtle focus-visible:ring-2 focus-visible:ring-focus md:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        </nav>
      </header>

      {/* ── MOBILE DRAWER ────────────────────────────────────────── */}
      <MobileNavDrawer open={mobileOpen} onClose={() => setMobileOpen(false)}>
        {activeItems}
      </MobileNavDrawer>

      {/* ── OFFLINE BANNER ───────────────────────────────────────── */}
      {!isOnline && (
        <p
          className="border-b border-warning-border bg-warning-bg px-4 py-2.5 text-center text-sm text-warning-text"
          role="status"
        >
          {progressReportingMessages.common.offline}
        </p>
      )}

      {/* ── MAIN ─────────────────────────────────────────────────── */}
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
