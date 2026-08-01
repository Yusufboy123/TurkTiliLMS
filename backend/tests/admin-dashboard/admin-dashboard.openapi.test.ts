import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const contractPath = fileURLToPath(
  new URL('../../../docs/openapi/admin-dashboard.v1.yaml', import.meta.url),
);

describe('Admin Dashboard OpenAPI runtime contract', () => {
  it('activates exactly the approved Module 9.4B operation', async () => {
    const contract = await readFile(contractPath, 'utf8');
    expect(contract).toContain('/admin/dashboard/summary:');
    expect(contract).toContain('operationId: getAdminDashboardSummary');
    expect(contract).toContain('x-implementation-phase: Module 9.4B');
    expect(contract).toContain('x-implementation-status: implemented');
    expect(contract).not.toContain('contract-only-not-available');
    expect(contract.match(/operationId:/gu)).toHaveLength(1);
  });

  it('documents exact authorization, privacy, audit, and distributed limiting', async () => {
    const contract = await readFile(contractPath, 'utf8');
    for (const permission of [
      'users.read',
      'courses.view_statistics',
      'progress.read',
      'certificates.course_read',
    ]) {
      expect(contract).toContain(`- ${permission}`);
    }
    expect(contract).toContain('x-required-roles: [ADMIN]');
    expect(contract).toContain('x-audit-event: admin_dashboard.summary_read');
    expect(contract).toContain('x-rate-limit-store: postgresql-audit-log-with-advisory-lock');
    expect(contract).toContain('const: private, no-store');
    expect(contract.match(/#\/components\/headers\/PrivateNoStore/gu)).toHaveLength(5);
    expect(contract).toContain('code: RATE_LIMIT_EXCEEDED');
    expect(contract).toContain('message: Serverda ichki xatolik yuz berdi.');
    expect(contract).not.toContain('message: Kutilmagan xatolik yuz berdi.');
    expect(contract).not.toContain('recentActivity:');
  });

  it('keeps every approved success field required and bounded', async () => {
    const contract = await readFile(contractPath, 'utf8');
    for (const field of [
      'generatedAt',
      'users',
      'courses',
      'enrollments',
      'progress',
      'certificates',
      'trackedEnrollments',
      'averageCompletionPercentage',
      'issued',
      'revoked',
    ]) {
      expect(contract).toContain(`${field}:`);
    }
    expect(contract).toContain('maximum: 9007199254740991');
    expect(contract).not.toMatch(/^\s+nullable:/gmu);
  });
});
