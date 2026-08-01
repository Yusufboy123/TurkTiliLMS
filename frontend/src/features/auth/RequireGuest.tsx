import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { resolveAuthenticatedDestination } from './auth.routes';
import { useAuth } from './auth-context';
import { AuthenticationBootstrap } from './components/AuthenticationBootstrap';

interface GuestRouteState {
  returnTo?: unknown;
}

export function RequireGuest() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'bootstrapping') return <AuthenticationBootstrap />;
  if (auth.status === 'unauthenticated') return <Outlet />;

  const state = location.state as GuestRouteState | null;
  return <Navigate replace to={resolveAuthenticatedDestination(auth, state?.returnTo)} />;
}
