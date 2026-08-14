import { Link, NavLink, Outlet } from 'react-router-dom';
import { SkipLink } from '../components';
import { useOnlineStatus } from '../hooks/use-online-status';
import { classNames } from '../lib/class-names';
import { progressMessages } from '../locales/uz-Latn/progress';
import { progressPaths } from '../features/progress/progress.routes';
import { SessionActions } from '../features/auth';
import { NotificationBell } from '../features/notifications';
import { studentProductivityPaths } from '../features/student-productivity';
import { questionAnswerPaths } from '../features/question-answers';

const navigation = [
  {
    icon: 'home',
    label: progressMessages.navigation.dashboard,
    shortLabel: 'Bosh',
    to: progressPaths.dashboard,
    end: true,
  },
  {
    icon: 'courses',
    label: progressMessages.navigation.courses,
    shortLabel: 'Kurslar',
    to: progressPaths.courses,
    end: true,
  },
  {
    icon: 'progress',
    label: progressMessages.navigation.progress,
    shortLabel: 'Jarayon',
    to: progressPaths.overview,
    end: false,
  },
  {
    icon: 'completed',
    label: progressMessages.navigation.completed,
    shortLabel: 'Yakun',
    to: progressPaths.completed,
    end: true,
  },
  { icon: 'bookmarks', label: 'Saqlanganlar', shortLabel: 'Saqlangan', to: studentProductivityPaths.bookmarks, end: true },
  { icon: 'questions', label: 'Savollarim', shortLabel: 'Savollar', to: questionAnswerPaths.student, end: true },
] as const;

type StudentNavIconName = (typeof navigation)[number]['icon'];

function StudentNavIcon({ name }: { name: StudentNavIconName }) {
  const paths: Record<StudentNavIconName, string> = {
    home: 'M3 10.5 12 3l9 7.5M5.5 9v11h13V9M9 20v-6h6v6',
    courses: 'M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5v-15ZM4 20.5A2.5 2.5 0 0 1 6.5 18H20',
    progress: 'M4 19V5m0 14h16M8 16v-4m4 4V8m4 8V6',
    completed: 'M12 3.5 14.6 9l5.9.7-4.4 4.1 1.1 5.8-5.2-2.9-5.2 2.9 1.1-5.8-4.4-4.1L9.4 9 12 3.5Z',
    bookmarks: 'M6 4.5A2.5 2.5 0 0 1 8.5 2h7A2.5 2.5 0 0 1 18 4.5V21l-6-3.5L6 21V4.5Z',
    questions: 'M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H11l-4.5 4v-4H6.5A2.5 2.5 0 0 1 4 13.5v-8Z',
  };

  return (
    <svg aria-hidden="true" className="h-5 w-5 shrink-0" fill="none" viewBox="0 0 24 24">
      <path d={paths[name]} stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" />
    </svg>
  );
}

function NavigationItems({ compact = false }: { compact?: boolean }) {
  return navigation.map((item) => (
    <NavLink
      aria-label={item.label}
      className={({ isActive }) =>
        classNames(
          'relative flex min-h-target items-center rounded-xl px-3 py-2.5 text-label-md no-underline transition-colors duration-150 motion-reduce:transition-none visited:text-text-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus',
          compact
            ? 'flex-col justify-center gap-1 text-center text-caption lg:flex-row lg:justify-start lg:gap-3 lg:text-left lg:text-label-md'
          : 'gap-3',
          isActive
            ? 'bg-nav-selected text-nav-selected-text visited:text-nav-selected-text md:before:absolute md:before:inset-y-2 md:before:left-0 md:before:w-0.5 md:before:rounded-full md:before:bg-nav-indicator'
            : 'text-text-secondary hover:bg-nav-hover hover:text-text-primary',
        )
      }
      end={item.end}
      key={item.to}
      title={compact ? item.label : undefined}
      to={item.to}
    >
      <StudentNavIcon name={item.icon} />
      {compact ? (
        <span>
          <span className="lg:hidden">{item.shortLabel}</span>
          <span className="hidden lg:inline">{item.label}</span>
        </span>
      ) : (
        <span>{item.label}</span>
      )}
    </NavLink>
  ));
}

export function StudentLayout() {
  const isOnline = useOnlineStatus();

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />

      <header className="fixed inset-x-0 top-0 z-sticky border-b border-border-decorative bg-surface md:left-[4.5rem] lg:left-64">
        <div className="mx-auto flex h-16 max-w-dashboard items-center px-4 md:px-6 lg:px-8">
          <Link
            className="flex min-h-target items-center gap-3 rounded-lg px-2 text-heading-4 font-semibold text-text-primary no-underline visited:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            to={progressPaths.dashboard}
          >
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-action-primary-bg text-button text-action-primary-text shadow-subtle">T</span>
            {progressMessages.appName}
          </Link>
          <NotificationBell />
        </div>
      </header>

      <aside
        aria-label={progressMessages.navigation.student}
        className="fixed inset-y-0 left-0 z-sticky hidden w-[4.5rem] border-r border-border-decorative bg-surface pt-4 md:block lg:w-64"
      >
        <Link
          aria-label="Bosh sahifaga o‘tish"
          className="mx-auto flex min-h-target items-center justify-center gap-2 rounded-lg px-2 text-text-primary no-underline visited:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus lg:mx-0 lg:justify-start lg:px-3"
          to={progressPaths.dashboard}
        >
          <span aria-hidden="true" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-action-primary-bg text-button text-action-primary-text shadow-subtle">T</span>
          <span className="hidden text-label-md font-semibold lg:inline">Turk Tili</span>
        </Link>
        <nav className="mt-5 flex flex-col gap-2 px-2 lg:px-4">
          <NavigationItems compact />
        </nav>
      </aside>

      <div className="pb-24 pt-16 md:ml-[4.5rem] md:pb-0 lg:ml-64">
        {!isOnline ? (
          <div
            className="border-b border-warning-border bg-warning-bg px-4 py-3 text-center text-body-sm text-warning-text"
            role="status"
          >
            {progressMessages.common.offline}
          </div>
        ) : null}
        <main
          className="mx-auto min-h-[calc(100vh-4rem)] max-w-dashboard px-4 py-8 md:px-6 lg:px-8 lg:py-10"
          id="main-content"
          tabIndex={-1}
        >
          <SessionActions className="mb-6" />
          <Outlet />
        </main>
      </div>

      <nav
        aria-label={progressMessages.navigation.studentMobile}
        className="safe-area-bottom fixed inset-x-0 bottom-0 z-sticky grid grid-cols-6 border-t border-border-decorative bg-surface/95 px-2 py-2 shadow-navigation backdrop-blur md:hidden"
      >
        <NavigationItems compact />
      </nav>
    </div>
  );
}
