import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { authMessages } from '../../locales/uz-Latn/auth';
import { useAuth } from './auth-context';

export function RequireAuthentication() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'bootstrapping') {
    return (
      <main
        aria-label={authMessages.bootstrapping}
        className="grid min-h-screen place-items-center bg-canvas text-text-secondary"
        role="status"
      >
        {authMessages.bootstrapping}
      </main>
    );
  }

  if (auth.status === 'unauthenticated') {
    return (
      <Navigate
        replace
        state={{ returnTo: `${location.pathname}${location.search}${location.hash}` }}
        to="/"
      />
    );
  }

  return <Outlet />;
}
