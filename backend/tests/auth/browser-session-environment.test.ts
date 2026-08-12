import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../../src/config/environment.js';

const requiredEnvironment = {
  NODE_ENV: 'production',
  DATABASE_URL: 'postgresql://test:test@localhost:5432/turk_tili_lms_test',
  FRONTEND_URL: 'https://learn.example.com',
  JWT_ACCESS_SECRET: 'test-only-access-secret-with-at-least-32-characters',
  JWT_ISSUER: 'turk-tili-lms-test',
  JWT_AUDIENCE: 'turk-tili-lms-test-clients',
};

describe('browser session environment policy', () => {
  it('requires an explicit runtime environment', () => {
    const withoutNodeEnvironment = { ...requiredEnvironment, NODE_ENV: undefined };

    expect(() => parseEnvironment(withoutNodeEnvironment)).toThrow('NODE_ENV');
  });

  it('rejects weak and repeated JWT access secrets', () => {
    expect(() =>
      parseEnvironment({ ...requiredEnvironment, JWT_ACCESS_SECRET: 'a'.repeat(43) }),
    ).toThrow('repeated or low-entropy');
    expect(() =>
      parseEnvironment({ ...requiredEnvironment, JWT_ACCESS_SECRET: 'abc'.repeat(16) }),
    ).toThrow('repeated or low-entropy');
  });

  it('rejects known JWT placeholder values', () => {
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        JWT_ACCESS_SECRET: 'replace-with-a-random-secret-value-that-is-long-enough',
      }),
    ).toThrow('placeholder');
  });

  it('accepts a strong random-like JWT access secret', () => {
    const environment = parseEnvironment({
      ...requiredEnvironment,
      JWT_ACCESS_SECRET: 'q7Vx2mN9pL4sR8tK6wC3yH5jF1dG0aBzUeI_oP-sXnQ',
    });

    expect(environment.JWT_ACCESS_SECRET).toHaveLength(43);
  });

  it('rejects unsafe production configuration', () => {
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        JWT_ACCESS_SECRET: 'short-but-not-a-placeholder',
      }),
    ).toThrow('at least 43 characters in production');
  });

  it('defaults the refresh cookie to Secure in production', () => {
    const environment = parseEnvironment({
      ...requiredEnvironment,
      NODE_ENV: 'production',
    });

    expect(environment.AUTH_REFRESH_COOKIE_SECURE).toBe(true);
  });

  it('refuses an explicitly insecure production refresh cookie', () => {
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        AUTH_REFRESH_COOKIE_SECURE: 'false',
      }),
    ).toThrow('The refresh cookie must be Secure in production.');
  });

  it('requires the configured frontend origin to use HTTPS in production', () => {
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        NODE_ENV: 'production',
        FRONTEND_URL: 'http://learn.example.com',
      }),
    ).toThrow('FRONTEND_URL must use HTTPS in production.');
  });

  it('rejects frontend URLs that are not exact origins', () => {
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        FRONTEND_URL: 'https://learn.example.com/application',
      }),
    ).toThrow('FRONTEND_URL must be an origin');
  });

  it('rejects cookie paths broader than the auth route scope', () => {
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        AUTH_REFRESH_COOKIE_PATH: '/',
      }),
    ).toThrow('AUTH_REFRESH_COOKIE_PATH');
  });

  it('rejects unsafe cookie names and unsupported SameSite=None configuration', () => {
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        AUTH_REFRESH_COOKIE_NAME: 'refresh cookie',
      }),
    ).toThrow('AUTH_REFRESH_COOKIE_NAME');
    expect(() =>
      parseEnvironment({
        ...requiredEnvironment,
        AUTH_REFRESH_COOKIE_SAME_SITE: 'none',
      }),
    ).toThrow('AUTH_REFRESH_COOKIE_SAME_SITE');
  });
});
