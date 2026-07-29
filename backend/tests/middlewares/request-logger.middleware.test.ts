import { describe, expect, it } from 'vitest';
import { redactSensitiveRequestUrl } from '../../src/middlewares/request-logger.middleware.js';

describe('request logger sensitive URL redaction', () => {
  it('removes the raw public certificate verification identifier', () => {
    const token = 'S'.repeat(43);
    const redacted = redactSensitiveRequestUrl(
      `/api/v1/public/certificates/verify/${token}?source=manual`,
    );

    expect(redacted).toBe('/api/v1/public/certificates/verify/[REDACTED]?source=manual');
    expect(redacted).not.toContain(token);
  });

  it('leaves unrelated request URLs unchanged', () => {
    expect(redactSensitiveRequestUrl('/api/v1/health')).toBe('/api/v1/health');
  });

  it('redacts verification routes using Express-compatible case-insensitive matching', () => {
    const token = 'C'.repeat(43);
    const redacted = redactSensitiveRequestUrl(`/API/V1/PUBLIC/CERTIFICATES/VERIFY/${token}`);

    expect(redacted).toBe('/API/V1/PUBLIC/CERTIFICATES/VERIFY/[REDACTED]');
    expect(redacted).not.toContain(token);
  });
});
