import { RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import { rm } from 'node:fs/promises';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import request from 'supertest';
import { vi } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requireAuthentication,
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import type { AuthenticatedPrincipal } from '../../src/modules/authorization/authorization.types.js';
import { MediaController } from '../../src/modules/media/media.controller.js';
import { createMediaRouter } from '../../src/modules/media/media.routes.js';
import type { MediaManagementUseCases } from '../../src/modules/media/media.service.js';
import type {
  MediaActor,
  MediaAuditContext,
  StagedMediaUpload,
} from '../../src/modules/media/media.types.js';
import { createMediaUploadMiddleware } from '../../src/modules/media/media.upload.middleware.js';
import { MEDIA_ID, MEDIA_OWNER_ID, mediaFile } from '../helpers/media-fakes.js';

const pngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

class StubMediaService implements MediaManagementUseCases {
  upload = vi.fn(
    async (stagedUpload: StagedMediaUpload, _actor: MediaActor, _context: MediaAuditContext) => {
      await rm(stagedUpload.path, { force: true });
      const response = mediaFile({
        originalFileName: stagedUpload.originalFileName,
      });
      Reflect.deleteProperty(response, 'storagePath');
      return response;
    },
  );

  getById = vi.fn(async (_id: string, _actor: MediaActor) => {
    const response = mediaFile();
    Reflect.deleteProperty(response, 'storagePath');
    return response;
  });

  download = vi.fn(async (_id: string, _actor: MediaActor) => ({
    stream: Readable.from(Buffer.from('media-data')),
    contentLength: 10,
    mimeType: 'image/png',
    originalFileName: 'turk-tili.png',
  }));

  delete = vi.fn(
    async (_id: string, _actor: MediaActor, _context: MediaAuditContext): Promise<void> =>
      undefined,
  );

  restore = vi.fn(async (_id: string, _actor: MediaActor, _context: MediaAuditContext) => {
    const response = mediaFile();
    Reflect.deleteProperty(response, 'storagePath');
    return response;
  });

  usages = vi.fn(async (id: string, _actor: MediaActor) => ({
    mediaFileId: id,
    activeOnly: true as const,
    items: [],
    totalItems: 0,
    limit: 100,
    truncated: false,
  }));
}

function authenticatedAs(roles: RoleCode[], permissions: string[]): RequestHandler {
  return (incomingRequest, _response, next) => {
    const principal: AuthenticatedPrincipal = {
      userId: MEDIA_OWNER_ID,
      sessionId: '019b9e24-5147-7f4b-9726-e46482877c69',
      clientType: SessionClientType.WEB,
      roles,
      permissions,
    };
    (incomingRequest as typeof incomingRequest & { auth?: AuthenticatedPrincipal }).auth =
      principal;
    next();
  };
}

function createTestApp(
  service: StubMediaService,
  stagingDirectory: string,
  roles: RoleCode[] | null,
  permissions: string[],
  maximumSizeBytes = 1_024,
): express.Express {
  const app = express();
  app.use(express.json());
  app.use(
    '/api/v1/media',
    createMediaRouter({
      controller: new MediaController(service),
      uploadMiddleware: createMediaUploadMiddleware({
        stagingDirectory,
        maximumSizeBytes,
      }),
      authenticationMiddleware:
        roles === null ? requireAuthentication : authenticatedAs(roles, permissions),
      managementRoleMiddleware: requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
      permissionMiddleware: requirePermission,
    }),
  );
  app.use(errorHandler);
  return app;
}

describe('Media routes', () => {
  let stagingDirectory: string;

  beforeEach(async () => {
    stagingDirectory = await mkdtemp(join(tmpdir(), 'turk-tili-media-routes-'));
  });

  afterEach(async () => {
    await rm(stagingDirectory, { recursive: true, force: true });
  });

  it('uploads one supported multipart file for an authorized teacher', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.TEACHER], ['media.upload']);

    const response = await request(app)
      .post('/api/v1/media/upload')
      .attach('file', pngBytes, {
        filename: 'turk-tili.png',
        contentType: 'image/png',
      })
      .expect(201);

    expect(response.headers.location).toBe(`/api/v1/media/${MEDIA_ID}`);
    expect(response.body.message).toBe('Media fayl muvaffaqiyatli yuklandi.');
    expect(service.upload).toHaveBeenCalledWith(
      expect.objectContaining({
        originalFileName: 'turk-tili.png',
        declaredMimeType: 'image/png',
        sizeBytes: pngBytes.length,
      }),
      expect.objectContaining({ userId: MEDIA_OWNER_ID }),
      expect.objectContaining({ actorUserId: MEDIA_OWNER_ID }),
    );
  });

  it('rejects unsupported file extensions before the service', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.ADMIN], ['media.upload']);

    const response = await request(app)
      .post('/api/v1/media/upload')
      .attach('file', Buffer.from('danger'), {
        filename: 'danger.exe',
        contentType: 'application/octet-stream',
      })
      .expect(422);

    expect(response.body.code).toBe('MEDIA_EXTENSION_NOT_SUPPORTED');
    expect(service.upload).not.toHaveBeenCalled();
  });

  it('rejects files larger than the configured multipart limit', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.ADMIN], ['media.upload'], 8);

    const response = await request(app)
      .post('/api/v1/media/upload')
      .attach('file', pngBytes, {
        filename: 'large.png',
        contentType: 'image/png',
      })
      .expect(413);

    expect(response.body.code).toBe('MEDIA_FILE_TOO_LARGE');
    expect(service.upload).not.toHaveBeenCalled();
  });

  it('requires a file in the multipart field', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.ADMIN], ['media.upload']);

    const response = await request(app).post('/api/v1/media/upload').expect(422);
    expect(response.body.code).toBe('MEDIA_FILE_REQUIRED');
  });

  it('denies students even if a media permission is present', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.STUDENT], ['media.read']);

    await request(app).get(`/api/v1/media/${MEDIA_ID}`).expect(403);
    expect(service.getById).not.toHaveBeenCalled();
  });

  it('denies management roles without the endpoint permission', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.TEACHER], []);

    await request(app).get(`/api/v1/media/${MEDIA_ID}`).expect(403);
    expect(service.getById).not.toHaveBeenCalled();
  });

  it('returns metadata without the internal storage path', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.ADMIN], ['media.read']);

    const response = await request(app).get(`/api/v1/media/${MEDIA_ID}`).expect(200);
    expect(response.body.data.id).toBe(MEDIA_ID);
    expect(response.body.data).not.toHaveProperty('storagePath');
  });

  it('protects media usages with authentication, role, and media.read permission', async () => {
    const unauthenticatedService = new StubMediaService();
    const unauthenticatedApp = createTestApp(unauthenticatedService, stagingDirectory, null, []);
    await request(unauthenticatedApp).get(`/api/v1/media/${MEDIA_ID}/usages`).expect(401);

    const studentService = new StubMediaService();
    const studentApp = createTestApp(
      studentService,
      stagingDirectory,
      [RoleCode.STUDENT],
      ['media.read'],
    );
    await request(studentApp).get(`/api/v1/media/${MEDIA_ID}/usages`).expect(403);

    const adminService = new StubMediaService();
    const adminApp = createTestApp(
      adminService,
      stagingDirectory,
      [RoleCode.ADMIN],
      ['media.read'],
    );
    const response = await request(adminApp).get(`/api/v1/media/${MEDIA_ID}/usages`).expect(200);

    expect(response.body.data).toMatchObject({
      mediaFileId: MEDIA_ID,
      activeOnly: true,
      totalItems: 0,
    });
    expect(adminService.usages).toHaveBeenCalledOnce();
  });

  it('streams a protected download with safe headers', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.TEACHER], ['media.download']);

    const response = await request(app).get(`/api/v1/media/${MEDIA_ID}/download`).expect(200);

    expect(response.headers['content-type']).toMatch(/^image\/png/u);
    expect(response.headers['content-disposition']).toContain('attachment;');
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(response.body).toEqual(Buffer.from('media-data'));
  });

  it('requires explicit confirmation before soft deletion', async () => {
    const service = new StubMediaService();
    const app = createTestApp(service, stagingDirectory, [RoleCode.ADMIN], ['media.delete']);

    const response = await request(app)
      .delete(`/api/v1/media/${MEDIA_ID}`)
      .send({ confirmation: false })
      .expect(422);

    expect(response.body.code).toBe('VALIDATION_ERROR');
    expect(service.delete).not.toHaveBeenCalled();
  });

  it('supports soft deletion and restoration', async () => {
    const service = new StubMediaService();
    const app = createTestApp(
      service,
      stagingDirectory,
      [RoleCode.ADMIN],
      ['media.delete', 'media.restore'],
    );

    await request(app).delete(`/api/v1/media/${MEDIA_ID}`).send({ confirmation: true }).expect(200);
    await request(app).post(`/api/v1/media/${MEDIA_ID}/restore`).expect(200);

    expect(service.delete).toHaveBeenCalledOnce();
    expect(service.restore).toHaveBeenCalledOnce();
  });
});
