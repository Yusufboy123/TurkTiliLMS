import { RoleCode, SessionClientType } from '@prisma/client';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { errorHandler } from '../../src/middlewares/error-handler.middleware.js';
import {
  requirePermission,
  requireRole,
} from '../../src/modules/authorization/authorization.middleware.js';
import { GroupController } from '../../src/modules/groups/groups.controller.js';
import { createGroupRouter } from '../../src/modules/groups/groups.routes.js';
import { GroupService } from '../../src/modules/groups/groups.service.js';
import type { GroupRepository } from '../../src/modules/groups/groups.repository.js';
import type { GroupRecord } from '../../src/modules/groups/groups.types.js';

const studentPrincipal = {
  userId: '019b9e22-e356-713e-be3a-ab43b5b43f8b',
  sessionId: '019b9e22-e356-713e-be3a-ab43b5b43f8c',
  clientType: SessionClientType.WEB,
  roles: [RoleCode.STUDENT],
  permissions: ['groups.read'],
};
class EmptyRepository implements GroupRepository {
  async list() {
    return { items: [] as GroupRecord[], total: 0 };
  }
  async findById() {
    return null;
  }
  async findDetail() {
    return null;
  }
  async create(input: { teacherId: string }) {
    return {
      id: '019b9e22-e356-713e-be3a-ab43b5b43f8e',
      name: 'Guruh',
      level: 'A1',
      teacher: {
        id: input.teacherId,
        email: 'teacher@example.com',
        displayName: null,
        firstName: null,
        lastName: null,
      },
      studentCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    } as GroupRecord;
  }
  async findEligibleTeacher() {
    return false;
  }
  async findEligibleStudent() {
    return null;
  }
  async searchStudents() {
    return [];
  }
  async addStudent() {}
  async removeStudent() {
    return false;
  }
}
function authenticationMiddleware(): RequestHandler {
  return (request, _response, next) => {
    (request as typeof request & { auth?: typeof studentPrincipal }).auth = studentPrincipal;
    next();
  };
}
function app() {
  const instance = express();
  instance.use(express.json());
  instance.use(
    '/api/v1/groups',
    createGroupRouter(
      new GroupController(new GroupService(new EmptyRepository())),
      authenticationMiddleware(),
      requireRole(RoleCode.ADMIN, RoleCode.TEACHER),
      requirePermission,
    ),
  );
  instance.use(errorHandler);
  return instance;
}
describe('Group routes', () => {
  it('denies students before reaching group handlers', async () => {
    const response = await request(app()).get('/api/v1/groups').expect(403);
    expect(response.body.code ?? response.body.error?.code).toBe('ACCESS_DENIED');
  });
});
