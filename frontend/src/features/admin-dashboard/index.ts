export { adminDashboardApi } from './api/admin-dashboard.api';
export {
  formatAdminDashboardSnapshot,
  formatAdminSummaryMetric,
} from './admin-dashboard.formatters';
export {
  adminDashboardPaths,
  adminDashboardRequiredPermissions,
  adminDashboardRequiredRoles,
  canAccessAdminDashboard,
} from './admin-dashboard.routes';
export { adminDashboardQueryKeys } from './hooks/admin-dashboard-query-keys';
export { useAdminDashboardSummary } from './hooks/use-admin-dashboard';
export type { AdminDashboardSummary, AdminSummaryMetric } from './types/admin-dashboard.types';
