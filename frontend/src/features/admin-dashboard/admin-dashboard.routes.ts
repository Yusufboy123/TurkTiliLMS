export const adminDashboardPaths = {
  dashboard: '/admin',
} as const;

export const adminDashboardRequiredPermissions = [
  'users.read',
  'courses.view_statistics',
  'progress.read',
  'certificates.course_read',
] as const;

export const adminDashboardRequiredRoles = ['ADMIN'] as const;

interface AdminDashboardAuthorization {
  readonly permissions: readonly string[];
  readonly roles: readonly string[];
}

export function canAccessAdminDashboard(authorization: AdminDashboardAuthorization): boolean {
  return (
    authorization.roles.includes('ADMIN') &&
    adminDashboardRequiredPermissions.every((permission) =>
      authorization.permissions.includes(permission),
    )
  );
}
