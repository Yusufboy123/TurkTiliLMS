import express from 'express';
import request from 'supertest';
import { describe, expect, it, vi } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import { createAuthRouter } from '../../src/modules/auth/auth.routes.js';
import type { AuthController } from '../../src/modules/auth/auth.controller.js';

describe('Registration route', () => {
  it('is public and does not require an authentication middleware', async () => {
    const register = vi.fn(async (_request, response) => {
      response.status(200).json({ success: true, message: 'ok' });
    });
    const noop = vi.fn(async () => undefined);
    const controller = {
      register,
      login: noop,
      refresh: noop,
      logout: noop,
      logoutAll: noop,
      me: noop,
      changePassword: noop,
    } as unknown as AuthController;
    const app = express();
    app.use(express.json());
    app.use(
      '/api/v1/auth',
      createAuthRouter({
        controller,
        authenticationMiddleware: (_request, _response, next) => next(),
      }),
    );
    app.use(errorHandler);
    const response = await request(app).post('/api/v1/auth/register').send({}).expect(200);
    expect(response.body.success).toBe(true);
    expect(register).toHaveBeenCalledOnce();
  });
});
