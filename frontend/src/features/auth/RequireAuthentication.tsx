import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { AuthenticationBootstrap } from './components/AuthenticationBootstrap';
import { useAuth } from './auth-context';

export function RequireAuthentication() {
  const auth = useAuth();
  const location = useLocation();

  if (auth.status === 'bootstrapping') {
    return <AuthenticationBootstrap />;
  }

  if (auth.status === 'unauthenticated') {
    return (
      <Navigate
        replace
        state={{
          reason: auth.reason,
          returnTo: `${location.pathname}${location.search}${location.hash}`,
        }}
        to="/login"
      />
    );
  }

  return <Outlet />;
}
