import type { AuthenticatedSession } from './types/auth.types';

export const authPaths = {
  login: '/login',
  studentHome: '/app',
  teacherHome: '/teacher',
  adminHome: '/admin/progress',
} as const;

function hasPermission(session: AuthenticatedSession, permission: string): boolean {
  return session.permissions.includes(permission);
}

function hasRole(session: AuthenticatedSession, role: 'ADMIN' | 'TEACHER'): boolean {
  return session.roles.includes(role);
}

export function defaultAuthenticatedPath(session: AuthenticatedSession): string {
  if (hasRole(session, 'ADMIN') && hasPermission(session, 'progress.read')) {
    return authPaths.adminHome;
  }

  if (hasRole(session, 'TEACHER')) {
    return authPaths.teacherHome;
  }

  if (session.roles.includes('STUDENT') && hasPermission(session, 'progress.self_read')) {
    return authPaths.studentHome;
  }

  return '/';
}

function isSafeLocalPath(path: string): boolean {
  return path.startsWith('/') && !path.startsWith('//') && !path.includes('\\');
}

function canAccessReturnPath(session: AuthenticatedSession, path: string): boolean {
  const pathname = path.split(/[?#]/, 1)[0] ?? '';

  if (pathname === authPaths.login || pathname === '/') return false;
  if (pathname === authPaths.teacherHome) return hasRole(session, 'TEACHER');
  if (pathname.startsWith('/teacher/')) {
    return (
      (hasRole(session, 'ADMIN') || hasRole(session, 'TEACHER')) &&
      hasPermission(session, 'progress.course.read')
    );
  }
  if (pathname.startsWith('/admin/')) {
    return hasRole(session, 'ADMIN') && hasPermission(session, 'progress.read');
  }

  return (
    session.roles.includes('STUDENT') &&
    hasPermission(session, 'progress.self_read') &&
    (pathname === authPaths.studentHome ||
      pathname.startsWith('/app/') ||
      pathname.startsWith('/learn/'))
  );
}

export function resolveAuthenticatedDestination(
  session: AuthenticatedSession,
  returnTo?: unknown,
): string {
  if (
    typeof returnTo === 'string' &&
    isSafeLocalPath(returnTo) &&
    canAccessReturnPath(session, returnTo)
  ) {
    return returnTo;
  }

  return defaultAuthenticatedPath(session);
}
