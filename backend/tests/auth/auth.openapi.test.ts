import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const contract = readFileSync(
  resolve(import.meta.dirname, '../../../docs/openapi/auth.v1.yaml'),
  'utf8',
);

describe('authentication OpenAPI contract', () => {
  it('documents every implemented authentication route and transport distinction', () => {
    for (const path of [
      '  /auth/login:',
      '  /auth/refresh:',
      '  /auth/logout:',
      '  /auth/logout-all:',
      '  /auth/me:',
    ]) {
      expect(contract).toContain(path);
    }

    expect(contract).toContain('name: X-Auth-Transport');
    expect(contract).toContain('AMBIGUOUS_REFRESH_TRANSPORT');
    expect(contract).toContain('INVALID_AUTH_TRANSPORT');
    expect(contract).toContain('UNTRUSTED_ORIGIN');
    expect(contract).toContain('Browser-context requests cannot');
    expect(contract).toContain('InvalidOrAmbiguousAuthTransport');
  });

  it('documents HttpOnly cookie lifecycle and memory-only browser access tokens', () => {
    expect(contract).toContain('HttpOnly');
    expect(contract).toContain('SameSite=Lax');
    expect(contract).toContain('Path=/api/v1/auth');
    expect(contract).toContain('browser clients retain it in memory only');
    expect(contract).not.toMatch(/\b(?:localStorage|sessionStorage)\b/u);
  });

  it('keeps /auth/me bearer-only while allowing explicit cookie logout', () => {
    const meSection = contract.slice(
      contract.indexOf('  /auth/me:'),
      contract.indexOf('\ncomponents:'),
    );
    expect(meSection).toContain('bearerAuth');
    expect(meSection).not.toContain('refreshCookie: []');

    const logoutSection = contract.slice(
      contract.indexOf('  /auth/logout:'),
      contract.indexOf('  /auth/logout-all:'),
    );
    expect(logoutSection).toContain('refreshCookie: []');
  });
});
