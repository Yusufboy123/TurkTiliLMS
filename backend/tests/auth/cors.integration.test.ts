import cors from 'cors';
import express from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  createCredentialedCorsOptions,
  createRejectUntrustedOrigin,
} from '../../src/middlewares/trusted-origin.middleware.js';

const frontendOrigin = 'http://localhost:5173';
const trustedOrigins = new Set([frontendOrigin]);
const app = express();
app.use(createRejectUntrustedOrigin(trustedOrigins));
app.use(cors(createCredentialedCorsOptions(trustedOrigins)));
app.get('/api/v1/health', (_request, response) => {
  response.status(200).json({ success: true });
});
app.use(errorHandler);

describe('credentialed CORS policy', () => {
  it('allows the configured frontend origin and approved authentication headers', async () => {
    const response = await request(app)
      .options('/api/v1/auth/refresh')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type,x-auth-transport');

    expect(response.status).toBe(204);
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:5173');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
    expect(response.headers['access-control-allow-headers']).toContain('X-Auth-Transport');
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
  });

  it('rejects an untrusted browser origin before any route executes', async () => {
    const response = await request(app)
      .options('/api/v1/auth/refresh')
      .set('Origin', 'https://attacker.example')
      .set('Access-Control-Request-Method', 'POST');

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('UNTRUSTED_ORIGIN');
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('keeps native and server clients without an Origin header compatible', async () => {
    const response = await request(app).get('/api/v1/health');

    expect(response.status).toBe(200);
  });
});
