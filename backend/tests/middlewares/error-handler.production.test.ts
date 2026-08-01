import express from 'express';
import request from 'supertest';

describe('production error responses', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('hides stack traces, exception messages, and absolute paths', async () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('FRONTEND_URL', 'https://learn.example.com');
    vi.resetModules();
    const { errorHandler } = await import('../../src/middlewares/error-handler.middleware.js');
    const app = express();
    app.get('/failure', (_request, _response, next) => {
      next(new Error('Prisma failure at C:\\private\\project\\backend\\src\\repository.ts:123'));
    });
    app.use(errorHandler);

    const response = await request(app).get('/failure').expect(500);
    const serialized = JSON.stringify(response.body);

    expect(response.body).toEqual({
      success: false,
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Serverda ichki xatolik yuz berdi.',
    });
    expect(serialized).not.toContain('stack');
    expect(serialized).not.toContain('Prisma');
    expect(serialized).not.toContain('C:\\private');
  });
});
