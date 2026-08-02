export const adminDashboardQueryKeys = {
  root: ['admin-dashboard'] as const,
  summary: () => [...adminDashboardQueryKeys.root, 'summary'] as const,
};
