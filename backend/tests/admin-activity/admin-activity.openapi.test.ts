import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

const contractPath = fileURLToPath(new URL('../../../docs/openapi/admin-activity.v1.yaml', import.meta.url));

describe('Admin Activity OpenAPI contract', () => {
  it('documents the bounded admin-only paginated projection', async () => {
    const contract = await readFile(contractPath, 'utf8');
    expect(contract).toContain('/admin/activity:');
    expect(contract).toContain('operationId: listAdminActivity');
    expect(contract).toContain('x-required-roles: [ADMIN]');
    expect(contract).toContain('x-required-permissions: [audit.read]');
    expect(contract).toContain('Raw metadata and snapshots are never returned.');
  });
});
