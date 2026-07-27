import { Outlet } from 'react-router-dom';
import { PermissionDeniedState } from '../../components';
import { useAuth } from './auth-context';
import type { RoleCode } from './types/auth.types';

interface RequireAuthorizationProps {
  permissions: string[];
  roles: RoleCode[];
}

export function RequireAuthorization({ permissions, roles }: RequireAuthorizationProps) {
  const auth = useAuth();
  if (auth.status !== 'authenticated') return null;
  const hasRole = roles.some((role) => auth.roles.includes(role));
  const hasPermissions = permissions.every((permission) => auth.permissions.includes(permission));
  return hasRole && hasPermissions ? <Outlet /> : <PermissionDeniedState />;
}
