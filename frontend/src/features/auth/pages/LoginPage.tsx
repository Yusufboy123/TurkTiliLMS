import { Link, useLocation } from 'react-router-dom';
import { Card, SkipLink } from '../../../components';
import { authMessages } from '../../../locales/uz-Latn/auth';
import type { AuthEndReason } from '../types/auth.types';
import { LoginForm } from '../login/LoginForm';

interface LoginRouteState {
  reason?: AuthEndReason | null;
}

export default function LoginPage() {
  const location = useLocation();
  const routeState = location.state as LoginRouteState | null;
  const reason = routeState?.reason ?? null;
  const registered = new URLSearchParams(location.search).get('registered') === '1';
  const sessionMessage = registered
    ? authMessages.registration.success
    : reason === 'SESSION_EXPIRED'
      ? authMessages.session.expired
      : reason === 'SIGNED_OUT'
        ? authMessages.session.signedOut
        : null;

  return (
    <div className="min-h-screen bg-canvas text-text-primary">
      <SkipLink targetId="main-content" />
      <header className="border-b border-border-decorative/80 bg-surface/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-marketing items-center px-4 md:px-6 lg:px-8">
          <Link
            aria-label={authMessages.brand.homeLabel}
            className="flex min-h-target items-center gap-3 rounded-lg text-heading-4 font-semibold text-text-primary no-underline visited:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-focus"
            to="/"
          >
            <span aria-hidden="true" className="grid h-9 w-9 place-items-center rounded-lg bg-action-primary-bg text-button text-action-primary-text shadow-subtle">T</span>
            {authMessages.brand.name}
          </Link>
        </div>
      </header>

      <main
        className="mx-auto grid min-h-[calc(100vh-8rem)] max-w-[26.25rem] content-center px-4 py-10"
        id="main-content"
        tabIndex={-1}
      >
        <Card className="relative overflow-hidden" padding="lg">
          <div aria-hidden="true" className="absolute inset-x-0 top-0 h-1 bg-action-primary-bg" />
          <h1 className="type-heading-1">{authMessages.login.title}</h1>
          <p className="mt-3 text-body-md text-text-secondary">{authMessages.login.description}</p>

          {sessionMessage ? (
            <p
              className="mt-5 rounded-md border border-info-border bg-info-bg p-3 text-body-sm text-info-text"
              role="status"
            >
              {sessionMessage}
            </p>
          ) : null}

          <div className="mt-6">
            <LoginForm />
          </div>

          <div className="mt-6 space-y-2 border-t border-border-decorative pt-5 text-body-sm text-text-secondary">
            <p>{authMessages.login.recovery}</p>
            <p>{authMessages.login.accountProvisioning}</p>
          </div>
        </Card>
      </main>
    </div>
  );
}
