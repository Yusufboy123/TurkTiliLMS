import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createRequestLogger } from '../../src/middlewares/request-logger.middleware.js';

describe('browser session request logging', () => {
  it('redacts the raw refresh cookie from structured request logs', async () => {
    const rawToken = 'raw-refresh-token-that-must-never-be-logged';
    const entries: string[] = [];
    const app = express();
    app.use(
      createRequestLogger({
        write(message) {
          entries.push(message);
        },
      }),
    );
    app.post('/api/v1/auth/refresh', (_request, response) => {
      response.status(401).json({
        success: false,
        code: 'INVALID_REFRESH_TOKEN',
        message: 'Sessiyani yangilash ma’lumoti yaroqsiz.',
      });
    });

    await request(app).post('/api/v1/auth/refresh').set('Cookie', `turk_tili_refresh=${rawToken}`);

    expect(entries.length).toBeGreaterThan(0);
    expect(entries.join('\n')).not.toContain(rawToken);
    expect(entries.join('\n')).not.toContain('turk_tili_refresh');
  });
});
