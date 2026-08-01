export class AdminDashboardInvariantError extends Error {
  constructor(readonly invariant: string) {
    super(`Admin Dashboard aggregate invariant failed: ${invariant}`);
    this.name = 'AdminDashboardInvariantError';
  }
}
