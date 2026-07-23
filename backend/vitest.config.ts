import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    restoreMocks: true,
    clearMocks: true,
    env: {
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://test:test@localhost:5432/turk_tili_lms_test',
      FRONTEND_URL: 'http://localhost:5173',
      JWT_ACCESS_SECRET: 'test-only-access-secret-with-at-least-32-characters',
      JWT_ACCESS_EXPIRES_IN: '15m',
      REFRESH_TOKEN_EXPIRES_IN: '30d',
      JWT_ISSUER: 'turk-tili-lms-test',
      JWT_AUDIENCE: 'turk-tili-lms-test-clients',
      BCRYPT_ROUNDS: '10',
      AUTH_MAX_FAILED_ATTEMPTS: '3',
      AUTH_LOCKOUT_MINUTES: '15',
    },
  },
});
