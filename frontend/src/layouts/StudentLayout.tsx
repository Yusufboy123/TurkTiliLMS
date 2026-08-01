import { NavLink, Outlet } from 'react-router-dom';
import { SkipLink } from '../components';
import { useOnlineStatus } from '../hooks/use-online-status';
import { classNames } from '../lib/class-names';
import { progressMessages } from '../locales/uz-Latn/progress';
import { progressPaths } from '../features/progress/progress.routes';
import { SessionActions } from '../features/auth';

const navigation = [
  {
    label: progressMessages.navigation.dashboard,
    shortLabel: 'Bosh',
    to: progressPaths.dashboard,
    end: true,
  },
  {
    label: progressMessages.navigation.progress,
    shortLabel: 'Jarayon',
    to: progressPaths.overview,
    end: false,
  },
  {
    label: progressMessages.navigation.completed,
    shortLabel: 'Yakun',
    to: progressPaths.completed,
    end: true,
  },
] as const;

function NavigationItems({ compact = false }: { compact?: boolean }) {
  return navigation.map((item, index) => (
    <NavLink
      aria-label={item.label}
      className={({ isActive }) =>
        classNames(
          'relative flex min-h-target items-center rounded-md px-3 py-2 text-label-md no-underline visited:text-text-secondary',
          compact
            ? 'flex-col justify-center gap-1 text-center text-caption lg:flex-row lg:justify-start lg:gap-3 lg:text-left lg:text-label-md'
            : 'gap-3',
          isActive
            ? 'bg-nav-selected text-nav-selected-text visited:text-nav-selected-text'
            : 'text-text-secondary hover:bg-nav-hover-bg',
        )
      }
      end={item.end}
      key={item.to}
      title={compact ? item.label : undefined}
      to={item.to}
    >
      <span
        aria-hidden="true"
        className="grid h-6 w-6 shrink-0 place-items-center rounded-full border border-current text-caption"
      >
        {index + 1}
      </span>
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
          <NavLink
            className="text-heading-4 font-semibold text-text-primary no-underline visited:text-text-primary"
            to={progressPaths.dashboard}
          >
            {progressMessages.appName}
          </NavLink>
        </div>
      </header>

      <aside
        aria-label={progressMessages.navigation.student}
        className="fixed inset-y-0 left-0 z-sticky hidden w-[4.5rem] border-r border-border-decorative bg-surface pt-20 md:block lg:w-64"
      >
        <nav className="flex flex-col gap-2 px-2 lg:px-4">
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
        className="safe-area-bottom fixed inset-x-0 bottom-0 z-sticky grid grid-cols-3 border-t border-border-decorative bg-surface px-2 py-2 shadow-navigation md:hidden"
      >
        <NavigationItems compact />
      </nav>
    </div>
  );
}
