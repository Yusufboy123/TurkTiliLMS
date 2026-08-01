import { describe, expect, it } from 'vitest';
import { parseEnvironment } from '../../src/config/environment.js';

const requiredEnvironment = {
  DATABASE_URL: 'postgresql://test:test@localhost:5432/turk_tili_lms_test',
  FRONTEND_URL: 'https://learn.example.com',
  JWT_ACCESS_SECRET: 'test-only-access-secret-with-at-least-32-characters',
  JWT_ISSUER: 'turk-tili-lms-test',
  JWT_AUDIENCE: 'turk-tili-lms-test-clients',
};

describe('browser session environment policy', () => {
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
