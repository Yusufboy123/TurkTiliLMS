import { Link } from 'react-router-dom';
import { publicDemoMessages as messages } from '../../../locales/uz-Latn/public-demo';

interface PublicHeaderProps {
  compact?: boolean;
}

export function PublicHeader({ compact = false }: PublicHeaderProps) {
  return (
    <header className="sticky top-0 z-sticky border-b border-border-decorative/80 bg-surface/95 backdrop-blur">
      <div className="mx-auto flex min-h-16 max-w-marketing items-center justify-between gap-4 px-4 md:px-6 lg:px-8">
        <Link
          aria-label={messages.brand.homeLabel}
          className="flex min-h-target items-center gap-3 rounded-md font-semibold text-text-primary no-underline visited:text-text-primary"
          to="/"
        >
          <span
            aria-hidden="true"
            className="grid h-10 w-10 place-items-center rounded-xl bg-action-primary-bg text-lg font-bold text-action-primary-text shadow-subtle"
          >
            T
          </span>
          <span className="hidden sm:inline">{messages.brand.name}</span>
          <span className="sm:hidden">Turk Tili</span>
        </Link>

        {!compact ? (
          <nav aria-label="Asosiy navigatsiya" className="hidden items-center gap-6 md:flex">
            <a
              className="rounded-md text-body-sm text-text-secondary no-underline hover:text-text-primary"
              href="#darajalar"
            >
              {messages.nav.levels}
            </a>
            <a
              className="rounded-md text-body-sm text-text-secondary no-underline hover:text-text-primary"
              href="#yondashuv"
            >
              {messages.nav.method}
            </a>
            <a
              className="rounded-md text-body-sm text-text-secondary no-underline hover:text-text-primary"
              href="#bepul-dars"
            >
              {messages.nav.lesson}
            </a>
          </nav>
        ) : null}

        <Link
          className="inline-flex min-h-target items-center justify-center rounded-lg border border-action-secondary-border bg-action-secondary-bg px-4 py-2 text-button text-action-secondary-text no-underline transition-colors hover:bg-action-secondary-hover-bg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
          to="/login"
        >
          {messages.nav.login}
        </Link>
      </div>
    </header>
  );
}
